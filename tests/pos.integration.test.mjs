import assert from 'node:assert/strict';
import { readFile as readFileRaw, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import initSqlJs from 'sql.js';
import { WEBSITE_THEME_CATALOG } from '../src/theme-catalog.js';
import {
  classifyQrCode, createPosApp, matchProductLabel, MIN_IMAGE_MATCH_SIMILARITY,
  parseProductLabel, rankImageMatches, suggestImageCategories
} from '../src/pos.js';

const readFile = async (path, options) => {
  const contents = await readFileRaw(path, options);
  return typeof contents === 'string' ? contents.replace(/\r\n/g, '\n') : contents;
};

test('POS charts keep full history and render larger, scrollable value/date axes', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function chartAxisMoney(');
  const end = source.indexOf('\n  function renderSettings(', start);
  assert.ok(start >= 0 && end > start, 'The POS chart renderers should be a bounded block.');
  assert.match(source, /const revenueSeries = Object\.entries\(daily\)\.sort\(\(\[first\], \[second\]\) => first\.localeCompare\(second\)\);/);
  const revenueSeriesLineStart = source.indexOf('const revenueSeries = Object.entries(daily)');
  const revenueSeriesLine = source.slice(revenueSeriesLineStart, source.indexOf('\n', revenueSeriesLineStart));
  assert.doesNotMatch(revenueSeriesLine, /slice/);
  const renderCharts = new Function(
    'money',
    'escapeHtml',
    `${source.slice(start, end)}; return { renderRevenueChart, renderProfitChart };`
  )((value, currency) => `${currency} ${value}`, value => String(value));
  const history = Array.from({ length: 30 }, (_, index) => [
    `2024-01-${String(index + 1).padStart(2, '0')}`,
    index * 10
  ]);
  for (const [renderer, data] of [
    [renderCharts.renderRevenueChart, history],
    [renderCharts.renderProfitChart, history.map(([date, value]) => [date, value - 100])]
  ]) {
    const markup = renderer(data, 'KES');
    assert.match(markup, /chart history; scroll horizontally to see all dates/);
    assert.match(markup, /value and date axes/);
    assert.match(markup, /--pos-chart-min-width:1894px/);
    assert.equal((markup.match(/class="pos-revenue-chart-axis-label"/g) || []).length, 35);
    assert.equal((markup.match(/class="pos-revenue-chart-point"/g) || []).length, 30);
    assert.match(markup, /24-01-30/);
  }
});

test('POS cart interactions render locally without reloading saved POS state', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const addCart = source.match(/else if \(action === 'add-cart'\) \{([\s\S]*?)\n      \} else if \(action === 'cart-plus'/)?.[1];
  const addProduct = source.match(/async function addProductToSale\([\s\S]*?\n  \}/)?.[0];
  assert.ok(addCart);
  assert.match(addCart, /updateCartPanel\(\)/);
  assert.doesNotMatch(addCart, /await refresh\(\)/);
  assert.ok(addProduct);
  assert.match(addProduct, /updateCartPanel\(\)/);
  assert.doesNotMatch(addProduct, /await refresh\(\)/);
});

test('POS sales load all line items in one batch instead of querying once per sale', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const listSales = source.match(/async function listSales\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(listSales);
  assert.match(listSales, /FROM pos_sale_items WHERE sale_id IN \(SELECT id FROM pos_sales\)/);
  assert.doesNotMatch(listSales, /for \(const sale of sales\) \{[\s\S]*?await rows\(/);
});

test('POS sync IDs stay stable when Web Crypto is unavailable', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function sha256Fallback(bytes) {');
  const end = source.indexOf('  async function queueProduct(', start);
  assert.ok(start >= 0 && end > start, 'The POS sync ID helpers should have a bounded implementation.');
  const helperSource = source.slice(start, end);
  const input = 'SKU-123';
  const fallbackId = await new Script(`(async () => { ${helperSource}; return stableRecordId('PRODUCT', ${JSON.stringify(input)}); })()`)
    .runInNewContext({ crypto: undefined, TextEncoder });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const expectedId = `PRODUCT-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  assert.equal(fallbackId, expectedId);
});

test('POS checkout clears a saved sale and reports a post-save sync failure', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const start = source.indexOf('  async function saveCheckout(data, method, paid) {');
  const end = source.indexOf('  async function queueCloudRecord(', start);
  assert.ok(start >= 0 && end > start, 'The POS checkout save flow should have a bounded implementation.');
  const state = { cart: [{ productId: 1 }], activeTicketId: '', paymentMethod: 'Cash', discount: 0 };
  let saveCount = 0;
  let refreshCount = 0;
  let toastResult;
  const context = {
    state,
    saveSale: async () => {
      saveCount += 1;
      return { id: 1, receiptNumber: 'SALE-1' };
    },
    listSales: async () => [{ id: 1, receipt_number: 'SALE-1' }],
    queueCloudRecord: async () => {},
    listProducts: async () => [{ id: 1 }],
    queueProduct: async () => { throw new Error('Web Crypto unavailable'); },
    syncInventorySales: async () => 0,
    refresh: async () => { refreshCount += 1; },
    toast: (message, isError) => { toastResult = { message, isError }; },
    Error
  };
  const saveCheckout = new Script(`(() => { ${source.slice(start, end)}; return saveCheckout; })()`)
    .runInNewContext(context);
  await saveCheckout({}, 'Cash', true);
  assert.equal(saveCount, 1, 'A saved receipt must not be retried after sync fails.');
  assert.equal(state.cart.length, 0, 'A saved receipt must be removed from the checkout cart.');
  assert.equal(refreshCount, 1);
  assert.equal(toastResult.isError, true);
  assert.match(toastResult.message, /Receipt SALE-1 saved, but sync failed: Web Crypto unavailable/);
});

test('POS product and inventory rows expose pencil and trash actions', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const inventory = source.match(/if \(screen === '\/catalogue\/inventory'\) \{([\s\S]*?)\n    \}\n    return `<section class="pos-content">/)?.[1];
  assert.ok(inventory, 'POS inventory screen should have a bounded renderer.');
  assert.match(inventory, /iconLink\(`\/pos\/inventory\?edit=\$\{item\.id\}`/);
  assert.match(inventory, /iconButton\('delete-product'/);
  const products = source.match(/if \(screen === '\/catalogue\/products'\) \{([\s\S]*?)\n    \}\n    if \(screen === '\/catalogue\/categories'\)/)?.[1];
  assert.ok(products, 'POS products screen should have a bounded renderer.');
  assert.match(products, /iconLink\(`\/pos\/catalogue\/products\?edit=\$\{item\.id\}`/);
  assert.match(products, /iconButton\('delete-product'/);
  assert.match(source, /if \(screen === '\/catalogue\/products'\)[\s\S]*?params\.get\('edit'\)[\s\S]*?productForm\(product\)/);
  const categories = source.match(/if \(screen === '\/catalogue\/categories'\) \{([\s\S]*?)\n    \}\n    if \(screen === '\/catalogue\/suppliers'\)/)?.[1];
  assert.ok(categories, 'POS categories screen should have a bounded renderer.');
  assert.match(categories, /iconButton\('rename-category'/);
  assert.match(categories, /iconButton\('delete-category'/);
  assert.match(categories, /Default category/);
  assert.match(source, /<details class="pos-catalogue-item">[\s\S]*?iconButton\('rename-category'/);
  assert.match(source, /productDetailsCards\('\/pos\/catalogue\/products'\)/);
  assert.match(source, /productDetailsCards\('\/pos\/inventory', 'inventory'\)/);
  assert.match(source, /summaryMode === 'inventory'[\s\S]*?in stock/);
  assert.match(source, /categoryDetailsCards\(\)/);
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /\.pos-row-actions \.pos-icon-action \{[\s\S]*?border: 0 !important;[\s\S]*?background: transparent !important/);
  assert.match(pageSource, /\.pos-row-actions \.product-list-delete \{[\s\S]*?color: var\(--danger\)/);
  assert.match(pageSource, /@media \(max-width: 520px\) \{[\s\S]*?\.pos-catalogue-desktop-list \{\s*display: none/);
  assert.match(pageSource, /@media \(max-width: 520px\) \{[\s\S]*?\.pos-mobile-catalogue \{\s*display: grid/);
  assert.match(pageSource, /\.pos-catalogue-item\[open\] \{[\s\S]*?background: var\(--app-card-surface/);
  assert.match(pageSource, /\.pos-catalogue-item > summary strong \{[\s\S]*?font-size: 0\.84rem;[\s\S]*?font-weight: 500/);
});

test('Orders removes the New sale border and quotations use selectable three-column product cards', async () => {
  const [source, pageSource] = await Promise.all([
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  const orders = source.match(/function renderOrders\(\) \{([\s\S]*?)\n  \}/)?.[1];
  const quotations = source.match(/function renderQuotations\(\) \{([\s\S]*?)\n  \}/)?.[1];

  assert.ok(orders, 'Orders renderer should exist.');
  assert.match(orders, /class="btn-secondary pos-orders-new-sale">New sale/);
  assert.ok(quotations, 'Quotations renderer should exist.');
  assert.match(quotations, /class="pos-product-picks pos-quote-product-grid"/);
  assert.match(quotations, /class="pos-product-tile pos-quote-product"/);
  assert.match(quotations, /type="checkbox" name="products" value="\$\{product\.id\}"/);
  assert.match(quotations, /product\.imageUri[\s\S]*?pos-product-placeholder/);
  assert.match(pageSource, /\.pos-orders-new-sale\s*\{\s*border:\s*0 !important/);
  assert.match(pageSource, /\.pos-quote-product-grid\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(pageSource, /\.pos-quote-product input\[type="checkbox"\]\s*\{[\s\S]*?position:\s*absolute/);
});

test('More keeps its three destinations in separate full-width cards', async () => {
  const [source, pageSource] = await Promise.all([
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  const more = source.match(/function renderMore\(\) \{([\s\S]*?)\n  \}/)?.[1];

  assert.ok(more, 'More renderer should exist.');
  assert.equal((more.match(/'pos-more-card'/g) || []).length, 3);
  assert.match(more, /Business instances/);
  assert.match(more, /Sales &amp; receipts/);
  assert.match(more, /Settings/);
  assert.match(pageSource, /\.pos-content \.pos-more-card\s*\{[^}]*width:\s*100vw[^}]*margin-left:\s*calc\(50% - 50vw\)/);
  assert.match(pageSource, /\.pos-more-link\s*\{[^}]*min-height:\s*104px/);
});

test('workspace screen navigation uses side drawers and loading placeholders use skeletons', async () => {
  const [pageSource, posSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8')
  ]);
  assert.match(pageSource, /renderWorkspaceSidebar\(title, items, activeRoute\)[\s\S]*?workspace-sidebar-scrim[\s\S]*?workspace-sidebar-links[\s\S]*?aria-current="page"/);
  assert.match(pageSource, /title: "Orders" \},\s*\{ route: "\/store\/payments", title: "Payments" \}/);
  assert.doesNotMatch(pageSource, /class="studio-workspace-top-nav"|class="studio-nested-nav"/);
  assert.match(posSource, /const sectionMenu = \(title, items, current\)[\s\S]*?workspace-sidebar-scrim[\s\S]*?workspace-sidebar-links/);
  assert.match(posSource, /sectionMenu\('Overview sections', tabs\.map/);
  assert.doesNotMatch(posSource, /pos-subnav|pos-overview-tabs/);
  const businessRenderer = pageSource.match(/renderMainShopWorkspace\(path\) \{([\s\S]*?)\r?\n  webStudioNavigation\(/)?.[1];
  const webStudioRenderer = pageSource.match(/renderWebStudioWorkspace\(path\) \{([\s\S]*?)\r?\n  async getMainShopSnapshot\(/)?.[1];
  assert.match(businessRenderer || '', /getCachedMainShopSnapshot\(\)[\s\S]*?renderMainShopContent\(path, cachedSnapshot\)[\s\S]*?renderWorkspaceLoading/);
  assert.match(webStudioRenderer || '', /getCachedMainShopSnapshot\(\)[\s\S]*?renderMainShopContent\(path, cachedSnapshot\)[\s\S]*?renderWorkspaceLoading/);
  assert.match(pageSource, /const profileLinks = \[[\s\S]*?title: "Profile"[\s\S]*?title: "Webs"[\s\S]*?title: "Accounts"[\s\S]*?title: "Privacy"[\s\S]*?title: "Recommended actions"[\s\S]*?title: "Link devices"[\s\S]*?title: "Updates"/);
  assert.match(pageSource, /Profile and app links[\s\S]*?profileLinks\.map[\s\S]*?workspace-sidebar-logout/);
  assert.match(posSource, /workspace-sidebar-divider[\s\S]*?Profile and app links[\s\S]*?Profile[\s\S]*?Webs[\s\S]*?Accounts[\s\S]*?Privacy[\s\S]*?Recommended actions[\s\S]*?Link devices[\s\S]*?Updates[\s\S]*?Log out/, 'POS drawer should append the profile, account and privacy links and logout.');
  assert.doesNotMatch(pageSource, /studio-hamburger/);
  assert.match(pageSource, /const sectionSidebar = this\.renderWorkspaceSidebar/);
  assert.match(pageSource, /\$\{this\.renderWorkspaceSidebar\(`\$\{page\.section\.title\} screens`/);
  assert.match(pageSource, /\.business-lens-shell \.workspace-sidebar-link \{\s*font-size:\s*\.76rem/);
  assert.match(pageSource, /\.business-lens-shell \.studio-workspace-bottom-link \{\s*gap:\s*2px;\s*font-size:\s*\.55rem/);
  assert.match(pageSource, /\.bl-date-filter select,[\s\S]*?\.bl-inline-filter input \{\s*min-height:\s*32px;[\s\S]*?border:\s*0;/);
  assert.match(pageSource, /\.bl-filter-row button \{[^}]*border:\s*0;/);
  assert.match(pageSource, /\.workspace-sidebar-logout\s*\{[\s\S]*?color:\s*#ffc1c1/);
  const mainShopSnapshot = pageSource.match(/async getMainShopSnapshot\(\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  formatMainShopMoney/)?.[1];
  assert.ok(mainShopSnapshot);
  assert.match(mainShopSnapshot, /window\.ShopPOS\.listSales\(\)/);
  assert.match(mainShopSnapshot, /posSales\.forEach\(sale[\s\S]*?channel: "POS"/);
  assert.doesNotMatch(mainShopSnapshot, /syncCloudNow|listBusinessRecords/,
    "Offline Main Store sales come directly from the local POS database.");
  const mainShopLoader = pageSource.match(/async loadMainShopWorkspace\(path\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  [a-zA-Z]/)?.[1];
  assert.match(mainShopLoader || "", /combinedSalesPaths[\s\S]*?listStorefrontOrders[\s\S]*?mergeStorefrontOrders/);
  // Counter sales, website orders and bookings are one list the owner can filter, instead of
  // separate panels in separate shells that disagreed about the same day.
  assert.match(pageSource, /renderUnifiedOrderList\(snapshot, sales, currency\)/);
  assert.match(pageSource, /\["all", "All"\], \["counter", "Counter"\], \["website", "Website"\], \["booking", "Bookings"\]/);
  assert.match(pageSource, /Payment activity · all channels[\s\S]*?paymentActivityRows/);
  assert.match(pageSource, /const \[suppliers, purchaseOrders, tickets\] = await Promise\.all\([\s\S]*?listBusinessRecords\("supplier", tenantId\)[\s\S]*?listBusinessRecords\("purchase", tenantId\)[\s\S]*?listBusinessRecords\("ticket", tenantId\)/);
  assert.match(pageSource, /home-dashboard-skeleton[\s\S]*?home-data-card[\s\S]*?home-data-label home-skeleton-line[\s\S]*?home-data-value home-skeleton-line[\s\S]*?home-data-note home-skeleton-line[\s\S]*?home-attention-row[\s\S]*?home-recent-row/);
  assert.match(pageSource, /renderWorkspaceLoading\(label\)[\s\S]*?studio-metric-grid[\s\S]*?studio-data-card[\s\S]*?studio-panel workspace-skeleton-panel/);
});

test('barcode and QR scanning formats route safely without treating QR text as a product', () => {
  assert.deepEqual(classifyQrCode('ESHOP-RECEIPT:POS-123'), {
    type: 'receipt', label: 'Receipt reference', content: 'ESHOP-RECEIPT:POS-123'
  });
  assert.deepEqual(classifyQrCode('https://shop.example/products'), {
    type: 'link', label: 'Store or web link', content: 'https://shop.example/products'
  });
  assert.deepEqual(classifyQrCode('123456789012'), {
    type: 'text', label: 'QR code text', content: '123456789012'
  });
});

test('loading website stock imports local website products into POS without admin-key sync', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sync = posSource.match(/async function syncSharedStock\(source\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function toast/)?.[1];
  assert.ok(sync, 'POS shared stock flow should be present.');
  assert.match(sync, /let catalog = bridge\.localCatalog\(websiteId\)[\s\S]*?if \(\(!catalog \|\| !catalog\.products\?\.length\) && navigator\.onLine !== false\) \{\s*catalog = await bridge\.catalog\(websiteId\)/);
  assert.match(sync, /if \(source === 'website'\)[\s\S]*?for \(const websiteProduct of \(catalog\.products \|\| \[\]\)\.filter\(\(product\) => product\.status !== 'archived'\)\)[\s\S]*?await addCategory\(categoryName\)[\s\S]*?await saveProduct\(\{[\s\S]*?stock,[\s\S]*?const saved = \(await listProducts\(\)\)/);
  assert.match(sync, /return \{ count: imported\.length, pending: 0, localOnly: true \}/);
  assert.doesNotMatch(sync.match(/if \(source === 'website'\) \{([\s\S]*?)\r?\n    \}\r?\n    const websiteBySku/)?.[1] || '', /bridge\.request|syncInventorySales/);
  assert.match(posSource, /result\.localOnly[\s\S]*?loaded into this device's POS\. Cloud stock sharing is separate/);
  assert.match(posSource, /hasTenantOwnerKey\?\.\(event\.tenant_id\) === false\) continue/);
  assert.match(appSource, /hasTenantOwnerKey\(tenantId\) \{[\s\S]*?item\.tenant_id === tenantId && typeof item\.owner_token === "string" && item\.owner_token/);
});

test('embedded theme preview replaces demo catalog and resolves merchant product categories', async () => {
  const appSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const seed = {
    categories: [{ id: 'demo-food', name: 'Demo food' }],
    products: [{ id: 'demo-burger', name: 'Drizzle Artisan Burger', categoryIds: ['demo-food'] }]
  };
  const start = appSource.indexOf('const themeData = JSON.parse(embeddedDataScript[2]);');
  const end = appSource.indexOf('const safeThemeData = JSON.stringify(mergedThemeData)', start);
  assert.ok(start >= 0 && end > start, 'Embedded theme catalog mapping should be present.');
  const mergeCatalog = new Function(
    'embeddedDataScript',
    'catalog',
    'theme',
    `${appSource.slice(start, end)}\nreturn mergedThemeData;`
  );
  const merged = mergeCatalog([null, null, JSON.stringify(seed)], {
    categories: [{ id: 12, name: 'Food' }, { id: 34, name: 'Drinks' }],
    products: [
      { id: 101, name: 'Merchant meal', category_id: 12, price: 8, status: 'active' },
      { id: 102, name: 'Merchant tea', category_name: 'drinks', price: 3, status: 'active' }
    ]
  }, { name: 'Drizzle' });

  assert.deepEqual(merged.categories.map(({ name }) => name), ['Food', 'Drinks']);
  assert.deepEqual(merged.products.map(({ name }) => name), ['Merchant meal', 'Merchant tea']);
  assert.deepEqual(merged.products.map(({ categoryIds }) => categoryIds), [
    ['eshop-category-12'],
    ['eshop-category-34']
  ]);
  assert.ok(!JSON.stringify(merged.products).includes('Drizzle Artisan Burger'));
});

test('label OCR parser suggests product name, currency price and validated expiry date', () => {
  assert.deepEqual(parseProductLabel('Kijani Tea 250g\nKSh 125.50\nEXP: 2027-04-15'), {
    name: 'Kijani Tea 250g', price: 125.5, expiryDate: '2027-04-15'
  });
  assert.deepEqual(parseProductLabel('MILK\nBest before 31/02/2027'), {
    name: 'MILK', price: null, expiryDate: ''
  });
});

test('label scans match only saved catalogue names and reject unknown or ambiguous products', () => {
  const products = [
    { id: 1, name: 'Kijani Tea 250g', active: true },
    { id: 2, name: 'Kijani Tea 500g', active: true },
    { id: 3, name: 'Milk', active: true }
  ];
  assert.equal(matchProductLabel('KIJANI TEA 250g\nNet weight 250g\nBest before 2027', products)?.id, 1);
  assert.equal(matchProductLabel('KIJANI\nTEA\n250g\nNet weight 250g', products)?.id, 1);
  assert.equal(matchProductLabel('Kijani Tea', products), null);
  assert.equal(matchProductLabel('Fresh milk and other groceries', products), null);
  assert.equal(matchProductLabel('No saved product here', products), null);
});

test('photo category suggestions map image labels only to existing categories', () => {
  const categories = [{ id: 1, name: 'Food' }, { id: 2, name: 'Drinks' }, { id: 3, name: 'Other' }];
  assert.deepEqual(
    suggestImageCategories([{ text: 'Fruit', confidence: 0.95 }, { text: 'Bottle', confidence: 0.88 }], categories)
      .map(({ categoryId }) => categoryId),
    [1, 2]
  );
  assert.deepEqual(suggestImageCategories([{ text: 'Unknown object', confidence: 0.99 }], categories), []);
});

test('photo matching returns only confident top-three choices and never auto-selects', () => {
  const hex = (values) => values.map((value) => ((value + 256) % 256).toString(16).padStart(2, '0')).join('');
  const query = new Int8Array([127, 0, 0, 0]);
  const products = [
    { id: 1, name: 'close', imageEmbeddingHex: hex([126, 4, 0, 0]) },
    { id: 2, name: 'exact', imageEmbeddingHex: hex([127, 0, 0, 0]) },
    { id: 3, name: 'other', imageEmbeddingHex: hex([0, 127, 0, 0]) },
    { id: 4, name: 'similar', imageEmbeddingHex: hex([121, 30, 0, 0]) },
    { id: 5, name: 'fourth', imageEmbeddingHex: hex([110, 64, 0, 0]) }
  ];
  const matches = rankImageMatches(products, query);
  assert.equal(MIN_IMAGE_MATCH_SIMILARITY, 0.7);
  assert.deepEqual(matches.map(({ product }) => product.id), [2, 1, 4]);
  assert.equal(rankImageMatches(products, query, 1).length, 1);
  assert.equal(rankImageMatches(products, new Int8Array(4)).length, 0);
});

test('photo matching ranks 5000 saved embeddings within the local scan budget', () => {
  const query = new Int8Array(1024);
  query[0] = 127;
  const products = Array.from({ length: 5000 }, (_, id) => {
    const imageEmbedding = new Int8Array(1024);
    imageEmbedding[0] = id === 4999 ? 127 : 0;
    imageEmbedding[1] = id === 4999 ? 0 : 127;
    return { id, imageEmbedding };
  });
  const started = performance.now();
  const matches = rankImageMatches(products, query);
  assert.ok(performance.now() - started < 1000, '5000-image cosine ranking should finish within one second');
  assert.deepEqual(matches.map(({ product }) => product.id), [4999]);
});

test('POS sales and received purchases queue refreshed product stock for cloud sync', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const receiveStart = posSource.indexOf('async function receivePurchaseOrder(recordId)');
  const syncStart = posSource.indexOf('async function syncInventorySales', receiveStart);
  const checkoutStart = posSource.indexOf("case 'checkout': {");
  const paymentStart = posSource.indexOf("case 'payment': {", checkoutStart);
  const receivePurchase = posSource.slice(receiveStart, syncStart);
  const checkout = posSource.slice(checkoutStart, paymentStart);
  const saveCheckoutStart = posSource.indexOf('async function saveCheckout(');
  const saveCheckoutEnd = posSource.indexOf('async function queueCloudRecord(', saveCheckoutStart);
  const saveCheckout = posSource.slice(saveCheckoutStart, saveCheckoutEnd);
  assert.ok(receiveStart >= 0 && syncStart > receiveStart, 'Purchase receiving should have a bounded implementation.');
  assert.ok(checkoutStart >= 0 && paymentStart > checkoutStart, 'POS checkout should have a bounded implementation.');
  assert.ok(saveCheckoutStart >= 0 && saveCheckoutEnd > saveCheckoutStart, 'POS checkout should reuse the shared sale-save flow.');
  assert.match(receivePurchase, /const products = await listProducts\(\)[\s\S]*?await queueProduct\(product\)/);
  assert.match(saveCheckout, /const productsAfterSale = await listProducts\(\)[\s\S]*?await queueProduct\(product\)/);
  assert.match(checkout, /await saveCheckout\(data, method, Boolean\(method\)\)/);
  assert.doesNotMatch(posSource, /beginMpesaWait|finishMpesaSale|matchesMpesaSalePayment/);
  const appStart = posSource.indexOf('export function createPosApp()');
  const queueCategory = posSource.indexOf('async function queueCategory(category', appStart);
  const seedCatalogue = posSource.indexOf('async function seedCatalogueSync()', appStart);
  assert.ok(queueCategory > appStart && seedCatalogue > queueCategory,
    'Catalogue seeding must be scoped inside createPosApp where queueCategory is defined.');
  assert.match(posSource.slice(seedCatalogue, posSource.indexOf('async function applyRemoteChange', seedCatalogue)),
    /queueCategory\(category\)[\s\S]*queueProduct\(product\)[\s\S]*queueExpense\(expense\)/);
  const queueProductStart = posSource.indexOf('async function queueProduct(product', appStart);
  const queueCategoryStart = posSource.indexOf('async function queueCategory(category', queueProductStart);
  const productQueue = posSource.slice(queueProductStart, queueCategoryStart);
  assert.match(productQueue, /if \(!product\.sku\)[\s\S]*createSku\(\)[\s\S]*UPDATE pos_products SET sku=/);
  assert.doesNotMatch(productQueue, /This product needs a SKU before it can sync/);
  assert.match(posSource, /async function seedCloudCatalogueForTenant\(tenantId\)[\s\S]*cloud_catalogue_seeded:\$\{tenantId\}[\s\S]*seedCatalogueSync\(\)/);
  assert.match(posSource, /async function syncCloudBusinessRecords\([^)]*\)[\s\S]*await seedCloudCatalogueForTenant\(tenantId\)/);
  assert.match(posSource, /let pageCursor = cursor;[\s\S]*latestChanges = new Map\(\)[\s\S]*const previous = latestChanges\.get\(key\)/);
  assert.match(posSource, /while \(pageCursor < latestRevision && pageLength === 500 && pagesRead < 20\)/);
  assert.match(posSource, /Cloud sync returned an invalid change list/);
  assert.match(posSource, /Cloud backup and sync/);
  assert.match(posSource, /including the phone app/);
  assert.match(posSource, /<\/strong> <span>\$\{escapeHtml\(detail\)\}/);
});

test('Android POS exposes same-shop Bluetooth phone-to-phone snapshot sync', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const nativePlugin = await readFile(
    new URL('../android/app/src/main/java/com/eshop/atelier/NearbyBluetoothPlugin.java', import.meta.url),
    'utf8'
  );
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(posSource, /button\('Receive over Bluetooth', 'nearby-bt-host'/);
  assert.match(posSource, /button\('Find a Bluetooth register', 'nearby-bt-find'/);
  assert.match(posSource, /async function startBluetoothNearbySync\(mode\)[\s\S]*?state\.cloudScopeId === 'local'[\s\S]*?NearbyBluetooth\.startHosting\(\)[\s\S]*?NearbyBluetooth\.startDiscovery\(\)/);
  assert.match(nativePlugin, /listenUsingRfcommWithServiceRecord/);
  assert.match(nativePlugin, /createRfcommSocketToServiceRecord/);
  assert.match(nativePlugin, /MAX_MESSAGE_BYTES = 64 \* 1024/);
  assert.match(manifest, /android\.permission\.BLUETOOTH_SCAN/);
  assert.match(manifest, /android\.permission\.BLUETOOTH_CONNECT/);
  assert.match(manifest, /android\.permission\.BLUETOOTH_ADVERTISE/);
});

test('published Craft storefront batches anonymous events without per-action product-interest writes', async () => {
  const runtime = await readFile(new URL('../public/craft-storefront-cloudflare.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(runtime, /window\.__ESHOP_CLOUDFLARE_STOREFRONT__ !== true/);
  assert.doesNotMatch(runtime, /\/api\/product-interest/);
  assert.match(runtime, /__ESHOP_TRACK_STOREFRONT_EVENT__/);
  assert.doesNotMatch(runtime, /api\/analytics\/visit|reportVisit/);
  assert.match(app, /fetchStorefrontEventAnalytics\(activeTenant\.id, 30\)/);
  assert.match(app, /productViewsBySlug\.get\(String\(product\.slug \|\| ""\)\)[\s\S]*?productViewsBySlug\.get\(String\(product\.id\)\)/);
  assert.match(runtime, /\/api\/orders/);
  assert.match(runtime, /\/api\/payments\/paystack\/initialize/);
  assert.match(runtime, /requestProductHold\(form\)/);
  assert.match(runtime, /\/api\/product-holds/);
  assert.match(runtime, /\/api\/newsletter\/subscribe/);
  assert.match(app, /Most booked products/);
  assert.doesNotThrow(() => new Script(runtime), 'The injected customer activity runtime should parse as JavaScript.');
});

test('published Litrus newsletter forms require consent and reach the Cloudflare signup endpoint', async () => {
  const runtime = await readFile(new URL('../public/craft-storefront-cloudflare.js', import.meta.url), 'utf8');
  const dom = new JSDOM(
    '<form class="sole-newsletter-form"><input type="email" required><button type="submit">Subscribe</button></form>',
    { url: 'https://amani.rrobin.co.ke/', runScripts: 'outside-only' }
  );
  const requests = [];
  dom.window.__ESHOP_CLOUDFLARE_STOREFRONT__ = true;
  dom.window.fetch = async (path, options) => {
    requests.push({ path, options });
    return { ok: true, json: async () => ({ ok: true, confirmation_required: true }) };
  };

  try {
    dom.window.eval(runtime);
    const form = dom.window.document.querySelector('.sole-newsletter-form');
    const email = form.querySelector('input[type="email"]');
    const consent = form.querySelector('[name="consent"]');
    assert.ok(consent, 'Litrus newsletter forms must show an explicit consent checkbox.');
    email.value = 'subscriber@example.com';
    consent.checked = true;
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(requests.length, 1);
    assert.equal(requests[0].path, '/api/newsletter/subscribe');
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      email: 'subscriber@example.com',
      consent: true
    });
    assert.match(form.querySelector('#newsletter-msg').textContent, /confirm your subscription/i);
  } finally {
    dom.window.close();
  }
});

test('published storefront customers can opt in to Web Push on their device', async () => {
  const runtime = await readFile(new URL('../public/craft-storefront-cloudflare.js', import.meta.url), 'utf8');
  const dom = new JSDOM(
    '<div id="store"></div>',
    { url: 'https://amani.rrobin.co.ke/', runScripts: 'outside-only' }
  );
  const requests = [];
  let permissionRequests = 0;
  const subscription = {
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/device',
      keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) }
    })
  };
  const registration = {
    pushManager: {
      getSubscription: async () => null,
      subscribe: async () => subscription
    }
  };
  dom.window.__ESHOP_CLOUDFLARE_STOREFRONT__ = true;
  Object.defineProperty(dom.window, 'isSecureContext', { value: true });
  Object.defineProperty(dom.window, 'PushManager', { value: function PushManager() {} });
  Object.defineProperty(dom.window, 'Notification', {
    value: {
      permission: 'default',
      requestPermission: async () => {
        permissionRequests += 1;
        return 'granted';
      }
    }
  });
  Object.defineProperty(dom.window.navigator, 'serviceWorker', {
    value: {
      getRegistration: async () => registration,
      ready: Promise.resolve(registration)
    }
  });
  dom.window.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return {
      ok: true,
      json: async () => path === '/api/push/config' ? { public_key: 'AQID' } : { ok: true }
    };
  };

  try {
    dom.window.eval(runtime);
    const form = dom.window.document.createElement('form');
    form.className = 'sole-newsletter-form';
    form.innerHTML = '<input type="email" required><button type="submit">Subscribe</button>';
    dom.window.document.getElementById('store').append(form);
    await new Promise(resolve => setTimeout(resolve, 0));

    const enable = form.querySelector('[data-storefront-push-enable]');
    assert.ok(enable, 'Published storefronts should expose an explicit push opt-in control.');
    assert.equal(permissionRequests, 0, 'Notification permission must not be requested on page load.');

    enable.click();
    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(permissionRequests, 1);
    assert.deepEqual(requests.map(request => request.path), [
      '/api/push/config',
      '/api/push/subscriptions'
    ], form.querySelector('[data-storefront-push-controls] [role="status"]').textContent);
    assert.equal(requests[1].options.method, 'POST');
    assert.deepEqual(JSON.parse(requests[1].options.body), subscription.toJSON());
    assert.match(form.querySelector('[role="status"]').textContent, /notifications enabled/i);
  } finally {
    dom.window.close();
  }
});

test('storefront app installation is owner-controlled and opens only after a shopper taps', async () => {
  const runtime = await readFile(new URL('../public/craft-storefront-cloudflare.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(app, /name="installPromptEnabled"[\s\S]*?Enable the app install invitation for shoppers/);
  assert.match(app, /install_prompt_enabled: data\.get\("installPromptEnabled"\) \? 1 : 0/);

  const dom = new JSDOM('', { url: 'https://amani.rrobin.co.ke/', runScripts: 'outside-only' });
  let promptCalls = 0;
  dom.window.__ESHOP_CLOUDFLARE_STOREFRONT__ = true;
  dom.window.__ESHOP_THEME_CATALOG__ = {
    store: { name: 'Amani Shop', install_prompt_enabled: 1 }
  };

  try {
    dom.window.eval(runtime);
    const installEvent = new dom.window.Event('beforeinstallprompt', { cancelable: true });
    installEvent.prompt = async () => { promptCalls += 1; };
    installEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
    dom.window.dispatchEvent(installEvent);

    const banner = dom.window.document.querySelector('[aria-label="Install this store"]');
    assert.ok(banner, 'Enabled storefronts should show a brief install invitation.');
    assert.equal(installEvent.defaultPrevented, true);
    assert.match(banner.textContent, /Install Amani Shop/);
    banner.querySelector('button:not([aria-label])').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(promptCalls, 1, 'The browser prompt should open only after the shopper taps Install.');
    assert.match(banner.querySelector('[role="status"]').textContent, /was installed/i);
  } finally {
    dom.window.close();
  }

  const disabledDom = new JSDOM('', { url: 'https://amani.rrobin.co.ke/', runScripts: 'outside-only' });
  disabledDom.window.__ESHOP_CLOUDFLARE_STOREFRONT__ = true;
  disabledDom.window.__ESHOP_THEME_CATALOG__ = {
    store: { install_prompt_enabled: 0 }
  };
  try {
    disabledDom.window.eval(runtime);
    const installEvent = new disabledDom.window.Event('beforeinstallprompt', { cancelable: true });
    disabledDom.window.dispatchEvent(installEvent);
    assert.equal(installEvent.defaultPrevented, false);
    assert.equal(disabledDom.window.document.querySelector('[aria-label="Install this store"]'), null);
  } finally {
    disabledDom.window.close();
  }
});

test('storefront event analytics stays local until a batch flush', async () => {
  const runtime = await readFile(new URL('../public/storefront-analytics.js', import.meta.url), 'utf8');
  const dom = new JSDOM('', { url: 'https://shop.example/#/home', runScripts: 'outside-only' });
  const requests = [];
  let visibility = 'visible';
  Object.defineProperty(dom.window.document, 'visibilityState', { get: () => visibility });
  Object.defineProperty(dom.window.navigator, 'sendBeacon', {
    value(url, body) {
      requests.push({ url, body });
      return true;
    }
  });
  dom.window.localStorage.setItem('sp:litrus-shop:cart', JSON.stringify([{ id: 'item-1', q: 2 }]));

  try {
    dom.window.eval(runtime);
    dom.window.__ESHOP_TRACK_STOREFRONT_EVENT__('item-1', 'cart_add', 2);
    assert.equal(requests.length, 0, 'Tracking an action must only update the local queue.');
    const savedQueue = JSON.parse(dom.window.localStorage.getItem('eshop:storefront-events:v1:shop.example'));
    assert.deepEqual(savedQueue, [{ product_id: 'item-1', type: 'cart_add', n: 2 }]);
    visibility = 'hidden';
    dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(requests.length, 1);
    assert.equal(new URL(requests[0].url).pathname, '/api/analytics/events');
    assert.ok(requests[0].body.size > 0);
    assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('eshop:storefront-events:v1:shop.example')), []);
  } finally {
    dom.window.close();
  }
});

test('Litrus checkout creates a server order from the live cart', async () => {
  const runtime = await readFile(new URL('../public/litrus-mixer/live-catalog.js', import.meta.url), 'utf8');
  const dom = new JSDOM('<div id="store"></div>', { url: 'https://shop.example/#/home', runScripts: 'outside-only' });
  const requests = [];
  const root = dom.window.document.getElementById('store');
  root.innerHTML = '<form id="spco"><input name="name" value="Sam Shop"><input name="phone" value="+254700000001"><input name="email" value="sam@example.test"><input name="town" value="Nairobi"><textarea name="addr">12 Market Street</textarea><div class="sp-radios"><label><input type="radio" name="pay" value="Cash on delivery or pickup" checked></label></div><input type="radio" name="dm" value="delivery" checked><input name="via" value="none"><p class="sp-err"></p><button type="submit">Place order</button></form>';
  dom.window.SPD = {
    shop: { key: 'main', name: 'Main shop', products: [] },
    pages: {},
    shell: {},
    templates: {}
  };
  dom.window.__ESHOP_THEME_CATALOG__ = {
    store: { name: 'Main shop', currency: 'KES', delivery_fee: 150 },
    products: [{ id: 7, name: 'Canvas Tote', price: 12.5, images: [], stock: 5 }],
    categories: []
  };
  Object.defineProperty(dom.window.crypto, 'randomUUID', { value: () => '71a2b153-4af0-4c64-8b58-0e7d45005b14' });
  dom.window.localStorage.setItem('sp:main:cart', JSON.stringify([{ id: 7, q: 2 }]));
  dom.window.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      async json() {
        return {
          order: {
            order_number: 'ORD-0123456789ABCDEF',
            currency: 'KES',
            subtotal: 25,
            shipping: 150,
            total: 175,
            items: [{ product_id: 7, name: 'Canvas Tote', quantity: 2, unit_price: 12.5 }]
          }
        };
      }
    };
  };
  dom.window.SPRT = options => {
    options.after(root, 'checkout');
    return {};
  };

  try {
    dom.window.eval(runtime);
    dom.window.litrusStartLiveStore(dom.window.SPD);
    const paystack = root.querySelector('input[name="pay"][value="paystack"]');
    assert.ok(paystack?.checked, 'Paystack should be the default payment option.');
    root.querySelector('input[name="pay"][value="Cash on delivery or pickup"]').checked = true;
    root.querySelector('#spco').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/orders');
    assert.deepEqual(requests[0].body.items, [{ product_id: '7', quantity: 2 }]);
    assert.equal(requests[0].body.customer_email, 'sam@example.test');
    assert.equal(requests[0].body.delivery_method, 'delivery');
    assert.equal(dom.window.localStorage.getItem('sp:main:cart'), '[]');
    assert.match(root.textContent, /ORD-0123456789ABCDEF/);
  } finally {
    dom.window.close();
  }
});

test('nearby Wi-Fi pairing needs one phone scan and asks the PC operator before transfer', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const appBridge = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(posSource, /The phone scans this register’s QR once/);
  assert.match(posSource, /encrypted POS transfer goes directly over the same Wi-Fi/);
  assert.match(posSource, /nearbyPairing\(tenantId, 'GET'[\s\S]*?relayOffer\.offer[\s\S]*?nearbyPairing\(tenantId, 'POST'[\s\S]*?action: 'answer'/);
  assert.match(posSource, /window\.confirm\(`A phone scanned this PC’s pairing QR[\s\S]*?transfer POS data\?`\)/);
  assert.doesNotMatch(posSource, /data-nearby-scan-answer|Pairing answer/);
  assert.match(posSource, /type: 'record-change'/);
  assert.match(posSource, /Connected to \$\{peerName\} · Live sync on/);
  assert.match(posSource, /snapshot-request[\s\S]*?initial-response/);
  assert.match(posSource, /cloudSyncEnabled && document\.visibilityState !== 'hidden'[\s\S]*?\}, 5000\)/);
  assert.match(appBridge, /nearbyPairing\(tenantId, method, data = \{\}\)[\s\S]*?AppController\.cloudflareRequest/);
});

test('Studio payment setup captures the active tenant and allows retry after a timed-out bank request', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const capacitorConfig = await readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
  const studioLoader = pageSource.match(/async loadMainShopWorkspace\(path\) \{([\s\S]*?)\n  \},\n\n  [a-zA-Z]/)?.[1];
  assert.ok(studioLoader, 'Studio workspace event handlers should have a bounded loader scope.');
  assert.match(studioLoader, /const activeTenant = AppController\.getActiveTenant\(\);/);
  assert.match(pageSource, /paystackSetupRequest\(path, tenantId, options = \{\}, anonymous = false\)[\s\S]*?setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
  assert.match(pageSource, /data-paystack-retry hidden/);
  assert.match(pageSource, /bindBusinessCloudActions\(container, path, snapshot,[\s\S]*?\["\/account\/payments", "\/account\/web\/studio\/payments"\]\.includes\(path\)[\s\S]*?bindPaystackSetup\(container, tenantId\)/);
  assert.match(pageSource, /Promise\.allSettled\(\[[\s\S]*?getPaystackAccount\(tenantId\)[\s\S]*?getPaystackBanks\(tenantId\)/);
  assert.match(pageSource, /getPaystackBanks\(tenantId\)[\s\S]*?tenantId, \{\}, true/);
  assert.match(capacitorConfig, /const appHostname = 'rrobin\.co\.ke';[\s\S]*?hostname: appHostname/);
});

test('new websites inherit Paystack from the app account instead of collecting website-specific bank details', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const websiteSetup = pageSource.match(/id="new-website-form"([\s\S]*?)<\/form>/)?.[1];
  const websiteSubmit = pageSource.match(/const newWebsiteForm = document\.getElementById\("new-website-form"\);([\s\S]*?)\n    \}\n    if \(newWebsiteForm\?\.querySelector/)?.[1];
  assert.ok(websiteSetup, 'Website setup should have a bounded form.');
  assert.ok(websiteSubmit, 'Website setup should have a bounded submit handler.');
  assert.match(websiteSetup, /Payment settings belong to your signed-in app account/);
  assert.doesNotMatch(websiteSetup, /paystack_(?:account_number|settlement_bank|business_name)|name="paystack_reuse_existing"/);
  assert.match(websiteSubmit, /Website created at \$\{result\.tenant\.hostname\}\. It uses your app account's Paystack default\./);
  assert.match(websiteSubmit, /this\.getActiveTenant\(\)\.id !== WEBSITE_BUILDER_DRAFT_TENANT_ID[\s\S]*?const draftCatalog = this\.tenantCatalogs\(\)\.find/);
  assert.match(websiteSubmit, /this\.setActiveTenantCatalog\(\{ \.\.\.result\.tenant, owner_token: result\.owner_token \}, \{[\s\S]*?\.\.\.draftCatalog/);
  assert.match(websiteSubmit, /this\.navigate\(`\/account\/web\/site\?tenant=\$\{encodeURIComponent\(result\.tenant\.id\)\}`\)/);
  assert.doesNotMatch(websiteSubmit, /await this\.applyWebsiteBuilderDraft/);
  assert.doesNotMatch(websiteSubmit, /savePaystackAccount|setPaystackDefault|paystackDetails/);
  assert.match(pageSource, /App-account Paystack payments/);
  assert.match(pageSource, /Every website registered to your app account will use this account at checkout/);
  assert.match(pageSource, /async bindPaystackReuseSetup\(container, tenantId\)[\s\S]*?setPaystackDefault\(/);
  assert.match(pageSource, /getPaystackDefault\(tenantId\)[\s\S]*?\/api\/payments\/paystack\/default/);
});

test('legacy Kinetic and Veluna themes are not selectable storefronts', () => {
  const themeIds = WEBSITE_THEME_CATALOG.map(theme => theme.id);
  assert.equal(themeIds.includes('kinetic-electronics'), false);
  assert.equal(themeIds.includes('veluna-—-grand-electronics-retail-store'), false);
});

test('hosted theme editor keeps SPA hash navigation inside the preview iframe', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /previewDocument\.addEventListener\("click", event => \{[\s\S]*?event\.target\?\.closest\?\.\("a\[href\]"\)[\s\S]*?href\?\.startsWith\("#\/"\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopImmediatePropagation\(\)[\s\S]*?previewWindow\.location\.hash = href/);
});

test('Main Store shows Split products beside Categories in the Products navigation', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /products:\s*\[[\s\S]*?route: "\/store\/categories", title: "Categories"\s*\},\s*\{\s*route: "\/store\/split-shop", title: "Split products"/);
  assert.match(pageSource, /if \(path === "\/store\/split-shop"\) return this\.renderSplitShop\(snapshot, activeTenant\)/);
  assert.match(pageSource, /"\/store\/categories", "\/store\/inventory", "\/store\/split-shop"/);
  assert.match(pageSource, /this\.bindSplitShopEvents\(renderSnapshot, path\)/);
});

test('M-Pesa workspace is removed and old deep links return to home', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const [bootstrap, archivedUi, archivedTools] = await Promise.all([
    readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-ui/index.html.snapshot', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-ui/mpesa-tools.js', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(pageSource, /home-bento-mpesa|M-Pesa|mpesa-screen|renderMpesaScreen|ShopMpesaTools/);
  assert.match(pageSource, /if \(path === "\/mpesa" \|\| path\.startsWith\("\/mpesa\/"\)\)\s*\{\s*this\.navigate\("\/", true\)/);
  assert.doesNotMatch(bootstrap, /MpesaTools|mpesa-tools/);
  assert.match(archivedUi, /renderMpesaScreen/);
  assert.match(archivedTools, /renderMpesaToolScreen/);
});

test('M-Pesa notification listener is archived and absent from the active app', async () => {
  const [manifest, mainActivity, bootstrap, pageSource, posSource,
    archivedService, archivedParser, archivedPlugin, archivedBridge, archivedUi] = await Promise.all([
    readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MainActivity.java', import.meta.url), 'utf8'),
    readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/android/app/src/main/java/com/eshop/atelier/MpesaNotificationListenerService.kt', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/android/app/src/main/java/com/eshop/atelier/MpesaNotificationParser.kt', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/android/app/src/main/java/com/eshop/atelier/MpesaNotificationsPlugin.kt', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/src/mpesa-notifications.js', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-ui/index.html.snapshot', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(manifest, /MpesaNotificationListenerService|BIND_NOTIFICATION_LISTENER_SERVICE/);
  assert.doesNotMatch(manifest, /READ_SMS|RECEIVE_SMS/);
  assert.doesNotMatch(mainActivity, /MpesaNotificationsPlugin/);
  assert.doesNotMatch(bootstrap, /MpesaNotifications|mpesa-notifications/);
  assert.doesNotMatch(pageSource, /bindMpesaNotificationEvents|MpesaNotifications|mpesa-self-identifiers|NotificationListenerService|renderMpesaScreen|ShopMpesaTools/);
  assert.doesNotMatch(posSource, /beginMpesaWait|finishMpesaSale|matchesMpesaSalePayment|MpesaNotifications/);
  assert.match(archivedUi, /renderMpesaScreen/);
  assert.match(archivedService, /NotificationListenerService/);
  assert.match(archivedParser, /sender\.equals\("MPESA", ignoreCase = true\)/);
  assert.match(archivedPlugin, /ACTION_NOTIFICATION_LISTENER_SETTINGS/);
  assert.match(archivedBridge, /transactionReceived/);
  assert.doesNotMatch(pageSource, /data-mpesa-transaction-list|renderMpesaScreen|ShopMpesaTools/);
  await Promise.all([
    assert.rejects(readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MpesaNotificationListenerService.kt', import.meta.url))),
    assert.rejects(readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MpesaNotificationParser.kt', import.meta.url))),
    assert.rejects(readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MpesaNotificationsPlugin.kt', import.meta.url))),
    assert.rejects(readFile(new URL('../src/mpesa-notifications.js', import.meta.url))),
    assert.rejects(readFile(new URL('../src/mpesa-tools.js', import.meta.url)))
  ]);
});

test('classic inline app script avoids Vite rewriting dynamic module imports', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const bootstrap = await readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8');
  assert.doesNotMatch(pageSource, /await import\(["']\//);
  assert.match(pageSource, /EshopThemeRuntime\.loadEditableStorefrontTheme\(\)/);
  assert.equal((pageSource.match(/EshopThemeRuntime\.loadThemeSkeleton\(\)/g) || []).length, 2);
  assert.match(bootstrap, /loadPublicThemeModule = path => import\(\/\* @vite-ignore \*\/ new URL\(path, window\.location\.origin\)\.href\)/);
});

test('filled themes use the shared fill engine while legacy adapter behavior remains available', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../public/theme-catalog-adapter.js', import.meta.url), 'utf8');
  assert.match(pageSource, /fillThemeForShop\(theme\.id, catalog/);
  assert.match(pageSource, /if \(appEditableTheme\) \{[\s\S]*?fillEditableStorefrontTheme/);
  assert.match(pageSource, /filledHtml = await themeClient\.fillThemeForShop\(themeId/);
  assert.match(workerSource, /"craft-main-storefront"/);
  assert.match(workerSource, /published-sites\/\$\{tenantId\}\/\$\{themeId\}\//);
  assert.match(workerSource, /let html = publishedHtmlForRequest \|\| await new Response\(theme\.body\)\.text\(\)/);
  assert.doesNotMatch(workerSource, /const catalogAdapter = `<script src="\/theme-catalog-adapter\.js"/);
  assert.match(adapter, /function adaptProductGrids\(\)/);
  assert.match(adapter, /function setCardProduct\(card, product\)/);
  assert.doesNotMatch(adapter, /function bindCategoryLinks\(\)/);
  assert.doesNotMatch(adapter, /eshopCategoryBound/);
  assert.doesNotMatch(adapter, /applyMobileCardLayout|eshop-mobile-card-layout|eshop-mobile-card-columns/);
  assert.doesNotMatch(pageSource, /builder-mobile-card|data-editor-panel="cards"|Mobile cards|mobile_card_layout,/);
  assert.match(pageSource, /delete updatedStore\.mobile_card_layout/);
  assert.match(pageSource, /bindWebsiteBuilderEvents\(\) \{\s*const editorRouteParams = new URLSearchParams\(this\.currentRoute\(\)\.split\("\?"\)\[1\] \|\| ""\);\s*const draftEditor/);
  assert.match(adapter, /No products are available yet\./);
  assert.match(adapter, /eshopCategoryId/);
  assert.doesNotMatch(adapter, /#eshop-category=/);
  assert.match(adapter, /event\.stopPropagation\(\)/);
  assert.match(adapter, /event\.stopImmediatePropagation\(\)/);
});

test('Theme Studio replaces the legacy website editor and keeps final setup', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor, 'The existing website editor should render.');
  assert.match(editor, /new-website-form/);
  assert.doesNotMatch(pageSource, /\/theme-packages\/craft-main-storefront\/index\.html/);
});

test('Craft app branding uses the supplied shopping bag icon and launcher label', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const capacitorConfig = await readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
  const androidStrings = await readFile(new URL('../android/app/src/main/res/values/strings.xml', import.meta.url), 'utf8');
  const webManifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const logo = await readFile(new URL('../public/eshop-logo.png', import.meta.url));
  const launcher = await readFile(new URL('../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', import.meta.url));
  assert.match(pageSource, /<title>Craft<\/title>[\s\S]*?href="\/favicon\.svg"/);
  assert.match(capacitorConfig, /appName: 'Craft'/);
  assert.match(androidStrings, /<string name="app_name">Craft<\/string>/);
  assert.equal(webManifest.name, 'Craft');
  assert.equal(webManifest.short_name, 'Craft');
  assert.equal(logo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(launcher.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('app account includes email recovery and sends verified reset codes to the Worker', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const accountRenderer = pageSource.match(/renderAppAccount\(\) \{([\s\S]*?)\n  \},\n\n  render[^]*?\(/)?.[1];
  assert.ok(accountRenderer, 'The app-account screen should be rendered.');
  assert.match(accountRenderer, /id="app-account-email-field" hidden[\s\S]*?name="email" type="email"/);
  assert.match(accountRenderer, /id="app-account-forgot-password">Forgot password\?/);
  assert.match(accountRenderer, /id="app-account-recovery" hidden[\s\S]*?id="app-account-recovery-code"[\s\S]*?id="app-account-new-password"/);
  assert.match(pageSource, /fetchAuth\("\/api\/auth\/request-reset-code"[\s\S]*?fetchAuth\("\/api\/auth\/verify-reset-code"[\s\S]*?fetchAuth\("\/api\/auth\/reset-password"/);
  assert.match(pageSource, /Your recovery email is used only for password recovery, not marketing/);
});

test('existing website editor routes stay pinned to the selected tenant', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const routeTenantSelection = pageSource.match(/if \(\(path === "\/account\/web\/site" && params\.get\("new"\) !== "1" \|\| path === "\/account\/web\/store"\) && params\.has\("tenant"\)\) \{([\s\S]*?)\n    \}\n    if \(path === "\/account\/web\/site" && params\.get\("new"\) === "1"\)/)?.[1];
  const editHandler = pageSource.match(/const editWebsite = e\.target\.closest\("\[data-edit-website\]"\);([\s\S]*?)\n      }\n\n      const editStore/)?.[1];
  assert.ok(routeTenantSelection, 'Opening an editor URL should resolve its explicit website tenant.');
  assert.match(routeTenantSelection, /tenantCatalogs\(\)\.find\(item => item\.tenant_id === tenantId\)/);
  assert.match(routeTenantSelection, /this\.setActiveTenantCatalog\(\{[\s\S]*?\}, catalog\)/);
  assert.ok(editHandler, 'Website design editing should have a dedicated handler.');
  assert.match(editHandler, /this\.navigate\(`\/account\/web\/site\?tenant=\$\{encodeURIComponent\(website\.tenant_id\)\}`\)/);
});

test('Craft opens the saved website dashboard and hides the main shop from website lists', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /const initialPath = path === "\/account\/web"\s*\?\s*"\/account\/web\/studio\/dashboard\/overview"/);
  assert.match(pageSource, /const visibleWebsites = websites\s*\.filter\(website => website\.id !== "main"\)\s*\.sort\(\(a, b\) => Number\(b\.id === activeTenant\.id\) - Number\(a\.id === activeTenant\.id\)\)/);
  assert.match(pageSource, /website\.id === activeTenant\.id \? '<span class="profile-current-website-badge">Currently managing<\/span>'/);
  assert.match(pageSource, /body\.craft-app-ui #app \.website-management-actions > \*,[\s\S]*?border-radius:\s*14px !important;[\s\S]*?background:\s*linear-gradient\(145deg,\s*#f3f3f3 0%,\s*#dedede 100%\) !important/);
  assert.match(pageSource, /getActiveTenant\(\) \{[\s\S]*?localStorage\.getItem\("ESHOP_ACTIVE_TENANT_V1"\)/);
  assert.match(pageSource, /setActiveTenantCatalog\(tenant, catalog\) \{[\s\S]*?localStorage\.setItem\("ESHOP_ACTIVE_TENANT_V1"/);
});

test('product media saves locally before publishing and handles native gallery results', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const mediaSave = pageSource.match(/} else if \(kind === "web-product"\) \{([\s\S]*?)\n            \} else if \(kind === "loyalty-settings"\)/)?.[1];
  const compression = pageSource.match(/async compressImageFile\(file, \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  formatMoney/)?.[0];
  const imageUpload = pageSource.match(/async uploadCatalogImage\(image, apiUrl, tenant, token(?:, onStored)?\) \{([\s\S]*?)\r?\n  \},/)?.[1];
  const publishModal = pageSource.match(/openCloudflarePublishModal\(publishImmediately = false\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  initStudioModals/)?.[1];
  assert.ok(mediaSave, 'Web product media should have a dedicated save handler.');
  assert.ok(compression, 'Images should use the shared on-device compressor.');
  assert.ok(imageUpload, 'Publishing should upload compressed images to the Worker.');
  assert.ok(publishModal, 'Catalog publishing should include the uploaded image URLs.');
  assert.match(compression, /new Image\(\)[\s\S]*?URL\.createObjectURL\(file\)[\s\S]*?toBlob[\s\S]*?image\/webp[\s\S]*?maxBytes/);
  assert.match(mediaSave, /SQLiteEngine\.saveProduct\([\s\S]*?video_path: videoPath[\s\S]*?\);\s*await window\.ShopSQLite\.flush\(\)/);
  assert.doesNotMatch(mediaSave, /uploadCatalogImage|uploadCatalogVideo/);
  assert.match(pageSource, /result\.results \|\| \[\]/);
  assert.match(pageSource, /\}\)\)\.results\?\.\[0\]/);
  assert.doesNotMatch(pageSource, /result\.medias|\}\)\)\.medias/);
  assert.match(pageSource, /await nativeMedia\.ProductCutout\.persistVideo\(\{[\s\S]*?path: selected\.uri/);
  assert.match(publishModal, /LOCAL_PRODUCT_MEDIA_PREFIX[\s\S]*?readLocalProductMedia[\s\S]*?uploadCatalogVideo/);
  assert.match(pageSource, /High detail — 36 frames, 720 px[\s\S]*?Balanced — 24 frames, 720 px[\s\S]*?Faster — 18 frames, 480 px/);
  assert.match(pageSource, /spinProfiles = \{[\s\S]*?high: \{ count: 36, width: 720 \}[\s\S]*?balanced: \{ count: 24, width: 720 \}[\s\S]*?fast: \{ count: 18, width: 480 \}[\s\S]*?\.\.\.spinProfile/);
  assert.match(imageUpload, /new URL\(image\)[\s\S]*?isRrobinDomain[\s\S]*?mode: "cors"[\s\S]*?maxDimension: 1600, maxBytes: 2_800_000/);
  assert.match(imageUpload, /crypto\.subtle\.digest\("SHA-256"[\s\S]*?ESHOP_CATALOG_MEDIA_UPLOADS_V1:\$\{tenant\.id\}[\s\S]*?cachedPublicUrl\.pathname\.startsWith\(`\/media\/\$\{tenant\.id\}\/`\)[\s\S]*?return cachedPublicUrl\.href/);
  assert.match(imageUpload, /compressImageFile[\s\S]*?\/api\/media[\s\S]*?method: "POST"[\s\S]*?publicUrl\.pathname\.startsWith\(`\/media\/\$\{tenant\.id\}\/`\)[\s\S]*?localStorage\.setItem\(cacheKey, JSON\.stringify\(uploadedMedia\)\)/);
  assert.match(publishModal, /async image => \{[\s\S]*?fallbackProductImageCount \+= 1[\s\S]*?keeping its original URL[\s\S]*?return image/);
  assert.match(publishModal, /mapWithConcurrency\(products,\s*2,[\s\S]*?mapWithConcurrency\([\s\S]*?publishProductImage[\s\S]*?products: publishProducts/);
  assert.match(publishModal, /images:\s*await mapWithConcurrency\([\s\S]*?,\s*1,\s*publishProductImage/);
  assert.match(publishModal, /spin_frames:\s*await mapWithConcurrency\([\s\S]*?,\s*1,\s*publishProductImage/);
  assert.doesNotMatch(publishModal, /will not be published until R2|uploaded photos await R2/);
  assert.match(posSource, /window\.AppUtils\.compressImageFile\(file, \{ maxDimension: 1800, maxBytes: 900_000 \}\)/);

  const image = 'data:image/png;base64,unchanged-image';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(image));
  const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const cachedUrl = 'https://shop.example/media/main/11111111-1111-4111-8111-111111111111.webp';
  let uploadRequests = 0;
  const uploadMethod = new Script(`({ async uploadCatalogImage(image, apiUrl, tenant, token, onStored) { ${imageUpload} } })`)
    .runInNewContext({
      crypto: globalThis.crypto,
      TextEncoder,
      URL,
      fetch: async () => { uploadRequests += 1; throw new Error('Unchanged images must not trigger a network request.'); },
      window: { localStorage: { getItem: () => JSON.stringify({ [fingerprint]: cachedUrl }) } }
    });

  assert.equal(await uploadMethod.uploadCatalogImage(image, new URL('https://shop.example/api/catalog'), { id: 'main' }, 'token'), cachedUrl);
  assert.equal(uploadRequests, 0, 'A previously uploaded unchanged image should not be uploaded again.');

  const remoteImage = 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=1000&q=80';
  const remoteFingerprint = [...new Uint8Array(await globalThis.crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(remoteImage)
  ))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const uploadedUrl = 'https://rayoo.rrobin.co.ke/media/rayoo/11111111-1111-4111-8111-111111111111.webp';
  const requests = [];
  let compressionOptions;
  const externalUpload = new Script(`({ async uploadCatalogImage(image, apiUrl, tenant, token, onStored) { ${imageUpload} } })`)
    .runInNewContext({
      crypto: globalThis.crypto,
      TextEncoder,
      URL,
      File,
      Blob,
      Response,
      console,
      fetch: async (input, options) => {
        const url = String(input);
        requests.push({ url, options });
        if (url === remoteImage) return new Response(new Blob(['source'], { type: 'image/jpeg' }), { status: 200 });
        if (url.startsWith('data:image/webp')) return new Response(new Blob(['compressed'], { type: 'image/webp' }), { status: 200 });
        return new Response(JSON.stringify({ ok: true, url: uploadedUrl }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      },
      AppUtils: {
        async compressImageFile(file, options) {
          assert.equal(file.type, 'image/jpeg');
          compressionOptions = options;
          return 'data:image/webp;base64,compressed';
        }
      },
      window: { localStorage: {
        getItem: () => JSON.stringify({ [fingerprint]: cachedUrl }),
        setItem: () => {}
      } }
    });
  assert.equal(
    await externalUpload.uploadCatalogImage(remoteImage, new URL('https://worker.example/api/catalog'), {
      id: 'rayoo', hostname: 'rayoo.rrobin.co.ke'
    }, 'token'),
    uploadedUrl
  );
  assert.equal(compressionOptions.maxDimension, 1600, 'catalogue photos stay sharp on a modern phone');
  assert.equal(compressionOptions.maxBytes, 2_800_000);
  assert.equal(requests[0].options.mode, 'cors');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(requests.at(-1).options.method, 'POST');
  assert.equal(requests.at(-1).options.headers['Content-Type'], 'image/webp');
  assert.equal(
    await externalUpload.uploadCatalogImage(uploadedUrl, new URL('https://worker.example/api/catalog'), {
      id: 'rayoo', hostname: 'rayoo.rrobin.co.ke'
    }, 'token'),
    uploadedUrl,
    'Images already hosted on the shop domain should not be uploaded again.'
  );
});

test('web-only product entry keeps the requested field order and saves optional buying price', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const form = pageSource.match(/<form class="store-workspace-form" data-studio-form="web-product"[\s\S]*?<\/form>/)?.[0];
  assert.ok(form, 'The Web-only product form should be available even without existing categories.');
  const positions = [
    'Product name',
    'data-web-product-taxonomy',
    'Selling price',
    'Buying price · optional',
    'web-product-media',
    'Starting website stock',
    'data-web-product-variants',
    'web-product-hold',
    'Save web product'
  ].map(text => form.indexOf(text));
  assert.ok(positions.every(position => position >= 0), 'The Web form should include every product field.');
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  assert.match(pageSource, /onCategoryCreate: async name => \{[\s\S]*?SQLiteEngine\.saveCategory\(\{ name \}\)[\s\S]*?await window\.ShopSQLite\.flush\(\)/);
  assert.match(pageSource, /cost_price: costPrice \?\? 0/);
  assert.match(pageSource, /if \(!name \|\| !Number\.isFinite\(price\)[\s\S]*?Number\.isSafeInteger\(categoryId\)[\s\S]*?SQLiteEngine\.getCategories\(\)\.some/);
  assert.match(pageSource, /if \(kind === "web-product"\) \{[\s\S]*?nextProductForm\.hidden = false/);
  assert.match(pageSource, /\.web-product-taxonomy \.product-taxonomy-picker \{[\s\S]*?padding: 0;[\s\S]*?border: 0;/);
  assert.match(pageSource, /\.web-product-variants \.product-variant-fields \{[\s\S]*?padding: 8px;[\s\S]*?border-radius: 8px;/);
});

test('catalog publishing bounds concurrent media work and preserves item order', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const publishModal = pageSource.match(/openCloudflarePublishModal\(publishImmediately = false\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  initStudioModals/)?.[1];
  const concurrencyHelper = publishModal?.match(/const mapWithConcurrency = async \(items, limit, worker\) => \{[\s\S]*?\r?\n        \};/)?.[0];
  assert.ok(concurrencyHelper, 'Catalog publishing should define a bounded media worker.');
  const mapWithConcurrency = new Function(`${concurrencyHelper}; return mapWithConcurrency;`)();
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async value => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.equal(peak, 2);
});

test('Store bulk hold actions use the soft silver card style', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /body\.craft-app-ui #app \.store-bulk-actions \[data-bulk-product-holds\],[\s\S]*?border-radius:\s*12px;[\s\S]*?background:\s*linear-gradient\(145deg,\s*#fff 0%,\s*#f0f0f0 100%\)/);
});

test('Craft orders render as spacious silver cards with a concise Load action', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /class="studio-list-row studio-order-card"/);
  assert.match(pageSource, /class="studio-list-row studio-order-card studio-online-order-card"[\s\S]*?studio-order-header[\s\S]*?studio-order-items[\s\S]*?studio-order-controls/);
  assert.match(pageSource, /studio-list-row\.studio-order-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*0;[^}]*max-height:\s*none;[^}]*padding:\s*14px;[^}]*background:\s*linear-gradient\(145deg,\s*#dedede 0%,\s*#c4c4c4 100%\)/);
  assert.match(pageSource, /data-business-online-orders-load aria-label="Load online orders">Load/);
  assert.doesNotMatch(pageSource, />Load online orders<\/button>|>Refresh online orders<\/button>/);
});

test('Craft booking Load buttons are compact rounded silver controls', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /data-online-appointments-load aria-label="Load appointments">Load/);
  assert.match(pageSource, /data-online-holds-load aria-label="Load hold requests">Load/);
  assert.match(pageSource, /body\.craft-app-ui #app \.studio-load-button\s*\{[^}]*min-height:\s*30px;[^}]*height:\s*30px;[^}]*padding:\s*4px 11px;[^}]*border-radius:\s*999px !important;[^}]*background:\s*linear-gradient\(145deg,\s*#dedede 0%,\s*#c4c4c4 100%\)/);
});

test('Craft CRM separates Customers, Points, and Subscribers with bulk subscriber removal', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /title: "Customers", route: "\/account\/web\/studio\/crm\/customers", contentPath: "\/account\/customers"[\s\S]*?title: "Points", route: "\/account\/web\/studio\/crm\/points", contentPath: "\/account\/customers\/loyalty"[\s\S]*?title: "Subscribers", route: "\/account\/web\/studio\/crm\/subscribers", contentPath: "\/account\/customers\/newsletter"/);
  assert.match(pageSource, /data-newsletter-select-all><span>Select all subscribers<\/span>/);
  assert.match(pageSource, /data-newsletter-subscriber-select value="\$\{AppUtils\.escapeHTML\(subscriber\.id\)\}"/);
  assert.match(pageSource, /data-newsletter-remove-selected disabled>Remove selected/);
  assert.match(pageSource, /removeRemoteSubscribers = async ids =>[\s\S]*?removeNewsletterSubscriber\(tenantId, id\)[\s\S]*?data-newsletter-remove-selected/);
  assert.match(pageSource, /newsletter\|subscribers/);
});

test('Performance visits, orders, and revenue use compact full-width cards', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const performance = pageSource.match(/if \(path === "\/account\/main-shop\/performance" \|\| path === "\/store\/revenue"\) \{([\s\S]*?)\r?\n    \}\r?\n    if \(path === "\/account\/main-shop\/product-intelligence"\)/)?.[1];
  assert.ok(performance, 'Performance should have a dedicated metrics section.');
  assert.match(performance, /studio-performance-metrics[\s\S]*?performanceMetrics\.map/);
  assert.match(performance, /\["Visits"[\s\S]*?\["Orders"[\s\S]*?\["Revenue"/);
  assert.doesNotMatch(performance, /studio-period-grid studio-metric-grid-featured/);
  assert.match(pageSource, /body\.craft-app-ui #app \.studio-performance-metrics\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(pageSource, /body\.craft-app-ui #app \.studio-performance-metric\s*\{[^}]*min-height:\s*54px;[^}]*padding:\s*7px 10px;[^}]*background:\s*linear-gradient\(145deg,\s*#dedede 0%,\s*#c4c4c4 100%\)/);
});

test('Main Store uses compact silver shortcuts and has no separate insights screen', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const businessLensSource = await readFile(new URL('../src/business-lens.js', import.meta.url), 'utf8');
  assert.doesNotMatch(pageSource, /Cloud storefront orders could not be loaded/);
  assert.match(pageSource, /const mainStoreShortcuts = businessPath === "\/account\/main-shop"[\s\S]*?<\/nav>`\s*:\s*"";/);
  for (const [label, route] of [
    ['Products', '/store/products'],
    ['Customers', '/account/customers'],
    ['Channels', '/store/channels'],
    ['Inventory', '/store/inventory'],
    ['Finance', '/account/main-shop/finance'],
    ['Revenue', '/store/revenue']
  ]) {
    assert.ok(pageSource.includes(`href="${route}" data-route="${route}">${label}</a>`), `${label} should open its Main Store screen.`);
  }
  assert.match(pageSource, /body\.craft-app-ui #app \.main-store-shortcuts\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(pageSource, /body\.craft-app-ui #app \.main-store-shortcuts a\s*\{[^}]*min-height:\s*40px;[^}]*background:\s*linear-gradient\(145deg,\s*#dedede 0%,\s*#c4c4c4 100%\)/);
  assert.doesNotMatch(pageSource, /title: "Insights"|Main Store insights|Product insights|Customer insights|Channels insights|Inventory insights|Finance insights/);
  assert.doesNotMatch(businessLensSource, /"\/account\/main-shop\/insights":\(\)=>renderInsights/);
  assert.match(businessLensSource, /card\("Priority signals"/);
});

test('Main Store opens a compact product editor with cross-channel add, edit, and delete', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const businessLensSource = await readFile(new URL('../src/business-lens.js', import.meta.url), 'utf8');
  assert.match(businessLensSource, /Product leaderboard · revenue[\s\S]*?main-store-product-entry[\s\S]*?Products sold/);
  assert.match(businessLensSource, /href="\/store\/products\/manage" data-route="\/store\/products\/manage"><span>Edit products<\/span>/);
  assert.match(pageSource, /"\/store\/products", "\/store\/products\/manage", "\/store\/manage\/products", "\/store\/manage\/categories"/);
  assert.match(pageSource, /\.main-store-product-entry\s*\{[^}]*width:\s*100%[^}]*min-height:\s*40px[^}]*background:\s*linear-gradient\(145deg,\s*#d2d2d2 0%,\s*#b8b8b8 100%\)/);
  assert.match(pageSource, /const isAppShell =[\s\S]*?path === "\/store" \|\| path\.startsWith\("\/store\/"\)/);
  assert.match(pageSource, /\.main-store-product-row\s*\{[^}]*grid-template-columns:\s*36px minmax\(0,\s*1fr\) auto/);
  assert.match(pageSource, /\.main-store-product-row > img,[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px/);
  const productManager = pageSource.match(/renderMainStoreProductManagement\(snapshot\)\s*\{([\s\S]*?)\r?\n  \},\r?\n\r?\n  getMainStoreCategoryRecords/)?.[1];
  assert.ok(productManager, 'The edit card should open a dedicated product management screen.');
  assert.match(productManager, /<img src="\$\{AppUtils\.escapeHTML\(image\)\}"[\s\S]*?data-main-product-edit[\s\S]*?data-main-product-delete/);
  assert.doesNotMatch(productManager, /data-store-pos-product|data-store-publish-product|data-remove-website-product/);
  assert.doesNotMatch(productManager, /name="sku"|>SKU</);
  assert.match(pageSource, /renderMainStoreProductManagement\(snapshot\)[\s\S]*?data-main-store-product-form[\s\S]*?name="channels" value="pos" checked[\s\S]*?name="channels" value="web" checked/);
  assert.match(pageSource, /let sku = original\?\.sku \|\| ""[\s\S]*?SQLiteEngine\.generateProductSku\(\)/);
  assert.match(pageSource, /getMainStoreCategoryRecords\(snapshot\)[\s\S]*?renderMainStoreCategories\(snapshot\)[\s\S]*?data-main-category-edit[\s\S]*?data-main-category-delete/);
  assert.match(pageSource, /bindMainStoreCategories\(container, snapshot, path\)[\s\S]*?ShopPOS\.renameCategory[\s\S]*?ShopPOS\.createCategory[\s\S]*?ShopPOS\.deleteCategory/);
  assert.match(pageSource, /"\/store\/manage\/products", "\/store\/manage\/categories"/);
  assert.match(pageSource, /renderMainStoreManagement\(path, snapshot\)[\s\S]*?main-store-management-content[\s\S]*?renderMainStoreCategories\(snapshot\)/);
  assert.match(pageSource, /renderMainStoreManagement\(path, snapshot\)[\s\S]*?main-store-management-tabs[\s\S]*?Products[\s\S]*?Categories/);
  for (const selector of [
    'data-main-product-add',
    'data-main-product-edit',
    'data-main-product-delete'
  ]) {
    assert.ok(pageSource.includes(selector), `The product manager should expose ${selector}.`);
  }
  const bottomItems = pageSource.match(/const bottomItems = \[([\s\S]*?)\n    \];/)?.[1];
  assert.ok(bottomItems, 'Main Store should render its bottom navigation.');
  assert.match(bottomItems, /route: "\/store\/manage\/products", title: "Store"/);
  assert.doesNotMatch(bottomItems, /title: "Products"/);
  assert.match(pageSource, /store:\s*\[\s*\{\s*route: "\/store\/products", title: "Web products"\s*\},\s*\{\s*route: "\/store\/products\/manage", title: "Edit products"\s*\},\s*\{\s*route: "\/store\/inventory", title: "Inventory"\s*\},\s*\{\s*route: "\/store\/categories", title: "Web categories"\s*\},\s*\{\s*route: "\/store\/split-shop", title: "Split products"\s*\}\s*\]/);
  assert.match(pageSource, /const sectionSidebar = this\.renderWorkspaceSidebar\([\s\S]*?section === "store" \? "Store"/);
  assert.match(pageSource, /route: "\/store\/products\/manage", title: "Edit products"/);
  assert.match(pageSource, /\.business-lens-shell \.studio-workspace-bottom-nav\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(pageSource, /bindMainStoreProductManagement\(container, snapshot, path\)[\s\S]*?SQLiteEngine\.saveProduct[\s\S]*?window\.ShopPOS\.saveProduct[\s\S]*?this\.addWebsiteProductToPos[\s\S]*?this\.publishPosProduct[\s\S]*?window\.ShopPOS\.deleteProduct/);
});

test('Web Studio website products and categories can be removed without deleting Store/POS records', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const websiteWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\r?\n    \}\r?\n    if \(path === "\/store\/categories"\)/)?.[1];
  const categoryWorkspace = pageSource.match(/if \(path === "\/store\/categories"\) \{([\s\S]*?)\r?\n    \}\r?\n    if \(path === "\/store\/inventory"\)/)?.[1];
  const productRemoval = pageSource.match(/document\.querySelectorAll\("\[data-remove-website-product\]"\)([\s\S]*?)document\.querySelectorAll\("\[data-remove-website-category\]"\)/)?.[1];
  const categoryRemoval = pageSource.match(/document\.querySelectorAll\("\[data-remove-website-category\]"\)([\s\S]*?)document\.querySelectorAll\("\[data-store-pos-category\]"\)/)?.[1];
  const bulkRemovalBinding = pageSource.match(/currentContent\.querySelectorAll\("\[data-bulk-removal\]"\)([\s\S]*?)document\.querySelectorAll\("\.business-filter"\)/)?.[1];
  assert.ok(websiteWorkspace, 'Website product workspace should render removal controls.');
  assert.ok(categoryWorkspace, 'Website category workspace should render removal controls.');
  assert.ok(productRemoval, 'Website product removal should be bound.');
  assert.ok(categoryRemoval, 'Website category removal should be bound.');
  assert.ok(bulkRemovalBinding, 'Website bulk removal should be bound after workspace rendering.');
  assert.match(websiteWorkspace, /Website products are managed separately\. Publish to update/);
  assert.match(websiteWorkspace, /existsInPos = snapshot\.posProducts\.some[\s\S]*?data-store-pos-product="\$\{product\.id\}"[\s\S]*?Add to Store\/POS/);
  assert.match(pageSource, /document\.querySelectorAll\("\[data-store-pos-product\]"\)[\s\S]*?addWebsiteProductToPos\(Number\(button\.dataset\.storePosProduct\)\)[\s\S]*?Product added to POS/);
  assert.match(websiteWorkspace, /data-remove-website-product="\$\{product\.id\}"[\s\S]*?Remove from this website/);
  assert.match(categoryWorkspace, /data-remove-website-category="\$\{category\.id\}"[\s\S]*?Remove category from this website/);
  assert.match(categoryWorkspace, /data-studio-form="web-category"/);
  assert.doesNotMatch(categoryWorkspace, /Website categories are separate from your POS categories/);
  assert.match(categoryWorkspace, /<input name="name" aria-label="Category name" placeholder="Category name"/);
  assert.doesNotMatch(categoryWorkspace, /<h2>Create website category<\/h2>|<label>Category name/);
  assert.match(pageSource, /body\.craft-app-ui #app \.studio-workspace \.store-workspace-form\[data-studio-form="web-category"\]\s*\{[^}]*gap:\s*6px !important;[^}]*margin:\s*0 0 8px !important;[^}]*padding:\s*6px !important;[^}]*background:\s*linear-gradient\(145deg,\s*#dedede 0%,\s*#c4c4c4 100%\) !important/);
  assert.match(pageSource, /body\.craft-app-ui #app \.studio-workspace \.store-workspace-form\[data-studio-form="web-category"\] input,[\s\S]*?min-height:\s*34px !important/);
  assert.match(productRemoval, /SQLiteEngine\.deleteProduct\(productId\)[\s\S]*?await window\.ShopSQLite\.flush\(\)[\s\S]*?cacheActiveTenantCatalog/);
  assert.match(productRemoval, /Store\/POS inventory will not be deleted/);
  assert.match(categoryRemoval, /SQLiteEngine\.deleteCategory\(categoryId\)[\s\S]*?await window\.ShopSQLite\.flush\(\)[\s\S]*?cacheActiveTenantCatalog/);
  assert.match(categoryRemoval, /remain on this website as uncategorized/);
  assert.match(websiteWorkspace, /Select all products[\s\S]*?Remove selected products[\s\S]*?data-bulk-item="\$\{product\.id\}"/);
  assert.match(categoryWorkspace, /Select all categories[\s\S]*?Remove selected categories[\s\S]*?data-bulk-item="\$\{category\.id\}"/);
  assert.match(websiteWorkspace, /class="studio-inline-actions web-product-actions"[\s\S]*?class="btn-secondary web-product-action-card"[\s\S]*?class="btn-primary web-product-action-card"[\s\S]*?class="btn-secondary web-product-action-card"[\s\S]*?class="btn-secondary web-product-action-card"/);
  assert.match(pageSource, /\.studio-inline-actions\.web-product-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*grid-auto-rows:\s*42px/);
  assert.match(pageSource, /\.store-bulk-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(pageSource, /\.store-bulk-actions \[data-bulk-remove\]\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/);
  assert.match(websiteWorkspace, /class="store-product-detail-wrap"[\s\S]*?store-product-name[\s\S]*?formatMainShopMoney\(product\.price,\s*currency\)/);
  assert.match(categoryWorkspace, /class="store-category-import-row"[\s\S]*?class="store-category-wrap"/);
  assert.match(pageSource, /\.store-product-detail-wrap,\s*\.store-category-wrap\s*\{[^}]*border-radius:\s*12px/);
  assert.match(bulkRemovalBinding, /selectAll\.onchange[\s\S]*?items\.forEach\(item => \{ item\.onchange = updateSelection; \}\)[\s\S]*?SQLiteEngine\.deleteProduct\(id\)[\s\S]*?SQLiteEngine\.deleteCategory\(id\)[\s\S]*?await window\.ShopSQLite\.flush\(\)/);
});

test('Web Studio can add multiple Store products at once and carries their images into the website catalog', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const productsWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\n    \}\n    if \(path === "\/store\/categories"\)/)?.[1];
  const importHandler = pageSource.match(/document\.querySelectorAll\("\.store-existing-product-form"\)\.forEach\(form => \{([\s\S]*?)\n      const addProductTrigger/)?.[1];
  assert.ok(productsWorkspace, 'Web Studio should render the website product workspace.');
  assert.ok(importHandler, 'Existing-website Store imports should have a submit handler.');
  assert.match(productsWorkspace, /data-store-import-select-all> Select all available products/);
  assert.match(productsWorkspace, /data-store-import-product="\$\{index\}"/);
  assert.match(productsWorkspace, /const image = pos\.imageUri \|\| pos\.images\?\.\[0\]/);
  assert.match(importHandler, /selectAll\?\.addEventListener\("change"[\s\S]*?products\.forEach\(input => \{ input\.checked = selectAll\.checked; \}\)/);
  assert.match(importHandler, /selectedProducts[\s\S]*?await syncExistingProduct\(product\)[\s\S]*?added to this website/);
  assert.match(pageSource, /images: product\.imageUri \? \[product\.imageUri\] : webProduct\?\.images \|\| \[\]/);
});

test('managing a website opens its Web Studio products and exposes publishing', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const manageHandler = pageSource.match(/const manageWebsite = e\.target\.closest\("\[data-manage-website\]"\);([\s\S]*?)\r?\n      }\r?\n\r?\n      const editWebsite/)?.[1];
  assert.ok(manageHandler, 'Website management should have a dedicated click handler.');
  assert.match(manageHandler, /this\.setActiveTenantCatalog\([\s\S]*?this\.navigate\("\/account\/web\/studio\/store\/products"\)/);
  const productsWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\r?\n    \}\r?\n    if \(path === "\/store\/categories"\)/)?.[1];
  assert.ok(productsWorkspace, 'Web Studio should render the website product workspace.');
  assert.match(productsWorkspace, /id="btn-publish-cloudflare">Publish to \$\{AppUtils\.escapeHTML\(activeTenant\.hostname\)\}/);
  assert.match(pageSource, /\.studio-inline-actions\.web-product-actions \{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*grid-auto-rows: 42px;/);
  assert.match(productsWorkspace, /Website products are managed separately\. Publish to update/);
  assert.match(productsWorkspace, /id="product-modal-container"/);
});

test('new-website workspace keeps Store import and web-product actions without restoring the theme picker', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const websitesNavigation = pageSource.match(/title: "Websites",([\s\S]*?)\n      \},\n      \{\n        title: "Payments"/)?.[1];
  assert.ok(websitesNavigation, 'Websites tabs should have a bounded navigation entry.');
  assert.match(websitesNavigation, /title: "New web", route: "\/account\/web\/studio\/websites\/webmaker"[\s\S]*?title: "Add"[\s\S]*?title: "Website editor"/);
  assert.doesNotMatch(pageSource, /Theme Studio/, 'The website editor is Litrus Mixer; no screen should still be called Theme Studio.');
  assert.match(pageSource, /website-management-new" href="\/account\/web\/studio\/websites\/webmaker" data-start-new-website>\+ New web/);
  assert.match(pageSource, /renderNewWebsiteProducts\(\)[\s\S]*?id="website-wizard-load-store">Add from Store[\s\S]*?id="website-wizard-create-product">Add web product[\s\S]*?id="website-wizard-product-form"[\s\S]*?id="website-wizard-store-picker"/);
  assert.match(pageSource, /const litrusBuilderRoute = "\/account\/web\/site\?new=1&edit=1&theme=litrus-mixer";[\s\S]*?id="website-wizard-go-builder"[\s\S]*?Go to web builder[\s\S]*?Choose products from Store/);
  assert.match(pageSource, /postRenderSetup\(path, params\) \{[\s\S]*?path === "\/account\/web\/studio\/websites\/webmaker"[\s\S]*?this\.bindWebsiteBuilderEvents\(\)/);
  assert.doesNotMatch(pageSource, /renderWebsiteBuilderCatalog|renderWebsiteThemes\(|renderWebsiteThemeChoices|NEW WEBSITE · STEP [12] OF 3|Use your Store catalog|Continue to choose a theme|Choose a storefront theme/);
  assert.doesNotMatch(pageSource, /path === "\/account\/web\/themes"|path === "\/account\/web\/themes\/select"/);
  assert.doesNotMatch(pageSource, /this\.navigate\("\/account\/web\/site\?new=1&edit=1&theme=litrus-mixer", true\)/);
  assert.doesNotMatch(pageSource.match(/if \(manageWebsite\) \{([\s\S]*?)\n      \}\n\n      const editWebsite/)?.[1] || "", /websites\/webmaker/);
  assert.match(pageSource, /const initialPath = path === "\/account\/web"\s*\?\s*"\/account\/web\/studio\/dashboard\/overview"/);
  assert.match(pageSource, /ESHOP_WEBSITE_DRAFT_LEGACY_CATALOG_CLEANUP_V2[\s\S]*?saved\.products = \[\];[\s\S]*?saved\.categories = \[\]/);
  assert.match(pageSource, /async websiteBuilderSourceCatalog\(\)[\s\S]*?window\.ShopPOS\.listProducts\(\)[\s\S]*?window\.ShopPOS\.listCategories\(\)[\s\S]*?posProductCount/);
  assert.match(posSource, /FROM pos_products p LEFT JOIN pos_categories c ON c\.id = p\.category_id/);
  assert.match(pageSource, /async applyWebsiteBuilderDraft\(draft, themeId\)[\s\S]*?video_path: product\.video_path \|\| ""[\s\S]*?taxonomy_category_id: product\.taxonomy_category_id/);
  assert.match(pageSource, /generateProductSku\(\)[\s\S]*?crypto\.getRandomValues\(bytes\)/);
  assert.doesNotMatch(pageSource, /websiteBusinessType\(draft\.business_type\)|Choose a business type before/);
  assert.deepEqual(WEBSITE_THEME_CATALOG.filter(theme => theme.validation_status === 'passed').map(theme => theme.id), [
    'litrus-mixer'
  ], 'Only validated storefront themes are selectable.');
  assert.match(pageSource, /websiteThemesForPicker\(\) \{\s*return this\.websiteThemes\(\)\.filter\(theme =>\s*theme\.validation_status === "passed" &&\s*\(theme\.editor_mode === "liquid-html" \|\| theme\.editor_mode === "litrus"\)\)/);
  assert.match(pageSource, /NEW WEBSITE · FINAL SETUP[\s\S]*?Shop \/ website name[\s\S]*?Website address[\s\S]*?>Set up</);
  assert.match(pageSource, /const editorReturnRoute = draftEditor\s*\?\s*"\/account\/web\/studio\/websites\/list"/);
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor, "The selected theme should open the Theme Studio.");
  assert.doesNotMatch(pageSource, /NEW WEBSITE · STEP 3 OF 3|btn-builder-finish-website|saveEditorDesign/);
  assert.match(pageSource, /prepareWebsiteBuilderDraftTenant\(draft, themeId\)[\s\S]*?WEBSITE_BUILDER_DRAFT_TENANT_ID/);
  assert.match(pageSource, /ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1/);
  assert.match(pageSource, /const draftCatalog = catalogIsCurrent \? savedCatalog : \{\s*products: draft\.products,\s*categories: draft\.categories,\s*inventory: \[\],\s*pages: \[\]/);
  assert.match(pageSource, /const hasSavedDraftCatalog = Boolean\(savedCatalog\?\.draft_signature\)/);
  assert.match(pageSource, /savedSignature === signature && savedCatalog\?\.draft_signature === signature/);
  assert.match(pageSource, /availableThemes\.find\(theme =>\s*theme\.id === themeId\) \|\| availableThemes\.find\(theme =>\s*theme\.id === draft\.selected_theme\)/);
  assert.match(pageSource, /if \(activeTenant\.id !== WEBSITE_BUILDER_DRAFT_TENANT_ID \|\| !catalogIsCurrent\) \{[\s\S]*?this\.setActiveTenantCatalog\(draftTenant, draftCatalog\)/);
  assert.match(pageSource, /SQLiteEngine\.updateStore\(\{\s*website_theme_id: selectedTheme\.id,\s*section_layout: draft\.section_layout\s*\}\);[\s\S]*?this\.cacheActiveTenantCatalog\(\)/);
  assert.match(pageSource, /const useThemeRoute = `\/account\/web\/site\?new=1&edit=1&theme=/);
  assert.match(pageSource, /websiteThemesForPicker\(\)\s*\{\s*return this\.websiteThemes\(\)\.filter\(theme =>\s*theme\.validation_status === "passed" &&\s*\(theme\.editor_mode === "liquid-html" \|\| theme\.editor_mode === "litrus"\)\)/);
  assert.match(pageSource, /applyWebsiteBuilderDraft\(draft, themeId\)[\s\S]*?theme\.id === \(themeId \|\| draft\.selected_theme\)[\s\S]*?website_theme_id: selectedTheme\.id[\s\S]*?this\.cacheActiveTenantCatalog\(\)/);
  assert.doesNotMatch(pageSource, /previewWindow\.setBuilderCatalog\(\{\s*products: JSON\.parse\(JSON\.stringify\(websiteDraft\.products\)\),\s*categories: JSON\.parse\(JSON\.stringify\(websiteDraft\.categories\)\)/);
  assert.match(pageSource, /fillThemeForShop\(theme\.id, catalog/);
  assert.match(pageSource, /async prepareWebsiteBuilderDraftTenant\(draft, themeId\)[\s\S]*?const sourceCatalog = await this\.websiteBuilderSourceCatalog\(\);[\s\S]*?draft\.products = sourceCatalog\.products;[\s\S]*?draft\.categories = sourceCatalog\.categories;[\s\S]*?this\.setActiveTenantCatalog\(draftTenant, draftCatalog\);[\s\S]*?window\.localStorage\.setItem\(WEBSITE_BUILDER_DRAFT_SYNC_KEY, signature\);/);
  assert.match(pageSource, /handleRoute\(fullPath, shouldScroll = true, draftPrepared = false\)[\s\S]*?if \(!draftPrepared\) \{[\s\S]*?Preparing your new website preview[\s\S]*?this\.prepareWebsiteBuilderDraftTenant\([\s\S]*?\.then\(\(\) => \{[\s\S]*?this\.currentRoute\(\) === fullPath[\s\S]*?this\.handleRoute\(fullPath, shouldScroll, true\);/);
  assert.match(pageSource, /removeItem\("ESHOP_NEW_WEBSITE_DRAFT_V1"\)[\s\S]*?Website created at/);
  assert.equal((pageSource.match(/cloudflareRequest\("\/api\/tenants", \{\s*method: "PUT"/g) || []).length, 1,
    'Only the final name-and-domain form can create a website.');
  const createRequestGuard = pageSource.match(/async cloudflareRequest\(path,[\s\S]*?\n  \},\n\n  async loadTenantCatalog/)?.[0];
  assert.match(createRequestGuard || "", /this\.isWebsiteBuilderDraftTenant\(this\.getActiveTenant\(\)\.id\)[\s\S]*?finalTenantSetup[\s\S]*?throw new Error\("Cloudflare requests are disabled for the local website draft/);
  assert.match(pageSource, /openCloudflarePublishModal\(publishImmediately = false\) \{\s*if \(this\.isWebsiteBuilderDraftTenant\(this\.getActiveTenant\(\)\.id\)\)/);
});

test('new Litrus draft image search omits shop auth and keeps image data local until publishing', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const cloudflareRequestStart = pageSource.indexOf('async cloudflareRequest(path');
  const cloudflareRequestEnd = pageSource.indexOf('\n  async loadTenantCatalog', cloudflareRequestStart);
  const cloudflareRequest = pageSource.slice(cloudflareRequestStart, cloudflareRequestEnd);
  const imageRequestStart = pageSource.indexOf('searchImages: ({ tenantId, isDraft, images }) =>');
  const imageRequestEnd = pageSource.indexOf('reply: (frameWindow, message)', imageRequestStart);
  const imageRequestHandler = pageSource.slice(imageRequestStart, imageRequestEnd);
  const saveStart = pageSource.indexOf('async saveLitrusMixerCatalog(input, isDraftEditor, expectedTenantId) {');
  const saveEnd = pageSource.indexOf('\n  openCloudflarePublishModal(', saveStart);
  const saveLitrusCatalog = pageSource.slice(saveStart, saveEnd);
  const designSaveStart = pageSource.indexOf('const saveLitrusDesign = payload =>');
  const designSaveEnd = pageSource.indexOf('const sendCatalog =', designSaveStart);
  const designSave = pageSource.slice(designSaveStart, designSaveEnd);
  assert.ok(cloudflareRequestStart >= 0 && cloudflareRequestEnd > cloudflareRequestStart);
  assert.ok(imageRequestStart >= 0 && imageRequestEnd > imageRequestStart);
  assert.ok(saveStart >= 0 && saveEnd > saveStart);
  assert.ok(designSaveStart >= 0 && designSaveEnd > designSaveStart);
  assert.match(cloudflareRequest, /pathUrl\.pathname === "\/api\/images\/draft-search"/);
  assert.match(cloudflareRequest, /const token = draftLitrusImageRequest \? "" : credentialOverride \|\| connection\.token/);
  assert.match(imageRequestHandler, /isDraft\s*\?\s*"\/api\/images\/draft-search"/);
  assert.match(imageRequestHandler, /tenantId,\s*isDraft\s*\)/);
  assert.match(saveLitrusCatalog, /images: images\.slice\(0, 8\)/);
  assert.match(saveLitrusCatalog, /this\.setActiveTenantCatalog\(tenant,/);
  assert.match(designSave, /await this\.saveLitrusMixerCatalog\(payload, isDraftEditor, openedTenantId\)/);
  assert.match(designSave, /await window\.ShopSQLite\.flush\(\)/);
});

test('new website draft discards a stale Chapa catalog and rejects non-main theme routes', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const prepareDraft = pageSource.match(/async prepareWebsiteBuilderDraftTenant\(draft, themeId\) \{([\s\S]*?)\n  \},\n\n  restoreWebsiteBuilderPreviousTenant/)?.[1];
  assert.ok(prepareDraft, 'The draft preparation method should be available.');

  const draft = {
    categories: [{ id: 'draft-category', name: 'Draft category' }],
    products: [{ id: 'draft-product', name: 'Draft product', category_id: 'draft-category', price: 5, stock: 2 }],
    section_layout: { order: [], hidden: [], removed: [], added: [] },
    selected_theme: 'elora-linen'
  };
  const signature = JSON.stringify({
    categories: draft.categories.map(category => [String(category.id), category.name]),
    products: draft.products.map(product => {
      const imageSignature = Array.isArray(product.images) ? product.images.map(image => {
        const value = String(image || '');
        return [value.length, value.slice(0, 64), value.slice(-32)];
      }) : [];
      return [
        String(product.id), String(product.source_product_id || ''), product.name,
        Number(product.price) || 0, Number(product.cost_price) || 0, Number(product.stock) || 0,
        String(product.category_id), String(product.sku || ''), String(product.description || ''),
        String(product.media_type || 'image'), String(product.video_path || ''), imageSignature,
        Array.isArray(product.spin_frames) ? product.spin_frames : [],
        String(product.taxonomy_category_id || ''), String(product.taxonomy_category_name || ''),
        String(product.taxonomy_custom_category || ''),
        Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes : [],
        Array.isArray(product.sizes) ? product.sizes : [],
        Array.isArray(product.colors) ? product.colors : [],
        Array.isArray(product.variants) ? product.variants : []
      ];
    })
  });
  const tables = {
    tenant_catalogs: [
      { tenant_id: 'main', products: [], categories: [], inventory: [], pages: [], store: {} },
      {
        tenant_id: '__new_website_draft__',
        products: [{ id: 1, name: 'Chapa product' }],
        categories: [{ id: 1, name: 'Chapa category' }],
        inventory: [{ product_id: 1 }],
        pages: [{ title: 'Chapa page' }],
        store: { name: 'Chapa', title: 'Chapa Store', primary_color: '#FF0000' }
      }
    ],
    products: [],
    categories: [],
    inventory: [],
    pages: [],
    store: [{}]
  };
  const storage = new Map([
    ['ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1', signature]
  ]);
  const window = {
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    ShopSQLite: { flush: async () => {} }
  };
  const SQLiteEngine = {
    db: { tables },
    save: () => {},
    select: table => tables[table],
    getCategories: () => tables.categories,
    getPages: () => tables.pages,
    getStore: () => tables.store[0] || {},
    updateStore: values => { tables.store[0] = { ...tables.store[0], ...values }; }
  };
  let activeTenant = { id: 'main', name: 'Main shop', hostname: 'main.test' };
  const controller = {
    getActiveTenant: () => activeTenant,
    tenantCatalogs: () => tables.tenant_catalogs,
    cacheActiveTenantCatalog: () => {},
    setActiveTenantCatalog(tenant, catalog) {
      activeTenant = tenant;
      for (const table of ['products', 'categories', 'inventory', 'pages']) {
        tables[table] = structuredClone(catalog[table] || []);
      }
      tables.store = [structuredClone(catalog.store || {})];
      const index = tables.tenant_catalogs.findIndex(item => item.tenant_id === tenant.id);
      const cached = { tenant_id: tenant.id, ...structuredClone(catalog) };
      if (index < 0) tables.tenant_catalogs.push(cached);
      else tables.tenant_catalogs[index] = cached;
    },
    async websiteBuilderSourceCatalog() {
      return {
        products: [{ id: 22, name: 'Main Store product', category_id: 7, price: 12, stock: 5 }],
        categories: [{ id: 7, name: 'Main Store category' }]
      };
    },
    async applyWebsiteBuilderDraft(websiteDraft, themeId) {
      tables.categories = structuredClone(websiteDraft.categories);
      tables.products = structuredClone(websiteDraft.products);
      SQLiteEngine.updateStore({ website_theme_id: themeId });
    }
  };
  const runPreparation = new Function(
    'SQLiteEngine', 'StudioRenderers', 'window',
    'WEBSITE_BUILDER_DRAFT_TENANT_ID', 'WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY',
    'WEBSITE_BUILDER_DRAFT_SYNC_KEY',
    `return async function(draft, themeId) { ${prepareDraft} };`
  )(
    SQLiteEngine,
    { websiteThemesForPicker: () => [
      { id: 'elora-linen', is_main: true, editor_mode: 'liquid-html', validation_status: 'passed' }
    ], saveWebsiteBuilderDraft: () => {} },
    window,
    '__new_website_draft__',
    'ESHOP_NEW_WEBSITE_PREVIOUS_TENANT_V1',
    'ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1'
  );

  await runPreparation.call(controller, draft, 'chapa-theme');

  assert.deepEqual(tables.categories.map(category => category.name), ['Main Store category']);
  assert.deepEqual(tables.products.map(product => product.name), ['Main Store product']);
  assert.deepEqual(tables.inventory, []);
  assert.deepEqual(tables.pages, []);
  assert.equal(SQLiteEngine.getStore().name, 'New website draft');
  assert.equal(SQLiteEngine.getStore().website_theme_id, 'elora-linen');
  const savedDraftCatalog = tables.tenant_catalogs.find(item => item.tenant_id === '__new_website_draft__');
  assert.equal(savedDraftCatalog.draft_signature, storage.get('ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1'));
  assert.notEqual(savedDraftCatalog.draft_signature, signature);
});

test('new website source catalog merges POS-only items without replacing Main Store inventory', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sourceCatalog = pageSource.match(/async websiteBuilderSourceCatalog\(\) \{([\s\S]*?)\n  \},\n\n  async prepareWebsiteBuilderDraftTenant/)?.[1];
  assert.ok(sourceCatalog, 'The shared Store/POS catalog loader should be available.');
  const SQLiteEngine = {
    select: table => table === 'products' ? [{
      id: 10, name: 'Tea', sku: 'TEA-1', category_id: 1, category_name: 'Beverages',
      price: 50, stock: 7, images: ['/tea.jpg']
    }] : [],
    getCategories: () => [{ id: 1, name: 'Beverages' }]
  };
  const window = {
    ShopPOS: {
      listCategories: async () => [
        { id: 3, name: 'Beverages' },
        { id: 4, name: 'Pantry' }
      ],
      listProducts: async () => [
        { id: 30, name: 'Tea', sku: 'TEA-1', categoryId: 3, price: 55, stock: 99 },
        { id: 31, name: 'Oats', sku: 'OAT-1', categoryId: 4, price: 120, stock: 8, taxonomyAttributes: [] }
      ]
    }
  };
  const loadCatalog = new Function(
    'SQLiteEngine', 'window', 'WEBSITE_BUILDER_DRAFT_TENANT_ID',
    'WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY',
    `return async function() { ${sourceCatalog} };`
  )(SQLiteEngine, window, '__new_website_draft__', 'ESHOP_NEW_WEBSITE_PREVIOUS_TENANT_V1');
  const catalog = await loadCatalog.call({
    getActiveTenant: () => ({ id: 'main' }),
    tenantCatalogs: () => [],
    isWebsiteBuilderDraftTenant: tenantId => tenantId === '__new_website_draft__'
  });

  assert.deepEqual(catalog.categories.map(category => category.name), ['Beverages', 'Pantry']);
  assert.deepEqual(catalog.products.map(product => product.name), ['Tea', 'Oats']);
  assert.equal(catalog.products[0].stock, 7, 'POS stock must not overwrite the Main Store product.');
  assert.equal(catalog.products[0].price, 50, 'POS data must not replace the Main Store product record.');
  assert.equal(catalog.products[1].stock, 8);
  assert.equal(catalog.posProductCount, 1);
  assert.equal(catalog.posConnected, true);
  const draftCatalog = await loadCatalog.call({
    getActiveTenant: () => ({ id: '__new_website_draft__' }),
    tenantCatalogs: () => [
      { tenant_id: 'main', products: SQLiteEngine.select('products'), categories: SQLiteEngine.getCategories() },
      { tenant_id: 'other-website', products: [{ id: 90, name: 'Wrong website item' }], categories: [] }
    ],
    isWebsiteBuilderDraftTenant: tenantId => tenantId === '__new_website_draft__'
  });
  assert.deepEqual(draftCatalog.products.map(product => product.name), ['Tea', 'Oats']);
  await assert.rejects(
    loadCatalog.call({
      getActiveTenant: () => ({ id: 'existing-website' }),
      tenantCatalogs: () => [],
      isWebsiteBuilderDraftTenant: tenantId => tenantId === '__new_website_draft__'
    }),
    /Main Store catalog is not available/
  );
});

test('new websites start with a clean draft and each shop has a dedicated domains screen', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /resetWebsiteBuilderDraft\(\) \{[\s\S]*?removeItem\("ESHOP_NEW_WEBSITE_DRAFT_V1"\)[\s\S]*?removeItem\(WEBSITE_BUILDER_DRAFT_SYNC_KEY\)[\s\S]*?tenant_catalogs = AppController\.tenantCatalogs\(\)\.filter/);
  assert.match(pageSource, /website-management-new" href="\/account\/web\/studio\/websites\/webmaker" data-start-new-website>\+ New web/);
  assert.match(pageSource, /const domainsRoute = `\/account\/profile\/webs\/\$\{encodeURIComponent\(domainTenantId\)\}\/domains`;/);
  assert.match(pageSource, /title: "Domains", route: domainsRoute, contentPath: domainsRoute/);
  assert.match(pageSource, /href="\/account\/profile\/webs\/\$\{encodeURIComponent\(website\.id\)\}\/domains"[^>]*>Domains/);
  assert.match(pageSource, /const websiteDomainScreen = selectedWebsite \?[\s\S]*?Your Craft address[\s\S]*?Connect a custom subdomain[\s\S]*?To change an existing custom domain, remove it here first/);
  assert.match(pageSource, /websiteDetailSection === "domains" \? websiteDomainScreen/);
  assert.match(pageSource, /const websiteDomainSettingsMatch = path\.match/);
  assert.match(pageSource, /loadCustomHostnameStatus\(domainTenantId\)/);
  assert.match(pageSource, /const theme = this\.websiteThemesForPicker\(\)\.find\(item => item\.id === themeId\)/);
  assert.match(pageSource, /const availableThemes = StudioRenderers\.websiteThemesForPicker\(\);[\s\S]*?availableThemes\.find\(theme => theme\.id === params\.get\("theme"\)\)/);
});

test('main app inline script parses before packaging', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const inlineScripts = [...pageSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(script => !/\bsrc\s*=/.test(script[1]));
  const appScript = inlineScripts.find(script => !/\btype\s*=\s*["']module["']/i.test(script[1]));
  assert.ok(appScript, 'The app should have an inline application script.');
  assert.doesNotThrow(() => new Script(appScript[2], { filename: 'index.html:inline-app-script' }));
  for (const script of inlineScripts.filter(item => /\btype\s*=\s*["']module["']/i.test(item[1]))) {
    assert.doesNotThrow(() => new Script(script[2], { filename: 'index.html:inline-module-script' }));
  }
});

test('home and app screens are a flat full-screen app with white cards', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const visualTheme = await readFile(new URL('../src/app-visual-theme.css', import.meta.url), 'utf8');
  const homeStyle = pageSource.match(/\.home-screen\s*\{([^}]*)\}/)?.[1];
  assert.ok(homeStyle, 'The home screen should define its own color treatment.');
  assert.match(homeStyle, /background:\s*transparent/);
  assert.match(homeStyle, /--home-light-foreground:\s*#111/);
  assert.match(homeStyle, /--home-dark-foreground:\s*#111/);
  assert.match(visualTheme, /--app-shell-background:\s*#eceff2;/);
  assert.match(visualTheme, /--app-card-surface:\s*#ffffff;/);
  assert.match(pageSource, /\.home-screen-greeting\s*\{[^}]*color:\s*var\(--home-light-foreground\)/);
  assert.match(pageSource, /\.home-data-card,\s*\.home-panel\s*\{[^}]*background:\s*var\(--home-dark-card\)[^}]*color:\s*var\(--home-dark-foreground\)/);
  assert.match(visualTheme, /body\.app-shell #app :is\(article, \[class~="card"\], \[class\*="-card"\]/);
});

test('app screens do not load or rotate decorative background images', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(pageSource, /data-home-background|data-app-screen-background|home-backgrounds\/|app-backgrounds\//);
  assert.doesNotMatch(pageSource, /app-background-emblem|setupHomeBackground|setupAppScreenBackground/);
});

test('home summary metrics are compact full-width cards', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const metricGrid = pageSource.match(/\.home-metric-grid\s*\{([^}]*)\}/)?.[1];
  const metricCard = pageSource.match(/\.home-data-card\s*\{([^}]*)\}/)?.[1];
  const launchpad = pageSource.match(/renderLaunchpad\(\)\s*\{[\s\S]*?return `([\s\S]*?)`;\s*\n\s*\},/)?.[1];
  assert.match(metricGrid || '', /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(metricCard || '', /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1\.2fr\)/);
  assert.match(metricCard || '', /border-radius:\s*12px/);
  assert.match(metricGrid || '', /margin-top:\s*clamp\(48px,\s*9vh,\s*72px\)/);
  assert.match(pageSource, /\.home-data-note\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(pageSource, /class="home-panel" aria-label="Recent orders"/);
  assert.match(pageSource, /class="home-panel home-panel-compact" aria-label="Yesterday’s sales"/);
  assert.match(pageSource, /class="home-panel home-panel-compact" aria-label="Needs attention"/);
});

test('recent orders show a short product name, payment amount and POS or Web', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /const nameCharacters = Array\.from\(itemName\);[\s\S]*?nameCharacters\.length > 12[\s\S]*?nameCharacters\.slice\(0,\s*11\)\.join\(""\)/);
  assert.match(pageSource, /const channelLabel = \/web\|online\/i\.test\(String\(sale\.channel \|\| ""\)\) \? "Web" : "POS"/);
  assert.match(pageSource, /<strong>\$\{AppUtils\.escapeHTML\(itemLabel\)\}<\/strong>[\s\S]*?<small>\$\{channelLabel\}<\/small>[\s\S]*?<strong>\$\{AppUtils\.escapeHTML\(money\(sale\.total\)\)\}<\/strong>[\s\S]*?<small>Payment<\/small>/);
  assert.doesNotMatch(pageSource, /sale\.reference \|\| "Sale"|dateLabel|Recorded sales in|yesterdayTotal/);
  assert.match(pageSource, /Yesterday<\/span><h2>\$\{yesterdaySales\.length\} sale/);
});

test('mobile Studio notifications sit above the fixed bottom navigation', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /@media \(max-width: 680px\)\s*\{\s*body\.app-shell \.toast-container\s*\{[^}]*bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom,\s*0px\)\)[^}]*z-index:\s*1101/);
  assert.match(pageSource, /body\.app-shell \.toast\s*\{[^}]*width:\s*min\(100%,\s*560px\)/);
});

test('website currency control is native-app-only in Payments, not in the website editor', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const storeEditor = pageSource.match(/renderWebsiteStoreEditor\(\) \{([\s\S]*?)\n  \},\n\n  renderProductsManager/)?.[1];
  const payments = pageSource.match(/if \(path === "\/account\/payments"\) \{([\s\S]*?)\n    \}\n    if \(path === "\/store\/orders"/)?.[1];
  const currencyBinder = pageSource.match(/const websiteCurrencyForm = container\.querySelector\("\[data-app-website-currency\]"\);([\s\S]*?)\n    const branchesUrl/)?.[1];
  assert.ok(storeEditor, 'Website store details editor should have a bounded renderer.');
  assert.ok(payments, 'App Payments should have a bounded renderer.');
  assert.ok(currencyBinder, 'App currency settings should have a bounded save handler.');
  assert.doesNotMatch(storeEditor, /currency|Store details and website currency/);
  assert.match(payments, /window\.Capacitor\?\.isNativePlatform\?\.\(\) === true/);
  assert.match(payments, /data-app-website-currency/);
  assert.match(payments, /Website currency/);
  assert.match(currencyBinder, /window\.Capacitor\?\.isNativePlatform\?\.\(\) === true/);
  assert.match(currencyBinder, /SQLiteEngine\.updateStore\(\{ currency, currency_symbol: currencySymbol \}\)/);
  assert.match(currencyBinder, /AppController\.cacheActiveTenantCatalog\(\)[\s\S]*?window\.ShopSQLite\.flush\(\)/);
  assert.match(currencyBinder, /Product prices were not converted; publish the catalog to update the live site/);
  assert.doesNotMatch(pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1] || "", /Store details and website currency|>Store settings</);
  assert.match(pageSource, /currency: "KES",\s*currency_symbol: "KSh"/);
});

test('app shell keeps readable text on white surfaces while preserving accent button contrast', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const themeSettingsStart = pageSource.indexOf('  applyThemeSettings(appearance = this.getStudioAppearance()) {');
  const themeSettingsEnd = pageSource.indexOf('  setAppShellTheme(', themeSettingsStart);
  const themeSettings = themeSettingsStart >= 0 && themeSettingsEnd > themeSettingsStart
    ? pageSource.slice(themeSettingsStart, themeSettingsEnd)
    : null;
  assert.ok(themeSettings, 'App shell theme settings should have a bounded method scope.');
  assert.match(themeSettings, /const foreground = "#18181B";/);
  assert.match(themeSettings, /const accentForeground = isWhiteAccent \|\| !isDarkAccent \? "#18181B" : "#FFFFFF";/);
  assert.match(themeSettings, /setProperty\("--accent-contrast", accentForeground\)/);
  assert.match(themeSettings, /setProperty\("--text-muted", "#66666B"\)/);
  assert.match(themeSettings, /setProperty\("--text-dim", "#8A8A90"\)/);
});

test('home navigation drawer links directly to My Shops outside builder preview', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const mobileDrawer = pageSource.match(/<!-- Mobile Navigation Drawer -->([\s\S]*?)<\/div>\s*`/);
  assert.ok(mobileDrawer, 'Home navigation should include a mobile drawer.');
  assert.match(mobileDrawer[1], /href="\/account\/tenants" class="mobile-nav-link" data-route="\/account\/tenants">My shops<\/a>/);
  assert.match(mobileDrawer[1], /\$\{options\.builderPreview \? "" : `[\s\S]*?href="\/account\/tenants"/);
});

test('storefront checkout clearly continues to Paystack after submitting an order', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const checkout = pageSource.match(/renderCheckout\(\) \{([\s\S]*?)\n  \},\n\n  renderOrderConfirmation/)?.[1];
  assert.ok(checkout, 'Storefront checkout should have a bounded renderer.');
  assert.match(checkout, /Submit your order to continue to Paystack’s secure payment page/);
  assert.match(checkout, /Place Order &amp; Continue to Paystack/);
  assert.doesNotMatch(checkout, /Place Unpaid Order/);
  assert.match(pageSource, /const payment = await window\.EshopInventoryBridge\.initializeStorefrontPayment\(tenantId, serverOrder\.order_number\);[\s\S]*?window\.location\.assign\(payment\.authorization_url\)/);
});

test('app catalog caching and publishing read hold duration from the workspace settings renderer', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const catalogCache = pageSource.match(/cacheActiveTenantCatalog\(\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  setActiveTenantCatalog/)?.[1];
  const publishStore = pageSource.match(/const publishStore = \{([\s\S]*?)\r?\n        \};/)?.[1];
  assert.ok(catalogCache, 'The active tenant catalog cache should have a bounded method.');
  assert.ok(publishStore, 'Published store settings should have a bounded object.');
  assert.match(catalogCache, /StudioRenderers\.getWorkspaceSetting\("max_hold_hours", 24\)/);
  assert.doesNotMatch(catalogCache, /this\.getWorkspaceSetting/);
  assert.match(publishStore, /StudioRenderers\.getWorkspaceSetting\("max_hold_hours", 24\)/);
  assert.doesNotMatch(publishStore, /this\.getWorkspaceSetting/);
});

test('storefront hold eligibility can be updated for all or selected products at once', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const helper = pageSource.match(/setWebsiteProductHoldState\(productIds, enabled\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  setActiveTenantCatalog/)?.[1];
  assert.ok(helper, 'The shared product hold updater should have a bounded method.');
  assert.match(pageSource, /data-store-holds-all="enable"/);
  assert.match(pageSource, /data-store-holds-all="disable"/);
  assert.match(pageSource, /data-bulk-product-holds="enable"/);
  assert.match(pageSource, /data-bulk-product-holds="disable"/);
  assert.match(pageSource, /AppController\.setWebsiteProductHoldState\(selectedIds, enabled\)/);
  assert.match(pageSource, /AppController\.setWebsiteProductHoldState\(productIds, enabled\)/);

  const products = [
    { id: 1, status: 'active', stock: 12, booking_enabled: false },
    { id: 2, status: 'active', stock: 4, booking_enabled: false },
    { id: 3, status: 'archived', stock: 0, booking_enabled: false }
  ];
  const SQLiteEngine = {
    update(tableName, predicate, update) {
      assert.equal(tableName, 'products');
      let updated = 0;
      products.forEach((product, index) => {
        if (predicate(product)) {
          products[index] = update(product);
          updated += 1;
        }
      });
      return updated;
    }
  };
  const controller = new Function(
    'SQLiteEngine',
    `return ({setWebsiteProductHoldState(productIds, enabled) {${helper}}, cacheActiveTenantCatalog() { this.cacheCalls = (this.cacheCalls || 0) + 1; }})`
  )(SQLiteEngine);

  assert.equal(controller.setWebsiteProductHoldState([1, 2, 3], true), 2);
  assert.equal(products[0].booking_enabled, true);
  assert.equal(products[1].booking_enabled, true);
  assert.equal(products[2].booking_enabled, false);
  assert.equal(products[0].stock, 12);
  assert.equal(controller.setWebsiteProductHoldState([2], false), 1);
  assert.equal(products[0].booking_enabled, true);
  assert.equal(products[1].booking_enabled, false);
  assert.equal(controller.cacheCalls, 2);
});

test('POS persists products, manual payments, invoices and business instances in SQLite', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });

  const db = new SQL.Database();
  const handlers = {};
  const root = { innerHTML: '' };
  const toast = {
    textContent: '',
    classList: { add() {}, remove() {}, toggle() {} }
  };
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldFormData = globalThis.FormData;
  const oldConfirm = globalThis.confirm;
  const oldPrompt = globalThis.prompt;
  const oldCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let promptValue = null;
  const runSql = (statement, values = []) => {
    db.run(statement, values);
    const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0;
    return { changes: { changes: db.getRowsModified(), lastId } };
  };
  const queryRows = (statement, values = []) => {
    const query = db.prepare(statement);
    query.bind(values);
    const result = [];
    while (query.step()) result.push(query.getAsObject());
    query.free();
    return result;
  };
  globalThis.window = {
    location: { hash: '#/pos' },
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); },
    setInterval() { return 1; },
    ShopSQLite: {
      async query(statement, values = []) {
        const query = db.prepare(statement);
        query.bind(values);
        const result = [];
        while (query.step()) result.push(query.getAsObject());
        query.free();
        return { values: result };
      },
      async run(statement, values = []) { return runSql(statement, values); },
      async execute(statement) { db.exec(statement); },
      async executeSet(statements) {
        db.run('BEGIN');
        try {
          for (const item of statements) runSql(item.statement, item.values);
          db.run('COMMIT');
          return { changes: { changes: db.getRowsModified() } };
        } catch (error) {
          db.run('ROLLBACK');
          throw error;
        }
      }
    }
  };
  globalThis.document = {
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); },
    getElementById(id) { return id === 'app' ? root : id === 'pos-toast' ? toast : null; },
    createElement() { return { className: '', classList: { add() {}, remove() {}, toggle() {} } }; },
    body: { appendChild() {} }
  };
  globalThis.FormData = class {
    constructor(form) { this.values = form.values; }
    entries() { return Object.entries(this.values); }
  };
  globalThis.confirm = () => true;
  globalThis.prompt = () => promptValue;

  try {
    db.run(`CREATE TABLE pos_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      buying_price_cents INTEGER,
      stock_count INTEGER DEFAULT 0,
      sku TEXT,
      image_uri TEXT,
      low_stock_threshold INTEGER NOT NULL DEFAULT 3,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`);
    db.run(`INSERT INTO pos_products
      (id,name,category_id,price_cents,sku,stock_count,created_at)
      VALUES (1,'Legacy item',1,250,'LEGACY-1',5,'2024-01-01T00:00:00.000Z')`);
    const app = createPosApp();
    await app.init();
    assert.equal(queryRows('SELECT name,sku,barcode FROM pos_products WHERE id=1')[0].name, 'Legacy item');
    assert.equal(queryRows('SELECT name,sku,barcode FROM pos_products WHERE id=1')[0].sku, 'LEGACY-1');
    assert.equal(queryRows('SELECT name,sku,barcode FROM pos_products WHERE id=1')[0].barcode, null);
    assert.equal(queryRows('SELECT expiry_date FROM pos_products WHERE id=1')[0].expiry_date, null);
    assert.equal(queryRows('SELECT hex(image_embedding) AS embedding FROM pos_products WHERE id=1')[0].embedding, '');
    const savedEmbedding = '7f00'.repeat(64);
    const sneakerAttributes = [{
      attributeId: 'gid://shopify/TaxonomyAttribute/3269',
      attributeName: 'Sneaker style',
      valueId: 'gid://shopify/TaxonomyValue/25020',
      value: 'High-top'
    }];
    const photoProductId = await app.saveProduct({
      name: 'Photo sample', categoryId: 1, price: 1.25, sku: 'PHOTO-1', barcode: '',
      expiryDate: '', stock: '', buyingPrice: '', lowStockThreshold: 3, active: true,
      imageUri: 'data:image/jpeg;base64,AA==', imageEmbeddingHex: savedEmbedding,
      taxonomyCategoryId: 'gid://shopify/TaxonomyCategory/aa-8-8',
      taxonomyAttributes: sneakerAttributes
    });
    assert.equal(queryRows('SELECT hex(image_embedding) AS embedding FROM pos_products WHERE id=?', [photoProductId])[0].embedding, savedEmbedding.toUpperCase());
    const savedProduct = (await app.listProducts()).find((product) => product.id === photoProductId);
    assert.equal(savedProduct.imageEmbedding[0], 127);
    assert.equal(savedProduct.taxonomyCategoryId, 'gid://shopify/TaxonomyCategory/aa-8-8');
    assert.deepEqual(savedProduct.taxonomyAttributes, sneakerAttributes);
    await app.saveProduct({
      id: photoProductId, name: 'Photo sample', categoryId: 1, price: 1.25, sku: 'PHOTO-1',
      barcode: '', expiryDate: '', stock: '', buyingPrice: '', lowStockThreshold: 3, active: true,
      imageUri: 'data:image/jpeg;base64,AA==', taxonomyCategoryId: '',
      taxonomyCustomCategory: 'Handmade footwear', taxonomyAttributes: []
    });
    const savedCustomProduct = (await app.listProducts()).find((product) => product.id === photoProductId);
    assert.equal(savedCustomProduct.taxonomyCategoryId, '');
    assert.equal(savedCustomProduct.taxonomyCustomCategory, 'Handmade footwear');
    assert.deepEqual(savedCustomProduct.taxonomyAttributes, []);
    await runSql('DELETE FROM pos_products WHERE id=?', [photoProductId]);
    runSql('DELETE FROM pos_products WHERE id=1');
    runSql("DELETE FROM sqlite_sequence WHERE name='pos_products'");
    await app.refresh();
    const storeMarkup = app.render('/pos');
    assert.match(storeMarkup, /class="pos-bottom-nav"/);
    assert.equal((storeMarkup.match(/class="pos-tab /g) || []).length, 5);
    assert.match(storeMarkup, /class="pos-nav-icon" aria-hidden="true">＋<\/span><span>Sell<\/span>/);
    assert.match(storeMarkup, /class="pos-nav-icon" aria-hidden="true">▦<\/span><span>Catalogue<\/span>/);
    assert.match(storeMarkup, /class="pos-nav-icon" aria-hidden="true">▤<\/span><span>Orders<\/span>/);
    assert.doesNotMatch(storeMarkup, /Open app account|>Account<\/a>/);
    assert.match(storeMarkup, /aria-label="POS screens menu"[\s\S]*?href="\/account\/profile\/webs"[\s\S]*?href="\/account\/profile\/accounts"[\s\S]*?href="\/account\/profile\/privacy"/);
    const inventoryMarkup = app.render('/pos/inventory');
    assert.match(inventoryMarkup, /class="[^"]*pos-main pos-main-with-tabs"[\s\S]*?class="pos-brand[^"]*"[\s\S]*?<span>Inventory<\/span>[\s\S]*?<details class="workspace-menu pos-section-menu"[\s\S]*?aria-label="Catalogue screens menu"[\s\S]*?class="workspace-sidebar-link is-active" aria-current="page">Inventory<\/a>[\s\S]*?<\/details>[\s\S]*?<section class="pos-content"/);
    assert.doesNotMatch(inventoryMarkup, /<span>POS<\/span>/);
    assert.doesNotMatch(inventoryMarkup, /Open checkout|Open app account|>Account<\/a>/);
    assert.match(inventoryMarkup, /Export inventory/);
    assert.match(inventoryMarkup, /Restore backup/);
    assert.match(inventoryMarkup, /Import CSV/);
    assert.match(inventoryMarkup, /Reorder at/);
    assert.match(inventoryMarkup, /Scan barcode \(optional\)/);
    assert.match(inventoryMarkup, /Scan product label/);
    assert.match(inventoryMarkup, /Expiry date · optional/);
    assert.match(inventoryMarkup, /A separate SKU is assigned automatically/);
    assert.match(inventoryMarkup, /data-product-barcode-status/);
    assert.match(inventoryMarkup, /Suggest category from photo/);
    assert.match(inventoryMarkup, /data-image-category-suggestions/);
    assert.match(inventoryMarkup, /Take product photo/);
    assert.match(inventoryMarkup, /data-product-image-preview/);
    assert.doesNotMatch(inventoryMarkup, /SKU · same as website product/);
    const settingsMarkup = app.render('/pos/settings');
    assert.match(settingsMarkup, /Bluetooth \/ USB barcode scanner[\s\S]*?device’s Bluetooth settings[\s\S]*?data-pos-barcode-input/);
    assert.match(settingsMarkup, /Nearby device sync/);
    assert.match(settingsMarkup, /data-nearby-sync-status/);
    assert.match(settingsMarkup, /phone scans this register’s QR once/);
    assert.match(settingsMarkup, /encrypted POS transfer goes directly over the same Wi-Fi/);
    assert.match(settingsMarkup, /Create pairing QR/);
    assert.match(settingsMarkup, /Scan pairing QR/);
    assert.match(settingsMarkup, /same Wi-Fi/);
    for (const route of ['/pos', '/pos/overview', '/pos/catalogue/inventory', '/pos/orders', '/pos/more']) {
      assert.match(storeMarkup, new RegExp(`href="${route}" data-route="${route}"`));
    }
    assert.doesNotMatch(storeMarkup, /class="pos-tabs"/);
    assert.match(storeMarkup, /placeholder="Search products"/);
    assert.doesNotMatch(storeMarkup, /data-pos-barcode-input|Bluetooth \/ USB scanner/);
    assert.match(storeMarkup, /Scan with camera/);
    assert.match(storeMarkup, />All</);
    assert.doesNotMatch(storeMarkup, />Filter</);
    const overviewMarkup = app.render('/pos/overview');
    assert.match(overviewMarkup, /href="\/" data-route="\/" data-home-screen class="pos-brand pos-brand-back pos-brand-overview" aria-label="Back to Craft home"[^>]*>[\s\S]*?<svg viewBox="0 0 24 24"[\s\S]*?<span>Overview<\/span>/);
    assert.doesNotMatch(overviewMarkup, /<span>POS<\/span>/);
    assert.doesNotMatch(overviewMarkup, /<h2>Overview<\/h2>/);
    assert.match(overviewMarkup, /class="pos-overview-controls"/);
    assert.match(overviewMarkup, /aria-label="Overview sections menu"[\s\S]*?class="workspace-sidebar-link is-active" aria-current="page">Summary<\/a>/);
    assert.doesNotMatch(overviewMarkup, /Business overview|Manage expenses|Store performance/);
    assert.match(overviewMarkup, /class="pos-overview-card"[^>]*aria-label="Business totals"/);
    assert.match(overviewMarkup, /<small>Net sales<\/small>/);
    assert.match(overviewMarkup, /<small>Profit<\/small>/);
    assert.match(overviewMarkup, /<small>Operating profit<\/small>/);
    assert.match(overviewMarkup, /<small>Credit<\/small>/);
    assert.equal((overviewMarkup.match(/class="pos-overview-metric"/g) || []).length, 5);
    assert.match(overviewMarkup, /class="pos-card pos-revenue-card"/);
    assert.match(app.render('/pos'), /<span>Sell<\/span>/);
    const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    for (const [index, script] of [...pageSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()) {
      if (/\bsrc\s*=/.test(script[1])) continue;
      assert.doesNotThrow(() => new Script(script[2], { filename: `index.html:inline-script-${index + 1}` }));
    }
    const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
    assert.match(posSource, /decodeFromVideoElement\(video/);
    assert.match(posSource, /getUserMedia\(\{[\s\S]*?facingMode: \{ ideal: 'environment' \}/);
    assert.match(posSource, /Added \$\{result\.name\}\. Scan the next item\./);
    assert.match(posSource, /data-scanner-mode="barcode"[\s\S]*?data-scanner-mode="label"/);
    assert.match(posSource, /data-scanner-mode="match"[\s\S]*?Matching starts automatically/);
    assert.doesNotMatch(posSource, /data-scanner-find-matches|Find photo matches/);
    assert.match(posSource, /async function scanPhotoMatchFrames\(session, video, overlay, status\)[\s\S]*?captureVideoFrameForVision\(video, 256\)[\s\S]*?rankImageMatches\(products, embedding\)[\s\S]*?Tap the correct product to add it/);
    assert.match(posSource, /Date\.now\(\) - lastProcessedAt < 550/);
    assert.match(posSource, /No saved product photos yet/);
    assert.match(posSource, /async function captureProductPhoto\(\)[\s\S]*?navigator\.mediaDevices\.getUserMedia[\s\S]*?capture\.disabled = false/);
    assert.match(posSource, /action === 'take-product-photo'[\s\S]*?captureProductPhoto\(\)[\s\S]*?Photo capture cancelled/);
    assert.match(posSource, /async function createProductImageEmbedding\(productId, imageUri\)[\s\S]*?await saveProduct\(\{ \.\.\.product, imageEmbeddingHex \}\)/);
    assert.match(posSource, /async function getProductVision\(\)[\s\S]*?return \{ plugin: ProductVision \}/);
    assert.match(posSource, /const products = state\.products\.filter\(\(product\) => product\.active\);[\s\S]*?rankImageMatches\(products, embedding\)/);
    assert.match(posSource, /async function saveProduct\(data\)[\s\S]*?image_embedding/);
    assert.match(posSource, /const \{ imageEmbedding, imageEmbeddingHex, \.\.\.syncProduct \} = product/);
    assert.match(posSource, /async function scanLabelFrames\([\s\S]*?TextRecognition\.processImage\(\{ path: framePath, script: Script\.Latin \}\)/);
    assert.match(posSource, /data-label-confirm/);
    assert.match(posSource, /if \(result\?\.captured \|\| result\?\.closeScanner\) await session\.close\(\)/);
    assert.match(posSource, /if \(barcode\.format === 'QR_CODE'\) \{[\s\S]*?if \(!productForm\) \{[\s\S]*?showQrDetails\(value\);[\s\S]*?const result = await onBarcode\(value\);[\s\S]*?if \(result\?\.captured \|\| result\?\.closeScanner\) await session\.close\(\)/);
    assert.match(posSource, /Barcode \$\{code\} captured successfully\. Complete the product details and save\./);
    assert.match(posSource, /return \{ captured: true \};[\s\S]*?return false;/);
    assert.match(posSource, /Product name filled from the label\. Enter the remaining details below\./);
    assert.match(posSource, /productForm\.elements\.name\.value = name;[\s\S]*?await session\.close\(\)/);
    const labelProductResult = posSource.match(/result\.innerHTML = productForm\s*\?([\s\S]*?)\n\s*: `/)?.[1];
    assert.ok(labelProductResult, 'Product label scanning should show a distinct name-only confirmation.');
    assert.match(labelProductResult, /Product name found[\s\S]*?Use details/);
    assert.doesNotMatch(labelProductResult, /data-label-price|data-label-expiry/);
    assert.match(posSource, /data-pos-form="product" novalidate/);
    assert.match(posSource, /field\('Selling price', 'price'.*required: true/);
    assert.match(posSource, /Enter a selling price before adding this product/);
    assert.match(posSource, /Product saved\.[\s\S]*?createProductImageEmbedding\(productId, imageUri\)/);
    const labelScannerSource = posSource.match(/async function scanLabelFrames\([\s\S]*?function showLabelSuggestions/)?.[0];
    assert.ok(labelScannerSource, 'Product-label OCR must have a dedicated scan handler.');
    assert.match(labelScannerSource, /if \(!productForm\) savedProducts = \(await listProducts\(\)\)\.filter\(\(product\) => product\.active\)/);
    assert.match(labelScannerSource, /matchProductLabel\(text, savedProducts\)[\s\S]*?addProductToSale\(product, true\)/);
    assert.match(posSource, /async function addProductToSale\(product, closeScanner = false\)[\s\S]*?if \(closeScanner\) await barcodeScanner\?\.close\(\);[\s\S]*?await refresh\(\)/);
    assert.match(labelScannerSource, /No saved product matched this label[\s\S]*?Nothing was added to the sale/);
    assert.doesNotMatch(labelScannerSource, /saveProduct\(/);
    assert.match(labelScannerSource, /Date\.now\(\) - lastProcessedAt < 700/);
    assert.match(posSource, /action === 'scan-product-label'[\s\S]*?openBarcodeScanner\(async \(\) => null, \{\s*allowProductLabel: true, productForm: form, initialMode: 'label'/);
    assert.match(posSource, /action === 'scan-sale-barcode'[\s\S]*?openBarcodeScanner\(addScannedBarcode, \{ allowProductLabel: true \}\)/);
    assert.doesNotMatch(posSource, /scan-label-from-scanner|startLabelScanOnNextRender/);
    assert.match(posSource, /new RTCPeerConnection\(\{ iceServers: \[\] \}\)/);
    assert.match(posSource, /createDataChannel\('eshop-pos-sync'/);
    assert.match(posSource, /snapshot-start/);
    const bootstrapSource = await readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8');
    const sqliteSource = await readFile(new URL('../src/sqlite.js', import.meta.url), 'utf8');
    const cloudflareWorkerSource = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
    const webManifest = await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
    const androidManifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
    const androidBackupRules = await readFile(new URL('../android/app/src/main/res/xml/backup_rules.xml', import.meta.url), 'utf8');
    const androidDataExtractionRules = await readFile(new URL('../android/app/src/main/res/xml/data_extraction_rules.xml', import.meta.url), 'utf8');
    assert.match(pageSource, /btn-publish-cloudflare/);
    assert.match(pageSource, /ESHOP_CLOUDFLARE_PUBLISH_URL_V1/);
    assert.match(pageSource, /href="\/account\/tenants"[^>]*data-route="\/account\/tenants"/);
    assert.match(pageSource, /path === "\/account\/tenants"/);
    assert.match(pageSource, /renderTenantsManager\(\)/);
    assert.match(pageSource, /renderAppAccount\(\)[\s\S]*?Craft app account[\s\S]*?id="app-account-form"[\s\S]*?Cloudflare human verification/);
    const launchpad = pageSource.match(/renderLaunchpad\(\)\s*\{[\s\S]*?return `([\s\S]*?)`;\s*\n\s*\},/)?.[1];
    assert.ok(launchpad, 'The app should render a dedicated Home screen.');
    const homeRoutes = [...launchpad.matchAll(/class="home-workspace-card home-workspace-card-(?:main|craft)" href="([^"]+)" data-route=/g)].map(([, route]) => route);
    assert.deepEqual(homeRoutes, ['/account/main-shop', '/account/web']);
    assert.doesNotMatch(launchpad, /home-screen-logo|<img[^>]+eshop-logo/);
    assert.match(launchpad, /<p class="home-screen-greeting">Hi, \$\{AppUtils\.escapeHTML\(username\)\} <span aria-hidden="true">👋<\/span><\/p>/);
    assert.match(pageSource, /renderLaunchpad\(\)\s*\{[\s\S]*?ESHOP_ACCOUNT_SESSION_V1[\s\S]*?ESHOP_ACCOUNT_USERNAME_V1/);
    assert.match(pageSource, /\.home-screen-greeting\s*\{[^}]*color:\s*var\(--home-light-foreground\)/);
    assert.match(launchpad, /class="home-screen-profile" href="\/app-account" data-route="\/app-account" aria-label="Account"/);
    assert.match(launchpad, /class="home-pos-card" href="\/pos" data-route="\/pos" aria-label="Open POS"/);
    assert.match(launchpad, /class="home-launcher-group" role="group" aria-label="POS and workspaces"[\s\S]*class="home-pos-card"[\s\S]*class="home-workspace-grid" aria-label="Choose a workspace"[\s\S]*Main Store[\s\S]*Craft/);
    assert.match(launchpad, /data-home-dashboard aria-label="Store overview" aria-live="polite"/);
    assert.match(launchpad, /data-home-dashboard aria-label="Store overview" aria-live="polite" aria-busy="true"[\s\S]*?home-dashboard-skeleton[\s\S]*?home-skeleton-line/);
    assert.match(pageSource, /async loadHomeDashboard\(\)[\s\S]*?StudioRenderers\.getMainShopSnapshot\(\)[\s\S]*?Sales today[\s\S]*?Recent orders/);
    assert.match(launchpad, /class="home-shortcut-grid" aria-label="Quick actions"[\s\S]*?href="\/store\/products" data-route="\/store\/products"[\s\S]*?Products[\s\S]*?href="\/store\/inventory" data-route="\/store\/inventory"[\s\S]*?Inventory[\s\S]*?href="\/store\/orders" data-route="\/store\/orders"[\s\S]*?Orders[\s\S]*?href="\/store\/categories" data-route="\/store\/categories"[\s\S]*?Categories/);
    assert.equal((launchpad.match(/class="home-shortcut-link"/g) || []).length, 4);
    assert.match(pageSource, /if \(path === "\/"\) \{\s*void this\.loadHomeDashboard\(\);?\s*\}/);
    assert.doesNotMatch(launchpad, /Overall Revenue|Overall Profit|Overall Customers|Average Order|home-overall-metric/);
    assert.doesNotMatch(pageSource, /loadHomeOverallMetrics|home-overall-metric|home-overall-metrics/);
    assert.match(pageSource, /path === "\/account\/main-shop" \|\| path\.startsWith\("\/account\/main-shop\/"\)[\s\S]*?renderMainShopWorkspace\(path\)/);
    const workspaceStart = pageSource.indexOf("  renderMainShopWorkspace(path) {");
    const workspaceEnd = pageSource.indexOf("\n  renderWebsiteManagementCards(", workspaceStart);
    assert.ok(workspaceStart >= 0 && workspaceEnd > workspaceStart, "Main Store should have a bounded workspace renderer.");
    const workspace = pageSource.slice(workspaceStart, workspaceEnd);
    const bottomItemsStart = workspace.indexOf("const bottomItems = [");
    const bottomItemsEnd = workspace.indexOf("\n    ];", bottomItemsStart);
    assert.ok(bottomItemsStart >= 0 && bottomItemsEnd > bottomItemsStart, "Main Store should define its bottom navigation.");
    const bottomItems = workspace.slice(bottomItemsStart, bottomItemsEnd);
    assert.match(bottomItems, /title: "Overview"[\s\S]*?title: "Sales"[\s\S]*?title: "Customers"[\s\S]*?title: "Store"[\s\S]*?title: "More"/);
    assert.doesNotMatch(bottomItems, /title: "Products"/);
    assert.match(workspace, /store:\s*\[\s*\{ route: "\/store\/products", title: "Web products" \}[\s\S]*?\{ route: "\/store\/categories", title: "Web categories" \}/);
    assert.match(pageSource, /data-business-filter-toggle aria-label="Show filters" aria-controls="business-date-filters" aria-expanded="false"[\s\S]*?viewBox="0 0 24 24"[\s\S]*?id="business-date-filters" class="bl-date-filter" aria-label="Business filters" hidden/);
    assert.match(pageSource, /businessFilterToggle\.addEventListener\("click"[\s\S]*?businessFilters\.hidden = !expanded/);
    assert.doesNotMatch(pageSource, /href="\/pos" class="studio-preview-link" data-route="\/pos">Open POS/);
    assert.match(pageSource, /src="\/src\/business-lens\.js"/);
    assert.match(pageSource, /data-filter="range"[\s\S]*?data-filter="channel"[\s\S]*?data-filter="category"[\s\S]*?data-filter="granularity"/);
    assert.match(pageSource, /data-business-export="transactions"/);
    assert.match(pageSource, /window\.ShopPOS\.listExpenses \? window\.ShopPOS\.listExpenses\(\)/);
    assert.match(pageSource, /window\.ShopPOS\.listInstances \? window\.ShopPOS\.listInstances\(\)/);
    assert.match(pageSource, /if \(path === "\/account" \|\| path === "\/account\/main-shop" \|\| path === "\/account\/main-shop\/" \|\| path === "\/account\/dashboard"\)[\s\S]*?Paid web revenue[\s\S]*?Customer visits[\s\S]*?Awaiting payments[\s\S]*?What’s moving/);
    assert.doesNotMatch(pageSource, /studio-hamburger/);
    assert.match(pageSource, /\.workspace-sidebar\s*\{[^}]*position:\s*fixed[^}]*right:\s*0[^}]*bottom:\s*0[^}]*width:\s*min\(86vw,\s*360px\)/);
    assert.doesNotMatch(pageSource, /class="studio-workspace-top-nav"|class="studio-nested-nav"/);
    assert.match(pageSource, /renderWorkspaceSidebar\(title, items, activeRoute\)[\s\S]*?workspace-sidebar-links[\s\S]*?aria-current="page"/);
    assert.match(pageSource, /renderWorkspaceLoading\(label\)[\s\S]*?studio-metric-grid[\s\S]*?studio-data-card[\s\S]*?studio-panel workspace-skeleton-panel/);
    assert.match(pageSource, /\.business-lens-shell \.studio-workspace-heading\s*\{[^}]*align-items:\s*center/);
    assert.doesNotMatch(pageSource.match(/\.business-lens-shell \.studio-workspace-heading\s*\{([^}]*)\}/)?.[1] || "", /position:\s*sticky/);
    assert.match(pageSource, /\.business-lens-shell \.workspace-menu summary\s*\{[^}]*width:\s*38px/);
    assert.match(pageSource, /\.pos-tab\.is-active\s*\{[^}]*background:\s*transparent/);
    assert.doesNotMatch(pageSource, /pos-screen-enter|@keyframes pos-screen-enter/);
    assert.match(pageSource, /label: "Webs"[\s\S]*?profile-sidebar-link/);
    assert.match(pageSource, /if \(isDrawer\)[\s\S]*?profile-sidebar/);
    assert.match(pageSource, /if \(path === "\/store\/products"\)[\s\S]*?Add from Store[\s\S]*?Add web product[\s\S]*?webProducts\.map/);
    assert.match(pageSource, /if \(path === "\/store\/inventory"\)[\s\S]*?Website stock is managed independently[\s\S]*?webProducts\.map/);
    assert.match(pageSource, /getMainShopSnapshot\(\)[\s\S]*?window\.ShopPOS\.listProducts\(\)[\s\S]*?window\.ShopPOS\.listCategories\(\)[\s\S]*?window\.ShopPOS\.listSales\(\)[\s\S]*?SQLiteEngine\.select\("orders"\)/);
    assert.doesNotMatch(pageSource, /path === "\/store\/website"|Deploy storefront to web/, 'The unreachable /store/website screen was removed.');
    assert.match(pageSource, /generateProductSku\(\)[\s\S]*?ESHOP-\$\{Array\.from\(bytes/);
    assert.doesNotMatch(pageSource, /name="sku" value="\$\{AppUtils\.escapeHTML\(product \? product\.sku : `ESHOP-\$\{Date\.now\(\)\}`\)\}"/);
    assert.match(pageSource, /\.home-screen-main\s*\{[^}]*width:\s*100%[^}]*max-width:\s*860px/);
    assert.match(pageSource, /\.home-launcher-group\s*\{[^}]*gap:\s*12px[^}]*justify-content:\s*flex-start[^}]*padding:\s*12px[^}]*border-radius:\s*12px/);
    assert.match(pageSource, /\.home-launcher-group\s*\{[^}]*background:\s*linear-gradient\(145deg,\s*#f7f8f9,\s*#c4c9cf\)/);
    assert.match(pageSource, /\.home-pos-card\s*\{[^}]*grid-template-columns:\s*42px minmax\(0,\s*1fr\) 24px[^}]*min-height:\s*90px/);
    assert.match(pageSource, /\.home-workspace-card\s*\{[^}]*min-height:\s*136px/);
    assert.match(pageSource, /\.home-workspace-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(pageSource, /@media \(max-width: 600px\)\s*\{\s*\.home-launcher-group\s*\{[^}]*width:\s*calc\(100% \+ var\(--home-horizontal-gutter\) \+ var\(--home-horizontal-gutter\)\)[^}]*margin-left:\s*calc\(0px - var\(--home-horizontal-gutter\)\)[^}]*margin-bottom:\s*-46px[^}]*padding-bottom:\s*clamp\(24px,\s*3\.5vh,\s*30px\)[^}]*border-right:\s*1px solid #bfc4ca[^}]*border-left:\s*1px solid #bfc4ca[^}]*border-radius:\s*12px/);
    assert.match(pageSource, /\.home-metric-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.doesNotMatch(pageSource, /\.home-screen-header\s*\{[^}]*border-bottom:/);
    assert.doesNotMatch(launchpad, /home-bento-card|home-credit-card|home-cube/);
    assert.doesNotMatch(launchpad, /Where would you like to go|Manage your online shop/);
    assert.match(pageSource, /renderLaunchpad\(\)\s*\{\s*document\.title = "Home — Craft"/);
    assert.match(webManifest, /"name":"Craft","short_name":"Craft"/);
    assert.match(webManifest, /"src":"\/favicon-512\.png"/);
    assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
    assert.match(pageSource, /path === "\/app-account"[\s\S]*?renderAppAccount\(\)/);
    assert.match(pageSource, /appAccountForm\.onsubmit = async event =>[\s\S]*?\/api\/auth\/\$\{registering \? "register" : "login"\}[\s\S]*?ESHOP_ACCOUNT_SESSION_V1[\s\S]*?restoreAccountWebsites\(result\.tenants, origin\)/);
    assert.match(pageSource, /name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example\.com"/);
    assert.match(pageSource, /id="app-account-recovery-email-form"[\s\S]*?\/api\/auth\/set-recovery-email[\s\S]*?ESHOP_ACCOUNT_EMAIL_V1/);
    assert.match(pageSource, /id="app-account-forgot-password"[\s\S]*?\/api\/auth\/request-reset-code[\s\S]*?\/api\/auth\/verify-reset-code[\s\S]*?\/api\/auth\/reset-password/);
    assert.match(pageSource, /#app-account-confirm-field\[hidden\],[\s\S]*?#app-account-turnstile\[hidden\]\s*\{\s*display:\s*none !important/);
    assert.doesNotMatch(pageSource, /app-account-verification-checkbox|Start Cloudflare verification/);
    assert.match(pageSource, /const updateTurnstileVisibility = \(\) => \{[\s\S]*?passwordField\.value === confirmField\.value[\s\S]*?turnstileContainer\.hidden = false;\s*void configureTurnstile\(\);/);
    assert.match(pageSource, /sitekey: config\.turnstile_site_key,\s*appearance:\s*"always",\s*callback\(token\) \{\s*turnstileToken = token;[\s\S]*?appAccountForm\.requestSubmit\(submitButton\)/);
    assert.match(pageSource, /const setAuthMode = mode => \{[\s\S]*?accountError\.hidden = true;\s*accountError\.textContent = "";/);
    assert.match(pageSource, /turnstileContainer\.hidden = !registering \|\| !turnstileRequested/);
    assert.match(pageSource, /if \(registering && !turnstileToken\) \{[\s\S]*?Complete the Cloudflare checkbox to create your account\./);
    assert.doesNotMatch(pageSource, /Tap Create app account to finish/);
    assert.match(pageSource, /appAccountForm\.querySelectorAll\("\[data-app-auth-mode\]"\)\.forEach\(button => \{\s*button\.onclick = \(\) => \{\s*const registering = button\.dataset\.appAuthMode === "register";\s*setAuthMode\(button\.dataset\.appAuthMode\);\s*if \(!registering\) return;\s*\};\s*\}\);/);
    assert.match(pageSource, /Your POS sales and inventory remain on this device; signing in does not upload or sync them/);
    assert.doesNotMatch(pageSource, /&larr;\s+(?:Profile menu|Your websites|Choose a design|Themes|Edit website|Studio|Build Your Web)/);
    assert.match(pageSource, /class="profile-page-back"[^>]*aria-label="Back to profile menu">&larr;<\/a>/);
    assert.doesNotMatch(posSource, /&larr;\s*Back to checkout/);
    assert.doesNotMatch(posSource, /href="\/app-account" data-route="\/app-account"/);
    assert.doesNotMatch(pageSource, /@keyframes pos-screen-enter|classList\.add\("pos-screen-enter"\)/);
    assert.match(pageSource, /\.pos-tab\.is-active\s*\{[^}]*background:\s*transparent !important/);
    assert.match(pageSource, /\.pos-tab:active\s*\{\s*background:\s*transparent/);
    assert.match(pageSource, /\.workspace-menu\[open\]\s*\{\s*z-index:\s*1202/);
    assert.match(pageSource, /\.pos-main-with-tabs \.pos-header-divider\s*\{\s*display:\s*none/);
    assert.match(pageSource, /\.pos-main-with-tabs > \.pos-content > \.pos-section-heading h2\s*\{\s*display:\s*none/);
    assert.match(pageSource, /\.pos-filter-row input\s*\{[^}]*height:\s*38px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.pos-filter-row select\s*\{[^}]*flex:\s*0 1 132px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.pos-scanner-entry \.btn-secondary\s*\{[^}]*min-height:\s*38px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.workspace-sidebar-link\.is-active,\s*\.workspace-sidebar-link:focus-visible/);
    assert.match(pageSource, /const managementSurface = activePath\.startsWith\("\/account"\) \|\| activePath === "\/app-account"[\s\S]*?\$\{managementSurface \? "" : `<div class="nav-center">[\s\S]*?href="\/bag"[\s\S]*?managementSurface \? "" :/);
    assert.match(pageSource, /Cloudflare verification failed[\s\S]*?allowed hostnames, including localhost for Android/);
    assert.match(pageSource, /\.native-app-shell \.profile-page-back,[\s\S]*?\.native-app-shell \.studio-back-link,[\s\S]*?display:\s*none !important/);
    assert.match(bootstrapSource, /Capacitor\.isNativePlatform\(\)[\s\S]*?native-app-shell[\s\S]*?backButton/);
    assert.match(bootstrapSource, /installBackButton\(\{ App, Capacitor, handler: createAppBackHandler\(\{ App \}\) \}\)/,
      'The Android back button is wired through src/back-button.js (behaviour is covered in tests/back-button.test.mjs).');
    assert.match(pageSource, /renderAccount\(\)\s*\{[\s\S]*?route: "\/account\/web"[\s\S]*?Management<\/h1>/);
    const managementModules = pageSource.match(/renderAccount\(\)\s*\{\s*const modules = \[([\s\S]*?)\n    \];/)?.[1];
    assert.ok(managementModules, "Management module ordering should be explicitly defined.");
    const moduleOrder = [...managementModules.matchAll(/title: "([^"]+)"/g)].map(([, title]) => title);
    assert.deepEqual(moduleOrder, [
      "Point of Sale",
      "Products Manager",
      "Inventory",
      "Categories",
      "Business Dashboard",
      "Build Your Web",
      "Store Settings",
      "My shops",
      "Plans & Tiering"
    ]);
    assert.match(pageSource, /studio-profile-btn[\s\S]*?aria-label="Profile"/);
    assert.match(pageSource, /profile-sidebar[\s\S]*?Privacy[\s\S]*?Updates/);
    assert.match(pageSource, /\.profile-menu-overlay\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*justify-content:\s*flex-end;[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*\.56\)/);
    assert.match(pageSource, /\.profile-sidebar\s*\{[^}]*width:\s*min\(50vw,\s*420px\);[^}]*height:\s*100dvh;[^}]*background:\s*#171717/);
    assert.match(pageSource, /renderProfileScreen\(path = "\/account\/profile"\)/);
    assert.match(pageSource, /class="profile-menu-overlay" aria-label="Profile menu"/);
    assert.match(pageSource, /class="profile-menu-backdrop" href="\/account"/);
    assert.match(pageSource, /const isDrawer = path === "\/account\/profile"/);
    assert.match(pageSource, /\{ id: "home", label: "Home", route: "\/" \}/);
    assert.match(pageSource, /\{ id: "updates", label: "Updates" \}/);
    assert.match(pageSource, /const href = section\.route \|\| `\/account\/profile\/\$\{section\.id\}`/);
    assert.match(pageSource, /class="container profile-page-container" aria-label="\$\{AppUtils\.escapeHTML\(activeLabel\)\} screen"/);
    assert.match(pageSource, /profile-page-avatar[\s\S]*?Full name[\s\S]*?profile-page-card"><h2>Store name<\/h2>/);
    assert.match(pageSource, /<h2>Store details<\/h2>[\s\S]*?store\.description[\s\S]*?store\.location[\s\S]*?store\.email[\s\S]*?store\.phone/);
    assert.match(pageSource, /<h2>Web domains<\/h2>[\s\S]*?website\.hostname/);
    assert.match(pageSource, /profile-page-websites[\s\S]*?Domain: <a[\s\S]*?Browse web[\s\S]*?data-delete-website/);
    assert.match(pageSource, /href="\/account\/profile\/webs\/\$\{encodeURIComponent\(website\.id\)\}" data-route="\/account\/profile\/webs\/\$\{encodeURIComponent\(website\.id\)\}"/);
    assert.match(pageSource, /data-manage-website="\$\{AppUtils\.escapeHTML\(website\.id\)\}">Manage this web/);
    assert.match(pageSource, /Showing inventory for[\s\S]*?activeTenant\.name[\s\S]*?Switch website/);
    assert.match(pageSource, /const manageWebsite = e\.target\.closest\("\[data-manage-website\]"\)[\s\S]*?this\.setActiveTenantCatalog\([\s\S]*?this\.navigate\("\/account\/web\/studio\/store\/products"\)/);
    assert.match(pageSource, /websiteSettingsScreen[\s\S]*?Edit store details[\s\S]*?data-edit-website[\s\S]*?Edit website design[\s\S]*?Delete web/);
    assert.match(pageSource, /const \[sectionId, \.\.\.sectionRouteParts\] = requestedSection\.split\("\/"\)/);
    assert.match(pageSource, /cloudflareRequest\(`\/api\/tenants\/\$\{encodeURIComponent\(tenantId\)\}`, \{\s*method: "DELETE"/);
    assert.match(pageSource, /ESHOP_PRIVACY_POLICY_AGREED_V1[\s\S]*?Privacy Policy[\s\S]*?id="privacy-policy-agreement" type="checkbox" \$\{privacyAgreement \? "checked" : ""\}/);
    assert.match(pageSource, /Current version[\s\S]*?1\.0\.0[\s\S]*?No recent version history is available[\s\S]*?Current version details/);
    assert.match(pageSource, /accountsScreen[\s\S]*?Delete account[\s\S]*?href="\/account\/web\/studio\/websites\/webmaker" data-start-new-website>Create a new website/);
    assert.match(pageSource, /linkedDevicesScreen[\s\S]*?Cloud POS sync[\s\S]*?Cloudflare account[\s\S]*?\/pos\/more\/settings[\s\S]*?Connect another device[\s\S]*?same shop account/);
    assert.match(posSource, /BrowserMultiFormatReader/);
    assert.match(posSource, /BrowserMultiFormatReader/);
    assert.match(posSource, /seedCatalogueSync/);
    assert.match(pageSource, /bindEvents\(\)\s*\{[\s\S]*?document\.addEventListener\("click", async \(e\) => \{[\s\S]*?const deleteWebsite = e\.target\.closest\("\[data-delete-website\]"\)[\s\S]*?await this\.cloudflareRequest/);
    assert.match(pageSource, /const href = section\.route \|\| `\/account\/profile\/\$\{section\.id\}`[\s\S]*?data-route="\$\{href\}"/);
    assert.match(pageSource, /\.profile-sidebar-logout\s*\{[^}]*margin-top:\s*auto/);
    assert.match(pageSource, /class="profile-sidebar-logout" href="\/" data-route="\/" data-home-screen aria-label="Log out"[\s\S]*?<span>Log out<\/span>/);
    assert.match(pageSource, /path === "\/account\/profile" \|\| path\.startsWith\("\/account\/profile\/"\)[\s\S]*?renderProfileScreen\(path\)/);
    assert.match(pageSource, /renderWeb\(\)\s*\{\s*return StudioRenderers\.renderMainShopWorkspace\("\/account\/web"\);/);
    assert.match(pageSource, /webStudioNavigation\(\)[\s\S]*?title: "Dashboard"[\s\S]*?title: "Store"[\s\S]*?title: "CRM"[\s\S]*?title: "Websites"[\s\S]*?title: "Payments"/);
    assert.match(pageSource, /title: "Overview"[\s\S]*?title: "Visits"[\s\S]*?title: "Traffic"[\s\S]*?title: "Performance"[\s\S]*?title: "Product intelligence"/);
    assert.match(pageSource, /title: "Products"[\s\S]*?title: "Categories"[\s\S]*?title: "Inventory"[\s\S]*?title: "Orders"[\s\S]*?title: "Bookings"/);
    assert.match(pageSource, /title: "Customers"[\s\S]*?title: "Points"[\s\S]*?title: "Subscribers"[\s\S]*?title: "Notifications"/);
    assert.doesNotMatch(pageSource, /"\/account\/website\/(?:maker|editor|pages)"|Page editor|renderPagesManager|openPageModal/,
      'The unreachable website tool and Pages screens were removed.');
    assert.match(pageSource, /aria-label="Web Studio sections"[\s\S]*?sections\.map\(section =>/);
    assert.match(pageSource, /<header class="studio-workspace-heading">[\s\S]*?class="studio-workspace-back" href="\/" data-route="\/" data-home-screen aria-label="Back to Craft home"[\s\S]*?class="studio-workspace-tab-title">\$\{AppUtils\.escapeHTML\(page\.title\)\}<\/h1>/);
    assert.doesNotMatch(pageSource, /<span class="studio-workspace-kicker">CRAFT<\/span><h1>Web Studio<\/h1>/);
    assert.match(pageSource, /path === "\/account\/web" \|\| path\.startsWith\("\/account\/web\/studio\/"\)[\s\S]*?renderMainShopWorkspace\(path\)/);
    assert.match(pageSource, /renderMainShopContent\(page\.contentPath, snapshot, true\)/);
    assert.match(pageSource, /CUSTOMER NOTIFICATIONS[\s\S]*?data-enable-notifications[\s\S]*?data-disable-notifications/);
    assert.match(pageSource, /websiteThemes\(\)[\s\S]*?preview_catalog[\s\S]*?website_themes[\s\S]*?SQLiteEngine\.save\(\)/);
    assert.doesNotMatch(pageSource, /renderWebsiteThemeChoices|NEW WEBSITE · STEP 2 OF 3/);
    assert.match(pageSource, /renderWebsiteTheme\(themeId\)[\s\S]*?const useThemeRoute = `\/account\/web\/site\?new=1&edit=1&theme=\$\{encodeURIComponent\(theme\.id\)\}`;[\s\S]*?theme\.studio_url \? "Open this theme’s Studio →" : "Use this theme →"[\s\S]*?data-theme-preview-remote="\$\{AppUtils\.escapeHTML\(previewUrl \|\| ""\)\}"[\s\S]*?data-theme-preview-direct="1"/);
    assert.match(pageSource, /activeThemePreviewLoads < 2/);
    assert.match(pageSource, /new IntersectionObserver\(entries => \{[\s\S]*?themePreviewObserver\.observe\(frame\)/);
    const themeCatalog = await readFile(new URL('../src/theme-catalog.js', import.meta.url), 'utf8');
    const themeBootstrap = await readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8');
    assert.match(themeBootstrap, /EshopWebsiteThemeCatalog = WEBSITE_THEME_CATALOG/);
    assert.match(pageSource, /data-theme-preview-remote/);
    assert.match(pageSource, /loadHostedThemePreview[\s\S]*?fillThemeForShop\(theme\.id, catalog/);
    const themePreviewSetup = pageSource.match(/const html = await loadHostedThemePreview\(frame, theme, \{[\s\S]*?\}, frame\.dataset\.themePreviewRemote\)/)?.[0];
    assert.ok(themePreviewSetup, "Theme previews should load with an isolated draft catalog.");
    assert.match(themePreviewSetup, /products: draft\.products,\s*categories: draft\.categories/);
    assert.doesNotMatch(pageSource, /Preview the full live storefront, including its products and working navigation\./);
    assert.match(sqliteSource, /'tenant_catalogs','website_themes'/);
    const accountsMigration = await readFile(new URL('../cloudflare/migrations/0004_accounts.sql', import.meta.url), 'utf8');
    assert.match(accountsMigration, /CREATE TABLE IF NOT EXISTS accounts/);
    assert.match(accountsMigration, /password_salt TEXT NOT NULL/);
    assert.match(accountsMigration, /password_hash TEXT NOT NULL/);
    assert.match(accountsMigration, /CREATE TABLE IF NOT EXISTS account_tenants/);
    assert.match(pageSource, /website_themes:\s*\[\]/);
    assert.match(pageSource, /postRenderSetup\(path, params\) \{[\s\S]*?path === "\/account\/web\/site"[\s\S]*?this\.bindWebsiteBuilderEvents\(\)/);
    assert.match(pageSource, /const sharedCatalogRefresh = document\.getElementById\("website-wizard-refresh-catalog"\);[\s\S]*?this\.websiteBuilderSourceCatalog\(\)/);
    const websiteEditor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1] || "";
    assert.match(websiteEditor, /class="builder-litrus-toolbar"[\s\S]*?id="builder-litrus-publish"[\s\S]*?id="builder-litrus-mixer" title="Shop builder" src="\/litrus-mixer\/index\.html\?craft=1"/);
    assert.match(websiteEditor, /id="new-website-form"/);
    assert.match(pageSource, /renderWebsiteStoreEditor\(\)[\s\S]*?id="website-store-form"[\s\S]*?Store name[\s\S]*?Store description/);
    assert.match(pageSource, /if \(!appAccountSession\) \{[\s\S]*?const accountRoute = `\/app-account\?continue=\$\{encodeURIComponent\(continueTo\)\}`;[\s\S]*?Open app account/);
    assert.match(pageSource, /id="new-website-form"[\s\S]*?Shop \/ website name[\s\S]*?Website address[\s\S]*?I confirm this website address and domain before publishing\.[\s\S]*?>Set up</);
    assert.doesNotMatch(pageSource.match(/if \(isNewWebsite\) \{([\s\S]*?)\n    \}\n    return `/)?.[1] || "", /data-shop-auth-mode|shop-turnstile-widget|Create account/);
    assert.match(pageSource, /path\.startsWith\("\/account\/web\/themes\/"\)/);
    assert.match(pageSource, /path === "\/account\/web\/site"/);
    assert.doesNotMatch(pageSource, /data-use-website-theme/);
    assert.match(pageSource, /data-edit-website/);
    assert.match(pageSource, /data-edit-store/);
    assert.match(pageSource, /pages: SQLiteEngine\.getPages\(\)/);
    assert.match(pageSource, /newWebsiteForm\.onsubmit = async event =>/);
    assert.match(pageSource, /Your editor draft is saved on this device\. Sign in or create your Craft app account to finish creating the website\./);
    assert.match(pageSource, /this\.cloudflareRequest\("\/api\/tenants"[\s\S]*?sessionToken/);
    assert.match(pageSource, /continueTo\.startsWith\("\/account\/web\/site\?new=1&theme="\)[\s\S]*?this\.navigate\(continueTo\)/);
    assert.match(pageSource, /preview_appearance:\s*\{\s*primary_color:\s*"#18181B"/);
    assert.match(pageSource, /primary_color:\s*"#18181B",\s*background_color:\s*"#FAFAF8",\s*text_color:\s*"#18181B"/);
    assert.match(pageSource, /api\/auth\/session[\s\S]*?Your account session expired\. Sign in again to continue; you do not need to create another account/);
    assert.match(cloudflareWorkerSource, /const verification = await verifyTurnstile\(request, env, input\.turnstile_token\)/);
    assert.match(cloudflareWorkerSource, /if \(!verification\.ok\)/);
    assert.match(pageSource, /appearance:\s*"always"[\s\S]*?window\.turnstile\.render\(widget/);
    assert.match(pageSource, /callback\(token\) \{\s*turnstileToken = token;\s*accountError\.hidden = true;[\s\S]*?if \(autoSubmitEnabled && !authSubmitting\) appAccountForm\.requestSubmit\(submitButton\)/);
    assert.match(pageSource, /This account already exists\. Sign in to keep using it—no new account is needed/);
    assert.match(pageSource, /\.store-design-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
    assert.match(pageSource, /@media \(max-width:\s*600px\)[\s\S]*?\.store-design-options\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.match(pageSource, /\.store-color-options\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
    assert.match(pageSource, /@media \(max-width:\s*600px\)[\s\S]*?\.store-color-options\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    assert.match(pageSource, /name: "White", value: "#FFFFFF"/);
    assert.match(pageSource, /name: "Home blue", value: "#244EE8"/);
    assert.match(pageSource, /name: "Sky blue", value: "#0284C7"/);
    assert.match(pageSource, /name: "Teal", value: "#0F766E"/);
    assert.match(pageSource, /name: "Violet", value: "#7C3AED"/);
    assert.match(pageSource, /name: "Coral", value: "#E85D4F"/);
    assert.match(pageSource, /type="color" id="custom-store-color"/);
    assert.match(pageSource, /customColorRadio\.value = customColorInput\.value\.toUpperCase\(\);\s*customColorRadio\.checked = true/);
    assert.match(pageSource, /<h1 class="section-heading">Settings<\/h1>/);
    assert.doesNotMatch(pageSource, /These choices style your customer-facing website, not the Craft app\./);
    assert.match(pageSource, /<h3 class="form-card-title">App appearance<\/h3>/);
    assert.match(pageSource, /<span class="form-label">App accent color<\/span>/);
    assert.match(pageSource, /--launch-blue: var\(--accent\)/);
    assert.match(pageSource, /studioAppearanceKey\(\)/);
    assert.match(pageSource, /getStudioAppearance\(\)/);
    assert.match(pageSource, /window\.localStorage\.setItem\(this\.studioAppearanceKey\(\), JSON\.stringify\(appearance\)\)/);
    assert.match(pageSource, /settingsForm\.addEventListener\("change", \(\) => this\.applyThemeSettings\(selectedAppearance\(\)\)\)/);
    assert.match(pageSource, /applyThemeSettings\(appearance = this\.getStudioAppearance\(\)\)\s*\{\s*const themeTarget = document\.documentElement;[\s\S]*?themeTarget\.style\.setProperty\("--accent", appearance\.primary_color\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--bg", "#FFFFFF"\)/);
    assert.match(pageSource, /const foreground = "#18181B";[\s\S]*?const accentForeground = isWhiteAccent \|\| !isDarkAccent \? "#18181B" : "#FFFFFF"/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface", "#FFFFFF"\)/);
    assert.match(pageSource, /const isWhiteAccent = appearance\.primary_color\.toUpperCase\(\) === "#FFFFFF"/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-subtle", "#F5F5F5"\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-hover", "#EBEBEB"\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--border", "#E2E2E5"\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--text-main", foreground\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--text-muted", "#66666B"\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--accent-hover", isWhiteAccent \? "#F4F4F5"/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-subtle"/);
    assert.match(pageSource, /\.navbar\s*\{[^}]*background-color:\s*var\(--surface\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-hover"/);
    assert.match(pageSource, /--font-display: Impact, Haettenschweiler, "Arial Narrow", "sans-serif-condensed", sans-serif/);
    assert.match(pageSource, /font-family: var\(--font-display\)/);
    assert.doesNotMatch(pageSource, /name="fontFamily"|Typography<\/label>/);
    const appearanceStart = pageSource.indexOf("  applyThemeSettings(appearance = this.getStudioAppearance()) {");
    const appearanceEnd = pageSource.indexOf("  setAppShellTheme(", appearanceStart);
    const appearanceMethod = pageSource.slice(appearanceStart, appearanceEnd);
    assert.doesNotMatch(appearanceMethod, /--font-main|--font-serif|--font-display/);
    assert.match(pageSource, /input\[type="radio"\][\s\S]*?accent-color: var\(--accent\)/);
    assert.match(pageSource, /body\.app-shell #app\s*\{[^}]*background-color:\s*var\(--bg\)/);
    assert.match(pageSource, /setAppShellTheme\(path, params = new URLSearchParams\(\)\)[\s\S]*?path === "\/pos" \|\| path\.startsWith\("\/pos\/"\)/);
    assert.match(pageSource, /this\.setAppShellTheme\(path, params\)/);
    assert.match(pageSource, /forEach\(property => document\.documentElement\.style\.removeProperty\(property\)\)/);
    assert.match(pageSource, /cacheActiveTenantCatalog\(\);[\s\S]*?AppUtils\.showToast\("App appearance saved/);
    assert.match(pageSource, /async loadTenantCatalog\(tenant\)/);
    const seedInitialSource = pageSource.match(/seedInitial\([\s\S]*?\n  \},\n\n  save\(\)/)?.[0];
    assert.ok(seedInitialSource);
    assert.doesNotMatch(seedInitialSource, /btn-provision-main-owner/);
    assert.match(pageSource, /initTenantManager\(\)[\s\S]*?getElementById\("tenant-manager-list"\)[\s\S]*?refreshTenantList\(tenantList\)\.catch/);
    assert.match(pageSource, /private=1/);
    assert.match(pageSource, /tenant_catalogs/);
    assert.match(pageSource, /"Authorization":/);
    assert.match(pageSource, /cloudflareConnection\(tenantId = this\.getActiveTenant\(\)\.id\)[\s\S]*?const token = tenant\?\.owner_token \|\|[\s\S]*?window\.localStorage\.getItem\("ESHOP_ACCOUNT_SESSION_V1"\)/);
    assert.match(pageSource, /images:\s*Array\.isArray\(product\.images\)[\s\S]*?\^data:image\\\//);
    assert.match(cloudflareWorkerSource, /url\.pathname === "\/api\/catalog"/);
    assert.match(cloudflareWorkerSource, /PUBLISH_TOKEN/);
    assert.match(cloudflareWorkerSource, /catalog_snapshots/);
    assert.match(cloudflareWorkerSource, /tenantIdFromRequest/);
    assert.match(cloudflareWorkerSource, /api\/tenants/);
    assert.match(cloudflareWorkerSource, /__ESHOP_CLOUDFLARE_STOREFRONT__ = true/);
    assert.match(pageSource, /\.pos-overview-controls\s*\{[^}]*display:\s*flex[^}]*gap:\s*8px/);
    assert.match(pageSource, /navigate\(path,\s*openWorkspaceHome\s*=\s*false\)/);
    assert.match(pageSource, /this\.navigate\(route,\s*link\.hasAttribute\("data-home-screen"\)\)/);
    assert.match(pageSource, /class="brand-logo studio-module-brand studio-module-back" data-route="\/" data-home-screen aria-label="Back to Craft home"/);
    assert.match(pageSource, /class="brand-logo" data-route="\$\{storefrontHome\}" \$\{options\.builderPreview \? "" : "data-home-screen"\} aria-label="Craft home"/);
    assert.match(pageSource, /\.studio-module-navbar \.studio-profile-btn\s*\{[^}]*border-radius:\s*50%[^}]*background:\s*#000[^}]*color:\s*#fff/);
    assert.match(pageSource, /\.workspace-menu\s*\{[^}]*margin-left:\s*auto/);
    assert.match(pageSource, /\.pos-ranges\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto[^}]*touch-action:\s*pan-x/);
    assert.match(pageSource, /\.pos-overview-card\s*\{[^}]*min-height:\s*260px[^}]*border:\s*0[^}]*background:\s*#111/);
    assert.match(pageSource, /body\.craft-app-ui #app \.pos-overview-card\s*\{[^}]*background-color:\s*#111 !important;[^}]*color:\s*#fff !important;/);
    assert.match(pageSource, /\.pos-overview-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(pageSource, /\.pos-overview-metrics\s*\{[^}]*align-content:\s*space-between/);
    assert.match(pageSource, /\.pos-overview-metric:nth-child\(even\)\s*\{[^}]*text-align:\s*right/);
    assert.match(pageSource, /\.pos-revenue-card\s*\{[^}]*min-height:\s*320px/);
    assert.match(pageSource, /\.pos-revenue-chart-line\s*\{[^}]*stroke:\s*var\(--accent\)/);
    assert.match(pageSource, /\.pos-bottom-nav\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(pageSource, /\.pos-bottom-nav \.pos-tab\s*\{[^}]*flex-direction:\s*column/);
    assert.match(pageSource, /\.pos-bottom-nav \.pos-tab\.is-active\s*\{[^}]*background:\s*#ededee !important/);
    assert.match(pageSource, /\.pos-payment-option\s*\{[^}]*min-height:\s*36px/);
    assert.match(pageSource, /\.pos-customer-fields input\s*\{[^}]*min-height:\s*30px/);
    assert.match(pageSource, /\.pos-checkout-actions \.btn-primary,[\s\S]*?height:\s*30px/);
    assert.match(pageSource, /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.pos-product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
    assert.match(sqliteSource, /'store','categories','products','pages'/);
    assert.match(sqliteSource, /ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1/);
    assert.match(pageSource, /getPages\(publishedOnly = false\)/);
    assert.doesNotMatch(pageSource, /savePage\(data\)|deletePage\(id\)|id="page-editor-form"|path === "\/account\/web\/pages"/,
      'Nothing can create or edit custom pages any more, so their editor, routes and helpers are gone.');
    assert.match(pageSource, /path\.startsWith\("\/pages\/"\)[\s\S]*?renderCustomPage\(slug\)/);
    assert.match(pageSource, /SQLiteEngine\.getPages\(true\)/);
    assert.match(pageSource, /AppUtils\.escapeHTML\(page\.content \|\| ""\)\.replace/);
    assert.doesNotMatch(pageSource, /title: "Store Viewer"/);
    assert.match(pageSource, /height:\s*100dvh/);
    assert.match(pageSource, /name="imageFile"[^>]*accept="image\/\*"/);
    assert.match(pageSource, /Choose up to 8 photos to save in this device's SQLite catalog/);
    assert.match(pageSource, /const images = selectedImages\.length\s*\?\s*await Promise\.all\(selectedImages\.map\(file => this\.readProductImage\(file\)\)\)/);
    assert.match(pageSource, /readProductImage\(file\) \{\s*return AppUtils\.compressImageFile\(file\);/);
    assert.match(pageSource, /files\.some\(file => !file\.type\.startsWith\("image\/"\) \|\| file\.size > 5 \* 1024 \* 1024\)/);
    assert.doesNotMatch(pageSource, /observer\.observe\(frameDocument\.documentElement\)/);
    assert.doesNotMatch(pageSource, /previewWindow\.setBuilderNavigation/);
    assert.match(pageSource, /await window\.ShopSQLite\.flush\(\)/);
    assert.match(pageSource, /await SQLiteEngine\.resetBuildYourWebDataOnce\(\)/);
    assert.match(pageSource, /resetBuildYourWebDataOnce\(\)[\s\S]*?this\.db\.tables\.pages = \[\][\s\S]*?this\.updateStore\(/);
    assert.doesNotMatch(pageSource, /resetBuildYourWebDataOnce\(\)[\s\S]*?this\.db\.tables\.(?:products|categories)\s*=/);
    assert.match(pageSource, /products: draft\.products,\s*categories: draft\.categories,\s*store: \{ name: "Your new website"/);
    assert.match(androidManifest, /android:allowBackup="true"[\s\S]*?android:fullBackupContent="@xml\/backup_rules"[\s\S]*?android:dataExtractionRules="@xml\/data_extraction_rules"/);
    assert.match(androidBackupRules, /<include domain="database" path="\." \/>/);
    assert.match(androidDataExtractionRules, /<cloud-backup>[\s\S]*?<include domain="database" path="\." \/>[\s\S]*?<\/cloud-backup>[\s\S]*?<device-transfer>[\s\S]*?<include domain="database" path="\." \/>/);
    assert.match(pageSource, /if \(previewDocument && previewWindow && !routedHostedPreviewDocuments\.has\(previewDocument\)\)[\s\S]*?target\?\.closest\?\.\("a\[href\]"\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopImmediatePropagation\(\)[\s\S]*?previewWindow\.location\.hash = href/);
    assert.doesNotMatch(pageSource, /Desktop view|Tablet view|Phone view|view-mode-desktop|view-mode-tablet|view-mode-mobile/);
    assert.match(pageSource, /<nav class="nav-menu">[\s\S]*publishedPages\.map/);
    assert.match(pageSource, /renderFooter\(\)\s*\{\s*return `\s*<footer class="footer">/);
    assert.doesNotMatch(pageSource, /THE HOUSE|Account Portal|Storefront Viewer|Studio Analytics|Atelier Plans/);
    assert.match(pageSource, /<!-- Mobile Navigation Drawer -->/);
    assert.match(pageSource, /@media \(max-width:\s*768px\)[\s\S]*?\.navbar:not\(\.studio-module-navbar\) \.nav-center\s*\{[^}]*display:\s*block/);
    assert.doesNotMatch(pageSource, /studio-store-frame-wrapper|view-mode-desktop|view-mode-tablet|view-mode-mobile/);

    const submit = async (kind, values, formOptions = {}) => Promise.all(handlers.submit.map((handler) => handler({
      target: { closest: (selector) => selector === 'form[data-pos-form]'
        ? { dataset: { posForm: kind }, values, querySelector: () => null, ...formOptions } : null },
      preventDefault() {}
    })));
    const click = async (action, attributes = {}) => Promise.all(handlers.click.map((handler) => handler({
      target: { closest: (selector) => selector === '[data-pos-action]' ? { dataset: { posAction: action, ...attributes } } : null }
    })));

    let focusedRequiredField = '';
    const missingPriceStatus = { textContent: '' };
    await submit('product', {
      id: '0', name: 'Unpriced sample', categoryId: '1', price: '', stock: '2'
    }, {
      elements: { price: { name: 'price', focus() { focusedRequiredField = 'price'; }, scrollIntoView() {} } },
      querySelector(selector) {
        return selector === '[data-product-submit-status]' ? missingPriceStatus : null;
      }
    });

    assert.equal(focusedRequiredField, 'price');
    assert.match(missingPriceStatus.textContent, /selling price/i);
    assert.match(toast.textContent, /selling price/i);
    assert.equal(queryRows("SELECT COUNT(*) AS count FROM pos_products WHERE name='Unpriced sample'")[0].count, 0);
    await submit('product', {
      id: '0', name: 'Canvas Tote', categoryId: '1', price: '18.50',
      buyingPrice: '7.25', stock: '4', barcode: '123456789012', expiryDate: '2027-04-15', imageUri: ''
    });
    assert.match(root.innerHTML, /Canvas Tote/, toast.textContent);
    assert.equal(queryRows('PRAGMA table_info(pos_products)').some((column) => column.name === 'barcode'), true);
    assert.equal(queryRows('SELECT barcode FROM pos_products WHERE id=1')[0].barcode, '123456789012');
    assert.equal(queryRows('SELECT expiry_date FROM pos_products WHERE id=1')[0].expiry_date, '2027-04-15');
    assert.equal((await app.findProductByCode('123456789012')).id, 1);
    assert.equal((await app.findProductByCode('ESHOP-UNKNOWN')), null);
    assert.match(app.render('/pos/catalogue/inventory'), /aria-label="Edit Canvas Tote"/);
    const editMarkup = app.render('/pos/catalogue/products', new URLSearchParams('edit=1'));
    assert.match(editMarkup, /<h3>Edit product<\/h3>[\s\S]*?name="id" value="1"[\s\S]*?name="name" value="Canvas Tote"/);
    await submit('product', {
      id: '1', name: 'Canvas Tote', categoryId: '1', price: '18.50',
      buyingPrice: '7.25', stock: '4', barcode: '123456789012', expiryDate: '2027-04-15',
      imageUri: '', lowStockThreshold: '3', active: '1'
    });
    assert.equal(queryRows('SELECT name,price_cents FROM pos_products WHERE id=1')[0].name, 'Canvas Tote');
    assert.equal(queryRows('SELECT price_cents FROM pos_products WHERE id=1')[0].price_cents, 1850);
    await app.addScannedBarcode('123456789012');
    assert.match(root.innerHTML, /data-pos-quantity="1||"/);
    await click('cancel-sale');
    const keyboardInput = {
      value: '123456789012',
      closest: (selector) => selector === '[data-pos-barcode-input]' ? keyboardInput : null
    };
    await handlers.keydown[0]({
      key: 'Enter', target: keyboardInput, preventDefault() {}
    });
    assert.match(root.innerHTML, /data-pos-quantity="1||"/);
    await click('cancel-sale');
    await app.addScannedBarcode('UNKNOWN-987');
    assert.match(window.location.hash, /\/pos\/catalogue\/products\?new=1&barcode=UNKNOWN-987/);
    window.location.hash = '#/pos';
    await app.refresh();
    assert.match(app.render('/pos/inventory'), /Inventory/);
    assert.match(app.render('/pos/inventory'), /Sync details to active website draft/);

    await click('add-cart', { id: '1' });
    assert.doesNotMatch(root.innerHTML, /Current sale/);
    assert.match(root.innerHTML, /data-pos-quantity="1||"/);
    assert.match(root.innerHTML, /data-method="Mobile money"/);
    assert.match(root.innerHTML, /data-method="Cash"/);
    assert.match(root.innerHTML, /data-method="Bank"/);
    assert.match(root.innerHTML, /data-method="Card"/);
    assert.match(root.innerHTML, /data-method="Other"/);
    assert.match(root.innerHTML, /pos-payment-logo/);
    assert.match(root.innerHTML, />Tax · 0%/);
    assert.doesNotMatch(root.innerHTML, /SMS|automatic matching/);
    await click('set-discount');
    assert.match(root.innerHTML, /role="dialog" aria-modal="true"/);
    await submit('discount', { discountAmount: '3.7' });
    assert.match(root.innerHTML, /Discount · 20%/);
    assert.match(root.innerHTML, /name="discount" value="3\.7"/);
    await click('set-discount');
    await submit('discount', { discountAmount: '500' });
    assert.match(toast.textContent, /no greater than the sale subtotal/i);
    assert.match(root.innerHTML, /Discount · 20%/);
    assert.match(root.innerHTML, /role="dialog" aria-modal="true"/);
    await click('close-discount');
    assert.doesNotMatch(root.innerHTML, /role="dialog" aria-modal="true"/);
    await handlers.change[0]({
      type: 'change',
      target: { value: '2', dataset: { posQuantity: '1||' }, closest: (selector) =>
        selector === '[data-pos-quantity]' ? { value: '2', dataset: { posQuantity: '1||' } } : null }
    });
    await app.refresh();
    assert.match(root.innerHTML, /value="2" aria-label="Quantity" data-pos-quantity="1||"/);
    await click('checkout-method', { method: 'Card' });
    assert.match(root.innerHTML, /data-method="Card" aria-pressed="true"/);
    await click('cancel-sale');
    assert.match(root.innerHTML, /Your sale is empty/);
    assert.doesNotMatch(root.innerHTML, /data-pos-action="cancel-sale"/);

    await click('add-cart', { id: '1' });
    await handlers.change[0]({
      type: 'change',
      target: { value: '2', dataset: { posQuantity: '1||' }, closest: (selector) =>
        selector === '[data-pos-quantity]' ? { value: '2', dataset: { posQuantity: '1||' } } : null }
    });
    await app.refresh();
    const syncedProductId = (await app.listBusinessRecords('product', 'local'))
      .find((product) => product.name === 'Canvas Tote')?.id;
    const runtimeCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: { subtle: undefined, randomUUID: () => runtimeCrypto.randomUUID() }
    });
    try {
      await submit('checkout', {
        paymentMethod: 'Other', customerName: 'Sample Customer', customerPhone: '0700 000 001', dueDate: '', discount: '2'
      });
    } finally {
      Object.defineProperty(globalThis, 'crypto', oldCrypto);
    }
    const paidSale = queryRows('SELECT paid,total_cents,discount_cents FROM pos_sales')[0];
    assert.equal(paidSale.paid, 1);
    assert.equal(queryRows('SELECT payment_method FROM pos_sales')[0].payment_method, 'Other');
    assert.equal(paidSale.total_cents, 3500);
    assert.equal(paidSale.discount_cents, 200);
    assert.match(toast.textContent, /^Receipt .* saved/);
    assert.match(app.render('/pos/sales', new URLSearchParams('open=1')), /Subtotal \/ discount \/ tax/);
    const customerMarkup = app.render('/pos/customers');
    assert.match(customerMarkup, /Sample Customer/);
    assert.match(customerMarkup, /Revenue/);
    assert.equal(queryRows('SELECT stock_count FROM pos_products WHERE id=1')[0].stock_count, 2);
    assert.equal(window.location.hash, '#/pos');
    assert.match(root.innerHTML, /Your sale is empty/);
    assert.doesNotMatch(window.location.hash, /\/sales/);
    const syncedProductAfterSale = (await app.listBusinessRecords('product', 'local'))
      .find((product) => product.name === 'Canvas Tote');
    assert.equal(syncedProductAfterSale.stock, 2);
    assert.equal(syncedProductAfterSale.id, syncedProductId, 'The mobile hash fallback should preserve existing product sync IDs.');
    await click('add-cart', { id: '1' });
    await submit('checkout', { paymentMethod: 'Card', customerName: 'Sample Customer', customerPhone: '0700 000 001', dueDate: '' });
    assert.equal((await app.listBusinessRecords('product', 'local')).find(product => product.name === 'Canvas Tote').stock, 1);
    const repeatCustomerInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    assert.match(repeatCustomerInsights, /Sample Customer/);
    assert.match(repeatCustomerInsights, /Repeat customers<\/strong><span>1/);
    assert.match(repeatCustomerInsights, /units in 30 days · consider about/);
    const overviewWithRevenue = app.render('/pos/overview');
    assert.match(overviewWithRevenue, /class="pos-card pos-revenue-card"/);
    assert.match(overviewWithRevenue, /Revenue chart history; scroll horizontally to see all dates/);
    assert.match(overviewWithRevenue, /Net sales before tax over time with value and date axes/);
    assert.match(overviewWithRevenue, /class="pos-revenue-chart-axis-label"/);
    assert.match(overviewWithRevenue, /class="pos-revenue-chart-line"/);
    const posChartSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
    assert.match(posChartSource, /const revenueSeries = Object\.entries\(daily\)\.sort\(\(\[first\], \[second\]\) => first\.localeCompare\(second\)\);/);
    const revenueSeriesLineStart = posChartSource.indexOf('const revenueSeries = Object.entries(daily)');
    const revenueSeriesLine = posChartSource.slice(revenueSeriesLineStart, posChartSource.indexOf('\n', revenueSeriesLineStart));
    assert.doesNotMatch(revenueSeriesLine, /slice/);
    const insightMarkup = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    for (const heading of ['Needs attention', 'Sales trends', 'Revenue rhythm', 'Product performance', 'Category performance', 'Basket patterns', 'Customers', 'Busy days and hours', 'Recorded cost changes', 'Payment mix changes', 'Large-receipt review', 'Cash receipt review', 'Seasonality and selling periods', 'Data quality and confidence', 'Actionable recommendations', 'Goals and benchmarks', 'Priority alerts', 'Money and cash flow']) {
      assert.match(insightMarkup, new RegExp(`<h3>${heading}</h3>`));
    }
    assert.match(insightMarkup, /Top seller/);
    assert.match(insightMarkup, /Highest fully costed gross profit/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Profit&range=30d')), /Profit and loss/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Profit&range=30d')), /Break-even needs|Approximate revenue to cover/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Profit&range=30d')), /Recorded operating profit over time with value and date axes/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Stock&range=30d')), /Days cover/);
    await submit('revenue-goal', { amount: '100000' });
    assert.ok(queryRows("SELECT value FROM pos_settings WHERE key='monthly_revenue_goal_cents'")[0], toast.textContent);
    assert.equal(queryRows("SELECT value FROM pos_settings WHERE key='monthly_revenue_goal_cents'")[0].value, '10000000');
    const goalInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    assert.match(goalInsights, /Monthly net-sales target/);
    assert.match(goalInsights, /role="progressbar" aria-label="Monthly revenue goal progress"/);
    if (new Date().getDate() >= 7) {
      assert.match(goalInsights, /Monthly revenue goal is behind the current pace/);
    } else {
      assert.doesNotMatch(goalInsights, /Monthly revenue goal is behind the current pace/);
    }
    runSql("UPDATE pos_settings SET value='USD' WHERE key='currency'");
    await app.refresh();
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /saved goal is in KES while the store now uses USD/);
    runSql("UPDATE pos_settings SET value='KES' WHERE key='currency'");
    await app.refresh();
    runSql('UPDATE pos_products SET stock_count=0 WHERE id=1');
    await app.refresh();
    const alertInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    assert.match(alertInsights, /1 product out of stock/);
    const alertKey = /data-pos-action="snooze-alert" data-key="([^"]+)"/.exec(alertInsights)?.[1];
    assert.ok(alertKey);
    await click('dismiss-alert', { key: alertKey });
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /Restore 1 dismissed alert/);
    await click('restore-alerts');
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /1 product out of stock/);
    await click('snooze-alert', { key: alertKey });
    assert.doesNotMatch(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /1 product out of stock/);
    runSql('UPDATE pos_products SET stock_count=1 WHERE id=1');
    runSql("UPDATE pos_products SET sku='TOTE-1' WHERE id=1");
    runSql("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('shared_tenant_id','main')");
    runSql("INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES ('main','TOTE-1',100,'test')");
    const sharedSales = [];
    window.EshopInventoryBridge = {
      websites() { return [{ tenant_id: 'main', name: 'Main shop' }]; },
      async request(tenantId, action, method, body) {
        if (method === 'POST') sharedSales.push({ tenantId, action, method, body });
        return { ok: true, items: [] };
      }
    };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
    assert.match(pageSource, /\.pos-goal-track\s*\{[^}]*height:\s*7px/);
    assert.match(pageSource, /\.pos-insight-alert\.is-critical\s*\{/);
    assert.match(insightMarkup, /Repeat customers/);
    assert.match(insightMarkup, /Outstanding credit/);
    assert.match(insightMarkup, /Busiest day/);
    assert.match(insightMarkup, /Canvas Tote/);
    assert.match(pageSource, /\.pos-insights-dashboard\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    assert.match(pageSource, /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.pos-insights-dashboard\s*\{[^}]*grid-template-columns:\s*1fr/);

    window.location.hash = '#/pos';
    await app.refresh();
    await click('add-cart', { id: '1' });
    await click('checkout-method', { method: 'Mobile money' });
    assert.match(root.innerHTML, /Confirm the payment with the mobile-money provider before completing this sale/);
    await submit('checkout', { paymentMethod: 'Mobile money', customerName: '', customerPhone: '', dueDate: '' });
    const manuallyRecordedSale = queryRows("SELECT id,paid,payment_status,total_cents FROM pos_sales WHERE payment_method='Mobile money'")[0];
    assert.equal(manuallyRecordedSale.paid, 1);
    assert.equal(manuallyRecordedSale.payment_status, 'confirmed');
    assert.equal(manuallyRecordedSale.total_cents, 1850);
    const manualPayment = queryRows("SELECT mpesa_ref,sender_name,sender_phone FROM pos_sale_payments WHERE sale_id=?", [manuallyRecordedSale.id])[0];
    assert.equal(manualPayment.mpesa_ref, null);
    assert.equal(manualPayment.sender_name, null);
    assert.equal(manualPayment.sender_phone, null);
    assert.equal(queryRows("SELECT status FROM pos_inventory_queue")[0].status, 'pending');
    await app.refresh();
    assert.match(app.render('/pos/inventory'), /Offline: shared stock changes are saved locally and queued for D1 sync/);
    assert.equal(queryRows("SELECT stock FROM shared_inventory WHERE tenant_id='main' AND sku='TOTE-1'")[0].stock, 99);
    assert.match(toast.textContent, /shared stock sync pending/);
    globalThis.navigator.onLine = true;
    await handlers.online[0]();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await app.refresh();
    assert.equal(sharedSales.length, 1);
    assert.equal(sharedSales[0].tenantId, 'main');
    assert.equal(sharedSales[0].action, 'sale');
    assert.deepEqual(sharedSales[0].body.items, [{ sku: 'TOTE-1', quantity: 1 }]);
    assert.equal(queryRows("SELECT status FROM pos_inventory_queue")[0].status, 'synced');
    await app.recordSharedLocalSale('main', 'WEB-OFFLINE-1', [{ sku: 'TOTE-1', quantity: 2 }]);
    assert.equal(queryRows("SELECT stock FROM shared_inventory WHERE tenant_id='main' AND sku='TOTE-1'")[0].stock, 97);
    assert.equal(queryRows("SELECT status FROM pos_inventory_queue WHERE event_id='WEB-OFFLINE-1'")[0].status, 'pending');
    await handlers.online[0]();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(sharedSales.length, 2);
    assert.deepEqual(sharedSales[1].body.items, [{ sku: 'TOTE-1', quantity: 2 }]);
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_sale_payments')[0].count, 3);

    runSql(`INSERT INTO pos_sales
      (receipt_number,subtotal_cents,tax_cents,discount_cents,total_cents,currency,payment_method,paid,
       customer_name,customer_phone,due_date,payment_status,amount_paid_cents,created_at)
      VALUES ('MANUAL-PENDING',1850,0,0,1850,'KES','Mobile money',0,NULL,NULL,NULL,'pending',0,'2026-01-01T00:00:00.000Z')`);
    const manualPending = queryRows("SELECT id FROM pos_sales WHERE receipt_number='MANUAL-PENDING'")[0];
    await submit('payment', { saleId: String(manualPending.id), amount: '5', method: 'Mobile money' });
    assert.equal(queryRows('SELECT payment_status FROM pos_sales WHERE id=?', [manualPending.id])[0].payment_status, 'partial');
    await submit('payment', { saleId: String(manualPending.id), amount: '13.50', method: 'Mobile money' });
    assert.equal(queryRows('SELECT paid FROM pos_sales WHERE id=?', [manualPending.id])[0].paid, 1);

    window.location.hash = '#/pos/invoices?new=1';
    await app.refresh();
    await click('invoice-add', { id: '1' });
    await submit('invoice', {
      id: '0', customerName: 'Customer', customerContact: '',
      dueDate: '', notes: ''
    });
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_invoices')[0].count, 1);

    const date = new Date();
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    await submit('expense', {
      id: '0', date: dateValue, category: 'Supplies', label: 'Packaging',
      amount: '2.50', paymentMethod: 'Cash', note: ''
    });
    const savedExpense = queryRows('SELECT id FROM pos_expenses')[0];
    assert.ok(savedExpense, toast.textContent);
    const expenseId = savedExpense.id;
    await submit('expense', {
      id: String(expenseId), date: dateValue, category: 'Supplies', label: 'Updated packaging',
      amount: '3.50', paymentMethod: 'Cash', note: ''
    });
    assert.equal(queryRows('SELECT label,amount_cents FROM pos_expenses WHERE id=?', [expenseId])[0].label, 'Updated packaging');
    await submit('movement', { type: 'float_in', amount: '20', note: 'Opening float' });
    await submit('till', { date: dateValue, countedCash: '20' });
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_cash_movements')[0].count, 1);
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_till_closes')[0].count, 1);

    window.location.hash = '#/pos/instances';
    await app.refresh();
    await submit('instance', { name: 'Morning shift', mode: 'counted', durationMinutes: '60', startAt: '', endAt: '' });
    const instanceId = queryRows('SELECT id FROM pos_instances')[0].id;
    await click('instance-checkpoint', { id: instanceId });
    await click('instance-pause', { id: instanceId });
    await click('instance-resume', { id: instanceId });
    await click('instance-stop', { id: instanceId });
    assert.equal(queryRows('SELECT status FROM pos_instances WHERE id=?', [instanceId])[0].status, 'completed');

    for (let index = 0; index < 48; index += 1) {
      const monthOffset = Math.floor(index / 12) - 4;
      const day = index % 12 < 6 ? 3 : 25;
      const createdAt = new Date(date.getFullYear(), date.getMonth() + monthOffset, day, 12, 0, 0).toISOString();
      const receipt = `ANALYTICS-${index}`;
      const taxCents = index === 0 ? 200 : 0;
      const totalCents = 2000 + taxCents;
      runSql(`INSERT INTO pos_sales
        (receipt_number,subtotal_cents,tax_cents,total_cents,currency,payment_method,paid,customer_name,customer_phone,due_date,payment_status,amount_paid_cents,created_at)
        VALUES (?,2000,?,?,'KES','Cash',1,'History Customer','07000000002','','paid',?,?)`,
      [receipt, taxCents, totalCents, totalCents, createdAt]);
      const saleId = queryRows('SELECT id FROM pos_sales WHERE receipt_number=?', [receipt])[0].id;
      runSql(`INSERT INTO pos_sale_items (sale_id,product_id,name,quantity,unit_price_cents,unit_cost_cents,unit_cost_captured)
        VALUES (?,1,'Canvas Tote',1,2000,725,1)`, [saleId]);
      runSql(`INSERT INTO pos_sale_payments (sale_id,method,amount_cents,status,created_at)
        VALUES (?,'Cash',?,'confirmed',?)`, [saleId, totalCents, createdAt]);
    }
    await app.refresh();
    const deepHistoryInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=all'));
    assert.match(deepHistoryInsights, /Strongest month segment/);
    assert.match(deepHistoryInsights, /sales in 4 months/);
    assert.match(deepHistoryInsights, /A contribution group/);
    assert.match(deepHistoryInsights, /Loyal · 3\+ purchases<\/strong><span>1/);
    const historicalProfit = app.render('/pos/overview', new URLSearchParams('tab=Profit&range=all'));
    assert.match(historicalProfit, /Tax on recorded sales<\/span><b>KES\u00a02\.00/);

    const categoryId = queryRows('SELECT id FROM pos_categories ORDER BY id LIMIT 1')[0].id;
    const createdProductId = await app.saveProduct({
      name: 'Generated SKU test', categoryId, price: 12, buyingPrice: null, stock: 4, sku: '',
      lowStockThreshold: 7, active: false
    });
    const savedSku = queryRows('SELECT sku FROM pos_products WHERE id = ?', [createdProductId])[0].sku;
    assert.match(savedSku, /^ESHOP-[A-F0-9]{16}$/);
    assert.doesNotMatch(savedSku, /customer|phone|email/i);
    const generatedProduct = (await app.listProducts()).find(product => product.id === createdProductId);
    assert.equal(generatedProduct.name, 'Generated SKU test');
    assert.equal(generatedProduct.lowStockThreshold, 7);
    assert.equal(generatedProduct.active, false);
    assert.doesNotMatch(app.render('/pos'), /Generated SKU test/);

    const csvInput = {
      files: [{ async text() {
        return 'name,price,stock,category,sku,low_stock_threshold,active\nImported Item,2.5,8,CSV Category,CSV-1,4,false';
      } }],
      matches(selector) { return selector === '[data-pos-csv-import]'; },
      value: ''
    };
    await handlers.change[1]({
      target: { closest(selector) { return selector === '[data-pos-import], [data-pos-csv-import]' ? csvInput : null; } }
    });
    const importedProduct = (await app.listProducts()).find(product => product.sku === 'CSV-1');
    assert.equal(importedProduct.name, 'Imported Item');
    assert.equal(importedProduct.price, 2.5);
    assert.equal(importedProduct.stock, 8);
    assert.equal(importedProduct.lowStockThreshold, 4);
    assert.equal(importedProduct.active, false);
    assert.equal(csvInput.value, '');

    await submit('supplier', { id: '', name: 'Canvas Supply Co', phone: '+254700000000', email: 'orders@example.test', supplies: 'Canvas and bags' });
    const supplier = (await app.listBusinessRecords('supplier', 'local'))[0];
    assert.equal(supplier.name, 'Canvas Supply Co');
    assert.match(app.render('/pos/catalogue/suppliers'), /Purchase order/);
    const saleProduct = (await app.listProducts()).find(product => product.name === 'Canvas Tote');
    const stockBeforeReceipt = saleProduct.stock || 0;
    await submit('purchase', {
      supplierId: supplier.id, reference: 'INV-100', product1: saleProduct.sku,
      quantity1: '2', cost1: '8', product2: '', quantity2: '', cost2: '', product3: '', quantity3: '', cost3: ''
    });
    const purchase = (await app.listBusinessRecords('purchase', 'local'))[0];
    assert.equal(purchase.status, 'ordered');
    await click('receive-purchase', { recordId: purchase.id });
    assert.equal((await app.listBusinessRecords('purchase', 'local'))[0].status, 'received');
    assert.equal((await app.listProducts()).find(product => product.name === 'Canvas Tote').stock, stockBeforeReceipt + 2);
    assert.equal((await app.listBusinessRecords('product', 'local')).find(product => product.sku === saleProduct.sku).stock,
      stockBeforeReceipt + 2);

    window.location.hash = '#/pos';
    await app.refresh();
    promptValue = 'Hold for pickup';
    await click('add-cart', { id: String(saleProduct.id) });
    await click('park-ticket');
    const parked = (await app.listBusinessRecords('ticket', 'local'))[0];
    assert.equal(parked.name, 'Hold for pickup');
    assert.match(app.render('/pos/orders'), /Hold for pickup/);
    await click('resume-ticket', { recordId: parked.id });
    assert.match(root.innerHTML, /Canvas Tote/);
    await click('delete-ticket', { recordId: parked.id });
    assert.equal((await app.listBusinessRecords('ticket', 'local')).length, 0);
    assert.ok((await app.listCategories()).some(category => category.id === categoryId));
    assert.ok(Array.isArray(await app.listSales()));

    const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /confirmPendingMpesaSalePayment|linkMpesaTransaction|pos_payment_links|smsParser/);
  } finally {
    db.close();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
    else delete globalThis.navigator;
    globalThis.FormData = oldFormData;
    globalThis.confirm = oldConfirm;
    globalThis.prompt = oldPrompt;
    if (oldCrypto) Object.defineProperty(globalThis, 'crypto', oldCrypto);
    else delete globalThis.crypto;
  }
});
