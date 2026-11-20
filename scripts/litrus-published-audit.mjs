// Audits how Litrus Mixer storefronts look on a phone, mood by mood, with a realistic shop: 12 products
// with photos of mixed shapes (tall, wide, square), 6 categories, some products without photos.
// It measures the storefront in the builder's preview, which uses the same storefront CSS and markup
// as the published site. Per mood and page (home, all products, a product): stretched or squashed
// images, uneven card photo heights, sideways overflow, hidden product cards, and a page that will not
// scroll. Usage: node scripts/litrus-published-audit.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:5173';
const SHAPES = [[800, 1200], [1200, 800], [1000, 1000], [600, 1400], [1600, 900], [900, 900]];
const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#c9b8a6"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#7a5c45"/></svg>`;
const cats = ['Shoes', 'Bags', 'Dresses', 'Watches', 'Hats', 'Jackets'];
const products = Array.from({ length: 12 }, (_, i) => ({
  id: 100 + i, name: `Product ${i + 1} ${['classic', 'leather', 'summer'][i % 3]}`, price: 1500 + i * 250,
  category_names: [cats[i % cats.length]], stock: 5, description: 'A well made everyday item from a small shop in Nairobi.',
  images: i % 5 === 4 ? [] : [`${base}/__audit-img/p${i}-${SHAPES[i % SHAPES.length].join('x')}.svg`]
}));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.route(`${base}/__audit-img/**`, route => {
  const [w, h] = route.request().url().match(/(\d+)x(\d+)/).slice(1).map(Number);
  route.fulfill({ contentType: 'image/svg+xml', body: svg(w, h) });
});
await page.goto(`${base}/litrus-mixer/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#shuf', { state: 'attached', timeout: 60000 });
await page.waitForTimeout(2000);
await page.evaluate(({ products, cats }) => {
  window.litrusSetCraftCatalog({ shop: { name: 'Audit Shop', currency: 'KES' }, categories: cats.map(name => ({ name })), products });
  document.documentElement.classList.add('mobile-preview'); window.dispatchEvent(new Event('resize'));
}, { products, cats });
const moods = await page.$$eval('#wMoods button.mood', list => list.map(b => b.textContent.trim()));

const measure = () => page.evaluate(async () => {
  const frame = document.getElementById('storePreviewFrame'), doc = frame.contentDocument, win = frame.contentWindow;
  const root = doc.scrollingElement;
  const start = root.scrollTop; root.scrollTop = 500; await new Promise(r => setTimeout(r, 120));
  const canScroll = root.scrollHeight <= win.innerHeight + 5 || root.scrollTop !== start;
  for (let y = 0; y <= root.scrollHeight; y += 450) { root.scrollTop = y; await new Promise(r => setTimeout(r, 40)); }
  root.scrollTop = 0; await new Promise(r => setTimeout(r, 300));
  const visible = el => { const r = el.getBoundingClientRect(), s = win.getComputedStyle(el); return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const distorted = [...doc.images].filter(img => {
    const r = img.getBoundingClientRect(); if (r.width < 40 || r.height < 40 || !img.naturalWidth || !visible(img)) return false;
    const fit = win.getComputedStyle(img).objectFit; if (['cover', 'contain', 'scale-down'].includes(fit)) return false;
    return Math.abs((r.width / r.height) / (img.naturalWidth / img.naturalHeight) - 1) > 0.05;
  }).map(img => (img.closest('[class]')?.className || '').toString().slice(0, 40));
  const collapsed = /circle\(0%|inset\((?:100%|0(?:px)? 100%|0(?:px)? 50%)/;
  const cards = [...doc.querySelectorAll('.sole-product')];
  const hidden = cards.filter(el => { const s = win.getComputedStyle(el), r = el.getBoundingClientRect(); return s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05 || r.width < 2 || r.height < 2 || collapsed.test(s.clipPath); }).length;
  // Card photos in the same row should be the same height (a mix of tall and wide photos breaks rows).
  const photos = cards.map(card => card.querySelector('.sole-product-photo, .p-img-wrap')).filter(Boolean).filter(visible).map(el => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top + root.scrollTop), h: Math.round(r.height) }; });
  const rows = new Map(); photos.forEach(p => rows.set(p.top, [...(rows.get(p.top) || []), p.h]));
  const unevenRows = [...rows.values()].filter(hs => hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 4).length;
  const overflow = Math.max(0, root.scrollWidth - win.innerWidth);
  return { cards: cards.length, hiddenCards: hidden, distorted: distorted.length, distortedIn: [...new Set(distorted)].slice(0, 3), unevenRows, overflowPx: overflow, canScroll };
});

const goPage = async value => { await page.evaluate(v => { const s = document.getElementById('selPage'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, value); await page.waitForTimeout(900); };
const report = [];
for (let index = 0; index < moods.length; index++) {
  await page.evaluate(i => document.querySelectorAll('#wMoods button.mood')[i].click(), index);
  await page.waitForTimeout(900);
  for (const view of ['home', 'shop', 'p/100']) {
    await goPage(view);
    report.push({ mood: moods[index], view, ...(await measure()) });
  }
}
await browser.close();
const problems = report.filter(r => r.hiddenCards || r.distorted || r.unevenRows || r.overflowPx > 2 || !r.canScroll || (r.view !== 'p/100' && r.cards === 0));
for (const r of problems) console.log(JSON.stringify(r));
const sum = key => report.reduce((total, r) => total + (typeof r[key] === 'number' ? r[key] : 0), 0);
console.log(`\nmoods ${moods.length}, pages checked ${report.length}, pages with problems ${problems.length}`);
console.log(`totals: distorted images ${sum('distorted')}, uneven card rows ${sum('unevenRows')}, hidden cards ${sum('hiddenCards')}, overflow pages ${report.filter(r => r.overflowPx > 2).length}, frozen pages ${report.filter(r => !r.canScroll).length}`);
process.exitCode = problems.length ? 1 : 0;
