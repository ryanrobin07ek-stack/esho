import assert from "node:assert/strict";
import { readFile as readFileRaw } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import * as ServiceModel from "../src/service-model.js";
import { readAppSource } from "./helpers/app-source.mjs";

const readFile = async (path, options) => {
  const contents = await readFileRaw(path, options);
  return typeof contents === "string" ? contents.replace(/\r\n/g, "\n") : contents;
};
const app = await readAppSource({ lf: true });
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

// ---------------------------------------------------------------------------------------------
// Archived products survive the Litrus builder's autosave
// ---------------------------------------------------------------------------------------------

const saveMethod = app.match(/async saveLitrusMixerCatalog\(input, isDraftEditor, expectedTenantId\) \{([\s\S]*?)\n  \},\n\n  openCloudflarePublishModal/)?.[1];

function litrusSaveHarness({ live, cached }) {
  assert.ok(saveMethod, "saveLitrusMixerCatalog should be extractable.");
  const tenant = { id: "shop", name: "Test shop" };
  const tables = { products: live.products, inventory: live.inventory };
  const SQLiteEngine = { select: name => JSON.parse(JSON.stringify(tables[name] || [])) };
  const save = new Function("SQLiteEngine", "window", `return async function (input, isDraftEditor, expectedTenantId) {${saveMethod}\n};`)(
    SQLiteEngine,
    { ShopSQLite: { async flush() {} }, EshopServiceModel: ServiceModel }
  );
  const current = { tenant_id: tenant.id, categories: [{ id: 1, name: "Shoes" }], store: {}, ...cached };
  let saved = null;
  const controller = {
    getActiveTenant: () => tenant,
    tenantCatalogs: () => [current],
    setActiveTenantCatalog(_tenant, catalog) { saved = catalog; }
  };
  return {
    run: (input, expectedTenantId) => save.call(controller, input, false, expectedTenantId).then(() => saved),
    wasSaved: () => saved !== null
  };
}

const builderCatalog = products => ({
  catalog: { shop: { name: "Test shop" }, categories: [{ name: "Shoes" }], products }
});

test("Litrus autosave keeps archived products and their stock instead of deleting them", async () => {
  const live = {
    products: [
      { id: 1, name: "Everyday shoe", price: 2500, stock: 3, status: "active", category_id: 1 },
      { id: 2, name: "Retired boot", price: 4000, stock: 7, status: "archived", sku: "BOOT-1", category_id: 1 },
      { id: 3, name: "Removed in builder", price: 100, stock: 1, status: "active" }
    ],
    inventory: [
      { product_id: 1, stock: 3 }, { product_id: 2, stock: 7 }, { product_id: 3, stock: 1 }
    ]
  };
  // The cached tenant catalog is stale: it still shows the old stock and the boot as active.
  const cached = {
    products: [
      { id: 1, name: "Everyday shoe", price: 2500, stock: 9, status: "active" },
      { id: 2, name: "Retired boot", price: 4000, stock: 7, status: "active" }
    ],
    inventory: [{ product_id: 1, stock: 9 }]
  };
  const saved = await litrusSaveHarness({ live, cached }).run(builderCatalog([
    { id: 1, name: "Everyday shoe (renamed)", price: 2600, category_names: ["Shoes"], status: "active" }
  ]));

  const byId = new Map(saved.products.map(product => [String(product.id), product]));
  assert.equal(byId.get("1").name, "Everyday shoe (renamed)");
  assert.equal(byId.get("1").stock, 3, "Stock comes from the live store, not the stale cache.");
  assert.equal(byId.has("3"), false, "A product the builder dropped is still removed.");
  const archived = byId.get("2");
  assert.ok(archived, "The archived product is merged back, not deleted.");
  assert.equal(archived.status, "archived");
  assert.equal(archived.name, "Retired boot");
  assert.equal(archived.stock, 7);
  assert.equal(archived.sku, "BOOT-1");
  assert.equal(saved.products.length, 2);
  assert.deepEqual(saved.inventory.map(record => record.product_id).sort(), [1, 2],
    "Inventory of archived products is kept; inventory of deleted products is dropped.");
});

test("A Litrus save queued for one shop is refused once another shop is active", async () => {
  const live = { products: [{ id: 1, name: "Shoe", price: 10, stock: 3, status: "active" }], inventory: [] };
  const harness = litrusSaveHarness({ live, cached: { products: [], inventory: [] } });
  await assert.rejects(
    harness.run(builderCatalog([{ id: 1, name: "Shoe", price: 10, category_names: ["Shoes"] }]), "other-shop"),
    /active shop changed/
  );
  assert.equal(harness.wasSaved(), false, "Nothing was written to the active shop.");
  const saved = await harness.run(builderCatalog([{ id: 1, name: "Shoe", price: 10, category_names: ["Shoes"] }]), "shop");
  assert.equal(saved.products.length, 1, "The shop the editor opened for is saved normally.");
});

test("A builder echo of an archived product does not duplicate or revive it", async () => {
  const live = {
    products: [{ id: 2, name: "Retired boot", price: 4000, stock: 7, status: "archived" }],
    inventory: [{ product_id: 2, stock: 7 }]
  };
  const saved = await litrusSaveHarness({ live, cached: { products: [], inventory: [] } }).run(builderCatalog([
    { id: 2, name: "Retired boot", price: 4000, status: "active", category_names: [] }
  ]));
  assert.equal(saved.products.length, 1);
  assert.equal(saved.products[0].status, "archived", "Only the owner app can unarchive a product.");
});

// Regression: archived products were still lost on builder saves in two ways. In a new-store draft the
// merge-back looked only at the draft's own list, not at the product table the save replaces. And an
// echoed archived copy went through the edit path: with no stored match it was saved as a new ACTIVE
// product, and a malformed one ("invalid name or price") blocked every save.
function draftSaveHarness({ live, draftProducts }) {
  assert.ok(saveMethod, "saveLitrusMixerCatalog should be extractable.");
  let draft = { shop_name: "New shop", categories: [{ id: 1, name: "Shoes" }], products: draftProducts };
  const StudioRenderers = { websiteBuilderDraft: () => JSON.parse(JSON.stringify(draft)), saveWebsiteBuilderDraft: next => { draft = next; } };
  const save = new Function("SQLiteEngine", "window", "StudioRenderers", "WEBSITE_BUILDER_DRAFT_SYNC_KEY",
    `return async function (input, isDraftEditor, expectedTenantId) {${saveMethod}
};`)(
    { select: name => JSON.parse(JSON.stringify((name === "products" ? live : []) || [])) },
    { ShopSQLite: { async flush() {} }, EshopServiceModel: ServiceModel, localStorage: { setItem() {} } },
    StudioRenderers, "draft-sync"
  );
  let saved = null;
  const controller = {
    getActiveTenant: () => ({ id: "draft", name: "New shop" }),
    tenantCatalogs: () => [{ tenant_id: "draft", categories: [{ id: 1, name: "Shoes" }], store: {}, products: [] }],
    setActiveTenantCatalog(_tenant, catalog) { saved = catalog; }
  };
  return { run: input => save.call(controller, input, true, "draft").then(() => ({ saved, draft })) };
}

test("A new-store draft save keeps the archived products of the table it replaces", async () => {
  const archived = { id: 9, name: "Retired sandal", price: 800, stock: 2, status: "archived", sku: "SAN-9" };
  const live = [{ id: 601, name: "Runner", price: 2500, status: "active", category_id: 1 }, archived];
  const { saved, draft } = await draftSaveHarness({ live, draftProducts: [{ id: 601, name: "Runner", price: 2500, category_id: 1 }] })
    .run(builderCatalog([{ id: 601, name: "Runner", price: 2600, category_names: ["Shoes"] }]));
  assert.deepEqual(saved.products.find(product => product.id === 9), archived, "the archived product is kept exactly as stored");
  assert.equal(saved.products.find(product => product.id === 601).price, 2600);
  assert.equal(draft.products.length, 1, "the draft's own list is unchanged in size");
});

test("An echoed archived copy is never saved as an active product or edited", async () => {
  const stored = { id: 2, name: "Retired boot", price: 4000, stock: 7, status: "archived", sku: "BOOT-1", category_id: 1 };
  const live = {
    products: [{ id: 1, name: "Shoe", price: 10, stock: 3, status: "active", category_id: 1 }, stored],
    inventory: [{ product_id: 1, stock: 3 }, { product_id: 2, stock: 7 }]
  };
  // A malformed echo (no name, no price) used to throw "invalid name or price" and block the whole save.
  const saved = await litrusSaveHarness({ live, cached: { products: [], inventory: [] } }).run(builderCatalog([
    { id: 1, name: "Shoe", price: 12, category_names: ["Shoes"] },
    { id: 2, name: "", price: null, status: "archived" },
    { id: 77, name: "Ghost", price: 5, status: "archived", category_names: ["Shoes"] }
  ]));
  assert.deepEqual(saved.products.map(product => String(product.id)).sort(), ["1", "2"],
    "an archived echo with no stored product is not created as a new (active) product");
  assert.deepEqual(saved.products.find(product => product.id === 2), stored, "the stored archived product is untouched");
  assert.equal(saved.products.find(product => product.id === 1).price, 12, "the rest of the save still happens");
});

test("Archived products are not sent to Litrus and publishing skips them", () => {
  const sendCatalog = app.match(/const sendCatalog = \(\) => \{([\s\S]*?)\n        \};/)?.[1];
  assert.ok(sendCatalog, "sendCatalog should be extractable.");
  const rows = [
    { id: 1, name: "Live", price: 10, status: "active" },
    { id: 2, name: "Archived", price: 20, status: "archived" }
  ];
  const messages = [];
  const run = new Function(
    "SQLiteEngine", "StudioRenderers", "isDraftEditor", "litrusFrame", "window", "savedLitrusRecipe",
    "validLitrusHtml", "savedLitrusHtml", "AppUtils",
    sendCatalog
  );
  run(
    {
      getStore: () => ({ name: "Shop" }),
      getCategories: () => [],
      select: (_table, predicate) => rows.filter(predicate || (() => true))
    },
    {}, false,
    { contentWindow: { postMessage: message => messages.push(message) } },
    { location: { origin: "https://app.test" }, EshopServiceModel: ServiceModel },
    null, () => false, "", { showToast() {} }
  );
  assert.deepEqual(messages[0].catalog.products.map(product => product.id), [1]);
  const publish = app.slice(app.indexOf("openCloudflarePublishModal(publishImmediately = false) {"));
  assert.match(publish.slice(0, 6000), /SQLiteEngine\.select\("products", product => product\.status !== "archived"\)/);
});

// ---------------------------------------------------------------------------------------------
// Owner UI against the Worker contract
// ---------------------------------------------------------------------------------------------

const renderStart = app.indexOf("  manualPaymentLabel(method) {");
const renderEnd = app.indexOf("  renderMainShopContent(path, snapshot, skipBusinessLens = false) {");
assert.ok(renderStart > 0 && renderEnd > renderStart, "The order and discount renderers should be extractable.");
const renderers = new Function(
  "AppUtils",
  `return {${app.slice(renderStart, renderEnd)}
    formatMainShopMoney(amount, currency) { return \`\${currency} \${Number(amount).toFixed(2)}\`; }
  };`
)({ escapeHTML, formatDateTime: value => (value ? new Date(value).toLocaleDateString('en-GB') : 'Date unavailable') });

const workerOrder = (overrides = {}) => ({
  order_number: "ORD-TESTORDER0001",
  status: "pending",
  customer_name: "Wanjiru <b>",
  customer_email: "w@example.test",
  currency: "KES",
  subtotal: 1000, discount: 100, shipping: 0, total: 900,
  payment_status: "unpaid", payment_method: null,
  discount_code: "SAVE10", needs_attention: false, attention_reason: null,
  items: [{ name: "Tote", quantity: 2 }],
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides
});

test("Order cards show discount, payment method and the needs-attention reason from the Worker", () => {
  const unpaid = renderers.renderRemoteOrderRow(workerOrder(), "KES");
  assert.match(unpaid, /Discount \(SAVE10\): -KES 100\.00/);
  assert.match(unpaid, /data-online-order-pay="ORD-TESTORDER0001"/);
  for (const method of ["cash", "mobile_money", "bank", "other"]) {
    assert.match(unpaid, new RegExp(`<option value="${method}">`));
  }
  assert.match(unpaid, /Wanjiru &lt;b&gt;/, "Customer-supplied text is escaped.");

  const attention = renderers.renderRemoteOrderRow(workerOrder({
    payment_status: "paid", payment_method: "paystack",
    needs_attention: true, attention_reason: "insufficient_stock:TOTE-1,TOTE-2"
  }), "KES");
  assert.match(attention, /data-needs-attention/);
  assert.match(attention, /Paid, but stock ran short for TOTE-1, TOTE-2/);
  assert.match(attention, /Payment: paid via Paystack/);
  assert.doesNotMatch(attention, /data-online-order-pay=/, "A paid order cannot be marked paid again.");

  const afterCancel = renderers.renderRemoteOrderRow(workerOrder({
    status: "cancelled", payment_status: "paid", payment_method: "paystack",
    needs_attention: true, attention_reason: "paid_after_cancel"
  }), "KES");
  assert.match(afterCancel, /paid for an order you cancelled\. Refund the customer or reopen the order\./);
  assert.doesNotMatch(afterCancel, /paid_after_cancel/, "The raw code is never shown to the owner.");

  const duplicate = renderers.renderRemoteOrderRow(workerOrder({
    payment_status: "paid", payment_method: "paystack",
    needs_attention: true, attention_reason: "duplicate_payment"
  }), "KES");
  assert.match(duplicate, /marked paid by hand and the customer also paid online\. Refund one of the payments\./);
  assert.doesNotMatch(duplicate, /duplicate_payment/, "The raw code is never shown to the owner.");

  assert.match(renderers.orderAttentionText("something_new"), /needs your attention \(something_new\)/, "Unknown codes still fall back to a generic message.");

  const cancelled = renderers.renderRemoteOrderRow(workerOrder({ status: "cancelled" }), "KES");
  assert.doesNotMatch(cancelled, /data-online-order-pay=/, "The Worker rejects payments on cancelled orders with 409.");

  const summary = renderers.renderOrderAttentionSummary([workerOrder(), workerOrder({ order_number: "ORD-TESTORDER0002", needs_attention: true })]);
  assert.match(summary, /1 order needs attention:<\/strong> ORD-TESTORDER0002/);
  assert.equal(renderers.renderOrderAttentionSummary([workerOrder()]), "");
});

test("Discount panel renders Worker codes with cents converted for display", () => {
  const html = renderers.renderDiscountPanel({
    currency: "KES",
    remoteDiscounts: [
      { code: "SAVE10", type: "percent", value: 10, min_order_cents: 50000, usage_limit: 5, used_count: 2, active: true, ends_at: "2026-12-31T20:59:59.000Z" },
      { code: "FLAT<5>", type: "fixed", value: 25000, min_order_cents: 0, usage_limit: null, used_count: 0, active: false, ends_at: null }
    ]
  });
  assert.match(html, /10% off · min spend KES 500\.00 · used 2 of 5 · expires 2026-12-31 · active/);
  assert.match(html, /KES 250\.00 off · used 0 · disabled/);
  assert.match(html, /data-discount-toggle="SAVE10" data-discount-active="1">Disable/);
  assert.match(html, /data-discount-toggle="FLAT&lt;5&gt;" data-discount-active="0">Enable/);
});

function bindHarness({ bridge, snapshot, html = "" }) {
  const method = app.match(/\n  (bindBusinessCloudActions\(container, path, snapshot, tenantId = [^\n]*\) \{[\s\S]*?)\n  \},\n\n  businessStoreId\(/)?.[1];
  assert.ok(method, "bindBusinessCloudActions should be extractable.");
  const dom = new JSDOM(`<div id="c">${html}</div>`, { url: "https://app.test/" });
  const { window } = dom;
  window.confirm = () => true;
  window.EshopInventoryBridge = bridge;
  window.EshopServiceModel = ServiceModel;
  const container = window.document.getElementById("c");
  const calls = [];
  const factory = new Function(
    "calls", "AppController", "AppUtils", "window", "document", "CSS", "FormData", "console",
    `return {
      manualPaymentLabel(method) { return ({ cash: "Cash", mobile_money: "Mobile money", bank: "Bank transfer", other: "Other" })[method] || method; },
      renderMainShopContent(path, updated) { calls.push({ rendered: updated }); return ""; },
      ${method}
  }
    };`
  );
  return {
    container, window, calls,
    bind(path = "/account/web/studio/store/orders") {
      const instance = factory(calls, {}, { escapeHTML }, window, window.document, { escape: value => value }, window.FormData, console);
      instance.bindBusinessCloudActions(container, path, snapshot, "shop");
      return instance;
    }
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test("Mark paid posts the chosen method and reference to the Worker and shows the returned order", async () => {
  const sent = [];
  const bridge = {
    async recordStorefrontOrderPayment(tenantId, orderNumber, payment) {
      sent.push({ tenantId, orderNumber, payment });
      return {
        ok: true, duplicate: false, needs_attention: true,
        order: workerOrder({ payment_status: "paid", payment_method: payment.method, needs_attention: true, attention_reason: "insufficient_stock:TOTE-1" })
      };
    }
  };
  const harness = bindHarness({
    bridge,
    snapshot: { sales: [], remoteOrders: [workerOrder()] },
    html: `<p data-online-orders-status></p><div data-online-order-row><select data-online-order-pay-method><option value="mobile_money" selected>M</option></select><input data-online-order-pay-ref value=" QJK123 "><button data-online-order-pay="ORD-TESTORDER0001"></button></div>`
  });
  harness.bind();
  harness.container.querySelector("[data-online-order-pay]").click();
  await settle();
  assert.deepEqual(sent, [{
    tenantId: "shop", orderNumber: "ORD-TESTORDER0001",
    payment: { method: "mobile_money", reference: "QJK123" }
  }]);
  const rendered = harness.calls.at(-1).rendered;
  assert.equal(rendered.remoteOrders[0].payment_status, "paid");
  assert.equal(rendered.remoteOrders[0].needs_attention, true, "The attention flag from the Worker response is kept.");
});

test("Mark paid reports Worker errors and leaves the order unpaid", async () => {
  const bridge = {
    async recordStorefrontOrderPayment() {
      const error = new Error("This order has been cancelled.");
      error.status = 409;
      throw error;
    }
  };
  const harness = bindHarness({
    bridge,
    snapshot: { sales: [], remoteOrders: [workerOrder()] },
    html: `<p data-online-orders-status></p><div data-online-order-row><select data-online-order-pay-method><option value="cash" selected>c</option></select><input data-online-order-pay-ref><button data-online-order-pay="ORD-TESTORDER0001"></button></div>`
  });
  harness.bind();
  const button = harness.container.querySelector("[data-online-order-pay]");
  button.click();
  await settle();
  assert.equal(harness.container.querySelector("[data-online-orders-status]").textContent, "This order has been cancelled.");
  assert.equal(button.disabled, false);
  assert.equal(harness.calls.length, 0);
});

test("Discount form sends Worker units: whole percent, cents for fixed amounts, ISO expiry", async () => {
  const sent = [];
  const bridge = {
    async createDiscountCode(tenantId, body) {
      sent.push({ tenantId, body });
      return { discount: { code: body.code, type: body.type, value: body.value, min_order_cents: body.min_order_cents, usage_limit: body.usage_limit, used_count: 0, active: true, ends_at: body.ends_at || null } };
    }
  };
  const harness = bindHarness({
    bridge,
    snapshot: { sales: [], remoteDiscounts: [] },
    html: `<form data-discount-form>
      <input name="code" value=" save10 "><select name="type"><option value="fixed" selected>f</option></select>
      <input name="value" value="250.50"><input name="min_order" value="500"><input name="ends_at" value="2030-01-31"><input name="usage_limit" value="">
      <button type="submit">Add</button><p role="status"></p></form><p data-discounts-status></p>`
  });
  harness.bind();
  harness.container.querySelector("form").dispatchEvent(new harness.window.Event("submit", { cancelable: true, bubbles: true }));
  await settle();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].tenantId, "shop");
  assert.equal(sent[0].body.code, "SAVE10");
  assert.equal(sent[0].body.type, "fixed");
  assert.equal(sent[0].body.value, 25050, "Fixed amounts are sent as integer cents.");
  assert.equal(sent[0].body.min_order_cents, 50000);
  assert.equal(sent[0].body.usage_limit, null);
  assert.equal(sent[0].body.active, true);
  assert.match(sent[0].body.ends_at, /^2030-01-(30|31)T\d\d:\d\d:\d\d\.000Z$/);
  assert.equal(harness.calls.at(-1).rendered.remoteDiscounts[0].code, "SAVE10");
});

test("Discount form rejects values the Worker would refuse before sending them", async () => {
  let called = 0;
  const harness = bindHarness({
    bridge: { async createDiscountCode() { called += 1; return {}; } },
    snapshot: { sales: [], remoteDiscounts: [] },
    html: `<form data-discount-form><input name="code" value="BIG"><select name="type"><option value="percent" selected>p</option></select>
      <input name="value" value="150"><input name="min_order" value=""><input name="ends_at" value=""><input name="usage_limit" value="">
      <button type="submit">Add</button><p role="status"></p></form>`
  });
  harness.bind();
  harness.container.querySelector("form").dispatchEvent(new harness.window.Event("submit", { cancelable: true, bubbles: true }));
  await settle();
  assert.equal(called, 0);
  assert.match(harness.container.querySelector('[role="status"]').textContent, /whole number from 1 to 100/);
});

test("Bridge calls use the Worker's URLs, methods and tenant routing", async () => {
  const start = app.indexOf("window.EshopInventoryBridge = {");
  const end = app.indexOf("\n};", start);
  assert.ok(start >= 0 && end > start);
  const requests = [];
  const bridge = new Function("AppController", `${app.slice(start, end + 3).replace("window.EshopInventoryBridge =", "return")}`)({
    async cloudflareRequest(path, options = {}, tenantId) {
      requests.push({ path, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined, tenantId });
      return {};
    },
    getActiveTenant: () => ({ id: "shop" })
  });
  await bridge.recordStorefrontOrderPayment("shop", "ORD-TESTORDER0001", { method: "cash" });
  await bridge.listDiscountCodes("shop");
  await bridge.createDiscountCode("shop", { code: "A1" });
  await bridge.updateDiscountCode("shop", { code: "A1", active: false });
  await bridge.deleteDiscountCode("shop", "A1");
  assert.deepEqual(requests, [
    { path: "/api/store/orders/ORD-TESTORDER0001/payment?tenant=shop", method: "POST", body: { method: "cash" }, tenantId: "shop" },
    { path: "/api/store/discounts?tenant=shop", method: "GET", body: undefined, tenantId: "shop" },
    { path: "/api/store/discounts?tenant=shop", method: "POST", body: { code: "A1" }, tenantId: "shop" },
    { path: "/api/store/discounts?tenant=shop", method: "PATCH", body: { code: "A1", active: false }, tenantId: "shop" },
    { path: "/api/store/discounts?tenant=shop&code=A1", method: "DELETE", body: undefined, tenantId: "shop" }
  ]);
});

// ---------------------------------------------------------------------------------------------
// Owner alerts: outbox polling without duplicates
// ---------------------------------------------------------------------------------------------

function alertEnvironment({ responses, token = "owner-key", draft = false } = {}) {
  const store = new Map();
  const requests = [];
  globalThis.window = {
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); }
    },
    AppController: {
      isWebsiteBuilderDraftTenant: () => draft,
      cloudflareConnection: () => ({ token, origin: "https://worker.test" }),
      async cloudflareRequest(path, options = {}, tenantId) {
        requests.push({ path, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined, tenantId });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      }
    }
  };
  return { store, requests };
}

const alertRow = (id, overrides = {}) => ({
  id: `${id}`.padStart(8, "0") + "-0000-4000-8000-000000000000",
  kind: "order", ref: "ORD-X", title: `Alert ${id}`, body: "body", created_at: "2026-01-01T00:00:00.000Z", read_at: null,
  ...overrides
});

test("Owner alert polling alerts once per outbox row and never replays the backlog", async () => {
  const first = [alertRow(1), alertRow(2, { read_at: "2026-01-01T01:00:00.000Z" })];
  const { requests } = alertEnvironment({
    responses: [
      { notifications: first, unread_count: 1 },
      { notifications: first, unread_count: 1 },
      { notifications: [alertRow(3), ...first], unread_count: 2 },
      { notifications: [alertRow(3), ...first], unread_count: 2 }
    ]
  });
  await import("../src/business-notifications.js?owner-alerts-1");
  const owner = globalThis.window.BusinessNotifications.owner;

  const seeded = await owner.poll("shop");
  assert.deepEqual(seeded.fresh, [], "The first poll on a device only records existing rows.");
  assert.equal(seeded.unread_count, 1);
  assert.deepEqual((await owner.poll("shop")).fresh, [], "An unchanged outbox raises nothing.");
  const next = await owner.poll("shop");
  assert.deepEqual(next.fresh.map(row => row.title), ["Alert 3"]);
  assert.deepEqual((await owner.poll("shop")).fresh, [], "A row already alerted is never alerted again.");
  assert.deepEqual(requests[0], {
    path: "/api/store/notifications?tenant=shop&limit=50", method: "GET", body: undefined, tenantId: "shop"
  });
  delete globalThis.window;
});

test("Rows the owner already viewed in the list do not toast on the next poll", async () => {
  const seeded = [alertRow(1)];
  const withNew = [alertRow(2), alertRow(1)];
  alertEnvironment({
    responses: [
      { notifications: seeded, unread_count: 1 },
      { notifications: withNew, unread_count: 2 },
      { notifications: withNew, unread_count: 2 }
    ]
  });
  await import("../src/business-notifications.js?owner-alerts-2");
  const owner = globalThis.window.BusinessNotifications.owner;
  await owner.poll("shop");
  const listed = await owner.list("shop");
  assert.equal(listed.notifications.length, 2);
  assert.deepEqual((await owner.poll("shop")).fresh, []);
  delete globalThis.window;
});

test("Overlapping polls share one request and read rows are never alerted", async () => {
  const { requests } = alertEnvironment({
    responses: [
      { notifications: [alertRow(1)], unread_count: 1 },
      { notifications: [alertRow(2, { read_at: "2026-01-01T01:00:00.000Z" }), alertRow(1)], unread_count: 1 }
    ]
  });
  await import("../src/business-notifications.js?owner-alerts-3");
  const owner = globalThis.window.BusinessNotifications.owner;
  const [a, b] = await Promise.all([owner.poll("shop"), owner.poll("shop")]);
  assert.equal(requests.length, 1);
  assert.equal(a, b);
  assert.deepEqual((await owner.poll("shop")).fresh, [], "An alert already read on another device is not shown.");
  delete globalThis.window;
});

test("Polling is skipped for draft shops and without credentials, and backs off after a failure", async () => {
  let env = alertEnvironment({ responses: [], draft: true });
  await import("../src/business-notifications.js?owner-alerts-4");
  assert.equal(await globalThis.window.BusinessNotifications.owner.poll("draft"), null);
  assert.equal(env.requests.length, 0);
  delete globalThis.window;

  env = alertEnvironment({ responses: [], token: "" });
  await import("../src/business-notifications.js?owner-alerts-5");
  assert.equal(await globalThis.window.BusinessNotifications.owner.poll("shop"), null);
  assert.equal(env.requests.length, 0);
  delete globalThis.window;

  env = alertEnvironment({ responses: [Object.assign(new Error("Shop owner authorization required."), { status: 401 })] });
  await import("../src/business-notifications.js?owner-alerts-6");
  const owner = globalThis.window.BusinessNotifications.owner;
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await owner.poll("shop"), null);
    assert.equal(await owner.poll("shop"), null, "The second attempt is skipped during the backoff window.");
  } finally {
    console.warn = warn;
  }
  assert.equal(env.requests.length, 1);
  delete globalThis.window;
});

test("Marking alerts read uses the Worker's request bodies", async () => {
  const { requests } = alertEnvironment({ responses: [{ ok: true }, { ok: true }] });
  await import("../src/business-notifications.js?owner-alerts-7");
  const owner = globalThis.window.BusinessNotifications.owner;
  await owner.markRead("shop", "all");
  await owner.markRead("shop", alertRow(5).id);
  assert.deepEqual(requests.map(({ path, method, body }) => ({ path, method, body })), [
    { path: "/api/store/notifications/read?tenant=shop", method: "POST", body: { all: true } },
    { path: "/api/store/notifications/read?tenant=shop", method: "POST", body: { ids: [alertRow(5).id] } }
  ]);
  delete globalThis.window;
});

test("Website payment methods from the Worker are labelled like POS receipts", async () => {
  const store = new Map();
  globalThis.window = { AppUtils: { escapeHTML } };
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
  try {
    await import("../src/business-lens.js?payment-labels");
    const merged = globalThis.window.BusinessLens.mergeStorefrontOrders([], [
      { order_number: "ORD-A", status: "pending", payment_status: "paid", payment_method: "mobile_money", total: 10, created_at: "2026-01-01", items: [] },
      { order_number: "ORD-B", status: "pending", payment_status: "paid", payment_method: "cash", total: 10, created_at: "2026-01-01", items: [] },
      { order_number: "ORD-C", status: "pending", payment_status: "paid", payment_method: "paystack", total: 10, created_at: "2026-01-01", items: [] },
      { order_number: "ORD-D", status: "pending", payment_status: "unpaid", payment_method: null, total: 10, created_at: "2026-01-01", items: [] }
    ]);
    const label = reference => merged.find(sale => sale.reference === reference).paymentMethod;
    assert.equal(label("ORD-A"), "Mobile money");
    assert.equal(label("ORD-B"), "Cash");
    assert.equal(label("ORD-C"), "Paystack");
    assert.equal(label("ORD-D"), "other");
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
  }
});
