import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../public/litrus-mixer/index.html', import.meta.url), 'utf8');
const MARK = '/* Corner and radius normalisation';
const start = html.indexOf(MARK);
const block = start < 0 ? '' : html.slice(start, html.indexOf('</style>', start));

// Every CSS rule in the file's <style> blocks as [selector, body] pairs (media queries are flattened).
const rules = [];
for (const style of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
  const css = style[1].replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) rules.push([m[1].trim().replace(/\s+/g, ' '), m[2].trim()]);
}

test('the corner and radius block exists once, with the radius scale as CSS variables', () => {
  assert.ok(start > 0, 'missing "Corner and radius normalisation" block');
  assert.equal(html.split(MARK).length - 1, 1, 'the block must exist exactly once');
  for (const name of ['--lr-0:0px', '--lr-sm:', '--lr-md:', '--lr-full:999px', '--lr-card:', '--lr-ctl:', '--lr-inset:']) {
    assert.ok(block.includes(name), `scale variable ${name} is missing`);
  }
  assert.match(block, /--lr-card:var\(--sole-card-radius,0px\)/, 'card radius must come from the Card corners control');
  assert.match(block, /--lr-ctl:var\(--sole-ctl-radius,min\(var\(--btn-radius,0px\),var\(--lr-sm\)\)\)/, 'controls follow the control radius, else the mood radius capped at small');
});

test('the builder sets the control radius next to the card radius, on the same scale as the Card corners options', () => {
  const card = html.indexOf("wrap.style.setProperty('--sole-card-radius'");
  const ctl = html.indexOf("wrap.style.setProperty('--sole-ctl-radius'");
  assert.ok(card > 0 && ctl > card && ctl - card < 400, '--sole-ctl-radius must be set right after --sole-card-radius');
  const map = html.slice(ctl, ctl + 200);
  for (const [value, radius] of [['0', '0px'], ['8', '6px'], ['16', '12px'], ['28', '999px']]) assert.ok(map.includes(`${value}:'${radius}'`), `Card corners ${value} must map to ${radius}`);
  const options = [...html.match(/<select id="cRad">([\s\S]*?)<\/select>/)[1].matchAll(/value="(\d*)"/g)].map(m => m[1]).filter(Boolean);
  assert.deepEqual(options, ['0', '8', '16', '28'], 'the Card corners options changed: update the scale map');
});

test('buttons, icon buttons, badges, favourites, inputs and hero buttons all use the control radius', () => {
  for (const sel of ['.sole-product .p-btn', '.sole-product .sole-product-add', '.sole-product .p-icon-btn', '.sole-product .sole-favorite', '.sole-product .p-badge', '.hero-btn']) {
    assert.ok(block.includes(`html .sole-store ${sel}`), `${sel} is not on the radius scale`);
  }
  assert.match(block, /border-radius:min\(var\(--lr-ctl\),var\(--lr-full\)\)!important/);
  assert.match(block, /textarea\{border-radius:min\(var\(--lr-ctl\),var\(--lr-md\)\)!important\}/, 'a textarea must never become a capsule');
  assert.match(block, /input:not\(\[type=checkbox\]\)[^{]*select\{border-radius:min\(var\(--lr-ctl\),22px\)!important\}/, 'single-line fields are capped at half a normal field height');
  assert.match(block, /\.sp\{--sp-r:var\(--lr-ctl\)\}/, 'product page buttons and quantity box follow the same control radius');
});

test('photos that touch a card corner use the card radius and inset photos use a concentric inset radius', () => {
  for (const n of [9, 16, 19, 21, 25]) {
    assert.ok(block.includes(`.p-card.style-${n} .sole-product-photo`), `style-${n} photo is not tied to the card radius`);
  }
  assert.match(block, /\.style-25 \.sole-product-photo\{border-radius:var\(--lr-card\) var\(--lr-card\) 0 0!important\}/);
  assert.match(block, /\.card-sneaker \.sole-product-photo[^{]*\{border-radius:var\(--lr-inset\)!important\}/);
  assert.match(block, /\.style-26 \.sole-product-photo\{border-radius:var\(--lr-inset\) var\(--lr-inset\) 0 0!important\}/);
});

test('surfaces next to product cards follow the card radius instead of a fixed number', () => {
  for (const sel of ['.sp-gallery', '.sp-sum', '.cgw .cat-neu-wrap', '.cgw .cat-split-img', '.layout-n-bento .bn-t', '.f-bento .box', '.f-glass .panel']) {
    assert.ok(block.includes(`html .sole-store ${sel}`), `${sel} keeps an unrelated fixed radius`);
  }
  assert.match(block, /\{border-radius:var\(--lr-card\)!important\}/);
});

test('shaped (clip-path) elements never cut a product card, its photo, name, price or buttons', () => {
  const cardSelector = /\.p-card|\.sole-product|\.p-img-wrap|\.p-img-wrapper|\.p-btn|\.p-title|\.p-price/;
  const shaped = rules.filter(([, body]) => /clip-path:\s*(polygon|path|ellipse|circle\((?!\s*(0|1[0-9]{2}|75)%))/.test(body.replace(/!important/g, '')));
  for (const [selector, body] of shaped) {
    for (const part of selector.split(',')) {
      assert.ok(!cardSelector.test(part) || /\.rev-|\.sx-|reveal/.test(part), `"${part.trim()}" clips a card part with: ${body}`);
    }
  }
});

test('the card-shape table is data only: no unsafe shape can reach a product card', () => {
  const table = html.match(/SHP=\{([\s\S]*?)\},ANI=/);
  assert.ok(table, 'SHP table not found');
  const unsafe = [...table[1].matchAll(/"([a-z0-9-]+)": \["clip-path:/g)].map(m => m[1]);
  assert.ok(unsafe.length >= 10, 'expected the clip-path shapes to be listed');
  for (const name of ['triangle', 'star', 'cross', 'arrow-right', 'chevron', 'pentagon', 'diamond', 'parallelogram', 'trapezoid']) assert.ok(unsafe.includes(name), `${name} should be on the unsafe list`);
  const uses = html.match(/\bSHP\s*[\[.(]|Object\.(keys|values|entries)\(SHP\)|\bin SHP\b|\.\.\.SHP\b/g) || [];
  assert.equal(uses.length, 0, 'SHP is applied somewhere: add a safe inner area for the shapes before using it on cards');
});

test('the hexagon category tile keeps its label inside the safe area of the hexagon', () => {
  assert.ok(rules.some(([s, b]) => s.includes('.cgw .cat-hex') && b.includes('clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%')), 'hexagon rule not found');
  assert.match(block, /\.cgw \.cat-hex h3\{left:12%;width:76%;bottom:24%;/, 'label must sit in the safe inner area (12% to 88% wide, above the lower corners)');
  assert.match(block, /\.cat-hex h3[^{]*\{[^}]*overflow-wrap:anywhere/, 'long labels must wrap inside the hexagon');
  assert.match(block, /\.cat-hex h3[^{]*\{[^}]*min-width:0!important/, 'the global 160px minimum width on headings must not push the label out of the hexagon');
});

test('the add button never overhangs the photo and focus rings stay inside clipped cards', () => {
  assert.match(block, /\.sole-product-photo \.sole-product-add\{max-width:calc\(100% - 22px\);box-sizing:border-box\}/);
  assert.match(block, /\.sole-product :is\(a,button\):focus-visible\{outline-offset:-3px\}/);
  assert.match(block, /\.sp-qty button:focus-visible,[^{]*\.litrus-category-link:focus-visible\{outline-offset:-3px\}/);
});

test('the corner block touches only radius, clipping and overflow, never colours, fonts or layout', () => {
  const css = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const allowed = new Set(['border-radius', 'max-width', 'min-width', 'box-sizing', 'outline-offset', 'left', 'width', 'bottom', 'line-height', 'overflow-wrap']);
  let declarations = 0;
  for (const m of css.matchAll(/\{([^{}]*)\}/g)) {
    for (const decl of m[1].split(';').map(d => d.trim()).filter(Boolean)) {
      const name = decl.slice(0, decl.indexOf(':')).trim();
      declarations++;
      assert.ok(allowed.has(name) || name.startsWith('--lr-') || name.startsWith('--sp-r'), `unexpected property "${name}" in the corner block`);
    }
  }
  assert.ok(declarations > 20, 'expected the corner block to contain declarations');
});
