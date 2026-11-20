// Checks the extra Litrus shop types and word banks (public/litrus-mixer/shop-types-*.js) against the
// builder's own copy rules (COPY_RULES in public/litrus-mixer/index.html).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const FILES = ['shop-types-products-a.js', 'shop-types-products-b.js', 'shop-types-services.js'];
const RULES = { heroTitle: [2, 5], heroSub: [8, 16], cta: [2, 3], slogan: [2, 5], promo: [4, 9], aboutText: [15, 35], reviewLine: [5, 12], category: [1, 3] };
const MINIMUM = { categories: 4, heroTitle: 8, heroSub: 6, cta: 6, slogan: 6, promo: 6, aboutText: 3, reviewLine: 6 };
// Claims the shop may not be able to keep, or that only the owner can make.
const BANNED = /\b(free|best|cheapest|guarantee[ds]?|24\/7|same[- ]day|fastest|#1|number one|award|certified|licensed|discount|% off|sale)\b|\d/i;
const BUILT_IN = ['shoes', 'clothing', 'food', 'beauty', 'electronics', 'salon', 'barber', 'repair', 'wellness', 'other-service'];
const words = text => String(text).trim().split(/\s+/).filter(Boolean).length;

async function load(file) {
  const source = await readFile(new URL(`../public/litrus-mixer/${file}`, import.meta.url), 'utf8');
  const window = {};
  vm.runInNewContext(source, { window });
  return window.LITRUS_SHOP_TYPES || [];
}

test('every shop-types file registers well-formed types that follow the copy rules', async () => {
  const seen = new Map();
  for (const file of FILES) {
    const entries = await load(file);
    assert.ok(entries.length, `${file} registers at least one type`);
    for (const entry of entries) {
      const where = `${file} → ${entry.id}`;
      assert.match(entry.id, /^[a-z][a-z-]*$/, `${where}: id is lower-case words joined by dashes`);
      assert.ok(!seen.has(entry.id), `${where}: id also used in ${seen.get(entry.id)}`);
      seen.set(entry.id, file);
      assert.ok(['products', 'services'].includes(entry.offer), `${where}: offer is products or services`);
      const builtIn = BUILT_IN.includes(entry.id);
      if (!builtIn) {
        assert.ok(typeof entry.label === 'string' && entry.label.length >= 3 && entry.label.length <= 40, `${where}: label`);
        assert.ok(typeof entry.copy.what === 'string' && words(entry.copy.what) <= 6, `${where}: what is a short phrase`);
      }
      for (const [slot, minimum] of Object.entries(MINIMUM)) {
        const list = entry.copy[slot];
        assert.ok(Array.isArray(list), `${where}: ${slot} is a list`);
        if (!builtIn) assert.ok(list.length >= minimum, `${where}: ${slot} has ${list.length}, needs ${minimum}`);
        assert.equal(new Set(list).size, list.length, `${where}: ${slot} has duplicates`);
        const [low, high] = RULES[slot === 'categories' ? 'category' : slot];
        for (const text of list) {
          assert.equal(typeof text, 'string', `${where}: ${slot} holds text`);
          const count = words(text);
          assert.ok(count >= low && count <= high, `${where}: ${slot} "${text}" has ${count} words, rule is ${low}-${high}`);
          assert.doesNotMatch(text, BANNED, `${where}: ${slot} "${text}" makes a claim or uses a number`);
          assert.doesNotMatch(text, /[<>{}]/, `${where}: ${slot} "${text}" has markup characters`);
        }
      }
    }
  }
  assert.ok(seen.size >= 30, `expected at least 30 types across the files, found ${seen.size}`);
});

test('the builder loads the shop-types files before its own script and merges them', async () => {
  const html = await readFile(new URL('../public/litrus-mixer/index.html', import.meta.url), 'utf8');
  const live = html.indexOf('<script src="/litrus-mixer/live-catalog.js"></script>');
  for (const file of FILES) {
    const at = html.indexOf(`<script src="/litrus-mixer/${file}"></script>`);
    assert.ok(at > live, `${file} is loaded after live-catalog.js`);
    assert.ok(at < html.indexOf('const OFFER_TYPE_OPTIONS='), `${file} is loaded before the builder script`);
  }
  assert.match(html, /\(window\.LITRUS_SHOP_TYPES\|\|\[\]\)\.forEach/);
});
