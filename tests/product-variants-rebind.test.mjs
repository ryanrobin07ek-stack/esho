// Re-opening a saved product used to wipe its options: the owner app wrote the variant markup into a
// host <div> and then bound that div, while the saved values live in data-initial-* on the <section>
// the markup produces. The editor opened blank and the next save stored the blank back, so every
// size, colour and per-variant price disappeared.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
  bindProductVariantFields, createProductVariantFields, readProductVariantFields
} from '../src/product-variants.js';

const SHIRT = {
  option1Name: 'Size',
  option2Name: 'Colour',
  sizes: ['S', 'M', 'L'],
  colors: ['Red'],
  variants: [
    { option1_value: 'S', option2_value: 'Red', price: 1000, stock: 10 },
    { option1_value: 'M', option2_value: 'Red', price: 1200, stock: 12 },
    { option1_value: 'L', option2_value: 'Red', price: 1500, stock: 14 }
  ]
};

function mountLikeOwnerApp() {
  const dom = new JSDOM('<form><div data-web-product-variants></div></form>');
  const host = dom.window.document.querySelector('[data-web-product-variants]');
  host.innerHTML = createProductVariantFields(SHIRT);
  return { dom, host, form: dom.window.document.querySelector('form') };
}

test('the saved options live on the section, not on the host the markup is written into', () => {
  const { host } = mountLikeOwnerApp();
  assert.equal(host.dataset.initialVariants, undefined, 'the host div carries nothing');
  const section = host.firstElementChild;
  assert.ok(section, 'the markup produces a section');
  assert.equal(section.dataset.initialOption1Name, 'Size');
  assert.equal(section.dataset.initialSizes, 'S, M, L');
  assert.equal(JSON.parse(section.dataset.initialVariants).length, 3);
});

test('binding the section reopens a saved product with its sizes and per-size prices intact', () => {
  const { host, form } = mountLikeOwnerApp();
  bindProductVariantFields(host.firstElementChild);
  const read = readProductVariantFields(form.querySelector('[data-product-variants]') || host.firstElementChild);
  assert.equal(read.variants[0].option1_name, 'Size');
  assert.deepEqual(read.sizes, ['S', 'M', 'L']);
  assert.equal(read.variants.length, 3, 'all three sizes survive a reopen');
  assert.deepEqual(read.variants.map(variant => variant.price), [1000, 1200, 1500]);
});

test('the owner app binds the section, so saving again cannot blank the options', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const calls = [...source.matchAll(/bindProductVariantFields\(([^)]*)\)/g)].map(match => match[1].trim());
  assert.ok(calls.length >= 3, 'every product form binds the variant fields');
  for (const argument of calls) {
    assert.match(argument, /firstElementChild|variantFields/,
      `bindProductVariantFields(${argument}) must receive the section, never the host element`);
  }
});
