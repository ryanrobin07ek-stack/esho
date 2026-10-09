import assert from "node:assert/strict";
import test from "node:test";

test("Your Business renders all five sections from the local business snapshot", async () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
  globalThis.window = {
    AppUtils: { escapeHTML(value) { return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); } },
    AppController: {
      getActiveTenant() { return { id: "test-shop" }; },
      formatMainShopMoney(value, currency = "KES") { return `${currency} ${Number(value).toFixed(2)}`; }
    }
  };

  try {
    const { default: unused, ...module } = await import("../src/business-lens.js?business-lens-test");
    const today = new Date();
    const recent = new Date(today.getTime() - 2 * 86400000).toISOString();
    const snapshot = {
      currency: "KES",
      categories: [{ name: "Devices" }],
      products: [{ name: "Phone", sku: "P1", categoryName: "Devices", price: 100, costPrice: 60, stock: 8 }],
      sales: [{
        id: "sale-1", reference: "POS-1", channel: "POS", date: recent, currency: "KES",
        status: "paid", total: 200, collected: 200, customerName: "A Customer", customerPhone: "0712345678",
        paymentMethod: "cash", lineItems: [{ productId: "P1", name: "Phone", quantity: 2, unitPrice: 100, costPrice: 60 }]
      }, {
        id: "sale-2", reference: "WEB-1", channel: "Website", date: recent, currency: "KES",
        status: "paid", total: 300, collected: 300, customerName: "Web Buyer", customerEmail: "web@example.com",
        city: "Nairobi", country: "Kenya", paymentMethod: "mpesa",
        lineItems: [{ productId: "P1", name: "Phone", quantity: 3, unitPrice: 100, costPrice: 60 }]
      }],
      expenses: [{ date: recent, amount: 20, category: "Rent", label: "Rent" }],
      instances: [{ id: "primary", name: "Main till", mode: "always-open", status: "active" }]
    };
    const context = {
      visits: [{ created_at: recent, visitor_id: "visitor-1", path: "/product/phone", device: "mobile", referrer: "" }],
      events: [],
      newsletter: [{ id: 1, name: "A Customer", email: "buyer@example.com", phone: "", created_at: recent }],
      points: [],
      settings: { currency: "KES", taxRate: 0 }
    };
    const paths = [
      ["/account/main-shop", "Business performance"],
      ["/account/main-shop/insights", "BUSINESS SIGNAL"],
      ["/store/revenue", "Revenue this period"],
      ["/store/channels", "Storefront revenue"],
      ["/store/sales", "All transactions"],
      ["/store/products", "Product leaderboard"],
      ["/store/inventory", "Stock status mix"],
      ["/store/categories", "Category performance"],
      ["/account/customers", "Customer book"],
      ["/account/main-shop/marketing", "Conversion funnel"],
      ["/account/customers/newsletter", "Subscriber list"],
      ["/account/main-shop/finance", "Profit and loss"],
      ["/account/main-shop/stores", "Store / register scorecard"],
      ["/account/main-shop/settings", "Business analysis preferences"],
      ["/account/main-shop/help", "Data and privacy"]
    ];
    assert.ok(module && globalThis.window.BusinessLens, "The module exposes its dashboard API on window.");
    for (const [path, expected] of paths) {
      const html = globalThis.window.BusinessLens.render(snapshot, path, context);
      assert.ok(html.includes(expected), `${path} should render its own screen.`);
    }
    const channels = globalThis.window.BusinessLens.render(snapshot, "/store/channels", context);
    assert.match(channels, /Web payment methods/);
    assert.match(channels, /mpesa/);
    const inventory = globalThis.window.BusinessLens.render(snapshot, "/store/inventory", context);
    assert.match(inventory, /Inventory capital by category/);
    assert.match(inventory, /Fastest movers/);
    const finance = globalThis.window.BusinessLens.render(snapshot, "/account/main-shop/finance", context);
    assert.match(finance, /Expense category breakdown/);
    assert.match(finance, /Finance trends/);
    const customers = globalThis.window.BusinessLens.render(snapshot, "/account/customers", context);
    assert.match(customers, /Customer retention by first-purchase cohort/);
    assert.match(customers, /Nairobi, Kenya/);
    assert.match(customers, /Geographic revenue concentration/);
    const marketing = globalThis.window.BusinessLens.render(snapshot, "/account/main-shop/marketing", context);
    assert.match(marketing, /Owned sales-channel comparison/);
    assert.match(marketing, /Fastest movers by owned channel/);
    const revenue = globalThis.window.BusinessLens.render(snapshot, "/store/revenue", context);
    assert.match(revenue, /Trading rhythm/);
    assert.match(revenue, /Statistical outliers/);
    assert.match(revenue, /Forecast · estimate and range/);
    const transactions = globalThis.window.BusinessLens.render(snapshot, "/store/sales", context);
    assert.match(transactions, /Search receipt \/ customer/);
    assert.match(transactions, /Payment status/);
    globalThis.window.BusinessLens.saveFilters({ range: "30d", channel: "all", category: "all", granularity: "day", transactionQuery: "WEB-1" });
    const filteredTransactions = globalThis.window.BusinessLens.render(snapshot, "/store/sales", context);
    assert.match(filteredTransactions, /WEB-1/);
    assert.doesNotMatch(filteredTransactions, /POS-1/);
    const before = globalThis.window.BusinessLens.render(snapshot, "/account/main-shop", context);
    globalThis.window.BusinessLens.saveFilters({ range: "all", channel: "pos", category: "Devices", granularity: "month" });
    const after = globalThis.window.BusinessLens.render(snapshot, "/account/main-shop", context);
    assert.equal(typeof before, "string");
    assert.equal(typeof after, "string");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
