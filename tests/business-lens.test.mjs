import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Main Store screens use the compact Craft header and back navigation", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const start = source.indexOf("renderMainShopWorkspace(path) {");
  const end = source.indexOf("\n  webStudioNavigation()", start);
  assert.ok(start >= 0 && end > start, "Main Store should have a bounded workspace renderer.");
  const renderer = source.slice(start, end);
  assert.match(renderer, /studio-workspace-back" href="\/" data-route="\/" data-home-screen aria-label="Back to Craft home"/);
  assert.match(renderer, /studio-workspace-tab-title">\$\{AppUtils\.escapeHTML\(page\.title\)\}<\/h1>/);
  assert.doesNotMatch(renderer, /YOUR BUSINESS|Your Business|studio-workspace-kicker/);
  assert.match(source, /\.business-lens-shell \.studio-workspace-back\s*\{[^}]*display:\s*grid[^}]*width:\s*24px/);
  assert.match(source, /\.business-lens-shell \.studio-workspace-back > svg\s*\{[^}]*width:\s*24px[^}]*stroke:\s*currentColor/);
  assert.match(source, /\.business-lens-shell \.studio-workspace-heading \.studio-workspace-tab-title\s*\{[^}]*font-size:\s*\.92rem !important/);
  assert.match(source, /\.business-lens-shell #store-workspace-content h2\s*\{[^}]*font-size:\s*\.82rem !important/);
});

test("Web Studio separates Orders and Bookings and ranks batched storefront events", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /title: "Orders", route: "\/account\/web\/studio\/store\/orders"/);
  assert.match(source, /title: "Bookings", route: "\/account\/web\/studio\/store\/bookings"/);
  assert.match(source, /page\.route === "\/account\/web\/studio\/store\/orders"[\s\S]*?\$\{orderRows\(orders\)\}\$\{remoteOrderRows\}/);
  assert.match(source, /page\.route === "\/account\/web\/studio\/store\/bookings"[\s\S]*?Storefront hold requests/);
  assert.match(source, /Most viewed products[\s\S]*?Most added to carts[\s\S]*?Most wishlisted products[\s\S]*?Most booked products/);
  assert.match(source, /Submitted product holds/);
  assert.match(source, /fetchStorefrontEventAnalytics\(tenantId, 30\)/);
  assert.match(source, /data-business-product-analytics aria-label="Refresh product activity">Refresh<\/button>/);
  assert.match(source, /data-product-analytics-status/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /store\/orders[\s\S]*?store\/bookings/);
});

test("Web Studio product upload offers keep, 3D, video, and cutout modes", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /\["keep", "Keep"\].*\["3d", "3D"\].*\["video", "Video"\].*\["cutout", "Cutout images"\]/);
  assert.match(source, /data-web-product-video-record>Record video/);
  assert.match(source, /data-web-product-video-pick>Pick video/);
  assert.match(source, /capture="environment" data-web-product-record-file/);
});

test("storefront visit history records customer pages, not Craft app screens", async () => {
  for (const file of ["../index.html", "../www/index.html"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const methodStart = source.indexOf("  isStorefrontVisitPath(path) {");
    const methodEnd = source.indexOf("\n  recordWebVisit(path) {", methodStart);
    assert.ok(methodStart >= 0 && methodEnd > methodStart, `${file} should have a bounded visit classifier.`);
    const methodSource = source.slice(methodStart, methodEnd);
    const isStorefrontVisitPath = new Function("path", methodSource.slice(methodSource.indexOf("{") + 1, methodSource.lastIndexOf("}")));
    for (const path of [
      "/categories", "/pages/about", "/category/devices", "/product/phone",
      "/search", "/bag", "/checkout", "/checkout/confirmation", "/favorites"
    ]) {
      assert.equal(isStorefrontVisitPath(path), true, `${path} is a customer storefront page in ${file}.`);
    }
    for (const path of [
      "/", "/web", "/store/products", "/store/revenue", "/account/main-shop", "/pos", "/pos/overview", "/app-account"
    ]) {
      assert.equal(isStorefrontVisitPath(path), false, `${path} is an app screen, not storefront traffic in ${file}.`);
    }
    assert.match(source, /recordWebVisit\(path\) \{\s*if \(!this\.isStorefrontVisitPath\(path\)\) return;/);
    assert.match(source, /visit\.tenant_id === activeTenant\.id && AppController\.isStorefrontVisitPath\(visit\.path\)/);
    assert.match(source, /item\.tenant_id === tenantId && AppController\.isStorefrontVisitPath\(item\.path\)/);
    assert.match(source, /storefrontAnalyticsPaths = new Set\([\s\S]*?"\/account\/web\/studio\/dashboard\/overview"[\s\S]*?"\/account\/web\/studio\/dashboard\/visits"[\s\S]*?"\/account\/web\/studio\/dashboard\/traffic"[\s\S]*?if \(storefrontAnalyticsPaths\.has\(path\)\)/);
    assert.match(source, /snapshot\.remoteAnalytics\?\.recent_visits/);
    assert.match(source, /snapshot\.remoteAnalytics\.pages/);
    assert.match(source, /Recent published-site visits/);
    assert.match(source, /data-business-cloud-analytics>Refresh<\/button>/);
  }
});

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
    assert.match(transactions, /POS-1/, "The transaction view includes locally recorded POS sales.");
    assert.match(transactions, /WEB-1/, "The transaction view includes website sales.");
    const historicalSnapshot = {
      ...snapshot,
      sales: [{ ...snapshot.sales[0], date: "2020-06-01T10:00:00.000Z" }]
    };
    const historicalDashboard = globalThis.window.BusinessLens.render(
      historicalSnapshot, "/account/main-shop", context
    );
    assert.match(historicalDashboard, /Revenue<\/span><strong>KES\s*200\.00<\/strong><small>All recorded time/);
    assert.match(historicalDashboard, /Paid orders<\/span><strong>1<\/strong>/);
    assert.match(historicalDashboard, /Gross profit<\/span><strong>KES\s*80\.00/);
    assert.match(historicalDashboard, /Customers<\/span><strong>1/);
    assert.match(historicalDashboard, /Average order<\/span><strong>KES\s*200\.00/);
    const mergedSales = globalThis.window.BusinessLens.mergeStorefrontOrders([
      { id: "local-web-1", reference: "WEB-1", channel: "Website", status: "pending", total: 120, collected: 0, lineItems: [] },
      { id: "pos-1", reference: "POS-1", channel: "POS", status: "confirmed", total: 80, collected: 80, lineItems: [] }
    ], [{
      order_number: "WEB-1", status: "processing", payment_status: "paid", total: 120,
      currency: "KES", customer_name: "Online Buyer", customer_email: "buyer@example.test",
      created_at: recent, items: [{ product_id: 7, name: "Phone", quantity: 1, unit_price: 120 }]
    }, {
      order_number: "WEB-2", status: "cancelled", payment_status: "paid", total: 50,
      currency: "KES", created_at: recent, items: []
    }]);
    assert.equal(mergedSales.length, 3, "Server orders replace stale local copies without removing POS sales.");
    assert.equal(mergedSales.find(sale => sale.reference === "WEB-1").status, "paid");
    assert.equal(mergedSales.find(sale => sale.reference === "WEB-1").collected, 120);
    assert.equal(mergedSales.find(sale => sale.reference === "WEB-1").customerEmail, "buyer@example.test");
    assert.equal(mergedSales.find(sale => sale.reference === "WEB-1").lineItems[0].unitPrice, 120);
    assert.equal(mergedSales.find(sale => sale.reference === "WEB-2").collected, 0);
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
