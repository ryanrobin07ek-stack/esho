// Probe: set a mood, open a page, and print corner-related computed style for a selector in the preview.
// Usage: node scripts/litrus-corner-probe.mjs "Mood" view "selector" [cardName radiusValue] [baseUrl]
import { chromium } from 'playwright';
const [mood, view = 'shop', selector = '.sole-product', cardName = '', radius = '', base = 'http://127.0.0.1:5191'] = process.argv.slice(2);
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
const moods = await page.$$eval('#wMoods button.mood', l => l.map(b => b.textContent.trim()));
if (mood !== '-') { await page.evaluate(i => document.querySelectorAll('#wMoods button.mood')[i].click(), moods.indexOf(mood)); await page.waitForTimeout(900); }
if (cardName) await page.evaluate(([n, r]) => { const s = document.getElementById('selCard'); s.selectedIndex = [...s.options].findIndex(o => o.text === n); s.dispatchEvent(new Event('change', { bubbles: true })); const c = document.getElementById('cRad'); c.value = r; c.dispatchEvent(new Event('change', { bubbles: true })); }, [cardName, radius]);
if (process.env.CAT) await page.evaluate(n => { const s = document.getElementById('selCat'); s.selectedIndex = [...s.options].findIndex(o => o.text.includes(n)); s.dispatchEvent(new Event('change', { bubbles: true })); }, process.env.CAT);
await page.evaluate(v => { const s = document.getElementById('selPage'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, view); await page.waitForTimeout(1200);
const res = await page.evaluate(sel => {
  const d = document.getElementById('storePreviewFrame').contentDocument, w = d.defaultView;
  const e = d.querySelector(sel); if (!e) return 'not found';
  const lines = []; const dump = (el, depth) => {
    const s = w.getComputedStyle(el), r = el.getBoundingClientRect();
    lines.push(' '.repeat(depth * 2) + el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '').replace(/\s+/g, '.') + ` ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)} rad=${s.borderRadius} ov=${s.overflow} clip=${s.clipPath} bg=${s.backgroundColor} bd=${s.borderTopWidth} sh=${s.boxShadow.slice(0, 30)}`);
    if (depth < 3) [...el.children].forEach(c => dump(c, depth + 1));
  }; dump(e, 0); return lines.join('\n');
}, selector);
console.log(res);
await browser.close();
