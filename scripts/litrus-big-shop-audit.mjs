// Audits how Litrus Mixer storefronts behave on a phone for a BIG shop (default 100 products, 25 categories).
// It runs all moods plus a fixed number of Shuffles (seeded, so runs can be compared) on the home page and
// the all-products page and prints, for the 390px phone viewport:
//   - median and maximum page length in screens (page height divided by the window height)
//   - how many looks draw ONE product per row on the shop page (more than 8 products on show, none side by side)
//   - how many looks stack more than 8 categories in one column on the home page (more than 8 on show, none side by side)
// Usage: node scripts/litrus-big-shop-audit.mjs [baseUrl] [--products 100] [--cats 25] [--shuffles 20]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : fallback; };
const base = args.find(a => /^https?:/.test(a)) || 'http://127.0.0.1:5201';
const SHOP_ONLY = args.includes('--shop-only'); // faster: skip the home page
const PRODUCTS = flag('products', 100), CATS = flag('cats', 25), SHUFFLES = flag('shuffles', 20);
const SHAPES = [[800, 1200], [1200, 800], [1000, 1000], [600, 1400], [1600, 900], [900, 900]];
const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#c9b8a6"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#7a5c45"/></svg>`;
const cats = Array.from({ length: CATS }, (_, i) => `${['Shoes', 'Bags', 'Dresses', 'Watches', 'Hats', 'Jackets', 'Scarves', 'Belts', 'Socks', 'Rings'][i % 10]} ${Math.floor(i / 10) + 1}-${i + 1}`);
const products = Array.from({ length: PRODUCTS }, (_, i) => ({
  id: 100 + i, name: `Product ${i + 1} ${['classic', 'leather', 'summer'][i % 3]}`, price: 1500 + i * 25,
  category_names: [cats[i % cats.length]], stock: 5, description: 'A well made everyday item from a small shop in Nairobi.',
  images: i % 7 === 4 ? [] : [`${base}/__audit-img/p${i}-${SHAPES[i % SHAPES.length].join('x')}.svg`]
}));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await page.addInitScript(() => { let s = 1234567; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
await page.route(`${base}/__audit-img/**`, route => {
  const [w, h] = route.request().url().match(/(\d+)x(\d+)/).slice(1).map(Number);
  route.fulfill({ contentType: 'image/svg+xml', body: svg(w, h) });
});
await page.goto(`${base}/litrus-mixer/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#shuf', { state: 'attached', timeout: 90000 });
await page.waitForTimeout(2000);
await page.evaluate(({ products, cats }) => {
  window.litrusSetCraftCatalog({ shop: { name: 'Big Audit Shop', currency: 'KES' }, categories: cats.map(name => ({ name })), products });
  document.documentElement.classList.add('mobile-preview'); window.dispatchEvent(new Event('resize'));
}, { products, cats });
const moods = await page.$$eval('#wMoods button.mood', list => list.map(b => b.textContent.trim()));

const measure = () => page.evaluate(() => {
  const frame = document.getElementById('storePreviewFrame'), doc = frame.contentDocument, win = frame.contentWindow;
  const root = doc.scrollingElement;
  const shown = el => { const r = el.getBoundingClientRect(), s = win.getComputedStyle(el); return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden'; };
  // How many items sit side by side: the number of distinct left edges, 60px apart (a skewed or staggered grid still has the same columns).
  const perRow = els => new Set(els.map(el => Math.round(el.getBoundingClientRect().left / 60))).size;
  const cards = [...doc.querySelectorAll('.sole-product')];
  const cardsOn = cards.filter(shown);
  const catLinks = [...doc.querySelectorAll('[data-litrus-category]')].filter(shown);
  const slugs = new Set(catLinks.map(a => a.getAttribute('data-litrus-category')));
  const marquee = !!doc.querySelector('.cat-marquee-wrap');
  return {
    screens: +(root.scrollHeight / win.innerHeight).toFixed(2),
    cards: cards.length, cardsOn: cardsOn.length, cardsPerRow: perRow(cardsOn), cardH: cardsOn.length ? Math.round(cardsOn[0].getBoundingClientRect().height) : 0,
    catsOn: marquee ? slugs.size : catLinks.length, catsPerRow: marquee ? 0 : perRow(catLinks), marquee,
    overflowPx: Math.max(0, root.scrollWidth - win.innerWidth)
  };
});

const goPage = async value => { await page.evaluate(v => { const s = document.getElementById('selPage'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, value); await page.waitForTimeout(900); };
const looks = [];
for (let i = 0; i < moods.length; i++) looks.push({ name: `mood ${moods[i]}`, apply: async () => { await page.evaluate(n => document.querySelectorAll('#wMoods button.mood')[n].click(), i); await page.waitForTimeout(900); } });
for (let i = 0; i < SHUFFLES; i++) looks.push({ name: `shuffle ${i + 1}`, apply: async () => { await page.evaluate(() => document.getElementById('shuf').click()); await page.waitForTimeout(1200); } });

const rows = [];
for (const look of looks) {
  await goPage('home');
  await look.apply();
  const card = await page.evaluate(() => `${document.getElementById('selCard').selectedOptions[0]?.textContent || ''} / ${document.getElementById('selCat').selectedOptions[0]?.textContent || ''} / ${document.getElementById('selLay').selectedOptions[0]?.textContent || ''}`);
  let home = { screens: 0, catsOn: 0, catsPerRow: 0, overflowPx: 0 };
  if (!SHOP_ONLY) { await goPage('home'); home = await measure(); }
  await goPage('shop'); const shop = await measure();
  rows.push({ look: look.name, styles: card, home, shop });
}
await browser.close();

const median = list => { const s = [...list].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const shopScreens = rows.map(r => r.shop.screens), homeScreens = rows.map(r => r.home.screens);
const onePerRow = rows.filter(r => r.shop.cardsOn > 8 && r.shop.cardsPerRow === 1);
const stacked = rows.filter(r => r.home.catsOn > 8 && r.home.catsPerRow === 1);
const COMPACT = 130; // a one-column list whose cards are this short or shorter is a compact list, not an endless stack of big cards
const compact = onePerRow.filter(r => r.shop.cardH <= COMPACT);
for (const r of onePerRow) console.log(`one product per row: ${r.look} (${r.styles}) card height ${r.shop.cardH}px${r.shop.cardH <= COMPACT ? " (compact list)" : ""}`);
for (const r of stacked) console.log(`stacked categories: ${r.look} (${r.styles}) shows ${r.home.catsOn}`);
for (const r of [...rows].sort((x, y) => y.shop.screens - x.shop.screens).slice(0, 3)) console.log(`longest shop page: ${r.shop.screens} screens, ${r.look} (${r.styles})`);
console.log(`\nshop of ${PRODUCTS} products and ${CATS} categories, ${rows.length} looks (${moods.length} moods + ${SHUFFLES} shuffles), 390px phone`);
console.log(`shop page length in screens: median ${median(shopScreens).toFixed(1)}, max ${Math.max(...shopScreens).toFixed(1)}`);
console.log(`home page length in screens: median ${median(homeScreens).toFixed(1)}, max ${Math.max(...homeScreens).toFixed(1)}`);
console.log(`looks drawing ONE product per row on the shop page: ${onePerRow.length} of ${rows.length} (${compact.length} of them are compact lists with cards up to ${COMPACT}px tall)`);
console.log(`looks stacking more than 8 categories in one column on the home page: ${stacked.length} of ${rows.length}`);
console.log(`products on show on the shop page (first look): ${rows[0].shop.cardsOn} of ${rows[0].shop.cards}; max sideways overflow ${Math.max(...rows.map(r => Math.max(r.shop.overflowPx, r.home.overflowPx)))}px`);
