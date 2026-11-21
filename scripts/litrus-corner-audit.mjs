// Corner and radius audit for Litrus Mixer storefront looks, measured at 390px in the builder preview.
// Runs every mood plus N seeded Shuffle mixes on home, shop and a product page and counts, per problem and per option:
//   pokeOut   a child touches a rounded corner of a parent that does not clip it and the child's own radius is smaller
//   wedge     a child's corner is rounder than the rounded parent corner it sits in (gap shows)
//   squareIn  a child with a radius sits flush in the corner of a square (radius 0) parent
//   clipped   shaped (clip-path) element hides a name, price, button or badge
//   capsule   a tall element (height > 1.4 x width, width > 60px) whose corners are rounded to half its width or more
//   mixed     the look uses unrelated radius steps for cards, buttons, inputs and badges
//   ringClip  a focusable control sits within 3px of an overflow:hidden parent edge and its focus ring is not drawn inside it
// Usage: node scripts/litrus-corner-audit.mjs [baseUrl] [shuffles] [--json out.json] [--page index.html]
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--json' && all[i - 1] !== '--page');
const pageName = process.argv.includes('--page') ? process.argv[process.argv.indexOf('--page') + 1] : 'index.html';
const base = args[0] || 'http://127.0.0.1:5191';
const SHUFFLES = Number(args[1] ?? 40);
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : '';
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
await page.addInitScript(() => { let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
await page.route(`${base}/__audit-img/**`, route => {
  const [w, h] = route.request().url().match(/(\d+)x(\d+)/).slice(1).map(Number);
  route.fulfill({ contentType: 'image/svg+xml', body: svg(w, h) });
});
await page.goto(`${base}/litrus-mixer/${pageName}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#shuf', { state: 'attached', timeout: 90000 });
await page.waitForTimeout(2000);
await page.evaluate(({ products, cats }) => {
  window.litrusSetCraftCatalog({ shop: { name: 'Audit Shop', currency: 'KES' }, categories: cats.map(name => ({ name })), products });
  document.documentElement.classList.add('mobile-preview'); window.dispatchEvent(new Event('resize'));
}, { products, cats });
const moods = await page.$$eval('#wMoods button.mood', list => list.map(b => b.textContent.trim()));

const measure = () => page.evaluate(async () => {
  const frame = document.getElementById('storePreviewFrame'), doc = frame.contentDocument, win = frame.contentWindow;
  const root = doc.scrollingElement;
  for (let y = 0; y <= root.scrollHeight; y += 500) { root.scrollTop = y; await new Promise(r => setTimeout(r, 30)); }
  root.scrollTop = 0; await new Promise(r => setTimeout(r, 250));
  const store = doc.querySelector('.sole-store') || doc.body;
  const cs = e => win.getComputedStyle(e);
  const label = e => { const c = (e.getAttribute('class') || '').split(/\s+/).filter(x => x && !/^(reveal|is-visible|sole-store|rev-|hov-|cont-)/.test(x)); return (e.tagName.toLowerCase() + (c[0] ? '.' + c[0] : '')); };
  const vis = (r, s) => r.width > 8 && r.height > 8 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05;
  const out = { pokeOut: [], squareIn: [], wedge: [], clipped: [], capsule: [], mixed: [], ringClip: [] };
  const info = new Map();
  for (const e of store.querySelectorAll('*')) { const r = e.getBoundingClientRect(), s = cs(e); if (vis(r, s)) info.set(e, { r, s }); }
  const keys = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
  const eff = (e, i) => {
    const { r, s } = info.get(e), parts = s[keys[i]].split(' ');
    const toPx = (p, d) => p.endsWith('%') ? parseFloat(p) / 100 * d : parseFloat(p) || 0;
    return Math.min(toPx(parts[0], r.width), toPx(parts[1] || parts[0], r.height), Math.min(r.width, r.height) / 2);
  };
  const bwSum = s => [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].reduce((n, v) => n + parseFloat(v), 0);
  const near = (a, b) => Math.abs(a - b) <= 1.5;
  for (const e of info.keys()) {
    const { r, s } = info.get(e); const clipSelf = s.clipPath && s.clipPath !== 'none';
    let p = e.parentElement;
    while (p && !info.has(p) && p !== store.parentElement) p = p.parentElement;
    if (!p || !info.has(p) || p.matches('.prods,.sole-product-grid')) continue;
    const pi = info.get(p);
    const pc = [0, 1, 2, 3].map(i => eff(p, i)), ec = [0, 1, 2, 3].map(i => eff(e, i));
    const pClips = /(hidden|clip|auto|scroll)/.test(pi.s.overflowX + pi.s.overflowY) || (pi.s.clipPath && pi.s.clipPath !== 'none');
    const pPainted = (pi.s.backgroundColor !== 'rgba(0, 0, 0, 0)' && pi.s.backgroundColor !== 'transparent') || pi.s.backgroundImage !== 'none' || bwSum(pi.s) > 0 || pi.s.boxShadow !== 'none';
    if (!pPainted) continue;
    const hasBg = (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') || s.backgroundImage !== 'none' || ['IMG', 'VIDEO', 'svg'].includes(e.tagName);
    if (!hasBg || r.width < 24 || r.height < 24) continue;
    const bw = [pi.s.borderTopWidth, pi.s.borderRightWidth, pi.s.borderBottomWidth, pi.s.borderLeftWidth].map(parseFloat);
    const flush = [
      near(r.left, pi.r.left + bw[3]) && near(r.top, pi.r.top + bw[0]),
      near(r.right, pi.r.right - bw[1]) && near(r.top, pi.r.top + bw[0]),
      near(r.right, pi.r.right - bw[1]) && near(r.bottom, pi.r.bottom - bw[2]),
      near(r.left, pi.r.left + bw[3]) && near(r.bottom, pi.r.bottom - bw[2])
    ];
    for (let i = 0; i < 4; i++) {
      if (!flush[i]) continue;
      const pr = Math.max(0, pc[i] - Math.max(bw[i], bw[(i + 3) % 4]));
      if (pr >= 3 && !pClips && ec[i] < pr - 2 && !clipSelf) out.pokeOut.push(label(p) + ' > ' + label(e));
      else if (pc[i] === 0 && ec[i] >= 3 && !clipSelf) out.squareIn.push(label(p) + ' > ' + label(e));
      else if (pc[i] > 0 && ec[i] > pr + 2 && !clipSelf) out.wedge.push(label(p) + ' > ' + label(e));
    }
  }
  for (const e of info.keys()) {
    const { r, s } = info.get(e); const m = Math.min(r.width, r.height), M = Math.max(r.width, r.height);
    if (m < 60 || (r.height / r.width) < 1.4 || !['IMG', 'DIV', 'A', 'ARTICLE', 'SECTION', 'FIGURE', 'LI'].includes(e.tagName)) continue;
    const c = [0, 1, 2, 3].map(i => eff(e, i));
    const painted = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || e.tagName === 'IMG' || parseFloat(s.borderTopWidth) > 0;
    if (painted && c.filter(v => v >= m / 2 - 1).length >= 2) out.capsule.push(label(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  for (const e of info.keys()) {
    const { s, r } = info.get(e);
    if (!s.clipPath || s.clipPath === 'none' || !/polygon|path|circle|ellipse/.test(s.clipPath)) continue;
    if (/circle\(1[0-9]{2}%|circle\(75%/.test(s.clipPath)) continue;
    const poly = s.clipPath.match(/polygon\((.*)\)/);
    const inside = (x, y) => {
      if (!poly) return true;
      const pts = poly[1].split(',').map(t => t.trim().split(/\s+/)).map(([a, b]) => [a.endsWith('%') ? parseFloat(a) / 100 * r.width : parseFloat(a), b.endsWith('%') ? parseFloat(b) / 100 * r.height : parseFloat(b)]);
      let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c;
    };
    for (const k of e.querySelectorAll('h1,h2,h3,h4,.p-title,.p-price,button,.p-btn,.p-badge,.p-icon-btn,[data-litrus-category-name]')) {
      const kr = k.getBoundingClientRect(); if (kr.width < 2 || kr.height < 2) continue;
      const pts = [[kr.left, kr.top], [kr.right, kr.top], [kr.right, kr.bottom], [kr.left, kr.bottom]].map(([x, y]) => [x - r.left, y - r.top]);
      if (pts.some(([x, y]) => !inside(x, y))) out.clipped.push(label(e) + ' hides ' + label(k));
    }
  }
  const step = (v, h) => v <= 0.5 ? 0 : v >= h / 2 - 1 && h > 0 ? 4 : v <= 8 ? 1 : v <= 20 ? 2 : 3;
  const pick = sel => [...store.querySelectorAll(sel)].filter(e => info.has(e)).slice(0, 6).map(e => { const { r } = info.get(e); return step(Math.max(...[0, 1, 2, 3].map(i => eff(e, i))), Math.min(r.height, r.width)); });
  const groups = {
    card: pick('.sole-product'),
    button: pick('.sole-product-add,.p-btn,.sole-hero a.sole-btn,.sole-hero .btn,.sole-hero button,.sole-button'),
    input: pick('input:not([type=checkbox]):not([type=radio]):not(.sp-qtyv),select,textarea'),
    badge: pick('.p-badge,.sole-product-badge,.sole-badge')
  };
  const dominant = a => { if (!a.length) return null; const m = new Map(); a.forEach(v => m.set(v, (m.get(v) || 0) + 1)); return [...m.entries()].sort((x, y) => y[1] - x[1])[0][0]; };
  const dom = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, dominant(v)]));
  const present = ['card', 'button', 'input'].map(k => dom[k]).filter(v => v !== null);
  if (present.length && Math.max(...present) - Math.min(...present) >= 3) out.mixed.push(JSON.stringify(dom));
  for (const e of store.querySelectorAll('a,button,input,select,textarea,[tabindex]')) {
    if (!info.has(e)) continue; const r = info.get(e).r; let p = e.parentElement, hops = 0;
    while (p && p !== store && hops++ < 4) {
      const ps = cs(p);
      if (/hidden|clip/.test(ps.overflowX + ps.overflowY) && info.has(p)) {
        const pr = info.get(p).r;
        e.focus({ focusVisible: true }); const safe = parseFloat(cs(e).outlineOffset) < 0; e.blur();
        if (!safe && r.width * r.height < pr.width * pr.height * 0.8 && (r.left - pr.left < 3 || pr.right - r.right < 3 || r.top - pr.top < 3 || pr.bottom - r.bottom < 3) && !/hero|marquee|scroll|bgo|track/.test(p.className)) out.ringClip.push(label(p) + ' > ' + label(e));
        break;
      }
      p = p.parentElement;
    }
  }
  const sel = id => document.getElementById(id);
  const opts = ['selCard', 'selCat', 'selHero', 'selLay', 'selPal', 'cRad'].map(id => { const s = sel(id); return s ? (s.options[s.selectedIndex]?.text || s.value) : ''; });
  return { out, opts, dom };
});

const goPage = async value => { await page.evaluate(v => { const s = document.getElementById('selPage'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, value); await page.waitForTimeout(800); };
const report = [], looks = [];
for (let i = 0; i < moods.length; i++) looks.push({ kind: 'mood', name: moods[i], i });
for (let i = 0; i < SHUFFLES; i++) looks.push({ kind: 'shuffle', name: 'shuffle ' + (i + 1), i });
for (const look of looks) {
  if (look.kind === 'mood') await page.evaluate(i => document.querySelectorAll('#wMoods button.mood')[i].click(), look.i);
  else await page.evaluate(() => document.getElementById('shuf').click());
  await page.waitForTimeout(900);
  for (const view of ['home', 'shop', 'p/100']) {
    await goPage(view);
    const m = await measure();
    report.push({ look: look.name, kind: look.kind, view, opts: m.opts, dom: m.dom, ...m.out });
  }
}
await browser.close();
const kinds = ['pokeOut', 'squareIn', 'wedge', 'clipped', 'capsule', 'mixed', 'ringClip'];
console.log(`looks ${looks.length}, pages ${report.length}`);
for (const k of kinds) {
  const total = report.reduce((n, r) => n + r[k].length, 0), pages = report.filter(r => r[k].length).length;
  const byEl = new Map(); report.forEach(r => r[k].forEach(x => byEl.set(x, (byEl.get(x) || 0) + 1)));
  const top = [...byEl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x, n]) => `${x} x${n}`).join(' | ');
  console.log(`${k.padEnd(9)} total ${String(total).padStart(5)}  pages ${String(pages).padStart(4)}  top: ${top}`);
}
const tally = idx => { const t = {}; for (const r of report) { const key = r.opts[idx] || "card's own"; t[key] ??= { pages: 0 }; t[key].pages++; for (const k of kinds) t[key][k] = (t[key][k] || 0) + (r[k].length ? 1 : 0); } return t; };
console.log('by card style (pages with problem):'); console.table(tally(0));
console.log('by card corners control:'); console.table(tally(5));
const worst = report.map(r => ({ look: r.look, view: r.view, opts: r.opts.join(' / '), n: kinds.reduce((n, k) => n + r[k].length, 0) })).sort((a, b) => b.n - a.n).slice(0, 8);
console.log('worst pages:'); worst.forEach(w => console.log(w.n, w.look, w.view, '|', w.opts));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
