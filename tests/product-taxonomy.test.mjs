import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
import test from "node:test";
import { readAppSource } from "./helpers/app-source.mjs";
import {
  bindProductTaxonomyFields,
  createProductTaxonomyFields,
  findClosestProductTaxonomyCategory,
  loadProductTaxonomy,
  readProductTaxonomyFields,
  searchProductTaxonomyCategories
} from "../src/product-taxonomy.js";
const {
  bindProductTaxonomyFields: bindRetryableTaxonomyFields,
  createProductTaxonomyFields: createRetryableTaxonomyFields
} = await import("../src/product-taxonomy.js?retry-after-failure");

const compressedTaxonomy = await readFile(new URL("../public/data/shopify-product-taxonomy.json.gz", import.meta.url));
const taxonomy = JSON.parse(gunzipSync(compressedTaxonomy).toString("utf8"));
const posSource = await readFile(new URL("../src/pos.js", import.meta.url), "utf8");
const appHtml = await readAppSource();
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

test("taxonomy loader reads compressed taxonomy bundled into the app without network fetches", async () => {
  const previousPayload = globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__;
  const previousFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__ = compressedTaxonomy.toString("base64");
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("Offline taxonomy must not call fetch.");
  };
  try {
    const loaded = await loadProductTaxonomy();
    assert.equal(loaded.categories.length, 14606);
    assert.equal(fetchCount, 0);
  } finally {
    if (previousPayload === undefined) delete globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__;
    else globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__ = previousPayload;
    globalThis.fetch = previousFetch;
  }
});

test("category picker exposes retry after bundled taxonomy decode failure", async () => {
  const previousPayload = globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__;
  const previousFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__ = "not-valid-gzip";
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("Offline taxonomy must not call fetch.");
  };
  const document = new JSDOM(`<form>${createRetryableTaxonomyFields()}</form>`).window.document;
  const widget = document.querySelector("[data-product-taxonomy]");
  try {
    bindRetryableTaxonomyFields(widget);
    widget.querySelector("[data-taxonomy-add-open]").click();
    const waitForState = async state => {
      for (let attempt = 0; attempt < 1000; attempt += 1) {
        if (widget.dataset.taxonomyInitialized === state) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.fail(`Taxonomy picker did not reach ${state} state.`);
    };
    await waitForState("error");
    const retry = widget.querySelector("[data-taxonomy-retry]");
    assert.equal(retry.hidden, false);
    assert.ok(widget.querySelector("[data-taxonomy-status]").textContent);

    globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__ = compressedTaxonomy.toString("base64");
    retry.click();
    await waitForState("true");
    assert.equal(retry.hidden, true);
    assert.equal(widget.querySelector("[data-taxonomy-search]").disabled, false);
    assert.equal(fetchCount, 0);
  } finally {
    document.defaultView.close();
    if (previousPayload === undefined) delete globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__;
    else globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__ = previousPayload;
    globalThis.fetch = previousFetch;
  }
});

test("category picker searches, selects, and saves taxonomy attributes", async () => {
  const document = new JSDOM(`<form>${createProductTaxonomyFields()}</form>`).window.document;
  const form = document.querySelector("form");
  const widget = form.querySelector("[data-product-taxonomy]");
  bindProductTaxonomyFields(widget, Promise.resolve(taxonomy));
  widget.querySelector("[data-taxonomy-add-open]").click();
  await new Promise(resolve => setImmediate(resolve));

  const search = widget.querySelector("[data-taxonomy-search]");
  search.value = "Sneakers";
  search.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  const result = [...widget.querySelectorAll("[data-taxonomy-result]")]
    .find(button => button.dataset.taxonomyResult === sneakerCategory.id);
  assert.ok(result);
  assert.match(result.textContent, /Sneakers/);
  assert.match(result.textContent, /Apparel & Accessories > Shoes > Sneakers/);
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
  widget.querySelector("[data-taxonomy-add-open]").click();
  await new Promise(resolve => setImmediate(resolve));

  const search = widget.querySelector("[data-taxonomy-search]");
  search.value = "My handmade footwear";
  search.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  const addCustom = widget.querySelector("[data-taxonomy-add-custom]");
  assert.ok(addCustom);
  addCustom.click();

  // The owner keeps their own wording, and the closest standard category lends its attributes
  // so the product page is not left blank.
  const saved = readProductTaxonomyFields(form);
  assert.equal(saved.taxonomyCustomCategory, "My handmade footwear");
  assert.match(saved.taxonomyCategoryName, /Footwear$/);
  assert.ok(saved.taxonomyCategoryId);
  assert.ok(widget.closest("form").querySelectorAll("[data-taxonomy-attribute]").length > 0);
  assert.match(
    widget.querySelector("[data-taxonomy-selected]").textContent,
    /Custom: My handmade footwear/,
    "the owner must still see their own category name"
  );
});

test("a shop owner's own category wording still finds the standard attributes", () => {
  // Shop owners write "used shoes", not "Apparel & Accessories > Shoes". Dropping the describing
  // words from the front is what finds the real category.
  const closest = name => findClosestProductTaxonomyCategory(taxonomy.categories, name)?.fullName || null;
  assert.equal(closest("used shoes"), "Apparel & Accessories > Shoes");
  assert.equal(closest("Shoes"), "Apparel & Accessories > Shoes");
  assert.equal(closest("mens leather jackets"), closest("jackets"));
  assert.match(closest("second hand phones"), /^Electronics/);
  assert.equal(closest("qwxz plorb"), null, "a name that matches nothing stays the owner's own");
  assert.equal(closest(""), null);
  assert.equal(findClosestProductTaxonomyCategory(null, "shoes"), null);
});

test("search offers whole-word matches before words that merely contain the query", () => {
  const ranked = query => searchProductTaxonomyCategories(taxonomy.categories, query, 5).map(c => c.name);
  const phones = ranked("phones");
  assert.ok(phones.length);
  assert.ok(
    phones.every(name => name.toLowerCase().split(/[^a-z0-9]+/).includes("phones")),
    `Mellophones must not outrank real phones: ${phones.join(", ")}`
  );
  assert.equal(ranked("shoes")[0], "Shoes", "Hoes must never outrank Shoes");
});

test("saving a Web custom category keeps its taxonomy selection and reusable category id", async () => {
  const document = new JSDOM(`<form>${createProductTaxonomyFields({
    storeCategories: [],
    storeCategoryFieldName: "categoryId"
  })}</form>`).window.document;
  const form = document.querySelector("form");
  const widget = form.querySelector("[data-product-taxonomy]");
  bindProductTaxonomyFields(widget, Promise.resolve(taxonomy), {
    onCategoryCreate: async name => ({ value: "7", name })
  });
  await new Promise(resolve => setImmediate(resolve));

  widget.querySelector("[data-taxonomy-add-open]").click();
  const search = widget.querySelector("[data-taxonomy-search]");
  search.value = "My made-to-order socks";
  widget.querySelector("[data-taxonomy-add-manually]").click();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(form.querySelector("[name=categoryId]").value, "7");
  assert.deepEqual(readProductTaxonomyFields(form), {
    taxonomyCategoryId: "",
    taxonomyCategoryName: "",
    taxonomyCustomCategory: "My made-to-order socks",
    taxonomyAttributes: []
  });
  document.defaultView.close();
});

test("manual Web categories stay available while the standard taxonomy is loading", async () => {
  let resolveTaxonomy;
  const pendingTaxonomy = new Promise(resolve => { resolveTaxonomy = resolve; });
  let createdName = "";
  const document = new JSDOM(`<form>${createProductTaxonomyFields({
    storeCategories: [],
    storeCategoryFieldName: "categoryId"
  })}</form>`).window.document;
  const form = document.querySelector("form");
  const widget = form.querySelector("[data-product-taxonomy]");
  bindProductTaxonomyFields(widget, pendingTaxonomy, {
    onCategoryCreate: async name => {
      createdName = name;
      return { value: "12", name };
    }
  });
  const search = widget.querySelector("[data-taxonomy-search]");
  assert.equal(search.disabled, false);
  assert.equal(widget.dataset.taxonomyInitialized, "idle");

  widget.querySelector("[data-taxonomy-add-open]").click();
  search.value = "My custom product type";
  widget.querySelector("[data-taxonomy-add-manually]").click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(createdName, "My custom product type");
  assert.equal(form.querySelector("[name=categoryId]").value, "12");
  assert.equal(readProductTaxonomyFields(form).taxonomyCustomCategory, "My custom product type");

  resolveTaxonomy(taxonomy);
  await new Promise(resolve => setImmediate(resolve));
  document.defaultView.close();
});

test("POS and website product forms persist standard taxonomy data separately", () => {
  assert.match(posSource, /taxonomy_category_id TEXT/);
  assert.match(posSource, /taxonomy_custom_category TEXT/);
  assert.match(posSource, /taxonomy_attributes_json TEXT/);
  assert.match(posSource, /taxonomy_custom_category TEXT/);
  assert.match(posSource, /readProductTaxonomyFields\(form\)/);
  assert.match(appHtml, /createProductTaxonomyFields\(\{/);
  assert.match(appHtml, /taxonomy_category_id:\s*taxonomy\.taxonomyCategoryId/);
  assert.match(appHtml, /taxonomy_custom_category:\s*taxonomy\.taxonomyCustomCategory/);
  assert.match(appHtml, /taxonomy_attributes:\s*taxonomy\.taxonomyAttributes/);
});
