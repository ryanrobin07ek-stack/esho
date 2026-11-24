// window.EshopInventoryBridge methods (the inventory screen talks to the Craft cloud through these).
// Moved verbatim out of src/app/main.js; main.js spreads these back in at the same spots.
import { AppController, SQLiteEngine } from './main.js';

export const inventoryBridgeMethods = {
  activeWebsiteId() {
    return AppController.getActiveTenant().id;
  },
  hasTenantOwnerKey(tenantId) {
    return Boolean(AppController.tenantCatalogs().find(item =>
      item.tenant_id === tenantId && typeof item.owner_token === "string" && item.owner_token
    ));
  },
  paystackSetupRequest(path, tenantId, options = {}, anonymous = false) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    return AppController.cloudflareRequest(
      path, { ...options, signal: controller.signal }, tenantId, anonymous
    ).catch(error => {
      if (error?.name === "AbortError") throw new Error("Paystack setup timed out. Check your connection and retry.");
      throw error;
    }).finally(() => clearTimeout(timeout));
  },
  getPaystackBanks(tenantId, currency = "KES") {
    return this.paystackSetupRequest(
      `/api/payments/paystack/banks?tenant=${encodeURIComponent(tenantId)}&currency=${encodeURIComponent(currency)}`, tenantId, {}, true
    );
  },
  getPaystackAccount(tenantId) {
    return this.paystackSetupRequest(
      `/api/payments/paystack/subaccount?tenant=${encodeURIComponent(tenantId)}`, tenantId
    );
  },
  savePaystackAccount(tenantId, details) {
    return this.paystackSetupRequest(
      `/api/payments/paystack/subaccount?tenant=${encodeURIComponent(tenantId)}`,
      tenantId, { method: "POST", body: JSON.stringify(details) }
    );
  },
  linkPaystackAccount(tenantId, sourceTenantId, sourceOwnerToken, sessionToken) {
    return AppController.cloudflareRequest(
      `/api/payments/paystack/link?tenant=${encodeURIComponent(tenantId)}`,
      {
        method: "POST",
        body: JSON.stringify({
          source_tenant_id: sourceTenantId,
          source_owner_token: sourceOwnerToken
        })
      },
      tenantId,
      false,
      sessionToken
    );
  },
  getPaystackDefault(tenantId) {
    return AppController.cloudflareRequest(
      `/api/payments/paystack/default?tenant=${encodeURIComponent(tenantId)}`,
      {}, tenantId
    );
  },
  setPaystackDefault(tenantId, sourceTenantId, sourceOwnerToken, sessionToken) {
    return AppController.cloudflareRequest(
      `/api/payments/paystack/default?tenant=${encodeURIComponent(tenantId)}`,
      {
        method: "POST",
        body: JSON.stringify({ source_tenant_id: sourceTenantId, source_owner_token: sourceOwnerToken })
      },
      tenantId,
      false,
      sessionToken
    );
  },
  initializeStorefrontPayment(tenantId, orderNumber) {
    return AppController.cloudflareRequest(
      `/api/payments/paystack/initialize?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify({ order_number: orderNumber }) }, tenantId, true
    );
  },
  verifyStorefrontPayment(tenantId, reference) {
    return AppController.cloudflareRequest(
      `/api/payments/paystack/verify?tenant=${encodeURIComponent(tenantId)}&reference=${encodeURIComponent(reference)}`,
      {}, tenantId, true
    );
  },
  createStorefrontOrder(tenantId, order) {
    return AppController.cloudflareRequest(
      `/api/orders?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify(order) }, tenantId, true
    );
  },
  listStorefrontOrders(tenantId) {
    return AppController.cloudflareRequest(
      `/api/orders?tenant=${encodeURIComponent(tenantId)}`, {}, tenantId
    );
  },
  updateStorefrontOrder(tenantId, orderNumber, status) {
    return AppController.cloudflareRequest(
      `/api/orders?tenant=${encodeURIComponent(tenantId)}`,
      { method: "PATCH", body: JSON.stringify({ order_number: orderNumber, status }) }, tenantId
    );
  },
  recordStorefrontOrderPayment(tenantId, orderNumber, payment) {
    return AppController.cloudflareRequest(
      `/api/store/orders/${encodeURIComponent(orderNumber)}/payment?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify(payment) }, tenantId
    );
  },
  listDiscountCodes(tenantId) {
    return AppController.cloudflareRequest(
      `/api/store/discounts?tenant=${encodeURIComponent(tenantId)}`, {}, tenantId
    );
  },
  createDiscountCode(tenantId, discount) {
    return AppController.cloudflareRequest(
      `/api/store/discounts?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify(discount) }, tenantId
    );
  },
  updateDiscountCode(tenantId, discount) {
    return AppController.cloudflareRequest(
      `/api/store/discounts?tenant=${encodeURIComponent(tenantId)}`,
      { method: "PATCH", body: JSON.stringify(discount) }, tenantId
    );
  },
  deleteDiscountCode(tenantId, code) {
    return AppController.cloudflareRequest(
      `/api/store/discounts?tenant=${encodeURIComponent(tenantId)}&code=${encodeURIComponent(code)}`,
      { method: "DELETE" }, tenantId
    );
  },
  listStorefrontHolds(tenantId) {
    return AppController.cloudflareRequest(
      `/api/product-holds?tenant=${encodeURIComponent(tenantId)}`, {}, tenantId
    );
  },
  updateStorefrontHold(tenantId, id, action) {
    return AppController.cloudflareRequest(
      `/api/product-holds?tenant=${encodeURIComponent(tenantId)}`,
      { method: "PATCH", body: JSON.stringify({ id, action }) }, tenantId
    );
  },
  listServiceAppointments(tenantId, filters = {}) {
    // Optional Worker filters: from, to (appointment start window), limit (1-200), offset, view, status.
    const extra = ["from", "to", "limit", "offset", "view", "status"]
      .filter(key => filters && filters[key] !== undefined && filters[key] !== null && filters[key] !== "")
      .map(key => `&${key}=${encodeURIComponent(filters[key])}`).join("");
    return AppController.cloudflareRequest(
      `/api/service-appointments?tenant=${encodeURIComponent(tenantId)}${extra}`, {}, tenantId
    );
  },
  // extra: action fields such as { starts_at } (reschedule) or { reason } (cancel). id and action always win.
  updateServiceAppointment(tenantId, id, action, extra = {}) {
    return AppController.cloudflareRequest(
      `/api/service-appointments?tenant=${encodeURIComponent(tenantId)}`,
      { method: "PATCH", body: JSON.stringify({ ...extra, id, action }) }, tenantId
    );
  },
  // Free start times for a service on one shop-local date (public Worker availability, no owner key needed).
  listServiceSlots(tenantId, serviceId, date) {
    return AppController.cloudflareRequest(
      `/api/service-appointments/availability?tenant=${encodeURIComponent(tenantId)}&service_id=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,
      {}, tenantId, true
    );
  },
  async fetchStorefrontAnalytics(tenantId, days = 30) {
    return AppController.cloudflareRequest(
      `/api/analytics/visit?tenant=${encodeURIComponent(tenantId)}&days=${encodeURIComponent(days)}`,
      { cache: "no-store" }, tenantId
    );
  },
  async fetchStorefrontEventAnalytics(tenantId, days = 30) {
    return AppController.cloudflareRequest(
      `/api/analytics/events?tenant=${encodeURIComponent(tenantId)}&days=${encodeURIComponent(days)}`,
      {}, tenantId
    );
  },
  listNewsletterSubscribers(tenantId) {
    return AppController.cloudflareRequest(
      `/api/newsletter/subscribers?tenant=${encodeURIComponent(tenantId)}`, {}, tenantId
    );
  },
  removeNewsletterSubscriber(tenantId, id) {
    return AppController.cloudflareRequest(
      `/api/newsletter/subscribers?tenant=${encodeURIComponent(tenantId)}`,
      { method: "DELETE", body: JSON.stringify({ id }) }, tenantId
    );
  },
  sendNewsletterCampaign(tenantId, subject, message) {
    return AppController.cloudflareRequest(
      `/api/newsletter/send?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify({ subject, message }) }, tenantId
    );
  },
  createInvoicePaymentLink(tenantId, payload) {
    return AppController.cloudflareRequest(
      `/api/invoices/payment-link?tenant=${encodeURIComponent(tenantId)}`,
      { method: "POST", body: JSON.stringify(payload) },
      tenantId
    );
  },
  listInvoicePayments(tenantId) {
    return AppController.cloudflareRequest(
      `/api/invoices/payments?tenant=${encodeURIComponent(tenantId)}`, {}, tenantId
    );
  },
  async syncPosRecords(tenantId, method, data = {}) {
    const query = method === "GET"
      ? `&after=${encodeURIComponent(data.after || 0)}&limit=${encodeURIComponent(data.limit || 200)}`
      : "";
    return AppController.cloudflareRequest(
      `/api/business/records?tenant=${encodeURIComponent(tenantId)}${query}`,
      { method, ...(method === "POST" ? { body: JSON.stringify(data) } : {}) },
      tenantId
    );
  },
  async nearbyPairing(tenantId, method, data = {}) {
    const id = data.id ? `&id=${encodeURIComponent(data.id)}` : "";
    const response = await AppController.cloudflareRequest(
      `/api/nearby/pairing?tenant=${encodeURIComponent(tenantId)}${id}`,
      {
        method,
        headers: data.sessionToken ? { "X-Nearby-Session": data.sessionToken } : {},
        ...(method === "POST" ? {
          body: JSON.stringify({ action: data.action, offer: data.offer, answer: data.answer })
        } : {})
      },
      tenantId
    );
    return response;
  },
  async syncProductDetails(tenantId, product) {
    if (AppController.getActiveTenant().id !== tenantId) {
      throw new Error("Switch to the intended website in Studio before syncing product details.");
    }
    if (!product || !String(product.sku || "").trim()) {
      throw new Error("A product SKU is required to sync product details.");
    }
    await AppController.publishPosProduct(product);
  },
  websites() {
    return AppController.tenantCatalogs().filter(tenant =>
      tenant.tenant_id && !AppController.isWebsiteBuilderDraftTenant(tenant.tenant_id));
  },
  localCatalog(tenantId) {
    if (AppController.getActiveTenant().id === tenantId) {
      return {
        products: SQLiteEngine.select("products"),
        inventory: SQLiteEngine.select("inventory"),
        categories: SQLiteEngine.getCategories(),
        store: SQLiteEngine.getStore()
      };
    }
    return AppController.tenantCatalogs().find(item => item.tenant_id === tenantId) || null;
  },
  async catalog(tenantId) {
    return AppController.cloudflareRequest(
      `/api/catalog?tenant=${encodeURIComponent(tenantId)}`, {}, tenantId
    );
  },
  async updateLocalStock(tenantId, items) {
    const allocationBySku = new Map();
    for (const item of items) {
      const allocation = SQLiteEngine.select("main_store_inventory", row =>
        row.tenant_id === tenantId && String(row.sku) === String(item.sku))[0];
      if (!allocation) continue;
      const nextPos = Number(item.stock);
      if (!Number.isSafeInteger(nextPos) || nextPos < 0) {
        throw new Error(`POS returned an invalid stock quantity for ${item.sku}.`);
      }
      const nextMaster = Number(allocation.master_stock) + nextPos - Number(allocation.pos_stock);
      if (nextMaster < Number(allocation.web_stock) + Number(allocation.reserved_stock)) {
        throw new Error(`POS stock for ${item.sku} would exceed the saved master inventory allocation.`);
      }
      const updated = {
        ...allocation, pos_stock: nextPos, master_stock: nextMaster,
        updated_at: new Date().toISOString()
      };
      SQLiteEngine.update("main_store_inventory", row => row.id === allocation.id, () => updated);
      allocationBySku.set(String(item.sku), updated);
    }
    const stockBySku = new Map(items.map(item => [String(item.sku), item.stock]));
    const updateCatalog = catalog => {
      if (!catalog) return;
      for (const product of catalog.products || []) {
        const key = String(product.sku || "");
        if (!stockBySku.has(key)) continue;
        const allocation = allocationBySku.get(key);
        product.stock = allocation
          ? (Number(allocation.web_enabled) === 1 ? Number(allocation.web_stock) : 0)
          : stockBySku.get(key);
        product.inventory_shared = true;
      }
      for (const inventory of catalog.inventory || []) {
        const product = (catalog.products || []).find(item => item.id === inventory.product_id);
        const key = String(product?.sku || "");
        if (!product || !stockBySku.has(key)) continue;
        inventory.stock = product.stock;
        inventory.status = inventory.stock === 0 ? "out_of_stock"
          : inventory.stock <= (inventory.low_stock_threshold || 10) ? "low_stock" : "in_stock";
      }
    };
    const cached = AppController.tenantCatalogs().find(item => item.tenant_id === tenantId);
    updateCatalog(cached);
    if (AppController.getActiveTenant().id === tenantId) {
      updateCatalog({
        products: SQLiteEngine.db.tables.products,
        inventory: SQLiteEngine.db.tables.inventory
      });
      AppController.cacheActiveTenantCatalog();
      await window.ShopSQLite.flush();
    } else {
      SQLiteEngine.save();
      await window.ShopSQLite.flush();
    }
  },
  async recordLocalSale(tenantId, eventId, items, updateMirrors = true) {
    return window.ShopPOS.recordSharedLocalSale(tenantId, eventId, items, updateMirrors);
  },
  async setLocalStock(tenantId, sku, stock) {
    const connectedTenant = (await window.ShopSQLite.query(
      "SELECT value FROM pos_settings WHERE key='shared_tenant_id'"
    )).values?.[0]?.value;
    if (connectedTenant !== tenantId) return;
    await window.ShopPOS.recordSharedStockUpdate(sku, stock);
  },
  async request(tenantId, action, method, body) {
    return AppController.cloudflareRequest(
      `/api/inventory/${action}?tenant=${encodeURIComponent(tenantId)}`,
      { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
      tenantId
    );
  }
};
