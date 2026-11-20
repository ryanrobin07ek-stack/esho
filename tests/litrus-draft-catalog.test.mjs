// The web builder opened for a NEW store must show that store's own products, and its autosave
// must not wipe what the builder does not edit. It used to send the whole Main Store catalogue,
// then write that list over the draft, so the owner's one product vanished among Store products.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as ServiceModel from "../src/service-model.js";

// The builder code moved out of index.html into src/screens/builder/ (builder.js sends the catalogue,
// builder-catalog.js saves what the builder returns).
const lf = text => text.split(String.fromCharCode(13, 10)).join("\n");
const builder = lf(await readFile(new URL("../src/screens/builder/builder.js", import.meta.url), "utf8"));
const builderCatalog = lf(await readFile(new URL("../src/screens/builder/builder-catalog.js", import.meta.url), "utf8"));
const sendCatalogBody = builder.match(/const sendCatalog = \(\) => \{([\s\S]*?)\n      \};/)?.[1];
const saveBody = builderCatalog.match(/async saveLitrusMixerCatalog\(input, isDraftEditor, expectedTenantId\) \{([\s\S]*?)\n  \},\n\};/)?.[1];

const storeProducts = [
  { id: 1, name: "Egyptian cotton sheet", price: 900, category_id: 10, images: [] },
  { id: 2, name: "Pillow", price: 300, category_id: 10, images: [] },
  { id: 3, name: "Duvet", price: 2500, category_id: 10, images: [] }
];

test("the builder for a new store receives only the draft's products and categories", () => {
  assert.ok(sendCatalogBody, "sendCatalog was found");
  const draft = {
    shop_name: "Mama Mboga", draft_id: "d1",
    categories: [{ id: 501, name: "Greens" }],
    products: [{ id: 601, name: "Sukuma", price: 50, category_id: 501, images: [] }]
  };
  const messages = [];
  new Function("SQLiteEngine", "StudioRenderers", "isDraftEditor", "litrusFrame", "window", "savedLitrusRecipe",
    "validLitrusHtml", "savedLitrusHtml", "AppUtils", sendCatalogBody)(
    {
      getStore: () => ({ name: "Main Store", currency: "KES" }),
      getCategories: () => [{ id: 10, name: "Bedding" }],
      select: () => storeProducts
    },
    { websiteBuilderDraft: () => draft }, true,
    { contentWindow: { postMessage: message => messages.push(message) } },
    { location: { origin: "https://app.test" }, EshopServiceModel: ServiceModel }, null, () => false, "", { showToast() {} }
  );
  const catalog = messages[0].catalog;
  assert.deepEqual(catalog.products.map(product => product.name), ["Sukuma"]);
  assert.deepEqual(catalog.categories.map(category => category.name), ["Greens"]);
  assert.deepEqual(catalog.products[0].category_names, ["Greens"]);
});

test("an existing shop's builder still receives the Main Store catalogue", () => {
  const messages = [];
  new Function("SQLiteEngine", "StudioRenderers", "isDraftEditor", "litrusFrame", "window", "savedLitrusRecipe",
    "validLitrusHtml", "savedLitrusHtml", "AppUtils", sendCatalogBody)(
    { getStore: () => ({ name: "Main Store" }), getCategories: () => [{ id: 10, name: "Bedding" }], select: () => storeProducts },
    {}, false, { contentWindow: { postMessage: message => messages.push(message) } },
    { location: { origin: "https://app.test" }, EshopServiceModel: ServiceModel }, null, () => false, "", { showToast() {} }
  );
  assert.equal(messages[0].catalog.products.length, 3);
});

test("the builder's autosave keeps a draft product's attributes, prices and options", async () => {
  assert.ok(saveBody, "saveLitrusMixerCatalog was found");
  const pricedAttributes = [{ attributeId: "a1", attributeName: "Material", values: [{ value: "Leather", priceDelta: 500 }] }];
  const variants = [{ id: "v1", option1_name: "Size", option1_value: "M", label: "M", price: null, stock: 2 }];
  let draft = {
    shop_name: "Mama Mboga",
    categories: [{ id: 501, name: "Greens" }],
    products: [{
      id: 601, name: "Sukuma", price: 50, stock: 4, category_id: 501, category_name: "Greens", images: [],
      cost_price: 30, sku: "SUK-1", priced_attributes: pricedAttributes, taxonomy_category_id: "gid://t/1",
      option1_name: "Size", sizes: ["M"], variants, options: [{ name: "Size", values: [{ value: "M", priceDelta: 0 }] }]
    }]
  };
  const StudioRenderers = { websiteBuilderDraft: () => JSON.parse(JSON.stringify(draft)), saveWebsiteBuilderDraft: next => { draft = next; } };
  const save = new Function("SQLiteEngine", "window", "StudioRenderers", "WEBSITE_BUILDER_DRAFT_SYNC_KEY",
    `return async function (input, isDraftEditor, expectedTenantId) {${saveBody}\n};`)(
    { select: () => [] },
    { ShopSQLite: { async flush() {} }, EshopServiceModel: ServiceModel, localStorage: { setItem() {} } },
    StudioRenderers, "draft-sync"
  );
  await save.call({
    getActiveTenant: () => ({ id: "draft-tenant", name: "Mama Mboga" }),
    tenantCatalogs: () => [{ tenant_id: "draft-tenant", categories: [], store: {}, products: [] }],
    setActiveTenantCatalog() {}
  }, {
    catalog: {
      shop: { name: "Mama Mboga" },
      categories: [{ name: "Greens" }],
      // What Litrus sends back: the fields it edits, nothing about options or attributes.
      products: [{ id: 601, name: "Sukuma wiki", price: 60, stock: 4, category_names: ["Greens"], images: [] }]
    }
  }, true, "draft-tenant");
  assert.equal(draft.products.length, 1);
  const saved = draft.products[0];
  assert.equal(saved.name, "Sukuma wiki", "the builder's edit is saved");
  assert.equal(saved.price, 60);
  assert.deepEqual(saved.priced_attributes, pricedAttributes, "attribute prices survive the autosave");
  assert.deepEqual(saved.variants, variants, "options survive the autosave");
  assert.equal(saved.cost_price, 30);
  assert.equal(saved.sku, "SUK-1");
  assert.equal(saved.taxonomy_category_id, "gid://t/1");
});
