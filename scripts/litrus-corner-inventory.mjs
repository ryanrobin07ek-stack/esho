// Inventory: every element in the storefront with a radius (plus all buttons and inputs), counted by
// class and radius across all moods and the home, shop and product pages. Shows which pieces use unrelated radii.
// Usage: node scripts/litrus-corner-inventory.mjs [baseUrl] [topN]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5191', topN = Number(process.argv[3] || 90);
const cats = ['Shoes', 'Bags', 'Dresses', 'Watches', 'Hats', 'Jackets'], SHAPES = [[800, 1200], [1200, 800], [1000, 1000], [600, 1400]];
const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#c9b8a6"/></svg>`;
const products = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Product ${i + 1} classic`, price: 1500 + i * 250, category_names: [cats[i % 6]], stock: 5, description: 'A well made everyday item.', images: i % 5 === 4 ? [] : [`${base}/__audit-img/p${i}-${SHAPES[i % 4].join('x')}.svg`] }));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => { let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
await page.route(`${base}/__audit-img/**`, r => { const [w, h] = r.request().url().match(/(\d+)x(\d+)/).slice(1).map(Number); r.fulfill({ contentType: 'image/svg+xml', body: svg(w, h) }); });
await page.goto(`${base}/litrus-mixer/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#shuf', { state: 'attached', timeout: 90000 }); await page.waitForTimeout(2000);
await page.evaluate(({ products, cats }) => { window.litrusSetCraftCatalog({ shop: { name: 'Audit Shop', currency: 'KES' }, categories: cats.map(name => ({ name })), products }); document.documentElement.classList.add('mobile-preview'); window.dispatchEvent(new Event('resize')); }, { products, cats });
const inv = {};
const nMoods = await page.$$eval('#wMoods button.mood', l => l.length);
for (let i = 0; i < nMoods; i++) {
  await page.evaluate(i => document.querySelectorAll('#wMoods button.mood')[i].click(), i); await page.waitForTimeout(800);
  for (const v of ['home', 'shop', 'p/100']) {
    await page.evaluate(v => { const s = document.getElementById('selPage'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, v); await page.waitForTimeout(700);
    const rows = await page.evaluate(() => {
      const d = document.getElementById('storePreviewFrame').contentDocument, w = d.defaultView; const out = [];
      for (const e of d.querySelectorAll('.sole-store *')) {
        const s = w.getComputedStyle(e), r = e.getBoundingClientRect(); if (r.width < 6 || r.height < 6 || s.display === 'none') continue;
        const rr = s.borderRadius; if (rr === '0px' && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) continue;
        const c = (e.getAttribute('class') || '').split(/\s+/).filter(x => x && !/^(reveal|is-visible|rev-|hov-|cont-)/.test(x))[0] || '';
        out.push([e.tagName.toLowerCase() + (c ? '.' + c : ''), rr.split(' ')[0], Math.round(r.height)]);
      } return out;
    });
    for (const [k, rr, h] of rows) { inv[k] ??= {}; const b = rr.endsWith('%') ? rr : (parseFloat(rr) >= h / 2 ? 'full' : rr); inv[k][b] = (inv[k][b] || 0) + 1; }
  }
}
await browser.close();
const lines = Object.entries(inv).map(([k, v]) => [k, Object.values(v).reduce((a, b) => a + b, 0), JSON.stringify(v)]).sort((a, b) => b[1] - a[1]);
for (const l of lines.slice(0, topN)) console.log(l[0].padEnd(40), String(l[1]).padStart(5), l[2]);
