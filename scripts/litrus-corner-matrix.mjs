// Matrix: every product card style x every Card corners value, on the shop page at 390px.
// Prints the computed radii of card, photo wrapper, photo, add button, icon buttons, badge, plus overflow.
// Usage: node scripts/litrus-corner-matrix.mjs [baseUrl] [--bad]   (--bad prints only rows with a mismatch)
import { chromium } from 'playwright';
const base = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:5191';
const onlyBad = process.argv.includes('--bad');
const cats = ['Shoes', 'Bags', 'Dresses', 'Watches', 'Hats', 'Jackets'], SHAPES = [[800, 1200], [1200, 800], [1000, 1000], [600, 1400]];
const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#c9b8a6"/></svg>`;
const products = Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, name: `Product ${i + 1} classic`, price: 1500 + i * 250, category_names: [cats[i % 6]], stock: 5, description: 'A well made everyday item.', images: [`${base}/__audit-img/p${i}-${SHAPES[i % 4].join('x')}.svg`] }));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.route(`${base}/__audit-img/**`, r => { const [w, h] = r.request().url().match(/(\d+)x(\d+)/).slice(1).map(Number); r.fulfill({ contentType: 'image/svg+xml', body: svg(w, h) }); });
await page.goto(`${base}/litrus-mixer/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#shuf', { state: 'attached', timeout: 90000 }); await page.waitForTimeout(2000);
await page.evaluate(({ products, cats }) => { window.litrusSetCraftCatalog({ shop: { name: 'Audit Shop', currency: 'KES' }, categories: cats.map(name => ({ name })), products }); document.documentElement.classList.add('mobile-preview'); window.dispatchEvent(new Event('resize')); }, { products, cats });
await page.evaluate(() => { const s = document.getElementById('selPage'); s.value = 'shop'; s.dispatchEvent(new Event('change', { bubbles: true })); });
const nCards = await page.evaluate(() => document.getElementById('selCard').options.length);
const radVals = await page.evaluate(() => [...document.getElementById('cRad').options].map(o => o.value));
const set = (id, v) => page.evaluate(([id, v]) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const rows = [];
for (let c = 0; c < nCards; c++) {
  await page.evaluate(c => { const s = document.getElementById('selCard'); s.selectedIndex = c; s.dispatchEvent(new Event('change', { bubbles: true })); }, c);
  for (const rv of radVals) {
    await set('cRad', rv); await page.waitForTimeout(500);
    const row = await page.evaluate(() => {
      const d = document.getElementById('storePreviewFrame').contentDocument, w = d.defaultView, card = d.querySelector('.sole-product'); if (!card) return null;
      const g = (sel, root = card) => { const e = root.querySelector(sel); if (!e) return '-'; const s = w.getComputedStyle(e), r = e.getBoundingClientRect(); const rr = s.borderRadius.split(' ')[0]; return rr.endsWith('%') ? rr : Math.round(parseFloat(rr)); };
      const cs = w.getComputedStyle(card);
      return { name: document.getElementById('selCard').selectedOptions[0].text, card: Math.round(parseFloat(cs.borderTopLeftRadius)), ov: cs.overflow, photo: g('.sole-product-photo'), img: g('.sole-product-photo img'), add: g('.sole-product-add'), icon: g('.p-icon-btn'), badge: g('.p-badge'), fav: g('.sole-favorite'), clip: cs.clipPath, inset: (() => { const p = card.querySelector('.sole-product-photo'); if (!p) return '-'; const a = card.getBoundingClientRect(), b = p.getBoundingClientRect(); return Math.round(b.left - a.left) + ',' + Math.round(b.top - a.top) + ',' + Math.round(a.right - b.right); })(), pr: (() => { const p = card.querySelector('.sole-product-photo'); return p ? w.getComputedStyle(p).borderRadius : '-'; })() };
    });
    if (row) rows.push({ rv: rv || 'own', ...row });
  }
}
await browser.close();
const bad = r => (r.card > 0 && typeof r.photo === 'number' && r.photo === 0 && r.ov === 'visible') || (r.card === 0 && typeof r.photo === 'number' && r.photo > 0);
console.table(rows.filter(r => !onlyBad || bad(r)));
console.log('rows', rows.length, 'bad', rows.filter(bad).length);
