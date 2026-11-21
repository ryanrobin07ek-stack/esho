// Saves full-page storefront screenshots of chosen moods/shuffles for corner review.
// Usage: node scripts/litrus-corner-shot.mjs outDir "Mood A,Mood B" [view] [shuffleCount] [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [outDir, moodList = '', view = 'home', shuffles = '0', base = 'http://127.0.0.1:5191'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const cats = ['Shoes', 'Bags', 'Dresses', 'Watches', 'Hats', 'Jackets'], SHAPES = [[800, 1200], [1200, 800], [1000, 1000], [600, 1400], [1600, 900], [900, 900]];
const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#c9b8a6"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#7a5c45"/></svg>`;
const products = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Product ${i + 1} classic`, price: 1500 + i * 250, category_names: [cats[i % 6]], stock: 5, description: 'A well made everyday item.', images: i % 5 === 4 ? [] : [`${base}/__audit-img/p${i}-${SHAPES[i % 6].join('x')}.svg`] }));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => { let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
await page.route(`${base}/__audit-img/**`, r => { const [w, h] = r.request().url().match(/(\d+)x(\d+)/).slice(1).map(Number); r.fulfill({ contentType: 'image/svg+xml', body: svg(w, h) }); });
await page.goto(`${base}/litrus-mixer/${process.env.PAGE || "index.html"}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#shuf', { state: 'attached', timeout: 90000 }); await page.waitForTimeout(2000);
await page.evaluate(({ products, cats }) => { window.litrusSetCraftCatalog({ shop: { name: 'Audit Shop', currency: 'KES' }, categories: cats.map(name => ({ name })), products }); document.documentElement.classList.add('mobile-preview'); window.dispatchEvent(new Event('resize')); }, { products, cats });
const shot = async name => {
  await page.evaluate(v => { const s = document.getElementById('selPage'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, view); await page.waitForTimeout(900);
  await page.evaluate(async () => { const d = document.getElementById('storePreviewFrame').contentDocument, r = d.scrollingElement; for (let y = 0; y <= r.scrollHeight; y += 500) { r.scrollTop = y; await new Promise(x => setTimeout(x, 40)); } r.scrollTop = 0; await new Promise(x => setTimeout(x, 300)); });
  const h = await page.evaluate(() => document.getElementById('storePreviewFrame').contentDocument.scrollingElement.scrollHeight);
  await page.setViewportSize({ width: 390, height: Math.min(h + 200, 6000) }); await page.waitForTimeout(700);
  await page.evaluate(async () => { const d = document.getElementById('storePreviewFrame').contentDocument, r = d.scrollingElement; for (let y = 0; y <= r.scrollHeight; y += 500) { r.scrollTop = y; await new Promise(x => setTimeout(x, 30)); } r.scrollTop = 0; await new Promise(x => setTimeout(x, 300)); });
  const el = await page.$('#storePreviewFrame');
  if (process.env.SCROLL) { await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(y => { document.getElementById('storePreviewFrame').contentDocument.scrollingElement.scrollTop = +y; }, process.env.SCROLL); await page.waitForTimeout(600); await page.screenshot({ path: `${outDir}/${name.replace(/[^a-z0-9]+/gi, '-')}-${view.replace('/', '_')}-y${process.env.SCROLL}.png` }); console.log('saved', name); return; }
  await el.screenshot({ path: `${outDir}/${name.replace(/[^a-z0-9]+/gi, '-')}-${view.replace('/', '_')}.png` });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
  console.log('saved', name, await page.evaluate(() => ['selCard', 'selCat', 'selHero', 'selLay', 'cRad'].map(id => { const s = document.getElementById(id); return s.options[s.selectedIndex]?.text }).join(' / ')));
};
const moods = await page.$$eval('#wMoods button.mood', l => l.map(b => b.textContent.trim()));
for (const m of moodList.split(',').filter(Boolean)) { const i = moods.indexOf(m); if (i < 0) { console.log('no mood', m); continue; } await page.evaluate(i => document.querySelectorAll('#wMoods button.mood')[i].click(), i); await page.waitForTimeout(900); await shot(m); }
for (let i = 0; i < +shuffles; i++) { await page.evaluate(() => document.getElementById('shuf').click()); await page.waitForTimeout(900); await shot('shuffle' + (i + 1)); }
await browser.close();
