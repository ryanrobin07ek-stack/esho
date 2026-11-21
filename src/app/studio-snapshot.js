// Main Store snapshot and workspace settings.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, SQLiteEngine } from './main.js';

export const snapshotCache = {
  getCachedMainShopSnapshot() {
    const activeTenantId = AppController.getActiveTenant().id;
    return this.mainShopSnapshotCache?.tenantId === activeTenantId
      ? this.mainShopSnapshotCache.snapshot
      : null;
  },
};

export const snapshotData = {
  async getMainShopSnapshot() {
    const settings = await window.ShopPOS.getSettings();
    const tenantId = settings.cloudSyncTenantId || window.EshopInventoryBridge?.activeWebsiteId?.() || AppController.getActiveTenant().id;
    const [posProducts, posCategories, posSales, expenses, instances, posInvoices, posQuotations] = await Promise.all([
      window.ShopPOS.listProducts(),
      window.ShopPOS.listCategories(),
      window.ShopPOS.listSales(),
      window.ShopPOS.listExpenses ? window.ShopPOS.listExpenses() : Promise.resolve([]),
      window.ShopPOS.listInstances ? window.ShopPOS.listInstances() : Promise.resolve([]),
      // Main Store is where the owner sees everything, so the till paperwork comes along too.
      window.ShopPOS.listInvoices ? window.ShopPOS.listInvoices() : Promise.resolve([]),
      window.ShopPOS.listQuotations ? window.ShopPOS.listQuotations() : Promise.resolve([])
    ]);
    const webProducts = SQLiteEngine.select("products", product => product.status !== "archived");
    const webCategories = SQLiteEngine.getCategories();
    const webCategoryNames = new Map(webCategories.map(category => [Number(category.id), category.name]));
    const productsBySku = new Map();
    const products = [];
    const addProduct = product => {
      // The SKU lives on the record, not on the {source, record, categoryName} wrapper. Reading it
      // from the wrapper made every SKU empty, so a product sold in both places never matched itself:
      // it listed twice, edits reached only one side, and Split shop showed "SKU required" on
      // every row with its checkbox disabled.
      const sku = String(product.record?.sku ?? product.sku ?? "").trim();
      const match = sku ? productsBySku.get(sku) : null;
      if (match) {
        match.sources.add(product.source);
        if (product.source === "POS") {
          match.posProduct = product.record;
          match.posProductId = Number(product.record.id);
          match.categoryName = product.categoryName || match.categoryName;
          match.price = Number(product.record.price) || match.price;
          match.costPrice = product.record.buyingPrice == null ? match.costPrice : Number(product.record.buyingPrice);
          match.posStock = Math.max(0, Number(product.record.stock) || 0);
          match.stock = product.record.stock == null ? match.stock : Number(product.record.stock);
        } else {
          match.webProduct = product.record;
          match.webProductId = Number(product.record.id);
          match.webStock = Math.max(0, Number(product.record.stock) || 0);
          if (!match.categoryName) match.categoryName = product.categoryName;
        }
        return;
      }
      const item = {
        name: product.record.name || "Unnamed product",
        sku,
        categoryName: product.categoryName || "Uncategorized",
        price: Number(product.record.price) || 0,
        costPrice: Number(product.record.buyingPrice ?? product.record.cost_price) || 0,
        stock: product.record.stock == null ? null : Number(product.record.stock),
        posStock: product.source === "POS" ? Math.max(0, Number(product.record.stock) || 0) : 0,
        webStock: product.source === "Website" ? Math.max(0, Number(product.record.stock) || 0) : 0,
        imageUri: product.record.imageUri || product.record.images?.[0] || "",
        sources: new Set([product.source]),
        posProduct: product.source === "POS" ? product.record : null,
        webProduct: product.source === "Website" ? product.record : null,
        posProductId: product.source === "POS" ? Number(product.record.id) : null,
        webProductId: product.source === "Website" ? Number(product.record.id) : null
      };
      products.push(item);
      if (sku) productsBySku.set(sku, item);
    };
    webProducts.forEach(product => addProduct({
      source: "Website",
      record: product,
      categoryName: webCategoryNames.get(Number(product.category_id)) || ""
    }));
    posProducts.forEach(product => addProduct({
      source: "POS",
      record: product,
      categoryName: product.categoryName
    }));
    products.sort((a, b) => a.name.localeCompare(b.name));

    const categoryByName = new Map();
    const addCategory = (name, source) => {
      const label = String(name || "").trim();
      if (!label) return;
      const key = label.replace(/\s+/g, " ").toLocaleLowerCase();
      const category = categoryByName.get(key) || { name: label, sources: new Set() };
      category.sources.add(source);
      categoryByName.set(key, category);
    };
    webCategories.forEach(category => addCategory(category.name, "Website"));
    posCategories.forEach(category => addCategory(category.name, "POS"));
    const categories = [...categoryByName.values()].sort((a, b) => a.name.localeCompare(b.name));
    const sales = [];
    SQLiteEngine.select("orders").forEach(order => {
      const status = String(order.status || "pending").toLowerCase();
      const paymentStatus = String(order.payment_status || "").toLowerCase();
      const total = Number(order.total) || 0;
      const reversedStatuses = ["refunded", "voided", "cancelled", "canceled", "failed"];
      const reversed = reversedStatuses.includes(status) || reversedStatuses.includes(paymentStatus);
      const paid = !reversed && (paymentStatus === "paid" || ["paid", "completed"].includes(status));
      const collected = reversed ? 0 : paid
        ? total
        : Math.max(0, Number(order.amount_paid) || 0);
      const items = (Array.isArray(order.items) ? order.items : []).map(item => ({
        productId: String(item.product_id || item.productId || item.sku || item.name || ""),
        name: String(item.name || "Item"),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.price ?? item.unitPrice) || 0,
        costPrice: item.costPrice == null && item.unitCost == null
          ? null
          : Number(item.costPrice ?? item.unitCost) || 0
      }));
      sales.push({
        channel: "Website",
        id: String(order.id),
        reference: order.order_number || `WEB-${order.id}`,
        date: order.created_at || "",
        currency: String(order.currency || "KES").toUpperCase(),
        status: reversed ? status : paid ? "paid" : paymentStatus || status,
        total,
        collected,
        subtotal: Number(order.subtotal) || total,
        discount: Number(order.discount) || 0,
        tax: Number(order.tax) || 0,
        customerName: String(order.customer_name || ""),
        customerEmail: String(order.customer_email || ""),
        customerPhone: String(order.customer_phone || ""),
        city: String(order.customer_city || order.city || ""),
        country: String(order.customer_country || order.country || ""),
        paymentMethod: String(order.payment_method || order.payment_provider || "other"),
        lineItems: items,
        itemCount: items.length
      });
    });
    posSales.forEach(sale => {
      const status = String(sale.payment_status || (sale.paid ? "paid" : "pending")).toLowerCase();
      const total = Number(sale.total) || 0;
      const refunded = ["refunded", "voided"].includes(String(sale.status || "").toLowerCase());
      const collected = refunded ? 0 : Math.max(0, Number(sale.amountPaid) || (sale.paid ? total : 0));
      const items = (Array.isArray(sale.items) ? sale.items : []).map(item => ({
        productId: String(item.productId || ""),
        name: String(item.name || "Item"),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        costPrice: item.historicalUnitCost == null ? null : Number(item.historicalUnitCost)
      }));
      sales.push({
        channel: "POS",
        id: String(sale.id),
        reference: sale.receipt_number || `POS-${sale.id}`,
        date: sale.created_at || "",
        currency: String(sale.currency || "KES").toUpperCase(),
        status: refunded ? String(sale.status).toLowerCase() : status,
        total,
        collected,
        subtotal: Number(sale.subtotal) || total,
        discount: Number(sale.discount) || 0,
        tax: Number(sale.tax) || 0,
        customerName: String(sale.customer_name || ""),
        customerPhone: String(sale.customer_phone || ""),
        paymentMethod: String(sale.payment_method || "other"),
        lineItems: items,
        itemCount: items.length
      });
    });
    sales.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const snapshot = {
      products, categories, sales, posCategories, posProducts, expenses, instances, settings,
      posInvoices, posQuotations,
      currency: settings.currency || "KES",
      localAllocations: SQLiteEngine.select("main_store_inventory",
        allocation => allocation.tenant_id === AppController.getActiveTenant().id)
    };
    this.mainShopSnapshotCache = {
      tenantId: AppController.getActiveTenant().id,
      snapshot
    };
    return snapshot;
  },

  formatMainShopMoney(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: /^[A-Z]{3}$/.test(currency) ? currency : "KES",
        maximumFractionDigits: 2
      }).format(Number(amount) || 0);
    } catch {
      return `${currency || "KES"} ${(Number(amount) || 0).toFixed(2)}`;
    }
  },

  getWorkspaceSetting(key, fallback = "") {
    const scopedKey = `${AppController.getActiveTenant().id}:${key}`;
    return SQLiteEngine.select("studio_settings", row => row.key === scopedKey)[0]?.value ?? fallback;
  },

  setWorkspaceSetting(key, value) {
    const scopedKey = `${AppController.getActiveTenant().id}:${key}`;
    const existing = SQLiteEngine.select("studio_settings", row => row.key === scopedKey)[0];
    if (existing) SQLiteEngine.update("studio_settings", row => row.id === existing.id, row => ({ ...row, value }));
    else SQLiteEngine.insert("studio_settings", { key: scopedKey, value });
  },

  getWorkspaceCustomers(sales) {
    const customerMap = new Map();
    sales.forEach(sale => {
      const email = String(sale.customerEmail || "").trim().toLocaleLowerCase();
      const phone = String(sale.customerPhone || "").trim();
      const key = email || phone || `${sale.channel === "Website" ? "order" : "sale"}-${sale.id || sale.reference}`;
      const customer = customerMap.get(key) || {
        key, name: String(sale.customerName || "Customer"),
        email, phone, orders: 0, spent: 0, lastOrder: "", points: 0
      };
      customer.orders += 1;
      customer.spent += sale.collected;
      if (String(sale.date).localeCompare(customer.lastOrder) > 0) customer.lastOrder = sale.date;
      customerMap.set(key, customer);
    });
    const tenantId = AppController.getActiveTenant().id;
    const ledger = SQLiteEngine.select("customer_points", entry => entry.tenant_id === tenantId);
    customerMap.forEach(customer => {
      customer.points = ledger.filter(entry => entry.customer_key === customer.key)
        .reduce((sum, entry) => sum + (Number(entry.delta) || 0), 0);
    });
    return [...customerMap.values()].sort((a, b) => b.lastOrder.localeCompare(a.lastOrder));
  },
};
