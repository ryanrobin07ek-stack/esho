import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(projectRoot, 'public');
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};
const failures = [];
const tested = {
  moods: 0,
  layouts: 0,
  animations: 0,
  productCardStyles: 0,
  categoryStyles: 0,
  paletteStyles: 0,
  desktopChecks: 0,
  tabletChecks: 0,
  categoryVisibilityChecks: 0
};
const refreshTimes = [];

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(publicRoot, `.${pathname}`);
    if (file !== publicRoot && !file.startsWith(`${publicRoot}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const contents = await readFile(file);
    response.writeHead(200, {
      'content-type': contentTypes[extname(file)] || 'application/octet-stream'
    }).end(contents);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

async function waitForStablePreview(page) {
  await page.waitForFunction(() => {
    const source = document.querySelector('#store .sole-store');
    const frame = document.querySelector('#storePreviewFrame');
    const preview = frame?.contentDocument?.querySelector('.sole-store');
    const sourceCategories = source?.querySelectorAll('.litrus-categories .litrus-category-link').length || 0;
    const previewCategories = preview?.querySelectorAll('.litrus-categories .litrus-category-link').length || 0;
    if (!source || !preview ||
        source.querySelectorAll('.p-card').length < 4 ||
        preview.querySelectorAll('.p-card').length < 4 ||
        sourceCategories < 4 || previewCategories < 4) return false;
    const signature = store => JSON.stringify([
      store.dataset.heroId,
      store.dataset.cardStyle,
      store.dataset.categoryStyle,
      store.className,
      store.querySelector('.prods')?.className,
      store.querySelector('.litrus-categories')?.dataset.categoryStyle,
      [...store.querySelectorAll('.litrus-categories .litrus-category-link')].map(link => link.className),
      [...store.querySelectorAll('.p-card')].map(card => card.className)
    ]);
    return signature(source) === signature(preview);
  }, null, { timeout: 5000 });
}

async function checkProducts(page, label, key) {
  try {
    await waitForStablePreview(page);
  } catch {
    failures.push(`${label}: preview did not stabilize with all four products`);
    return;
  }
  const inspect = async () => {
    await page.waitForFunction(() => {
      const store = document.querySelector('#storePreviewFrame')?.contentDocument?.querySelector('.sole-store');
      return store && store.querySelectorAll('.p-card').length >= 4 &&
        store.querySelectorAll('.litrus-categories .litrus-category-link').length >= 4;
    }, null, { timeout: 5000 });
    return page.locator('#storePreviewFrame').evaluate(frame => {
    const store = frame.contentDocument.querySelector('.sole-store');
    const isVisible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        rect.width > 0 && rect.height > 0;
    };
    const products = [...store.querySelectorAll('.p-card')].filter(isVisible).length;
    const links = [...store.querySelectorAll('.litrus-categories .litrus-category-link')];
    const visibleCategories = new Set(links.filter(isVisible).map(link =>
      link.querySelector('[data-litrus-category-name]')?.textContent.trim()
    ).filter(Boolean));
    const categories = new Set(links.map(link =>
      link.querySelector('[data-litrus-category-name]')?.textContent.trim()
    ).filter(Boolean));
    const parseRgb = value => {
      const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      return channels?.length === 3 ? channels.map(channel => channel / 255) : null;
    };
    const luminance = color => color.map(channel =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    ).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const contrastFailures = links.filter(link => {
      if (!link.classList.contains('cat-pill')) return false;
      const label = link.querySelector('[data-litrus-category-name]');
      if (!label?.textContent.trim()) return true;
      const foreground = parseRgb(getComputedStyle(label).color);
      const background = parseRgb(getComputedStyle(link).backgroundColor);
      if (!foreground || !background) return false;
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05) < 4.5;
    }).length;
    return {
      products, categories: categories.size, visibleCategories: visibleCategories.size, contrastFailures
    };
    });
  };
  const started = performance.now();
  await page.locator('[data-preview-device="fit"]').click();
  const desktop = await inspect();
  tested.desktopChecks += 1;
  await page.locator('[data-preview-device="tablet"]').click();
  const tablet = await inspect();
  tested.tabletChecks += 1;
  tested.categoryVisibilityChecks += 2;
  await page.locator('[data-preview-device="fit"]').click();
  tested[key] += 1;
  if (!desktop.products) failures.push(`${label} (desktop): all product cards are hidden`);
  if (!tablet.products) failures.push(`${label} (tablet): all product cards are hidden`);
  if (desktop.categories < 4 || desktop.visibleCategories < desktop.categories) {
    failures.push(`${label} (desktop): category links are missing or hidden (${desktop.visibleCategories}/${desktop.categories})`);
  }
  if (tablet.categories < 4 || tablet.visibleCategories < tablet.categories) {
    failures.push(`${label} (tablet): category links are missing or hidden (${tablet.visibleCategories}/${tablet.categories})`);
  }
  if (desktop.contrastFailures || tablet.contrastFailures) {
    failures.push(`${label}: category pills have missing labels or low text contrast`);
  }
}

async function checkSelectOptions(page, selector, label, key) {
  const values = await page.locator(`${selector} option`).evaluateAll(options =>
    options.map(option => option.value)
  );
  for (const value of values) {
    const started = performance.now();
    await page.locator(selector).selectOption(value);
    await checkProducts(page, `${label}=${value || '(default)'}`, key);
    if (selector === '#selPal') {
      if (!await page.locator('#fixC').isChecked()) {
        failures.push(`${label}=${value || '(default)'}: automatic contrast correction is disabled`);
      }
      const contrast = (await page.locator('#chkBtn').textContent()) || '';
      if (!/^Contrast: all \d+ pass/.test(contrast)) {
        failures.push(`${label}=${value || '(default)'}: ${contrast}`);
      }
    }
    refreshTimes.push(performance.now() - started);
  }
}

let browser;
try {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const pageErrors = [];
  let previewNavigations = 0;
  page.on('framenavigated', frame => {
    if (frame.url() === 'about:srcdoc') previewNavigations += 1;
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('https://**', route => route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/litrus-mixer/index.html`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForFunction(() =>
    document.querySelector('#storePreviewFrame')?.contentDocument?.querySelector('.sole-store'),
  null, { timeout: 20000 });
  const navigationTiming = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    return navigation ? {
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      loadEventMs: navigation.loadEventEnd ? Math.round(navigation.loadEventEnd) : undefined
    } : null;
  });
  const initialMood = (await page.locator('#wMoods button.mood.on').innerText()).trim();
  const availableMoods = (await page.locator('#wMoods button.mood').allTextContents()).map(name => name.trim());
  if (!initialMood || initialMood === 'Good Form' || !availableMoods.includes(initialMood)) {
    failures.push(`initial Litrus mood is not an available randomized style: ${initialMood}`);
  }

  const draftPage = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  draftPage.on('pageerror', error => pageErrors.push(`draft: ${error.message}`));
  await draftPage.goto(`http://127.0.0.1:${server.address().port}/litrus-mixer/index.html?craft=1`, {
    waitUntil: 'domcontentloaded'
  });
  const draftDefault = await draftPage.evaluate(() => {
    const categories = ['Shoes', 'Bags', 'New', 'Sale'].map((name, index) => ({ id: index + 1, name }));
    const products = categories.map((category, index) => ({
      id: index + 1, name: `Draft product ${index + 1}`, price: 100 + index,
      category_names: [category.name], images: []
    }));
    window.litrusSetCraftCatalog({
      shop: { name: 'Good Form draft', is_new_shop_draft: true, draft_id: 'smoke-draft' },
      categories, products
    });
    return {
      mood: document.querySelector('#wMoods button.mood.on')?.textContent.trim(),
      availableMoods: [...document.querySelectorAll('#wMoods button.mood')].slice(0, 8)
        .map(button => button.textContent.trim()),
      categoryPosition: document.querySelector('#shopCategoryPosition')?.value
    };
  });
  if (!draftDefault.mood || draftDefault.mood === 'Good Form' ||
      !draftDefault.availableMoods.includes(draftDefault.mood) ||
      draftDefault.categoryPosition !== 'after-hero') {
    failures.push(`new Craft draft did not receive an available randomized style: ${JSON.stringify(draftDefault)}`);
  }

  await draftPage.evaluate(() => {
    const categories = ['Shoes', 'Bags', 'New', 'Sale'].map((name, index) => ({ id: index + 1, name }));
    const products = categories.map((category, index) => ({
      id: index + 1, name: `Existing product ${index + 1}`, price: 100 + index,
      category_names: [category.name], images: []
    }));
    const existingHtml = '<!doctype html><html><head><meta name="eshop-filled-theme" content="litrus-mixer"><style>.saved-site{color:rgb(1, 2, 3)}</style></head><body><main id="saved-existing-site" class="saved-site">Saved existing storefront</main><script>window.savedSiteScriptRan=true</script></body></html>';
    window.litrusSetCraftCatalog({
      shop: { name: 'Existing site', is_new_shop_draft: false },
      categories, products, existing_html: existingHtml
    });
    window.craftLitrusSetMode('preview');
  });
  await draftPage.waitForFunction(() =>
    document.querySelector('#storePreviewFrame')?.contentDocument?.getElementById('saved-existing-site')
  );
  const savedPreview = await draftPage.locator('#storePreviewFrame').evaluate(frame => ({
    title: frame.contentDocument.getElementById('saved-existing-site')?.textContent,
    script: frame.contentDocument.querySelector('script'),
    sandbox: frame.getAttribute('sandbox')
  }));
  if (savedPreview.title !== 'Saved existing storefront' || savedPreview.script ||
      savedPreview.sandbox !== 'allow-same-origin') {
    failures.push(`existing-site preview did not preserve the saved read-only storefront: ${JSON.stringify(savedPreview)}`);
  }
  await draftPage.evaluate(() => window.craftLitrusSetMode('build'));
  await draftPage.locator('#selLay').evaluate(select => {
    const next = [...select.options].find(option => option.value !== select.value);
    if (next) {
      select.value = next.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await draftPage.evaluate(() => window.craftLitrusSetMode('preview'));
  await draftPage.waitForFunction(() =>
    document.querySelector('#storePreviewFrame')?.contentDocument?.querySelector('.sole-store')
  );
  const editedPreviewSandbox = await draftPage.locator('#storePreviewFrame').getAttribute('sandbox');
  if (editedPreviewSandbox !== null) {
    failures.push('editing an existing site did not switch back to the editable Litrus preview');
  }
  await draftPage.close();

  await page.locator('#wName').fill('Litrus Browser Smoke Shop');
  await page.locator('#wOfferType').selectOption('products');
  await page.locator('#wType').selectOption('shoes');
  await page.locator('#wWhat').fill('shoes and accessories');
  await page.locator('#wShufWords').click();
  if (!(await page.locator('#wHead').inputValue()) &&
      !(await page.locator('#wTag').inputValue())) {
    failures.push('word shuffle left the headline and slogan empty');
  }
  await page.locator('#wNext').click();
  await page.waitForFunction(() => {
    const step = document.querySelector('[data-step="2"]');
    return step && !step.hidden;
  });

  await page.locator('#wProds button[aria-label^="Edit "]').first().click();
  await page.locator('#editProdName').fill('Smoke test sneaker');
  await page.locator('#editProdPrice').fill('4567');
  await page.locator('#editProdDesc').fill('Edited in browser smoke test');
  await page.locator('#editProdSave').click();
  await page.locator('#wAdd').click();
  await page.locator('#editProdName').fill('New smoke product');
  await page.locator('#editProdPrice').fill('999');
  await page.locator('#editProdSave').click();
  if (await page.locator('#wProds .prow').count() !== 4) {
    failures.push('product add/edit did not leave four editable products');
  }

  await page.locator('#wCategoriesTabBtn').click();
  await page.locator('#wCatNew').fill('Browser smoke category');
  await page.locator('#wCatAdd').click();
  if (!await page.locator('#wCatChips').getByText('Browser smoke category').count()) {
    failures.push('added category did not appear in the category editor');
  }
  await page.locator('#wNext').click();
  await page.waitForFunction(() => {
    const step = document.querySelector('[data-step="3"]');
    return step && !step.hidden;
  });
  await page.locator('#wMoods + button.mood-more').click();

  const moods = await page.locator('#wMoods button.mood').all();
  for (const mood of moods) {
    if (!await mood.isVisible()) {
      failures.push('some mood options remained hidden after More feelings');
      break;
    }
    const name = (await mood.innerText()).trim();
    const started = performance.now();
    await mood.click();
    await checkProducts(page, `mood=${name}`, 'moods');
    refreshTimes.push(performance.now() - started);
  }

  const layout = page.locator('#selLay');
  const currentLayout = await layout.inputValue();
  const nextLayout = await layout.locator('option').evaluateAll((options, current) =>
    options.find(option => option.value !== current)?.value, currentLayout
  );
  const layoutStarted = performance.now();
  await layout.selectOption(nextLayout);
  if (await page.locator('#previewStatus').textContent() !== 'Making changes...') {
    failures.push('preview update indicator did not announce pending changes');
  }
  await page.waitForFunction(() => document.querySelector('#previewStatus').hidden, null, {
    timeout: 5000
  });
  refreshTimes.push(performance.now() - layoutStarted);

  await checkSelectOptions(page, '#selLay', 'layout', 'layouts');
  await checkSelectOptions(page, '#selAnim', 'animation', 'animations');
  await checkSelectOptions(page, '#selCard', 'product card style', 'productCardStyles');
  await checkSelectOptions(page, '#selCat', 'category style', 'categoryStyles');
  await checkSelectOptions(page, '#selPal', 'palette', 'paletteStyles');
  const publishPayload = await page.evaluate(() => {
    try {
      const payload = window.litrusGetCraftPublishPayload();
      return {
        hasHtml: typeof payload?.html === 'string' && /^<!doctype\s+html>/i.test(payload.html),
        hasRecipe: payload?.recipe?.litrus === 'mixer-recipe' &&
          typeof payload.recipe.generatedDefault === 'boolean' &&
          typeof payload.recipe.draftId === 'string',
        hasCatalog: Array.isArray(payload?.catalog?.products),
        // A shop without owner-entered testimonials must publish no invented reviews or trust claims.
        fabricatedSocialProof: typeof payload?.html === 'string' &&
          /Amina W\.|Brian O\.|Faith K\.|Real reviews from real people|Verified buyer|Free returns|2,000\+ orders|4\.8 \/ 5 rating|\(142 reviews\)/.test(payload.html)
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
  if (!publishPayload.hasHtml || !publishPayload.hasRecipe || !publishPayload.hasCatalog) {
    failures.push(`publish payload generation failed: ${publishPayload.error || JSON.stringify(publishPayload)}`);
  }
  if (publishPayload.fabricatedSocialProof) {
    failures.push('published storefront contains invented reviews, ratings or trust claims');
  }
  failures.push(...pageErrors.map(error => `browser error: ${error}`));
  if (previewNavigations > 1) {
    failures.push(`preview iframe reloaded ${previewNavigations} times while exercising styles`);
  }

  const sortedRefreshTimes = [...refreshTimes].sort((a, b) => a - b);
  const performanceSummary = refreshTimes.length ? {
    navigationTiming,
    optionRefreshCount: refreshTimes.length,
    optionRefreshMedianMs: Math.round(sortedRefreshTimes[Math.floor(sortedRefreshTimes.length / 2)]),
    optionRefreshMaxMs: Math.round(sortedRefreshTimes[sortedRefreshTimes.length - 1]),
    previewIframeNavigations: previewNavigations
  } : { navigationTiming, optionRefreshCount: 0 };
  console.log(JSON.stringify({ optionsExercised: tested, performance: performanceSummary, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise((resolveClose, reject) =>
    server.close(error => error ? reject(error) : resolveClose())
  );
}
