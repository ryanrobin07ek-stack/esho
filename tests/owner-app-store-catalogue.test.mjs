import assert from "node:assert/strict";
import { readFile as readFileRaw } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import { readAppSource } from "./helpers/app-source.mjs";
import * as ProductPricingFields from "../src/screens/main-store/product-pricing-fields.js";

const app = (await readAppSource()).replace(/\r\n/g, "\n");
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const AppUtils = { escapeHTML, showToast() {} };

function extract(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} should exist`);
  const end = app.indexOf(endMarker, start);
  assert.ok(end > start, `${endMarker} should follow ${startMarker}`);
  return app.slice(start + startMarker.length, end);
}

const productManagerRender = extract("  renderMainStoreProductManagement(snapshot) {", "\n  },\n\n  getMainStoreCategoryRecords");
const productManagerBind = extract("  bindMainStoreProductManagement(container, snapshot, path) {", "\n  },\n\n  manualPaymentLabel");
const categoryRender = extract("  renderMainStoreCategories(snapshot) {", "\n  },\n\n  renderMainStoreManagement");
const categoryBind = extract("  bindMainStoreCategories(container, snapshot, path) {", "\n  },\n\n  bindMainStoreProductManagement");
const wizardRender = extract("  renderNewWebsiteProducts() {", "\n  },\n\n  renderWebStudioWebsiteTool");

const snapshot = {
  currency: "KES",
  posCategories: [{ id: 1, name: "Drinks" }, { id: 2, name: "Food" }],
  products: [
    { name: "Cola", sku: "A1", categoryName: "Drinks", price: 50, stock: 5, posProduct: { id: 1 }, posProductId: 1 },
    { name: "Bread", sku: "B2", categoryName: "Food", price: 70, stock: 0, posProduct: { id: 2 }, posProductId: 2 },
    { name: "Juice", sku: "C3", categoryName: "Drinks", price: 30, stock: null, posProduct: { id: 3 }, posProductId: 3 }
  ]
};
const mainShop = { formatMainShopMoney: value => `KES ${value}` };

function mountProducts() {
  const html = new Function("AppUtils", `return function (snapshot) {${productManagerRender}\n};`)(AppUtils).call(mainShop, snapshot);
  const dom = new JSDOM(`<body><div id="root">${html}</div></body>`);
  const container = dom.window.document.getElementById("root");
  const calls = { taxonomy: [] };
  const taxonomy = {
    createProductTaxonomyFields(options) {
      calls.taxonomy.push(options);
      return `<section data-product-taxonomy></section>`;
    },
    bindProductTaxonomyFields() {},
    readProductTaxonomyFields: () => ({ taxonomyCategoryId: "gid://x/1", taxonomyCategoryName: "Shoes", taxonomyCustomCategory: "", taxonomyAttributes: [] })
  };
  // The options and attribute price editors are imported by main.js; pass the real ones in.
  const pricingNames = Object.keys(ProductPricingFields);
  new Function("AppUtils", "AppController", "SQLiteEngine", "window", ...pricingNames,
    `return function (container, snapshot, path) {${productManagerBind}\n};`)(
    AppUtils, {}, {}, { EshopProductTaxonomy: taxonomy }, ...pricingNames.map(name => ProductPricingFields[name])
  ).call({}, container, snapshot, "/store/manage/products");
  return { dom, container, calls };
}

test("Main Store product form carries the taxonomy picker without a second category select", () => {
  const { container, calls } = mountProducts();
  assert.ok(container.querySelector("[data-main-product-taxonomy]"));
  assert.equal(container.querySelectorAll('[name="category"]').length, 1);
  assert.ok(calls.taxonomy.length >= 1, "picker is rendered when the form is set up");
  assert.ok(calls.taxonomy.every(options => options.storeCategoryFieldName === ""),
    "the picker must not render a select that collides with the form's own category input");
  const before = calls.taxonomy.length;
  container.querySelector("[data-main-product-add]").click();
  assert.ok(calls.taxonomy.length > before, "each open re-renders the picker");
  assert.match(productManagerBind, /readProductTaxonomyFields\(form\)/);
  assert.match(productManagerBind, /taxonomy_category_id: taxonomy\.taxonomyCategoryId/);
  assert.match(productManagerBind, /taxonomyCategoryId: taxonomy\.taxonomyCategoryId/);
});

test("Main Store product list can be searched, filtered by category and sorted", () => {
  const { container } = mountProducts();
  const visible = () => [...container.querySelectorAll("[data-main-product-row]")].filter(row => !row.hidden).map(row => row.dataset.name);
  const fire = (element, type) => element.dispatchEvent(new element.ownerDocument.defaultView.Event(type, { bubbles: true }));
  assert.deepEqual(visible().sort(), ["bread", "cola", "juice"]);

  const search = container.querySelector("[data-main-product-search]");
  search.value = "b2";
  fire(search, "input");
  assert.deepEqual(visible(), ["bread"], "search matches the SKU");
  search.value = "";
  fire(search, "input");

  const filter = container.querySelector("[data-main-product-category-filter]");
  filter.value = "drinks";
  fire(filter, "change");
  assert.deepEqual(visible().sort(), ["cola", "juice"]);
  assert.match(container.querySelector("[data-main-product-count]").textContent, /Showing 2 of 3/);
  filter.value = "";
  fire(filter, "change");

  const sort = container.querySelector("[data-main-product-sort]");
  sort.value = "price-desc";
  fire(sort, "change");
  assert.deepEqual([...container.querySelectorAll("[data-main-product-row]")].map(row => row.dataset.name), ["bread", "cola", "juice"]);
  search.value = "zzz";
  fire(search, "input");
  assert.equal(container.querySelector("[data-main-product-empty]").hidden, false);
});

test("a category opens to its products and moves them to another category", async () => {
  const records = [
    { name: "Drinks", posCategory: snapshot.posCategories[0], webCategory: null },
    { name: "Food", posCategory: snapshot.posCategories[1], webCategory: null }
  ];
  const html = new Function("AppUtils", `return function (snapshot) {${categoryRender}\n};`)(AppUtils)
    .call({ getMainStoreCategoryRecords: () => records }, snapshot);
  const dom = new JSDOM(`<body><div id="root">${html}</div></body>`);
  const container = dom.window.document.getElementById("root");
  const saved = [];
  new Function("AppUtils", "AppController", "SQLiteEngine", "window",
    `return function (container, snapshot, path) {${categoryBind}\n};`)(
    AppUtils,
    { cacheActiveTenantCatalog() {} },
    { getCategories: () => [] },
    { ShopSQLite: { async flush() {} }, ShopPOS: { saveProduct: async product => { saved.push(product); } } }
  ).call({ getMainStoreCategoryRecords: () => records, loadMainShopWorkspace: async () => {} }, container, snapshot, "/store/manage/categories");

  const panel = container.querySelector("[data-main-category-contents]");
  assert.equal(panel.hidden, true);
  container.querySelector('[data-main-category-open="0"]').click();
  assert.equal(panel.hidden, false);
  assert.match(panel.querySelector("[data-category-contents-title]").textContent, /Drinks \(2\)/);
  const boxes = [...panel.querySelectorAll("[data-category-contents-list] input")];
  assert.equal(boxes.length, 2);
  const move = panel.querySelector("[data-category-move-selected]");
  assert.equal(move.disabled, true);
  boxes[0].checked = true;
  boxes[1].checked = true;
  const target = panel.querySelector("[data-category-move-target]");
  target.value = "1";
  target.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert.equal(move.disabled, false);
  move.click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(saved.map(product => [product.id, product.categoryId]), [[1, 2], [3, 2]]);
});

test("the new-website wizard asks for the shop identity before the catalogue", () => {
  // The product form's item type and duration fields come from src/screens/craft/service-fields.js.
  const serviceFieldsHTML = () => '<div data-service-fields></div>';
  const render = draft => new Function("AppUtils", "serviceFieldsHTML", `return function () {${wizardRender}\n};`)(AppUtils, serviceFieldsHTML)
    .call({ websiteBuilderDraft: () => draft });
  const empty = render({ categories: [], products: [], shop_name: "", shop_address: "", wizard_step: "identity" });
  assert.match(empty, /id="website-wizard-identity-form"/);
  assert.doesNotMatch(empty, /id="website-wizard-category-form"|id="website-wizard-product-form"/);

  const catalogue = new JSDOM(`<body>${render({
    categories: [{ id: 1, name: "Greens" }], products: [],
    shop_name: "Mama Mboga", shop_address: "mama-mboga", wizard_step: "catalogue"
  })}</body>`).window.document;
  assert.equal(catalogue.querySelector("#website-wizard-identity-form"), null);
  assert.ok(catalogue.querySelector("#website-wizard-category-form"));
  const go = catalogue.querySelector("#website-wizard-go-builder");
  assert.ok(go, "Go to web builder is rendered");
  assert.equal(go.closest("[hidden]"), null, "and is not inside a hidden container");
  assert.ok(catalogue.querySelector('[data-remove-wizard-category="1"]'), "categories can be removed");
  assert.ok(catalogue.querySelector("#website-wizard-product-form [data-service-fields]"), "the product form asks product or service");
});

test("new-website categories are never preloaded from the Store or POS", () => {
  const setup = extract('    if (path === "/account/web/studio/websites/webmaker") {', '    if (path === "/account/web/site") {');
  assert.doesNotMatch(setup, /websiteBuilderSourceCatalog/);
});

test("the first publish keeps photos, options, services and taxonomy", () => {
  const initial = extract("          const initialCatalog = {", "            categories: draftCatalog.categories.map");
  for (const field of ["duration_minutes", "booking_enabled", "option1_name", "option2_name", "variants",
    "taxonomy_category_id", "taxonomy_custom_category", "taxonomy_attributes"]) {
    assert.ok(new RegExp(field + ": .*product\." + field).test(initial), `${field} is carried into the new shop`);
  }
  assert.match(initial, /images: Array\.isArray\(product\.images\) \? product\.images : \[\]/);
  assert.doesNotMatch(initial, /images: \[\],/);
});
