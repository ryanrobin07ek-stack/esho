import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
import test from "node:test";
import {
  bindProductTaxonomyFields,
  createProductTaxonomyFields,
  loadProductTaxonomy,
  readProductTaxonomyFields
} from "../src/product-taxonomy.js";
const { loadProductTaxonomy: loadTaxonomyWithAndroidFallback } = await import("../src/product-taxonomy.js?android-fallback");

const compressedTaxonomy = await readFile(new URL("../public/data/shopify-product-taxonomy.json.gz", import.meta.url));
const taxonomy = JSON.parse(gunzipSync(compressedTaxonomy).toString("utf8"));
const posSource = await readFile(new URL("../src/pos.js", import.meta.url), "utf8");
const appHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const sneakerCategory = taxonomy.categories.find(category =>
  category.fullName === "Apparel & Accessories > Shoes > Sneakers"
);
const attributesById = new Map(taxonomy.attributes.map(attribute => [attribute.id, attribute]));

test("compact taxonomy includes the category tree and sneaker-specific options", () => {
  assert.equal(taxonomy.version, "2026-11-unstable");
  assert.equal(taxonomy.categories.length, 14606);
  assert.ok(sneakerCategory);

  const sneakerAttributes = sneakerCategory.attributes.map(id => attributesById.get(id));
  assert.ok(sneakerAttributes.some(attribute => attribute.name === "Shoe size"));
  const styles = sneakerAttributes.find(attribute => attribute.name === "Sneaker style");
  assert.deepEqual(styles.values.map(value => value.name), [
    "Athletic", "Fashion", "High-top", "Low-top", "Slip-on", "Other"
  ]);
  assert.ok(compressedTaxonomy.byteLength < 2_000_000);
});

test("taxonomy loader decompresses the bundled asset", async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = { baseURI: "https://app.test/" };
  globalThis.fetch = async url => {
    assert.equal(url.href, "https://app.test/data/shopify-product-taxonomy.json.gz");
    return new Response(compressedTaxonomy, { status: 200 });
  };
  try {
    const loaded = await loadProductTaxonomy();
    assert.equal(loaded.categories.length, 14606);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});

test("taxonomy loader falls back to Android's packaged JSON asset", async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.document = { baseURI: "https://app.test/" };
  globalThis.fetch = async url => {
    requests.push(url.href);
    if (url.pathname.endsWith(".gz")) return new Response("", { status: 404 });
    return new Response(JSON.stringify(taxonomy), { status: 200 });
  };
  try {
    const loaded = await loadTaxonomyWithAndroidFallback();
    assert.equal(loaded.categories.length, 14606);
    assert.deepEqual(requests, [
      "https://app.test/data/shopify-product-taxonomy.json.gz",
      "https://app.test/data/shopify-product-taxonomy.json"
    ]);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});

test("category picker searches, selects, and saves taxonomy attributes", async () => {
  const document = new JSDOM(`<form>${createProductTaxonomyFields()}</form>`).window.document;
  const form = document.querySelector("form");
  const widget = form.querySelector("[data-product-taxonomy]");
  bindProductTaxonomyFields(widget, Promise.resolve(taxonomy));
  await new Promise(resolve => setImmediate(resolve));

  const search = widget.querySelector("[data-taxonomy-search]");
  search.value = "Sneakers";
  search.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  const result = [...widget.querySelectorAll("[data-taxonomy-result]")]
    .find(button => button.textContent === sneakerCategory.fullName);
  assert.ok(result);
  result.click();

  const style = [...widget.querySelectorAll("[data-taxonomy-attribute]")]
    .find(field => field.dataset.taxonomyAttributeName === "Sneaker style");
  const highTop = [...style.options].find(option => option.dataset.valueName === "High-top");
  style.value = highTop.value;
  assert.deepEqual(readProductTaxonomyFields(form), {
    taxonomyCategoryId: sneakerCategory.id,
    taxonomyCategoryName: sneakerCategory.fullName,
    taxonomyCustomCategory: "",
    taxonomyAttributes: [{
      attributeId: attributesById.get(style.dataset.taxonomyAttribute).id,
      attributeName: "Sneaker style",
      valueId: highTop.value,
      value: "High-top"
    }]
  });
});

test("category picker lets the merchant save a custom category when needed", async () => {
  const document = new JSDOM(`<form>${createProductTaxonomyFields()}</form>`).window.document;
  const form = document.querySelector("form");
  const widget = form.querySelector("[data-product-taxonomy]");
  bindProductTaxonomyFields(widget, Promise.resolve(taxonomy));
  await new Promise(resolve => setImmediate(resolve));

  const search = widget.querySelector("[data-taxonomy-search]");
  search.value = "My handmade footwear";
  search.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  const addCustom = widget.querySelector("[data-taxonomy-add-custom]");
  assert.ok(addCustom);
  addCustom.click();

  assert.deepEqual(readProductTaxonomyFields(form), {
    taxonomyCategoryId: "",
    taxonomyCategoryName: "",
    taxonomyCustomCategory: "My handmade footwear",
    taxonomyAttributes: []
  });
});

test("POS and website product forms persist standard taxonomy data separately", () => {
  assert.match(posSource, /taxonomy_category_id TEXT/);
  assert.match(posSource, /taxonomy_custom_category TEXT/);
  assert.match(posSource, /taxonomy_attributes_json TEXT/);
  assert.match(posSource, /taxonomy_custom_category TEXT/);
  assert.match(posSource, /readProductTaxonomyFields\(form\)/);
  assert.match(appHtml, /createProductTaxonomyFields\(\)/);
  assert.match(appHtml, /taxonomy_category_id:\s*taxonomy\.taxonomyCategoryId/);
  assert.match(appHtml, /taxonomy_custom_category:\s*taxonomy\.taxonomyCustomCategory/);
  assert.match(appHtml, /taxonomy_attributes:\s*taxonomy\.taxonomyAttributes/);
});
