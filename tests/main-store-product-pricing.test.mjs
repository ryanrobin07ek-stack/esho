// Main Store's product editors had no options and no attribute prices, so a product made there could
// not come in sizes or charge more for Large, and editing one there dropped a third option and every
// per-value price change. These cover the shared module and both Main Store editors.
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { normalizePricedAttributes } from "../src/attribute-pricing.js";
import {
  mountProductPricing,
  posPricingValues,
  readProductPricingFields,
  savedProductPricing,
  webPricingValues
} from "../src/screens/main-store/product-pricing-fields.js";
import { readAppSource } from "./helpers/app-source.mjs";

const pricingModule = { mountProductPricing, posPricingValues, readProductPricingFields, savedProductPricing, webPricingValues };

// A category select the way the taxonomy picker renders one, so attribute pricing has something to offer.
const materialSelect = `<select data-taxonomy-attribute="gid://attr/material" data-taxonomy-attribute-name="Material">
  <option value=""></option><option value="gid://v/leather" data-value-name="Leather">Leather</option>
  <option value="gid://v/canvas" data-value-name="Canvas">Canvas</option></select>`;

function openForm({ product = null, withCategory = true } = {}) {
  const dom = new JSDOM(`<form><label>Price<input name="price" value="1000"></label>
    <label>Stock<input name="stock" value="4"></label>
    <div data-taxonomy>${withCategory ? materialSelect : ""}</div>
    <div data-product-pricing-variants></div><div data-product-pricing-attributes></div></form>`);
  const form = dom.window.document.querySelector("form");
  mountProductPricing(form, product);
  return { dom, form };
}

function setOption(form, dom, index, name, values) {
  while (form.querySelectorAll("[data-variant-option]").length <= index) {
    form.querySelector("[data-variant-add-option]").click();
  }
  const block = form.querySelectorAll("[data-variant-option]")[index];
  block.querySelector("[data-variant-option-name]").value = name;
  const box = block.querySelector("[data-variant-option-values]");
  box.value = values;
  box.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function setValuePrice(form, dom, optionIndex, value, amount) {
  const input = form.querySelectorAll("[data-variant-option]")[optionIndex]
    .querySelector(`[data-variant-value-price="${value}"]`);
  input.value = String(amount);
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function addAttributePrice(form, dom, amount) {
  form.querySelector("[data-attribute-pricing-add]").click();
  const delta = form.querySelector("[data-priced-value-delta]");
  delta.value = String(amount);
  delta.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

const pricedSummary = priced => normalizePricedAttributes(priced).flatMap(attribute =>
  attribute.values.map(value => [attribute.attributeName, value.value, value.priceDelta]));

const savedWebProduct = {
  options: [
    { name: "Size", values: [{ value: "S", priceDelta: 0 }, { value: "L", priceDelta: 200 }] },
    { name: "Colour", values: [{ value: "Black", priceDelta: 0 }] },
    { name: "Fabric", values: [{ value: "Linen", priceDelta: 50 }] }
  ],
  option1_name: "Size",
  option2_name: "Colour",
  sizes: ["S", "L"],
  colors: ["Black"],
  variants: [
    { id: '["S","Black","Linen"]', option1_name: "Size", option1_value: "S", option2_name: "Colour", option2_value: "Black",
      option3_name: "Fabric", option3_value: "Linen", size: "S", color: "Black", price: null, stock: 2 },
    { id: '["L","Black","Linen"]', option1_name: "Size", option1_value: "L", option2_name: "Colour", option2_value: "Black",
      option3_name: "Fabric", option3_value: "Linen", size: "L", color: "Black", price: 1250, stock: 3 }
  ],
  priced_attributes: [{ attributeId: "gid://attr/material", attributeName: "Material",
    values: [{ valueId: "gid://v/leather", value: "Leather", priceDelta: 300 }] }]
};

test("a new product gets options, per-value prices and attribute prices in the wizard's saved shape", () => {
  const { form, dom } = openForm();
  setOption(form, dom, 0, "Size", "S, L");
  setValuePrice(form, dom, 0, "L", 200);
  addAttributePrice(form, dom, 300);

  const pricing = readProductPricingFields(form);
  assert.deepEqual(pricing.options, [{ name: "Size", values: [{ value: "S", priceDelta: 0 }, { value: "L", priceDelta: 200 }] }]);
  assert.equal(pricing.variants.length, 2);
  assert.equal(pricing.variants.find(variant => variant.size === "L").price, 1200);
  assert.equal(pricing.stock, 0, "stock is counted per variant once there are options");
  assert.equal(form.querySelector('[name="stock"]').disabled, true);
  assert.deepEqual(pricedSummary(pricing.priced_attributes), [["Material", "Leather", 300]]);

  const web = webPricingValues(pricing);
  assert.deepEqual(Object.keys(web).sort(),
    ["colors", "option1_name", "option2_name", "options", "priced_attributes", "sizes", "variants"]);
  assert.equal(web.option1_name, "Size");
  assert.deepEqual(web.sizes, ["S", "L"]);
  assert.equal("stock" in web, false, "the caller owns stock");
  const pos = posPricingValues(pricing);
  assert.deepEqual(Object.keys(pos).sort(), ["pricedAttributes", "variants"]);
  assert.equal(pos.variants, pricing.variants);
  assert.equal(pos.pricedAttributes, pricing.priced_attributes);
});

test("editing a Web product keeps its third option, per-value prices, stock and attribute prices", () => {
  const { form } = openForm({ product: { webProduct: savedWebProduct, posProduct: null } });
  assert.equal(form.querySelectorAll("[data-variant-option]").length, 3);
  assert.equal(form.querySelector('[data-variant-value-price="L"]').value, "200");
  assert.equal(form.querySelectorAll("[data-variant-row]").length, 2);
  assert.equal(form.querySelector("[data-priced-value-delta]").value, "300");

  const pricing = readProductPricingFields(form);
  assert.deepEqual(pricing.options, savedWebProduct.options);
  assert.deepEqual(pricing.variants.map(variant => [variant.id, variant.price, variant.stock]),
    // Linen's +50 is suggested for the combination that had no price of its own; a typed price stays.
    [['["S","Black","Linen"]', 1050, 2], ['["L","Black","Linen"]', 1250, 3]]);
  assert.equal(pricing.stock, 5);
  assert.deepEqual(pricedSummary(pricing.priced_attributes), [["Material", "Leather", 300]]);
});

test("the product modal's own Web record and a POS-only product both reopen with what they have", () => {
  // The /account/products modal passes the Web record itself.
  const modal = openForm({ product: savedWebProduct });
  assert.equal(modal.form.querySelectorAll("[data-variant-option]").length, 3);

  const posProduct = {
    variants: [{ option1_name: "Size", option1_value: "M", size: "M", color: "", price: 900, stock: 4 }],
    pricedAttributes: savedWebProduct.priced_attributes
  };
  const saved = savedProductPricing({ webProduct: null, posProduct });
  assert.equal(saved.option1Name, "Size");
  assert.equal(saved.variants, posProduct.variants);
  const { form } = openForm({ product: { webProduct: null, posProduct } });
  const pricing = readProductPricingFields(form);
  assert.deepEqual(pricing.options, [{ name: "Size", values: [{ value: "M", priceDelta: 0 }] }]);
  assert.equal(pricing.variants[0].price, 900);
  assert.equal(pricing.variants[0].stock, 4);
  assert.equal(pricing.priced_attributes.length, 1);

  // A product with nothing still opens, on the product's own stock.
  const empty = openForm({ product: { webProduct: { name: "Mug" }, posProduct: null } });
  assert.deepEqual(readProductPricingFields(empty.form).variants, []);
  assert.equal(empty.form.querySelector('[name="stock"]').disabled, false);
});

test("choosing a category refreshes the attribute prices on offer", () => {
  const { form, dom } = openForm({ withCategory: false });
  const add = form.querySelector("[data-attribute-pricing-add]");
  assert.equal(add.disabled, true, "nothing to charge for before a category is chosen");
  form.querySelector("[data-taxonomy]").innerHTML = materialSelect;
  form.querySelector("[data-taxonomy]").dispatchEvent(new dom.window.CustomEvent("product-taxonomy-change", { bubbles: true }));
  assert.equal(add.disabled, false);

  // Opening the next product on the same form does not stack a second listener or keep old fields.
  mountProductPricing(form, null);
  assert.equal(form.querySelectorAll("[data-product-variants]").length, 1);
  assert.equal(form.querySelectorAll("[data-attribute-pricing]").length, 1);
});

test("options that are not ready are reported instead of saved", () => {
  const { form, dom } = openForm();
  setOption(form, dom, 0, "", "S, M");
  assert.throws(() => readProductPricingFields(form), /name and values for option 1/);
  const messages = [];
  assert.equal(readProductPricingFields(form, message => messages.push(message)), null);
  assert.match(messages[0], /name and values for option 1/);
});

// The Store screen's product form, run from the app source with the real editors.
const app = (await readAppSource()).replace(/\r\n/g, "\n");
function extract(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} should exist`);
  const end = app.indexOf(endMarker, start);
  assert.ok(end > start, `${endMarker} should follow ${startMarker}`);
  return app.slice(start + startMarker.length, end);
}
const productManagerRender = extract("  renderMainStoreProductManagement(snapshot) {", "\n  },\n\n  getMainStoreCategoryRecords");
const productManagerBind = extract("  bindMainStoreProductManagement(container, snapshot, path) {", "\n  },\n\n  manualPaymentLabel");
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function mountStoreScreen(snapshot) {
  const AppUtils = { escapeHTML, showToast() {} };
  const html = new Function("AppUtils", `return function (snapshot) {${productManagerRender}\n};`)(AppUtils)
    .call({ formatMainShopMoney: value => `KES ${value}` }, snapshot);
  const dom = new JSDOM(`<body><div id="root">${html}</div></body>`);
  const container = dom.window.document.getElementById("root");
  const web = { products: [], categories: [{ id: 7, name: "Clothes" }] };
  const pos = { products: [], categories: [{ id: 3, name: "Clothes" }] };
  const SQLiteEngine = {
    getCategories: () => web.categories,
    saveCategory() {},
    select: () => web.products,
    getProductById: id => web.products.find(product => product.id === Number(id)),
    generateProductSku: () => "SKU-NEW",
    saveProduct(data) {
      const existing = web.products.find(product => product.id === data.id);
      if (existing) Object.assign(existing, data);
      else web.products.push({ ...data, id: data.id || 100 + web.products.length });
      return web.products.find(product => product.id === (data.id || 99 + web.products.length));
    }
  };
  const ShopPOS = {
    listProducts: async () => pos.products,
    listCategories: async () => pos.categories,
    addCategory: async () => {},
    async saveProduct(data) {
      const id = data.id || 50 + pos.products.length;
      pos.products = pos.products.filter(product => product.id !== id).concat({ ...data, id, sku: data.sku });
      return id;
    }
  };
  const window = {
    EshopProductTaxonomy: {
      createProductTaxonomyFields: () => `<section data-product-taxonomy>${materialSelect}</section>`,
      bindProductTaxonomyFields() {},
      readProductTaxonomyFields: () => ({ taxonomyCategoryId: "", taxonomyCategoryName: "", taxonomyCustomCategory: "", taxonomyAttributes: [] })
    },
    ShopPOS,
    ShopSQLite: { async flush() {} }
  };
  const AppController = { cacheActiveTenantCatalog() {}, getActiveTenant: () => ({ id: "t1" }) };
  const names = Object.keys(pricingModule);
  let reloaded = 0;
  // FormData must be the page's own, so it can read the page's form.
  new Function("AppUtils", "AppController", "SQLiteEngine", "window", "FormData", ...names,
    `return function (container, snapshot, path) {${productManagerBind}\n};`)(
    AppUtils, AppController, SQLiteEngine, window, dom.window.FormData, ...names.map(name => pricingModule[name])
  ).call({
    loadMainShopWorkspace: async () => { reloaded += 1; },
    publishPosProduct: async () => {},
    addWebsiteProductToPos: async () => {}
  }, container, snapshot, "/store/manage/products");
  return { dom, container, web, pos, reloaded: () => reloaded };
}

async function submit(container, dom) {
  const form = container.querySelector("[data-main-store-product-form]");
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  for (let turn = 0; turn < 20; turn += 1) await new Promise(resolve => setTimeout(resolve, 0));
  return form;
}

test("creating a Store-screen product saves its options and attribute prices to Web and POS", async () => {
  const { dom, container, web, pos, reloaded } = mountStoreScreen({ currency: "KES", products: [] });
  container.querySelector("[data-main-product-add]").click();
  const form = container.querySelector("[data-main-store-product-form]");
  assert.ok(form.querySelector("[data-product-pricing-variants] [data-product-variants]"), "the options editor is in the form");
  assert.ok(form.querySelector("[data-product-pricing-attributes] [data-attribute-pricing]"), "the attribute price editor is in the form");
  form.querySelector('[name="name"]').value = "Shirt";
  form.querySelector('[name="category"]').value = "Clothes";
  form.querySelector('[name="price"]').value = "1000";
  form.querySelector('[value="pos"]').checked = false; // Web only first: no POS round trip
  setOption(form, dom, 0, "Size", "S, L");
  setValuePrice(form, dom, 0, "L", 200);
  form.querySelectorAll("[data-variant-stock]")[1].value = "6";
  addAttributePrice(form, dom, 300);
  await submit(container, dom);

  assert.equal(reloaded(), 1, form.querySelector("[data-main-product-status]").textContent);
  const saved = web.products[0];
  assert.deepEqual(saved.options, [{ name: "Size", values: [{ value: "S", priceDelta: 0 }, { value: "L", priceDelta: 200 }] }]);
  assert.equal(saved.option1_name, "Size");
  assert.deepEqual(saved.sizes, ["S", "L"]);
  assert.equal(saved.variants.length, 2);
  assert.equal(saved.stock, 6, "Web stock is the variants' total");
  assert.equal(saved.priced_attributes[0].values[0].priceDelta, 300);
  assert.equal(pos.products.length, 0);

  // The same product, POS only.
  const again = mountStoreScreen({ currency: "KES", products: [] });
  again.container.querySelector("[data-main-product-add]").click();
  const posForm = again.container.querySelector("[data-main-store-product-form]");
  posForm.querySelector('[name="name"]').value = "Shirt";
  posForm.querySelector('[name="category"]').value = "Clothes";
  posForm.querySelector('[name="price"]').value = "1000";
  posForm.querySelector('[value="web"]').checked = false;
  setOption(posForm, again.dom, 0, "Size", "M");
  addAttributePrice(posForm, again.dom, 300);
  await submit(again.container, again.dom);
  assert.equal(again.reloaded(), 1, posForm.querySelector("[data-main-product-status]").textContent);
  assert.equal(again.pos.products[0].variants.length, 1);
  assert.equal(again.pos.products[0].variants[0].option1_value, "M");
  assert.equal(again.pos.products[0].pricedAttributes[0].values[0].priceDelta, 300);
});

test("editing a Store-screen product reopens and keeps its options and attribute prices", async () => {
  const webProduct = { id: 100, name: "Shirt", sku: "SH1", category_id: 7, price: 1000, ...savedWebProduct };
  const snapshot = { currency: "KES", products: [{ name: "Shirt", sku: "SH1", categoryName: "Clothes", price: 1000, stock: 5,
    webProduct, webProductId: 100, posProduct: null, posProductId: null }] };
  const { dom, container, web, reloaded } = mountStoreScreen(snapshot);
  web.products.push(webProduct);
  container.querySelector("[data-main-product-edit]").click();
  const form = container.querySelector("[data-main-store-product-form]");
  assert.equal(form.querySelectorAll("[data-variant-option]").length, 3, "the third option is back");
  assert.equal(form.querySelector('[data-variant-value-price="L"]').value, "200");
  assert.equal(form.querySelector("[data-priced-value-delta]").value, "300");

  form.querySelector('[value="pos"]').checked = false;
  setValuePrice(form, dom, 2, "Linen", 75);
  await submit(container, dom);
  assert.equal(reloaded(), 1, form.querySelector("[data-main-product-status]").textContent);
  assert.equal(web.products[0].options[2].values[0].priceDelta, 75);
  assert.equal(web.products[0].options.length, 3);
  assert.equal(web.products[0].stock, 5);
  assert.equal(web.products[0].priced_attributes[0].values[0].priceDelta, 300);

  // Options that are not ready stop the save with the reason, before anything is written.
  container.querySelector("[data-main-product-edit]").click();
  setOption(form, dom, 0, "", "S");
  await submit(container, dom);
  assert.match(form.querySelector("[data-main-product-status]").textContent, /name and values for option 1/);
  assert.equal(reloaded(), 1);
});

test("the product modal mounts and saves the same editors", () => {
  const modal = extract("  openProductModal(product, initialCategoryId = null) {", "\n  },\n\n  updateNavBadges");
  assert.match(modal, /data-product-pricing-variants/);
  assert.match(modal, /data-product-pricing-attributes/);
  assert.match(modal, /mountProductPricing\(modalForm, product\)/);
  assert.match(modal, /readProductPricingFields\(modalForm\)/);
  assert.doesNotMatch(modal, /EshopProductVariants\.readProductVariantFields\(modalForm\)/);
});
