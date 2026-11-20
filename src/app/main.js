// The Craft app shell: router, renderers and controllers. Moved verbatim from the inline
// <script> in index.html; it is being split into src/screens and src/shell modules.
// Screen and shell modules moved out of this file.
import { bagScreen } from '../screens/shop/bag.js';
import { favoritesScreen } from '../screens/shop/favorites.js';
import { orderConfirmationScreen } from '../screens/shop/order-confirmation.js';
import { categoriesScreen } from '../screens/shop/categories.js';
import { renderDashboardVisits } from '../screens/craft/dashboard-visits.js';
import { renderDashboardOverview } from '../screens/craft/dashboard-overview.js';
import { renderDashboardTraffic } from '../screens/craft/dashboard-traffic.js';
import { renderDashboardPerformance } from '../screens/craft/dashboard-performance.js';
import { renderDashboardProductIntelligence } from '../screens/craft/dashboard-product-intelligence.js';
import { renderStoreProducts } from '../screens/craft/store-products.js';

// Module scope keeps these names private, as the old IIFE wrapper did; what screen and shell
// modules need is exported at the end.
  // Seed dataset for Craft
const storeInfo = {
  id: 1,
  name: "Craft",
  title: "Craft",
  tagline: "",
  description: "",
  location: "",
  email: "",
  phone: "",
  currency: "KES",
  currency_symbol: "KSh",
  announcement: "",
  announcement_active: 0,
  theme_mode: "light",
  primary_color: "#18181b",
  font_family: "sans",
  card_radius: "minimal",
  layout_density: "comfortable"
};

const heroSlides = [];

const categories = [];

const products = [];

// Craft's own pricing, in the currency the shop owner actually earns in. Every tier is a whole
// shop: the first is the till on one phone, the second adds the website and lets a team share the
// till, and the third is for an owner running several shops at once.
const plans = [
  {
    id: 1,
    slug: "counter",
    name: "Counter",
    price: 300,
    billing_period: "month",
    description: "The till, on one phone. For a shop owner who sells face to face.",
    badge: null,
    is_current: 0,
    features: [
      "One account",
      "POS on one phone",
      "Products, stock and receipts",
      "Sales and profit reports",
      "Works offline on the device"
    ]
  },
  {
    id: 2,
    slug: "shop-and-website",
    name: "Shop and website",
    price: 1140,
    billing_period: "month",
    description: "The till and your own website, with the counter shared across the team.",
    badge: "Most shops",
    is_current: 0,
    features: [
      "Everything in Counter",
      "One website, with your own address",
      "Share the till across up to 5 phones",
      "Several sellers on one counter",
      "Online orders, bookings and discount codes",
      "Website visitors and sales reports"
    ]
  },
  {
    id: 3,
    slug: "multi-shop",
    name: "Multi-shop",
    price: 5240,
    billing_period: "month",
    description: "Several shops and several websites, run from one place.",
    badge: null,
    is_current: 0,
    features: [
      "Everything in Shop and website",
      "4 accounts",
      "3 websites, plus 1 free website",
      "Up to 20 phones or devices on the counter",
      "Deeper business analysis across shops",
      "Stock split between the counter and the web"
    ]
  }
];

const demoAnalytics = {
  summary: {
    traffic: 148290,
    traffic_growth: "+18.4%",
    visitors: 92450,
    visitors_growth: "+14.2%",
    product_views: 384100,
    product_views_growth: "+22.7%",
    orders: 1428,
    orders_growth: "+12.8%",
    revenue: 429650,
    revenue_growth: "+24.5%",
    conversion_rate: 3.72,
    conversion_growth: "+0.4%",
    aov: 300.87,
    aov_growth: "+8.9%"
  },
  periods: {
    today: { visitors: 3420, orders: 48, revenue: 14850, views: 12900 },
    "7d": { visitors: 22800, orders: 342, revenue: 104200, views: 88400 },
    "30d": { visitors: 92450, orders: 1428, revenue: 429650, views: 384100 },
    "90d": { visitors: 268000, orders: 4120, revenue: 1248000, views: 1095000 }
  },
  top_categories: [
    { name: "Men's Sartorial", share: "28%", revenue: 120300 },
    { name: "Horology & Watches", share: "24%", revenue: 103100 },
    { name: "Artisanal Leather Bags", share: "18%", revenue: 77300 },
    { name: "Handmade Shoes", share: "14%", revenue: 60150 },
    { name: "Modern Electronics", share: "9%", revenue: 38600 },
    { name: "Home & Architectural", share: "7%", revenue: 30200 }
  ]
};

  // Robust Embedded Browser Relational SQLite Engine for Craft
const SQLiteEngine = {
  db: {
    tables: {},
    schema: {}
  },

  storageKey: "ESHOP_SQLITE_DB_V1",
  emptyCatalogKey: "ESHOP_EMPTY_WEB_CATALOG_V1",
  storeBrandKey: "ESHOP_STORE_BRAND_UPDATED_V1",
  builderResetKey: "ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1",

  async init(seedCategories, seedProducts, seedStore, seedPlans, seedAnalytics) {
    if (window.ShopSQLiteReady) await window.ShopSQLiteReady;
    const saved = await window.ShopSQLite.load();
    // Never treat a database that already holds data as a fresh install. Android Auto Backup
    // restores the SQLite database (backup_rules.xml includes only the "database" domain) but not
    // WebView localStorage, so a restored catalogue arrives with the "empty catalogue" marker
    // missing. The one-time sample-data reset below used to run in that case and wiped the
    // restored products, categories and inventory.
    const storage = {
      get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
      set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } }
    };
    const restoredExistingData = Boolean(saved);
    this.loadedExistingData = restoredExistingData;
    if (saved) {
      this.db = saved;
      this.db.tables.pages = this.db.tables.pages || [];
      this.db.tables.tenant_catalogs = this.db.tables.tenant_catalogs || [];
      this.db.tables.website_themes = this.db.tables.website_themes || [];
      for (const table of ["web_visits", "web_events", "newsletter_subscribers", "booking_holds", "customer_points", "payment_methods", "studio_settings", "main_store_inventory"]) {
        this.db.tables[table] = this.db.tables[table] || [];
      }
    } else {
      this.seedInitial(seedCategories, seedProducts, seedStore, seedPlans, seedAnalytics);
    }
    if (restoredExistingData || storage.get(this.emptyCatalogKey) === "1") {
      if (restoredExistingData) storage.set(this.emptyCatalogKey, "1");
      if (storage.get(this.storeBrandKey) !== "1") {
        const store = this.getStore();
        if (store.name === "Craft Atelier") {
          this.updateStore({
            name: "Craft",
            title: "Craft",
            tagline: "",
            description: "",
            location: "",
            email: "",
            phone: "",
            announcement: "",
            announcement_active: 0
          });
        }
      }
      storage.set(this.storeBrandKey, "1");
      return;
    }

    for (const table of ["categories", "products", "inventory", "favorites", "cart_items", "hero_slides"]) {
      this.db.tables[table] = [];
    }
    this.db.tables.orders = (this.db.tables.orders || []).filter(
      order => !["ORD-94812", "ORD-94813"].includes(order.order_number)
    );
    this.db.tables.store = (this.db.tables.store || []).map(store => ({
      ...store,
      name: "Craft",
      title: "Craft",
      tagline: "",
      description: "",
      location: "",
      email: "",
      phone: "",
      announcement: "",
      announcement_active: 0
    }));
    await window.ShopSQLite.save(this.db);
    storage.set(this.emptyCatalogKey, "1");
    storage.set(this.storeBrandKey, "1");
  },
  seedInitial(seedCategories, seedProducts, seedStore, seedPlans, seedAnalytics) {
    this.db = {
      tables: {
        store: [{ ...seedStore }],
        categories: JSON.parse(JSON.stringify(seedCategories)),
        products: JSON.parse(JSON.stringify(seedProducts)),
        tenant_catalogs: [],
        website_themes: [],
        web_visits: [],
        web_events: [],
        newsletter_subscribers: [],
        booking_holds: [],
        customer_points: [],
        payment_methods: [],
        studio_settings: [],
        main_store_inventory: [],
        pages: [],
        inventory: seedProducts.map(p => ({
          id: p.id,
          product_id: p.id,
          sku: p.sku,
          stock: p.stock,
          cost_price: p.cost_price,
          selling_price: p.price,
          low_stock_threshold: 10,
          status: p.stock === 0 ? "out_of_stock" : (p.stock <= 10 ? "low_stock" : "in_stock")
        })),
        favorites: [],
        cart_items: [],
        orders: [],
        hero_slides: [],
        plans: JSON.parse(JSON.stringify(seedPlans)),
        analytics: [seedAnalytics]
      }
    };
    this.save();
  },

  save() {
    if (window.ShopSQLite) window.ShopSQLite.scheduleSave(this.db);
  },

  reset(seedCategories, seedProducts, seedStore, seedPlans, seedAnalytics) {
    this.seedInitial(seedCategories, seedProducts, seedStore, seedPlans, seedAnalytics);
  },
  // SQL-like operations
  select(tableName, predicate, sortFn, limit, offset) {
    const table = this.db.tables[tableName] || [];
    let result = predicate ? table.filter(predicate) : [...table];
    if (sortFn) result.sort(sortFn);
    const start = offset || 0;
    if (limit) {
      result = result.slice(start, start + limit);
    } else if (start > 0) {
      result = result.slice(start);
    }
    return JSON.parse(JSON.stringify(result));
  },

  insert(tableName, row) {
    if (!this.db.tables[tableName]) this.db.tables[tableName] = [];
    if (!row.id) {
      const maxId = this.db.tables[tableName].reduce((max, r) => Math.max(max, r.id || 0), 0);
      row.id = maxId + 1;
    }
    this.db.tables[tableName].push(row);
    this.save();
    return row;
  },

  update(tableName, predicate, updateFn) {
    const table = this.db.tables[tableName] || [];
    let count = 0;
    for (let i = 0; i < table.length; i++) {
      if (predicate(table[i])) {
        table[i] = updateFn(table[i]);
        count++;
      }
    }
    if (count > 0) this.save();
    return count;
  },

  delete(tableName, predicate) {
    const table = this.db.tables[tableName] || [];
    const prevLen = table.length;
    this.db.tables[tableName] = table.filter(r => !predicate(r));
    const removed = prevLen - this.db.tables[tableName].length;
    if (removed > 0) this.save();
    return removed;
  },

  // High-Level Storefront & Studio API
  getProducts(options = {}) {
    const {
      categorySlug,
      categoryId,
      query,
      sort,
      minPrice,
      maxPrice,
      inStockOnly,
      featuredOnly,
      bestsellersOnly,
      flagshipOnly,
      newOnly,
      limit,
      offset
    } = options;

    let targetCatId = categoryId;
    if (categorySlug && !targetCatId) {
      const cat = (this.db.tables.categories || []).find(c => c.slug === categorySlug);
      if (cat) targetCatId = cat.id;
    }

    const predicate = (p) => {
      if (p.status === "archived") return false;
      if (targetCatId && p.category_id !== targetCatId) return false;
      if (featuredOnly && !p.is_featured) return false;
      if (bestsellersOnly && !p.is_bestseller) return false;
      if (flagshipOnly && !p.is_flagship) return false;
      if (newOnly && !p.is_new) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (minPrice !== undefined && p.price < minPrice) return false;
      if (maxPrice !== undefined && p.price > maxPrice) return false;
      if (query) {
        const q = query.toLowerCase().trim();
        const inName = p.name.toLowerCase().includes(q);
        const inBrand = p.brand.toLowerCase().includes(q);
        const inDesc = p.description.toLowerCase().includes(q);
        const inSku = p.sku.toLowerCase().includes(q);
        const inTags = Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q));
        if (!inName && !inBrand && !inDesc && !inSku && !inTags) return false;
      }
      return true;
    };

    let sortFn = null;
    if (sort === "price-asc") {
      sortFn = (a, b) => a.price - b.price;
    } else if (sort === "price-desc") {
      sortFn = (a, b) => b.price - a.price;
    } else if (sort === "rating") {
      sortFn = (a, b) => b.rating - a.rating;
    } else if (sort === "newest") {
      sortFn = (a, b) => (b.is_new ? 1 : 0) - (a.is_new ? 1 : 0) || b.id - a.id;
    } else if (sort === "bestseller") {
      sortFn = (a, b) => (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0);
    } else {
      // Default: featured first, then flagship, then rating
      sortFn = (a, b) => (b.is_flagship ? 1 : 0) - (a.is_flagship ? 1 : 0) || (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0) || b.rating - a.rating;
    }

    const allMatched = this.select("products", predicate, sortFn);
    const totalCount = allMatched.length;
    const items = this.select("products", predicate, sortFn, limit, offset);

    return {
      items,
      totalCount
    };
  },

  getProductBySlug(slug) {
    const list = this.select("products", p => p.slug === slug);
    return list.length ? list[0] : null;
  },

  getProductById(id) {
    const list = this.select("products", p => Number(p.id) === Number(id));
    return list.length ? list[0] : null;
  },

  getRelatedProducts(product, limit = 4) {
    if (!product) return [];
    const list = this.select(
      "products",
      p => p.id !== product.id && (p.category_id === product.category_id || (Array.isArray(p.tags) && p.tags.some(t => (product.tags || []).includes(t)))),
      (a, b) => (b.category_id === product.category_id ? 1 : 0) - (a.category_id === product.category_id ? 1 : 0) || b.rating - a.rating,
      limit
    );
    return list;
  },

  getCategories() {
    return this.select("categories", null, (a, b) => a.id - b.id);
  },

  getCategoryBySlug(slug) {
    const list = this.select("categories", c => c.slug === slug);
    return list.length ? list[0] : null;
  },

  getPages(publishedOnly = false) {
    return this.select("pages", page => !publishedOnly || page.published);
  },

  getPageBySlug(slug, publishedOnly = false) {
    const pages = this.select("pages", page => page.slug === slug && (!publishedOnly || page.published));
    return pages[0] || null;
  },

  // Pages are no longer authored in the app: the Litrus storefront does not render custom pages,
  // so the Pages manager and its save/delete helpers were removed. Existing page records are kept
  // and still travel with the published catalogue.

  // Cart operations
  getCart() {
    return this.select("cart_items");
  },

  addToCart(productId, quantity = 1, size = null, color = null) {
    const product = this.getProductById(productId);
    if (!product) return false;
    const option1Value = size ?? product.sizes?.[0] ?? null;
    const option2Value = color ?? product.colors?.[0] ?? null;
    const variant = (product.variants || []).find(item =>
      (item.option1_value ?? item.size ?? "") === (option1Value || "") &&
      (item.option2_value ?? item.color ?? "") === (option2Value || ""));
    const existing = (this.db.tables.cart_items || []).find(
      item => item.product_id === product.id && item.size === option1Value && item.color === option2Value
    );
    if (variant && Number(variant.stock) < (Number(quantity) || 1) + (Number(existing?.quantity) || 0)) {
      AppUtils.showToast("There is not enough stock for this option.", "danger");
      return false;
    }
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.insert("cart_items", {
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        price: variant?.price ?? product.price,
        original_price: product.original_price,
        image: product.images && product.images[0] ? product.images[0] : "",
        sku: product.sku,
        size: option1Value,
        color: option2Value,
        option1_name: product.option1_name || (option1Value ? "Size" : ""),
        option2_name: product.option2_name || (option2Value ? "Color" : ""),
        quantity: quantity,
        added_at: new Date().toISOString()
      });
    }
    this.save();
    AppController.recordWebEvent("add_to_cart", { product_id: product.id, product_name: product.name, quantity: Number(quantity) || 1 });
    return true;
  },

  updateCartQty(cartItemId, delta) {
    const item = (this.db.tables.cart_items || []).find(i => i.id === cartItemId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.delete("cart_items", i => i.id === cartItemId);
    } else {
      this.save();
    }
  },

  removeCartItem(cartItemId) {
    this.delete("cart_items", i => i.id === cartItemId);
  },

  clearCart() {
    this.db.tables.cart_items = [];
    this.save();
  },

  // Favorites
  getFavorites() {
    const favs = this.select("favorites") || [];
    const ids = favs.map(f => f.product_id);
    return this.select("products", p => ids.includes(p.id));
  },

  isFavorite(productId) {
    return (this.db.tables.favorites || []).some(f => f.product_id === productId);
  },

  toggleFavorite(productId) {
    const existing = (this.db.tables.favorites || []).find(f => f.product_id === productId);
    if (existing) {
      this.delete("favorites", f => f.product_id === productId);
      AppController.recordWebEvent("favorite_removed", { product_id: productId, product_name: this.getProductById(productId)?.name || "" });
      return false;
    } else {
      this.insert("favorites", { product_id: productId, added_at: new Date().toISOString() });
      AppController.recordWebEvent("favorite_added", { product_id: productId, product_name: this.getProductById(productId)?.name || "" });
      return true;
    }
  },

  // Orders
  createOrder(orderData, items) {
    const orderNumber = "ORD-" + Math.floor(100000 + Math.random() * 900000);
    const newOrder = {
      order_number: orderNumber,
      ...orderData,
      items: items,
      status: orderData.status || "processing",
      created_at: orderData.created_at || new Date().toISOString()
    };
    const order = this.insert("orders", newOrder);
    AppController.recordWebEvent("order_created", {
      order_id: order.id,
      order_number: order.order_number,
      total: Number(order.total) || 0,
      item_count: items.length
    });

    if (["paid", "completed"].includes(String(newOrder.status).toLowerCase())) {
      items.forEach(item => {
        this.update("products", p => p.id === item.product_id, p => {
          p.stock = Math.max(0, p.stock - (item.quantity || 1));
          return p;
        });
        this.update("inventory", inv => inv.product_id === item.product_id, inv => {
          inv.stock = Math.max(0, inv.stock - (item.quantity || 1));
          inv.status = inv.stock === 0 ? "out_of_stock" : (inv.stock <= inv.low_stock_threshold ? "low_stock" : "in_stock");
          return inv;
        });
      });
    }

    this.clearCart();
    return order;
  },

  getOrder(orderNumber) {
    const list = this.select("orders", o => o.order_number === orderNumber);
    return list.length ? list[0] : null;
  },

  // Store & Settings
  getStore() {
    const list = this.select("store");
    return list.length ? list[0] : {};
  },

  updateStore(updates) {
    this.update("store", () => true, store => {
      const updatedStore = { ...store, ...updates };
      delete updatedStore.mobile_card_layout;
      return updatedStore;
    });
    return this.getStore();
  },

  async resetBuildYourWebDataOnce() {
    const storage = {
      get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
      set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
      remove(key) { try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ } }
    };
    if (storage.get(this.builderResetKey) === "1") return;
    // Same rule as init(): a database that already held data (restored by Android Auto Backup,
    // transferred to a new device, or opened where localStorage is blocked) is never a fresh
    // install. Its marker is simply missing, so do not blank the shop name, contacts, hero
    // slides or pages; just record that the reset is not needed.
    if (this.loadedExistingData) {
      storage.set(this.builderResetKey, "1");
      return;
    }
    this.db.tables.pages = [];
    this.db.tables.hero_slides = [];
    this.updateStore({
      name: storeInfo.name,
      title: storeInfo.title,
      tagline: storeInfo.tagline,
      description: storeInfo.description,
      location: storeInfo.location,
      email: storeInfo.email,
      phone: storeInfo.phone,
      announcement: storeInfo.announcement,
      announcement_active: storeInfo.announcement_active
    });
    this.save();
    await window.ShopSQLite.flush();
    storage.remove(this.storageKey);
    storage.set(this.builderResetKey, "1");
  },

  // Studio CRUD for Products
  saveProduct(data) {
    if (data.id) {
      if (!data.sku) data.sku = this.getProductById(data.id)?.sku || this.generateProductSku();
      this.update("products", p => p.id === Number(data.id), p => ({ ...p, ...data }));
      this.update("inventory", inv => inv.product_id === Number(data.id), inv => ({
        ...inv,
        sku: data.sku || inv.sku,
        stock: Number(data.stock !== undefined ? data.stock : inv.stock),
        cost_price: Number(data.cost_price !== undefined ? data.cost_price : inv.cost_price),
        selling_price: Number(data.price !== undefined ? data.price : inv.selling_price),
        status: (data.stock <= 0) ? "out_of_stock" : (data.stock <= 10 ? "low_stock" : "in_stock")
      }));
      return this.getProductById(data.id);
    } else {
      if (!data.sku) data.sku = this.generateProductSku();
      const slug = (data.name || "new-item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const newProduct = {
        ...data,
        slug: slug + "-" + Date.now().toString().slice(-4),
        rating: data.rating ?? 5.0,
        review_count: data.review_count ?? 0,
        status: data.status || "active",
        is_featured: data.is_featured ? 1 : 0,
        is_bestseller: data.is_bestseller ? 1 : 0,
        is_flagship: data.is_flagship ? 1 : 0,
        is_new: data.is_new ?? 1
      };
      const created = this.insert("products", newProduct);
      this.insert("inventory", {
        product_id: created.id,
        sku: created.sku,
        stock: Number(created.stock ?? 10),
        cost_price: Number(created.cost_price ?? 50),
        selling_price: Number(created.price ?? 150),
        low_stock_threshold: 10,
        status: created.stock === 0 ? "out_of_stock" : (created.stock <= 10 ? "low_stock" : "in_stock")
      });
      return created;
    }
  },

  generateProductSku() {
    const existing = new Set(this.select("products").map(product => product.sku).filter(Boolean));
    let sku;
    do {
      const bytes = new Uint8Array(8);
      window.crypto.getRandomValues(bytes);
      sku = `ESHOP-${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    } while (existing.has(sku));
    return sku;
  },

  deleteProduct(id) {
    this.delete("products", p => p.id === Number(id));
    this.delete("inventory", inv => inv.product_id === Number(id));
    this.delete("favorites", f => f.product_id === Number(id));
    this.delete("cart_items", c => c.product_id === Number(id));
    return true;
  },

  duplicateProduct(id) {
    const source = this.getProductById(id);
    if (!source) return null;
    const copy = JSON.parse(JSON.stringify(source));
    delete copy.id;
    copy.name = copy.name + " (Copy)";
    copy.slug = copy.slug + "-copy-" + Date.now().toString().slice(-4);
    copy.sku = "";
    return this.saveProduct(copy);
  },

  // Category CRUD
  saveCategory(data) {
    const categoryId = data.id ? Number(data.id) : null;
    const baseSlug = (data.name || "category").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
    const usedSlugs = new Set(this.getCategories().filter(c => c.id !== categoryId).map(c => c.slug));
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;

    if (data.id) {
      this.update("categories", c => c.id === categoryId, c => ({ ...c, ...data, slug }));
    } else {
      this.insert("categories", { ...data, slug });
    }
    return true;
  },

  deleteCategory(id) {
    this.update("products", p => p.category_id === Number(id), p => ({ ...p, category_id: null }));
    this.delete("categories", c => c.id === Number(id));
    return true;
  },

  // Inventory updates
  updateInventoryStock(productId, newStock) {
    newStock = Math.max(0, Number(newStock));
    this.update("products", p => p.id === Number(productId), p => {
      p.stock = newStock;
      return p;
    });
    this.update("inventory", inv => inv.product_id === Number(productId), inv => {
      inv.stock = newStock;
      inv.status = newStock === 0 ? "out_of_stock" : (newStock <= inv.low_stock_threshold ? "low_stock" : "in_stock");
      return inv;
    });
    return true;
  },

  // Plans
  getPlans() {
    // Pricing is Craft’s own, not the shop’s data. It used to be seeded into the device on first run,
    // so a phone installed months ago kept showing whatever the tiers were then. Today’s tiers are
    // always shown; only which one this device is on is remembered.
    const chosen = new Set(this.select("plans")
      .filter(plan => Number(plan.is_current) === 1)
      .map(plan => String(plan.slug)));
    return plans.map(plan => ({ ...plan, is_current: chosen.has(plan.slug) ? 1 : 0 }));
  },

  selectPlan(planSlug) {
    this.update("plans", () => true, p => {
      p.is_current = p.slug === planSlug ? 1 : 0;
      return p;
    });
  }
};

const LOCAL_PRODUCT_MEDIA_PREFIX = "craft-local-media:";
const INDEXEDDB_PRODUCT_MEDIA_PREFIX = "craft-indexeddb-media:";
let localProductMediaDatabasePromise;
const openLocalProductMediaDatabase = () => {
  if (!localProductMediaDatabasePromise) {
    localProductMediaDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("craft-product-media", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Local video storage could not be opened."));
      request.onblocked = () => reject(new Error("Local video storage is busy. Close other Craft tabs and try again."));
    });
  }
  return localProductMediaDatabasePromise;
};

  // Router, SEO, and Core Utilities for Craft
const AppUtils = {
  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  async compressImageFile(file, {
    maxDimension = 1800,
    maxBytes = 1_500_000,
    maxInputBytes = 5 * 1024 * 1024
  } = {}) {
    if (!(file instanceof Blob) || !file.type.startsWith("image/") || file.size > maxInputBytes) {
      throw new Error("Choose an image smaller than 5 MB.");
    }
    let bitmap;
    let objectUrl = "";
    try {
      bitmap = new Image();
      objectUrl = URL.createObjectURL(file);
      bitmap.src = objectUrl;
      await new Promise((resolve, reject) => {
        bitmap.onload = resolve;
        bitmap.onerror = () => reject(new Error("The selected image could not be decoded."));
      });
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("The selected image could not be compressed.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let quality = 0.84;
      let blob = await new Promise((resolve, reject) => canvas.toBlob(
        value => value ? resolve(value) : reject(new Error("The selected image could not be compressed.")),
        "image/webp",
        quality
      ));
      while (blob.size > maxBytes && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.12);
        blob = await new Promise((resolve, reject) => canvas.toBlob(
          value => value ? resolve(value) : reject(new Error("The selected image could not be compressed.")),
          "image/webp",
          quality
        ));
      }
      if (blob.size > maxBytes && (canvas.width > 480 || canvas.height > 480)) {
        const reduced = document.createElement("canvas");
        reduced.width = Math.max(1, Math.round(canvas.width * 0.72));
        reduced.height = Math.max(1, Math.round(canvas.height * 0.72));
        const reducedContext = reduced.getContext("2d", { alpha: true });
        if (!reducedContext) throw new Error("The selected image could not be compressed.");
        reducedContext.drawImage(canvas, 0, 0, reduced.width, reduced.height);
        blob = await new Promise((resolve, reject) => reduced.toBlob(
          value => value ? resolve(value) : reject(new Error("The selected image could not be compressed.")),
          "image/webp",
          0.72
        ));
        reduced.width = 0;
        reduced.height = 0;
      }
      if (blob.size > maxBytes) throw new Error("This image is still too large after compression. Choose a smaller photo.");
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("The compressed image could not be read."));
        reader.onerror = () => reject(new Error("The compressed image could not be read."));
        reader.readAsDataURL(blob);
      });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  },

  async storeLocalProductVideo(blob) {
    if (!(blob instanceof Blob) || !blob.size || blob.size > 50_000_000) {
      throw new Error("Videos must be between 1 byte and 50 MB.");
    }
    const database = await openLocalProductMediaDatabase();
    const key = crypto.randomUUID();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      transaction.objectStore("files").put(blob, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(new Error("The video could not be saved to local storage."));
      transaction.onabort = () => reject(new Error("The video could not be saved to local storage."));
    });
    return `${INDEXEDDB_PRODUCT_MEDIA_PREFIX}${key}`;
  },

  async readLocalProductMedia(reference) {
    if (typeof reference !== "string") throw new Error("The saved product media reference is invalid.");
    if (reference.startsWith(LOCAL_PRODUCT_MEDIA_PREFIX)) {
      const path = reference.slice(LOCAL_PRODUCT_MEDIA_PREFIX.length);
      const nativeMedia = window.EshopNativeMedia;
      if (!path || !nativeMedia?.Capacitor) throw new Error("This media file is only available in the Craft Android app.");
      const response = await fetch(nativeMedia.Capacitor.convertFileSrc(path));
      if (!response.ok) throw new Error("The saved product media file could not be opened.");
      return response.blob();
    }
    if (reference.startsWith(INDEXEDDB_PRODUCT_MEDIA_PREFIX)) {
      const key = reference.slice(INDEXEDDB_PRODUCT_MEDIA_PREFIX.length);
      const database = await openLocalProductMediaDatabase();
      const blob = await new Promise((resolve, reject) => {
        const request = database.transaction("files", "readonly").objectStore("files").get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error("The saved product video could not be read."));
      });
      if (!(blob instanceof Blob)) throw new Error("The saved product video is missing from local storage.");
      return blob;
    }
    throw new Error("The saved product media reference is not a local file.");
  },

  formatMoney(num) {
    return "$" + Number(num || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  },

  // Every cloud-backed screen refuses without a Craft account session, so the shell can offer the
  // way in instead of printing an error the owner cannot act on.
  // One readable date for everything the owner reads. Order and receipt rows used to print the raw
  // database timestamp ("2026-11-16T10:42:57.637Z"), which is not a date a shop owner can use.
  formatDateTime(value, { withTime = true } = {}) {
    if (!value) return "Date unavailable";
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Date unavailable";
    const day = parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    if (!withTime) return day;
    return `${day}, ${parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  },

  craftAccountSignedIn() {
    try {
      return Boolean(window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1")
        && window.localStorage.getItem("ESHOP_ACCOUNT_USERNAME_V1"));
    } catch {
      return false;
    }
  },

  showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      <span>${this.escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  updateSEO({ title, description, url, image, schema }) {
    const fullTitle = title.includes("Craft") ? title : `${title} — Craft`;
    document.title = fullTitle;

    const setMeta = (nameOrProp, val, isProp = false) => {
      let el = document.querySelector(isProp ? `meta[property="${nameOrProp}"]` : `meta[name="${nameOrProp}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (isProp) el.setAttribute("property", nameOrProp);
        else el.setAttribute("name", nameOrProp);
        document.head.appendChild(el);
      }
      el.setAttribute("content", val || "");
    };

    setMeta("description", description);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", description, true);
    setMeta("og:url", url || window.location.href, true);
    if (image) setMeta("og:image", image, true);
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);

    // Schema JSON-LD
    let script = document.getElementById("structured-data-jsonld");
    if (!script) {
      script = document.createElement("script");
      script.id = "structured-data-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    if (schema) {
      script.textContent = JSON.stringify(schema);
    } else {
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Craft",
        "url": window.location.origin
      });
    }
  }
};

  // Storefront View Renderers for Craft



const StoreRenderers = {
  renderNavbar(activePath = "/", moduleTitle = "", options = {}) {
    const managementSurface = activePath.startsWith("/account") || activePath === "/app-account";
    const studioSurface = activePath.startsWith("/account");
    const store = SQLiteEngine.getStore();
    const publishedPages = SQLiteEngine.getPages(true);
    const storefrontHome = "/";
    const cart = SQLiteEngine.getCart();
    const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const favs = SQLiteEngine.getFavorites();
    const favCount = favs.length;

    return `
      ${store.announcement_active && !managementSurface ? `
        <div class="announcement-bar">
          <span>${AppUtils.escapeHTML(store.announcement || "Complimentary Worldwide Shipping on Orders Over $150")}</span>
        </div>
      ` : ""}
      <header class="navbar ${managementSurface ? "studio-module-navbar" : ""}" id="main-navbar">
        <div class="container nav-container">
          <div class="nav-left">
            ${managementSurface ? "" : `
              <button class="mobile-menu-btn" id="mobile-menu-toggle" aria-label="Open Navigation Menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            `}
            ${managementSurface ? `
              <a href="/" class="brand-logo studio-module-brand studio-module-back" data-route="/" data-home-screen aria-label="Back to Craft home">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg>
                <span class="studio-module-title">${AppUtils.escapeHTML(moduleTitle || (activePath === "/app-account" ? "Account" : ({
                  "/account": "Studio",
                  "/account/profile": "Profile",
                  "/account/products": "Products Manager",
                  "/account/dashboard": "Dashboard",
                  "/account/categories": "Categories",
                  "/account/inventory": "Inventory",
                  "/account/settings": "Settings",
                  "/account/web": "Build Your Web",
                  "/account/plans": "Plans"
                })[activePath] || "Studio"))}</span>
              </a>
            ` : `
              <a href="${storefrontHome}" class="brand-logo" data-route="${storefrontHome}" ${options.builderPreview ? "" : "data-home-screen"} aria-label="Craft home">
                <span class="brand-dot"></span>
                <span>CRAFT</span>
              </a>
            `}
            ${managementSurface ? "" : `<nav class="nav-menu">
              <a href="${storefrontHome}" class="nav-link ${activePath === '/' ? 'active' : ''}" data-route="${storefrontHome}">Home</a>
              <a href="/categories" class="nav-link ${activePath === '/categories' ? 'active' : ''}" data-route="/categories">Collections</a>
              ${categories.map(category => `<a href="/category/${encodeURIComponent(category.slug)}" class="nav-link ${activePath === `/category/${category.slug}` ? 'active' : ''}" data-route="/category/${encodeURIComponent(category.slug)}">${AppUtils.escapeHTML(category.name)}</a>`).join("")}
              ${publishedPages.map(page => `<a href="/pages/${encodeURIComponent(page.slug)}" class="nav-link ${activePath === `/pages/${page.slug}` ? 'active' : ''}" data-route="/pages/${encodeURIComponent(page.slug)}">${AppUtils.escapeHTML(page.title)}</a>`).join("")}
            </nav>`}
          </div>

          ${managementSurface ? "" : `<div class="nav-center">
            <div class="search-box">
              <span class="search-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input type="text" id="navbar-search-input" class="search-input" placeholder="Search products..." autocomplete="off">
              <div id="search-quick-dropdown" class="search-dropdown"></div>
            </div>
          </div>`}

          <div class="nav-right">
            ${studioSurface ? `
              <a href="/account/profile" class="nav-icon-btn studio-profile-btn" data-route="/account/profile" aria-label="Profile" title="Profile">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2z"/></svg>
              </a>
            ` : managementSurface ? "" : `
              <a href="/favorites" class="nav-icon-btn" data-route="/favorites" aria-label="Favorites">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${favCount > 0 ? '#E11D48' : 'none'}" stroke="${favCount > 0 ? '#E11D48' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                ${favCount > 0 ? `<span class="nav-badge">${favCount}</span>` : ""}
              </a>

              <a href="/bag" class="nav-icon-btn" data-route="/bag" aria-label="Shopping Bag">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                ${cartCount > 0 ? `<span class="nav-badge" id="nav-cart-badge">${cartCount}</span>` : ""}
              </a>
            `}

            ${managementSurface || options.builderPreview ? "" : `
              <a href="/account" class="btn-studio-pill" data-route="/account">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span>Studio & Account</span>
              </a>
            `}
          </div>
        </div>
      </header>

      ${managementSurface ? "" : `<!-- Mobile Navigation Drawer -->
      <div id="mobile-nav-drawer" class="mobile-drawer-overlay">
        <div class="mobile-drawer">
          <div class="mobile-drawer-header">
            <a href="${storefrontHome}" class="brand-logo" data-route="${storefrontHome}" ${options.builderPreview ? "" : "data-home-screen"} aria-label="Craft home"><span class="brand-dot"></span>CRAFT</a>
            <button id="mobile-drawer-close" aria-label="Close Navigation">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style="margin: 16px 0;">
            <input type="text" id="mobile-search-input" class="search-input" placeholder="Search all items..." />
          </div>
          <ul class="mobile-nav-list">
            <li><a href="${storefrontHome}" class="mobile-nav-link" data-route="${storefrontHome}">Home</a></li>
            <li><a href="/categories" class="mobile-nav-link" data-route="/categories">Collections</a></li>
            ${categories.map(category => `<li><a href="/category/${encodeURIComponent(category.slug)}" class="mobile-nav-link" data-route="/category/${encodeURIComponent(category.slug)}">${AppUtils.escapeHTML(category.name)}</a></li>`).join("")}
            ${publishedPages.map(page => `<li><a href="/pages/${encodeURIComponent(page.slug)}" class="mobile-nav-link" data-route="/pages/${encodeURIComponent(page.slug)}">${AppUtils.escapeHTML(page.title)}</a></li>`).join("")}
            ${options.builderPreview ? "" : `<li style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 8px;">
              <a href="/account" class="mobile-nav-link" data-route="/account" style="font-weight: 600;">Account & Store Studio</a>
            </li>`}
            ${options.builderPreview ? "" : `<li>
              <a href="/account/tenants" class="mobile-nav-link" data-route="/account/tenants">My shops</a>
            </li>`}
          </ul>
        </div>
      </div>
    `}
    `;
  },

  async loadGoogleSearchStatus(tenantId) {
    const status = document.getElementById("google-search-status");
    const saveButton = document.querySelector("[data-search-console-save]");
    const removeButton = document.querySelector("[data-search-console-remove]");
    if (!status || !saveButton || !removeButton) return;
    const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
    if (!sessionToken) {
      status.textContent = "Sign in to your Craft account to manage this shop’s verification tag.";
      saveButton.disabled = true;
      removeButton.disabled = true;
      return;
    }
    try {
      const result = await AppController.cloudflareRequest(
        `/api/search-console/verification?tenant_id=${encodeURIComponent(tenantId)}`,
        {},
        tenantId,
        false,
        sessionToken
      );
      if (!document.getElementById("google-search-status")) return;
      status.textContent = result.tokenSaved
        ? "Verification tag is published on this shop. Finish verification and sitemap submission in Google Search Console."
        : "Add this shop in Google Search Console, then paste its HTML verification tag below.";
      saveButton.disabled = false;
      removeButton.disabled = !result.tokenSaved;
    } catch (error) {
      console.error("Search Console verification status could not be loaded.", error);
      status.textContent = error.message || "Search Console verification status could not be loaded.";
      saveButton.disabled = false;
      removeButton.disabled = false;
    }
  },

  async loadCustomHostnameStatus(tenantId, resultOverride = null) {
    const status = document.getElementById("custom-domain-status");
    const hostnameInput = document.getElementById("custom-domain-hostname");
    const connectButton = document.querySelector("[data-custom-domain-action='connect']");
    const checkButton = document.querySelector("[data-custom-domain-action='check']");
    const removeButton = document.querySelector("[data-custom-domain-action='remove']");
    if (!status || !connectButton || !checkButton || !removeButton) return;
    const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
    if (!sessionToken) {
      status.textContent = "Sign in to the account that owns this shop to connect a domain.";
      connectButton.disabled = true;
      checkButton.disabled = true;
      removeButton.disabled = true;
      return;
    }
    try {
      const result = resultOverride || await AppController.cloudflareRequest(
        `/api/custom-hostnames?tenant_id=${encodeURIComponent(tenantId)}`,
        {},
        tenantId,
        false,
        sessionToken
      );
      if (!document.getElementById("custom-domain-status")) return;
      if (!result.hostname) {
        status.textContent = result.error || "No custom subdomain is connected. Root domains are not supported.";
        if (hostnameInput) hostnameInput.disabled = false;
        connectButton.disabled = false;
        checkButton.disabled = true;
        removeButton.disabled = true;
        return;
      }
      if (hostnameInput) {
        hostnameInput.value = result.hostname;
        hostnameInput.disabled = true;
      }
      const ready = result.status === "active" && result.ssl_status === "active";
      const records = Array.isArray(result.validation_records) && result.validation_records.length
        ? `<ul>${result.validation_records.map(record => `
            <li>
              <strong>${AppUtils.escapeHTML(record.purpose || "DNS validation")} TXT</strong>
              <p>Name: <code>${AppUtils.escapeHTML(record.name || "")}</code></p>
              <p>Value: <code>${AppUtils.escapeHTML(record.value || "")}</code></p>
            </li>`).join("")}</ul>`
        : "";
      status.innerHTML = `
        <strong>${AppUtils.escapeHTML(result.hostname)}</strong>: ${ready
          ? "Connected and secure."
          : `Waiting for DNS/TLS setup (hostname: ${AppUtils.escapeHTML(result.status || "pending")}; SSL: ${AppUtils.escapeHTML(result.ssl_status || "pending")}).`}
        <p>Add this DNS record with the domain provider:</p>
        <p><code>CNAME ${AppUtils.escapeHTML(result.hostname)} → ${AppUtils.escapeHTML(result.cname_target || "customers.rrobin.co.ke")}</code></p>
        ${records ? "<p>Add the listed TXT validation record at your DNS provider as well.</p>" : ""}
        ${records}
        ${ready ? `<p><a href="https://${AppUtils.escapeHTML(result.hostname)}" target="_blank" rel="noopener">Open your shop on its custom domain</a></p>` : ""}`;
      connectButton.disabled = true;
      checkButton.disabled = false;
      removeButton.disabled = false;
    } catch (error) {
      console.error("Custom domain status could not be loaded.", error);
      status.textContent = error.message || "Custom domain status could not be loaded.";
      connectButton.disabled = false;
      checkButton.disabled = true;
      removeButton.disabled = true;
    }
  },

  renderProductCard(product) {
    const isFav = SQLiteEngine.isFavorite(product.id);
    const hasDiscount = product.discount && product.discount > 0;
    const imgUrl = (product.images && product.images[0]) || "";

    return `
      <article class="product-card" data-product-id="${product.id}">
        <div class="product-badge-stack">
          ${product.is_flagship ? `<span class="product-badge badge-flagship">Flagship</span>` : ""}
          ${product.is_new ? `<span class="product-badge badge-new">New</span>` : ""}
          ${hasDiscount ? `<span class="product-badge badge-sale">-${product.discount}%</span>` : ""}
        </div>
        <button class="product-card-fav-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-id="${product.id}" aria-label="Save to favorites">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? '#E11D48' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <a href="/product/${product.slug}" class="product-card-thumb-link" data-route="/product/${product.slug}">
          ${imgUrl ? `<img src="${AppUtils.escapeHTML(imgUrl)}" alt="${AppUtils.escapeHTML(product.name)}" class="product-card-img" loading="lazy" width="400" height="533">` : ""}
        </a>
        <div class="product-card-content">
          <h3 class="product-card-title">
            <a href="/product/${product.slug}" data-route="/product/${product.slug}">${AppUtils.escapeHTML(product.name)}</a>
          </h3>
          <div class="product-card-rating">
            <span class="star-icon">★</span>
            <span>${product.rating.toFixed(1)}</span>
            <span style="color: var(--text-dim);">(${product.review_count})</span>
          </div>
          <div class="product-card-price-row">
            <span class="price-current">${AppUtils.formatMoney(product.price)}</span>
            ${hasDiscount ? `<span class="price-original">${AppUtils.formatMoney(product.original_price)}</span>` : ""}
          </div>
          <button class="product-card-quick-add" data-action="quick-add" data-id="${product.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Add to Bag</span>
          </button>
        </div>
      </article>
    `;
  },

  renderFooter() {
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-bottom">
            <div>&copy; ${new Date().getFullYear()} Craft. All rights reserved.</div>
          </div>
        </div>
      </footer>
    `;
  },

  renderHome(builderPreview = false) {
    const categories = SQLiteEngine.getCategories();
    const flagshipQuery = SQLiteEngine.getProducts({ flagshipOnly: true, limit: 2 });
    const featuredQuery = SQLiteEngine.getProducts({ featuredOnly: true, limit: 8 });
    const bestsellersQuery = SQLiteEngine.getProducts({ bestsellersOnly: true, limit: 8 });
    const newArrivalsQuery = SQLiteEngine.getProducts({ newOnly: true, limit: 4 });
    const moreProductsQuery = SQLiteEngine.getProducts({ limit: 8, offset: 8 });

    AppUtils.updateSEO({
      title: "Craft — Curated Modern Luxury & Contemporary Essentials",
      description: "Discover bespoke tailoring, Swiss automatic timepieces, Tuscan leather carry, and architectural living objects curated for discerning living.",
      schema: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Craft Atelier",
        "url": window.location.origin,
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${window.location.origin}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      }
    });

    return `
      ${this.renderNavbar('/', '', { builderPreview })}
      <main id="main-content">
        <!-- Hero Carousel Section -->
        <section class="hero-section" id="hero-carousel-section">
          <div class="hero-carousel" id="hero-carousel">
            <div class="hero-slide active" data-slide="0">
              <img src="https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1800&q=85" alt="The Sartorial Architecture" class="hero-bg-img" width="1800" height="640">
              <div class="container">
                <div class="hero-content">
                  <span class="hero-badge">Autumn/Winter 2026</span>
                  <h1 class="hero-title">The Sartorial Architecture</h1>
                  <p class="hero-subtitle">Precision tailoring meets unyielding minimalist form. Handcrafted double-faced cashmere and structured outerwear.</p>
                  <a href="/category/men" class="hero-cta" data-route="/category/men">
                    <span>Explore Men's Sartorial</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="hero-slide" data-slide="1">
              <img src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1800&q=85" alt="Precision Timepieces" class="hero-bg-img" width="1800" height="640">
              <div class="container">
                <div class="hero-content">
                  <span class="hero-badge">Curated Horology</span>
                  <h2 class="hero-title">Precision Timepieces</h2>
                  <p class="hero-subtitle">Swiss automatic chronometers and titanium tool watches engineered for decades of mechanical resilience.</p>
                  <a href="/category/watches" class="hero-cta" data-route="/category/watches">
                    <span>Discover Watches</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="hero-slide" data-slide="2">
              <img src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85" alt="Quiet Form and Function" class="hero-bg-img" width="1800" height="640">
              <div class="container">
                <div class="hero-content">
                  <span class="hero-badge">Artisanal Leather</span>
                  <h2 class="hero-title">Quiet Form & Function</h2>
                  <p class="hero-subtitle">Vegetable-tanned full grain Tuscan calfskin. Minimalist everyday carry designed to develop a rich, personal patina.</p>
                  <a href="/category/bags" class="hero-cta" data-route="/category/bags">
                    <span>View Carry Collection</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="hero-controls">
              <button class="hero-arrow-btn" id="hero-prev" aria-label="Previous Slide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div class="hero-dots" id="hero-dots">
                <span class="hero-dot active" data-index="0"></span>
                <span class="hero-dot" data-index="1"></span>
                <span class="hero-dot" data-index="2"></span>
              </div>
              <button class="hero-arrow-btn" id="hero-next" aria-label="Next Slide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </section>

        <!-- Category Circles Discovery Rail -->
        <section class="categories-rail-section">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <span class="section-eyebrow">Curated Departments</span>
                <h2 class="section-heading">Explore By Collection</h2>
              </div>
              <a href="/categories" class="nav-link" data-route="/categories" style="font-weight: 600;">View All (${categories.length}) &rarr;</a>
            </div>
            <div class="categories-rail">
              ${categories.map(cat => {
                const categoryImage = cat.image || SQLiteEngine.getProducts({ categoryId: cat.id }).items.find(product => product.images && product.images[0])?.images[0] || "";
                return `
                  <a href="/category/${encodeURIComponent(cat.slug)}" class="category-circle-card" data-route="/category/${encodeURIComponent(cat.slug)}">
                    <div class="category-circle-thumb-wrapper">
                      ${categoryImage ? `<img src="${AppUtils.escapeHTML(categoryImage)}" alt="${AppUtils.escapeHTML(cat.name)}" class="category-circle-img" loading="lazy" width="84" height="84">` : `<span class="category-circle-name" aria-hidden="true">${AppUtils.escapeHTML(cat.name.slice(0, 1))}</span>`}
                    </div>
                    <span class="category-circle-name">${AppUtils.escapeHTML(cat.name)}</span>
                  </a>
                `;
              }).join("")}
            </div>
          </div>
        </section>

        <!-- Flagship Spotlight Section -->
        <section class="flagship-section">
          <div class="container">
            <div class="flagship-grid">
              <div class="flagship-banner">
                <img src="https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1200&q=80" alt="Flagship Series" class="flagship-img">
                <div class="flagship-card-overlay">
                  <span class="section-eyebrow" style="color: rgba(255,255,255,0.8);">Flagship Curation</span>
                  <h3 style="font-family: var(--font-serif); font-size: 2rem; margin: 8px 0 12px; font-weight: 400;">The Mongolian Cashmere Edition</h3>
                  <p style="font-size: 0.9375rem; color: rgba(255,255,255,0.9); line-height: 1.5; margin-bottom: 20px;">
                    Crafted from unlined double-faced cashmere woven in northern Italy. Pure substance and drape with zero synthetic additives.
                  </p>
                  <a href="/product/double-faced-cashmere-overcoat" class="hero-cta" data-route="/product/double-faced-cashmere-overcoat" style="padding: 10px 20px;">
                    View Masterpiece &rarr;
                  </a>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 24px;">
                <div>
                  <span class="section-eyebrow">Spotlight Editions</span>
                  <h2 class="section-heading" style="margin-bottom: 8px;">Master Craftsmanship</h2>
                  <p style="font-size: 0.9375rem; color: var(--text-muted); line-height: 1.6;">
                    Each piece in our flagship collection is built on enduring silhouettes, artisanal materials, and traceable origin.
                  </p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                  ${flagshipQuery.items.map(p => this.renderProductCard(p)).join("")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Featured Products Section -->
        <section style="padding: 64px 0; border-bottom: 1px solid var(--border);">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Editorial Selection</span>
                <h2 class="section-heading">Featured Pieces</h2>
              </div>
              <a href="/categories" class="nav-link" data-route="/categories" style="font-weight: 600;">Browse All &rarr;</a>
            </div>
            <div class="products-grid">
              ${featuredQuery.items.map(p => this.renderProductCard(p)).join("")}
            </div>
          </div>
        </section>

        <!-- Seasonal Campaign Banner -->
        <section class="campaign-banner-section">
          <div class="container">
            <div class="campaign-card">
              <img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1600&q=80" alt="Living Architecture" class="campaign-bg-img">
              <div class="campaign-inner">
                <span class="section-eyebrow" style="color: #FFFFFF;">Living Architecture</span>
                <h2 style="font-family: var(--font-serif); font-size: 2.5rem; font-weight: 400; margin: 12px 0 16px;">Smoked Glass & Cast Bronze</h2>
                <p style="font-size: 1rem; color: rgba(255,255,255,0.85); line-height: 1.6; margin-bottom: 28px;">
                  Quiet objects that elevate daily rituals. Discover hand-blown Italian glassware and lost-wax cast lighting designed for a lifetime of reflection.
                </p>
                <a href="/category/home" class="hero-cta" data-route="/category/home">Explore Architectural Living</a>
              </div>
            </div>
          </div>
        </section>

        <!-- Best Sellers Section -->
        <section style="padding: 64px 0; border-bottom: 1px solid var(--border);">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Client Favorites</span>
                <h2 class="section-heading">Best Sellers</h2>
              </div>
              <span style="font-size: 0.875rem; color: var(--text-muted);">${bestsellersQuery.totalCount} items in demand</span>
            </div>
            <div class="products-grid">
              ${bestsellersQuery.items.map(p => this.renderProductCard(p)).join("")}
            </div>
          </div>
        </section>

        <!-- New Arrivals Showcase -->
        <section style="padding: 64px 0; border-bottom: 1px solid var(--border);">
          <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Fresh Release</span>
                <h2 class="section-heading">New Arrivals</h2>
              </div>
              <a href="/categories" class="nav-link" data-route="/categories" style="font-weight: 600;">View Lookbook &rarr;</a>
            </div>
            <div class="products-grid">
              ${newArrivalsQuery.items.map(p => this.renderProductCard(p)).join("")}
            </div>
          </div>
        </section>

        <!-- Pillars of Craftsmanship -->
        <section style="padding: 64px 0; background: var(--surface);">
          <div class="container">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; text-align: center;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">Worldwide Carbon-Neutral</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Complimentary express shipping on all orders exceeding $150 with 100% offset carbon.</p>
              </div>
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">Artisanal Provenance</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Direct partnership with heritage mills in Biella, Okayama, Florence, and Solothurn.</p>
              </div>
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">30-Day Guaranteed Returns</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Complimentary prepaid return labels included with every dispatch parcel.</p>
              </div>
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 12px; color: var(--accent);">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px;">Private Concierge</h3>
                <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5;">Dedicated personal assistance for bespoke sizing, care advice, and gift curation.</p>
              </div>
            </div>
          </div>
        </section>
        <section class="store-newsletter-signup" aria-labelledby="store-newsletter-heading">
          <span class="section-eyebrow">The Craft edit</span>
          <h2 id="store-newsletter-heading">New arrivals, thoughtfully chosen.</h2>
          <p>Subscribe for occasional product news and shop updates.</p>
          <form id="web-newsletter-signup">
            <label class="sr-only" for="web-newsletter-email">Email address</label>
            <input id="web-newsletter-email" name="email" type="email" autocomplete="email" placeholder="Your email address" required>
            <label class="store-newsletter-consent"><input name="consent" type="checkbox" required> I agree to receive occasional email updates. I can unsubscribe at any time.</label>
            <button type="submit">Subscribe</button>
            <button type="button" data-enable-notifications>Enable product notifications</button>
            <button type="button" data-disable-notifications>Turn off notifications</button>
            <span role="status" aria-live="polite"></span>
          </form>
          <small>We’ll email you a confirmation link. Your subscription starts only after you confirm.</small>
        </section>
      </main>
      ${this.renderFooter()}
    `;
  },

  renderCustomPage(slug) {
    const page = SQLiteEngine.getPageBySlug(slug, true);
    if (!page) return null;
    const store = SQLiteEngine.getStore();
    AppUtils.updateSEO({
      title: `${page.title} — ${store.name || "Craft"}`,
      description: page.content.slice(0, 160)
    });
    const safeContent = AppUtils.escapeHTML(page.content || "").replace(/\r\n?|\n/g, "<br>");
    return `
      ${this.renderNavbar(`/pages/${encodeURIComponent(page.slug)}`)}
      <main id="main-content" class="container" style="max-width: 900px; min-height:65vh; padding:48px 16px 80px;">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/" data-route="/">Home</a><span>/</span><span>${AppUtils.escapeHTML(page.title)}</span></nav>
        <article>
          <h1 class="section-heading" style="font-size:clamp(2rem,7vw,3rem); margin:16px 0 24px;">${AppUtils.escapeHTML(page.title)}</h1>
          <div style="line-height:1.8; white-space:normal;">${safeContent}</div>
        </article>
      </main>
      ${this.renderFooter()}
    `;
  },

  ...categoriesScreen,

  renderCategory(slug, sort = "featured", minPrice, maxPrice, inStockOnly, studioView = false) {
    const category = SQLiteEngine.getCategoryBySlug(slug);
    if (!category) {
      return `
        ${StoreRenderers.renderNavbar(studioView ? "/account/category" : "/")}
        <main class="container" style="padding: 80px 0; text-align: center;">
          <h1 class="section-heading">Collection Not Found</h1>
          <p style="color: var(--text-muted); margin: 16px 0 24px;">The collection you requested does not exist or has been relocated.</p>
          <a href="${studioView ? "/account/categories" : "/categories"}" class="hero-cta" data-route="${studioView ? "/account/categories" : "/categories"}">${studioView ? "Return to Categories" : "Browse All Collections"}</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    const { items, totalCount } = SQLiteEngine.getProducts({
      categorySlug: slug,
      sort,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      inStockOnly: inStockOnly === "1" || inStockOnly === true
    });

    const otherCategories = SQLiteEngine.getCategories().filter(c => c.slug !== slug).slice(0, 5);

    AppUtils.updateSEO({
      title: `${category.name} — Craft`,
      description: category.description,
      image: category.image,
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": category.name,
        "description": category.description,
        "itemListElement": items.map((p, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "name": p.name,
          "url": `${window.location.origin}/product/${p.slug}`
        }))
      }
    });

    return `
      ${StoreRenderers.renderNavbar(studioView ? "/account/category" : `/category/${slug}`, studioView ? category.name : "")}
      ${studioView ? `
        <section class="container studio-department-heading">
          <button type="button" class="btn-primary" data-action="studio-add-department-product" data-category-id="${category.id}" style="height:42px;padding:0 16px;">+ Add Product</button>
        </section>
      ` : `
      <div class="category-hero-header">
        <div class="container">
          <div class="breadcrumbs">
            <a href="/" data-route="/">Home</a>
            <span>/</span>
            <a href="/categories" data-route="/categories">Collections</a>
            <span>/</span>
            <span>${AppUtils.escapeHTML(category.name)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap;">
            <div>
              <span class="section-eyebrow">Curated Collection</span>
              <h1 class="section-heading" style="font-size: 2.5rem; margin-top: 4px;">${AppUtils.escapeHTML(category.name)}</h1>
              <p style="color: var(--text-muted); max-width: 640px; margin-top: 8px;">${AppUtils.escapeHTML(category.description)}</p>
            </div>
            <div style="font-size: 0.875rem; color: var(--text-muted); font-weight: 500;">
              Showing ${items.length} of ${totalCount} pieces
            </div>
          </div>
        </div>
      </div>
      `}

      <main class="container ${studioView ? "studio-department-content" : ""}" style="padding-bottom: 80px;">
        <div class="filter-bar">
          <div class="filter-group">
            <select id="cat-sort-select" class="filter-select">
              <option value="featured" ${sort === 'featured' ? 'selected' : ''}>Filter</option>
              <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest Additions</option>
              <option value="price-asc" ${sort === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
              <option value="price-desc" ${sort === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
              <option value="rating" ${sort === 'rating' ? 'selected' : ''}>Highest Rated</option>
              <option value="bestseller" ${sort === 'bestseller' ? 'selected' : ''}>Best Sellers</option>
            </select>

            <select id="cat-price-filter" class="filter-select">
              <option value="">All Price Tiers</option>
              <option value="0-200" ${maxPrice == 200 ? 'selected' : ''}>Under $200</option>
              <option value="200-500" ${minPrice == 200 && maxPrice == 500 ? 'selected' : ''}>$200 — $500</option>
              <option value="500-1000" ${minPrice == 500 && maxPrice == 1000 ? 'selected' : ''}>$500 — $1,000</option>
              <option value="1000+" ${minPrice == 1000 ? 'selected' : ''}>$1,000 & Above</option>
            </select>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem; cursor: pointer; margin-left: 8px;">
              <input type="checkbox" id="cat-stock-filter" ${inStockOnly ? 'checked' : ''}>
              <span>In Stock Only</span>
            </label>
          </div>

          ${!studioView ? `<div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 0.8125rem; color: var(--text-muted);">Related:</span>
            ${otherCategories.map(c => `
              <a href="/category/${c.slug}" class="option-chip" data-route="/category/${c.slug}" style="font-size: 0.75rem; padding: 4px 10px;">${AppUtils.escapeHTML(c.name)}</a>
            `).join("")}
          </div>` : ""}
        </div>

        ${items.length === 0 ? `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 64px 24px; text-align: center;">
            <h3 style="font-size: 1.25rem; font-weight: 500; margin-bottom: 8px;">${studioView ? "No products in this department yet" : "No pieces matched these exact filter parameters"}</h3>
            ${!studioView ? `<p style="color: var(--text-muted); margin-bottom: 24px;">Try resetting the price filter or viewing all pieces in this department.</p>` : ""}
            ${!studioView ? `<button class="btn-primary" id="reset-cat-filters" style="max-width: 200px; margin: 0 auto;">Clear Filters</button>` : ""}
          </div>
        ` : `
          <div class="products-grid">
            ${items.map(p => StoreRenderers.renderProductCard(p)).join("")}
          </div>
        `}
        ${studioView ? `<div id="product-modal-container"></div>` : ""}
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderProduct(slug) {
    const product = SQLiteEngine.getProductBySlug(slug);
    if (!product) {
      return `
        ${StoreRenderers.renderNavbar()}
        <main class="container" style="padding: 80px 0; text-align: center;">
          <h1 class="section-heading">Product Not Found</h1>
          <p style="color: var(--text-muted); margin: 16px 0 24px;">This product is no longer active in our catalog.</p>
          <a href="/categories" class="hero-cta" data-route="/categories">Browse Catalog</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    const category = SQLiteEngine.select("categories", c => c.id === product.category_id)[0] || { name: "Collection", slug: "categories" };
    const related = SQLiteEngine.getRelatedProducts(product, 4);
    const isFav = SQLiteEngine.isFavorite(product.id);
    const hasDiscount = product.discount && product.discount > 0;
    const images = product.images || [];
    const option1Name = product.option1_name || (product.sizes?.length ? "Size / Dimension" : "");
    const option2Name = product.option2_name || (product.colors?.length ? "Artisanal Finish" : "");
    const defaultVariant = (product.variants || []).find(variant =>
      (variant.option1_value ?? variant.size ?? "") === (product.sizes?.[0] || "") &&
      (variant.option2_value ?? variant.color ?? "") === (product.colors?.[0] || ""));
    const defaultPrice = defaultVariant?.price ?? product.price;
    const defaultStock = defaultVariant?.stock ?? product.stock;

    AppUtils.updateSEO({
      title: `${product.name} — ${product.brand}`,
      description: product.description,
      image: images[0],
      schema: {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "image": images,
        "description": product.description,
        "sku": product.sku,
        "brand": {
          "@type": "Brand",
          "name": product.brand
        },
        "offers": {
          "@type": "Offer",
          "url": `${window.location.origin}/product/${product.slug}`,
          "priceCurrency": "USD",
          "price": product.price,
          "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "itemCondition": "https://schema.org/NewCondition"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": product.rating,
          "reviewCount": product.review_count || 12
        }
      }
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="product-page-section">
        <div class="container">
          <div class="breadcrumbs">
            <a href="/" data-route="/">Home</a>
            <span>/</span>
            <a href="/category/${category.slug}" data-route="/category/${category.slug}">${AppUtils.escapeHTML(category.name)}</a>
            <span>/</span>
            <span>${AppUtils.escapeHTML(product.name)}</span>
          </div>

          <div class="product-detail-layout">
            <!-- Left: Switchable Image Gallery -->
            <div class="product-gallery">
              <div class="gallery-main-view">
                ${images[0] ? `<img id="main-product-img" src="${AppUtils.escapeHTML(images[0])}" alt="${AppUtils.escapeHTML(product.name)}" class="gallery-main-img" width="600" height="800">` : ""}
                ${product.is_flagship ? `<span class="product-badge badge-flagship" style="position: absolute; top: 16px; left: 16px;">Flagship Curation</span>` : ""}
              </div>
              <div class="gallery-thumbnails-rail">
                ${images.map((img, i) => `
                  <button class="gallery-thumb-btn ${i === 0 ? 'active' : ''}" data-action="switch-thumb" data-src="${img}" aria-label="View photo ${i+1}">
                    <img src="${img}" alt="Thumbnail ${i+1}" class="gallery-thumb-img">
                  </button>
                `).join("")}
              </div>
            </div>

            <!-- Right: Product Information & Purchase CTAs -->
            <div class="product-info-panel">
              <div>
                <span class="product-sku-tag">${AppUtils.escapeHTML(product.brand)} &bull; SKU: ${AppUtils.escapeHTML(product.sku)}</span>
                <h1 class="product-main-title">${AppUtils.escapeHTML(product.name)}</h1>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                  <span class="star-icon">★</span>
                  <span style="font-weight: 600;">${product.rating.toFixed(1)}</span>
                  <span style="color: var(--text-muted);">(${product.review_count} client reviews)</span>
                  <span style="margin: 0 4px; color: var(--border);">&bull;</span>
                  <span id="product-stock-status" style="color: ${defaultStock > 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 0.8125rem; font-weight: 600;">
                    ${defaultStock > 10 ? 'In Stock (Ready to dispatch)' : (defaultStock > 0 ? `Low Stock (${defaultStock} units remain)` : 'Sold Out')}
                  </span>
                </div>
              </div>

              <div class="product-price-box">
                <span class="price-current">${AppUtils.formatMoney(defaultPrice)}</span>
                ${hasDiscount ? `<span class="price-original">${AppUtils.formatMoney(product.original_price)}</span>` : ""}
                ${hasDiscount ? `<span class="price-discount">Save ${product.discount}%</span>` : ""}
              </div>

              <p style="font-size: 1rem; line-height: 1.6; color: var(--text-muted);">
                ${AppUtils.escapeHTML(product.description)}
              </p>

              <!-- Product option selectors -->
              ${product.sizes && product.sizes.length ? `
                <div>
                  <div class="options-title">
                    <span>Select ${AppUtils.escapeHTML(option1Name || "Option 1")}</span>
                    ${/size|dimension/i.test(option1Name) ? `<a href="/help" data-route="/help" style="color: var(--text-muted); font-size: 0.8125rem; text-decoration: underline;">Sizing Guide</a>` : ""}
                  </div>
                  <div class="options-chips" id="product-size-chips">
                    ${product.sizes.map((s, idx) => `
                      <button class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${AppUtils.escapeHTML(s)}">${AppUtils.escapeHTML(s)}</button>
                    `).join("")}
                  </div>
                </div>
              ` : ""}

              ${product.colors && product.colors.length ? `
                <div>
                  <div class="options-title"><span>${AppUtils.escapeHTML(option2Name || "Option 2")}</span></div>
                  <div class="options-chips" id="product-color-chips">
                    ${product.colors.map((c, idx) => `
                      <button class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${AppUtils.escapeHTML(c)}">${AppUtils.escapeHTML(c)}</button>
                    `).join("")}
                  </div>
                </div>
              ` : ""}

              <!-- Quantity and Purchase Buttons -->
              <div style="display: flex; gap: 16px; align-items: center;">
                <div class="quantity-stepper">
                  <button class="stepper-btn" id="prod-qty-dec">&minus;</button>
                  <input type="text" id="prod-qty-input" class="stepper-input" value="1" readonly>
                  <button class="stepper-btn" id="prod-qty-inc">&plus;</button>
                </div>
                <div class="cta-button-group" style="flex: 1;">
                  <button class="btn-primary" id="btn-add-to-bag" data-id="${product.id}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    <span>Add to Bag</span>
                  </button>
                  <button class="btn-secondary" id="btn-buy-now" data-id="${product.id}">
                    <span>Buy Now</span>
                  </button>
                  <button class="btn-fav-large ${isFav ? 'active' : ''}" id="btn-prod-fav" data-id="${product.id}" aria-label="Save to favorites">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? '#E11D48' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </button>
                </div>
              </div>

              <!-- Accordions: Specifications, Shipping, Provenance -->
              <div class="accordion-list">
                <div class="accordion-item">
                  <button class="accordion-trigger" data-accordion="specs">
                    <span>Specifications &amp; Provenance</span>
                    <span>+</span>
                  </button>
                  <div class="accordion-body active" id="acc-specs">
                    <p>${AppUtils.escapeHTML(product.details || "Manufactured with certified materials meeting our ethical craftsmanship charter. Detailed provenance documentation accompanied upon dispatch.")}</p>
                    <ul style="margin: 12px 0 0 20px; line-height: 1.8;">
                      <li>Category: ${AppUtils.escapeHTML(category.name)}</li>
                      <li>Item SKU: ${AppUtils.escapeHTML(product.sku)}</li>
                      <li>Authenticity: 100% Guaranteed Original Masterwork</li>
                    </ul>
                  </div>
                </div>

                <div class="accordion-item">
                  <button class="accordion-trigger" data-accordion="shipping">
                    <span>Carbon-Neutral Delivery &amp; Returns</span>
                    <span>+</span>
                  </button>
                  <div class="accordion-body" id="acc-shipping">
                    <p>Complimentary express courier delivery on orders exceeding $150. All shipments are carbon-neutral certified. Dispatched within 24 business hours from our central warehouse.</p>
                    <p style="margin-top: 8px;">Enjoy 30 days of risk-free evaluation. Complimentary prepaid return labels enclosed in every order box.</p>
                  </div>
                </div>

                <div class="accordion-item">
                  <button class="accordion-trigger" data-accordion="care">
                    <span>Care &amp; Longevity Instructions</span>
                    <span>+</span>
                  </button>
                  <div class="accordion-body" id="acc-care">
                    <p>Store in the provided breathable cotton dust bag when not in rotation. Avoid prolonged direct sunlight and moisture exposure. Periodic specialist conditioning will ensure generations of enduring patina.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Verified Client Reviews -->
          <section style="margin-top: 80px; padding-top: 48px; border-top: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Client Feedback</span>
                <h2 class="section-heading">Verified Reviews (${product.review_count})</h2>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.75rem; font-weight: 700;">${product.rating.toFixed(1)}</span>
                <div style="font-size: 0.8125rem; color: var(--text-muted);">
                  <div>★★★★★</div>
                  <div>Based on ${product.review_count} client evaluations</div>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
              <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600;">Marcus V.</span>
                  <span style="color: var(--text-dim); font-size: 0.8125rem;">2 weeks ago</span>
                </div>
                <div style="color: #D97706; margin-bottom: 8px;">★★★★★</div>
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 0.9375rem;">Exceptional tactile quality</div>
                <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">The weight and craftsmanship exceeded my expectations. Substantial finishing and pristine packaging.</p>
              </div>

              <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600;">Helena S.</span>
                  <span style="color: var(--text-dim); font-size: 0.8125rem;">1 month ago</span>
                </div>
                <div style="color: #D97706; margin-bottom: 8px;">★★★★★</div>
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 0.9375rem;">Timeless aesthetic balance</div>
                <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">Quiet luxury in its purest form. Sizing is true to spec and the drape is flawless.</p>
              </div>

              <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600;">David L.</span>
                  <span style="color: var(--text-dim); font-size: 0.8125rem;">1 month ago</span>
                </div>
                <div style="color: #D97706; margin-bottom: 8px;">★★★★★</div>
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 0.9375rem;">Worth every dollar</div>
                <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">Fast carbon-neutral courier to Zurich. The craftsmanship matches bespoke savile row standards.</p>
              </div>
            </div>
          </section>

          <!-- Related Products Section -->
          ${related.length ? `
            <section style="margin-top: 80px; padding-top: 48px; border-top: 1px solid var(--border);">
              <div style="margin-bottom: 32px;">
                <span class="section-eyebrow">Complementary Curation</span>
                <h2 class="section-heading">You May Also Appreciate</h2>
              </div>
              <div class="products-grid">
                ${related.map(p => StoreRenderers.renderProductCard(p)).join("")}
              </div>
            </section>
          ` : ""}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderSearch(query = "", sort = "featured") {
    const { items, totalCount } = SQLiteEngine.getProducts({ query, sort });

    AppUtils.updateSEO({
      title: query ? `Search: "${query}" — Craft` : "Search Catalog — Craft",
      description: `Search results for ${query} across our luxury editorial catalog.`
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="container" style="padding: 48px 0 80px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <span>Search</span>
        </div>

        <div style="margin-bottom: 32px;">
          <span class="section-eyebrow">Catalog Search</span>
          <h1 class="section-heading">
            ${query ? `Search Results for "${AppUtils.escapeHTML(query)}"` : "Discover Artifacts"}
          </h1>
          <p style="color: var(--text-muted); margin-top: 6px;">
            ${items.length} ${items.length === 1 ? 'item' : 'items'} found matching your search.
          </p>
        </div>

        <div style="max-width: 600px; margin-bottom: 32px;">
          <form id="search-page-form" style="display: flex; gap: 12px;">
            <input type="text" id="search-page-input" class="search-input" value="${AppUtils.escapeHTML(query)}" placeholder="Search outerwear, chronometers, leather, glassware..." />
            <button type="submit" class="btn-primary" style="flex: 0 0 120px;">Search</button>
          </form>
        </div>

        ${items.length === 0 ? `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 64px 24px; text-align: center; max-width: 720px; margin: 0 auto;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" style="margin: 0 auto 16px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <h3 style="font-size: 1.25rem; font-weight: 500; margin-bottom: 8px;">No pieces matched "${AppUtils.escapeHTML(query)}"</h3>
            <p style="color: var(--text-muted); margin-bottom: 24px;">Try another search or browse the available collections.</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              ${SQLiteEngine.getCategories().map(category => `<a href="/category/${encodeURIComponent(category.slug)}" class="option-chip" data-route="/category/${encodeURIComponent(category.slug)}">${AppUtils.escapeHTML(category.name)}</a>`).join("")}
              ${SQLiteEngine.getCategories().length ? "" : `<a href="/categories" class="option-chip" data-route="/categories">View Collections</a>`}
            </div>
          </div>
        ` : `
          <div class="products-grid">
            ${items.map(p => StoreRenderers.renderProductCard(p)).join("")}
          </div>
        `}
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  ...bagScreen,

  renderCheckout() {
    const cart = SQLiteEngine.getCart();
    if (cart.length === 0) {
      return `
        ${StoreRenderers.renderNavbar()}
        <main class="container" style="padding: 80px 0; text-align: center;">
          <h1 class="section-heading">Your Bag is Empty</h1>
          <p style="color: var(--text-muted); margin: 16px 0 24px;">Please add items to your shopping bag before proceeding to checkout.</p>
          <a href="/categories" class="hero-cta" data-route="/categories">Browse Collections</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 0;
    const discount = 0;
    const total = subtotal;

    AppUtils.updateSEO({
      title: "Checkout — Craft",
      description: "Encrypted 256-bit checkout for your luxury order."
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="container" style="padding: 40px 0 80px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <a href="/bag" data-route="/bag">Bag</a>
          <span>/</span>
          <span>Checkout</span>
        </div>

        <div style="margin-bottom: 32px;">
          <span class="section-eyebrow">Encrypted 256-Bit Transaction</span>
          <h1 class="section-heading" style="font-size: 2.25rem;">Checkout</h1>
        </div>

        <div class="checkout-layout">
          <!-- Checkout Form Fields -->
          <form id="checkout-main-form" class="checkout-form-section">
            <div class="form-group-card">
              <h2 class="form-card-title">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #FFF; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">1</span>
                <span>Client Identification</span>
              </h2>
              <div class="form-grid">
                <div class="form-field">
                  <label class="form-label">First Name *</label>
                  <input type="text" name="firstName" class="form-input" required />
                </div>
                <div class="form-field">
                  <label class="form-label">Last Name *</label>
                  <input type="text" name="lastName" class="form-input" required />
                </div>
              </div>
              <div class="form-grid" style="margin-top: 16px;">
                <div class="form-field">
                  <label class="form-label">Email Address (Order Confirmation) *</label>
                  <input type="email" name="email" class="form-input" required />
                </div>
                <div class="form-field">
                  <label class="form-label">Mobile Phone (optional)</label>
                  <input type="tel" name="phone" class="form-input" />
                </div>
              </div>
            </div>

            <div class="form-group-card">
              <h2 class="form-card-title">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #FFF; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">2</span>
                <span>Order Submission</span>
              </h2>
              <p class="studio-panel-note">Submit your order to continue to Paystack’s secure payment page. Your order is marked paid only after Paystack confirms the payment. Card details are entered on Paystack, not stored by this shop.</p>
            </div>

            <div class="form-group-card">
              <h2 class="form-card-title">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #FFF; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">3</span>
                <span>Payment</span>
              </h2>
              <p class="studio-panel-note">After you submit, you should be redirected to Paystack to choose a payment method and complete the transaction.</p>
            </div>

            <button type="submit" class="btn-primary" style="height: 56px; font-size: 1rem;">
              <span>Place Order &amp; Continue to Paystack (${AppUtils.formatMoney(total)})</span>
            </button>
          </form>

          <!-- Order Summary Sidebar -->
          <div>
            <div class="order-summary-card">
              <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 20px;">Order Review (${cart.length} items)</h2>
              <div style="display: flex; flex-direction: column; gap: 16px; max-height: 320px; overflow-y: auto; margin-bottom: 20px;">
                ${cart.map(i => `
                  <div style="display: flex; gap: 12px; align-items: center;">
                    <img src="${i.image}" alt="${AppUtils.escapeHTML(i.name)}" style="width: 52px; height: 65px; object-fit: cover; border-radius: var(--radius-sm);" />
                    <div style="flex: 1; font-size: 0.875rem;">
                      <div style="font-weight: 500;">${AppUtils.escapeHTML(i.name)}</div>
                      <div style="color: var(--text-dim); font-size: 0.75rem;">Qty: ${i.quantity} ${i.size ? `&bull; ${i.size}` : ''}</div>
                    </div>
                    <div style="font-weight: 600; font-size: 0.875rem;">${AppUtils.formatMoney(i.price * i.quantity)}</div>
                  </div>
                `).join("")}
              </div>

              <div class="summary-row">
                <span>Subtotal</span>
                <span>${AppUtils.formatMoney(subtotal)}</span>
              </div>
              ${discount > 0 ? `
                <div class="summary-row" style="color: var(--success);">
                  <span>Discount</span>
                  <span>-${AppUtils.formatMoney(discount)}</span>
                </div>
              ` : ""}
              <div class="summary-row total">
                <span>Total Due</span>
                <span>${AppUtils.formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  ...orderConfirmationScreen,

  ...favoritesScreen,
};

  // Account & Studio Views + Static Informational Pages





const WEBSITE_BUSINESS_TYPE_GROUPS = [
  {
    label: "Product Retail & E-commerce",
    sections: [
      { label: "Fashion and personal", themeId: "etalon-premium-fashion-apparel", types: [
        "Clothing boutiques", "Shoe stores", "Bags, accessories and jewelry", "Watches and sunglasses",
        "Thrift / mtumba shops", "Lingerie and underwear"
      ] },
      { label: "Electronics and tech", themeId: "kinetic-high-performance-electronics", types: [
        "Phone and accessories shops", "Laptops and computer stores", "Gaming and console stores",
        "Appliances", "Solar and power equipment"
      ] },
      { label: "Home and living", themeId: "woodora-modern-furniture-luxury-home-interiors-kenya", types: [
        "Furniture", "Home décor and interiors", "Kitchenware and utensils", "Bedding and curtains",
        "Hardware and building materials", "Garden and plant nurseries"
      ] },
      { label: "Health and beauty products", themeId: "elura-botanicals-luxury-cosmetics-skincare", types: [
        "Cosmetics and makeup", "Skincare and hair products", "Perfumes", "Pharmacies and chemists",
        "Wellness and supplements"
      ] },
      { label: "Everyday retail", themeId: "zima-fresh-supermarket-fresh-groceries-farm-produce-daily-essent", types: [
        "Supermarkets and minimarkets", "General shops (dukas)", "Stationery and books",
        "Toys and baby products", "Gift shops and flower shops", "Pet shops and pet supplies",
        "Auto parts and car accessories", "Sports and fitness equipment", "Wholesale and distributors",
        "Printing and branded merchandise"
      ] }
    ]
  },
  {
    label: "Food & Drinks",
    sections: [
      { label: "Eateries", themeId: "nairobi-feast-modern-cbd-kitchen-grill", types: [
        "Restaurants", "Cafés and coffee shops", "Fast food and takeaway", "Nyama choma joints",
        "Pizzerias and burger joints", "Street food and kiosks", "Food trucks", "Juice and smoothie bars"
      ] },
      { label: "Bars and nightlife", themeId: "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant", types: [
        "Bars and pubs", "Lounges and clubs", "Wine and spirits shops", "Breweries"
      ] },
      { label: "Bakery and sweets", themeId: "nairobi-feast-modern-cbd-kitchen-grill", types: [
        "Bakeries", "Cake and pastry shops", "Ice cream and dessert shops", "Chocolate and candy shops"
      ] },
      { label: "Food retail and supply", themeId: "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec", types: [
        "Butcheries", "Fresh produce and greengrocers", "Groceries and delivery services",
        "Health food stores", "Spice and herb shops"
      ] },
      { label: "Food services", themeId: "nairobi-feast-modern-cbd-kitchen-grill", types: [
        "Catering", "Meal prep and subscription meals", "Cloud kitchens (delivery only)",
        "Event food vendors"
      ] }
    ]
  },
  {
    label: "Hotels, Stays & Retreats",
    sections: [
      { label: "Accommodation and retreats", themeId: "aurelia-grand-luxury-hotels-stays-culinary-destinations", types: [
        "Hotels", "Lodges", "Guest houses", "Bed and breakfasts (B&Bs)", "Hostels and backpackers",
        "Serviced apartments", "Airbnb and short-term rentals", "Villas and holiday homes", "Resorts",
        "Safari camps and tented camps", "Campsites and glamping", "Eco-lodges",
        "Wellness and yoga retreats", "Corporate retreats and conference centers",
        "Wedding and event venues", "Farm stays", "Beach cottages"
      ] }
    ]
  },
  {
    label: "Beauty Services & Bookings",
    sections: [
      { label: "Hair", themeId: "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier", types: [
        "Hair salons", "Barbershops", "Braiding and weaving studios",
        "Locticians and natural hair specialists", "Wig making and installation"
      ] },
      { label: "Nails and skin", themeId: "lacqueria-the-art-of-the-hand-nail-atelier-booking-shop", types: [
        "Nail studios (manicure and pedicure)", "Facial and skincare clinics",
        "Waxing and threading studios", "Lash and brow studios",
        "Makeup artists (bridal, events, shoots)", "Tanning studios"
      ] },
      { label: "Body and wellness", themeId: "aura-luxe-fine-botanical-cosmetics-luxury-beauty", types: [
        "Spas", "Massage therapy", "Aromatherapy and body treatments", "Sauna and steam rooms",
        "Fitness studios, gyms and personal trainers", "Yoga and pilates studios"
      ] },
      { label: "Specialty", themeId: "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth", types: [
        "Cosmetic and aesthetic clinics", "Tattoo and piercing studios",
        "Mobile beauty services (home visits)", "Bridal beauty packages", "Grooming for men"
      ] }
    ]
  },
  {
    label: "Events",
    sections: [
      { label: "Event businesses", themeId: "arcadia-events-bespoke-event-planning-spatial-design-studio", types: [
        "Event planners", "Event production and décor", "Event venues"
      ] }
    ]
  },
  {
    label: "Property & Real Estate",
    sections: [
      { label: "Property businesses", themeId: "aurus-real-estate-kenya-luxury-property-discovery-platform", types: [
        "Real estate agencies", "Property developers", "Property rentals and management"
      ] }
    ]
  },
  {
    label: "Tours & Safaris",
    sections: [
      { label: "Tour businesses", themeId: "olkeri-expeditions-luxury-kenya-safaris", types: [
        "Tour operators", "Safari companies", "Travel and excursion companies"
      ] }
    ]
  }
];

const WEBSITE_BUSINESS_TYPE_THEME_OVERRIDES = {
  "Shoe stores": "kicks-vault-curated-sneaker-footwear-archive",
  "Bags, accessories and jewelry": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Watches and sunglasses": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Phone and accessories shops": "volthaus-electronics-superstore-phones-laptops-tvs-gaming-more",
  "Laptops and computer stores": "kinetic-high-performance-electronics",
  "Gaming and console stores": "volthaus-electronics-superstore-phones-laptops-tvs-gaming-more",
  "Appliances": "veluna-grand-electronics-retail-store",
  "Solar and power equipment": "kifaru-build-kenyan-hardware-construction-supply-superstore",
  "Hardware and building materials": "kifaru-build-kenyan-hardware-construction-supply-superstore",
  "Garden and plant nurseries": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Cosmetics and makeup": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Skincare and hair products": "elura-botanicals-luxury-cosmetics-skincare",
  "Perfumes": "maison-alchemie-haute-parfumerie-niche-fragrances-18-place-vendo",
  "Pharmacies and chemists": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Wellness and supplements": "elura-botanicals-luxury-cosmetics-skincare",
  "Stationery and books": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Toys and baby products": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Gift shops and flower shops": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Pet shops and pet supplies": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Auto parts and car accessories": "autopro-kenya-premium-automotive-spares-parts",
  "Sports and fitness equipment": "volthaus-electronics-superstore-phones-laptops-tvs-gaming-more",
  "Printing and branded merchandise": "atelier-vera-mobile-first-luxury-storefront-paystack-checkout",
  "Restaurants": "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant",
  "Cafés and coffee shops": "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant",
  "Fast food and takeaway": "nairobi-feast-modern-cbd-kitchen-grill",
  "Nyama choma joints": "nairobi-feast-modern-cbd-kitchen-grill",
  "Pizzerias and burger joints": "nairobi-feast-modern-cbd-kitchen-grill",
  "Street food and kiosks": "nairobi-feast-modern-cbd-kitchen-grill",
  "Food trucks": "nairobi-feast-modern-cbd-kitchen-grill",
  "Juice and smoothie bars": "mikaa-woodfire-coast-artisanal-coastal-hearth-restaurant",
  "Butcheries": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Fresh produce and greengrocers": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Groceries and delivery services": "zima-fresh-supermarket-fresh-groceries-farm-produce-daily-essent",
  "Health food stores": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Spice and herb shops": "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
  "Catering": "nairobi-feast-modern-cbd-kitchen-grill",
  "Meal prep and subscription meals": "nairobi-feast-modern-cbd-kitchen-grill",
  "Cloud kitchens (delivery only)": "nairobi-feast-modern-cbd-kitchen-grill",
  "Event food vendors": "nairobi-feast-modern-cbd-kitchen-grill",
  "Lodges": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Guest houses": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Bed and breakfasts (B&Bs)": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Hostels and backpackers": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Airbnb and short-term rentals": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Villas and holiday homes": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Safari camps and tented camps": "olkeri-expeditions-luxury-kenya-safaris",
  "Campsites and glamping": "olkeri-expeditions-luxury-kenya-safaris",
  "Eco-lodges": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Wellness and yoga retreats": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Corporate retreats and conference centers": "aurelia-grand-luxury-hotels-stays-culinary-destinations",
  "Wedding and event venues": "arcadia-events-bespoke-event-planning-spatial-design-studio",
  "Farm stays": "the-oserengoni-estate-conservancy-luxury-safari-retreat-kenya",
  "Beach cottages": "elysian-stays-cinematic-vacation-boutique-short-stay-rentals",
  "Nail studios (manicure and pedicure)": "lacqueria-the-art-of-the-hand-nail-atelier-booking-shop",
  "Facial and skincare clinics": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Waxing and threading studios": "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth",
  "Lash and brow studios": "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth",
  "Makeup artists (bridal, events, shoots)": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Tanning studios": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Spas": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Massage therapy": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Aromatherapy and body treatments": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Sauna and steam rooms": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Fitness studios, gyms and personal trainers": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Yoga and pilates studios": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Cosmetic and aesthetic clinics": "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "Tattoo and piercing studios": "blush-theory-nail-studio-editorial-nail-art-online-booking-apoth",
  "Mobile beauty services (home visits)": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Bridal beauty packages": "maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",
  "Event production and décor": "cira-atelier-event-architecture-management",
  "Event venues": "cira-atelier-event-architecture-management"
};

const WEBSITE_THEME_BUSINESS_GROUPS = {
  "Product Retail & E-commerce": [
    "agricra-minimarket",
    "glowmuse-beauty",
    "heenzy-footwear",
    "maridadi-living",
    "ujenzi-hub",
    "voltra-electronics",
    "vera-fashion"
  ],
  "Food & Drinks": ["freshbox-gourmet"]
};

// The till and the web form offer the same durations, from the one shared service definition.
export function webServiceDurationOptions(selected) {
  const model = window.EshopServiceModel;
  const step = model?.SERVICE_STEP_MINUTES || 15;
  const min = model?.SERVICE_MIN_MINUTES || 15;
  const max = model?.SERVICE_MAX_MINUTES || 240;
  const chosen = Number(selected) || model?.DEFAULT_SERVICE_MINUTES || 60;
  const options = [];
  for (let minutes = min; minutes <= max; minutes += step) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const label = hours && rest ? `${hours} hr ${rest} min` : hours ? `${hours} hr` : `${minutes} min`;
    options.push(`<option value="${minutes}" ${minutes === chosen ? "selected" : ""}>${label}</option>`);
  }
  return options.join("");
}
export const StudioRenderers = {
  mainShopSnapshotCache: null,

  getCachedMainShopSnapshot() {
    const activeTenantId = AppController.getActiveTenant().id;
    return this.mainShopSnapshotCache?.tenantId === activeTenantId
      ? this.mainShopSnapshotCache.snapshot
      : null;
  },

  renderAppAccount() {
    const username = window.localStorage.getItem("ESHOP_ACCOUNT_USERNAME_V1") || "";
    const recoveryEmail = window.localStorage.getItem("ESHOP_ACCOUNT_EMAIL_V1") || "";
    const signedIn = Boolean(window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") && username);
    const accountQuery = new URLSearchParams((window.location.hash.split("?")[1] || ""));
    const googleError = accountQuery.get("google_error") || "";
    const googleStatus = googleError === "cancelled"
      ? "Google sign-in was cancelled."
      : googleError === "existing_account"
        ? "A Craft account already uses this Google email. Sign in with your Craft username and password, then link Google from this screen."
        : googleError === "linked_elsewhere"
          ? "That Google account is already linked to a different Craft account."
          : googleError
            ? "Google sign-in could not be completed. Please try again."
            : accountQuery.has("google_linked")
              ? "Google account linked. You can now use it to sign in."
              : "";
    AppUtils.updateSEO({ title: "App account — Craft", description: "Create or sign in to your Craft app account." });
    return `
      <main class="app-account-screen" aria-label="Craft app account">
        <header class="app-account-header">
          <p class="app-account-kicker">Craft · Account</p>
          <h1 class="app-account-title">Your app account</h1>
          <p class="app-account-description">Sign in once to use your account in POS and Web Builder.</p>
        </header>
        ${googleStatus ? `<p class="profile-page-card" role="${googleError ? "alert" : "status"}">${AppUtils.escapeHTML(googleStatus)}</p>` : ""}
        <section class="profile-page-content" aria-label="App account">
          ${signedIn ? `
            <article class="profile-page-card">
              <h2>Account</h2>
              <p>Username: <strong>${AppUtils.escapeHTML(username)}</strong></p>
              <form id="app-account-recovery-email-form" class="app-account-form">
                <label class="form-field"><span class="form-label">Recovery email</span><input class="form-input" name="email" type="email" required maxlength="254" autocomplete="email" value="${AppUtils.escapeHTML(recoveryEmail)}" placeholder="you@example.com"></label>
                <label class="form-field"><span class="form-label">Current password</span><input class="form-input" name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password" placeholder="Confirm your password"></label>
                <p id="app-account-recovery-email-status" role="status" hidden style="color:var(--text-muted);margin:0;"></p>
                <p id="app-account-recovery-email-error" role="alert" hidden style="color:#b42318;margin:0;"></p>
                <button class="btn-secondary" type="submit">Save recovery email</button>
              </form>
              <div class="profile-website-actions">
                <button class="btn-secondary" type="button" id="app-account-google-link">Link Google account</button>
                <a class="btn-primary" href="/pos" data-route="/pos">Open POS</a>
                <a class="btn-secondary" href="/account" data-route="/account">Open Web Builder</a>
                <button class="btn-secondary" type="button" id="app-account-signout">Sign out</button>
              </div>
            </article>
          ` : `
            <form id="app-account-form" data-auth-mode="login" class="app-account-form">
              <article class="profile-page-card app-account-form">
                <h2 id="app-account-heading">Sign in to your app account</h2>
                <div class="app-account-mode">
                  <button class="btn-secondary" type="button" data-app-auth-mode="register" aria-pressed="false">Create account</button>
                  <button class="btn-primary" type="button" data-app-auth-mode="login" aria-pressed="true">Sign in</button>
                </div>
                <label class="form-field"><span class="form-label">Username</span><input class="form-input" name="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+" autocomplete="username" placeholder="Choose a username"></label>
                <label class="form-field" id="app-account-email-field" hidden><span class="form-label">Recovery email</span><input class="form-input" name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com"></label>
                <label class="form-field"><span class="form-label">Password</span><span class="app-account-password-row"><input class="form-input" name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password" placeholder="Password"><button class="btn-secondary app-account-password-toggle" type="button" data-app-toggle-password="password" aria-label="Show password">Show</button></span></label>
                <label class="form-field" id="app-account-confirm-field" hidden><span class="form-label">Confirm password</span><span class="app-account-password-row"><input class="form-input" name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Enter password again"><button class="btn-secondary app-account-password-toggle" type="button" data-app-toggle-password="confirmPassword" aria-label="Show confirm password">Show</button></span></label>
                <div id="app-account-turnstile" hidden style="min-height:65px;" aria-label="Cloudflare human verification"></div>
                <p id="app-account-verification-help" role="status" hidden style="color:var(--text-muted);margin:0;"></p>
                <p id="app-account-error" role="alert" hidden style="color:#b42318;margin:0;"></p>
                <button class="btn-primary app-account-submit" type="submit">Sign in</button>
                <button class="btn-secondary" type="button" id="app-account-google">Continue with Google</button>
                <button class="btn-secondary" type="button" id="app-account-forgot-password">Forgot password?</button>
              </article>
            </form>
            <article class="profile-page-card app-account-form" id="app-account-recovery" hidden>
              <h2>Password recovery</h2>
              <p id="app-account-recovery-status" role="status">Enter the recovery email you used when creating your account.</p>
              <label class="form-field" id="app-account-recovery-email-field"><span class="form-label">Recovery email</span><input class="form-input" id="app-account-recovery-email" type="email" maxlength="254" autocomplete="email" required placeholder="you@example.com"></label>
              <button class="btn-primary" type="button" id="app-account-send-reset-code">Send recovery code</button>
              <label class="form-field" id="app-account-recovery-code-field" hidden><span class="form-label">6-digit code</span><input class="form-input" id="app-account-recovery-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></label>
              <button class="btn-primary" type="button" id="app-account-verify-reset-code" hidden>Verify code</button>
              <label class="form-field" id="app-account-new-password-field" hidden><span class="form-label">New password</span><input class="form-input" id="app-account-new-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="At least 12 characters"></label>
              <label class="form-field" id="app-account-confirm-new-password-field" hidden><span class="form-label">Confirm new password</span><input class="form-input" id="app-account-confirm-new-password" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Enter password again"></label>
              <button class="btn-primary" type="button" id="app-account-reset-password" hidden>Reset password</button>
              <p id="app-account-recovery-error" role="alert" hidden style="color:#b42318;margin:0;"></p>
              <button class="btn-secondary" type="button" id="app-account-recovery-cancel">Back to sign in</button>
            </article>
          `}
          <article class="profile-page-card app-account-note">
            <h2>Your app data</h2>
            <p>Your recovery email is used only for password recovery, not marketing. Signing in makes your account available throughout the app. Your POS sales and inventory remain on this device; signing in does not upload or sync them.</p>
          </article>
        </section>
      </main>
    `;
  },

  renderAccount() {
    const modules = [
      { title: "Point of Sale", description: "Open checkout, POS inventory, receipts, and sales reporting.", route: "/pos" },
      { title: "Products Manager", description: "Manage products, pricing, imagery, and specifications with live SQLite sync.", route: "/account/products" },
      { title: "Inventory", description: "Review stock counts, valuations, and low-stock items.", route: "/account/inventory" },
      { title: "Categories", description: "Organize collections, reassign products, and manage department details.", route: "/account/categories" },
      { title: "Business Dashboard", description: "Explore sales volume, conversion metrics, and business performance.", route: "/account/dashboard" },
      { title: "Build Your Web", description: "Edit store details and pages, then open the customer-facing storefront.", route: "/account/web" },
      { title: "Store Settings", description: "Adjust your storefront appearance and preferences.", route: "/account/settings" },
      { title: "My shops", description: "Manage the websites linked to your account.", route: "/account/tenants" },
      { title: "Plans & Tiering", description: "View available plans and features.", route: "/account/plans" },
    ];

    AppUtils.updateSEO({
      title: "Web Builder — Craft",
      description: "Build and preview your Craft online store."
    });

    return `
      ${StoreRenderers.renderNavbar("/account")}
      <main class="container account-dashboard-main" style="padding:32px 0 80px;">
        <div style="margin:0 0 24px;">
          <span class="section-eyebrow studio-architecture-eyebrow">Studio Architecture</span>
          <h1 class="section-heading studio-architecture-title" style="margin-top:8px;text-align:center;">Management</h1>
        </div>
        <nav class="studio-nav-grid" aria-label="Management modules">
          ${modules.map(module => `
            <a href="${module.route}" class="studio-card ${module.className || ""}" data-route="${module.route}">
              <h2 class="studio-card-title">${module.title}</h2>
              <p class="studio-card-desc">${module.description}</p>
            </a>
          `).join("")}
        </nav>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderMainShop() {
    return this.renderMainShopWorkspace("/account/main-shop");
  },

  renderWorkspaceSidebar(title, items, activeRoute) {
    const label = AppUtils.escapeHTML(title);
    const route = AppUtils.escapeHTML(activeRoute);
    const profileLinks = [
      { title: "Profile", route: "/account/profile/profile" },
      { title: "Webs", route: "/account/profile/webs" },
      { title: "Accounts", route: "/account/profile/accounts" },
      { title: "Privacy", route: "/account/profile/privacy" },
      { title: "Recommended actions", route: "/account/profile/recommended-actions" },
      { title: "Link devices", route: "/account/profile/link-devices" },
      // Both of these existed with no way in: the owner could only reach them by asking the AI
      // helper for a link. Every menu in the app opens this list, so they belong here.
      { title: "App settings", route: "/account/settings" },
      { title: "Plans", route: "/account/plans" },
      { title: "Updates", route: "/account/profile/updates" }
    ];
    return `<details class="workspace-menu">
      <summary aria-label="Open ${label} menu" title="Open menu">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
      </summary>
      <a class="workspace-sidebar-scrim" href="${route}" data-route="${route}" aria-label="Close ${label} menu"></a>
      <aside class="workspace-sidebar" aria-label="${label} menu">
        <h2>${label}</h2>
        <nav class="workspace-sidebar-links" aria-label="${label} pages">
          ${items.map(item => item.disabled
            ? `<a href="#" class="workspace-sidebar-link" aria-disabled="true" tabindex="-1">${AppUtils.escapeHTML(item.title)}</a>`
            : `<a href="${AppUtils.escapeHTML(item.route)}" data-route="${AppUtils.escapeHTML(item.route)}" class="workspace-sidebar-link ${item.route === activeRoute ? "is-active" : ""}" ${item.route === activeRoute ? 'aria-current="page"' : ""}>${AppUtils.escapeHTML(item.title)}</a>`).join("")}
        </nav>
        <div class="workspace-sidebar-divider" aria-hidden="true"></div>
        <nav class="workspace-sidebar-links" aria-label="Profile and app links">
          ${profileLinks.map(item => `<a href="${item.route}" data-route="${item.route}" class="workspace-sidebar-link">${item.title}</a>`).join("")}
        </nav>
        <a class="workspace-sidebar-link workspace-sidebar-logout" href="/" data-route="/" data-home-screen aria-label="Log out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></svg><span>Log out</span></a>
      </aside>
    </details>`;
  },

  analyticsDays() {
    const stored = window.BusinessLens?.readFilters?.()?.analyticsDays;
    if (stored == null || String(stored).trim() === "") return 30;
    const days = Number(stored);
    return Number.isFinite(days) ? Math.min(365, Math.max(1, Math.trunc(days))) : 30;
  },

  renderWorkspaceLoading(label) {
    const accessibleLabel = AppUtils.escapeHTML(`Loading ${label}`);
    return `<div class="workspace-loading-skeleton" role="status" aria-label="${accessibleLabel}" aria-busy="true">
      <div class="studio-metric-grid" aria-hidden="true">
        ${Array.from({ length: 3 }, () => `<article class="studio-data-card"><span class="workspace-skeleton-line is-short"></span><strong class="workspace-skeleton-line is-value"></strong><small class="workspace-skeleton-line is-medium"></small></article>`).join("")}
      </div>
      <article class="studio-panel workspace-skeleton-panel" aria-hidden="true">
        <span class="workspace-skeleton-line is-short"></span>
        <span class="workspace-skeleton-line is-long"></span>
        <span class="workspace-skeleton-line is-medium"></span>
        <span class="workspace-skeleton-line is-long"></span>
        <span class="workspace-skeleton-line is-medium"></span>
      </article>
    </div>`;
  },

  renderMainShopWorkspace(path) {
    if (path === "/account/main-shop/insights") path = "/account/main-shop";
    if (path === "/account/web" || path.startsWith("/account/web/studio/")) {
      return this.renderWebStudioWorkspace(path);
    }
    const businessFilters = window.BusinessLens?.readFilters?.() || {};
    const bottomItems = [
      { route: "/account/main-shop", title: "Overview", section: "overview", icon: "⌂" },
      { route: "/store/revenue", title: "Sales", section: "sales", icon: "↗" },
      { route: "/account/customers", title: "Customers", section: "customers", icon: "◉" },
      { route: "/store/manage/products", title: "Store", section: "store", icon: "▤" },
      { route: "/account/main-shop/finance", title: "More", section: "more", icon: "⋮" }
    ];
    const isStoreManagement = path === "/store/manage" || path.startsWith("/store/manage/");
    const section = isStoreManagement ? "store"
      : path === "/account/main-shop" ? "overview"
      : ["/store/revenue", "/store/channels", "/store/sales", "/store/orders", "/store/payments"].includes(path) ? "sales"
        : ["/store/products", "/store/inventory", "/store/categories", "/store/split-shop"].includes(path) ? "products"
          : path.startsWith("/account/customers") || path === "/account/main-shop/marketing" ? "customers"
            : path.startsWith("/account/main-shop/") ? "more"
              : path.startsWith("/store/") ? "products" : "overview";
    const pagesBySection = {
      overview: [
        { route: "/account/main-shop", title: "Overview" }
      ],
      sales: [
        { route: "/store/revenue", title: "Revenue" },
        { route: "/store/channels", title: "Channels" },
        { route: "/store/sales", title: "Transactions" },
        { route: "/store/orders", title: "Orders" },
        { route: "/store/payments", title: "Payments" }
      ],
      products: [
        { route: "/store/products", title: "Products" },
        { route: "/store/products/manage", title: "Edit products" },
        { route: "/store/inventory", title: "Inventory" },
        { route: "/store/categories", title: "Categories" },
        { route: "/store/split-shop", title: "Split products" }
      ],
      store: [
        { route: "/store/products", title: "Web products" },
        { route: "/store/products/manage", title: "Edit products" },
        { route: "/store/inventory", title: "Inventory" },
        { route: "/store/categories", title: "Web categories" },
        { route: "/store/split-shop", title: "Split products" }
      ],
      customers: [
        { route: "/account/customers", title: "Customers" },
        { route: "/account/main-shop/marketing", title: "Marketing" },
        { route: "/account/customers/newsletter", title: "Newsletter" }
      ],
      more: [
        { route: "/account/main-shop/finance", title: "Finance" },
        { route: "/account/main-shop/stores", title: "Stores" },
        { route: "/account/main-shop/settings", title: "Settings" },
        { route: "/account/main-shop/help", title: "Help" }
      ]
    };
    const pages = pagesBySection[section];
    const canonicalPath = path === "/account/main-shop/" ? "/account/main-shop"
      : path === "/store/sales" ? "/store/sales"
        : path;
    const page = isStoreManagement
      ? { title: path.endsWith("/categories") ? "Categories" : "Products" }
      : pages.find(item => item.route === canonicalPath) || pages[0];
    const sectionSidebar = this.renderWorkspaceSidebar(
      section === "store" ? "Store" : `${section[0].toUpperCase()}${section.slice(1)} screens`,
      pages,
      canonicalPath
    );
    const showBusinessFilters = !isStoreManagement && path !== "/store/products/manage";
    const cachedSnapshot = this.getCachedMainShopSnapshot();
    const initialContent = cachedSnapshot
      ? this.renderMainShopContent(path, cachedSnapshot)
      : this.renderWorkspaceLoading("business records");
    AppUtils.updateSEO({
      title: `${page.title} — Craft`,
      description: "Business overview, sales, product, customer, finance and store intelligence."
    });
    return `
      <main class="container account-dashboard-main store-workspace-shell studio-workspace business-lens-shell" style="padding:12px 0 92px;">
        <header class="studio-workspace-heading">
          <a class="studio-workspace-back" href="/" data-route="/" data-home-screen aria-label="Back to Craft home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></a>
          <h1 class="studio-workspace-tab-title">${AppUtils.escapeHTML(page.title)}</h1>
          <div class="studio-workspace-header-actions">
            ${AppUtils.craftAccountSignedIn() ? "" : `<a href="/app-account" data-route="/app-account"
              class="btn-primary studio-signin-btn" title="Sign in to load orders, alerts and publishing">Sign in</a>`}
            ${showBusinessFilters ? `<button type="button" class="studio-preview-link bl-filter-toggle" data-business-filter-toggle aria-label="Show filters" aria-controls="business-date-filters" aria-expanded="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z"/></svg>
            </button>` : ""}
            ${sectionSidebar}
          </div>
        </header>
        ${showBusinessFilters ? `<nav id="business-date-filters" class="bl-date-filter" aria-label="Business filters" hidden>
          <label><span>Range</span><select class="business-filter" data-filter="range"><option value="today" ${businessFilters.range === "today" ? "selected" : ""}>Today</option><option value="7d" ${businessFilters.range === "7d" ? "selected" : ""}>7 days</option><option value="30d" ${(!businessFilters.range || businessFilters.range === "30d") ? "selected" : ""}>30 days</option><option value="90d" ${businessFilters.range === "90d" ? "selected" : ""}>90 days</option><option value="month" ${businessFilters.range === "month" ? "selected" : ""}>This month</option><option value="ytd" ${businessFilters.range === "ytd" ? "selected" : ""}>Year to date</option><option value="all" ${businessFilters.range === "all" ? "selected" : ""}>All time</option><option value="custom" ${businessFilters.range === "custom" ? "selected" : ""}>Custom</option></select></label>
          <label><span>From</span><input class="business-filter" data-filter="from" type="date" value="${AppUtils.escapeHTML(businessFilters.from || "")}"></label>
          <label><span>To</span><input class="business-filter" data-filter="to" type="date" value="${AppUtils.escapeHTML(businessFilters.to || "")}"></label>
          <label><span>Channel</span><select class="business-filter" data-filter="channel"><option value="all" ${(!businessFilters.channel || businessFilters.channel === "all") ? "selected" : ""}>All</option><option value="web" ${businessFilters.channel === "web" ? "selected" : ""}>Web</option><option value="pos" ${businessFilters.channel === "pos" ? "selected" : ""}>Counter</option></select></label>
          <label><span>Category</span><select class="business-filter" data-filter="category"><option value="all">All</option>${SQLiteEngine.getCategories().map(category => `<option value="${AppUtils.escapeHTML(category.name)}" ${businessFilters.category === category.name ? "selected" : ""}>${AppUtils.escapeHTML(category.name)}</option>`).join("")}</select></label>
          <label><span>Interval</span><select class="business-filter" data-filter="granularity"><option value="day" ${(!businessFilters.granularity || businessFilters.granularity === "day") ? "selected" : ""}>Daily</option><option value="week" ${businessFilters.granularity === "week" ? "selected" : ""}>Weekly</option><option value="month" ${businessFilters.granularity === "month" ? "selected" : ""}>Monthly</option></select></label>
        </nav>` : ""}
        <nav class="studio-workspace-bottom-nav" aria-label="Business sections">
          ${bottomItems.map(item => `
            <a href="${item.route}" class="studio-workspace-bottom-link ${item.section === section ? "is-active" : ""}" data-route="${item.route}" ${item.section === section ? 'aria-current="page"' : ""}>
              <span class="studio-nav-icon" aria-hidden="true">${item.icon}</span>
              <span>${item.title}</span>
            </a>
          `).join("")}
        </nav>
        <section id="store-workspace-content" class="store-workspace-content business-lens-content" aria-live="polite" style="min-height:180px;padding-top:10px;">
          ${initialContent}
        </section>
      </main>
    `;
  },

  renderWebsiteManagementCards(websites, deleteLabel = "Delete web", ariaLabel = "Your websites") {
    const activeTenant = AppController.getActiveTenant();
    const visibleWebsites = websites
      .filter(website => website.id !== "main")
      .sort((a, b) => Number(b.id === activeTenant.id) - Number(a.id === activeTenant.id));
    const value = input => AppUtils.escapeHTML(String(input || "").trim() || "Not added yet");
    return `
      <section class="profile-page-websites" aria-label="${AppUtils.escapeHTML(ariaLabel)}">
        ${visibleWebsites.map(website => `
          <article class="profile-page-card profile-website-card">
            <header class="profile-website-card-heading">
              <div>
                <h2><a class="profile-website-settings-link" href="/account/profile/webs/${encodeURIComponent(website.id)}" data-route="/account/profile/webs/${encodeURIComponent(website.id)}">${AppUtils.escapeHTML(website.name)}</a></h2>
                <p class="profile-website-domain"><a href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(website.hostname)}</a></p>
              </div>
              <a class="profile-website-live" href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener" aria-label="Open ${AppUtils.escapeHTML(website.name)} live website">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>
              </a>
            </header>
            ${website.id === activeTenant.id ? '<span class="profile-current-website-badge">Currently managing</span>' : ""}
            <div class="profile-page-details">
              <p>Store details: ${value(website.store.description)}</p>
              <p>Location: ${value(website.store.location_address || website.store.location)}</p>
              <p>Email: ${value(website.store.email)}</p>
              <p>Phone: ${value(website.store.phone)}</p>
              <p>${website.products.length} products · ${website.categories.length} categories</p>
            </div>
            <div class="website-management-actions">
              <button class="btn-primary" type="button" data-edit-website="${AppUtils.escapeHTML(website.id)}">Edit</button>
              <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(website.id)}/domains" data-route="/account/profile/webs/${encodeURIComponent(website.id)}/domains">Domains</a>
              <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(website.id)}/stats" data-route="/account/profile/webs/${encodeURIComponent(website.id)}/stats">Stats</a>
              <button class="btn-secondary profile-website-delete" type="button" data-delete-website="${AppUtils.escapeHTML(website.id)}"${website.id === "main" ? ' disabled title="The main Craft domain cannot be deleted."' : ""}>${deleteLabel}</button>
            </div>
            <button class="btn-primary website-management-manage" type="button" data-manage-website="${AppUtils.escapeHTML(website.id)}">Manage this web</button>
          </article>
        `).join("")}
      </section>`;
  },

  webStudioNavigation() {
    const activeTenant = AppController.getActiveTenant();
    const domainTenantId = AppController.isWebsiteBuilderDraftTenant(activeTenant.id) ? "main" : activeTenant.id;
    const domainsRoute = `/account/profile/webs/${encodeURIComponent(domainTenantId)}/domains`;
    return [
      {
        title: "Dashboard",
        route: "/account/web/studio/dashboard/overview",
        icon: "⌂",
        tabs: [
          { title: "Overview", route: "/account/web/studio/dashboard/overview", contentPath: "/account/dashboard" },
          { title: "Visits", route: "/account/web/studio/dashboard/visits", contentPath: "/account/main-shop/visits" },
          { title: "Traffic", route: "/account/web/studio/dashboard/traffic", contentPath: "/account/main-shop/traffic" },
          { title: "Performance", route: "/account/web/studio/dashboard/performance", contentPath: "/account/main-shop/performance" },
          { title: "Product intelligence", route: "/account/web/studio/dashboard/product-intelligence", contentPath: "/account/main-shop/product-intelligence" }
        ]
      },
      {
        title: "Store",
        route: "/account/web/studio/store/products",
        icon: "▦",
        tabs: [
          { title: "Products", route: "/account/web/studio/store/products", contentPath: "/store/products" },
          { title: "Categories", route: "/account/web/studio/store/categories", contentPath: "/store/categories" },
          { title: "Inventory", route: "/account/web/studio/store/inventory", contentPath: "/store/inventory" },
          { title: "Orders", route: "/account/web/studio/store/orders", contentPath: "/account/web/studio/store/orders" },
          { title: "Bookings", route: "/account/web/studio/store/bookings", contentPath: "/account/web/studio/store/bookings" }
        ]
      },
      {
        title: "CRM",
        route: "/account/web/studio/crm/customers",
        icon: "◉",
        tabs: [
          { title: "Customers", route: "/account/web/studio/crm/customers", contentPath: "/account/customers" },
          { title: "Points", route: "/account/web/studio/crm/points", contentPath: "/account/customers/loyalty" },
          { title: "Subscribers", route: "/account/web/studio/crm/subscribers", contentPath: "/account/customers/newsletter" },
          { title: "Notifications", route: "/account/web/studio/crm/notifications", contentPath: "/account/web/studio/crm/notifications" }
        ]
      },
      {
        title: "Websites",
        route: "/account/web/studio/websites/list",
        icon: "▤",
        tabs: [
          { title: "Websites", route: "/account/web/studio/websites/list", contentPath: "/account/web/studio/websites/list" },
          { title: "Domains", route: domainsRoute, contentPath: domainsRoute },
          { title: "New web", route: "/account/web/studio/websites/webmaker", contentPath: "/account/web/studio/websites/webmaker" },
          { title: "Add", route: "/account/web/studio/websites/add", contentPath: "/account/web/studio/websites/add" },
          { title: "Website editor", route: "/account/web/studio/websites/editor", contentPath: "/account/web/studio/websites/editor" }
        ]
      },
      {
        title: "Payments",
        route: "/account/web/studio/payments",
        icon: "＄",
        tabs: [{ title: "Payments", route: "/account/web/studio/payments", contentPath: "/account/payments" }]
      }
    ];
  },

  webStudioPage(path) {
    const sections = this.webStudioNavigation();
    const initialPath = path === "/account/web"
      ? "/account/web/studio/dashboard/overview"
      : path;
    const route = ({
      "/account/web/studio/store/orders-bookings": "/account/web/studio/store/orders",
      "/account/web/studio/crm/repeat-customers": "/account/web/studio/crm/customers",
      "/account/web/studio/crm/newsletter": "/account/web/studio/crm/subscribers"
    })[initialPath] || initialPath;
    for (const section of sections) {
      const tab = section.tabs.find(item => item.route === route && !item.disabled);
      if (tab) return { ...tab, section };
    }
    return { ...sections[0].tabs[0], section: sections[0] };
  },

  renderWebStudioWebsiteList() {
    const activeTenant = AppController.getActiveTenant();
    const activeStore = SQLiteEngine.getStore();
    const websites = AppController.tenantCatalogs()
      .filter(website => website && typeof website.tenant_id === "string")
      .map(website => ({
        id: website.tenant_id,
        name: website.name || website.store?.name || website.tenant_id,
        hostname: website.hostname || (website.tenant_id === "main" ? "rrobin.co.ke" : `${website.tenant_id}.rrobin.co.ke`),
        store: website.tenant_id === activeTenant.id ? activeStore : website.store || {},
        products: Array.isArray(website.products) ? website.products : [],
        categories: Array.isArray(website.categories) ? website.categories : []
      }));
    if (!websites.some(website => website.id === "main")) {
      websites.unshift({
        id: "main",
        name: "Craft",
        hostname: "rrobin.co.ke",
        store: activeTenant.id === "main" ? activeStore : {},
        products: [],
        categories: []
      });
    }
    if (!websites.some(website => website.id === activeTenant.id)) {
      websites.push({
        id: activeTenant.id,
        name: activeTenant.name || activeStore.name || activeTenant.id,
        hostname: activeTenant.hostname || `${activeTenant.id}.rrobin.co.ke`,
        store: activeStore,
        products: [],
        categories: []
      });
    }
    return `<section class="studio-workspace-section">
      <header class="website-management-heading">
        <div><h2>Your websites</h2><p>Choose a website to edit or manage.</p></div>
        <a class="btn-primary website-management-new" href="/account/web/studio/websites/webmaker" data-start-new-website>+ New web</a>
      </header>
      ${this.renderWebsiteManagementCards(websites)}
    </section>`;
  },

  renderNewWebsiteProducts() {
    const draft = this.websiteBuilderDraft();
    const litrusBuilderRoute = "/account/web/site?new=1&edit=1&theme=litrus-mixer";
    // Step 1 is the shop's identity; the catalogue only opens once the shop has a name and address.
    if (draft.wizard_step !== "catalogue" || !draft.shop_name || !draft.shop_address) {
      return `<section class="studio-workspace-section">
      <header class="website-management-heading">
        <div><span class="studio-workspace-kicker">NEW WEBSITE · STEP 1 OF 2</span><h2>Your shop</h2><p>Start with the basics. You will add products and categories next.</p></div>
      </header>
      <form id="website-wizard-identity-form" class="store-workspace-form">
        <label>Shop / website name<input name="name" maxlength="120" required placeholder="My Shop" value="${AppUtils.escapeHTML(draft.shop_name || "")}"></label>
        <label>What do you sell?<input name="kind" maxlength="120" placeholder="For example clothes, groceries or haircuts" value="${AppUtils.escapeHTML(draft.shop_kind || "")}"></label>
        <label>Website address<span style="display:flex;align-items:center;gap:5px;"><input name="address" maxlength="40" required placeholder="my-shop" value="${AppUtils.escapeHTML(draft.shop_address || "")}"><span style="white-space:nowrap;font-size:.8rem;">.rrobin.co.ke</span></span></label>
        <p id="website-wizard-identity-error" role="alert" hidden style="margin:0;color:#b42318;"></p>
        <button type="submit" class="btn-primary" id="website-wizard-identity-continue">Continue to products</button>
      </form>
    </section>`;
    }
    return `<section class="studio-workspace-section">
      <header class="website-management-heading">
        <div><span class="studio-workspace-kicker">NEW WEBSITE · STEP 2 OF 2</span><h2>Website products</h2><p>${AppUtils.escapeHTML(draft.shop_name)} · ${AppUtils.escapeHTML(draft.shop_address)}.rrobin.co.ke. Choose Store products to add or create products just for this website.</p></div>
      </header>
      <div class="studio-inline-actions"><button type="button" class="btn-secondary website-wizard-compact-action" id="website-wizard-edit-identity">Edit shop details</button></div>
      <div class="studio-inline-actions web-product-actions">
        <button type="button" class="btn-secondary web-product-action-card" id="website-wizard-load-store">Add from Store</button>
        <button type="button" class="btn-primary web-product-action-card" id="website-wizard-create-product">Add web product</button>
      </div>
      <section class="studio-panel">
        <div class="studio-panel-heading"><h3>Website categories</h3></div>
        <form id="website-wizard-category-form" class="store-workspace-form">
          <input type="hidden" name="id" value="">
          <label>Category name<input name="name" maxlength="120" required></label>
          <button type="submit" class="btn-secondary">Add category</button>
        </form>
        <div class="website-wizard-category-list" id="website-wizard-category-list">${draft.categories.map(category =>
          `<div class="website-wizard-category-row"><span>${AppUtils.escapeHTML(category.name)}</span><button type="button" class="btn-secondary website-wizard-compact-action" data-edit-wizard-category="${AppUtils.escapeHTML(String(category.id))}">Edit</button><button type="button" class="btn-secondary website-wizard-compact-action" data-remove-wizard-category="${AppUtils.escapeHTML(String(category.id))}" aria-label="Remove ${AppUtils.escapeHTML(category.name)} from this website">Remove</button></div>`
        ).join("") || `<p class="studio-panel-note">No categories yet. Add from Store or create a category to add web products.</p>`}</div>
      </section>
      <section class="studio-panel">
        <div class="studio-panel-heading"><h3>Products</h3></div>
        <input class="form-input" id="website-wizard-product-search" type="search" placeholder="Search website products" aria-label="Search website products">
        <p class="website-wizard-list-status" id="website-wizard-product-count" role="status"></p>
        <div class="website-wizard-product-list" id="website-wizard-product-list"></div>
      </section>
      <form id="website-wizard-product-form" class="store-workspace-form website-wizard-product-form" hidden>
        <h3>Add web product</h3>
        <input type="hidden" name="id" value="">
        <label>Product name<input name="name" maxlength="160" required></label>
        <label>Category<select name="category_id" required><option value="">Choose a category</option>${draft.categories.map(category =>
          `<option value="${AppUtils.escapeHTML(String(category.id))}">${AppUtils.escapeHTML(category.name)}</option>`
        ).join("")}</select></label>
        <div class="studio-form-grid">
          <label>Selling price<input name="price" type="number" min="0" step="0.01" required></label>
          <label>Cost price<input name="cost_price" type="number" min="0" step="0.01"></label>
          <label>Starting website stock<input name="stock" type="number" min="0" step="1" value="0" required></label>
          <label>SKU<input name="sku" maxlength="120"></label>
        </div>
        <label>Description<textarea name="description" rows="3"></textarea></label>
        <div data-wizard-product-taxonomy></div>
        <div data-wizard-product-variants></div>
        <div class="web-product-attribute-pricing" data-wizard-product-attribute-pricing></div>
        <div class="web-product-media">
          <label data-wizard-photo-label>Add photos (up to 8)<input type="file" accept="image/*" data-wizard-product-images multiple></label>
          <div class="web-product-media-modes" role="group" aria-label="Product media type">
            <button type="button" class="btn-secondary" data-wizard-media-mode="image">Photos</button>
            <button type="button" class="btn-secondary" data-wizard-media-mode="spin">360° spin</button>
            <button type="button" class="btn-secondary" data-wizard-media-mode="video">Video</button>
            <button type="button" class="btn-secondary" data-wizard-media-mode="cutout">Cutout</button>
          </div>
          <div data-wizard-video-options hidden>
            <button type="button" class="btn-secondary" data-wizard-video-record>Record video</button>
            <button type="button" class="btn-secondary" data-wizard-video-pick>Pick video</button>
            <input type="file" accept="video/*" data-wizard-video-file hidden>
          </div>
          <div data-wizard-media-preview hidden></div>
          <p data-wizard-media-status role="status" aria-live="polite"></p>
        </div>
        <div class="studio-inline-actions">
          <button type="button" class="btn-secondary" id="website-wizard-cancel-product-edit" hidden>Cancel edit</button>
          <button type="submit" class="btn-primary">Add product</button>
        </div>
      </form>
      <div class="website-wizard-sticky-footer has-bottom-nav"><div>
        <a id="website-wizard-go-builder" class="btn-primary website-wizard-go-builder" href="${AppUtils.escapeHTML(litrusBuilderRoute)}" data-route="${AppUtils.escapeHTML(litrusBuilderRoute)}">Go to web builder</a>
      </div></div>
      <div style="height:190px" aria-hidden="true"></div>
      <section id="website-wizard-store-picker" class="studio-panel" hidden>
        <div class="studio-panel-heading"><h3>Choose products from Store</h3><button type="button" class="btn-secondary" id="website-wizard-store-close">Close</button></div>
        <input class="form-input" id="website-wizard-store-search" type="search" placeholder="Search Store products" aria-label="Search Store products">
        <select class="form-input" id="website-wizard-store-category" aria-label="Filter by Store category"><option value="all">All categories</option></select>
        <label><input type="checkbox" id="website-wizard-store-select-all"> Select all shown</label>
        <p class="studio-panel-note" id="website-wizard-store-count" role="status"></p>
        <div id="website-wizard-store-list"></div>
        <button type="button" class="btn-primary" id="website-wizard-import-store" disabled>Add selected from Store</button>
      </section>
    </section>`;
  },

  renderWebStudioWebsiteTool(page) {
    if (page.route === "/account/web/studio/websites/list") {
      return this.renderWebStudioWebsiteList();
    }
    if (page.route === "/account/web/studio/websites/webmaker") {
      return this.renderNewWebsiteProducts();
    }
    if (page.route === "/account/web/studio/websites/add") {
      const store = SQLiteEngine.getStore();
      const field = (name, label, type = "url", placeholder = "") => `<label class="form-field"><span class="form-label">${label}</span><input class="form-input" name="${name}" type="${type}" maxlength="500" value="${AppUtils.escapeHTML(store[name] || "")}" placeholder="${placeholder}" ${type === "url" ? 'inputmode="url"' : ""}></label>`;
      return `<section class="studio-workspace-section"><form id="website-additions-form" class="studio-panel">
        <span class="studio-workspace-kicker">CONTACT &amp; DISCOVERY</span><h2>Add to your website</h2>
        <p class="studio-panel-note">Saved links, enabled contact buttons, and the location map are injected into the footer across published themes.</p>
        <div class="studio-dashboard-grid">${field("phone", "Phone number", "tel", "+254…")}
        <label class="form-field"><span class="form-label">WhatsApp button</span><span><input type="checkbox" name="whatsapp_enabled" ${store.whatsapp_enabled ? "checked" : ""}> Enabled</span></label>
        ${field("whatsapp_url", "WhatsApp link", "url", "https://wa.me/254…")}
        <label class="form-field"><span class="form-label">Chatbot contact button</span><span><input type="checkbox" name="chatbot_enabled" ${store.chatbot_enabled ? "checked" : ""}> Enabled</span></label>
        ${field("chatbot_url", "Chatbot or chat-service URL", "url", "https://…")}
        ${field("instagram_url", "Instagram")}${field("facebook_url", "Facebook")}${field("tiktok_url", "TikTok")}${field("youtube_url", "YouTube")}${field("x_url", "X")}
        ${field("location_name", "Location name", "text", "Main shop")}${field("location_address", "Location address", "text", "Street, town, country")}
        ${field("location_map_embed_url", "Map embed URL (optional)", "url", "https://www.google.com/maps…")}${field("location_map_link", "Map directions link (optional)", "url", "https://maps.google.com…")}</div>
        <p class="studio-panel-note">If map URLs are blank, a map and directions link are created from the location address.</p>
        <p id="website-additions-status" role="status" aria-live="polite"></p>
        <div class="studio-inline-actions"><button class="btn-primary" type="submit">Save additions</button><button class="btn-secondary" type="button" data-additions-publish>Publish changes</button></div>
      </form><div id="product-modal-container"></div></section>`;
    }
    if (page.route === "/account/web/studio/websites/editor") {
      return `<section class="studio-workspace-section"><article class="studio-panel studio-feature-panel">
        <span class="studio-workspace-kicker">WEBSITE DESIGN</span><h2>Website editor</h2>
        <p>Design your storefront in Litrus Mixer: sections, products, colours and publishing.</p>
        <a class="btn-primary" href="/account/web/site?tenant=${encodeURIComponent(AppController.getActiveTenant().id)}" data-route="/account/web/site?tenant=${encodeURIComponent(AppController.getActiveTenant().id)}">Open Litrus Mixer</a>
      </article></section>`;
    }
    return `<p class="store-workspace-empty">This website screen is unavailable.</p>`;
  },

  renderWebStudioWorkspace(path) {
    const sections = this.webStudioNavigation();
    const page = this.webStudioPage(path);
    const showAnalyticsFilter = [
      "/account/web/studio/dashboard/visits",
      "/account/web/studio/dashboard/traffic"
    ].includes(path);
    const cachedSnapshot = this.getCachedMainShopSnapshot();
    const initialContent = page.section.title === "Websites"
      ? this.renderWebStudioWebsiteTool(page)
      : cachedSnapshot
      ? this.renderMainShopContent(path, cachedSnapshot)
      : this.renderWorkspaceLoading("Web Studio");
    AppUtils.updateSEO({ title: `${page.title} — Web Studio`, description: "Manage your website, visitors, customers, store, and payments." });
    return `
      <main class="container account-dashboard-main store-workspace-shell studio-workspace web-studio-shell" style="padding:16px 0 100px;">
        <header class="studio-workspace-heading">
          <a class="studio-workspace-back" href="/" data-route="/" data-home-screen aria-label="Back to Craft home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></a>
          <h1 class="studio-workspace-tab-title">${AppUtils.escapeHTML(page.title)}</h1>
          <div class="studio-workspace-header-actions">
            ${AppUtils.craftAccountSignedIn() ? "" : `<a href="/app-account" data-route="/app-account"
              class="btn-primary studio-signin-btn" title="Sign in to load orders, alerts and publishing">Sign in</a>`}
            ${showAnalyticsFilter ? `<button type="button" class="studio-analytics-filter-toggle" data-business-filter-toggle aria-label="Show filters" aria-controls="business-date-filters" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z"/></svg></button>` : ""}
            ${this.renderWorkspaceSidebar(`${page.section.title} screens`, page.section.tabs, page.route)}
          </div>
        </header>
        ${showAnalyticsFilter ? `<nav id="business-date-filters" class="bl-date-filter" aria-label="Analytics filters" hidden><label><span>Days</span><input class="business-filter" data-filter="analyticsDays" type="number" inputmode="numeric" min="1" max="365" value="${this.analyticsDays()}"></label></nav>` : ""}
        <section id="store-workspace-content" class="store-workspace-content studio-workspace-section" aria-live="polite" style="min-height:180px;padding-top:10px;">
          ${initialContent}
        </section>
        <nav class="studio-workspace-bottom-nav" aria-label="Web Studio sections">
          ${sections.map(section => `<a href="${section.route}" class="studio-workspace-bottom-link ${section.title === page.section.title ? "is-active" : ""}" data-route="${section.route}" ${section.title === page.section.title ? 'aria-current="page"' : ""}><span class="studio-nav-icon" aria-hidden="true">${section.icon}</span><span>${section.title}</span></a>`).join("")}
        </nav>
      </main>`;
  },

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

  renderSplitShop(snapshot, tenant) {
    const savedBySku = new Map();
    [...(snapshot.localAllocations || []), ...(snapshot.remoteAllocations || [])]
      .forEach(allocation => savedBySku.set(String(allocation.sku || ""), allocation));
    const rows = snapshot.products.map((product, index) => {
      const skuKey = String(product.sku || "").trim();
      const saved = skuKey ? savedBySku.get(skuKey) : null;
      const sources = [...product.sources];
      const posEnabled = saved ? Number(saved.pos_enabled) === 1 : sources.includes("POS");
      const webEnabled = saved ? Number(saved.web_enabled) === 1 : sources.includes("Website");
      const posStock = Number(saved?.pos_stock ?? product.posStock) || 0;
      const webStock = Number(saved?.web_stock ?? product.webStock) || 0;
      const needsMasterConfirmation = !saved && sources.includes("POS") && sources.includes("Website");
      const masterStock = needsMasterConfirmation ? null : Number(saved?.master_stock ?? (posStock + webStock)) || 0;
      const posPercent = masterStock ? (posStock / masterStock * 100) : (posEnabled && !needsMasterConfirmation ? 100 : 0);
      const webPercent = masterStock ? (webStock / masterStock * 100) : (webEnabled && !posEnabled && !needsMasterConfirmation ? 100 : 0);
      const source = posEnabled && webEnabled ? "both" : posEnabled ? "pos" : "web";
      return `<tr data-split-row data-product-index="${index}" data-sku="${AppUtils.escapeHTML(product.sku || "")}" data-name="${AppUtils.escapeHTML(product.name)}" data-product-id="${AppUtils.escapeHTML(String(product.posProductId || product.webProductId || ""))}" data-source="${source}">
        <td><input type="checkbox" aria-label="Select ${AppUtils.escapeHTML(product.name)}" data-split-select ${skuKey ? "" : "disabled"}></td>
        <td><strong>${AppUtils.escapeHTML(product.name)}</strong><small style="display:block;color:var(--text-muted)">${AppUtils.escapeHTML(product.sku || "SKU required")} · ${sources.map(sourceName => sourceName === "Website" ? "Web" : sourceName).join(" + ")}</small></td>
        <td><label><input type="checkbox" data-split-pos ${posEnabled ? "checked" : ""}> POS</label></td>
        <td><label><input type="checkbox" data-split-web ${webEnabled ? "checked" : ""}> Web</label></td>
        <td><input type="number" min="0" step="1" value="${masterStock ?? ""}" placeholder="${needsMasterConfirmation ? "Enter total" : ""}" data-split-master aria-label="Master stock for ${AppUtils.escapeHTML(product.name)}"></td>
        <td><label><input type="number" min="0" max="100" step="0.01" value="${posPercent.toFixed(2)}" data-split-pos-percent aria-label="POS allocation percent for ${AppUtils.escapeHTML(product.name)}">%</label><strong data-split-pos-quantity>${posStock}</strong></td>
        <td><label><input type="number" min="0" max="100" step="0.01" value="${webPercent.toFixed(2)}" data-split-web-percent aria-label="Web allocation percent for ${AppUtils.escapeHTML(product.name)}">%</label><strong data-split-web-quantity>${webStock}</strong></td>
        <td><strong data-split-reserved>${masterStock === null ? "Set total" : Math.max(0, masterStock - posStock - webStock)}</strong></td>
      </tr>`;
    }).join("");
    const remoteStatus = snapshot.remoteAllocationsError
      ? `Cloud allocation settings could not be loaded: ${AppUtils.escapeHTML(snapshot.remoteAllocationsError)}`
      : snapshot.remoteAllocations
        ? `${snapshot.remoteAllocations.length} saved cloud allocation${snapshot.remoteAllocations.length === 1 ? "" : "s"} loaded for ${AppUtils.escapeHTML(tenant.name || tenant.id)}.`
        : "Cloud allocation settings have not been loaded.";
    return `<section class="studio-workspace-section">
      <article class="studio-panel">
        <span class="studio-workspace-kicker">MAIN STORE · INVENTORY CONTROL</span>
        <h2>Split shop</h2>
        <p class="studio-panel-note">POS and Web products stay in their existing channels until you select and save them here. Allocate whole units from one master total; Reserved is the remainder and cannot be sold.</p>
        <p class="studio-panel-note" role="status" data-split-status>${remoteStatus}</p>
        <div class="studio-inline-actions" style="align-items:end;flex-wrap:wrap">
          <label>Bulk POS % <input type="number" min="0" max="100" step="0.01" value="70" data-split-bulk-pos></label>
          <label>Bulk Web % <input type="number" min="0" max="100" step="0.01" value="20" data-split-bulk-web></label>
          <button type="button" class="btn-secondary" data-split-apply-bulk>Apply to selected</button>
          <button type="button" class="btn-primary" data-split-save>Save selected allocations</button>
        </div>
        <label style="display:block;margin:12px 0"><input type="checkbox" data-split-select-all> Select all products with SKUs</label>
        <div style="overflow-x:auto"><table class="studio-data-table" style="width:100%;min-width:980px">
          <thead><tr><th>Select</th><th>Product</th><th>POS</th><th>Web</th><th>Master units</th><th>POS units</th><th>Web units</th><th>Reserved</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">No products are available. Add products in POS or Web first.</td></tr>`}</tbody>
        </table></div>
        <p class="studio-panel-note">Products without a SKU cannot be allocated. Giving a POS-only or Web-only product to the other channel will add it there when you save. After adding a new Web product, publish the website from Store → Products before customers can see it.</p>
      </article>
    </section>`;
  },

  bindSplitShopEvents(snapshot, path) {
    const container = document.getElementById("store-workspace-content");
    if (!container) return;
    const status = container.querySelector("[data-split-status]");
    const rows = [...container.querySelectorAll("[data-split-row]")];
    const recompute = row => {
      const masterInput = row.querySelector("[data-split-master]")?.value.trim() || "";
      const master = masterInput === "" ? Number.NaN : Number(masterInput);
      const posPercent = Number(row.querySelector("[data-split-pos-percent]")?.value);
      const webPercent = Number(row.querySelector("[data-split-web-percent]")?.value);
      const posEnabled = row.querySelector("[data-split-pos]")?.checked;
      const webEnabled = row.querySelector("[data-split-web]")?.checked;
      const pos = posEnabled ? Math.round(master * posPercent / 100) : 0;
      const web = webEnabled ? Math.min(
        Math.round(master * webPercent / 100), Math.max(0, master - pos)
      ) : 0;
      const valid = Number.isSafeInteger(master) && master >= 0
        && Number.isFinite(posPercent) && posPercent >= 0 && posPercent <= 100
        && Number.isFinite(webPercent) && webPercent >= 0 && webPercent <= 100
        && posPercent + webPercent <= 100.000001 && (posEnabled || webEnabled);
      row.querySelector("[data-split-pos-quantity]").textContent = Number.isSafeInteger(pos) ? String(pos) : "—";
      row.querySelector("[data-split-web-quantity]").textContent = Number.isSafeInteger(web) ? String(web) : "—";
      row.querySelector("[data-split-reserved]").textContent = Number.isSafeInteger(master)
        && Number.isSafeInteger(pos) && Number.isSafeInteger(web)
        ? String(Math.max(0, master - pos - web)) : "Set total";
      row.dataset.splitValid = valid ? "1" : "0";
      return valid;
    };
    const updateSelection = () => {
      const selectable = rows.filter(row => !row.querySelector("[data-split-select]").disabled);
      const checked = selectable.filter(row => row.querySelector("[data-split-select]").checked).length;
      const all = container.querySelector("[data-split-select-all]");
      if (all) {
        all.checked = selectable.length > 0 && checked === selectable.length;
        all.indeterminate = checked > 0 && checked < selectable.length;
      }
    };
    rows.forEach(row => {
      row.querySelector("[data-split-select]")?.addEventListener("change", updateSelection);
      row.querySelectorAll("[data-split-master], [data-split-pos-percent], [data-split-web-percent], [data-split-pos], [data-split-web]")
        .forEach(input => input.addEventListener("input", () => recompute(row)));
      recompute(row);
    });
    container.querySelector("[data-split-select-all]")?.addEventListener("change", event => {
      rows.forEach(row => {
        const select = row.querySelector("[data-split-select]");
        if (select && !select.disabled) select.checked = event.currentTarget.checked;
      });
      updateSelection();
    });
    container.querySelector("[data-split-apply-bulk]")?.addEventListener("click", () => {
      const posPercent = Number(container.querySelector("[data-split-bulk-pos]")?.value);
      const webPercent = Number(container.querySelector("[data-split-bulk-web]")?.value);
      if (!Number.isFinite(posPercent) || !Number.isFinite(webPercent)
        || posPercent < 0 || webPercent < 0 || posPercent > 100 || webPercent > 100
        || posPercent + webPercent > 100) {
        if (status) status.textContent = "Bulk POS and Web percentages must be between 0 and 100 and add up to no more than 100.";
        return;
      }
      rows.filter(row => row.querySelector("[data-split-select]")?.checked).forEach(row => {
        row.querySelector("[data-split-pos-percent]").value = String(posPercent);
        row.querySelector("[data-split-web-percent]").value = String(webPercent);
        recompute(row);
      });
      if (status) status.textContent = "Bulk percentages applied to selected products. Review the whole-unit quantities before saving.";
    });
    container.querySelector("[data-split-save]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const selectedRows = rows.filter(row => row.querySelector("[data-split-select]")?.checked);
      if (!selectedRows.length) {
        if (status) status.textContent = "Select at least one product to save.";
        return;
      }
      if (!selectedRows.every(recompute)) {
        if (status) status.textContent = "Fix the selected rows: channel percentages must total at most 100%, quantities must be whole units, and at least one channel must be enabled.";
        return;
      }
      button.disabled = true;
      if (status) status.textContent = "Preparing selected products and saving allocations…";
      try {
        const allocations = [];
        const localAllocations = [];
        for (const row of selectedRows) {
          const product = snapshot.products[Number(row.dataset.productIndex)];
          const sku = String(row.dataset.sku || "").trim();
          let posProduct = product?.posProduct;
          let webProduct = product?.webProduct;
          const posEnabled = row.querySelector("[data-split-pos]").checked;
          const webEnabled = row.querySelector("[data-split-web]").checked;
          if (!sku || !product) throw new Error("A selected product is missing its SKU or product record.");
          if (!posEnabled && !webEnabled) throw new Error(`${product.name} must belong to POS, Web, or both.`);
          if (posEnabled && !posProduct) {
            if (!product.webProductId) throw new Error(`Could not find the Web record for ${product.name}.`);
            await this.addWebsiteProductToPos(product.webProductId);
            posProduct = (await window.ShopPOS.listProducts()).find(item => String(item.sku || "") === sku);
          }
          if (webEnabled && !webProduct) {
            posProduct ||= (await window.ShopPOS.listProducts()).find(item => String(item.sku || "") === sku);
            if (!posProduct) throw new Error(`Could not find the POS record for ${product.name}.`);
            await this.publishPosProduct(posProduct);
            webProduct = SQLiteEngine.select("products").find(item => String(item.sku || "") === sku);
          }
          const master = Number(row.querySelector("[data-split-master]").value);
          const posStock = Number(row.querySelector("[data-split-pos-quantity]").textContent);
          const webStock = Number(row.querySelector("[data-split-web-quantity]").textContent);
          const reservedStock = master - posStock - webStock;
          const source = posEnabled && webEnabled ? "both" : posEnabled ? "pos" : "web";
          const productId = String(webProduct?.id || posProduct?.id || "");
          const record = {
            sku, product_id: productId, product_name: product.name,
            source_channel: source, pos_enabled: posEnabled, web_enabled: webEnabled,
            master_stock: master, pos_stock: posStock, web_stock: webStock,
            reserved_stock: reservedStock
          };
          allocations.push(record);
          localAllocations.push({ tenant_id: AppController.getActiveTenant().id, ...record, updated_at: new Date().toISOString() });
        }
        await window.EshopInventoryBridge.request(
          AppController.getActiveTenant().id, "allocations", "PUT", { allocations }
        );
        for (const allocation of localAllocations) {
          const existing = SQLiteEngine.select("main_store_inventory", item =>
            item.tenant_id === allocation.tenant_id && item.sku === allocation.sku)[0];
          if (existing) SQLiteEngine.update("main_store_inventory", item => item.id === existing.id, () => ({ ...allocation, id: existing.id }));
          else SQLiteEngine.insert("main_store_inventory", allocation);
          const webRecord = SQLiteEngine.select("products", item =>
            String(item.sku || "") === allocation.sku)[0];
          if (webRecord) SQLiteEngine.saveProduct({ ...webRecord, stock: allocation.web_enabled ? allocation.web_stock : 0 });
        }
        await window.ShopPOS.applyMainStoreAllocations(AppController.getActiveTenant().id, allocations);
        AppController.cacheActiveTenantCatalog();
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
        AppUtils.showToast(`${allocations.length} product allocation${allocations.length === 1 ? "" : "s"} saved.`);
      } catch (error) {
        console.error("Main Store allocations could not be saved.", error);
        if (status) status.textContent = error instanceof Error ? error.message : "The allocations could not be saved.";
        button.disabled = false;
      }
    });
    rows.forEach(recompute);
  },

  renderMainStoreProductManagement(snapshot) {
    const products = snapshot.products || [];
    const rows = products.map((product, index) => {
      const image = product.imageUri || product.webProduct?.images?.[0] || product.posProduct?.imageUri || "";
      return `<article class="main-store-product-row" data-main-product-row data-name="${AppUtils.escapeHTML(String(product.name || "").toLocaleLowerCase())}" data-sku="${AppUtils.escapeHTML(String(product.sku || "").toLocaleLowerCase())}" data-category="${AppUtils.escapeHTML(String(product.categoryName || "").trim().toLocaleLowerCase())}" data-price="${Number(product.price) || 0}" data-stock="${product.stock == null ? "" : Number(product.stock)}" data-index="${index}">
        ${image
          ? `<img src="${AppUtils.escapeHTML(image)}" alt="" loading="lazy">`
          : `<span class="main-store-product-image-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><circle cx="9" cy="10" r="2"/><path d="m4 16 5-4 3 2 3-3 5 5"/></svg></span>`}
        <div class="main-store-product-row-info">
          <strong title="${AppUtils.escapeHTML(product.name)}">${AppUtils.escapeHTML(product.name)}</strong>
          <span>${this.formatMainShopMoney(product.price, snapshot.currency || "KES")}</span>
        </div>
        <div class="main-store-product-actions">
          <button type="button" class="main-store-product-icon-button" data-main-product-edit="${index}" aria-label="Edit ${AppUtils.escapeHTML(product.name)}" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>
          <button type="button" class="main-store-product-icon-button" data-main-product-delete="${index}" aria-label="Delete ${AppUtils.escapeHTML(product.name)}" title="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>
        </div>
      </article>`;
    }).join("");
    return `<article class="bl-card main-store-product-manager">
      <header class="main-store-product-manager-header"><p>Add products or edit them in POS, Web, or both. Web changes need publishing to go live.</p><button type="button" data-main-product-add>Add product</button></header>
      <form class="main-store-product-form" data-main-store-product-form hidden>
        <input type="hidden" name="productIndex" value="">
        <div class="main-store-product-form-fields">
          <label>Product name<input name="name" maxlength="160" required></label>
          <label>Category<input name="category" maxlength="100" required></label>
          <label>Price<input name="price" type="number" min="0" step="0.01" required></label>
          <label>Cost price<input name="costPrice" type="number" min="0" step="0.01"></label>
          <label>Stock<input name="stock" type="number" min="0" step="1" required></label>
        </div>
        <div data-main-product-taxonomy></div>
        <div class="main-store-product-channels" aria-label="Save product to">
          <label><input type="checkbox" name="channels" value="pos" checked> POS</label>
          <label><input type="checkbox" name="channels" value="web" checked> Web</label>
        </div>
        <p class="main-store-product-status" data-main-product-status role="status" aria-live="polite"></p>
        <div class="main-store-product-actions"><button type="submit">Save product</button><button type="button" data-main-product-cancel>Cancel</button></div>
      </form>
      ${products.length ? `<div class="main-store-product-toolbar" data-main-product-toolbar>
        <input type="search" data-main-product-search placeholder="Search by name or SKU" aria-label="Search products" autocomplete="off">
        <select data-main-product-category-filter aria-label="Filter by category"><option value="">All categories</option>${[...new Map(products.map(product => [String(product.categoryName || "").trim().toLocaleLowerCase(), String(product.categoryName || "").trim()])).entries()]
          .filter(([key]) => key).sort((a, b) => a[1].localeCompare(b[1]))
          .map(([key, label]) => `<option value="${AppUtils.escapeHTML(key)}">${AppUtils.escapeHTML(label)}</option>`).join("")}</select>
        <select data-main-product-sort aria-label="Sort products"><option value="name">Name A to Z</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option><option value="stock-asc">Stock low to high</option></select>
        <p class="main-store-product-status" data-main-product-count role="status" aria-live="polite"></p>
      </div>` : ""}
      <div class="main-store-product-list" data-main-product-list>${rows || `<p class="bl-empty">No products yet. Add one to start your catalogue.</p>`}</div>
      <p class="bl-empty" data-main-product-empty hidden>No products match your search.</p>
    </article>`;
  },

  getMainStoreCategoryRecords(snapshot) {
    const categories = new Map();
    for (const category of SQLiteEngine.getCategories()) {
    const key = category.name.trim().toLocaleLowerCase();
    categories.set(key, { name: category.name, webCategory: category, posCategory: null });
    }
    for (const category of snapshot.posCategories || []) {
    const key = category.name.trim().toLocaleLowerCase();
    const record = categories.get(key) || { name: category.name, webCategory: null, posCategory: null };
    record.posCategory = category;
    categories.set(key, record);
    }
    return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  renderMainStoreCategories(snapshot) {
    const categories = this.getMainStoreCategoryRecords(snapshot);
    const rows = categories.map((category, index) => {
    const products = (snapshot.products || []).filter(product =>
      String(product.categoryName || "").trim().toLocaleLowerCase() === category.name.trim().toLocaleLowerCase()).length;
    const sources = [category.posCategory ? "Store" : "", category.webCategory ? "Web" : ""].filter(Boolean).join(" · ");
    const protectedCategory = category.name.toLocaleLowerCase() === "other";
    return `<article class="main-store-category-row">
      <div class="main-store-category-row-info">
        <strong title="${AppUtils.escapeHTML(category.name)}">${AppUtils.escapeHTML(category.name)}</strong>
        <span>${products} products · ${sources || "Store"}</span>
      </div>
      <div class="main-store-product-actions">
        <button type="button" class="main-store-product-icon-button" data-main-category-open="${index}" aria-label="Products in ${AppUtils.escapeHTML(category.name)}" title="View and move products"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg></button>
        <button type="button" class="main-store-product-icon-button" data-main-category-edit="${index}" aria-label="Edit ${AppUtils.escapeHTML(category.name)}" title="Edit category" ${protectedCategory ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>
        <button type="button" class="main-store-product-icon-button" data-main-category-delete="${index}" aria-label="Delete ${AppUtils.escapeHTML(category.name)}" title="Delete category" ${protectedCategory ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>
      </div>
    </article>`;
    }).join("");
    return `<article class="bl-card main-store-product-manager">
    <header class="main-store-product-manager-header"><p>Manage categories used by products in your Store and Web catalog.</p><button type="button" data-main-category-add>Add category</button></header>
    <form class="main-store-category-form" data-main-store-category-form hidden>
      <input type="hidden" name="originalName">
      <label>Category name<input name="name" maxlength="120" required></label>
      <p class="main-store-product-status" data-main-category-status role="status" aria-live="polite"></p>
      <div class="main-store-product-actions"><button type="submit">Save category</button><button type="button" data-main-category-cancel>Cancel</button></div>
    </form>
    <section class="main-store-category-contents" data-main-category-contents hidden>
      <header><strong data-category-contents-title></strong><button type="button" data-category-contents-close>Close</button></header>
      <div class="main-store-category-pick-list" data-category-contents-list></div>
      <div class="main-store-product-actions">
        <label class="main-store-category-pick"><input type="checkbox" data-category-select-all> Select all</label>
        <select data-category-move-target aria-label="Move selected products to"></select>
        <button type="button" data-category-move-selected disabled>Move selected</button>
      </div>
      <details>
        <summary>Add products from other categories</summary>
        <input type="search" data-category-add-search placeholder="Search products to add" aria-label="Search products to add" autocomplete="off">
        <div class="main-store-category-pick-list" data-category-add-list></div>
        <button type="button" data-category-add-selected disabled>Move selected here</button>
      </details>
      <p class="main-store-product-status" data-category-contents-status role="status" aria-live="polite"></p>
    </section>
    <div class="main-store-category-list">${rows || `<p class="bl-empty">No categories yet. Add one to organize your products.</p>`}</div>
    </article>`;
  },

  renderMainStoreManagement(path, snapshot) {
    const categoryTab = path.endsWith("/categories");
    const productsPath = "/store/manage/products";
    const categoriesPath = "/store/manage/categories";
    return `<nav class="main-store-management-tabs" aria-label="Store management">
    <a href="${productsPath}" data-route="${productsPath}" ${categoryTab ? "" : 'class="is-active" aria-current="page"'}>Products</a>
    <a href="${categoriesPath}" data-route="${categoriesPath}" ${categoryTab ? 'class="is-active" aria-current="page"' : ""}>Categories</a>
    </nav>
    <section class="main-store-management-content" aria-live="polite">
    ${categoryTab ? this.renderMainStoreCategories(snapshot) : this.renderMainStoreProductManagement(snapshot)}
    </section>`;
  },

  bindMainStoreCategories(container, snapshot, path) {
    const form = container.querySelector("[data-main-store-category-form]");
    if (!form) return;
    const status = form.querySelector("[data-main-category-status]");
    const originalField = form.querySelector('[name="originalName"]');
    const nameField = form.querySelector('[name="name"]');
    const categories = this.getMainStoreCategoryRecords(snapshot);
    const openForm = category => {
    form.reset();
    originalField.value = category?.name || "";
    nameField.value = category?.name || "";
    form.hidden = false;
    if (status) status.textContent = "";
    nameField.focus();
    };
    container.querySelector("[data-main-category-add]")?.addEventListener("click", () => openForm(null));
    container.querySelector("[data-main-category-cancel]")?.addEventListener("click", () => {
    form.reset();
    form.hidden = true;
    if (status) status.textContent = "";
    });
    container.querySelectorAll("[data-main-category-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const category = categories[Number(button.dataset.mainCategoryEdit)];
      if (category) openForm(category);
    });
    });
    form.addEventListener("submit", async event => {
    event.preventDefault();
    const name = nameField.value.trim();
    const originalName = originalField.value.trim();
    const original = originalName
      ? categories.find(category => category.name.trim().toLocaleLowerCase() === originalName.toLocaleLowerCase())
      : null;
    if (!name) {
      if (status) status.textContent = "Enter a category name.";
      return;
    }
    if (categories.some(category =>
      category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase() &&
      category.name.trim().toLocaleLowerCase() !== originalName.toLocaleLowerCase())) {
      if (status) status.textContent = `The category "${name}" already exists.`;
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    if (status) status.textContent = "Saving category…";
    try {
      if (original?.posCategory && original.name !== name) {
        await window.ShopPOS.renameCategory(original.posCategory.id, name);
      } else if (!original?.posCategory) {
        const posCategories = await window.ShopPOS.listCategories();
        if (!posCategories.some(category => category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
          await window.ShopPOS.createCategory(name);
        }
      }
      if (original?.webCategory) {
        SQLiteEngine.saveCategory({ id: original.webCategory.id, name });
      } else if (!original) {
        const webCategory = SQLiteEngine.getCategories().find(category =>
          category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!webCategory) SQLiteEngine.saveCategory({ name });
      }
      AppController.cacheActiveTenantCatalog();
      await window.ShopSQLite.flush();
      await this.loadMainShopWorkspace(path);
      AppUtils.showToast(original ? "Category updated." : "Category added.");
    } catch (error) {
      console.error("Store category could not be saved.", error);
      if (status) status.textContent = error instanceof Error ? error.message : "The category could not be saved.";
      submit.disabled = false;
    }
    });
    const panel = container.querySelector("[data-main-category-contents]");
    if (panel) {
      const key = value => String(value || "").trim().toLocaleLowerCase();
      const panelStatus = panel.querySelector("[data-category-contents-status]");
      const contentsList = panel.querySelector("[data-category-contents-list]");
      const addList = panel.querySelector("[data-category-add-list]");
      const moveTarget = panel.querySelector("[data-category-move-target]");
      const moveButton = panel.querySelector("[data-category-move-selected]");
      const addButton = panel.querySelector("[data-category-add-selected]");
      const addSearch = panel.querySelector("[data-category-add-search]");
      const selectAll = panel.querySelector("[data-category-select-all]");
      let openCategory = null;
      const pickRow = (product, index) =>
        `<label class="main-store-category-pick"><input type="checkbox" value="${index}"> <span>${AppUtils.escapeHTML(product.name)}${product.categoryName ? ` · ${AppUtils.escapeHTML(product.categoryName)}` : ""}</span></label>`;
      const checked = list => [...list.querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value));
      const refreshButtons = () => {
        moveButton.disabled = !checked(contentsList).length || !moveTarget.value;
        addButton.disabled = !checked(addList).length;
      };
      const renderPanel = () => {
        if (!openCategory) return;
        const products = snapshot.products || [];
        const inside = products.map((product, index) => ({ product, index }))
          .filter(entry => key(entry.product.categoryName) === key(openCategory.name));
        panel.querySelector("[data-category-contents-title]").textContent = `${openCategory.name} (${inside.length})`;
        contentsList.innerHTML = inside.map(entry => pickRow(entry.product, entry.index)).join("")
          || `<p class="bl-empty">No products in this category yet.</p>`;
        const query = key(addSearch.value);
        addList.innerHTML = products.map((product, index) => ({ product, index }))
          .filter(entry => key(entry.product.categoryName) !== key(openCategory.name)
            && (!query || key(entry.product.name).includes(query) || key(entry.product.sku).includes(query)))
          .slice(0, 100).map(entry => pickRow(entry.product, entry.index)).join("")
          || `<p class="bl-empty">No other products found.</p>`;
        moveTarget.innerHTML = `<option value="">Move to…</option>${categories
          .map((category, index) => ({ category, index }))
          .filter(entry => key(entry.category.name) !== key(openCategory.name))
          .map(entry => `<option value="${entry.index}">${AppUtils.escapeHTML(entry.category.name)}</option>`).join("")}`;
        selectAll.checked = false;
        refreshButtons();
      };
      const moveProducts = async (indexes, target) => {
        const items = indexes.map(index => snapshot.products[index]).filter(Boolean);
        if (!items.length || !target) return;
        panelStatus.textContent = `Moving ${items.length} product${items.length === 1 ? "" : "s"} to ${target.name}…`;
        moveButton.disabled = true;
        addButton.disabled = true;
        try {
          let posCategory = target.posCategory;
          let webCategory = target.webCategory;
          if (!posCategory && items.some(product => product.posProduct)) {
            await window.ShopPOS.addCategory(target.name);
            posCategory = (await window.ShopPOS.listCategories()).find(item => key(item.name) === key(target.name));
            if (!posCategory) throw new Error(`Could not create POS category "${target.name}".`);
          }
          if (!webCategory && items.some(product => product.webProduct)) {
            SQLiteEngine.saveCategory({ name: target.name });
            webCategory = SQLiteEngine.getCategories().find(item => key(item.name) === key(target.name));
            if (!webCategory) throw new Error(`Could not create Web category "${target.name}".`);
          }
          for (const product of items) {
            if (product.posProduct) {
              await window.ShopPOS.saveProduct({ ...product.posProduct, id: Number(product.posProduct.id), categoryId: posCategory.id });
            }
            if (product.webProduct) {
              SQLiteEngine.saveProduct({ ...product.webProduct, id: product.webProduct.id, category_id: webCategory.id });
            }
          }
          AppController.cacheActiveTenantCatalog();
          await window.ShopSQLite.flush();
          await this.loadMainShopWorkspace(path);
          AppUtils.showToast(`${items.length} product${items.length === 1 ? "" : "s"} moved to ${target.name}.`);
        } catch (error) {
          console.error("Store products could not be moved.", error);
          panelStatus.textContent = error instanceof Error ? error.message : "The products could not be moved.";
          refreshButtons();
        }
      };
      container.querySelectorAll("[data-main-category-open]").forEach(button => {
        button.addEventListener("click", () => {
          openCategory = categories[Number(button.dataset.mainCategoryOpen)] || null;
          if (!openCategory) return;
          addSearch.value = "";
          panelStatus.textContent = "";
          panel.hidden = false;
          renderPanel();
          panel.scrollIntoView?.({ block: "nearest" });
        });
      });
      panel.querySelector("[data-category-contents-close]").addEventListener("click", () => {
        panel.hidden = true;
        openCategory = null;
      });
      selectAll.addEventListener("change", () => {
        contentsList.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = selectAll.checked; });
        refreshButtons();
      });
      contentsList.addEventListener("change", refreshButtons);
      addList.addEventListener("change", refreshButtons);
      moveTarget.addEventListener("change", refreshButtons);
      addSearch.addEventListener("input", renderPanel);
      moveButton.addEventListener("click", () =>
        moveProducts(checked(contentsList), categories[Number(moveTarget.value)]));
      addButton.addEventListener("click", () => moveProducts(checked(addList), openCategory));
    }
    container.querySelectorAll("[data-main-category-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      const category = categories[Number(button.dataset.mainCategoryDelete)];
      if (!category) {
        AppUtils.showToast("That category is no longer available. Refresh the Store screen.", "danger");
        return;
      }
      if (!window.confirm(`Delete "${category.name}"? Products in the POS catalog will move to Other.`)) return;
      button.disabled = true;
      try {
        if (category.posCategory) await window.ShopPOS.deleteCategory(category.posCategory.id);
        if (category.webCategory) SQLiteEngine.deleteCategory(category.webCategory.id);
        AppController.cacheActiveTenantCatalog();
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
        AppUtils.showToast("Category deleted.");
      } catch (error) {
        console.error("Store category could not be deleted.", error);
        AppUtils.showToast(error instanceof Error ? error.message : "The category could not be deleted.", "danger");
        button.disabled = false;
      }
    });
    });
  },

  bindMainStoreProductManagement(container, snapshot, path) {
    const form = container.querySelector("[data-main-store-product-form]");
    if (!form) return;
    const status = form.querySelector("[data-main-product-status]");
    const editField = form.querySelector('[name="productIndex"]');
    const fields = Object.fromEntries(["name", "category", "price", "costPrice", "stock"]
      .map(name => [name, form.querySelector(`[name="${name}"]`)]));
    const channelInputs = [...form.querySelectorAll('[name="channels"]')];
    const taxonomyHost = form.querySelector("[data-main-product-taxonomy]");
    // The Category text input above owns name="category"; the picker must not render a second category select.
    const renderTaxonomy = product => {
      if (!taxonomyHost || !window.EshopProductTaxonomy) return;
      const web = product?.webProduct;
      const pos = product?.posProduct;
      taxonomyHost.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
        categoryId: web?.taxonomy_category_id || pos?.taxonomyCategoryId || "",
        categoryName: web?.taxonomy_category_name || "",
        customCategory: web?.taxonomy_custom_category || pos?.taxonomyCustomCategory || "",
        attributes: web?.taxonomy_attributes?.length ? web.taxonomy_attributes : pos?.taxonomyAttributes || [],
        storeCategoryFieldName: ""
      });
      window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyHost);
    };
    const readTaxonomy = () => taxonomyHost?.firstElementChild && window.EshopProductTaxonomy
      ? window.EshopProductTaxonomy.readProductTaxonomyFields(form)
      : null;
    renderTaxonomy(null);
    const openForm = (product, index) => {
      form.reset();
      renderTaxonomy(product);
      editField.value = index == null ? "" : String(index);
      fields.name.value = product?.name || "";
      fields.category.value = product?.categoryName || "Uncategorized";
      fields.price.value = product?.price == null ? "" : String(product.price);
      fields.costPrice.value = product?.costPrice == null ? "" : String(product.costPrice);
      fields.stock.value = product?.stock == null ? "0" : String(product.stock);
      channelInputs.forEach(input => {
        input.checked = product
          ? input.value === "pos" ? Boolean(product.posProductId) : Boolean(product.webProductId)
          : true;
      });
      if (status) status.textContent = "";
      form.hidden = false;
      fields.name.focus();
    };

    const searchInput = container.querySelector("[data-main-product-search]");
    const filterSelect = container.querySelector("[data-main-product-category-filter]");
    const sortSelect = container.querySelector("[data-main-product-sort]");
    const productList = container.querySelector("[data-main-product-list]");
    const countLine = container.querySelector("[data-main-product-count]");
    const emptyLine = container.querySelector("[data-main-product-empty]");
    const applyProductView = () => {
      if (!productList) return;
      const query = String(searchInput?.value || "").trim().toLocaleLowerCase();
      const category = filterSelect?.value || "";
      const rows = [...productList.querySelectorAll("[data-main-product-row]")];
      const sorters = {
        name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
        "price-asc": (a, b) => Number(a.dataset.price) - Number(b.dataset.price),
        "price-desc": (a, b) => Number(b.dataset.price) - Number(a.dataset.price),
        // Untracked stock (blank) sorts last.
        "stock-asc": (a, b) => (a.dataset.stock === "" ? Infinity : Number(a.dataset.stock))
          - (b.dataset.stock === "" ? Infinity : Number(b.dataset.stock))
      };
      const sorter = sorters[sortSelect?.value] || sorters.name;
      rows.sort((a, b) => sorter(a, b) || Number(a.dataset.index) - Number(b.dataset.index))
        .forEach(row => productList.appendChild(row));
      let shown = 0;
      rows.forEach(row => {
        const match = (!query || row.dataset.name.includes(query) || row.dataset.sku.includes(query))
          && (!category || row.dataset.category === category);
        row.hidden = !match;
        if (match) shown += 1;
      });
      if (countLine) countLine.textContent = rows.length ? `Showing ${shown} of ${rows.length} products` : "";
      if (emptyLine) emptyLine.hidden = !rows.length || shown > 0;
    };
    searchInput?.addEventListener("input", applyProductView);
    filterSelect?.addEventListener("change", applyProductView);
    sortSelect?.addEventListener("change", applyProductView);
    applyProductView();

    container.querySelector("[data-main-product-add]")?.addEventListener("click", () => openForm(null, null));
    container.querySelector("[data-main-product-cancel]")?.addEventListener("click", () => {
      form.reset();
      form.hidden = true;
      if (status) status.textContent = "";
    });
    container.querySelectorAll("[data-main-product-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.mainProductEdit);
        const product = snapshot.products[index];
        if (!product) {
          AppUtils.showToast("That product is no longer available. Refresh the Store screen.", "danger");
          return;
        }
        openForm(product, index);
      });
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const values = new FormData(form);
      const productIndex = String(values.get("productIndex") || "");
      const editingIndex = productIndex === "" ? -1 : Number(productIndex);
      const original = editingIndex < 0 ? null : snapshot.products[editingIndex];
      if (productIndex !== "" && !original) {
        if (status) status.textContent = "That product is no longer available. Refresh the Store screen and try again.";
        return;
      }
      const name = String(values.get("name") || "").trim();
      const categoryName = String(values.get("category") || "").trim();
      let sku = original?.sku || "";
      const price = Number(values.get("price"));
      const costText = String(values.get("costPrice") || "").trim();
      const costPrice = costText === "" ? null : Number(costText);
      const stock = Number(values.get("stock"));
      const channels = new Set(values.getAll("channels").map(String));
      const writePos = channels.has("pos");
      const writeWeb = channels.has("web");
      const taxonomy = readTaxonomy();
      let webSaved = false;
      let posSaved = false;

      if (!name || !categoryName || !Number.isFinite(price) || price < 0 ||
        (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
        !Number.isSafeInteger(stock) || stock < 0 || (!writePos && !writeWeb)) {
        if (status) status.textContent = "Enter a product name, category, valid prices and stock, and select POS or Web.";
        return;
      }
      if (!sku) {
        const existingSkus = new Set(snapshot.products.map(product => String(product.sku || "").toLocaleUpperCase()));
        do {
          sku = SQLiteEngine.generateProductSku();
        } while (existingSkus.has(sku.toLocaleUpperCase()));
      }
      if (sku && snapshot.products.some((product, index) =>
        index !== editingIndex && String(product.sku || "").toLocaleUpperCase() === sku.toLocaleUpperCase())) {
        if (status) status.textContent = "That SKU is already used by another catalogue product.";
        return;
      }

      submit.disabled = true;
      if (status) status.textContent = "Saving product…";
      try {
        let posProducts = await window.ShopPOS.listProducts();
        let posProduct = original?.posProductId
          ? posProducts.find(item => Number(item.id) === Number(original.posProductId))
          : sku ? posProducts.find(item => String(item.sku || "").toLocaleUpperCase() === sku.toLocaleUpperCase()) : null;
        let webProduct = original?.webProductId
          ? SQLiteEngine.getProductById(original.webProductId)
          : sku ? SQLiteEngine.select("products").find(item => String(item.sku || "").toLocaleUpperCase() === sku.toLocaleUpperCase()) : null;

        const ensurePosCategory = async () => {
          let category = (await window.ShopPOS.listCategories()).find(item =>
            item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          if (!category) {
            await window.ShopPOS.addCategory(categoryName);
            category = (await window.ShopPOS.listCategories()).find(item =>
              item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          }
          if (!category) throw new Error(`Could not create POS category "${categoryName}".`);
          return category;
        };
        const ensureWebCategory = () => {
          let category = SQLiteEngine.getCategories().find(item =>
            item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          if (!category) {
            SQLiteEngine.saveCategory({ name: categoryName });
            category = SQLiteEngine.getCategories().find(item =>
              item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
          }
          if (!category) throw new Error(`Could not create Web category "${categoryName}".`);
          return category;
        };
        const saveWebProduct = () => {
          const category = ensureWebCategory();
          webProduct = SQLiteEngine.saveProduct({
            ...(webProduct || {}),
            ...(webProduct ? { id: webProduct.id } : {}),
            name, sku: sku || webProduct?.sku || "", category_id: category.id,
            price, cost_price: costPrice ?? 0, stock,
            ...(taxonomy ? {
              taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
              taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
              taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
              taxonomy_attributes: taxonomy.taxonomyAttributes
            } : {}),
            images: webProduct?.images || [], status: webProduct?.status || "active"
          });
          sku = String(webProduct.sku || sku);
          webSaved = true;
        };
        const savePosProduct = async () => {
          const category = await ensurePosCategory();
          const id = await window.ShopPOS.saveProduct({
            ...(posProduct || {}),
            id: Number(posProduct?.id) || 0,
            name, sku: sku || posProduct?.sku || "", categoryId: category.id,
            price, buyingPrice: costPrice == null ? "" : costPrice, stock,
            imageUri: posProduct?.imageUri || webProduct?.images?.[0] || "",
            ...(taxonomy ? {
              taxonomyCategoryId: taxonomy.taxonomyCategoryId || "",
              taxonomyCustomCategory: taxonomy.taxonomyCustomCategory || "",
              taxonomyAttributes: taxonomy.taxonomyAttributes
            } : {}),
            lowStockThreshold: Number(posProduct?.lowStockThreshold) || 3
          });
          posProducts = await window.ShopPOS.listProducts();
          posProduct = posProducts.find(item => Number(item.id) === Number(id));
          if (!posProduct) throw new Error("The POS product saved, but could not be reloaded.");
          sku = String(posProduct.sku || sku);
          posSaved = true;
        };

        if (writeWeb && writePos && webProduct) saveWebProduct();
        if (writePos) {
          if (!posProduct && webProduct) {
            await this.addWebsiteProductToPos(Number(webProduct.id));
            posProducts = await window.ShopPOS.listProducts();
            posProduct = posProducts.find(item => String(item.sku || "") === String(webProduct.sku || ""));
          }
          await savePosProduct();
        }
        if (writeWeb && writePos) {
          await this.publishPosProduct(posProduct);
          if (taxonomy) {
            // publishPosProduct keeps the old web taxonomy when POS has none, so write the chosen value explicitly.
            const published = SQLiteEngine.select("products").find(item => String(item.sku || "") === String(posProduct.sku || ""));
            if (published) {
              SQLiteEngine.saveProduct({
                ...published, id: published.id,
                taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
                taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
                taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
                taxonomy_attributes: taxonomy.taxonomyAttributes
              });
              AppController.cacheActiveTenantCatalog();
              await window.ShopSQLite.flush();
            }
          }
          webSaved = true;
        } else if (writeWeb) {
          saveWebProduct();
          AppController.cacheActiveTenantCatalog();
          await window.ShopSQLite.flush();
          await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, webProduct.sku, stock);
        }
        await this.loadMainShopWorkspace(path);
        AppUtils.showToast("Product saved to the selected catalogue.");
      } catch (error) {
        console.error("Main Store product could not be saved.", error);
        const detail = error instanceof Error ? error.message : "Product could not be saved.";
        if (status) {
          status.textContent = webSaved && !posSaved
            ? `The Web copy was saved, but POS could not be updated: ${detail}`
            : posSaved && !webSaved
              ? `POS was saved, but Web could not be updated: ${detail}`
              : detail;
        }
        submit.disabled = false;
      }
    });

    container.querySelectorAll("[data-main-product-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const index = Number(button.dataset.mainProductDelete);
        const product = snapshot.products[index];
        if (!product) {
          AppUtils.showToast("That product is no longer available. Refresh the Store screen.", "danger");
          return;
        }
        const posId = Number(product.posProductId) || 0;
        const webId = Number(product.webProductId) || 0;
        const destinations = [posId ? "POS" : "", webId ? "Web" : ""].filter(Boolean).join(" and ");
        if (!window.confirm(`Delete "${product.name}" from ${destinations}? Recorded sales will remain.`)) return;
        button.disabled = true;
        const removed = [];
        try {
          if (posId) {
            await window.ShopPOS.deleteProduct(posId);
            removed.push("POS");
          }
          if (webId) {
            SQLiteEngine.deleteProduct(webId);
            removed.push("Web");
            AppController.cacheActiveTenantCatalog();
            await window.ShopSQLite.flush();
          }
          await this.loadMainShopWorkspace(path);
          AppUtils.showToast(`"${product.name}" was deleted from ${destinations}.`);
        } catch (error) {
          console.error("Main Store product could not be deleted from all selected channels.", error);
          const detail = error instanceof Error ? error.message : "Product could not be deleted.";
          AppUtils.showToast(
            removed.length ? `Removed from ${removed.join(" and ")}, but deletion was incomplete: ${detail}` : detail,
            "danger"
          );
          button.disabled = false;
        }
      });
    });
  },

  manualPaymentLabel(method) {
    return ({ cash: "Cash", mobile_money: "Mobile money", bank: "Bank transfer", other: "Other", paystack: "Paystack" })[method] || String(method || "");
  },

  orderAttentionText(reason) {
    const text = String(reason || "");
    const stock = text.match(/^insufficient_stock:(.*)$/);
    if (stock) {
      return `Paid, but stock ran short${stock[1] ? ` for ${stock[1].split(",").join(", ")}` : ""}. Contact the customer or restock.`;
    }
    if (text.startsWith("paid_after_cancel")) {
      return "The customer paid for an order you cancelled. Refund the customer or reopen the order.";
    }
    if (text.startsWith("duplicate_payment")) {
      return "This order was marked paid by hand and the customer also paid online. Refund one of the payments.";
    }
    return `This order needs your attention${text ? ` (${text})` : ""}.`;
  },

  renderRemoteOrderRow(order, currency) {
    const escape = AppUtils.escapeHTML;
    const orderNumber = escape(order.order_number);
    const orderCurrency = order.currency || currency;
    const paid = order.payment_status === "paid";
    const cancelled = order.status === "cancelled";
    const attention = order.needs_attention === true;
    const discountAmount = Number(order.discount) || 0;
    const paymentLabel = paid
      ? `paid${order.payment_method ? ` via ${this.manualPaymentLabel(order.payment_method)}` : ""}${order.payment_method && order.payment_reference ? ` (ref ${order.payment_reference})` : ""}`
      : order.payment_status || "unpaid";
    return `<article class="studio-list-row studio-order-card studio-online-order-card" data-online-order-row${attention ? " data-needs-attention" : ""}>
      <div class="studio-order-header"><div><strong>${orderNumber}</strong><span>${escape(order.customer_name || "Customer not recorded")} · ${escape(order.customer_email || "No email")} · ${escape(AppUtils.formatDateTime(order.created_at))}</span></div><strong class="studio-order-total">${this.formatMainShopMoney(order.total, orderCurrency)}</strong></div>
      <div class="studio-order-items">${(order.items || []).map(item => `${escape(item.name)} × ${Number(item.quantity) || 0}`).join(" · ") || "No item details"}</div>
      <div class="studio-order-meta"><span>Payment: ${escape(paymentLabel)}</span><span>Status: ${escape(order.status || "pending")}</span>${discountAmount > 0 ? `<span>Discount${order.discount_code ? ` (${escape(order.discount_code)})` : ""}: -${this.formatMainShopMoney(discountAmount, orderCurrency)}</span>` : ""}</div>
      ${attention ? `<p class="studio-panel-note" role="alert" data-order-attention><strong>Needs attention.</strong> ${escape(this.orderAttentionText(order.attention_reason))}</p>` : ""}
      <div class="studio-order-controls"><label>Status<select data-online-order-status="${orderNumber}">${["pending", "confirmed", "processing", "ready", "fulfilled", "cancelled"].map(status => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
        <button type="button" class="btn-secondary" data-online-order-update="${orderNumber}">Save status</button></div>
      ${!paid && !cancelled ? `<div class="studio-order-controls"><label>Payment received<select data-online-order-pay-method>${["cash", "mobile_money", "bank", "other"].map(method => `<option value="${method}">${escape(this.manualPaymentLabel(method))}</option>`).join("")}</select></label>
        <button type="button" class="btn-secondary" data-online-order-pay="${orderNumber}">Mark paid</button></div>
        <div class="studio-order-controls" style="grid-template-columns:minmax(0,1fr)"><label>Payment reference (optional)<input data-online-order-pay-ref maxlength="120" autocomplete="off"></label></div>` : ""}
      </article>`;
  },

  renderOrderAttentionSummary(orders) {
    const flagged = (orders || []).filter(order => order.needs_attention === true);
    return flagged.length
      ? `<p class="studio-panel-note" role="alert" data-orders-attention><strong>${flagged.length} order${flagged.length === 1 ? "" : "s"} need${flagged.length === 1 ? "s" : ""} attention:</strong> ${flagged.map(order => AppUtils.escapeHTML(order.order_number)).join(", ")}</p>`
      : "";
  },

  renderOwnerAlertsPanel(snapshot) {
    const escape = AppUtils.escapeHTML;
    const alerts = snapshot.remoteAlerts;
    const rows = (alerts?.notifications || []).map(alert => {
      const route = this.ownerAlertRoute(alert.kind);
      return `<article class="studio-list-row" data-owner-alert="${escape(alert.id)}" data-owner-alert-kind="${escape(alert.kind || "")}"><div><strong>${escape(alert.title)}</strong><span>${escape(alert.body)}</span><small>${escape(this.ownerAlertKindLabel(alert.kind))} · ${escape(alert.created_at || "")}${route ? ` · <a href="${route}" data-route="${route}">Open appointments</a>` : ""}</small></div><div class="studio-row-end"><span>${alert.read_at ? "" : "New"}</span></div></article>`;
    }).join("");
    const note = snapshot.remoteAlertsError
      ? escape(snapshot.remoteAlertsError)
      : alerts ? `${alerts.unread_count} unread alert${alerts.unread_count === 1 ? "" : "s"}.` : "New orders, booking requests, holds and payments that need attention appear here.";
    return `<article class="studio-panel" data-owner-alerts-panel><div class="studio-panel-heading"><h2>Shop alerts</h2><button type="button" class="btn-secondary studio-load-button" data-owner-alerts-load aria-label="Load shop alerts">Load</button></div>
      <p class="studio-panel-note" data-owner-alerts-status>${note}</p>
      ${rows || `<p class="store-workspace-empty">No shop alerts loaded.</p>`}
      ${alerts?.unread_count ? `<button type="button" class="btn-secondary" data-owner-alerts-read-all>Mark all read</button>` : ""}</article>`;
  },

  renderDiscountPanel(snapshot) {
    const escape = AppUtils.escapeHTML;
    const currency = snapshot.currency || "KES";
    const discounts = Array.isArray(snapshot.remoteDiscounts) ? snapshot.remoteDiscounts : [];
    const rows = discounts.map(discount => {
      const offer = discount.type === "percent"
        ? `${Number(discount.value)}% off`
        : `${this.formatMainShopMoney(Number(discount.value) / 100, currency)} off`;
      const details = [
        offer,
        discount.min_order_cents ? `min spend ${this.formatMainShopMoney(Number(discount.min_order_cents) / 100, currency)}` : "",
        `used ${Number(discount.used_count) || 0}${discount.usage_limit == null ? "" : ` of ${Number(discount.usage_limit)}`}`,
        discount.ends_at ? `expires ${String(discount.ends_at).slice(0, 10)}` : "",
        discount.active ? "active" : "disabled"
      ].filter(Boolean).join(" · ");
      const code = escape(discount.code);
      return `<article class="studio-list-row" data-discount-row="${code}"><div><strong>${code}</strong><span>${escape(details)}</span></div><div class="studio-row-end">
        <button type="button" class="btn-secondary" data-discount-toggle="${code}" data-discount-active="${discount.active ? "1" : "0"}">${discount.active ? "Disable" : "Enable"}</button>
        <button type="button" class="btn-secondary" data-discount-delete="${code}">Delete</button></div></article>`;
    }).join("");
    const note = snapshot.remoteDiscountsError
      ? escape(snapshot.remoteDiscountsError)
      : snapshot.remoteDiscounts ? `${discounts.length} discount code${discounts.length === 1 ? "" : "s"}. Customers enter a code at checkout; shipping is never discounted.` : "Create codes customers can enter at checkout.";
    return `<article class="studio-panel" data-discounts-panel><div class="studio-panel-heading"><h2>Discount codes</h2><button type="button" class="btn-secondary studio-load-button" data-discounts-load aria-label="Load discount codes">Load</button></div>
      <p class="studio-panel-note" data-discounts-status>${note}</p>
      <form class="store-workspace-form" data-discount-form>
        <label>Code<input name="code" required minlength="2" maxlength="32" pattern="[A-Za-z0-9_\\-]{2,32}" autocomplete="off"></label>
        <label>Type<select name="type"><option value="percent">Percent off</option><option value="fixed">Fixed amount off (${escape(currency)})</option></select></label>
        <label>Value (percent, or amount in ${escape(currency)})<input name="value" type="number" min="1" step="any" required></label>
        <label>Minimum spend in ${escape(currency)} (optional)<input name="min_order" type="number" min="0" step="any"></label>
        <label>Expires on (optional)<input name="ends_at" type="date"></label>
        <label>Usage limit (optional)<input name="usage_limit" type="number" min="1" step="1"></label>
        <button type="submit" class="btn-primary">Add discount code</button>
        <p role="status" aria-live="polite"></p>
      </form>
      ${rows || `<p class="store-workspace-empty">No discount codes loaded.</p>`}</article>`;
  },

  // ----- Owner appointments (service shops). Contract: cloudflare/STOREFRONT_COMMERCE.md "Service bookings". -----
  serviceAppointmentFilters() {
    // `query` is sent to GET /api/service-appointments; `clientFilter` narrows what the Worker cannot filter.
    return [
      { key: "upcoming", label: "Upcoming", query: { view: "upcoming", status: "pending,confirming,confirmed" } },
      { key: "pending", label: "Waiting for your answer", query: { view: "upcoming", status: "pending" } },
      { key: "past", label: "Past", query: { view: "past" } },
      { key: "refunds", label: "Deposits to refund", query: { view: "all", status: "cancelled", limit: 200 }, clientFilter: appointment => appointment.deposit_refund_due === true },
      { key: "cancelled", label: "Cancelled or declined", query: { view: "all", status: "cancelled,rejected" } },
      { key: "all", label: "All", query: { view: "all" } }
    ];
  },

  serviceAppointmentFilter(key) {
    const filters = this.serviceAppointmentFilters();
    return filters.find(filter => filter.key === key) || filters[0];
  },

  serviceAppointmentErrorText(error, fallback = "Could not update this appointment.") {
    const code = error && typeof error === "object" ? String(error.code || "") : "";
    const status = error && typeof error === "object" ? Number(error.status) || 0 : 0;
    const messages = {
      unauthorized: "Your sign-in for this shop has expired. Sign in again, then retry.",
      appointment_not_found: "This appointment no longer exists. Reload the list.",
      invalid_state: "This appointment cannot be changed that way any more. Reload the list to see its current status.",
      not_started: "You can mark an appointment completed or no-show only after its start time.",
      appointment_started: "This appointment has already started, so it can no longer be moved, declined or cancelled. Mark it completed or no-show instead.",
      appointment_busy: "A deposit link is still being created for this appointment. Wait a moment, then try again.",
      slot_unavailable: "That time is not available (outside opening hours, in the past, or fully booked). Choose another time.",
      slot_unchanged: "That is already the time of this appointment. Choose a different time.",
      appointment_changed: "The appointment was changed while you were working (for example the customer moved it). The list has been reloaded. Check it, then try again.",
      deposit_unavailable: "A deposit link cannot be created yet. Finish Paystack setup for this shop (KES, with a ready payout account) or set the deposit to 0%, then confirm again.",
      service_unavailable: "This service is no longer in your published catalogue.",
      invalid_request: "The request was not accepted. Reload the list and try again.",
      too_large: "The request was too large. Shorten the reason and try again.",
      payment_provider_error: "Paystack did not return a payment link. The appointment is still waiting; try again in a moment.",
      rate_limited: "Too many requests. Wait a minute, then try again.",
      storage_unavailable: "The shop's booking storage is unavailable right now. Try again shortly."
    };
    if (messages[code]) return messages[code];
    if (status === 401) return messages.unauthorized;
    if (status === 429) return messages.rate_limited;
    return (error instanceof Error && error.message) || fallback;
  },

  serviceAppointmentStatusLabel(appointment) {
    if (appointment.expired === true) return "Expired";
    return ({
      pending: "Waiting for you", confirming: "Creating deposit link", confirmed: "Confirmed",
      rejected: "Declined", cancelled: "Cancelled", completed: "Completed", no_show: "No-show"
    })[appointment.status] || String(appointment.status || "pending");
  },

  serviceAppointmentLocalDate(isoTime, timeZone) {
    try {
      return new Date(isoTime).toLocaleDateString("en-CA", { timeZone: timeZone || undefined });
    } catch {
      return String(isoTime || "").slice(0, 10);
    }
  },

  // Shop-local date (YYYY-MM-DD) and time (HH:MM) to a UTC ISO string, or "" when it cannot be resolved.
  serviceAppointmentLocalToIso(date, time, timeZone) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
    const t = /^(\d{2}):(\d{2})$/.exec(String(time || ""));
    if (!d || !t) return "";
    const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone || undefined, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
      const offsetAt = ms => {
        const p = Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
        return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
      };
      let guess = wall - offsetAt(wall);
      guess = wall - offsetAt(guess);
      return guess + offsetAt(guess) === wall ? new Date(guess).toISOString() : "";
    } catch {
      return "";
    }
  },

  // One Orders screen for the whole shop. The counter, the website and the booking diary used to be
  // three separate lists in two different shells that disagreed about the same day's takings. The
  // till keeps its own fast screens; this is where the owner sees everything together.
  renderUnifiedOrderList(snapshot, sales, currency) {
    const escape = AppUtils.escapeHTML;
    const time = value => {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const entries = [];
    for (const sale of sales || []) {
      const counter = !/web/i.test(String(sale.channel || ""));
      entries.push({
        at: time(sale.date),
        channel: counter ? "counter" : "website",
        html: `<article class="studio-list-row studio-order-card"><div><strong>${escape(sale.reference)}</strong><span>${escape(sale.customerName || "Customer not recorded")} · ${escape(AppUtils.formatDateTime(sale.date))}</span><small>${escape(counter ? "Counter" : "Website")} · ${sale.itemCount} item${sale.itemCount === 1 ? "" : "s"}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(sale.total, currency)}</strong><span>${escape(sale.status || "recorded")}</span></div></article>`
      });
    }
    for (const order of snapshot.remoteOrders || []) {
      entries.push({ at: time(order.created_at), channel: "website", html: this.renderRemoteOrderRow(order, currency) });
    }
    for (const appointment of snapshot.remoteAppointments || []) {
      entries.push({
        at: time(appointment.starts_at || appointment.created_at),
        channel: "booking",
        html: this.renderServiceAppointmentRow(appointment)
      });
    }
    for (const invoice of snapshot.posInvoices || []) {
      const paid = String(invoice.status || "unpaid") === "paid";
      entries.push({
        at: time(invoice.created_at),
        channel: "invoice",
        html: `<article class="studio-list-row studio-order-card"><div><strong>${escape(invoice.invoice_number || `Invoice ${invoice.id}`)}</strong><span>${escape(invoice.customer_name || "Customer not recorded")} · ${escape(AppUtils.formatDateTime(invoice.created_at))}</span><small>Invoice · ${(invoice.items || []).length} item${(invoice.items || []).length === 1 ? "" : "s"}${invoice.due_date ? ` · due ${escape(invoice.due_date)}` : ""}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(invoice.total, currency)}</strong><span>${paid ? "paid" : "unpaid"}</span></div></article>`
      });
    }
    for (const quote of snapshot.posQuotations || []) {
      const converted = Boolean(quote.invoice_id);
      entries.push({
        at: time(quote.created_at),
        channel: "quote",
        html: `<article class="studio-list-row studio-order-card"><div><strong>${escape(quote.quotation_number || `Quote ${quote.id}`)}</strong><span>${escape(quote.customer_name || "Customer not recorded")} · ${escape(AppUtils.formatDateTime(quote.created_at))}</span><small>Quotation · ${(quote.items || []).length} item${(quote.items || []).length === 1 ? "" : "s"}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(quote.total, currency)}</strong><span>${converted ? "invoiced" : "open"}</span></div></article>`
      });
    }
    entries.sort((first, second) => second.at - first.at);
    const counts = {
      all: entries.length,
      counter: entries.filter(entry => entry.channel === "counter").length,
      website: entries.filter(entry => entry.channel === "website").length,
      booking: entries.filter(entry => entry.channel === "booking").length,
      invoice: entries.filter(entry => entry.channel === "invoice").length,
      quote: entries.filter(entry => entry.channel === "quote").length
    };
    const filters = [["all", "All"], ["counter", "Counter"], ["website", "Website"], ["booking", "Bookings"], ["invoice", "Invoices"], ["quote", "Quotes"]];
    const rows = entries.map(entry =>
      `<div class="store-order-entry" data-order-channel="${entry.channel}">${entry.html}</div>`).join("")
      || `<p class="store-workspace-empty">Nothing recorded yet. Counter sales, website orders and bookings all appear here.</p>`;
    return `<article class="studio-panel" data-orders-panel data-orders-filter-value="all">
      <div class="studio-panel-heading"><h2>Orders</h2><span>${counts.all} recorded</span></div>
      <div class="store-order-filters" role="group" aria-label="Filter orders by where they came from">
        ${filters.map(([key, label]) => `<button type="button" class="store-order-filter${key === "all" ? " is-active" : ""}" data-orders-filter="${key}" aria-pressed="${key === "all"}">${label} · ${counts[key]}</button>`).join("")}
      </div>
      ${rows}
    </article>`;
  },

  renderServiceAppointmentRow(appointment, nowMs = Date.now()) {
    const escape = AppUtils.escapeHTML;
    const id = escape(appointment.id);
    const startMs = new Date(appointment.starts_at).getTime();
    const started = Number.isFinite(startMs) && startMs <= nowMs;
    const expired = appointment.expired === true;
    const live = !expired && !started && (appointment.status === "pending" || appointment.status === "confirmed");
    const depositLink = appointment.payment_status !== "paid" && appointment.status === "confirmed" &&
      typeof appointment.payment_authorization_url === "string" &&
      /^https:\/\/checkout\.paystack\.com\//.test(appointment.payment_authorization_url)
      ? appointment.payment_authorization_url : "";
    const phone = String(appointment.customer_phone || "").replace(/\D/g, "");
    const shareText = `Hi ${appointment.customer_name}, your ${appointment.service_name} appointment is confirmed. Please pay your deposit here: ${depositLink}`;
    const whatsappLink = depositLink && phone ? `https://wa.me/${phone}?text=${encodeURIComponent(shareText)}` : "";
    let appointmentTime = String(appointment.starts_at || "");
    try {
      appointmentTime = new Date(appointment.starts_at).toLocaleString(undefined, { timeZone: appointment.timezone || undefined });
    } catch { /* keep the raw timestamp */ }
    const depositCents = Number(appointment.deposit_cents) || 0;
    const deposit = Number(appointment.deposit_percent) > 0
      ? `${Number(appointment.deposit_percent)}% deposit (${this.formatMainShopMoney(depositCents / 100, appointment.currency)})`
      : "No deposit";
    const payment = ({ not_required: "not required", initializing: "being set up", pending: "waiting for the customer", paid: "paid", failed: "failed" })[appointment.payment_status] || String(appointment.payment_status || "");
    const notes = [];
    if (appointment.cancelled_by) {
      notes.push(`Cancelled by ${appointment.cancelled_by === "customer" ? "the customer" : "you"}${appointment.cancel_reason ? `: ${appointment.cancel_reason}` : ""}`);
    }
    if (Number(appointment.reschedule_count) > 0) notes.push(`moved ${Number(appointment.reschedule_count)} time${Number(appointment.reschedule_count) === 1 ? "" : "s"} by the customer`);
    if (appointment.deposit_refunded_at) notes.push(`deposit refunded ${String(appointment.deposit_refunded_at).slice(0, 10)}`);
    const refundDue = appointment.deposit_refund_due === true;
    const button = (action, label, kind = "btn-secondary") =>
      `<button type="button" class="${kind}" data-service-appointment-action="${action}" data-appointment-id="${id}">${label}</button>`;
    const actions = [];
    if (appointment.status === "pending" && live) {
      actions.push(button("confirm", Number(appointment.deposit_percent) > 0 ? "Confirm & create deposit link" : "Confirm appointment", "btn-primary"));
      actions.push(button("reject", "Decline"));
    }
    if (live) {
      actions.push(`<button type="button" class="btn-secondary" data-appointment-reschedule-toggle="${id}">Reschedule</button>`);
      actions.push(button("cancel", "Cancel appointment"));
    }
    if (appointment.status === "confirmed" && started) {
      actions.push(button("complete", "Mark completed", "btn-primary"));
      actions.push(button("no_show", "Mark no-show"));
    }
    if (refundDue) actions.push(button("deposit_refunded", "Mark deposit refunded", "btn-primary"));
    const reschedulePanel = live
      ? `<div class="studio-order-controls" data-appointment-reschedule-panel="${id}" data-timezone="${escape(appointment.timezone || "")}" hidden>
          <label>New date<input type="date" data-appointment-reschedule-date value="${escape(this.serviceAppointmentLocalDate(appointment.starts_at, appointment.timezone))}"></label>
          <button type="button" class="btn-secondary" data-appointment-slots-load="${id}" data-service-id="${escape(appointment.service_id)}">Find free times</button>
          <label>Free times<select data-appointment-reschedule-slot disabled><option value="">Find free times first</option></select></label>
          <label>Or an exact time (shop time, 15-minute steps; use this to move it slightly, for example 15 minutes later)<input type="time" step="900" data-appointment-reschedule-time></label>
          <button type="button" class="btn-primary" data-appointment-reschedule-confirm="${id}" disabled>Move appointment</button>
        </div>
        <div class="studio-order-controls" style="grid-template-columns:minmax(0,1fr)"><label>Reason if you cancel (optional, shown to the customer)<input data-appointment-cancel-reason maxlength="200" autocomplete="off"></label></div>`
      : "";
    return `<article class="studio-list-row studio-order-card" data-appointment-row="${id}" data-appointment-status="${escape(appointment.status)}"${refundDue ? " data-needs-attention" : ""}>
      <div class="studio-order-header"><div><strong>${escape(appointment.service_name)} · ${escape(appointmentTime)}</strong><span>${escape(appointment.customer_name)} · ${escape(appointment.customer_email)} · ${escape(appointment.customer_phone)}</span></div><strong class="studio-order-total">${escape(this.serviceAppointmentStatusLabel(appointment))}</strong></div>
      <div class="studio-order-meta"><span>${escape(appointment.duration_minutes)} min</span><span>${escape(deposit)}</span><span>Payment: ${escape(payment)}</span>${appointment.reference ? `<span>Ref ${escape(appointment.reference)}</span>` : ""}</div>
      ${notes.length ? `<p class="studio-panel-note" data-appointment-notes>${escape(notes.join(" · "))}</p>` : ""}
      ${refundDue ? `<p class="studio-panel-note" role="alert" data-appointment-refund-due><strong>Deposit to refund.</strong> The customer paid ${escape(this.formatMainShopMoney(depositCents / 100, appointment.currency))} for a cancelled appointment. Refund it in your Paystack dashboard, then mark it refunded here.</p>` : ""}
      ${appointment.status === "confirming" ? `<p class="studio-panel-note">A deposit link is being created. Reload in a moment.</p>` : ""}
      ${depositLink ? `<div class="studio-order-meta"><a href="${escape(depositLink)}" target="_blank" rel="noopener noreferrer">Open deposit link</a>${whatsappLink ? `<a href="${escape(whatsappLink)}" target="_blank" rel="noopener noreferrer">Share by WhatsApp</a>` : ""}</div>` : ""}
      ${actions.length ? `<div class="studio-order-controls">${actions.join("")}</div>` : ""}
      ${reschedulePanel}
    </article>`;
  },

  renderServiceAppointmentsPanel(snapshot) {
    const escape = AppUtils.escapeHTML;
    const meta = snapshot.remoteAppointmentsMeta || {};
    const filter = this.serviceAppointmentFilter(meta.filter);
    const appointments = Array.isArray(snapshot.remoteAppointments) ? snapshot.remoteAppointments : [];
    const counts = meta.counts || null;
    const loaded = Array.isArray(snapshot.remoteAppointments);
    const note = snapshot.remoteAppointmentsError
      ? escape(snapshot.remoteAppointmentsError)
      : loaded
        ? `${appointments.length} appointment${appointments.length === 1 ? "" : "s"} shown${meta.hasMore ? " (more available)" : ""}.`
        : "Customers choose a free time on your website; confirm, decline, move or cancel their requests here.";
    const summary = counts
      ? `<div class="studio-order-meta" data-appointment-counts><span>${Number(counts.pending) || 0} waiting for you</span><span>${Number(counts.upcoming_confirmed) || 0} confirmed ahead</span><span>${Number(counts.refunds_due) || 0} deposit${Number(counts.refunds_due) === 1 ? "" : "s"} to refund</span></div>`
      : "";
    const rows = appointments.map(appointment => this.renderServiceAppointmentRow(appointment)).join("")
      || `<p class="store-workspace-empty">${loaded ? "No appointments match this filter." : "Load appointments from the live storefront."}</p>`;
    return `<article class="studio-panel" data-appointments-panel><div class="studio-panel-heading"><h2>Service appointments</h2><button type="button" class="btn-secondary studio-load-button" data-online-appointments-load aria-label="Load appointments">Load</button></div>
      <p class="studio-panel-note" data-online-appointments-status role="status" aria-live="polite">${note}</p>
      ${summary}
      <div class="studio-order-controls" style="grid-template-columns:minmax(0,1fr)"><label>Show<select data-appointments-filter>${this.serviceAppointmentFilters().map(item => `<option value="${item.key}"${item.key === filter.key ? " selected" : ""}>${escape(item.label)}</option>`).join("")}</select></label></div>
      ${rows}
      ${meta.hasMore ? `<button type="button" class="btn-secondary" data-appointments-more>Load more</button>` : ""}</article>`;
  },

  ownerAlertKindLabel(kind) {
    return ({
      order: "Order", booking: "Booking request", hold: "Hold request", attention: "Needs attention",
      booking_cancelled: "Booking cancelled", booking_rescheduled: "Booking moved", booking_refund: "Deposit to refund"
    })[kind] || "Alert";
  },

  ownerAlertRoute(kind) {
    return ["booking", "booking_cancelled", "booking_rescheduled", "booking_refund"].includes(kind)
      ? "/account/web/studio/store/bookings" : "";
  },

  renderMainShopContent(path, snapshot, skipBusinessLens = false) {
    const { products, categories, sales, posCategories } = snapshot;
    const activeTenant = AppController.getActiveTenant();
    if (path === "/store/split-shop") return this.renderSplitShop(snapshot, activeTenant);
    const currencies = [...new Set(sales.map(sale => sale.currency))];
    const revenueByCurrency = new Map();
    const channelByCurrency = new Map();
    sales.forEach(sale => {
      const revenue = revenueByCurrency.get(sale.currency) || 0;
      revenueByCurrency.set(sale.currency, revenue + sale.collected);
      const channel = channelByCurrency.get(sale.channel) || new Map();
      channel.set(sale.currency, (channel.get(sale.currency) || 0) + sale.collected);
      channelByCurrency.set(sale.channel, channel);
    });
    const revenueText = (amounts) => [...amounts.entries()]
      .map(([currency, amount]) => this.formatMainShopMoney(amount, currency)).join(" + ") || this.formatMainShopMoney(0, "KES");
    const stockUnits = products.reduce((sum, product) => sum + Math.max(0, Number(product.stock) || 0), 0);
    const existingProductOptions = products.map((product, index) =>
      `<option value="${index}">${AppUtils.escapeHTML(product.name)} · ${AppUtils.escapeHTML(product.categoryName)} · ${[...product.sources].map(source => source === "Website" ? "Web" : source).join("/")}</option>`
    ).join("");
    const webProducts = SQLiteEngine.select("products", product => product.status !== "archived");
    const webVisits = [
      ...SQLiteEngine.select("web_visits", visit => visit.tenant_id === activeTenant.id && AppController.isStorefrontVisitPath(visit.path),
        (a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      ...(snapshot.remoteVisits || []).filter(visit => AppController.isStorefrontVisitPath(visit.path))
    ];
    const visitAnalyticsPage = ["/account/main-shop/visits", "/account/main-shop/traffic"].includes(path);
    const analyticsCutoff = Date.now() - this.analyticsDays() * 86400000;
    const analyticsVisits = visitAnalyticsPage
      ? webVisits.filter(visit => {
        const time = new Date(visit.created_at).getTime();
        return Number.isFinite(time) && time >= analyticsCutoff;
      })
      : webVisits;
    const cloudflareRecentVisits = snapshot.remoteAnalytics?.recent_visits || [];
    const storefrontVisitCount = snapshot.remoteAnalytics ? Number(snapshot.remoteAnalytics.visits) || 0 : analyticsVisits.length;
    const storefrontUniqueCount = snapshot.remoteAnalytics
      ? Number(snapshot.remoteAnalytics.unique_visitors) || 0
      : new Set(analyticsVisits.map(visit => visit.visitor_id)).size;
    const recentVisitRows = snapshot.remoteAnalytics
      ? cloudflareRecentVisits.slice(0, 5).map(visit => `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(visit.path || "/")}</strong><span>${AppUtils.escapeHTML(visit.device || "Unknown device")}</span></div><span>${AppUtils.escapeHTML(visit.created_at || "")}</span></article>`).join("")
      : webVisits.slice(0, 5).map(visit => `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(visit.path || "/")}</strong><span>${AppUtils.escapeHTML(visit.device || "Unknown device")}</span></div><span>${AppUtils.escapeHTML(visit.created_at || "")}</span></article>`).join("");
    const webEvents = [
      ...SQLiteEngine.select("web_events", event => event.tenant_id === activeTenant.id, (a, b) => String(a.created_at).localeCompare(String(b.created_at))),
      ...(snapshot.remoteEvents || [])
    ];
    const webSales = sales.filter(sale => sale.channel === "Website");
    const customers = this.getWorkspaceCustomers(sales);
    const bookings = SQLiteEngine.select("booking_holds", item => item.tenant_id === activeTenant.id, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const newsletterByEmail = new Map();
    [
      ...SQLiteEngine.select("newsletter_subscribers", item => item.tenant_id === activeTenant.id, (a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      ...(snapshot.remoteNewsletter || [])
    ].forEach(item => newsletterByEmail.set(String(item.email || "").toLowerCase(), item));
    const newsletterSubscribers = [...newsletterByEmail.values()];
    const currency = snapshot.currency || "KES";
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const weekStart = dayStart - 6 * 86400000;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const datedSales = webSales.map(sale => ({ ...sale, time: new Date(sale.date).getTime() })).filter(sale => Number.isFinite(sale.time));
    // Revenue = paid, non-reversed sales (src/revenue-definition.js, shared with Business Lens and the AI helper).
    const paidSales = datedSales.filter(sale => window.EshopRevenue.isPaidSale(sale));
    const salesIn = (from) => datedSales.filter(sale => sale.time >= from);
    const revenueIn = (from) => window.EshopRevenue.sumRevenue(salesIn(from));
    const visitsIn = (from) => webVisits.filter(visit => new Date(visit.created_at).getTime() >= from);
    const uniqueIn = (from) => new Set(visitsIn(from).map(visit => visit.visitor_id)).size;
    const metric = (label, value, note = "", route = "") => route
      ? `<a class="studio-data-card studio-data-card-link" href="${route}" data-route="${route}"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</a>`
      : `<article class="studio-data-card"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</article>`;
    const orderRows = orders => orders.map(order => {
      const amount = Number(order.total) || 0;
      const status = String(order.status || "awaiting payment").replaceAll("_", " ");
      return `<article class="studio-list-row studio-order-card"><div><strong>${AppUtils.escapeHTML(order.order_number || `WEB-${order.id}`)}</strong><span>${AppUtils.escapeHTML(order.customer_name || "Web customer")} · ${AppUtils.escapeHTML(AppUtils.formatDateTime(order.created_at))}</span></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(amount, order.currency || currency)}</strong><span>${AppUtils.escapeHTML(status)}</span></div></article>`;
    }).join("") || ((snapshot.remoteOrders || []).length
      ? ""
      : `<p class="store-workspace-empty">No web orders recorded yet.</p>`);
    const remoteOrderRows = (snapshot.remoteOrders || []).map(order => this.renderRemoteOrderRow(order, currency)).join("") || `<p class="store-workspace-empty">No server-backed orders loaded.</p>`;
    const businessOrderRows = [...sales].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(sale =>
      `<article class="studio-list-row studio-order-card"><div><strong>${AppUtils.escapeHTML(sale.reference)}</strong><span>${AppUtils.escapeHTML(sale.customerName || "Customer not recorded")} · ${AppUtils.escapeHTML(AppUtils.formatDateTime(sale.date))}</span><small>${AppUtils.escapeHTML(sale.channel)} · ${sale.itemCount} item${sale.itemCount === 1 ? "" : "s"}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(sale.total, sale.currency || currency)}</strong><span>${AppUtils.escapeHTML(sale.status)}</span></div></article>`
    ).join("") || `<p class="store-workspace-empty">No business orders or POS receipts recorded yet.</p>`;
    const paymentActivityRows = [...sales].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(sale =>
      `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(sale.reference)}</strong><span>${AppUtils.escapeHTML(sale.channel)} · ${AppUtils.escapeHTML(sale.paymentMethod || "Method not recorded")} · ${AppUtils.escapeHTML(sale.date || "")}</span></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(sale.collected, sale.currency || currency)}</strong><span>${AppUtils.escapeHTML(sale.status || "Awaiting payment")}</span></div></article>`
    ).join("");
      const remoteHolds = snapshot.remoteHolds || [];
      const remoteHoldRows = remoteHolds.map(hold => {
        const expired = hold.status === "approved" && new Date(hold.expires_at).getTime() <= Date.now();
        const status = expired ? "Expired" : String(hold.status || "pending");
        const actions = hold.status === "pending"
          ? `<button type="button" class="btn-secondary" data-product-hold-action="approve" data-hold-id="${AppUtils.escapeHTML(hold.id)}">Approve with configured duration</button><button type="button" class="btn-secondary" data-product-hold-action="reject" data-hold-id="${AppUtils.escapeHTML(hold.id)}">Reject</button>`
          : hold.status === "approved" && !expired
            ? `<button type="button" class="btn-secondary" data-product-hold-action="release" data-hold-id="${AppUtils.escapeHTML(hold.id)}">Release hold</button>`
            : "";
        return `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(hold.product_name)} · ${Number(hold.quantity) || 0}</strong><span>${AppUtils.escapeHTML(hold.customer_name)} · ${AppUtils.escapeHTML(hold.contact)} · Requested ${AppUtils.escapeHTML(hold.created_at || "")}</span>${hold.expires_at ? `<small>Expires ${AppUtils.escapeHTML(hold.expires_at)}</small>` : ""}</div><div class="studio-row-end"><span>${AppUtils.escapeHTML(status)}</span>${actions}</div></article>`;
      }).join("") || `<p class="store-workspace-empty">${snapshot.remoteHolds ? "No storefront hold requests yet." : "Load customer requests from the live storefront."}</p>`;
      const remoteProductAnalytics = snapshot.remoteProductAnalytics;
      const productInterestById = new Map((remoteProductAnalytics?.product_interest || []).map(item => [String(item.product_id), item]));
      const productEventsById = new Map((remoteProductAnalytics?.product_activity || [])
        .map(item => [String(item.product_id), item]));
      const productViewsById = new Map((remoteProductAnalytics?.product_views || [])
        .filter(item => item.product_id != null)
        .map(item => [String(item.product_id), Number(item.views) || 0]));
      const productViewsBySlug = new Map((remoteProductAnalytics?.product_views || []).map(item => [
        String(item.path || "").split("/").filter(Boolean).pop() || "",
        Number(item.views) || 0
      ]));
      const productActivityItems = remoteProductAnalytics
        ? SQLiteEngine.select("products", product => product.status !== "archived").map(product => {
          const interest = productInterestById.get(String(product.id)) || {};
          const events = productEventsById.get(String(product.id)) || {};
          return {
            name: product.name,
            views: Number(events.views) || productViewsById.get(String(product.id)) ||
              productViewsBySlug.get(String(product.slug || "")) ||
              productViewsBySlug.get(String(product.id)) || 0,
            cartAdds: Number(events.cart_adds) || Number(interest.cart_quantity) || 0,
            wishlistAdds: Number(events.wishlist_adds) || Number(interest.wishlist_count) || 0,
            bookings: Number(events.bookings) || 0
          };
        })
        : [];
      const rankedProductRows = (metricName, unitLabel, emptyLabel) => productActivityItems
        .filter(item => item[metricName] > 0)
        .sort((a, b) => b[metricName] - a[metricName] || a.name.localeCompare(b.name))
        .slice(0, 10)
        .map(item => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(item.name)}</strong><span>${item[metricName]} ${unitLabel}</span></article>`)
        .join("") || `<p class="store-workspace-empty">${emptyLabel}</p>`;
      const mostViewedProductRows = rankedProductRows("views", "views", "No product views recorded yet.");
      const mostCartedProductRows = rankedProductRows("cartAdds", "cart additions", "No cart additions recorded yet.");
      const mostWishlistedProductRows = rankedProductRows("wishlistAdds", "wishlist saves", "No wishlist saves recorded yet.");
      const mostBookedProductRows = rankedProductRows("bookings", "bookings", "No bookings recorded yet.");
    const customerRows = customers.map(customer => `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(customer.name)}</strong><span>${AppUtils.escapeHTML(customer.email || customer.phone || "No contact saved")} · ${customer.orders} order${customer.orders === 1 ? "" : "s"}</span></div><div class="studio-row-end"><strong>${customer.points} pts</strong><span>${this.formatMainShopMoney(customer.spent, currency)} collected</span></div></article>`).join("");
    if (path === "/account/web" || path.startsWith("/account/web/studio/")) {
      const page = this.webStudioPage(path);
      if (page.route === "/account/web/studio/store/orders") {
        const orders = SQLiteEngine.select("orders", null, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return `<section class="studio-workspace-section">
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Orders</h2><button type="button" class="btn-secondary studio-load-button" data-business-online-orders-load aria-label="Load online orders">Load</button></div>
            <p class="studio-panel-note" data-online-orders-status>Orders and payment status are stored privately for this shop.</p>
            ${this.renderOrderAttentionSummary(snapshot.remoteOrders)}${orderRows(orders)}${remoteOrderRows}</article>
          ${this.renderOwnerAlertsPanel(snapshot)}
          ${this.renderDiscountPanel(snapshot)}
        </section>`;
      }
      if (page.route === "/account/web/studio/store/bookings") {
        const holdHours = Number(this.getWorkspaceSetting("max_hold_hours", 24));
        const activeProductCount = SQLiteEngine.select("products", product => product.status !== "archived").length;
        // A salon that also sells shampoo still takes bookings, so this follows the catalogue.
        const servicesShop = window.EshopServiceModel.sellsServices(
          window.EshopServiceModel.offerTypeForCatalogue(SQLiteEngine.select("products", product => product.status !== "archived"), SQLiteEngine.getStore().offer_type)
        );
        return `<section class="studio-workspace-section">
          ${servicesShop ? this.renderServiceAppointmentsPanel(snapshot) : ""}
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Storefront hold settings</h2></div>
            <p class="studio-panel-note">Set the hold duration and manage product eligibility. Publish the storefront after changes.</p>
            <form class="store-workspace-form" data-studio-form="booking-settings"><label>Maximum hold duration (hours)<input name="maxHoldHours" type="number" min="1" max="720" step="1" value="${holdHours}" required></label><button type="submit" class="btn-primary">Save hold settings</button><p role="status"></p></form>
          </article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Apply holds to all products</h2></div>
            <p class="studio-panel-note">Enable or disable customer holds for all ${activeProductCount} active website products at once. You can still change individual products afterward; this does not change stock.</p>
            <div class="studio-inline-actions">
              <button type="button" class="btn-primary" data-store-holds-all="enable" ${activeProductCount ? "" : "disabled"}>Enable holds for all products</button>
              <button type="button" class="btn-secondary" data-store-holds-all="disable" ${activeProductCount ? "" : "disabled"}>Disable holds for all products</button>
            </div>
          </article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Bookings and holds</h2></div>
            ${bookings.map(booking => {
              const expired = new Date(booking.expires_at).getTime() <= Date.now();
              return `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(booking.product_name)} · ${booking.quantity}</strong><span>${AppUtils.escapeHTML(booking.customer_name)} · ${AppUtils.escapeHTML(booking.contact)} · Expires ${AppUtils.escapeHTML(booking.expires_at)}</span></div><div class="studio-row-end"><span>${expired ? "Expired" : AppUtils.escapeHTML(booking.status || "On hold")}</span>${!expired && booking.status !== "released" ? `<button type="button" class="btn-secondary" data-release-hold="${booking.id}">Release</button>` : ""}</div></article>`;
            }).join("") || `<p class="store-workspace-empty">No bookings or holds recorded yet.</p>`}
          </article>
          ${servicesShop ? "" : this.renderServiceAppointmentsPanel(snapshot)}
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Storefront hold requests</h2><button type="button" class="btn-secondary studio-load-button" data-online-holds-load aria-label="Load hold requests">Load</button></div>
            <p class="studio-panel-note" data-online-holds-status>${snapshot.remoteHoldsError ? AppUtils.escapeHTML(snapshot.remoteHoldsError) : snapshot.remoteHolds ? `${remoteHolds.length} live hold${remoteHolds.length === 1 ? "" : "s"} loaded.` : "Customer holds reserve available website stock immediately until released or expired."}</p>
            ${remoteHoldRows}
          </article>
        </section>`;
      }
      if (page.section.title === "Websites") return this.renderWebStudioWebsiteTool(page);
      if (page.route === "/account/web/studio/crm/notifications") {
        return `<section class="studio-workspace-section">${this.renderOwnerAlertsPanel(snapshot)}<article class="studio-panel">
          <span class="studio-workspace-kicker">CUSTOMER NOTIFICATIONS</span><h2>Website notifications</h2>
          <p class="studio-panel-note">Customers choose whether to receive browser notifications. Push delivery requires an active notification service and customer opt-in. Broadcasts are sent immediately to every opted-in device.</p>
          <div class="studio-dashboard-grid"><button type="button" class="btn-primary" data-enable-notifications>Enable notifications on this device</button><button type="button" class="btn-secondary" data-disable-notifications>Turn off notifications on this device</button></div>
          <p class="bl-push-status" role="status" aria-live="polite">Notification availability depends on browser support and customer permission.</p>
          <form class="store-workspace-form" data-business-broadcast>
            <h2>Send a push notification</h2>
            <label>Title<input name="title" maxlength="80" required></label>
            <label>Message<textarea name="body" rows="3" maxlength="240" required></textarea></label>
            <label>Open this page when tapped<input name="url" value="/" maxlength="300" required></label>
            <p class="studio-panel-note">This sends now to all browsers that opted in to this shop’s notifications.</p>
            <button type="submit" class="btn-primary">Send notification</button>
            <p role="status" aria-live="polite"></p>
          </form>
        </article></section>`;
      }
      let content = this.renderMainShopContent(page.contentPath, snapshot, true);
      const studioRoutes = new Map([
        ["/account/dashboard", "/account/web/studio/dashboard/overview"],
        ["/account/main-shop/visits", "/account/web/studio/dashboard/visits"],
        ["/account/main-shop/traffic", "/account/web/studio/dashboard/traffic"],
        ["/account/main-shop/performance", "/account/web/studio/dashboard/performance"],
        ["/account/main-shop/product-intelligence", "/account/web/studio/dashboard/product-intelligence"],
        ["/store/products", "/account/web/studio/store/products"],
        ["/store/categories", "/account/web/studio/store/categories"],
        ["/store/inventory", "/account/web/studio/store/inventory"],
        ["/store/orders", "/account/web/studio/store/orders"],
        ["/store/bookings", "/account/web/studio/store/bookings"],
        ["/account/customers", "/account/web/studio/crm/customers"],
        ["/account/customers/loyalty", "/account/web/studio/crm/points"],
        ["/account/customers/newsletter", "/account/web/studio/crm/subscribers"],
        ["/account/payments", "/account/web/studio/payments"]
      ]);
      for (const [legacyRoute, studioRoute] of studioRoutes) {
        content = content.replaceAll(`href="${legacyRoute}" data-route="${legacyRoute}"`, `href="${studioRoute}" data-route="${studioRoute}"`);
      }
      return content;
    }
    const businessPath = path.replace(/\/$/, "") || "/account/main-shop";
    if (!skipBusinessLens && /^\/store\/manage(?:\/|$)/.test(businessPath)) {
      return this.renderMainStoreManagement(businessPath, snapshot);
    }
    if (!skipBusinessLens && businessPath === "/store/products/manage") {
      return this.renderMainStoreProductManagement(snapshot);
    }
    if (!skipBusinessLens && window.BusinessLens && [
      "/account/main-shop", "/account/main-shop/marketing",
      "/account/main-shop/finance", "/account/main-shop/stores", "/account/main-shop/settings",
      "/account/main-shop/help", "/store/revenue", "/store/channels", "/store/sales",
      "/store/products", "/store/inventory", "/store/categories", "/account/customers",
    ].includes(businessPath)) {
      const dashboard = window.BusinessLens.render(snapshot, businessPath, {
        visits: webVisits,
        events: webEvents,
        newsletter: newsletterSubscribers,
        remoteBranches: snapshot.remoteBranches || [],
        customers,
        points: [
          ...SQLiteEngine.select("customer_points", entry => entry.tenant_id === activeTenant.id),
          ...(snapshot.remotePoints || [])
        ],
        settings: snapshot.settings,
        instances: snapshot.instances,
        activeTenant
      });
      const mainStoreShortcuts = businessPath === "/account/main-shop"
        ? `<nav class="main-store-shortcuts" aria-label="Main Store shortcuts">
            <a href="/store/products" data-route="/store/products">Products</a>
            <a href="/account/customers" data-route="/account/customers">Customers</a>
            <a href="/store/channels" data-route="/store/channels">Channels</a>
            <a href="/store/inventory" data-route="/store/inventory">Inventory</a>
            <a href="/account/main-shop/finance" data-route="/account/main-shop/finance">Finance</a>
            <a href="/store/revenue" data-route="/store/revenue">Revenue</a>
          </nav>`
        : "";
      return `${mainStoreShortcuts}${dashboard}`;
    }
    const visitPages = new Map();
    const visitDevices = new Map();
    analyticsVisits.forEach(visit => {
      visitPages.set(visit.path, (visitPages.get(visit.path) || 0) + 1);
      visitDevices.set(visit.device, (visitDevices.get(visit.device) || 0) + 1);
    });
    const pageRows = snapshot.remoteAnalytics
      ? (snapshot.remoteAnalytics.pages || []).map(page => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(page.path || "/")}</strong><strong>${Number(page.visits) || 0}</strong></article>`).join("")
      : [...visitPages.entries()].sort((a, b) => b[1] - a[1]).map(([pagePath, count]) => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(pagePath || "/")}</strong><strong>${count}</strong></article>`).join("");
    const deviceRows = snapshot.remoteAnalytics
      ? (snapshot.remoteAnalytics.devices || []).map(item => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(item.device || "Unknown")}</strong><strong>${Number(item.visits) || 0}</strong></article>`).join("")
      : [...visitDevices.entries()].map(([device, count]) => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(device || "Unknown")}</strong><strong>${count}</strong></article>`).join("");
    const locationCard = (title, items, label) => `<article class="studio-location-card"><h3>${title}</h3>${items.length
      ? items.map(item => `<div class="studio-location-row"><strong>${AppUtils.escapeHTML(label(item) || "Unknown")}</strong><span>${Number(item.visits) || 0}</span></div>`).join("")
      : `<p class="store-workspace-empty">No data</p>`}</article>`;
    const locationGrid = snapshot.remoteAnalytics
      ? `<div class="studio-location-grid">${locationCard("Countries", snapshot.remoteAnalytics.countries || [], item => item.country)}${locationCard("Regions", snapshot.remoteAnalytics.regions || [], item => [item.region, item.country].filter(Boolean).join(", "))}</div>`
      : "";
    const analyticsLoadCard = `<article class="studio-panel studio-analytics-load"><div class="studio-panel-heading"><h2>Analytics</h2><button type="button" class="btn-secondary" data-business-cloud-analytics>Load</button></div><p class="studio-panel-note" data-analytics-status role="status" ${snapshot.remoteAnalyticsError ? "" : "hidden"}>${snapshot.remoteAnalyticsError ? "Could not load analytics." : ""}</p></article>`;
    const openCheckouts = new Map();
    const productActivity = new Map();
    webEvents.forEach(event => {
      if (event.event === "checkout_started") openCheckouts.set(event.session_id, event);
      if (event.event === "order_created") {
        const checkout = openCheckouts.get(event.session_id);
        if (checkout && checkout.created_at <= event.created_at) openCheckouts.delete(event.session_id);
      }
      if (event.product_name && ["add_to_cart", "favorite_added", "favorite_removed"].includes(event.event)) {
        const activity = productActivity.get(event.product_name) || { basketAdds: 0, favorites: 0 };
        if (event.event === "add_to_cart") activity.basketAdds += Number(event.quantity) || 1;
        if (event.event === "favorite_added") activity.favorites += 1;
        if (event.event === "favorite_removed") activity.favorites = Math.max(0, activity.favorites - 1);
        productActivity.set(event.product_name, activity);
      }
    });
    const abandonedRows = [...openCheckouts.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(checkout => {
      const sessionItems = webEvents.filter(event => event.session_id === checkout.session_id && event.event === "add_to_cart" && event.created_at <= checkout.created_at)
        .slice(-5).map(event => event.product_name).filter(Boolean);
      return `<article class="studio-list-row"><div><strong>Checkout started</strong><span>${AppUtils.escapeHTML(checkout.created_at)} · ${AppUtils.escapeHTML(sessionItems.join(", ") || "Basket items unavailable")}</span></div><span>Not yet ordered</span></article>`;
    }).join("");
    const activityRows = [...productActivity.entries()].sort((a, b) => (b[1].basketAdds + b[1].favorites) - (a[1].basketAdds + a[1].favorites)).slice(0, 10)
      .map(([name, activity]) => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(name)}</strong><span>${activity.favorites} likes · ${activity.basketAdds} added to basket</span></article>`).join("");
    if (path === "/account" || path === "/account/main-shop" || path === "/account/main-shop/" || path === "/account/dashboard") {
      return renderDashboardOverview.call(this, { currency, metric, paidSales, recentVisitRows, snapshot, storefrontVisitCount, webSales });
    }
    if (path === "/account/main-shop/visits") {
      return renderDashboardVisits.call(this, { analyticsLoadCard, analyticsVisits, locationGrid, metric, recentVisitRows, snapshot, storefrontUniqueCount, storefrontVisitCount });
    }
    if (path === "/account/main-shop/traffic") {
      return renderDashboardTraffic.call(this, { analyticsLoadCard, analyticsVisits, deviceRows, locationGrid, metric, pageRows, snapshot, storefrontUniqueCount, storefrontVisitCount });
    }
    if (path === "/account/main-shop/performance" || path === "/store/revenue") {
      return renderDashboardPerformance.call(this, { abandonedRows, activityRows, currency, dayStart, metric, monthStart, orderRows, paidSales, revenueIn, salesIn, uniqueIn, weekStart });
    }
    if (path === "/account/main-shop/product-intelligence") {
      return renderDashboardProductIntelligence.call(this, { mostBookedProductRows, mostCartedProductRows, mostViewedProductRows, mostWishlistedProductRows, remoteProductAnalytics, snapshot });
    }
    if (path === "/account/customers" || path === "/account/customers/") {
      return `<section class="studio-workspace-section"><div class="studio-metric-grid studio-metric-grid-featured">${metric("Identified web customers", customers.length, "", "/account/web/studio/crm/customers")}${metric("Repeat customers", customers.filter(customer => customer.orders > 1).length, "", "/account/web/studio/crm/customers")}${metric("Newsletter subscribers", newsletterSubscribers.length, "", "/account/web/studio/crm/subscribers")}</div>
      <article class="studio-panel"><div class="studio-panel-heading"><div><span class="studio-workspace-kicker">CUSTOMER RELATIONSHIPS</span><h2>Returning customers</h2></div><a href="/account/customers/loyalty" data-route="/account/customers/loyalty">Manage points</a></div>
        ${customerRows || `<p class="store-workspace-empty">Customers will appear after they place an order with an email address or phone number.</p>`}</article></section>`;
    }
    if (path === "/account/customers/loyalty") {
      const pointsPerVisit = Number(this.getWorkspaceSetting("points_per_visit", 1));
      const pointsPerCurrency = Number(this.getWorkspaceSetting("points_per_currency", 0));
      return `<section class="studio-workspace-section">
        <div class="studio-metric-grid studio-metric-grid-featured">${metric("Points per visit", pointsPerVisit)}${metric("Pts / " + AppUtils.escapeHTML(currency) + " spent", pointsPerCurrency)}${metric("Customers with points", customers.filter(customer => customer.points > 0).length)}</div>
        <form class="store-workspace-form crm-points-rules" data-studio-form="loyalty-settings"><h2>Points rules</h2><p>Points per verified visit and each full ${AppUtils.escapeHTML(currency)} spent.</p><div class="studio-form-grid"><label>Pts / verified visit<input name="pointsPerVisit" type="number" min="0" step="1" value="${pointsPerVisit}" required></label><label>Pts / full ${AppUtils.escapeHTML(currency)} spent<input name="pointsPerCurrency" type="number" min="0" step="1" value="${pointsPerCurrency}" required></label></div><button type="submit" class="btn-primary">Save rules</button><p role="status"></p></form>
        <form class="store-workspace-form" data-studio-form="points-adjust"><h2>Record verified activity or adjust points</h2><label>Customer<select name="customerKey" required><option value="">Choose a customer</option>${customers.map(customer => `<option value="${AppUtils.escapeHTML(customer.key)}">${AppUtils.escapeHTML(customer.name)} · ${customer.points} points</option>`).join("")}</select></label><div class="studio-form-grid"><label>Verified paid purchase amount (${AppUtils.escapeHTML(currency)})<input name="purchaseAmount" type="number" min="0" step="0.01" placeholder="Optional"></label><label>Manual adjustment (+/- points)<input name="delta" type="number" step="1" placeholder="Optional"></label></div><label class="studio-check-label"><input name="verifiedVisit" type="checkbox" value="yes"> Add points for one verified visit</label><label>Reason for manual adjustment<input name="reason" maxlength="140" placeholder="Required only for a manual adjustment"></label><button type="submit" class="btn-primary">Record points</button><p role="status"></p></form>
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Points balances</h2></div>${customerRows || `<p class="store-workspace-empty">No identified customers yet.</p>`}</article>
      </section>`;
    }
    if (path === "/account/customers/bookings" || path === "/store/bookings") {
      const maxHours = Number(this.getWorkspaceSetting("max_hold_hours", 24));
      return `<section class="studio-workspace-section">
        <p class="studio-panel-note">Hold requests are recorded for staff follow-up; they do not reserve stock or change POS inventory.</p>
        <form class="store-workspace-form" data-studio-form="booking-settings"><h2>Hold settings</h2><label>Maximum hold duration (hours)<input name="maxHoldHours" type="number" min="1" max="720" step="1" value="${maxHours}" required></label><button type="submit" class="btn-primary">Save hold settings</button><p role="status"></p></form>
        <form class="store-workspace-form" data-studio-form="booking-create"><h2>Create a product hold</h2><div class="studio-form-grid"><label>Product<select name="productId" required><option value="">Select a web product</option>${webProducts.map(product => `<option value="${product.id}">${AppUtils.escapeHTML(product.name)} · ${this.formatMainShopMoney(product.price, currency)}</option>`).join("")}</select></label><label>Quantity<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Customer name<input name="customerName" maxlength="120" required></label><label>Phone or email<input name="contact" maxlength="180" required></label><label>Hold duration in hours<input name="hours" type="number" min="1" max="${maxHours}" value="${maxHours}" required></label></div><button type="submit" class="btn-primary">Record hold</button><p role="status"></p></form>
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Bookings &amp; holds</h2></div>${bookings.map(booking => {
          const expired = new Date(booking.expires_at).getTime() <= Date.now();
          return `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(booking.product_name)} · ${booking.quantity}</strong><span>${AppUtils.escapeHTML(booking.customer_name)} · ${AppUtils.escapeHTML(booking.contact)} · Expires ${AppUtils.escapeHTML(booking.expires_at)}</span></div><div class="studio-row-end"><span>${expired ? "Expired" : AppUtils.escapeHTML(booking.status || "On hold")}</span>${!expired && booking.status !== "released" ? `<button type="button" class="btn-secondary" data-release-hold="${booking.id}">Release</button>` : ""}</div></article>`;
        }).join("") || `<p class="store-workspace-empty">No holds recorded yet.</p>`}</article></section>`;
    }
    if (["/account/customers/newsletter", "/account/web/studio/crm/newsletter"].includes(path)) {
      const remoteSubscribers = snapshot.remoteNewsletter || [];
      const confirmedSubscribers = remoteSubscribers.filter(subscriber => subscriber.status === "subscribed").length;
      const pendingSubscribers = remoteSubscribers.filter(subscriber => subscriber.status === "pending").length;
      return `<section class="studio-workspace-section">
        <div class="studio-panel-heading newsletter-header"><h2>Email newsletter</h2><button type="button" class="btn-secondary newsletter-refresh-button" data-business-newsletter-refresh aria-label="Refresh subscribers" title="Refresh subscribers"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 17 5l3 2M4 17l3 2a7 7 0 0 0 11.5-4"/></svg></button></div>
        <div class="studio-metric-grid newsletter-metrics">${metric("Confirmed", confirmedSubscribers, "Campaign-ready")}${metric("Pending", pendingSubscribers, "Email unconfirmed")}</div>
        <p class="studio-panel-note">${snapshot.remoteNewsletterError ? `Could not load shared subscribers: ${AppUtils.escapeHTML(snapshot.remoteNewsletterError)}` : "Storefront signups are confirmed by email and shared with this shop in Cloudflare. Campaign delivery uses the configured Resend sender."}</p>
        <form class="store-workspace-form" data-business-newsletter-send><h2>Compose and send</h2><label>Subject<input name="subject" maxlength="120" required></label><label>Message<textarea name="message" rows="5" maxlength="4000" required></textarea></label><p class="studio-panel-note">Unsubscribe links are added automatically. The app reports provider acceptance, not guaranteed inbox delivery.</p><button type="submit" class="btn-primary" ${confirmedSubscribers ? "" : "disabled"}>Send to ${confirmedSubscribers} confirmed subscriber${confirmedSubscribers === 1 ? "" : "s"}</button><p role="status"></p></form>
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Subscribers (${remoteSubscribers.length})</h2></div>
          ${remoteSubscribers.length ? `<div class="store-bulk-actions newsletter-bulk-actions" data-newsletter-bulk>
            <label class="store-bulk-select-all"><input type="checkbox" data-newsletter-select-all><span>Select all subscribers</span></label>
            <span class="store-bulk-selection-count" data-newsletter-selection-count>0 selected</span>
            <button type="button" class="btn-secondary" data-newsletter-remove-selected disabled>Remove selected</button>
          </div>` : ""}
          <p role="status" aria-live="polite" data-newsletter-action-status></p>
          ${remoteSubscribers.map(subscriber => `<article class="studio-list-row newsletter-subscriber-row">
            <label class="newsletter-subscriber-select" aria-label="Select ${AppUtils.escapeHTML(subscriber.email)}"><input type="checkbox" data-newsletter-subscriber-select value="${AppUtils.escapeHTML(subscriber.id)}"></label>
            <div><strong>${AppUtils.escapeHTML(subscriber.name || subscriber.email)}</strong><span>${AppUtils.escapeHTML(subscriber.email)} · ${AppUtils.escapeHTML(subscriber.status)} · joined ${AppUtils.escapeHTML(subscriber.created_at)}</span></div>
            <button type="button" class="btn-secondary" data-remove-remote-subscriber="${AppUtils.escapeHTML(subscriber.id)}">Remove</button>
          </article>`).join("") || `<p class="store-workspace-empty">No storefront subscribers yet.</p>`}</article>
      </section>`;
    }
    if (path === "/account/payments") {
      const storeCurrency = String(SQLiteEngine.getStore().currency || "KES").toUpperCase();
      const nativeCurrencySettings = window.Capacitor?.isNativePlatform?.() === true
        ? `<article class="studio-panel"><div class="studio-panel-heading"><h2>Website currency</h2><span>${AppUtils.escapeHTML(activeTenant.name || activeTenant.hostname)}</span></div>
          <p class="studio-panel-note">Choose the currency for this website. Changing it does not convert prices. Online payments require KES.</p>
          <form class="store-workspace-form" data-app-website-currency><label>Website currency<select name="currency" required>
            ${[
              ["KES", "Kenyan shilling (KES)"],
              ["USD", "US dollar (USD)"],
              ["EUR", "Euro (EUR)"],
              ["GBP", "British pound (GBP)"],
              ["TZS", "Tanzanian shilling (TZS)"],
              ["UGX", "Ugandan shilling (UGX)"],
              ["RWF", "Rwandan franc (RWF)"],
              ["NGN", "Nigerian naira (NGN)"],
              ["GHS", "Ghanaian cedi (GHS)"],
              ["ZAR", "South African rand (ZAR)"]
            ].map(([code, label]) => `<option value="${code}" ${storeCurrency === code ? "selected" : ""}>${label}</option>`).join("")}
            ${!["KES", "USD", "EUR", "GBP", "TZS", "UGX", "RWF", "NGN", "GHS", "ZAR"].includes(storeCurrency)
              ? `<option value="${AppUtils.escapeHTML(storeCurrency)}" selected>${AppUtils.escapeHTML(storeCurrency)}</option>`
              : ""}
          </select></label><button type="submit" class="btn-primary">Save website currency</button><p role="status" aria-live="polite"></p></form>
        </article>`
        : "";
      return `<section class="studio-workspace-section"><article class="studio-panel"><div class="studio-panel-heading"><h2>Payment account</h2><span data-paystack-status>Checking account…</span></div>
        <p class="studio-panel-note">Connect or change the account used for payments across your websites.</p>
        ${nativeCurrencySettings}
        <p class="studio-panel-note">Test mode cannot confirm payouts. In Live mode, the bank must be verified before connection. Only a reference and masked account details are stored.</p>
        <form class="store-workspace-form" data-paystack-setup autocomplete="off"><div class="studio-form-grid">
          <label>Business name<input name="business_name" maxlength="120" autocomplete="organization" required></label>
          <label>Bank<select name="settlement_bank" required><option value="">Loading banks…</option></select></label><button type="button" class="btn-secondary" data-paystack-retry hidden>Retry</button>
          <label>Bank account number<input name="account_number" inputmode="numeric" autocomplete="off" minlength="5" maxlength="20" pattern="[0-9]{5,20}" required></label>
          <label>Account contact name<input name="primary_contact_name" maxlength="120" autocomplete="name" required></label>
          <label>Contact email<input name="primary_contact_email" type="email" maxlength="240" autocomplete="email" required></label>
          <label>Contact phone<input name="primary_contact_phone" type="tel" maxlength="40" autocomplete="tel" required></label>
        </div><button type="submit" class="btn-primary" data-paystack-submit>Connect bank account</button><p role="status" data-paystack-form-status></p></form>
        <form class="store-workspace-form" data-paystack-reuse hidden style="display:none;"><h3>Use an existing account</h3>
          <p class="studio-panel-note">Choose an account already connected to one of your websites.</p>
          <label>Connected account<select name="source_tenant_id" required><option value="">Loading accounts…</option></select></label>
          <label style="display:flex;align-items:flex-start;gap:8px;"><input type="checkbox" name="confirm_reuse" required><span>Use this as the default payment account for my websites.</span></label>
          <button type="submit" class="btn-secondary" data-paystack-reuse-submit>Use this account</button><p role="status" data-paystack-reuse-status></p>
        </form>
        </article></section>`;
    }
    if (path === "/store/orders" || path === "/store/sales" || path === "/store/payments") {
      const orders = SQLiteEngine.select("orders", null, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const view = path === "/store/sales" ? "sales" : path === "/store/payments" ? "payments" : "orders";
      return `<section class="studio-workspace-section">
        ${view === "orders" ? `${this.renderUnifiedOrderList(snapshot, sales, currency)}
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Website orders and bookings</h2><button type="button" class="btn-secondary studio-load-button" data-business-online-orders-load aria-label="Load online orders">Load</button></div>
            <p class="studio-panel-note" data-online-orders-status>${snapshot.remoteOrdersError ? AppUtils.escapeHTML(snapshot.remoteOrdersError) : "Load the latest website orders and bookings into the list above. They are stored privately for this shop."}</p>
            ${this.renderOrderAttentionSummary(snapshot.remoteOrders)}</article>
          ${this.renderOwnerAlertsPanel(snapshot)}
          ${this.renderDiscountPanel(snapshot)}`
          : view === "sales" ? `<div class="studio-metric-grid">${metric("Order value", this.formatMainShopMoney(webSales.reduce((sum, sale) => sum + sale.total, 0), currency))}${metric("Paid orders", paidSales.length)}${metric("Unpaid orders", orders.filter(order => !["paid", "completed"].includes(String(order.status || "").toLowerCase())).length)}</div><article class="studio-panel"><div class="studio-panel-heading"><h2>Sales history</h2></div>${orderRows(orders)}</article>`
            : `<article class="studio-panel"><div class="studio-panel-heading"><h2>Payment activity · all channels</h2></div>${paymentActivityRows || `<p class="store-workspace-empty">No payment activity recorded yet.</p>`}</article>`}
        </section>`;
    }
    if (path === "/account/main-shop") {
      const metrics = [
        ["Products", products.length, "/store/products"],
        ["Categories", categories.length, "/store/categories"],
        ["Units in stock", stockUnits, "/store/inventory"],
        ["Collected revenue · all channels", revenueText(revenueByCurrency), "/store/revenue"]
      ];
      return `
        <div class="pos-metrics" aria-label="Whole business totals">
          ${metrics.map(([label, value, route]) => `<a class="metric-card" href="${route}" data-route="${route}" style="text-decoration:none;color:inherit;"><span class="metric-label">${label}</span><span class="metric-value">${value}</span></a>`).join("")}
        </div>
      `;
    }
    if (path === "/store/products") {
      return renderStoreProducts.call(this, { activeTenant, currency, snapshot, webProducts });
    }
    if (path === "/store/categories") {
      const websiteCategories = SQLiteEngine.getCategories();
      const storeOnlyCategories = snapshot.posCategories.filter(posCategory => !websiteCategories.some(webCategory => webCategory.name.trim().toLocaleLowerCase() === posCategory.name.trim().toLocaleLowerCase()));
      return `
        <form class="store-workspace-form" data-studio-form="web-category">
          <input name="name" aria-label="Category name" placeholder="Category name" required maxlength="120"><button type="submit" class="btn-primary">Add category</button><p role="status"></p>
        </form>
        <section class="studio-panel"><div class="studio-panel-heading"><h2>Categories available in Store inventory</h2></div>
          ${storeOnlyCategories.map(category => `<article class="store-category-import-row"><strong>${AppUtils.escapeHTML(category.name)}</strong><button type="button" class="btn-secondary" data-store-website-category="${AppUtils.escapeHTML(category.name)}">Add from Store</button></article>`).join("") || `<p class="store-workspace-empty">No additional Store categories to import.</p>`}
        </section>
        ${websiteCategories.length ? `<div class="store-bulk-actions" data-bulk-removal="categories"><label class="store-bulk-select-all"><input type="checkbox" data-bulk-select-all><span>Select all categories</span></label><span class="store-bulk-selection-count" data-bulk-selection-count>0 selected</span><button type="button" class="btn-secondary" data-bulk-remove disabled>Remove selected categories</button></div>` : ""}
        <div class="store-workspace-list">${websiteCategories.map(category => {
          const categoryProducts = webProducts.filter(product => Number(product.category_id) === Number(category.id));
          return `
          <div class="store-bulk-row">
          <label class="store-bulk-item" aria-label="Select ${AppUtils.escapeHTML(category.name)}"><input type="checkbox" data-bulk-item="${category.id}"></label>
          <details class="store-category-wrap">
            <summary class="store-workspace-row">
              <div><strong class="store-product-name">${AppUtils.escapeHTML(category.name)}</strong><span>${categoryProducts.length} products</span></div>
              <div class="store-product-sources"><span class="store-product-source">Web only</span></div>
            </summary>
            <div class="store-category-details">
              <div class="store-category-products">
                ${categoryProducts.map(product => `<details class="store-category-product"><summary><strong>${AppUtils.escapeHTML(product.name)}</strong><span>${this.formatMainShopMoney(product.price, currency)} · ${product.stock == null ? "Stock not set" : `${product.stock} in stock`}</span></summary><p>SKU: ${AppUtils.escapeHTML(product.sku || "Not assigned")} · Website catalog</p>${product.description ? `<p>${AppUtils.escapeHTML(product.description)}</p>` : ""}</details>`).join("") || `<span class="store-workspace-empty">No products in this category yet.</span>`}
              </div>
              <button type="button" class="btn-secondary" data-remove-website-category="${category.id}" style="margin:12px 0;">Remove category from this website</button>
              <a class="btn-secondary" href="/store/products" data-route="/store/products">Add web product to this category</a>
            </div>
          </details></div>`;
        }).join("") || `<p class="store-workspace-empty">No website categories yet.</p>`}</div>`;
    }
    if (path === "/store/inventory") {
      return `
        <p class="studio-panel-note">Website stock is managed independently. Updating it does not change POS inventory.</p>
        <div class="store-workspace-list">${webProducts.map(product => `
          <form class="store-workspace-row store-stock-form" data-pos-id="" data-web-id="${product.id}">
            <div><strong class="store-product-name">${AppUtils.escapeHTML(product.name)}</strong><span>${AppUtils.escapeHTML(product.sku || "No SKU")} · Website stock</span></div>
            <label>Quantity<input name="stock" type="number" min="0" step="1" value="${product.stock ?? ""}" required></label>
            <button type="submit" class="btn-secondary">Save web stock</button>
          </form>
        `).join("") || `<p class="store-workspace-empty">No website products to manage.</p>`}</div>`;
    }
    if (path === "/store/revenue") {
      const revenueLines = sales.flatMap(sale => {
        const itemsTotal = sale.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const collectedRatio = sale.total > 0 ? Math.min(1, sale.collected / sale.total) : 0;
        return sale.lineItems.map(item => ({
          name: item.name,
          currency: sale.currency,
          amount: item.quantity * item.unitPrice * (itemsTotal > 0 ? collectedRatio : 0)
        }));
      });
      return `
        <div class="store-revenue-screen">
          <div class="store-workspace-list">${revenueLines.map(product => `
            <article class="store-workspace-row">
              <div><strong>${AppUtils.escapeHTML(product.name)}</strong></div>
              <strong>${this.formatMainShopMoney(product.amount, product.currency)}</strong>
            </article>
          `).join("") || `<p class="store-workspace-empty">No product revenue recorded yet.</p>`}</div>
        </div>`;
    }
    if (path === "/store/sales") {
      const currenciesFor = channel => {
        const values = channelByCurrency.get(channel) || new Map();
        return revenueText(values);
      };
      return `
        <div class="store-revenue-screen">
        <div class="pos-metrics" aria-label="Collected revenue across the business">
          <div class="metric-card"><span class="metric-label">All channels collected</span><span class="metric-value">${revenueText(revenueByCurrency)}</span></div>
          <div class="metric-card"><span class="metric-label">Website collected</span><span class="metric-value">${currenciesFor("Website")}</span></div>
          <div class="metric-card"><span class="metric-label">POS collected</span><span class="metric-value">${currenciesFor("POS")}</span></div>
          <div class="metric-card"><span class="metric-label">Recorded sales</span><span class="metric-value">${sales.length}</span></div>
        </div>
        <h2 style="margin:28px 0 12px;">Website + POS sales</h2>
        <div class="store-workspace-list">${sales.map(sale => `
          <details class="store-sale-receipt">
            <summary class="store-workspace-row">
              <div><strong>${AppUtils.escapeHTML(sale.reference)}</strong><span>${AppUtils.escapeHTML(sale.channel)} · ${AppUtils.escapeHTML(AppUtils.formatDateTime(sale.date))} · ${AppUtils.escapeHTML(sale.status)}</span></div>
              <div><strong>${this.formatMainShopMoney(sale.collected, sale.currency)} collected</strong><span>${this.formatMainShopMoney(sale.total, sale.currency)} total · ${sale.itemCount} items</span></div>
            </summary>
            <div class="store-product-detail">
              <h3>Receipt · ${AppUtils.escapeHTML(sale.reference)}</h3>
              <p>${AppUtils.escapeHTML(AppUtils.formatDateTime(sale.date))} · ${AppUtils.escapeHTML(sale.channel)} · ${AppUtils.escapeHTML(sale.status)}</p>
              ${sale.lineItems.map(item => `<div class="store-workspace-row"><div><strong>${AppUtils.escapeHTML(item.name)}</strong><span>${item.quantity} × ${this.formatMainShopMoney(item.unitPrice, sale.currency)}</span></div><strong>${this.formatMainShopMoney(item.quantity * item.unitPrice, sale.currency)}</strong></div>`).join("") || `<p>No item details are available for this sale.</p>`}
              <div class="store-product-detail-grid"><div><strong>Sale total</strong> <span>${this.formatMainShopMoney(sale.total, sale.currency)}</span></div><div><strong>Collected</strong> <span>${this.formatMainShopMoney(sale.collected, sale.currency)}</span></div><div><strong>Balance</strong> <span>${this.formatMainShopMoney(Math.max(0, sale.total - sale.collected), sale.currency)}</span></div></div>
            </div>
          </details>
        `).join("") || `<p class="store-workspace-empty">No sales have been recorded in either channel yet.</p>`}</div></div>`;
    }
    return `<p class="store-workspace-empty">This business screen is unavailable.</p>`;
  },

  async bindPaystackSetup(container, tenantId) {
    const form = container.querySelector("[data-paystack-setup]");
    if (!form) return;
    const status = container.querySelector("[data-paystack-status]");
    const formStatus = container.querySelector("[data-paystack-form-status]");
    const bankSelect = form.elements.namedItem("settlement_bank");
    const submit = form.querySelector("[data-paystack-submit]");
    const retry = form.querySelector("[data-paystack-retry]");
    if (submit) submit.disabled = true;
    const loadSetup = async () => {
      if (retry) retry.disabled = true;
      if (bankSelect) bankSelect.innerHTML = `<option value="">Loading banks…</option>`;
      const [setupResult, banksResult, defaultResult] = await Promise.allSettled([
        window.EshopInventoryBridge.getPaystackAccount(tenantId),
        window.EshopInventoryBridge.getPaystackBanks(tenantId),
        window.EshopInventoryBridge.getPaystackDefault(tenantId)
      ]);
      const setup = setupResult.status === "fulfilled" ? setupResult.value : null;
      const account = setup?.account || { connected: false };
      const accountModeLabel = account.account_mode === "live"
        ? account.is_verified ? "Live · verified" : "Live · not verified"
        : account.account_mode === "test" ? "Test mode" : "mode unknown";
      const defaultAccount = defaultResult.status === "fulfilled" ? defaultResult.value.default_account : null;
      const banks = banksResult.status === "fulfilled" ? banksResult.value.banks : null;
      if (status) status.textContent = setupResult.status === "rejected"
        ? "Shop owner access required"
        : account.connected
          ? `Connected · ${accountModeLabel} · ${account.bank_name} ·••${account.account_last4}`
          : defaultAccount
            ? `Default · ${defaultAccount.bank_name} ·••${defaultAccount.account_last4}`
          : account.status ? `Account status: ${account.status}` : "Not connected";
      if (banks?.length) {
        bankSelect.innerHTML = `<option value="">Choose a bank</option>${banks.map(bank =>
          `<option value="${AppUtils.escapeHTML(bank.code)}">${AppUtils.escapeHTML(bank.name)}</option>`).join("")}`;
      } else {
        bankSelect.innerHTML = `<option value="">Bank list unavailable</option>`;
      }
      if (submit) {
        submit.textContent = account.configured ? "Update account" : "Connect account";
        submit.disabled = setupResult.status !== "fulfilled" || !banks?.length;
      }
      const errors = [
        ...(setupResult.status === "rejected" ? [setupResult.reason] : []),
        ...(banksResult.status === "rejected" ? [banksResult.reason] : []),
        ...(banksResult.status === "fulfilled" && !banks?.length ? [new Error("No supported banks were returned.")] : [])
      ];
      if (formStatus) {
        formStatus.textContent = errors.length
          ? errors.map(error => error instanceof Error ? error.message : String(error)).join(" ")
          : account.connected
            ? account.account_mode === "live" && !account.is_verified
              ? "Live account is not verified by Paystack; live checkout is disabled."
              : account.account_mode === "test"
                ? "Test account only. It cannot receive live payments."
                : "Live account is verified and ready for live checkout."
            : "";
        if (errors.length) console.error("Payment account setup could not be loaded.", errors);
      }
      if (defaultResult.status === "rejected") {
        console.warn("The app-wide default Paystack account could not be loaded.", defaultResult.reason);
      }
      const loaded = setupResult.status === "fulfilled" && !!banks?.length;
      if (retry) {
        retry.hidden = loaded;
        retry.disabled = false;
      }
      return loaded;
    };
    retry?.addEventListener("click", () => { void loadSetup(); });
    void this.bindPaystackReuseSetup(container, tenantId);
    if (!await loadSetup()) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      submit.disabled = true;
      if (formStatus) formStatus.textContent = "Sending details securely…";
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        const result = await window.EshopInventoryBridge.savePaystackAccount(tenantId, values);
        const account = result.account;
        form.reset();
        const accountModeLabel = account.account_mode === "live"
          ? account.is_verified ? "Live · verified" : "Live · not verified"
          : account.account_mode === "test" ? "Test mode" : "mode unknown";
        if (status) status.textContent =
          `Connected · ${accountModeLabel} · ${account.bank_name} ·••${account.account_last4}`;
        let defaultSaved = false;
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        const sourceTenant = AppController.tenantCatalogs().find(tenant => tenant.tenant_id === tenantId);
        if (sessionToken && sourceTenant?.owner_token) {
          try {
            await window.EshopInventoryBridge.setPaystackDefault(
              tenantId, tenantId, sourceTenant.owner_token, sessionToken
            );
            defaultSaved = true;
          } catch (error) {
            console.error("Payment account was connected, but the default could not be saved.", error);
          }
        }
        if (formStatus) formStatus.textContent = defaultSaved
          ? account.account_mode === "live" && account.is_verified
            ? "Verified live account connected and set as the default for your websites."
            : "Account set as default, but live checkout remains disabled until a verified live account is connected."
          : account.account_mode === "live" && account.is_verified
            ? "Verified live account connected. Choose it below to use it for your websites."
            : "Account connected, but live checkout remains disabled until a verified live account is connected.";
        if (submit) submit.textContent = "Update account";
      } catch (error) {
        console.error("Payment account setup failed.", error);
        if (formStatus) formStatus.textContent = "Could not connect account. Check details and retry.";
      } finally {
        submit.disabled = false;
      }
    });
  },

  async bindPaystackReuseSetup(container, tenantId) {
    const form = container.querySelector("[data-paystack-reuse]");
    if (!form) return;
    const select = form.elements.namedItem("source_tenant_id");
    const status = form.querySelector("[data-paystack-reuse-status]");
    const submit = form.querySelector("[data-paystack-reuse-submit]");
    const candidates = AppController.tenantCatalogs().filter(tenant => tenant.owner_token);
    if (!candidates.length) {
      if (status) status.textContent = "No saved shop accounts are available.";
      return;
    }
    select.innerHTML = `<option value="">Checking accounts…</option>`;
    const results = await Promise.allSettled(candidates.map(async tenant => {
      const result = await window.EshopInventoryBridge.getPaystackAccount(tenant.tenant_id);
      return result.account?.connected ? { tenant, account: result.account } : null;
    }));
    const accounts = results
      .filter(result => result.status === "fulfilled" && result.value)
      .map(result => result.value);
    const errors = results.filter(result => result.status === "rejected");
    if (!accounts.length) {
      select.innerHTML = `<option value="">No connected accounts found</option>`;
      if (status) status.textContent = errors.length
        ? "Could not check saved shops. Check your connection and reload."
        : "Connect an account in a shop's Payments settings, then choose it here.";
      return;
    }
    select.innerHTML = `<option value="">Choose an account</option>${accounts.map(({ tenant, account }) =>
      `<option value="${AppUtils.escapeHTML(tenant.tenant_id)}">${AppUtils.escapeHTML(tenant.name || tenant.tenant_id)} · ${AppUtils.escapeHTML(account.bank_name)} ·••${AppUtils.escapeHTML(account.account_last4)}</option>`
    ).join("")}`;
    try {
      const currentDefault = await window.EshopInventoryBridge.getPaystackDefault(tenantId);
      if (currentDefault.default_account) {
        select.value = currentDefault.default_account.tenant_id;
        if (status) status.textContent = `Default: ${currentDefault.default_account.bank_name} ·••${currentDefault.default_account.account_last4}`;
      }
    } catch (error) {
      if (status) status.textContent = error instanceof Error
        ? error.message
        : "Could not load the default account.";
    }
    form.hidden = false;
    form.style.display = "grid";
    if (status) status.textContent = errors.length
      ? "Some of your saved shops could not be checked; listed accounts are available for reuse."
      : "";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      if (status) status.textContent = "Saving default account…";
      try {
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        const sourceTenantId = String(select.value || "");
        if (!sessionToken || !sourceTenantId) throw new Error("Sign in and choose a connected shop account.");
        const sourceTenant = candidates.find(tenant => tenant.tenant_id === sourceTenantId);
        if (!sourceTenant?.owner_token) throw new Error("The selected shop's private key is not available on this device.");
        const result = await window.EshopInventoryBridge.setPaystackDefault(
          tenantId, sourceTenantId, sourceTenant.owner_token, sessionToken
        );
        const source = accounts.find(item => item.tenant.tenant_id === sourceTenantId);
        const accountStatus = container.querySelector("[data-paystack-status]");
        if (accountStatus && source) {
          accountStatus.textContent = `Connected · ${source.account.bank_name} ·••${source.account.account_last4}`;
        }
        if (status) status.textContent = `Default account saved for websites without a separate account.`;
        return result;
      } catch (error) {
        console.error("Default payment account could not be saved.", error);
        if (status) status.textContent = "Could not save this account. Check access and retry.";
      } finally {
        submit.disabled = false;
      }
    });
  },

  bindBusinessCloudActions(container, path, snapshot, tenantId = AppController.getActiveTenant().id) {
    if (["/account/payments", "/account/web/studio/payments"].includes(path)) {
      this.bindPaystackSetup(container, tenantId);
    }
    const websiteCurrencyForm = container.querySelector("[data-app-website-currency]");
    if (websiteCurrencyForm && window.Capacitor?.isNativePlatform?.() === true) {
      websiteCurrencyForm.addEventListener("submit", async event => {
        event.preventDefault();
        const status = websiteCurrencyForm.querySelector('[role="status"]');
        const submit = websiteCurrencyForm.querySelector('button[type="submit"]');
        const currency = String(new FormData(websiteCurrencyForm).get("currency") || "").trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
          if (status) status.textContent = "Choose a valid three-letter currency code.";
          return;
        }
        if (submit) submit.disabled = true;
        if (status) status.textContent = "Saving website currency…";
        try {
          const currencySymbol = new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency
          }).formatToParts(0).find(part => part.type === "currency")?.value || currency;
          SQLiteEngine.updateStore({ currency, currency_symbol: currencySymbol });
          AppController.cacheActiveTenantCatalog();
          if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
          await window.ShopSQLite.flush();
          if (status) status.textContent = `${currency} saved for this website. Product prices were not converted; publish the catalog to update the live site.`;
          AppUtils.showToast(`Website currency saved as ${currency}.`);
        } catch (error) {
          console.error("Website currency could not be saved.", error);
          if (status) status.textContent = error instanceof Error
            ? error.message
            : "Could not save the website currency.";
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    }
    const branchesUrl = `/api/business/branches?tenant=${encodeURIComponent(tenantId)}`;
    const renderNewsletterSubscribers = (subscribers, actionStatus = "") => {
      const updatedSnapshot = { ...snapshot, remoteNewsletter: subscribers, remoteNewsletterError: "" };
      container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
      const status = container.querySelector("[data-newsletter-action-status]");
      if (status) status.textContent = actionStatus;
      this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
    };
    container.querySelector("[data-business-newsletter-refresh]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await window.EshopInventoryBridge.listNewsletterSubscribers(tenantId);
        const subscribers = Array.isArray(result.subscribers) ? result.subscribers : [];
        renderNewsletterSubscribers(subscribers, `${subscribers.length} subscriber${subscribers.length === 1 ? "" : "s"} loaded.`);
      } catch (error) {
        const note = container.querySelector(".studio-panel-note");
        if (note) note.textContent = error instanceof Error ? error.message : "Could not load newsletter subscribers.";
        button.disabled = false;
      }
    });
    const removeRemoteSubscribers = async ids => {
      const removedIds = new Set();
      const failures = [];
      for (const id of ids) {
        try {
          await window.EshopInventoryBridge.removeNewsletterSubscriber(tenantId, id);
          removedIds.add(String(id));
        } catch (error) {
          failures.push(error instanceof Error ? error.message : "A subscriber could not be removed.");
        }
      }
      const subscribers = (snapshot.remoteNewsletter || []).filter(subscriber => !removedIds.has(String(subscriber.id)));
      const actionStatus = failures.length
        ? `Removed ${removedIds.size} of ${ids.length} subscribers. ${failures.length} failed: ${failures[0]}`
        : `Removed ${removedIds.size} subscriber${removedIds.size === 1 ? "" : "s"}.`;
      renderNewsletterSubscribers(subscribers, actionStatus);
    };
    const newsletterSelectAll = container.querySelector("[data-newsletter-select-all]");
    const newsletterChecks = [...container.querySelectorAll("[data-newsletter-subscriber-select]")];
    const newsletterSelectedCount = container.querySelector("[data-newsletter-selection-count]");
    const newsletterRemoveSelected = container.querySelector("[data-newsletter-remove-selected]");
    const updateNewsletterSelection = () => {
      const selectedCount = newsletterChecks.filter(input => input.checked).length;
      if (newsletterSelectedCount) newsletterSelectedCount.textContent = `${selectedCount} selected`;
      if (newsletterRemoveSelected) newsletterRemoveSelected.disabled = selectedCount === 0;
      if (newsletterSelectAll) {
        newsletterSelectAll.checked = newsletterChecks.length > 0 && selectedCount === newsletterChecks.length;
        newsletterSelectAll.indeterminate = selectedCount > 0 && selectedCount < newsletterChecks.length;
      }
    };
    newsletterSelectAll?.addEventListener("change", () => {
      newsletterChecks.forEach(input => { input.checked = newsletterSelectAll.checked; });
      updateNewsletterSelection();
    });
    newsletterChecks.forEach(input => input.addEventListener("change", updateNewsletterSelection));
    newsletterRemoveSelected?.addEventListener("click", async () => {
      const ids = newsletterChecks.filter(input => input.checked).map(input => input.value).filter(Boolean);
      if (!ids.length || !window.confirm(`Remove ${ids.length} selected subscriber${ids.length === 1 ? "" : "s"}?`)) return;
      newsletterRemoveSelected.disabled = true;
      newsletterChecks.forEach(input => { input.disabled = true; });
      const status = container.querySelector("[data-newsletter-action-status]");
      if (status) status.textContent = `Removing ${ids.length} subscriber${ids.length === 1 ? "" : "s"}…`;
      await removeRemoteSubscribers(ids);
    });
    container.querySelector("[data-business-newsletter-send]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const status = form.querySelector('[role="status"]');
      const data = new FormData(form);
      const subject = String(data.get("subject") || "").trim();
      const message = String(data.get("message") || "").trim();
      const count = (snapshot.remoteNewsletter || []).filter(subscriber => subscriber.status === "subscribed").length;
      if (!subject || !message || count < 1) {
        if (status) status.textContent = "A subject, message, and confirmed subscribers are required.";
        return;
      }
      if (!window.confirm(`Send this newsletter to ${count} confirmed subscriber${count === 1 ? "" : "s"}?`)) return;
      if (submit) submit.disabled = true;
      if (status) status.textContent = "Sending newsletter…";
      try {
        const result = await window.EshopInventoryBridge.sendNewsletterCampaign(tenantId, subject, message);
        if (status) status.textContent = result.failed
          ? `Provider accepted ${result.accepted} of ${result.attempted} emails; ${result.failed} failed.`
          : `Provider accepted all ${result.accepted} emails. Inbox delivery is not guaranteed.`;
        if (result.failed) console.error("Newsletter campaign had failed recipient batches.", result);
        form.reset();
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not send the newsletter.";
      } finally {
        if (submit) submit.disabled = false;
      }
    });
    container.querySelectorAll("[data-remove-remote-subscriber]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.removeRemoteSubscriber;
        if (!id || !window.confirm("Remove this subscriber from the shop newsletter list?")) return;
        button.disabled = true;
        await removeRemoteSubscribers([id]);
      });
    });
    const renderWithBranches = (branches, statusText) => {
      try {
        window.localStorage.setItem(
          `ESHOP_BUSINESS_BRANCHES_V1:${tenantId}`,
          JSON.stringify(branches)
        );
      } catch (error) {
        console.warn("Could not cache synced business branches on this device.", error);
      }
      const merged = this.mergeRemoteBusinessData(snapshot, branches);
      container.innerHTML = this.renderMainShopContent(path, merged);
      const status = container.querySelector(".bl-sync-status");
      if (status) status.textContent = statusText;
      this.bindBusinessCloudActions(container, path, snapshot, tenantId);
    };
    container.querySelector("[data-business-branches]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-sync-status");
      button.disabled = true;
      if (status) status.textContent = "Loading synced registers…";
      try {
        const result = await AppController.cloudflareRequest(branchesUrl, {}, tenantId);
        const branches = Array.isArray(result.branches) ? result.branches : [];
        renderWithBranches(branches, `${branches.length} register${branches.length === 1 ? "" : "s"} loaded from the private archive.`);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load synced registers.";
        button.disabled = false;
      }
    });
    // Counter, website and booking rows live in one list; these just narrow it down.
    container.querySelectorAll("[data-orders-filter]").forEach(button => {
      button.addEventListener("click", () => {
        const panel = button.closest("[data-orders-panel]");
        if (!panel) return;
        panel.dataset.ordersFilterValue = button.dataset.ordersFilter || "all";
        panel.querySelectorAll("[data-orders-filter]").forEach(other => {
          const active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", String(active));
        });
      });
    });
    container.querySelector("[data-business-online-orders-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-online-orders-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading recent orders from Cloudflare…";
      try {
        const result = await window.EshopInventoryBridge.listStorefrontOrders(tenantId);
        const remoteOrders = Array.isArray(result.orders) ? result.orders : [];
        const updatedSnapshot = {
          ...snapshot,
          remoteOrders,
          sales: window.BusinessLens?.mergeStorefrontOrders
            ? window.BusinessLens.mergeStorefrontOrders(snapshot.sales, remoteOrders)
            : snapshot.sales
        };
        container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
        const updatedStatus = container.querySelector("[data-online-orders-status]");
        if (updatedStatus) updatedStatus.textContent = `${updatedSnapshot.remoteOrders.length} server-backed order${updatedSnapshot.remoteOrders.length === 1 ? "" : "s"} loaded.`;
        this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load online orders.";
        button.disabled = false;
      }
    });
    container.querySelectorAll("[data-online-order-update]").forEach(button => {
      button.addEventListener("click", async () => {
        const orderNumber = button.dataset.onlineOrderUpdate;
        const statusSelect = container.querySelector(`[data-online-order-status="${CSS.escape(orderNumber)}"]`);
        const status = container.querySelector("[data-online-orders-status]");
        button.disabled = true;
        try {
          const updated = await window.EshopInventoryBridge.updateStorefrontOrder(tenantId, orderNumber, statusSelect.value);
          const saved = updated?.order?.order_number === orderNumber ? updated.order : null;
          const updatedSnapshot = {
            ...snapshot,
            remoteOrders: (snapshot.remoteOrders || []).map(order =>
              order.order_number === orderNumber ? (saved || { ...order, status: statusSelect.value }) : order)
          };
          if (window.BusinessLens?.mergeStorefrontOrders) {
            updatedSnapshot.sales = window.BusinessLens.mergeStorefrontOrders(
              snapshot.sales,
              updatedSnapshot.remoteOrders
            );
          }
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          const updatedStatus = container.querySelector("[data-online-orders-status]");
          if (updatedStatus) updatedStatus.textContent = `${orderNumber} status saved.`;
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not update this order.";
          button.disabled = false;
        }
      });
    });
    const rerenderWith = (updatedSnapshot, statusSelector, text) => {
      container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
      const updatedStatus = statusSelector ? container.querySelector(statusSelector) : null;
      if (updatedStatus && text) updatedStatus.textContent = text;
      this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
    };
    const withOrders = (remoteOrders) => {
      const updatedSnapshot = { ...snapshot, remoteOrders };
      if (window.BusinessLens?.mergeStorefrontOrders) {
        updatedSnapshot.sales = window.BusinessLens.mergeStorefrontOrders(snapshot.sales, remoteOrders);
      }
      return updatedSnapshot;
    };
    container.querySelectorAll("[data-online-order-pay]").forEach(button => {
      button.addEventListener("click", async () => {
        const orderNumber = button.dataset.onlineOrderPay;
        const row = button.closest("[data-online-order-row]");
        const method = row?.querySelector("[data-online-order-pay-method]")?.value || "";
        const reference = String(row?.querySelector("[data-online-order-pay-ref]")?.value || "").trim();
        const status = container.querySelector("[data-online-orders-status]");
        if (!window.confirm(`Record ${orderNumber} as paid (${this.manualPaymentLabel(method)})? This marks the order paid and deducts its stock.`)) return;
        button.disabled = true;
        try {
          const result = await window.EshopInventoryBridge.recordStorefrontOrderPayment(
            tenantId, orderNumber, { method, ...(reference ? { reference } : {}) }
          );
          const saved = result.order && result.order.order_number === orderNumber ? result.order : null;
          rerenderWith(
            withOrders((snapshot.remoteOrders || []).map(order => order.order_number === orderNumber
              ? (saved || { ...order, payment_status: "paid", payment_method: method })
              : order)),
            "[data-online-orders-status]",
            result.duplicate
              ? `${orderNumber} was already marked paid.`
              : result.needs_attention
                ? `${orderNumber} marked paid, but stock ran short. Review it below.`
                : `${orderNumber} marked paid.`
          );
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not record this payment.";
          button.disabled = false;
        }
      });
    });
    container.querySelector("[data-discounts-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-discounts-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading discount codes…";
      try {
        const result = await window.EshopInventoryBridge.listDiscountCodes(tenantId);
        const updatedSnapshot = { ...snapshot, remoteDiscounts: Array.isArray(result.discounts) ? result.discounts : [] };
        delete updatedSnapshot.remoteDiscountsError;
        rerenderWith(updatedSnapshot);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load discount codes.";
        button.disabled = false;
      }
    });
    container.querySelector("[data-discount-form]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = form.querySelector('[role="status"]');
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const type = data.get("type") === "fixed" ? "fixed" : "percent";
      const entered = Number(data.get("value"));
      const value = type === "percent" ? entered : Math.round(entered * 100);
      if (!Number.isSafeInteger(value) || value < 1 || (type === "percent" && value > 100)) {
        if (status) status.textContent = type === "percent"
          ? "A percent discount must be a whole number from 1 to 100."
          : "Enter a fixed discount of at least one cent.";
        return;
      }
      const minOrder = Math.round((Number(data.get("min_order")) || 0) * 100);
      const limitText = String(data.get("usage_limit") || "").trim();
      const usageLimit = limitText ? Number(limitText) : null;
      if (!Number.isSafeInteger(minOrder) || minOrder < 0 ||
          (usageLimit !== null && (!Number.isSafeInteger(usageLimit) || usageLimit < 1))) {
        if (status) status.textContent = "Minimum spend must be 0 or more and the usage limit a whole number of at least 1.";
        return;
      }
      const endsText = String(data.get("ends_at") || "").trim();
      const endsAt = endsText ? new Date(`${endsText}T23:59:59`) : null;
      if (endsAt && !Number.isFinite(endsAt.getTime())) {
        if (status) status.textContent = "Choose a valid expiry date.";
        return;
      }
      const body = {
        code: String(data.get("code") || "").trim().toUpperCase(),
        type,
        value,
        min_order_cents: minOrder,
        usage_limit: usageLimit,
        active: true,
        ...(endsAt ? { ends_at: endsAt.toISOString() } : {})
      };
      if (submit) submit.disabled = true;
      if (status) status.textContent = "Saving discount code…";
      try {
        const result = await window.EshopInventoryBridge.createDiscountCode(tenantId, body);
        const updatedSnapshot = {
          ...snapshot,
          remoteDiscounts: [result.discount, ...(snapshot.remoteDiscounts || []).filter(item => item.code !== result.discount.code)]
        };
        delete updatedSnapshot.remoteDiscountsError;
        rerenderWith(updatedSnapshot, "[data-discounts-status]", `${result.discount.code} created.`);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not save this discount code.";
        if (submit) submit.disabled = false;
      }
    });
    container.querySelectorAll("[data-discount-toggle]").forEach(button => {
      button.addEventListener("click", async () => {
        const code = button.dataset.discountToggle;
        const status = container.querySelector("[data-discounts-status]");
        button.disabled = true;
        try {
          const result = await window.EshopInventoryBridge.updateDiscountCode(
            tenantId, { code, active: button.dataset.discountActive !== "1" }
          );
          rerenderWith({
            ...snapshot,
            remoteDiscounts: (snapshot.remoteDiscounts || []).map(item => item.code === code ? result.discount : item)
          }, "[data-discounts-status]", `${code} ${result.discount.active ? "enabled" : "disabled"}.`);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not update this discount code.";
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-discount-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const code = button.dataset.discountDelete;
        const status = container.querySelector("[data-discounts-status]");
        if (!window.confirm(`Delete discount code ${code}? Customers will no longer be able to use it.`)) return;
        button.disabled = true;
        try {
          await window.EshopInventoryBridge.deleteDiscountCode(tenantId, code);
          rerenderWith({
            ...snapshot,
            remoteDiscounts: (snapshot.remoteDiscounts || []).filter(item => item.code !== code)
          }, "[data-discounts-status]", `${code} deleted.`);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not delete this discount code.";
          button.disabled = false;
        }
      });
    });
    container.querySelector("[data-owner-alerts-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-owner-alerts-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading shop alerts…";
      try {
        const updatedSnapshot = { ...snapshot, remoteAlerts: await window.BusinessNotifications.owner.list(tenantId) };
        delete updatedSnapshot.remoteAlertsError;
        rerenderWith(updatedSnapshot);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load shop alerts.";
        button.disabled = false;
      }
    });
    container.querySelector("[data-owner-alerts-read-all]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-owner-alerts-status]");
      button.disabled = true;
      try {
        await window.BusinessNotifications.owner.markRead(tenantId, "all");
        const readAt = new Date().toISOString();
        rerenderWith({
          ...snapshot,
          remoteAlerts: {
            unread_count: 0,
            notifications: (snapshot.remoteAlerts?.notifications || []).map(alert => ({ ...alert, read_at: alert.read_at || readAt }))
          }
        }, "[data-owner-alerts-status]", "All alerts marked read.");
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not mark alerts read.";
        button.disabled = false;
      }
    });
    const appointmentStatusLine = () => container.querySelector("[data-online-appointments-status]");
    // Fetches one page of appointments for a filter and redraws the panel. `append` adds the next page.
    const loadAppointments = async (filterKey, { append = false, message = "" } = {}) => {
      const filter = this.serviceAppointmentFilter(filterKey);
      const previous = snapshot.remoteAppointmentsMeta || {};
      const offset = append ? Number(previous.fetched) || 0 : 0;
      const result = await window.EshopInventoryBridge.listServiceAppointments(
        tenantId, { ...filter.query, ...(offset ? { offset } : {}) }
      );
      const fetched = Array.isArray(result.appointments) ? result.appointments : [];
      const rows = filter.clientFilter ? fetched.filter(filter.clientFilter) : fetched;
      const updatedSnapshot = {
        ...snapshot,
        remoteAppointments: append ? [...(snapshot.remoteAppointments || []), ...rows] : rows,
        remoteAppointmentsMeta: {
          filter: filter.key,
          counts: result.counts || null,
          hasMore: result.has_more === true,
          fetched: offset + fetched.length
        }
      };
      delete updatedSnapshot.remoteAppointmentsError;
      rerenderWith(updatedSnapshot, "[data-online-appointments-status]", message);
    };
    container.querySelector("[data-online-appointments-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = appointmentStatusLine();
      button.disabled = true;
      if (status) status.textContent = "Loading service appointments…";
      try {
        await loadAppointments((snapshot.remoteAppointmentsMeta || {}).filter);
      } catch (error) {
        if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load service appointments.");
        button.disabled = false;
      }
    });
    container.querySelector("[data-appointments-filter]")?.addEventListener("change", async event => {
      const status = appointmentStatusLine();
      if (status) status.textContent = "Loading service appointments…";
      try {
        await loadAppointments(event.currentTarget.value);
      } catch (error) {
        if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load service appointments.");
      }
    });
    container.querySelector("[data-appointments-more]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = appointmentStatusLine();
      button.disabled = true;
      try {
        await loadAppointments((snapshot.remoteAppointmentsMeta || {}).filter, { append: true });
      } catch (error) {
        if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load more appointments.");
        button.disabled = false;
      }
    });
    // Sends one owner action, then reloads the current filter so rows, filters and counts match the Worker.
    const runAppointmentAction = async (button, id, action, extra, successText) => {
      const status = appointmentStatusLine();
      const filterKey = (snapshot.remoteAppointmentsMeta || {}).filter;
      button.disabled = true;
      let result;
      try {
        result = await window.EshopInventoryBridge.updateServiceAppointment(tenantId, id, action, extra);
      } catch (error) {
        const text = this.serviceAppointmentErrorText(error);
        if (error && error.code === "appointment_changed") {
          try {
            await loadAppointments(filterKey, { message: text });
            return;
          } catch { /* fall through and show the message on the current screen */ }
        }
        if (status) status.textContent = text;
        button.disabled = false;
        return;
      }
      const text = typeof successText === "function" ? successText(result.appointment || {}) : successText;
      try {
        await loadAppointments(filterKey, { message: text });
      } catch {
        // The change itself worked; show the updated row even though the refresh failed.
        rerenderWith({
          ...snapshot,
          remoteAppointments: (snapshot.remoteAppointments || []).map(appointment =>
            appointment.id === id && result.appointment ? result.appointment : appointment)
        }, "[data-online-appointments-status]", `${text} (Reload to refresh the list.)`);
      }
    };
    container.querySelectorAll("[data-service-appointment-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.appointmentId;
        const action = button.dataset.serviceAppointmentAction;
        const row = button.closest("[data-appointment-row]");
        const extra = {};
        if (action === "cancel") {
          if (!window.confirm("Cancel this appointment? The customer is told by email. If they paid a deposit you will need to refund it yourself.")) return;
          const reason = String(row?.querySelector("[data-appointment-cancel-reason]")?.value || "").trim();
          if (reason) extra.reason = reason.slice(0, 200);
        }
        if (action === "reject" && !window.confirm("Decline this appointment request? The customer is told by email.")) return;
        if (action === "no_show" && !window.confirm("Mark this customer as a no-show? Any deposit stays with you.")) return;
        await runAppointmentAction(button, id, action, extra, appointment => ({
          confirm: Number(appointment.deposit_percent) > 0
            ? "Appointment confirmed. The customer was emailed the deposit link; you can also share it from here."
            : "Appointment confirmed.",
          reject: "Appointment declined.",
          cancel: appointment.deposit_refund_due ? "Appointment cancelled. A deposit was paid: refund it in Paystack, then mark it refunded." : "Appointment cancelled.",
          complete: "Appointment marked completed.",
          no_show: "Appointment marked as a no-show.",
          deposit_refunded: "Deposit marked as refunded."
        })[action] || "Appointment updated.");
      });
    });
    container.querySelectorAll("[data-appointment-reschedule-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        const panel = container.querySelector(`[data-appointment-reschedule-panel="${CSS.escape(button.dataset.appointmentRescheduleToggle)}"]`);
        if (panel) panel.hidden = !panel.hidden;
      });
    });
    container.querySelectorAll("[data-appointment-slots-load]").forEach(button => {
      button.addEventListener("click", async () => {
        const panel = button.closest("[data-appointment-reschedule-panel]");
        const date = String(panel?.querySelector("[data-appointment-reschedule-date]")?.value || "");
        const select = panel?.querySelector("[data-appointment-reschedule-slot]");
        const confirmButton = panel?.querySelector("[data-appointment-reschedule-confirm]");
        const status = appointmentStatusLine();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          if (status) status.textContent = "Choose the new date first.";
          return;
        }
        button.disabled = true;
        if (status) status.textContent = "Looking for free times…";
        try {
          const result = await window.EshopInventoryBridge.listServiceSlots(tenantId, button.dataset.serviceId, date);
          const slots = Array.isArray(result.slots) ? result.slots : [];
          if (select) {
            select.innerHTML = "";
            const placeholder = container.ownerDocument.createElement("option");
            placeholder.value = "";
            placeholder.textContent = slots.length ? "Choose a time" : "No free times that day";
            select.appendChild(placeholder);
            slots.forEach(slot => {
              const option = container.ownerDocument.createElement("option");
              option.value = String(slot.starts_at);
              option.textContent = `${slot.label || slot.starts_at}${Number(result.capacity) > 1 && slot.remaining ? ` (${slot.remaining} left)` : ""}`;
              select.appendChild(option);
            });
            select.disabled = !slots.length;
          }
          if (confirmButton) confirmButton.disabled = true;
          if (status) status.textContent = slots.length
            ? `${slots.length} free time${slots.length === 1 ? "" : "s"} on ${date}. Choose one, then move the appointment.`
            : `No free times on ${date}. Try another date.`;
        } catch (error) {
          if (status) status.textContent = this.serviceAppointmentErrorText(error, "Could not load free times.");
        } finally {
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-appointment-reschedule-slot]").forEach(select => {
      select.addEventListener("change", () => {
        const panel = select.closest("[data-appointment-reschedule-panel]");
        const confirmButton = panel?.querySelector("[data-appointment-reschedule-confirm]");
        if (confirmButton) confirmButton.disabled = !select.value && !panel.querySelector("[data-appointment-reschedule-time]")?.value;
      });
    });
    container.querySelectorAll("[data-appointment-reschedule-time]").forEach(input => {
      const sync = () => {
        const panel = input.closest("[data-appointment-reschedule-panel]");
        const confirmButton = panel?.querySelector("[data-appointment-reschedule-confirm]");
        const slotSelect = panel?.querySelector("[data-appointment-reschedule-slot]");
        if (confirmButton) confirmButton.disabled = !input.value && !slotSelect?.value;
      };
      input.addEventListener("input", sync);
      input.addEventListener("change", sync);
    });
    container.querySelectorAll("[data-appointment-reschedule-confirm]").forEach(button => {
      button.addEventListener("click", async () => {
        const panel = button.closest("[data-appointment-reschedule-panel]");
        let startsAt = String(panel?.querySelector("[data-appointment-reschedule-slot]")?.value || "");
        const exactTime = String(panel?.querySelector("[data-appointment-reschedule-time]")?.value || "");
        if (exactTime) {
          // The Worker's slot list also counts this booking's own seats, so it can never offer a time that
          // overlaps the current one. An exact time is checked by the Worker itself (hours, grid, capacity).
          const date = String(panel?.querySelector("[data-appointment-reschedule-date]")?.value || "");
          startsAt = this.serviceAppointmentLocalToIso(date, exactTime, panel?.dataset.timezone);
          if (!startsAt) {
            const status = appointmentStatusLine();
            if (status) status.textContent = "Choose a valid date and time first.";
            return;
          }
        }
        if (!startsAt) return;
        await runAppointmentAction(button, button.dataset.appointmentRescheduleConfirm, "reschedule", { starts_at: startsAt },
          "Appointment moved. The customer was emailed the new time.");
      });
    });
    container.querySelector("[data-online-holds-load]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector("[data-online-holds-status]");
      button.disabled = true;
      if (status) status.textContent = "Loading customer hold requests…";
      try {
        const result = await window.EshopInventoryBridge.listStorefrontHolds(tenantId);
        const updatedSnapshot = { ...snapshot, remoteHolds: Array.isArray(result.holds) ? result.holds : [] };
        container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
        this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not load storefront hold requests.";
        button.disabled = false;
      }
    });
    container.querySelectorAll("[data-product-hold-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const id = button.dataset.holdId;
        const action = button.dataset.productHoldAction;
        const status = container.querySelector("[data-online-holds-status]");
        button.disabled = true;
        try {
          const result = await window.EshopInventoryBridge.updateStorefrontHold(tenantId, id, action);
          const updatedSnapshot = {
            ...snapshot,
            remoteHolds: (snapshot.remoteHolds || []).map(hold => hold.id === id ? result.hold : hold)
          };
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          const updatedStatus = container.querySelector("[data-online-holds-status]");
          if (updatedStatus) updatedStatus.textContent = `Hold request ${({ approve: "approved", reject: "rejected", release: "released" })[action]}.`;
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not update this hold request.";
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-business-product-analytics]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Refreshing...";
        const status = container.querySelector("[data-product-analytics-status]");
        if (status) status.textContent = "Refreshing live product activity…";
        try {
          const analytics = await window.EshopInventoryBridge.fetchStorefrontEventAnalytics(tenantId, 30);
          const updatedSnapshot = {
            ...snapshot,
            remoteProductAnalytics: analytics,
            remoteProductAnalyticsUpdatedAt: new Date().toISOString()
          };
          delete updatedSnapshot.remoteProductAnalyticsError;
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          const note = container.querySelector("[data-product-analytics-status]");
          if (note) note.textContent = error instanceof Error ? error.message : "Could not load product activity.";
          button.textContent = "Refresh";
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll("[data-business-cloud-analytics]").forEach(button => {
      button.addEventListener("click", async () => {
        const status = button.closest(".studio-panel")?.querySelector("[data-business-cloud-analytics-status], [data-analytics-status]");
        button.disabled = true;
        if (status) {
          status.hidden = false;
          status.textContent = "Loading…";
        }
        try {
          const analytics = await window.EshopInventoryBridge.fetchStorefrontAnalytics(tenantId, this.analyticsDays());
          const updatedSnapshot = { ...snapshot, remoteAnalytics: analytics };
          container.innerHTML = this.renderMainShopContent(path, updatedSnapshot);
          this.bindBusinessCloudActions(container, path, updatedSnapshot, tenantId);
        } catch (error) {
          console.error("Storefront analytics could not be loaded.", error);
          if (status) status.textContent = "Could not load analytics.";
          button.disabled = false;
        }
      });
    });
    container.querySelector("[data-business-sync]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-sync-status");
      button.disabled = true;
      if (status) status.textContent = "Saving this register's snapshot to the private cloud archive…";
      try {
        const activeTenant = AppController.getActiveTenant();
        const instance = snapshot.instances?.[0];
        const storeId = this.businessStoreId(tenantId);
        if (!window.ShopPOS?.listBusinessRecords) {
          throw new Error("Register business records are not available for cloud sync.");
        }
        const [suppliers, purchaseOrders, tickets] = await Promise.all([
          window.ShopPOS.listBusinessRecords("supplier", tenantId),
          window.ShopPOS.listBusinessRecords("purchase", tenantId),
          window.ShopPOS.listBusinessRecords("ticket", tenantId)
        ]);
        const synced = await AppController.cloudflareRequest(
          `/api/business/sync?tenant=${encodeURIComponent(tenantId)}`,
          {
            method: "POST",
            body: JSON.stringify({
              store_id: storeId,
              store_name: String(instance?.name || activeTenant.name || "Primary register").slice(0, 120),
              snapshot: {
                currency: snapshot.currency || "KES",
                sales: snapshot.sales,
                expenses: snapshot.expenses,
                categories: [...(snapshot.categories || []), ...(snapshot.posCategories || [])],
                products: (snapshot.posProducts || snapshot.products).map(product => ({
                  id: product.id, sku: product.sku, name: product.name,
                  category: product.categoryName || product.category,
                  price: product.price, costPrice: product.costPrice, stock: product.stock
                })),
                visits: SQLiteEngine.select("web_visits", item => item.tenant_id === tenantId && AppController.isStorefrontVisitPath(item.path)),
                events: SQLiteEngine.select("web_events", item => item.tenant_id === tenantId),
                newsletter: SQLiteEngine.select("newsletter_subscribers", item => item.tenant_id === tenantId),
                points: SQLiteEngine.select("customer_points", item => item.tenant_id === tenantId),
                bookings: SQLiteEngine.select("booking_holds", item => item.tenant_id === tenantId),
                instances: snapshot.instances,
                suppliers,
                purchase_orders: purchaseOrders,
                tickets,
                settings: snapshot.settings || {}
              }
            })
          },
          tenantId
        );
        const branchesResult = await AppController.cloudflareRequest(branchesUrl, {}, tenantId);
        renderWithBranches(
          branchesResult.branches || [],
          `Saved to R2 · ${synced.snapshot_id.slice(0, 12)}…`
        );
      } catch (error) {
        if (status) status.textContent = error instanceof Error
          ? error.message
          : "Register sync failed. Local data is unchanged.";
        button.disabled = false;
      }
    });
    container.querySelector("[data-enable-notifications]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-push-status") ||
        document.querySelector("#web-newsletter-signup [role='status']");
      button.disabled = true;
      try {
        const message = await window.BusinessNotifications.enable(tenantId);
        if (status) status.textContent = message;
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not enable notifications.";
      } finally {
        button.disabled = false;
      }
    });
    container.querySelector("[data-disable-notifications]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const status = container.querySelector(".bl-push-status") ||
        document.querySelector("#web-newsletter-signup [role='status']");
      button.disabled = true;
      try {
        const message = await window.BusinessNotifications.disable(tenantId);
        if (status) status.textContent = message;
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Could not turn notifications off.";
      } finally {
        button.disabled = false;
      }
    });
    container.querySelector("[data-business-broadcast]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = Object.fromEntries(new FormData(form).entries());
      if (!fields.title || !fields.body) return;
      if (!window.confirm("Send this notification now to all devices subscribed to this shop?")) return;
      const submit = form.querySelector('button[type="submit"]');
      const status = form.querySelector('[role="status"]');
      if (submit) submit.disabled = true;
      if (status) status.textContent = "Sending to opted-in devices…";
      try {
        const result = await AppController.cloudflareRequest(
          `/api/push/broadcast?tenant=${encodeURIComponent(tenantId)}`,
          { method: "POST", body: JSON.stringify(fields) },
          tenantId
        );
        if (status) status.textContent = result.attempted === 0
          ? "No devices have opted in to notifications yet."
          : `Push service accepted ${result.accepted} request${result.accepted === 1 ? "" : "s"} · ${result.failed} failed, ${result.expired} expired.`;
        form.reset();
      } catch (error) {
        if (status) status.textContent = error instanceof Error ? error.message : "Push broadcast failed.";
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  },

  businessStoreId(tenantId) {
    const key = `ESHOP_BUSINESS_STORE_ID_V1:${tenantId}`;
    let id = window.localStorage.getItem(key);
    if (!id || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
      const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
      id = `device-${[...randomBytes].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
      window.localStorage.setItem(key, id);
    }
    return id;
  },

  mergeRemoteBusinessData(snapshot, branches) {
    const localId = this.businessStoreId(AppController.getActiveTenant().id);
    const others = branches.filter(branch => branch.store_id !== localId);
    const remoteSales = others.flatMap(branch => (branch.snapshot?.sales || []).map(sale => ({
      ...sale, storeId: branch.store_id, storeName: branch.store_name
    })));
    const remoteExpenses = others.flatMap(branch => (branch.snapshot?.expenses || []).map(expense => ({
      ...expense, storeName: branch.store_name
    })));
    const productRows = [...snapshot.products];
    const bySku = new Map(productRows.filter(product => product.sku).map(product => [String(product.sku), product]));
    for (const branch of others) {
      for (const product of branch.snapshot?.products || []) {
        const current = product.sku ? bySku.get(String(product.sku)) : null;
        if (current) {
          if (current.stock != null && product.stock != null) current.stock = Number(current.stock) + Number(product.stock);
        } else {
          const copy = { ...product, stock: product.stock == null ? null : Number(product.stock) };
          productRows.push(copy);
          if (copy.sku) bySku.set(String(copy.sku), copy);
        }
      }
    }
    return {
      ...snapshot,
      products: productRows,
      sales: [...snapshot.sales, ...remoteSales],
      expenses: [...snapshot.expenses, ...remoteExpenses],
      remoteBranches: branches,
      remoteVisits: others.flatMap(branch => branch.snapshot?.visits || []),
      remoteEvents: others.flatMap(branch => branch.snapshot?.events || []),
      remoteNewsletter: others.flatMap(branch => branch.snapshot?.newsletter || []),
      remotePoints: others.flatMap(branch => branch.snapshot?.points || [])
    };
  },

  async loadMainShopWorkspace(path) {
    const content = document.getElementById("store-workspace-content");
    if (!content) return;
    const activeTenant = AppController.getActiveTenant();
    try {
      if (!window.ShopPOS?.listProducts || !window.ShopPOS?.listSales) {
        throw new Error("POS inventory is not ready. Close and reopen the app, then try again.");
      }
      const snapshot = await this.getMainShopSnapshot();
      let renderSnapshot = snapshot;
      try {
        const remoteBranches = JSON.parse(
          window.localStorage.getItem(`ESHOP_BUSINESS_BRANCHES_V1:${AppController.getActiveTenant().id}`) || "[]"
        );
        if (Array.isArray(remoteBranches)) renderSnapshot = this.mergeRemoteBusinessData(snapshot, remoteBranches);
      } catch (error) {
        console.warn("Could not read the cached business branch snapshot.", error);
      }
      const remoteLoads = [];
      const combinedSalesPaths = new Set([
        "/account/main-shop", "/account/main-shop/marketing",
        "/account/main-shop/finance", "/account/main-shop/stores", "/account/main-shop/settings",
        "/account/main-shop/help", "/store/revenue", "/store/channels", "/store/sales",
        "/store/products", "/store/inventory", "/store/categories", "/store/orders",
        "/store/payments", "/account/customers", "/account/customers/loyalty",
        "/account/web/studio/crm/customers", "/account/web/studio/crm/points"
      ]);
      const ordersPage = /\/(?:store\/orders|orders-bookings)(?:\/|$)/.test(path);
      const bookingsPage = /\/(?:store\/bookings|orders-bookings)(?:\/|$)/.test(path);
      if (combinedSalesPaths.has(path) || ordersPage) {
        remoteLoads.push({
          key: "remoteOrders",
          load: () => window.EshopInventoryBridge.listStorefrontOrders(activeTenant.id)
        });
      }
      if (ordersPage) {
        remoteLoads.push({
          key: "remoteDiscounts",
          load: () => window.EshopInventoryBridge.listDiscountCodes(activeTenant.id)
        });
      }
      if (ordersPage || /\/crm\/notifications(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteAlerts",
          load: () => window.BusinessNotifications.owner.list(activeTenant.id)
        });
      }
      const storefrontAnalyticsPaths = new Set([
        "/account/web", "/account/dashboard",
        "/account/web/studio/dashboard/overview",
        "/account/web/studio/dashboard/visits",
        "/account/web/studio/dashboard/traffic",
        "/account/main-shop/visits", "/account/main-shop/traffic"
      ]);
      if (storefrontAnalyticsPaths.has(path)) {
        remoteLoads.push({
          key: "remoteAnalytics",
          load: () => window.EshopInventoryBridge.fetchStorefrontAnalytics(activeTenant.id, this.analyticsDays())
        });
      }
      if (bookingsPage) {
        remoteLoads.push({
          key: "remoteHolds",
          load: () => window.EshopInventoryBridge.listStorefrontHolds(activeTenant.id)
        });
        remoteLoads.push({
          key: "remoteAppointments",
          load: () => window.EshopInventoryBridge.listServiceAppointments(activeTenant.id, this.serviceAppointmentFilter().query)
        });
      }
      if (/\/product-intelligence(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteProductAnalytics",
          load: () => window.EshopInventoryBridge.fetchStorefrontEventAnalytics(activeTenant.id, 30)
        });
      }
      if (/\/(?:newsletter|subscribers)(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteNewsletter",
          load: () => window.EshopInventoryBridge.listNewsletterSubscribers(activeTenant.id)
        });
      }
      if (/\/split-shop(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteAllocations",
          load: () => window.EshopInventoryBridge.request(activeTenant.id, "allocations", "GET")
        });
      }
      const remoteResults = await Promise.allSettled(remoteLoads.map(item => item.load()));
      remoteResults.forEach((result, index) => {
        const key = remoteLoads[index].key;
        if (result.status === "fulfilled") {
          renderSnapshot[key] = key === "remoteOrders"
            ? (Array.isArray(result.value.orders) ? result.value.orders : [])
            : key === "remoteDiscounts"
              ? (Array.isArray(result.value.discounts) ? result.value.discounts : [])
            : key === "remoteHolds"
              ? (Array.isArray(result.value.holds) ? result.value.holds : [])
            : key === "remoteAppointments"
              ? (Array.isArray(result.value.appointments) ? result.value.appointments : [])
            : key === "remoteNewsletter"
              ? (Array.isArray(result.value.subscribers) ? result.value.subscribers : [])
            : key === "remoteAllocations"
              ? (Array.isArray(result.value.allocations) ? result.value.allocations : [])
              : result.value;
          if (key === "remoteAppointments") {
            renderSnapshot.remoteAppointmentsMeta = {
              filter: this.serviceAppointmentFilter().key,
              counts: result.value.counts || null,
              hasMore: result.value.has_more === true,
              fetched: renderSnapshot.remoteAppointments.length
            };
          }
          if (key === "remoteProductAnalytics") {
            renderSnapshot.remoteProductAnalyticsUpdatedAt = new Date().toISOString();
          }
          delete renderSnapshot[`${key}Error`];
        } else {
          renderSnapshot[`${key}Error`] = result.reason instanceof Error
            ? result.reason.message
            : "Could not load live shop data.";
          console.error(`Could not load live ${key} for the active shop.`, result.reason);
        }
      });
      if (Array.isArray(renderSnapshot.remoteOrders) && window.BusinessLens?.mergeStorefrontOrders) {
        renderSnapshot.sales = window.BusinessLens.mergeStorefrontOrders(
          renderSnapshot.sales,
          renderSnapshot.remoteOrders
        );
      }
      this.mainShopSnapshotCache = {
        tenantId: activeTenant.id,
        snapshot: renderSnapshot
      };
      const currentContent = document.getElementById("store-workspace-content");
      if (!currentContent || AppController.currentRoute().split("?")[0] !== path) return;
      currentContent.innerHTML = this.renderMainShopContent(path, renderSnapshot);
      if (/\/split-shop(?:\/|$)/.test(path)) this.bindSplitShopEvents(renderSnapshot, path);
      if (path === "/account/web/studio/websites/webmaker") AppController.bindWebsiteBuilderEvents();
      if (path === "/account/web/studio/websites/add") {
        const additionsForm = currentContent.querySelector("#website-additions-form");
        const saveAdditions = async () => {
          if (!additionsForm) return false;
          const data = new FormData(additionsForm);
          const status = additionsForm.querySelector('[role="status"]');
          const fields = ["instagram_url", "facebook_url", "tiktok_url", "youtube_url", "x_url", "whatsapp_url", "chatbot_url", "location_map_embed_url", "location_map_link"];
          for (const name of fields) {
            const value = String(data.get(name) || "").trim();
            let valid = false;
            try {
              const url = new URL(value);
              valid = url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
            } catch {}
            if (value && !valid) {
              if (status) status.textContent = `${name.replaceAll("_", " ")} must be a valid HTTPS link.`;
              additionsForm.elements.namedItem(name)?.focus();
              return false;
            }
          }
          SQLiteEngine.updateStore({
            phone: String(data.get("phone") || "").trim(),
            whatsapp_enabled: data.get("whatsapp_enabled") === "on" ? 1 : 0,
            chatbot_enabled: data.get("chatbot_enabled") === "on" ? 1 : 0,
            location_name: String(data.get("location_name") || "").trim(),
            location_address: String(data.get("location_address") || "").trim(),
            ...Object.fromEntries(fields.map(name => [name, String(data.get(name) || "").trim()]))
          });
          try {
            AppController.cacheActiveTenantCatalog();
            if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
            await window.ShopSQLite.flush();
            if (status) status.textContent = "Saved on this device. Tap Publish changes here to send these settings live.";
            return true;
          } catch (error) {
            console.error("Website contact settings could not be saved.", error);
            if (status) status.textContent = error.message || "Could not save website additions.";
            return false;
          }
        };
        additionsForm?.addEventListener("submit", async event => {
          event.preventDefault();
          await saveAdditions();
        });
        const publishButton = additionsForm?.querySelector("[data-additions-publish]");
        publishButton?.addEventListener("click", async () => {
          if (!await saveAdditions()) return;
          publishButton.disabled = true;
          const status = additionsForm.querySelector('[role="status"]');
          try {
            const tenantId = AppController.getActiveTenant().id;
            const data = new FormData(additionsForm);
            const phone = String(data.get("phone") || "").trim();
            const store = {
              phone,
              whatsapp_enabled: data.get("whatsapp_enabled") === "on" ? 1 : 0,
              whatsapp_url: String(data.get("whatsapp_url") || "").trim() ||
                (phone.replace(/[^\d]/g, "") ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : ""),
              chatbot_enabled: data.get("chatbot_enabled") === "on" ? 1 : 0,
              location_name: String(data.get("location_name") || "").trim(),
              location_address: String(data.get("location_address") || "").trim(),
              ...Object.fromEntries(["instagram_url", "facebook_url", "tiktok_url", "youtube_url", "x_url", "chatbot_url", "location_map_embed_url", "location_map_link"]
                .map(name => [name, String(data.get(name) || "").trim()]))
            };
            const result = await AppController.cloudflareRequest(
              `/api/catalog?tenant=${encodeURIComponent(tenantId)}`,
              { method: "PATCH", body: JSON.stringify({ store }) },
              tenantId
            );
            if (status) status.textContent = `Published contact and location settings. Existing ${result.product_count} products and ${result.category_count} categories were left unchanged.`;
          } catch (error) {
            if (error.message?.includes("Publish the website catalog before publishing settings")) {
              if (status) status.textContent = "This site needs its first full catalog publish before settings can be published separately.";
              AppController.openCloudflarePublishModal();
            } else {
              console.error("Website settings could not be published.", error);
              if (status) status.textContent = error.message || "Could not publish website settings.";
            }
          } finally {
            publishButton.disabled = false;
          }
        });
      }
      currentContent.querySelectorAll("[data-bulk-removal]").forEach(control => {
        const selectAll = control.querySelector("[data-bulk-select-all]");
        const count = control.querySelector("[data-bulk-selection-count]");
        const removeButton = control.querySelector("[data-bulk-remove]");
        const holdButtons = [...control.querySelectorAll("[data-bulk-product-holds]")];
        const items = [...currentContent.querySelectorAll("[data-bulk-item]")];
        if (!selectAll || !count || !removeButton || !items.length) return;
        const updateSelection = () => {
          const selectedCount = items.filter(item => item.checked).length;
          count.textContent = `${selectedCount} selected`;
          removeButton.disabled = selectedCount === 0;
          holdButtons.forEach(button => { button.disabled = selectedCount === 0; });
          selectAll.checked = selectedCount === items.length;
          selectAll.indeterminate = selectedCount > 0 && selectedCount < items.length;
        };
        selectAll.onchange = () => {
          items.forEach(item => { item.checked = selectAll.checked; });
          updateSelection();
        };
        items.forEach(item => { item.onchange = updateSelection; });
        holdButtons.forEach(button => {
          button.onclick = async () => {
            const selectedIds = items.filter(item => item.checked).map(item => Number(item.dataset.bulkItem));
            if (!selectedIds.length) return;
            const enabled = button.dataset.bulkProductHolds === "enable";
            holdButtons.forEach(action => { action.disabled = true; });
            try {
              const updatedCount = AppController.setWebsiteProductHoldState(selectedIds, enabled);
              if (!updatedCount) throw new Error("No selected active website products could be updated.");
              await window.ShopSQLite.flush();
              await this.loadMainShopWorkspace(path);
              AppUtils.showToast(`${updatedCount} selected product${updatedCount === 1 ? "" : "s"} ${enabled ? "enabled" : "disabled"} for holds. Publish to update the live site.`);
            } catch (error) {
              console.error("Selected website product hold settings could not be updated.", error);
              AppUtils.showToast(error instanceof Error ? error.message : "Selected product hold settings could not be updated.", "danger");
              updateSelection();
            }
          };
        });
        removeButton.onclick = async () => {
          const selectedIds = items.filter(item => item.checked).map(item => Number(item.dataset.bulkItem));
          if (!selectedIds.length) return;
          const isProductList = control.dataset.bulkRemoval === "products";
          const selectedRecords = isProductList
            ? selectedIds.map(id => SQLiteEngine.select("products", product =>
              product.status !== "archived" && Number(product.id) === id
            )[0]).filter(Boolean)
            : selectedIds.map(id => SQLiteEngine.getCategories().find(category => Number(category.id) === id)).filter(Boolean);
          if (!selectedRecords.length) {
            AppUtils.showToast("The selected website items could not be found. Refresh and try again.", "danger");
            return;
          }
          const itemNames = selectedRecords.slice(0, 3).map(item => `"${item.name}"`).join(", ");
          const remainingCount = selectedRecords.length - 3;
          const selectionLabel = `${itemNames}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}`;
          const confirmation = isProductList
            ? `Remove ${selectedRecords.length} product${selectedRecords.length === 1 ? "" : "s"} (${selectionLabel}) from this website? Separate Store/POS inventory records will not be deleted. Publish afterward to update the live site.`
            : `Remove ${selectedRecords.length} categor${selectedRecords.length === 1 ? "y" : "ies"} (${selectionLabel}) from this website? Store/POS categories will not be deleted; products will remain on this website as uncategorized. Publish afterward to update the live site.`;
          if (!window.confirm(confirmation)) return;
          removeButton.disabled = true;
          try {
            if (isProductList) selectedIds.forEach(id => SQLiteEngine.deleteProduct(id));
            else selectedIds.forEach(id => SQLiteEngine.deleteCategory(id));
            await window.ShopSQLite.flush();
            AppController.cacheActiveTenantCatalog();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`${selectedRecords.length} website ${isProductList ? "product" : "categor" + (selectedRecords.length === 1 ? "y" : "ies")} removed. Publish to update the live site.`);
          } catch (error) {
            console.error("Selected website items could not be removed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Selected website items could not be removed.", "danger");
            removeButton.disabled = false;
          }
        };
        updateSelection();
      });
      currentContent.querySelectorAll("[data-store-holds-all]").forEach(button => {
        button.addEventListener("click", async () => {
          const products = SQLiteEngine.select("products", product => product.status !== "archived");
          const productIds = products.map(product => Number(product.id));
          if (!productIds.length) return;
          const enabled = button.dataset.storeHoldsAll === "enable";
          const actionButtons = [...currentContent.querySelectorAll("[data-store-holds-all]")];
          actionButtons.forEach(action => { action.disabled = true; });
          try {
            const updatedCount = AppController.setWebsiteProductHoldState(productIds, enabled);
            if (!updatedCount) throw new Error("No active website products could be updated.");
            await window.ShopSQLite.flush();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`Customer holds ${enabled ? "enabled" : "disabled"} for all ${updatedCount} active website products. Publish to update the live site.`);
          } catch (error) {
            console.error("All website product hold settings could not be updated.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "All product hold settings could not be updated.", "danger");
            actionButtons.forEach(action => { action.disabled = false; });
          }
        });
      });
      document.querySelectorAll(".business-filter").forEach(control => control.addEventListener("change", () => {
        const filters = { ...window.BusinessLens.readFilters(), [control.dataset.filter]: control.value };
        if (control.dataset.filter === "from" || control.dataset.filter === "to") filters.range = "custom";
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      }));
      currentContent.querySelectorAll("[data-business-filter]").forEach(control => control.addEventListener("change", () => {
        const filters = { ...window.BusinessLens.readFilters(), [control.dataset.businessFilter]: control.value };
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      }));
      currentContent.querySelectorAll("[data-business-filter-form]").forEach(form => form.addEventListener("submit", event => {
        event.preventDefault();
        const filters = { ...window.BusinessLens.readFilters(), ...Object.fromEntries(new FormData(form).entries()) };
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      }));
      const businessSettings = currentContent.querySelector("[data-business-settings]");
      if (businessSettings) businessSettings.addEventListener("submit", event => {
        event.preventDefault();
        const formData = new FormData(businessSettings);
        const filters = Object.fromEntries(formData.entries());
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      });
      this.bindBusinessCloudActions(currentContent, path, renderSnapshot, activeTenant.id);
      if (["/store/products/manage", "/store/manage/products"].includes(path)) {
        this.bindMainStoreProductManagement(currentContent, renderSnapshot, path);
      }
      if (path === "/store/manage/categories") this.bindMainStoreCategories(currentContent, renderSnapshot, path);
      const exportButton = currentContent.querySelector('[data-business-export="transactions"]');
      if (exportButton) exportButton.addEventListener("click", () => {
        const headers = ["receipt", "channel", "date", "status", "currency", "total", "collected", "items"];
        const records = renderSnapshot.sales.map(sale => [
          sale.reference, sale.channel, sale.date, sale.status, sale.currency, sale.total, sale.collected,
          sale.lineItems.map(item => `${item.quantity}x ${item.name}`).join("; ")
        ]);
        const csvValue = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const csv = [headers, ...records].map(record => record.map(csvValue).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "business-transactions.csv";
        link.click();
        URL.revokeObjectURL(url);
      });
      const bindForm = (selector, handler) => {
        document.querySelectorAll(selector).forEach(form => form.addEventListener("submit", async event => {
          event.preventDefault();
          const status = form.querySelector('[role="status"]');
          const submit = form.querySelector('button[type="submit"]');
          if (submit) submit.disabled = true;
          if (status) status.textContent = "";
          try {
            await handler(new FormData(form));
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("Main shop update failed.", error);
            if (status) status.textContent = error instanceof Error ? error.message : "The change could not be saved.";
            if (submit) submit.disabled = false;
          }
        }));
      };
      const webProductMediaState = new WeakMap();
      const setWebProductMediaStatus = (form, text) => {
        const element = form.querySelector("[data-web-product-media-status]");
        if (element) element.textContent = text;
      };
      const webProductForm = currentContent.querySelector('[data-studio-form="web-product"]');
      if (webProductForm) {
        const isWebProductField = element =>
          Boolean(element?.matches?.('input:not([type="hidden"]), select, textarea'));
        webProductForm.addEventListener("focusin", event => {
          if (isWebProductField(event.target)) document.body.classList.add("web-product-field-focused");
        });
        webProductForm.addEventListener("focusout", () => {
          requestAnimationFrame(() => {
            if (!isWebProductField(document.activeElement)) {
              document.body.classList.remove("web-product-field-focused");
            }
          });
        });
        const taxonomyHost = webProductForm.querySelector("[data-web-product-taxonomy]");
        const variantsHost = webProductForm.querySelector("[data-web-product-variants]");
        const pricingHost = webProductForm.querySelector("[data-web-product-attribute-pricing]");
        if (!taxonomyHost || !variantsHost || !pricingHost) throw new Error("The Web product form is missing category, options or attribute pricing controls.");
        const websiteCategories = SQLiteEngine.getCategories();
        const bindProductDetails = product => {
          taxonomyHost.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
            categoryId: product?.taxonomy_category_id || "",
            categoryName: product?.taxonomy_category_name || "",
            customCategory: product?.taxonomy_custom_category || "",
            attributes: product?.taxonomy_attributes || [],
            storeCategories: websiteCategories.map(category => ({ value: category.id, name: category.name })),
            storeCategoryFieldName: "categoryId",
            storeCategoryValue: product?.category_id ?? ""
          });
          window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyHost, undefined, {
            onCategoryCreate: async name => {
              let category = SQLiteEngine.getCategories().find(item =>
                item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
              if (!category) {
                SQLiteEngine.saveCategory({ name });
                category = SQLiteEngine.getCategories().find(item =>
                  item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
              }
              if (!category) throw new Error(`Could not save Web category "${name}".`);
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
              return { value: category.id, name: category.name };
            }
          });
          variantsHost.innerHTML = window.EshopProductVariants.createProductVariantFields({
            // Reopening a product must bring back its third option and per-value prices too.
            options: Array.isArray(product?.options) ? product.options : [],
            option1Name: product?.option1_name || "",
            option2Name: product?.option2_name || "",
            sizes: product?.sizes || [],
            colors: product?.colors || [],
            variants: product?.variants || []
          });
          window.EshopProductVariants.bindProductVariantFields(variantsHost.firstElementChild || variantsHost);
          // Charging by attribute: the choices on offer are the chosen category's own attributes.
          pricingHost.innerHTML = window.EshopAttributePricing.createAttributePricingFields({
            pricedAttributes: product?.priced_attributes || []
          });
          window.EshopAttributePricing.bindAttributePricingFields(
            pricingHost.firstElementChild || pricingHost,
            () => window.EshopProductTaxonomy.readAvailableTaxonomyAttributes(webProductForm)
          );
        };
        // Picking a category changes which attributes exist, so the pricing editor is told at once
        // rather than waiting for the form to be reopened.
        webProductForm.addEventListener("product-taxonomy-change", () => {
          pricingHost.firstElementChild?.refreshAttributePricing?.();
        });
        bindProductDetails(null);
        const mediaStatus = webProductForm.querySelector("[data-web-product-media-status]");
        const imageInput = webProductForm.querySelector("[data-web-product-image]");
        const spinModeButton = webProductForm.querySelector('[data-web-product-media-mode="3d"]');
        if (spinModeButton) spinModeButton.textContent = "360° spin";
        const videoOptions = webProductForm.querySelector("[data-web-product-video-options]");
        const videoRecordInput = webProductForm.querySelector("[data-web-product-record-file]");
        const videoPickInput = webProductForm.querySelector("[data-web-product-video-file]");
        const mediaPreview = webProductForm.querySelector("[data-web-product-media-preview]");
        if (imageInput) {
          imageInput.multiple = true;
          const imageLabel = imageInput.closest(".web-product-file");
          if (imageLabel?.firstChild?.nodeType === Node.TEXT_NODE) {
            imageLabel.firstChild.textContent = "Add photos (up to 8) ";
          }
        }
        const spinOptions = document.createElement("div");
        spinOptions.className = "web-product-spin-options";
        spinOptions.hidden = true;
        const spinProfileLabel = document.createElement("label");
        spinProfileLabel.textContent = "360 speed and detail";
        const spinProfileSelect = document.createElement("select");
        spinProfileSelect.name = "spinProfile";
        [
          ["high", "High detail — 36 frames, 720 px"],
          ["balanced", "Balanced — 24 frames, 720 px"],
          ["fast", "Faster — 18 frames, 480 px"]
        ].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          spinProfileSelect.append(option);
        });
        spinProfileLabel.append(spinProfileSelect);
        const spinProfileNote = document.createElement("p");
        spinProfileNote.className = "studio-panel-note";
        spinProfileNote.textContent = "More frames and higher resolution take longer to process.";
        spinOptions.append(spinProfileLabel, spinProfileNote);
        videoOptions.insertAdjacentElement("afterend", spinOptions);
        const nativeMedia = window.EshopNativeMedia;
        const isAndroidApp = nativeMedia?.Capacitor?.getPlatform?.() === "android";
        const media = {
          mode: "keep",
          cutoutPaths: [],
          spinFrames: [],
          videoBlob: null,
          videoPath: "",
          videoPoster: null,
          videoPreviewUrl: "",
          imagePreviewUrls: []
        };
        const setMediaStatus = text => {
          if (mediaStatus) mediaStatus.textContent = text;
        };
        const showMediaProgress = (progress, activity) => {
          if (progress.phase === "model") {
            if (progress.state === "paused") {
              setMediaStatus("Google Play services paused the background-removal model download. Waiting for it to resume…");
            } else if (progress.state === "installing") {
              setMediaStatus("Installing the background-removal model…");
            } else if (progress.state === "downloading" && progress.total > 0) {
              setMediaStatus(`Downloading background-removal model… ${progress.done}%`);
            } else {
              setMediaStatus("Preparing the background-removal model through Google Play services…");
            }
            return;
          }
          setMediaStatus(`${activity} ${progress.done} of ${progress.total}…`);
        };
        const clearMediaPreview = () => {
          if (media.videoPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(media.videoPreviewUrl);
          media.videoPreviewUrl = "";
          media.imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
          media.imagePreviewUrls = [];
          if (mediaPreview) {
            mediaPreview.replaceChildren();
            mediaPreview.hidden = true;
          }
        };
        const showImagePreviews = (urls, spin = false) => {
          clearMediaPreview();
          if (!mediaPreview || !urls.length) return;
          media.imagePreviewUrls = urls.filter(url => url.startsWith("blob:"));
          const images = spin ? urls.slice(0, 1) : urls;
          images.forEach((url, imageIndex) => {
            const image = document.createElement("img");
            image.src = url;
            image.alt = spin ? "Drag to rotate the 3D product preview" : `Processed product image ${imageIndex + 1}`;
            if (spin) {
              image.dataset.spinPreview = "";
              let frame = 0;
              let pointerId = -1;
              let lastX = 0;
              image.addEventListener("pointerdown", event => {
                pointerId = event.pointerId;
                lastX = event.clientX;
                image.setPointerCapture(pointerId);
              });
              image.addEventListener("pointermove", event => {
                if (event.pointerId !== pointerId) return;
                const step = Math.trunc((event.clientX - lastX) / 6);
                if (!step) return;
                frame = ((frame - step % urls.length) % urls.length + urls.length) % urls.length;
                lastX = event.clientX;
                image.src = urls[frame];
              });
              image.addEventListener("pointerup", () => { pointerId = -1; });
              image.addEventListener("pointercancel", () => { pointerId = -1; });
              image.title = "Drag left or right to rotate";
            }
            mediaPreview.append(image);
          });
          mediaPreview.hidden = false;
        };
        const showVideoPreview = file => {
          clearMediaPreview();
          if (!mediaPreview) return;
          media.videoPreviewUrl = URL.createObjectURL(file);
          const video = document.createElement("video");
          video.src = media.videoPreviewUrl;
          video.controls = true;
          video.playsInline = true;
          video.setAttribute("aria-label", "Selected product video");
          mediaPreview.append(video);
          mediaPreview.hidden = false;
        };
        const setMediaError = error => {
          setMediaStatus(error instanceof Error ? error.message : "Product media could not be processed.");
        };
        const nativeFileUrl = path => nativeMedia.Capacitor.convertFileSrc(path);
        const makeVideoPoster = async file => {
          const sourceUrl = URL.createObjectURL(file);
          const video = document.createElement("video");
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.src = sourceUrl;
          try {
            await new Promise((resolve, reject) => {
              if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                resolve();
                return;
              }
              video.addEventListener("loadeddata", resolve, { once: true });
              video.addEventListener("error", () => reject(new Error("The video preview could not be decoded.")), { once: true });
            });
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("A video thumbnail could not be created.");
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve, reject) => canvas.toBlob(
              value => value ? resolve(value) : reject(new Error("A video thumbnail could not be created.")),
              "image/webp",
              0.82
            ));
            return new File([blob], "product-video-poster.webp", { type: blob.type });
          } finally {
            video.pause();
            video.removeAttribute("src");
            URL.revokeObjectURL(sourceUrl);
          }
        };
        const processCutoutImages = async paths => {
          if (!paths.length) return;
          setMediaStatus("Preparing Google Play services background removal…");
          const listener = await nativeMedia.ProductCutout.addListener("progress", progress => {
            showMediaProgress(progress, "Removing backgrounds");
          });
          try {
            const result = await nativeMedia.ProductCutout.cutoutImages({ paths, width: 1200 });
            media.cutoutPaths = result.images;
            showImagePreviews(result.images.map(nativeFileUrl));
            setMediaStatus(`${result.images.length} cutout image${result.images.length === 1 ? "" : "s"} ready to save.`);
          } finally {
            await listener.remove();
          }
        };
        const chooseCutoutImages = async () => {
          try {
            setMediaStatus("Choose up to 8 product photos.");
            const result = await nativeMedia.Camera.chooseFromGallery({
              mediaType: nativeMedia.MediaTypeSelection.Photo,
              allowMultipleSelection: true,
              limit: 8,
              quality: 100
            });
            const paths = (result.results || []).map(item => item.uri).filter(Boolean).slice(0, 8);
            if (!paths.length) {
              setMediaStatus("No product photos were selected.");
              return;
            }
            await processCutoutImages(paths);
          } catch (error) {
            setMediaError(error);
          }
        };
        const selectedVideoBlob = async item => {
          if (item instanceof Blob) return item;
          const path = item.webPath || nativeMedia.Capacitor.convertFileSrc(item.uri || "");
          const response = await fetch(path);
          if (!response.ok) throw new Error("The selected video could not be opened.");
          const blob = await response.blob();
          const uri = String(item.uri || item.webPath || "");
          const extension = uri.split(/[?#]/)[0].split(".").pop()?.toLowerCase() || "";
          const format = String(item.metadata?.format || extension).toLowerCase();
          const formats = {
            mp4: { type: "video/mp4", extension: "mp4" },
            m4v: { type: "video/mp4", extension: "mp4" },
            webm: { type: "video/webm", extension: "webm" },
            mov: { type: "video/quicktime", extension: "mov" },
            quicktime: { type: "video/quicktime", extension: "mov" }
          };
          const match = formats[format];
          const contentType = blob.type.startsWith("video/") ? blob.type : match?.type;
          if (!contentType || !["video/mp4", "video/webm", "video/quicktime"].includes(contentType)) {
            throw new Error("This video format is not supported. Choose an MP4, WebM, or QuickTime video.");
          }
          const fileExtension = contentType === "video/webm" ? "webm" : contentType === "video/quicktime" ? "mov" : "mp4";
          return new File([blob], `product-video.${match?.extension || fileExtension}`, { type: contentType });
        };
        const chooseVideo = async record => {
          try {
            if (!isAndroidApp) {
              (record ? videoRecordInput : videoPickInput).click();
              return;
            }
            setMediaStatus(record ? "Opening video camera…" : "Opening video gallery…");
            const selected = record
              ? await nativeMedia.Camera.recordVideo({ isPersistent: true, includeMetadata: true })
              : (await nativeMedia.Camera.chooseFromGallery({
                mediaType: nativeMedia.MediaTypeSelection.Video,
                includeMetadata: true
              })).results?.[0];
            if (!selected?.uri) {
              setMediaStatus("No video was selected.");
              return;
            }
            if (media.mode === "3d") {
              const spinProfiles = {
                high: { count: 36, width: 720 },
                balanced: { count: 24, width: 720 },
                fast: { count: 18, width: 480 }
              };
              const spinProfile = spinProfiles[spinProfileSelect.value] || spinProfiles.high;
              setMediaStatus(`Preparing the model and generating ${spinProfile.count} 360 frames…`);
              const listener = await nativeMedia.ProductCutout.addListener("progress", progress => {
                showMediaProgress(progress, "Processing 360 frames");
              });
              try {
                const result = await nativeMedia.ProductCutout.processVideo({
                  path: selected.uri,
                  ...spinProfile
                });
                media.spinFrames = result.frames;
                showImagePreviews(result.frames.map(nativeFileUrl), true);
                setMediaStatus(`${result.frames.length} 360 frames ready. Drag the preview to check it.`);
              } finally {
                await listener.remove();
              }
              return;
            }
            media.videoBlob = await selectedVideoBlob(selected);
            const extension = media.videoBlob.name.split(".").pop()?.toLowerCase();
            if (!["mp4", "webm", "mov"].includes(extension)) {
              throw new Error("This video format is not supported. Choose an MP4, WebM, or QuickTime video.");
            }
            const persistentVideo = await nativeMedia.ProductCutout.persistVideo({
              path: selected.uri,
              extension
            });
            media.videoPath = `${LOCAL_PRODUCT_MEDIA_PREFIX}${persistentVideo.path}`;
            try {
              media.videoPoster = await makeVideoPoster(media.videoBlob);
            } catch (error) {
              media.videoPoster = null;
              setMediaStatus(`Video selected. A preview image could not be made: ${error.message}`);
            }
            showVideoPreview(media.videoBlob);
            if (media.videoPoster) setMediaStatus(`${media.videoBlob.name} selected.`);
          } catch (error) {
            setMediaError(error);
          }
        };
        const resetMediaSelection = () => {
          media.cutoutPaths = [];
          media.spinFrames = [];
          media.videoBlob = null;
          media.videoPath = "";
          media.videoPoster = null;
          clearMediaPreview();
          if (imageInput) imageInput.value = "";
          videoRecordInput.value = "";
          videoPickInput.value = "";
        };
        const updateMediaMode = mode => {
          media.mode = mode;
          resetMediaSelection();
          webProductForm.querySelectorAll("[data-web-product-media-mode]").forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.webProductMediaMode === mode));
          });
          const videoMode = mode === "3d" || mode === "video";
          videoOptions.hidden = !videoMode;
          spinOptions.hidden = mode !== "3d";
          if (imageInput) imageInput.disabled = videoMode;
          setMediaStatus(mode === "3d"
            ? isAndroidApp
              ? "Record or choose a video. Craft will create 36 transparent spin frames on this Android device."
              : "3D processing requires the Android Craft app and Google Play services."
            : mode === "video"
              ? "Record or choose a product video. MP4, WebM, and QuickTime are supported."
              : mode === "cutout"
                ? isAndroidApp
                  ? "Choose product photos for on-device ML Kit background removal."
                  : "Cutout requires the Android Craft app and Google Play services."
                : "Keep the selected image as-is.");
        };
        const productMediaUrl = reference => {
          const value = String(reference || "");
          if (!value.startsWith(LOCAL_PRODUCT_MEDIA_PREFIX)) return value;
          return nativeMedia?.Capacitor ? nativeFileUrl(value.slice(LOCAL_PRODUCT_MEDIA_PREFIX.length)) : "";
        };
        const showExistingProductMedia = product => {
          const images = Array.isArray(product.images) ? product.images : [];
          if (media.mode === "3d" && Array.isArray(product.spin_frames) && product.spin_frames.length) {
            showImagePreviews(product.spin_frames.map(productMediaUrl).filter(Boolean), true);
          } else {
            showImagePreviews(images.map(productMediaUrl).filter(Boolean));
          }
          setMediaStatus("Existing media will be kept unless you choose replacement media.");
        };
        // A service is a property of the product: the form says so per item, not per shop.
        const applyWebItemType = () => {
          const typeField = webProductForm.querySelector("[data-web-product-item-type]");
          const durationField = webProductForm.querySelector("[data-web-product-duration]");
          const stockField = webProductForm.querySelector("[data-web-product-stock]");
          const stockInput = stockField?.querySelector('[name="stock"]');
          const isService = typeField?.value === "service";
          if (durationField) durationField.hidden = !isService;
          if (stockField) stockField.hidden = isService;
          // A hidden required field would refuse the save with nothing on screen to fix.
          if (stockInput) stockInput.required = !isService;
        };
        webProductForm.querySelector("[data-web-product-item-type]")?.addEventListener("change", applyWebItemType);
        const setEditingProduct = product => {
          webProductForm.reset();
          webProductForm.querySelector('[name="productId"]').value = String(product.id);
          webProductForm.querySelector("h2").textContent = "Edit web product";
          webProductForm.querySelector('button[type="submit"]').textContent = "Save changes";
          webProductForm.querySelector("[data-web-product-cancel]").hidden = false;
          webProductForm.querySelector('[name="name"]').value = product.name || "";
          webProductForm.querySelector('[name="price"]').value = product.price ?? "";
          webProductForm.querySelector('[name="costPrice"]').value = product.cost_price ?? "";
          webProductForm.querySelector('[name="stock"]').value = product.stock ?? 0;
          webProductForm.querySelector('[name="booking_enabled"]').checked = Boolean(product.booking_enabled);
          const savedMinutes = window.EshopServiceModel.serviceDuration(product);
          webProductForm.querySelector("[data-web-product-item-type]").value = savedMinutes ? "service" : "product";
          if (savedMinutes) webProductForm.querySelector('[name="durationMinutes"]').value = String(savedMinutes);
          applyWebItemType();
          bindProductDetails(product);
          const mediaMode = product.media_type === "spin" ? "3d"
            : ["video", "cutout"].includes(product.media_type) ? product.media_type : "keep";
          updateMediaMode(mediaMode);
          media.videoPath = mediaMode === "video" ? product.video_path || "" : "";
          showExistingProductMedia(product);
          webProductForm.querySelector('[name="name"]').focus();
        };
        const resetProductEdit = () => {
          webProductForm.reset();
          webProductForm.querySelector('[name="productId"]').value = "";
          webProductForm.querySelector("h2").textContent = "Create web-only product";
          webProductForm.querySelector('button[type="submit"]').textContent = "Save web product";
          webProductForm.querySelector("[data-web-product-cancel]").hidden = true;
          bindProductDetails(null);
          updateMediaMode("keep");
          applyWebItemType();
        };
        currentContent.querySelectorAll("[data-edit-web-product]").forEach(button => {
          button.addEventListener("click", () => {
            const product = SQLiteEngine.getProductById(Number(button.dataset.editWebProduct));
            if (!product) {
              AppUtils.showToast("Product not found. Refresh the Store workspace and try again.", "danger");
              return;
            }
            webProductForm.hidden = false;
            setEditingProduct(product);
          });
        });
        webProductForm.querySelector("[data-web-product-cancel]")?.addEventListener("click", () => {
          resetProductEdit();
          webProductForm.querySelector('[name="name"]').focus();
        });
        webProductForm.querySelectorAll("[data-web-product-media-mode]").forEach(button => {
          button.addEventListener("click", () => updateMediaMode(button.dataset.webProductMediaMode));
        });
        imageInput?.addEventListener("click", event => {
          if (media.mode === "cutout" && isAndroidApp) {
            event.preventDefault();
            void chooseCutoutImages();
          }
        });
        webProductForm.querySelector("[data-web-product-video-record]")?.addEventListener("click", () => {
          void chooseVideo(true);
        });
        webProductForm.querySelector("[data-web-product-video-pick]")?.addEventListener("click", () => {
          void chooseVideo(false);
        });
        for (const input of [videoRecordInput, videoPickInput]) {
          input?.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            if (media.mode === "3d") {
              setMediaStatus("3D frame processing is currently available in the Android Craft app.");
              return;
            }
            try {
              media.videoBlob = file;
              try {
                media.videoPoster = await makeVideoPoster(file);
              } catch (error) {
                media.videoPoster = null;
                setMediaStatus(`Video selected. A preview image could not be made: ${error.message}`);
              }
              showVideoPreview(file);
              if (media.videoPoster) setMediaStatus(`${file.name} selected.`);
            } catch (error) {
              setMediaError(error);
            }
          });
        }
        imageInput?.addEventListener("change", () => {
          const files = Array.from(imageInput.files || []);
          if (!files.length) return;
          if (files.length > 8) {
            imageInput.value = "";
            clearMediaPreview();
            setMediaStatus("Choose up to 8 product photos.");
            return;
          }
          if (media.mode === "cutout") {
            setMediaStatus(isAndroidApp
              ? "Use Add file to choose photos from the Android gallery for cutout."
              : "Cutout requires the Android Craft app and Google Play services.");
            return;
          }
          showImagePreviews(files.map(file => URL.createObjectURL(file)));
          setMediaStatus(`${files.length} product photo${files.length === 1 ? "" : "s"} selected.`);
        });
        webProductMediaState.set(webProductForm, media);
      }
      document.querySelectorAll("[data-studio-form]").forEach(form => {
        form.addEventListener("submit", async event => {
          event.preventDefault();
          const data = new FormData(form);
          const status = form.querySelector('[role="status"]');
          const button = form.querySelector('button[type="submit"]');
          if (button) button.disabled = true;
          if (status) status.textContent = "";
          try {
            const kind = form.dataset.studioForm;
            const wasEditingWebProduct = kind === "web-product" && String(data.get("productId") || "").trim() !== "";
            if (kind === "web-category") {
              const name = String(data.get("name") || "").trim();
              if (!name) throw new Error("Enter a category name.");
              if (SQLiteEngine.getCategories().some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
                throw new Error("That website category already exists.");
              }
              SQLiteEngine.saveCategory({ name });
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            } else if (kind === "web-product") {
              const mediaMode = form.querySelector('[data-web-product-media-mode][aria-pressed="true"]')?.dataset.webProductMediaMode || "keep";
              const media = webProductMediaState.get(form);
              const productIdText = String(data.get("productId") || "").trim();
              const productId = productIdText ? Number(productIdText) : null;
              const existingProduct = productIdText && Number.isSafeInteger(productId) && productId > 0
                ? SQLiteEngine.getProductById(productId)
                : null;
              if (productIdText && !existingProduct) throw new Error("That Web product could not be found. Refresh and try again.");
              const name = String(data.get("name") || "").trim();
              const price = Number(data.get("price"));
              const costText = String(data.get("costPrice") || "").trim();
              const costPrice = costText === "" ? null : Number(costText);
              const stock = Number(data.get("stock"));
              const categoryId = Number(data.get("categoryId"));
              const taxonomy = window.EshopProductTaxonomy.readProductTaxonomyFields(form);
              // A service is sold as time, so it carries a duration and counts no stock.
              const sellsTime = String(data.get("itemType") || "product") === "service";
              const durationMinutes = sellsTime
                ? window.EshopServiceModel.normalizeServiceDuration(data.get("durationMinutes")) ||
                  window.EshopServiceModel.DEFAULT_SERVICE_MINUTES
                : 0;
              if (sellsTime && !durationMinutes) throw new Error("Choose how long this service takes.");
              if (!name || !Number.isFinite(price) || price < 0 ||
                (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
                (!sellsTime && (!Number.isSafeInteger(stock) || stock < 0)) ||
                !Number.isSafeInteger(categoryId) ||
                !SQLiteEngine.getCategories().some(category => Number(category.id) === categoryId)) {
                throw new Error("Enter a product name, category, valid prices, and whole-number stock quantity.");
              }
              if (!media) throw new Error("Product media could not be initialized. Reopen the product form and try again.");
              const productVariants = window.EshopProductVariants.readProductVariantFields(form);
              const pricedAttributes = window.EshopAttributePricing.readAttributePricingFields(
                form.querySelector("[data-attribute-pricing]")
              );
              const imageFiles = data.getAll("image").filter(file => file instanceof File && file.size > 0);
              if (imageFiles.length > 8) throw new Error("Choose up to 8 product photos.");
              const existingImages = Array.isArray(existingProduct?.images) ? existingProduct.images.slice(0, 8) : [];
              const isExistingPhotoProduct = !existingProduct?.media_type || existingProduct.media_type === "image";
              let images = mediaMode === "keep" && isExistingPhotoProduct ? existingImages : [];
              let spinFrames = [];
              let videoPath = "";
              let videoUrl = "";
              if (imageFiles.length) {
                if (mediaMode === "keep") {
                  setWebProductMediaStatus(form, "Compressing product image for local SQLite storage…");
                  images = [];
                  for (const imageFile of imageFiles) {
                    images.push(await AppUtils.compressImageFile(imageFile));
                  }
                } else if (mediaMode === "cutout") {
                  throw new Error("Choose photos from the Android gallery to create cutout images.");
                }
              }
              if (mediaMode === "cutout") {
                if (window.EshopNativeMedia?.Capacitor?.getPlatform?.() !== "android") {
                  throw new Error("Cutout requires the Android Craft app and Google Play services.");
                }
                if (media.cutoutPaths.length) {
                  images = media.cutoutPaths.map(path => `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
                } else if (existingProduct?.media_type === "cutout" && existingImages.length) {
                  images = existingImages;
                } else {
                  throw new Error("Choose at least one product photo for cutout.");
                }
              } else if (mediaMode === "3d") {
                if (media.spinFrames.length) {
                  spinFrames = media.spinFrames.map(path => `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
                  images = spinFrames.length ? [spinFrames[0]] : [];
                } else if (existingProduct?.media_type === "spin" && Array.isArray(existingProduct.spin_frames) && existingProduct.spin_frames.length) {
                  spinFrames = existingProduct.spin_frames.slice();
                  images = existingImages;
                } else {
                  throw new Error("Record or choose a video to generate the 360 spin frames.");
                }
              } else if (mediaMode === "video") {
                if (media.videoBlob instanceof Blob && media.videoBlob.size) {
                  setWebProductMediaStatus(form, "Saving product video to local storage…");
                  videoPath = media.videoPath || await AppUtils.storeLocalProductVideo(media.videoBlob);
                  if (media.videoPoster) {
                    images = [await AppUtils.compressImageFile(media.videoPoster)];
                  }
                } else if (existingProduct?.media_type === "video" &&
                  (media.videoPath || existingProduct.video_path || existingProduct.video_url)) {
                  videoPath = media.videoPath || existingProduct.video_path;
                  images = existingImages;
                  videoUrl = existingProduct.video_url || "";
                } else {
                  throw new Error("Record or choose a product video before saving.");
                }
              }
              SQLiteEngine.saveProduct({
                ...(existingProduct ? { id: existingProduct.id, sku: existingProduct.sku } : {}),
                name, category_id: categoryId,
                price,
                stock: sellsTime ? null : productVariants.stock ?? stock,
                duration_minutes: sellsTime ? durationMinutes : null,
                cost_price: costPrice ?? 0,
                taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
                taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
                taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
                taxonomy_attributes: taxonomy.taxonomyAttributes,
                priced_attributes: pricedAttributes,
                ...productVariants,
                booking_enabled: data.get("booking_enabled") === "on",
                description: existingProduct?.description || "",
                images,
                media_type: mediaMode === "keep" ? "image" : mediaMode === "3d" ? "spin" : mediaMode,
                spin_frames: spinFrames,
                video_url: videoUrl,
                video_path: videoPath,
                status: existingProduct?.status || "active"
              });
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            } else if (kind === "loyalty-settings") {
              const visits = Number(data.get("pointsPerVisit"));
              const spend = Number(data.get("pointsPerCurrency"));
              if (!Number.isSafeInteger(visits) || visits < 0 || !Number.isSafeInteger(spend) || spend < 0) throw new Error("Points rules must be zero or a positive whole number.");
              this.setWorkspaceSetting("points_per_visit", visits);
              this.setWorkspaceSetting("points_per_currency", spend);
              await window.ShopSQLite.flush();
            } else if (kind === "points-adjust") {
              const customerKey = String(data.get("customerKey") || "");
              const manualValue = String(data.get("delta") || "").trim();
              const manualDelta = manualValue ? Number(manualValue) : 0;
              const purchaseValue = String(data.get("purchaseAmount") || "").trim();
              const purchaseAmount = purchaseValue ? Number(purchaseValue) : 0;
              const reason = String(data.get("reason") || "").trim();
              const pointsPerCurrency = Number(this.getWorkspaceSetting("points_per_currency", 0));
              const pointsPerVisit = Number(this.getWorkspaceSetting("points_per_visit", 0));
              const purchasePoints = purchaseValue ? Math.floor(purchaseAmount) * pointsPerCurrency : 0;
              const visitPoints = data.get("verifiedVisit") === "yes" ? pointsPerVisit : 0;
              const delta = manualDelta + purchasePoints + visitPoints;
              if (!customerKey || (manualValue && (!Number.isSafeInteger(manualDelta) || manualDelta === 0 || !reason))
                || (purchaseValue && (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0))
                || (!manualValue && !purchaseValue && !visitPoints) || !Number.isSafeInteger(delta) || delta === 0) {
                throw new Error("Choose a customer and enter a valid purchase, verified visit, or manual adjustment. Manual adjustments need a reason.");
              }
              const customer = this.getWorkspaceCustomers(snapshot.sales).find(item => item.key === customerKey);
              if (!customer) throw new Error("Customer not found. Refresh and try again.");
              if (customer.points + delta < 0) throw new Error("Points balance cannot be negative.");
              const reasons = [];
              if (purchasePoints) reasons.push(`Verified paid purchase (${purchaseAmount} ${snapshot.currency || "KES"})`);
              if (visitPoints) reasons.push("Verified visit");
              if (manualDelta) reasons.push(reason);
              SQLiteEngine.insert("customer_points", { tenant_id: activeTenant.id, customer_key: customerKey, customer_name: customer.name, delta, reason: reasons.join(" · "), created_at: new Date().toISOString() });
              await window.ShopSQLite.flush();
            } else if (kind === "booking-settings") {
              const hours = Number(data.get("maxHoldHours"));
              if (!Number.isSafeInteger(hours) || hours < 1 || hours > 720) throw new Error("Hold duration must be between 1 and 720 hours.");
              this.setWorkspaceSetting("max_hold_hours", hours);
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            } else if (kind === "booking-create") {
              const product = SQLiteEngine.getProductById(Number(data.get("productId")));
              const quantity = Number(data.get("quantity"));
              const hours = Number(data.get("hours"));
              const maxHours = Number(this.getWorkspaceSetting("max_hold_hours", 24));
              const customerName = String(data.get("customerName") || "").trim();
              const contact = String(data.get("contact") || "").trim();
              if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(hours) || hours < 1 || hours > maxHours || !customerName || !contact) throw new Error("Check the product, quantity, customer, contact, and hold duration.");
              if (product.stock != null && Number(product.stock) < quantity) throw new Error("The website stock is lower than the requested hold quantity.");
              const createdAt = new Date();
              SQLiteEngine.insert("booking_holds", {
                tenant_id: activeTenant.id,
                product_id: product.id, product_name: product.name, quantity,
                customer_name: customerName, contact, status: "on hold",
                created_at: createdAt.toISOString(), expires_at: new Date(createdAt.getTime() + hours * 3600000).toISOString()
              });
              await window.ShopSQLite.flush();
            } else if (kind === "newsletter-add") {
              const email = String(data.get("email") || "").trim().toLocaleLowerCase();
              if (!email) throw new Error("Enter an email address.");
              if (SQLiteEngine.select("newsletter_subscribers", item => item.tenant_id === activeTenant.id && item.email.toLocaleLowerCase() === email).length) throw new Error("This email is already subscribed.");
              SQLiteEngine.insert("newsletter_subscribers", { tenant_id: activeTenant.id, name: String(data.get("name") || "").trim(), email, created_at: new Date().toISOString() });
              await window.ShopSQLite.flush();
            } else if (kind === "newsletter-draft") {
              const subject = String(data.get("subject") || "").trim();
              const message = String(data.get("message") || "").trim();
              if (!subject || !message) throw new Error("Enter both a subject and message.");
              this.setWorkspaceSetting("newsletter_draft", { subject, message, saved_at: new Date().toISOString() });
              await window.ShopSQLite.flush();
            } else {
              throw new Error("This action is not available.");
            }
            await this.loadMainShopWorkspace(path);
            if (kind === "web-product" && !wasEditingWebProduct) {
              const nextProductForm = document.querySelector('[data-studio-form="web-product"]');
              if (nextProductForm) {
                nextProductForm.hidden = false;
                nextProductForm.querySelector('[name="name"]')?.focus();
              }
            }
          } catch (error) {
            console.error("Studio workspace action failed.", error);
            if (status) status.textContent = error instanceof Error ? error.message : "The change could not be saved.";
            if (button) button.disabled = false;
          }
        });
      });
      currentContent.querySelectorAll("[data-web-product-booking]").forEach(input => {
        input.addEventListener("change", async () => {
          const productId = Number(input.dataset.webProductBooking);
          const product = SQLiteEngine.getProductById(productId);
          if (!product) {
            AppUtils.showToast("Product not found. Refresh the Store workspace and try again.", "danger");
            input.checked = false;
            return;
          }
          input.disabled = true;
          try {
            if (!AppController.setWebsiteProductHoldState([productId], input.checked)) {
              throw new Error("Product not found. Refresh the Store workspace and try again.");
            }
            await window.ShopSQLite.flush();
            AppUtils.showToast(`Customer holds ${input.checked ? "enabled" : "disabled"} for ${product.name}. Publish the storefront to apply this change.`);
          } catch (error) {
            input.checked = !input.checked;
            AppUtils.showToast(error instanceof Error ? error.message : "The product hold setting could not be saved.", "danger");
          } finally {
            input.disabled = false;
          }
        });
      });
      document.getElementById("store-add-product-trigger")?.addEventListener("click", () => {
        const form = document.querySelector("[data-store-web-import]");
        if (form) form.hidden = !form.hidden;
      });
      document.getElementById("store-create-web-product")?.addEventListener("click", () => {
        const form = document.querySelector('[data-studio-form="web-product"]');
        if (form) {
          form.hidden = !form.hidden;
          form.querySelector('[name="name"]')?.focus();
        }
      });
      document.querySelectorAll("[data-release-hold]").forEach(button => button.addEventListener("click", async () => {
        const id = Number(button.dataset.releaseHold);
        SQLiteEngine.update("booking_holds", hold => hold.tenant_id === activeTenant.id && Number(hold.id) === id, hold => ({ ...hold, status: "released", released_at: new Date().toISOString() }));
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
      }));
      document.querySelectorAll("[data-remove-subscriber]").forEach(button => button.addEventListener("click", async () => {
        SQLiteEngine.delete("newsletter_subscribers", item => item.tenant_id === activeTenant.id && Number(item.id) === Number(button.dataset.removeSubscriber));
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
      }));
      bindForm(".store-product-form", async data => {
        const imageFile = data.get("productImage");
        let imageUri = "";
        if (imageFile instanceof File && imageFile.size > 0) {
          imageUri = await AppUtils.compressImageFile(imageFile);
        }
        let posCategory = (await window.ShopPOS.listCategories()).find(category =>
          category.name.trim().toLocaleLowerCase() === String(data.get("categoryName")).trim().toLocaleLowerCase());
        if (!posCategory) {
          await window.ShopPOS.addCategory(data.get("categoryName"));
          posCategory = (await window.ShopPOS.listCategories()).find(category =>
            category.name.trim().toLocaleLowerCase() === String(data.get("categoryName")).trim().toLocaleLowerCase());
        }
        if (!posCategory) throw new Error("The selected category could not be created in POS.");
        const id = await window.ShopPOS.saveProduct({
          name: data.get("name"), categoryId: posCategory.id, price: Number(data.get("price")),
          buyingPrice: data.get("buyingPrice"), stock: Number(data.get("stock")), imageUri
        });
        const product = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === Number(id));
        if (!product) throw new Error("The POS product saved, but could not be reloaded for the website catalog.");
        await this.publishPosProduct(product);
      });
      const syncExistingProduct = async (product, targetCategoryName = "") => {
        if (!product.posProductId && product.webProductId) {
          await this.addWebsiteProductToPos(product.webProductId);
        } else if (product.posProductId && !product.webProductId) {
          const posProduct = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === product.posProductId);
          if (!posProduct) throw new Error("That POS product no longer exists. Refresh the Store screen.");
          await this.publishPosProduct(posProduct);
        }
        if (!targetCategoryName || targetCategoryName.toLocaleLowerCase() === product.categoryName.toLocaleLowerCase()) return;
        const posCategories = await window.ShopPOS.listCategories();
        let posCategory = posCategories.find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        if (!posCategory) {
          await window.ShopPOS.addCategory(targetCategoryName);
          posCategory = (await window.ShopPOS.listCategories()).find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        }
        let webCategory = SQLiteEngine.getCategories().find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        if (!webCategory) {
          SQLiteEngine.saveCategory({ name: targetCategoryName });
          webCategory = SQLiteEngine.getCategories().find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        }
        if (!posCategory || !webCategory) throw new Error("Could not add the selected category to both catalogs.");
        const posProduct = (await window.ShopPOS.listProducts()).find(item =>
          (product.posProductId && Number(item.id) === product.posProductId)
          || (product.sku && item.sku.toLocaleUpperCase() === product.sku.toLocaleUpperCase())
          || item.name.toLocaleLowerCase() === product.name.toLocaleLowerCase());
        const webProduct = SQLiteEngine.select("products").find(item =>
          (product.webProductId && Number(item.id) === product.webProductId)
          || (product.sku && String(item.sku || "").toLocaleUpperCase() === product.sku.toLocaleUpperCase())
          || item.name.toLocaleLowerCase() === product.name.toLocaleLowerCase());
        if (posProduct) await window.ShopPOS.saveProduct({ ...posProduct, categoryId: posCategory.id });
        if (webProduct) SQLiteEngine.saveProduct({ ...webProduct, category_id: webCategory.id });
        await window.ShopSQLite.flush();
        AppController.cacheActiveTenantCatalog();
      };
      document.querySelectorAll(".store-existing-product-form").forEach(form => {
        if (form.matches("[data-store-web-import]")) {
          const selectAll = form.querySelector("[data-store-import-select-all]");
          const products = [...form.querySelectorAll("[data-store-import-product]")];
          const submitButton = form.querySelector('button[type="submit"]');
          const selectionCount = form.querySelector("[data-store-import-count]");
          const updateSelection = () => {
            const selectedCount = products.filter(input => input.checked).length;
            if (selectionCount) selectionCount.textContent = `${selectedCount} selected`;
            if (submitButton) submitButton.disabled = selectedCount === 0;
            if (selectAll) {
              selectAll.checked = products.length > 0 && selectedCount === products.length;
              selectAll.indeterminate = selectedCount > 0 && selectedCount < products.length;
            }
          };
          selectAll?.addEventListener("change", () => {
            products.forEach(input => { input.checked = selectAll.checked; });
            updateSelection();
          });
          products.forEach(input => input.addEventListener("change", updateSelection));
          updateSelection();
        }
        form.addEventListener("submit", async event => {
          event.preventDefault();
          const status = form.querySelector('[role="status"]');
          const button = form.querySelector('button[type="submit"]');
          if (form.matches("[data-store-web-import]")) {
            const selectedProducts = [...form.querySelectorAll("[data-store-import-product]:checked")]
              .map(input => snapshot.products[Number(input.dataset.storeImportProduct)])
              .filter(Boolean);
            if (!selectedProducts.length) {
              if (status) status.textContent = "Select at least one Store product.";
              return;
            }
            button.disabled = true;
            if (status) status.textContent = `Adding ${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"}…`;
            let addedCount = 0;
            try {
              for (const product of selectedProducts) {
                await syncExistingProduct(product);
                addedCount += 1;
              }
              await this.loadMainShopWorkspace(path);
              AppUtils.showToast(`${addedCount} Store product${addedCount === 1 ? "" : "s"} added to this website.`);
            } catch (error) {
              console.error("Selected Store products could not all be added.", error);
              if (status) status.textContent = `${addedCount} of ${selectedProducts.length} products added. ${error instanceof Error ? error.message : "The remaining products could not be added."}`;
              button.disabled = false;
              AppUtils.showToast("Some selected Store products could not be added. Review the message and retry.", "danger");
            }
            return;
          }
          const selectedValue = new FormData(form).get("existingProduct");
          const selectedIndex = selectedValue === "" ? -1 : Number(selectedValue);
          const selectedProduct = snapshot.products[selectedIndex];
          if (!selectedProduct) {
            if (status) status.textContent = "Choose a product from inventory.";
            return;
          }
          button.disabled = true;
          if (status) status.textContent = "";
          try {
            await syncExistingProduct(selectedProduct, form.dataset.categoryName || "");
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast("Product added from inventory and synced to POS and Web.");
          } catch (error) {
            console.error("Existing inventory product could not be added.", error);
            if (status) status.textContent = error instanceof Error ? error.message : "Product could not be added.";
            button.disabled = false;
          }
        });
      });
      const addProductTrigger = document.getElementById("store-add-product-trigger");
      const newProductForm = document.getElementById("store-product-form");
      const mainExistingForm = document.querySelector("#store-workspace-content > .store-existing-product-form");
      if (addProductTrigger && newProductForm) {
        addProductTrigger.addEventListener("click", () => {
          if (mainExistingForm) mainExistingForm.hidden = false;
          addProductTrigger.hidden = true;
        });
        document.getElementById("store-cancel-product")?.addEventListener("click", () => {
          newProductForm.reset();
          newProductForm.hidden = true;
          if (mainExistingForm) mainExistingForm.hidden = false;
          addProductTrigger.hidden = false;
        });
      }
      document.querySelectorAll(".store-create-product-trigger").forEach(button => {
        button.addEventListener("click", () => {
          const existingForm = button.closest(".store-existing-product-form");
          const productForm = existingForm?.nextElementSibling?.matches(".store-product-form")
            ? existingForm.nextElementSibling
            : (mainExistingForm ? document.getElementById("store-product-form") : null);
          if (existingForm) existingForm.hidden = true;
          if (productForm) {
            productForm.hidden = false;
            productForm.querySelector('[name="name"]')?.focus();
          }
        });
      });
      document.querySelectorAll(".store-cancel-create-product").forEach(button => {
        button.addEventListener("click", () => {
          const productForm = button.closest(".store-product-form");
          const existingForm = productForm?.previousElementSibling;
          if (productForm) {
            productForm.reset();
            productForm.hidden = true;
          }
          if (existingForm?.matches(".store-existing-product-form")) existingForm.hidden = false;
        });
      });
      document.querySelectorAll('.store-product-form [name="productImage"]').forEach(imageInput => {
        const imagePreview = imageInput.form.querySelector(".store-product-image-preview");
        imageInput.addEventListener("change", () => {
          const file = imageInput.files?.[0];
          if (!file) {
            if (imagePreview) {
              imagePreview.hidden = true;
              imagePreview.removeAttribute("src");
            }
            return;
          }
          if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
            AppUtils.showToast("Choose an image smaller than 5 MB.", "danger");
            imageInput.value = "";
            if (imagePreview) {
              imagePreview.hidden = true;
              imagePreview.removeAttribute("src");
            }
            return;
          }
          if (imagePreview) {
            imagePreview.src = URL.createObjectURL(file);
            imagePreview.hidden = false;
          }
        });
      });
      bindForm("store-category-form", async data => {
        const name = String(data.get("name") || "").trim();
        if (!name) throw new Error("Enter a category name.");
        const existsInPos = (await window.ShopPOS.listCategories()).some(category =>
          category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!existsInPos) await window.ShopPOS.addCategory(name);
        const webCategory = SQLiteEngine.getCategories().some(category =>
          category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!webCategory) SQLiteEngine.saveCategory({ name });
        await window.ShopSQLite.flush();
        AppController.cacheActiveTenantCatalog();
      });
      document.querySelectorAll(".store-stock-form").forEach(form => {
        form.addEventListener("submit", async event => {
          event.preventDefault();
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            const stock = Number(new FormData(form).get("stock"));
            if (!Number.isSafeInteger(stock) || stock < 0) throw new Error("Enter a whole-number stock quantity.");
            const posId = Number(form.dataset.posId || 0);
            const webId = Number(form.dataset.webId || 0);
            if (posId) {
              const posProduct = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === posId);
              if (!posProduct) throw new Error("That POS product no longer exists. Refresh the Store screen.");
              await window.ShopPOS.saveProduct({ ...posProduct, id: posId, stock });
            }
            if (webId) {
              const webProduct = SQLiteEngine.getProductById(webId);
              if (!webProduct) throw new Error("That website product no longer exists. Refresh the Store screen.");
              SQLiteEngine.saveProduct({ ...webProduct, stock });
              await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, webProduct.sku, stock);
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            }
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("Main shop stock update failed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Stock could not be updated.", "danger");
            button.disabled = false;
          }
        });
      });
      const search = document.getElementById("store-product-search");
      const sourceFilter = document.getElementById("store-product-source");
      if (search || sourceFilter) {
        const filterProducts = () => {
        const query = search?.value.trim().toLocaleLowerCase() || "";
        const source = sourceFilter?.value || "all";
        document.querySelectorAll("[data-store-search]").forEach(row => {
          const matchesSearch = row.dataset.storeSearch.includes(query);
          const sources = (row.dataset.storeSources || "").split(",");
          const matchesSource = source === "all" || sources.includes(source);
          row.hidden = !matchesSearch || !matchesSource;
        });
        };
        search?.addEventListener("input", filterProducts);
        sourceFilter?.addEventListener("change", filterProducts);
      }
      const deployButton = document.getElementById("btn-publish-cloudflare");
      if (deployButton) deployButton.onclick = () => AppController.openCloudflarePublishModal();
      document.querySelectorAll("[data-store-publish-product]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const product = (await window.ShopPOS.listProducts()).find(item =>
              Number(item.id) === Number(button.dataset.storePublishProduct));
            if (!product) throw new Error("That POS product no longer exists. Refresh the Store screen.");
            await this.publishPosProduct(product);
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast("Product added to the website catalog.");
          } catch (error) {
            console.error("POS product could not be added to the website.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Product could not be added to the website.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-store-pos-product]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await this.addWebsiteProductToPos(Number(button.dataset.storePosProduct));
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast("Product added to POS.");
          } catch (error) {
            console.error("Website product could not be added to POS.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Product could not be added to POS.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-store-website-category]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const name = button.dataset.storeWebsiteCategory;
            if (!SQLiteEngine.getCategories().some(category => category.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
              SQLiteEngine.saveCategory({ name });
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            }
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("POS category could not be added to the website.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Category could not be added to the website.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-remove-website-product]").forEach(button => {
        button.addEventListener("click", async event => {
          event.preventDefault();
          event.stopPropagation();
          const productId = Number(button.dataset.removeWebsiteProduct);
          const product = SQLiteEngine.select("products", item =>
            item.status !== "archived" && Number(item.id) === productId
          )[0];
          if (!product) {
            AppUtils.showToast("That website product could not be found. Refresh the page and try again.", "danger");
            return;
          }
          if (!window.confirm(`Remove "${product.name}" from this website? Its separate Store/POS inventory will not be deleted. Publish the website afterward to apply this change online.`)) return;
          button.disabled = true;
          try {
            SQLiteEngine.deleteProduct(productId);
            await window.ShopSQLite.flush();
            AppController.cacheActiveTenantCatalog();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`"${product.name}" removed from this website. Publish to update the live site.`);
          } catch (error) {
            console.error("Website product could not be removed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Website product could not be removed.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-remove-website-category]").forEach(button => {
        button.addEventListener("click", async event => {
          event.preventDefault();
          event.stopPropagation();
          const categoryId = Number(button.dataset.removeWebsiteCategory);
          const category = SQLiteEngine.getCategories().find(item => Number(item.id) === categoryId);
          if (!category) {
            AppUtils.showToast("That website category could not be found. Refresh the page and try again.", "danger");
            return;
          }
          const productCount = SQLiteEngine.select("products", product =>
            product.status !== "archived" && Number(product.category_id) === categoryId
          ).length;
          const reassignment = productCount
            ? ` ${productCount} website product${productCount === 1 ? " will" : "s will"} remain on this website as uncategorized.`
            : "";
          if (!window.confirm(`Remove the "${category.name}" category from this website? This does not remove its separate Store/POS category.${reassignment} Publish the website afterward to apply this change online.`)) return;
          button.disabled = true;
          try {
            SQLiteEngine.deleteCategory(categoryId);
            await window.ShopSQLite.flush();
            AppController.cacheActiveTenantCatalog();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`"${category.name}" category removed from this website. Publish to update the live site.`);
          } catch (error) {
            console.error("Website category could not be removed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Website category could not be removed.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-store-pos-category]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const name = button.dataset.storePosCategory;
            if (!(await window.ShopPOS.listCategories()).some(category => category.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
              await window.ShopPOS.addCategory(name);
            }
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("Website category could not be added to POS.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Category could not be added to POS.", "danger");
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      console.error("Main shop data could not be loaded.", error);
      content.innerHTML = `<p class="store-workspace-empty" role="alert">${AppUtils.escapeHTML(error instanceof Error ? error.message : "Business records could not be loaded.")}</p>`;
    }
  },

  async publishPosProduct(product) {
    const categoryName = String(product.categoryName || "Uncategorized").trim();
    let category = SQLiteEngine.getCategories().find(item =>
      item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    if (!category) {
      SQLiteEngine.saveCategory({ name: categoryName });
      category = SQLiteEngine.getCategories().find(item =>
        item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    }
    if (!category) throw new Error(`Could not create website category "${categoryName}".`);
    const sku = String(product.sku || "").trim();
    const webProduct = sku
      ? SQLiteEngine.select("products").find(item => String(item.sku || "").trim() === sku)
      : null;
    SQLiteEngine.saveProduct({
      ...(webProduct || {}),
      ...(webProduct ? { id: webProduct.id } : {}),
      name: product.name,
      sku: product.sku,
      category_id: category.id,
      price: Number(product.price) || 0,
      cost_price: product.buyingPrice == null ? 0 : Number(product.buyingPrice),
      stock: product.stock == null ? 0 : Number(product.stock),
      images: product.imageUri ? [product.imageUri] : webProduct?.images || [],
      taxonomy_category_id: product.taxonomyCategoryId || webProduct?.taxonomy_category_id || null,
      taxonomy_custom_category: product.taxonomyCustomCategory || webProduct?.taxonomy_custom_category || null,
      taxonomy_attributes: product.taxonomyAttributes || webProduct?.taxonomy_attributes || []
    });
    AppController.cacheActiveTenantCatalog();
    await window.ShopSQLite.flush();
    await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, product.sku, Number(product.stock) || 0);
  },

  async addWebsiteProductToPos(productId) {
    const websiteProduct = SQLiteEngine.getProductById(productId);
    if (!websiteProduct) throw new Error("That website product no longer exists. Refresh the Store screen.");
    const categoryName = SQLiteEngine.getCategories().find(category =>
      Number(category.id) === Number(websiteProduct.category_id))?.name || "Uncategorized";
    let posCategory = (await window.ShopPOS.listCategories()).find(category =>
      category.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    if (!posCategory) {
      await window.ShopPOS.addCategory(categoryName);
      posCategory = (await window.ShopPOS.listCategories()).find(category =>
        category.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    }
    if (!posCategory) throw new Error(`Could not create POS category "${categoryName}".`);
    const posId = await window.ShopPOS.saveProduct({
      name: websiteProduct.name,
      categoryId: posCategory.id,
      price: Number(websiteProduct.price) || 0,
      buyingPrice: websiteProduct.cost_price ?? "",
      stock: websiteProduct.stock ?? 0,
      sku: websiteProduct.sku || "",
      imageUri: websiteProduct.images?.[0] || "",
      taxonomyCategoryId: websiteProduct.taxonomy_category_id || "",
      taxonomyCustomCategory: websiteProduct.taxonomy_custom_category || "",
      taxonomyAttributes: websiteProduct.taxonomy_attributes || []
    });
    const posProduct = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === Number(posId));
    if (!posProduct) throw new Error("The POS product saved, but could not be reloaded to link its SKU.");
    if (!websiteProduct.sku) {
      SQLiteEngine.saveProduct({ ...websiteProduct, sku: posProduct.sku });
      AppController.cacheActiveTenantCatalog();
      await window.ShopSQLite.flush();
    }
    await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, posProduct.sku, Number(posProduct.stock) || 0);
  },

  renderProfileScreen(path = "/account/profile") {
    const sections = [
      { id: "home", label: "Home", route: "/" },
      { id: "profile", label: "Profile" },
      { id: "accounts", label: "Accounts" },
      { id: "webs", label: "Webs" },
      { id: "recommended-actions", label: "Recommended actions" },
      { id: "link-devices", label: "Link devices" },
      { id: "privacy", label: "Privacy" },
      { id: "updates", label: "Updates" }
    ];
    const requestedSection = path.slice("/account/profile".length).replace(/^\/+|\/+$/g, "");
    const [sectionId, ...sectionRouteParts] = requestedSection.split("/");
    const activeSection = sections.find(section => section.id === sectionId)?.id || "profile";
    let activeLabel = sections.find(section => section.id === activeSection)?.label || "Profile";
    let websiteDetailId = "";
    let websiteDetailSection = "settings";
    if (activeSection === "webs" && sectionRouteParts.length) {
      try {
        websiteDetailId = decodeURIComponent(sectionRouteParts[0]);
        websiteDetailSection = sectionRouteParts[1] || "settings";
      } catch (error) {
        console.warn("Website settings route contains an invalid encoded ID.", error);
      }
    }
    const store = SQLiteEngine.getStore();
    const activeTenant = AppController.getActiveTenant();
    const isDrawer = path === "/account/profile";
    const websites = AppController.tenantCatalogs()
      .filter(website => website && typeof website.tenant_id === "string")
      .map(website => {
        const id = website.tenant_id;
        return {
          id,
          name: website.name || website.store?.name || (id === "main" ? "Craft" : id),
          hostname: website.hostname || (id === "main" ? "rrobin.co.ke" : `${id}.rrobin.co.ke`),
          store: id === activeTenant.id ? store : website.store || {},
          products: Array.isArray(website.products) ? website.products : [],
          categories: Array.isArray(website.categories) ? website.categories : []
        };
      });
    if (!websites.some(website => website.id === "main")) {
      websites.unshift({
        id: "main",
        name: "Craft",
        hostname: "rrobin.co.ke",
        store: activeTenant.id === "main" ? store : {},
        products: [],
        categories: []
      });
    }
    if (!websites.some(website => website.id === activeTenant.id)) {
      websites.push({
        id: activeTenant.id,
        name: activeTenant.name || store.name || activeTenant.id,
        hostname: activeTenant.hostname,
        store,
        products: [],
        categories: []
      });
    }
    const selectedWebsite = websites.find(website => website.id === websiteDetailId);
    if (selectedWebsite) activeLabel = websiteDetailSection === "domains"
      ? `${selectedWebsite.name} · Domains`
      : websiteDetailSection === "stats"
        ? `${selectedWebsite.name} · Stats`
        : selectedWebsite.name;
    const profileValue = value => AppUtils.escapeHTML(String(value || "").trim() || "Not added yet");
    const renderWebsiteCards = (deleteLabel, ariaLabel = "Your websites") =>
      StudioRenderers.renderWebsiteManagementCards(websites, deleteLabel, ariaLabel);
    const websiteCards = renderWebsiteCards("Delete web");
    // Recommended actions existed in every menu and rendered nothing at all. These are read from the
    // shop's own data, so a step only appears while it is genuinely outstanding.
    const recommendedActionsScreen = (() => {
      const allProducts = SQLiteEngine.select("products") || [];
      const liveProducts = allProducts.filter(product => product && product.status !== "archived");
      const posProducts = liveProducts.filter(product => product.sku);
      const withPhotos = liveProducts.filter(product => product.img || (product.images || []).length);
      const withCost = liveProducts.filter(product => Number(product.cost_price) > 0);
      const categories = SQLiteEngine.getCategories() || [];
      const published = websites.some(website => website.published);
      const actions = [];
      if (!liveProducts.length) {
        actions.push({ title: "Add your first product", note: "Nothing can be sold or published until the shop has something in it.", route: "/store/manage/products", label: "Add a product" });
      }
      if (liveProducts.length && !categories.length) {
        actions.push({ title: "Group your products into categories", note: "Customers browse by category, and your reports read better with them.", route: "/store/manage/categories", label: "Add a category" });
      }
      if (liveProducts.length && withPhotos.length < liveProducts.length) {
        actions.push({ title: `Add photos to ${liveProducts.length - withPhotos.length} product${liveProducts.length - withPhotos.length === 1 ? "" : "s"}`, note: "Products without a photo are the ones customers skip.", route: "/store/manage/products", label: "Open products" });
      }
      if (liveProducts.length && withCost.length < liveProducts.length) {
        actions.push({ title: `Set a buying price on ${liveProducts.length - withCost.length} product${liveProducts.length - withCost.length === 1 ? "" : "s"}`, note: "Without a buying price the profit figures are only a guess.", route: "/store/manage/products", label: "Open products" });
      }
      if (!published) {
        actions.push({ title: "Publish your website", note: "Your shop is not online until you publish it.", route: "/account/web/studio/websites/list", label: "Open websites" });
      }
      if (!String(store.phone || "").trim() && !String(store.email || "").trim()) {
        actions.push({ title: "Add a phone number or email", note: "Customers need a way to reach you, and receipts carry it.", route: "/account/profile/profile", label: "Edit shop details" });
      }
      actions.push({ title: "Connect payments", note: "Connect Paystack so customers can pay online. Counter sales work without it.", route: "/account/web/studio/payments", label: "Open payments" });
      if (!posProducts.length && liveProducts.length) {
        actions.push({ title: "Give your products a code", note: "A product code links the counter and the website so stock stays in step.", route: "/store/manage/products", label: "Open products" });
      }
      return `<div class="profile-cards">
        <article class="profile-card">
          <h2>What to do next</h2>
          <p>${actions.length} step${actions.length === 1 ? "" : "s"} worth doing for this shop.</p>
        </article>
        ${actions.map(action => `<article class="profile-card">
          <h2>${AppUtils.escapeHTML(action.title)}</h2>
          <p>${AppUtils.escapeHTML(action.note)}</p>
          <a class="btn-secondary" href="${action.route}" data-route="${action.route}">${AppUtils.escapeHTML(action.label)}</a>
        </article>`).join("")}
      </div>`;
    })();
    const websiteSettingsScreen = selectedWebsite ? `
      <article class="profile-page-card profile-website-settings">
        <h2>${AppUtils.escapeHTML(selectedWebsite.name)}</h2>
        ${selectedWebsite.id === activeTenant.id
          ? '<p class="profile-website-note">This is the website currently selected for Products, Inventory, Categories, and website editing.</p>'
          : '<p class="profile-website-note">Select this website to manage its own Products, Inventory, Categories, and website content.</p>'}
        <div class="profile-page-details">
          <p>Domain: <a href="https://${AppUtils.escapeHTML(selectedWebsite.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(selectedWebsite.hostname)}</a></p>
          <p>Store details: ${profileValue(selectedWebsite.store.description)}</p>
          <p>Location: ${profileValue(selectedWebsite.store.location)}</p>
          <p>Email: ${profileValue(selectedWebsite.store.email)}</p>
          <p>Phone: ${profileValue(selectedWebsite.store.phone)}</p>
          <p>${selectedWebsite.products.length} products · ${selectedWebsite.categories.length} categories</p>
        </div>
        <div class="profile-website-actions">
          <button class="btn-primary" type="button" data-manage-website="${AppUtils.escapeHTML(selectedWebsite.id)}">Manage this web</button>
          <a class="btn-primary" href="https://${AppUtils.escapeHTML(selectedWebsite.hostname)}" target="_blank" rel="noopener">Browse web</a>
          <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}/domains" data-route="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}/domains">Manage domains</a>
          <button class="btn-secondary" type="button" data-edit-store="${AppUtils.escapeHTML(selectedWebsite.id)}">Edit store details</button>
          <button class="btn-secondary" type="button" data-edit-website="${AppUtils.escapeHTML(selectedWebsite.id)}">Edit website design</button>
          <button class="btn-secondary profile-website-delete" type="button" data-delete-website="${AppUtils.escapeHTML(selectedWebsite.id)}"${selectedWebsite.id === "main" ? ' disabled title="The main Craft domain cannot be deleted."' : ""}>Delete web</button>
        </div>
        ${selectedWebsite.id === "main" ? "" : `
          <section class="profile-page-card" aria-labelledby="google-search-heading" style="margin-top:18px;">
            <h3 id="google-search-heading">Google Search</h3>
            <p>Search Console setup is optional. Craft automatically publishes this shop’s sitemap. To ask Google to index it, add the shop yourself in Search Console, choose the HTML tag verification method, and paste the complete tag here. Craft publishes the tag; you then verify the site and submit its sitemap in your Google account. No Google login or Cloudflare access is needed.</p>
            <ol>
              <li><a href="https://search.google.com/search-console" target="_blank" rel="noopener">Open Google Search Console</a> and add <code>https://${AppUtils.escapeHTML(selectedWebsite.hostname)}/</code> as a URL-prefix property.</li>
              <li>Choose <strong>HTML tag</strong>, copy the complete <code>&lt;meta name="google-site-verification" ...&gt;</code> tag, and paste it below.</li>
              <li>Save the tag here, return to Search Console and choose <strong>Verify</strong>. Then submit <code>https://${AppUtils.escapeHTML(selectedWebsite.hostname)}/sitemap.xml</code>.</li>
            </ol>
            <label for="search-console-verification-tag">Google HTML verification tag</label>
            <input id="search-console-verification-tag" type="text" autocomplete="off" spellcheck="false" placeholder='<meta name="google-site-verification" content="...">' style="width:100%;margin:8px 0 12px;">
            <p id="google-search-status" role="status" aria-live="polite">Checking verification tag…</p>
            <div class="profile-website-actions">
              <button class="btn-primary" type="button" data-search-console-save="${AppUtils.escapeHTML(selectedWebsite.id)}">Publish verification tag</button>
              <button class="btn-secondary" type="button" data-search-console-remove="${AppUtils.escapeHTML(selectedWebsite.id)}">Remove verification tag</button>
            </div>
          </section>`}
        ${selectedWebsite.id === "main" ? '<p class="profile-website-note">The main Craft website is required and cannot be deleted.</p>' : ""}
      </article>` : `
      <article class="profile-page-card">
        <h2>Website not found</h2>
        <p>This website is not saved in this app. Return to Webs and choose one of your saved websites.</p>
      </article>`;
    const websiteDomainScreen = selectedWebsite ? `
      <article class="profile-page-card profile-website-domains">
        <a class="profile-page-back" href="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}" data-route="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}" aria-label="Back to website settings">&larr; Website settings</a>
        <h2 style="margin-top:14px;">Website domains</h2>
        <p>Your Craft address</p>
        <p class="profile-website-domain"><a href="https://${AppUtils.escapeHTML(selectedWebsite.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(selectedWebsite.hostname)}</a></p>
        ${selectedWebsite.id === "main" ? `
          <p>The main Craft domain is fixed. To use a different address, create a separate shop and connect its own subdomain.</p>
        ` : `
          <h3 id="custom-domain-heading">Connect a custom subdomain</h3>
          <p>Connect a subdomain you control, such as <code>shop.example.com</code>. Root domains such as <code>example.com</code> are not supported yet. Your Craft address keeps working as a fallback.</p>
          <label for="custom-domain-hostname">Custom subdomain</label>
          <input id="custom-domain-hostname" type="text" autocomplete="url" spellcheck="false" placeholder="shop.example.com" style="width:100%;margin:8px 0 12px;">
          <p id="custom-domain-status" role="status" aria-live="polite">Checking custom domain…</p>
          <div class="profile-website-actions">
            <button class="btn-primary" type="button" data-custom-domain-action="connect" data-tenant-id="${AppUtils.escapeHTML(selectedWebsite.id)}">Connect subdomain</button>
            <button class="btn-secondary" type="button" data-custom-domain-action="check" data-tenant-id="${AppUtils.escapeHTML(selectedWebsite.id)}" disabled>Check status</button>
            <button class="btn-secondary" type="button" data-custom-domain-action="remove" data-tenant-id="${AppUtils.escapeHTML(selectedWebsite.id)}" disabled>Remove subdomain</button>
          </div>
          <p class="profile-website-note">To change an existing custom domain, remove it here first, then connect the replacement.</p>
        `}
      </article>` : `
      <article class="profile-page-card">
        <h2>Website not found</h2>
        <p>This website is not saved in this app. Return to Webs and choose one of your saved websites.</p>
      </article>`;
    const websiteStatsScreen = selectedWebsite ? `
      <article class="profile-page-card">
        <div class="studio-panel-heading">
          <div><h2>Website usage</h2><p class="studio-panel-note">Storage and tenant-scoped database records for ${AppUtils.escapeHTML(selectedWebsite.name)}.</p></div>
          <button class="btn-secondary" type="button" data-load-website-stats="${AppUtils.escapeHTML(selectedWebsite.id)}">Refresh</button>
        </div>
        <p data-website-stats-status role="status" aria-live="polite">Load usage statistics for this website.</p>
        <div data-website-stats-content></div>
        <p class="profile-website-note">D1 is shared between websites, so this reports rows scoped to this website, not a fictional per-website database size.</p>
      </article>` : `
      <article class="profile-page-card"><h2>Website not found</h2><p>This website is not saved in this app.</p></article>`;
    const accountsScreen = `
      ${renderWebsiteCards("Delete account", "Shop accounts")}
      <a class="btn-primary profile-add-account" href="/account/web/studio/websites/webmaker" data-start-new-website>Create a new website</a>`;
    const privacyAgreement = window.localStorage.getItem("ESHOP_PRIVACY_POLICY_AGREED_V1") !== "declined";
    const privacyPolicy = `
      <article class="profile-page-card profile-privacy-policy">
        <h2>Privacy Policy</h2>
        <p>This policy describes how the Craft Studio app handles information in the app and on websites you publish.</p>
        <h3>Information in the app</h3>
        <p>Shop details, products, inventory, website pages, settings, and order information are stored in the app’s local database on this device.</p>
        <h3>Published websites</h3>
        <p>When you publish a website, its public shop details, products, pages, and linked images are sent to the hosting service you configured and can be viewed by visitors at its domain.</p>
        <h3>Google Search Console</h3>
        <p>If you choose to verify a shop in Google Search Console, Craft stores the public HTML verification code for that shop and publishes it in the shop website’s page metadata. Craft does not connect to your Google account. You can remove the code from the website settings at any time.</p>
        <h3>Google sign-in</h3>
        <p>If you choose to sign in or create a Craft account with Google, Craft receives your Google account’s verified email address and a unique account identifier so you can sign in again. Craft does not request access to Gmail, Drive, or Search Console through account sign-in. You can unlink Google from your Craft account settings.</p>
        <h3>Access and security</h3>
        <p>Shop access keys are stored on this device and sent over HTTPS when you manage or publish a shop. Keep your device and keys private.</p>
        <h3>Your choices</h3>
        <p>You can manage or delete websites from the Webs screen. Removing a published website deletes its hosted catalog and makes its shop address unavailable. This policy covers the Studio app; external hosting or services may have their own terms.</p>
      </article>
      <label class="profile-page-card profile-privacy-agreement">
        <input id="privacy-policy-agreement" type="checkbox" ${privacyAgreement ? "checked" : ""}>
        <span>I agree to the Privacy Policy.</span>
      </label>`;
    const updatesScreen = `
      <article class="profile-page-card">
        <h2>Current version</h2>
        <p>1.0.0</p>
        <h2 style="margin-top:18px;">Recent versions</h2>
        <p>No recent version history is available.</p>
        <h2 style="margin-top:18px;">Current version details</h2>
        <p>Includes Studio website management, separate profile sections, and profile and website details.</p>
      </article>`;
    const linkedDevicesScreen = `
      <article class="profile-page-card">
        <h2>Cloud POS sync</h2>
        <p>Supplier contacts, purchase orders, parked tickets, and sales can sync between devices through your shop’s Cloudflare account. Each device must be signed in to the same shop and have cloud sync enabled in POS settings.</p>
        <a class="btn-primary" href="/pos/more/settings" data-route="/pos/more/settings">Open POS sync settings</a>
      </article>
      <article class="profile-page-card">
        <h2>Connect another device</h2>
        <p>Sign in to the same shop account on the other device, open POS sync settings, and enable cloud sync for that shop. Keep the shop owner key private; anyone with it can access the shop’s synced POS records.</p>
      </article>`;
    const profileCards = `
      <article class="profile-page-card">
        <div class="profile-page-identity">
          <span class="profile-page-avatar" role="img" aria-label="Profile picture placeholder">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2z"/></svg>
          </span>
          <div><h2>Full name</h2><p>Your full name</p></div>
        </div>
      </article>
      <article class="profile-page-card"><h2>Store name</h2><p>${profileValue(store.name)}</p></article>
      <article class="profile-page-card">
        <h2>Store details</h2>
        <div class="profile-page-details">
          <p>${profileValue(store.description)}</p>
          <p>Location: ${profileValue(store.location)}</p>
          <p>Email: ${profileValue(store.email)}</p>
          <p>Phone: ${profileValue(store.phone)}</p>
        </div>
      </article>
      <article class="profile-page-card">
        <h2>Web domains</h2>
        <div class="profile-page-domains">
          ${websites.map(website => `<a href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(website.hostname)}</a>`).join("") || "<p>No domains added yet.</p>"}
        </div>
      </article>`;
    AppUtils.updateSEO({ title: "Profile — Craft Studio", description: "Profile screen." });
    if (isDrawer) {
      return `
        ${StoreRenderers.renderNavbar("/account/profile", "Profile")}
        <main id="main-content" class="profile-menu-overlay" aria-label="Profile menu">
          <a class="profile-menu-backdrop" href="/account" data-route="/account" aria-label="Close profile menu"></a>
          <nav class="profile-sidebar" aria-label="Profile sections">
            <div class="profile-sidebar-header">
              <span>Profile</span>
              <a class="profile-sidebar-close" href="/account" data-route="/account" aria-label="Close profile menu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>
              </a>
            </div>
            ${sections.map(section => {
              const href = section.route || `/account/profile/${section.id}`;
              return `<a class="profile-sidebar-link" href="${href}" data-route="${href}">${section.label}</a>`;
            }).join("")}
            <a class="profile-sidebar-logout" href="/" data-route="/" data-home-screen aria-label="Log out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>
              <span>Log out</span>
            </a>
          </nav>
        </main>
      `;
    }
    return `
      ${StoreRenderers.renderNavbar("/account/profile", activeLabel)}
      <main id="main-content" class="container profile-page-container" aria-label="${AppUtils.escapeHTML(activeLabel)} screen">
        <header class="profile-page-header">
          <a class="profile-page-back" href="/account/profile" data-route="/account/profile" aria-label="Back to profile menu">&larr;</a>
          <h1 class="profile-page-title">${AppUtils.escapeHTML(activeLabel)}</h1>
        </header>
        <section class="profile-page-content" aria-label="${AppUtils.escapeHTML(activeLabel)} details">
          ${websiteDetailId ? websiteDetailSection === "domains" ? websiteDomainScreen : websiteDetailSection === "stats" ? websiteStatsScreen : websiteSettingsScreen : activeSection === "profile" ? profileCards : activeSection === "accounts" ? accountsScreen : activeSection === "webs" ? websiteCards : activeSection === "privacy" ? privacyPolicy : activeSection === "updates" ? updatesScreen : activeSection === "link-devices" ? linkedDevicesScreen : activeSection === "recommended-actions" ? recommendedActionsScreen : ""}
        </section>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  websiteThemes() {
    const defaults = [{
      id: "classic",
      name: "Craft",
      description: "A clean, editorial storefront for your products and collections.",
      template_version: 1,
      validation_status: "passed",
      preview_catalog: null,
      preview_appearance: { primary_color: "#18181B", card_radius: "4px" }
    }, ...(Array.isArray(window.EshopWebsiteThemeCatalog) ? window.EshopWebsiteThemeCatalog : []).map(theme => ({
      ...theme,
      template_version: 1,
      preview_catalog: null,
      preview_appearance: { primary_color: "#18181B", card_radius: "4px" }
    }))];
    const savedThemes = SQLiteEngine.db.tables.website_themes;
    let changed = false;
    defaults.forEach(theme => {
      const saved = savedThemes.find(item => item.id === theme.id);
      if (!saved) {
        savedThemes.push(JSON.parse(JSON.stringify(theme)));
        changed = true;
      } else {
        for (const key of ["name", "description", "preview_url", "studio_url", "studio_mode", "editor_mode", "is_main", "template_version", "validation_status"]) {
          if (saved[key] !== theme[key]) {
            saved[key] = theme[key];
            changed = true;
          }
        }
        if (theme.id === "classic" && saved.preview_appearance?.primary_color === "#244EE8") {
          saved.preview_appearance = { ...saved.preview_appearance, primary_color: "#18181B" };
          changed = true;
        }
      }
    });
    if (changed) SQLiteEngine.save();
    return defaults.map(theme => savedThemes.find(item => item.id === theme.id));
  },

  websiteBuilderDraft() {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ESHOP_NEW_WEBSITE_DRAFT_V1") || "{}");
      const draftId = typeof saved.draft_id === "string" && /^[a-z0-9-]{8,100}$/i.test(saved.draft_id)
        ? saved.draft_id
        : `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      if (saved.draft_id !== draftId) {
        saved.draft_id = draftId;
        window.localStorage.setItem("ESHOP_NEW_WEBSITE_DRAFT_V1", JSON.stringify(saved));
      }
      const legacyImportCleanupKey = "ESHOP_WEBSITE_DRAFT_LEGACY_CATALOG_CLEANUP_V2";
      const needsLegacyImportCleanup = window.localStorage.getItem(legacyImportCleanupKey) !== "1";
      if (needsLegacyImportCleanup) {
        saved.products = [];
        saved.categories = [];
        window.localStorage.setItem(legacyImportCleanupKey, "1");
        window.localStorage.setItem("ESHOP_NEW_WEBSITE_DRAFT_V1", JSON.stringify(saved));
        window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
      }
      const availableThemes = this.websiteThemesForPicker();
      const selectedTheme = availableThemes.some(theme => theme.id === saved.selected_theme)
        ? saved.selected_theme
        : availableThemes[0]?.id || "litrus-mixer";
      return {
        products: Array.isArray(saved.products) ? saved.products : [],
        categories: Array.isArray(saved.categories) ? saved.categories : [],
        draft_id: draftId,
        shop_name: typeof saved.shop_name === "string" ? saved.shop_name : "",
        shop_kind: typeof saved.shop_kind === "string" ? saved.shop_kind : "",
        shop_address: typeof saved.shop_address === "string" ? saved.shop_address : "",
        wizard_step: saved.wizard_step === "catalogue" ? "catalogue" : "identity",
        section_layout: saved.section_layout && typeof saved.section_layout === "object"
          ? saved.section_layout
          : { order: [], hidden: [], removed: [], added: [] },
        selected_theme: selectedTheme
      };
    } catch (error) {
      console.warn("New website draft could not be read.", error);
      return { products: [], categories: [], selected_theme: "" };
    }
  },

  websiteThemesForPicker() {
    return this.websiteThemes().filter(theme =>
      theme.validation_status === "passed" &&
      (theme.editor_mode === "liquid-html" || theme.editor_mode === "litrus"));
  },

  saveWebsiteBuilderDraft(draft) {
    window.localStorage.setItem("ESHOP_NEW_WEBSITE_DRAFT_V1", JSON.stringify(draft));
  },

  async resetWebsiteBuilderDraft() {
    window.localStorage.removeItem("ESHOP_NEW_WEBSITE_DRAFT_V1");
    window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
    SQLiteEngine.db.tables.tenant_catalogs = AppController.tenantCatalogs().filter(item =>
      item.tenant_id !== WEBSITE_BUILDER_DRAFT_TENANT_ID);
    SQLiteEngine.save();
    if (!window.ShopSQLite) throw new Error("The app database is not ready.");
    await window.ShopSQLite.flush();
  },

  renderWebsiteTheme(themeId) {
    const theme = this.websiteThemesForPicker().find(item => item.id === themeId);
    if (!theme) return null;
    const directThemePreview = theme => ["glowmuse-beauty", "vera-fashion"].includes(theme.id) ||
      (theme.studio_mode === "embedded" && theme.id !== "craft-main-storefront");
    const previewUrl = theme.id === "craft-main-storefront" && theme.studio_url
      ? theme.studio_url
      : theme.preview_url;
    if (!theme.studio_url && theme.editor_mode !== "app" &&
        theme.editor_mode !== "liquid-html" &&
        window.EshopThemeSkeletons?.isSupportedThemeId(theme.id) !== true) {
      const supported = window.EshopThemeSkeletons?.supportedThemeIds?.join(", ") || "no themes";
      return `
        ${StoreRenderers.renderNavbar("/account")}
        <main class="container" style="padding:24px 0 48px;max-width:720px;">
          <a href="/account/web/studio/websites/list" data-route="/account/web/studio/websites/list" class="studio-back-link" aria-label="Back to websites">&larr;</a>
          <section class="profile-page-card" role="alert" style="margin-top:16px;">
            <h1 class="section-heading" style="font-size:1.4rem;margin:0;">This theme is not ready for shop data</h1>
            <p style="margin:10px 0;color:var(--text-muted);">Its skeleton has no verified shop-data mapping yet, so it cannot be opened or published. Currently supported: ${AppUtils.escapeHTML(supported)}.</p>
          </section>
        </main>
      `;
    }
    const useThemeRoute = `/account/web/site?new=1&edit=1&theme=${encodeURIComponent(theme.id)}`;
    const draft = this.websiteBuilderDraft();
    draft.selected_theme = theme.id;
    this.saveWebsiteBuilderDraft(draft);
    AppUtils.updateSEO({ title: "Theme preview — Craft", description: "Preview your new website catalog with this theme." });
    const previewDescription = "Preview this theme with your products and categories. They stay in your local draft until setup.";
    return `
      ${StoreRenderers.renderNavbar("/account")}
      <main style="padding:14px 0 0;">
        <div class="container" style="padding-bottom:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
            <a href="/account/web/studio/websites/list" data-route="/account/web/studio/websites/list" aria-label="Back to websites" style="display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:0 10px;border:1px solid var(--border);border-radius:999px;color:var(--text-main);font-size:.78rem;white-space:nowrap;">&larr;</a>
            <a href="${AppUtils.escapeHTML(useThemeRoute)}" data-route="${AppUtils.escapeHTML(useThemeRoute)}" style="display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:0 10px;border:0;border-radius:999px;background:var(--accent);color:var(--accent-contrast);font:inherit;font-size:.78rem;font-weight:600;text-decoration:none;white-space:nowrap;">${theme.studio_url ? "Open this theme’s Studio →" : "Use this theme →"}</a>
          </div>
        </div>
        <p class="studio-panel-note" style="margin:8px 16px;">${AppUtils.escapeHTML(previewDescription)} Your ${draft.products.length} products and ${draft.categories.length} categories are ready for the editor.</p>
        <div style="position:relative;height:calc(100dvh - 150px);min-height:480px;background:var(--bg);">
          ${directThemePreview(theme) ? "" : `<div data-theme-preview-placeholder role="status" style="position:absolute;inset:0;display:grid;place-items:center;color:var(--text-muted);font-size:.9rem;">Loading theme preview…</div>`}
          <iframe title="Storefront preview for ${AppUtils.escapeHTML(theme.name)}" data-theme-storefront-preview="${AppUtils.escapeHTML(theme.id)}" data-theme-preview-remote="${AppUtils.escapeHTML(previewUrl || "")}" ${directThemePreview(theme) ? 'data-theme-preview-direct="1"' : ""} src="${directThemePreview(theme) ? AppUtils.escapeHTML(previewUrl || "") : "about:blank"}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;border:0;visibility:${directThemePreview(theme) ? "visible" : "hidden"};background:var(--bg);"></iframe>
        </div>
      </main>
    `;
  },

  renderWebsiteEditor(isNewWebsite = false) {
    const editorParams = new URLSearchParams(AppController.currentRoute().split("?")[1] || "");
    const draftEditor = isNewWebsite && editorParams.get("edit") === "1";
    const tenant = AppController.getActiveTenant();
    const store = SQLiteEngine.getStore();
    const appAccountSession = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1");
    const newWebsiteDraft = isNewWebsite ? StudioRenderers.websiteBuilderDraft() : null;
    const requestedTheme = editorParams.get("theme") ||
      (isNewWebsite
        ? newWebsiteDraft.selected_theme || ""
        : store.website_theme_id) || "litrus-mixer";
    const availableThemes = this.websiteThemesForPicker();
    const selectedTheme = !isNewWebsite
      ? requestedTheme
      : availableThemes.some(theme => theme.id === requestedTheme)
        ? requestedTheme
        : availableThemes[0]?.id || "litrus-mixer";
    if (draftEditor && newWebsiteDraft && editorParams.has("theme")) {
      newWebsiteDraft.selected_theme = selectedTheme;
      this.saveWebsiteBuilderDraft(newWebsiteDraft);
    }
    const editorReturnRoute = draftEditor
      ? "/account/web/studio/websites/list"
      : `/account/profile/webs/${encodeURIComponent(tenant.id)}`;
    AppUtils.updateSEO({
      title: "Litrus Mixer — Craft",
      description: "Build and preview your storefront with Litrus Mixer."
    });
    if (isNewWebsite && !draftEditor) {
    if (!appAccountSession) {
      const continueTo = `/account/web/site?new=1&finish=1&theme=${encodeURIComponent(selectedTheme)}`;
      const accountRoute = `/app-account?continue=${encodeURIComponent(continueTo)}`;
      return `
        ${StoreRenderers.renderNavbar("/account")}
        <main class="container" style="padding:20px 0 48px;max-width:620px;">
          <a href="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" class="studio-back-link" data-route="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" aria-label="Back to website editor">&larr;</a>
          <section class="profile-page-card" style="margin-top:16px;">
            <h1 class="section-heading" style="font-size:1.5rem;margin:0;">Sign in to create your website</h1>
            <p style="margin:8px 0 16px;color:var(--text-muted);">Your editor draft is saved on this device. Sign in or create your Craft app account to finish creating the website.</p>
            <a class="btn-primary" href="${AppUtils.escapeHTML(accountRoute)}" data-route="${AppUtils.escapeHTML(accountRoute)}">Open app account</a>
          </section>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }
      return `
      ${StoreRenderers.renderNavbar("/account")}
      <main class="container" style="padding:16px 0 48px;max-width:760px;">
        <a href="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" class="studio-back-link" data-route="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" aria-label="Back to website editor">&larr;</a>
        <header style="margin:12px 0 18px;">
          <span class="studio-workspace-kicker">NEW WEBSITE · FINAL SETUP</span>
          <h1 class="section-heading" style="font-size:1.55rem;margin:4px 0;">Create your website</h1>
          <p style="margin:3px 0 0;color:var(--text-muted);font-size:.85rem;">Your design is saved on this device. Choose the name and address to create the website now.</p>
        </header>
        <form id="new-website-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-lg);">
          <label class="form-field"><span class="form-label">Shop / website name</span><input class="form-input" name="name" required maxlength="120" placeholder="My Shop" value="${AppUtils.escapeHTML(newWebsiteDraft.shop_name || "")}"></label>
          <label class="form-field"><span class="form-label">Website address</span><span style="display:flex;align-items:center;gap:5px;"><input class="form-input" name="id" required maxlength="40" pattern="[A-Za-z0-9-]+" placeholder="my-store" value="${AppUtils.escapeHTML(newWebsiteDraft.shop_address || String(newWebsiteDraft.shop_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/g, ""))}"><span style="white-space:nowrap;font-size:.8rem;">.rrobin.co.ke</span></span></label>
          <label style="grid-column:1/-1;display:flex;align-items:flex-start;gap:8px;font-size:.84rem;"><input type="checkbox" name="confirm_domain" required><span>I confirm this website address and domain before publishing.</span></label>
          <p class="studio-panel-note" style="grid-column:1/-1;">App-account Paystack payments are shared across your websites. Payment settings belong to your signed-in app account. Every website registered to your app account will use this account at checkout.</p>
          <p id="new-website-error" role="alert" hidden style="grid-column:1/-1;color:#b42318;margin:0;"></p>
          <button class="btn-primary" type="submit" style="min-height:42px;align-self:end;">Set up</button>
        </form>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
    }
      return `
        <style>
          .builder-litrus-toolbar{z-index:1;min-height:46px;padding:5px 10px;display:flex;align-items:center;gap:7px;overflow:visible;background:var(--surface);color:var(--text-main);border-bottom:1px solid var(--border)}
          .builder-litrus-toolbar button,.builder-litrus-toolbar a,.builder-litrus-device-controls summary{height:36px;min-height:36px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;border:1px solid var(--border);border-radius:14px;background:var(--surface-subtle);color:var(--text-main);font:600 12px system-ui,sans-serif;text-decoration:none;cursor:pointer}
          .builder-litrus-toolbar [hidden]{display:none!important}
          .builder-litrus-toolbar #builder-litrus-publish{background:var(--surface);color:var(--text-main);border-color:var(--border)}
          .builder-litrus-device-controls{position:relative;margin-left:auto}
          .builder-litrus-device-controls[hidden]{display:none!important}
          .builder-litrus-device-controls summary{gap:7px;list-style:none}
          .builder-litrus-device-controls summary::-webkit-details-marker{display:none}
          .builder-litrus-device-controls summary svg{width:17px;height:17px}
          .builder-litrus-device-menu{position:absolute;top:42px;right:0;z-index:20;display:grid;min-width:150px;gap:4px;padding:6px;border:1px solid var(--border);border-radius:16px;background:var(--surface);box-shadow:0 12px 30px rgba(24,24,27,.14)}
          .builder-litrus-device-menu button{width:100%;justify-content:flex-start}
          .builder-litrus-device-menu button[aria-pressed="true"]{background:var(--accent-light);color:var(--text-main);border-color:var(--border)}
          @media(max-width:520px){.builder-litrus-toolbar{gap:4px;padding-inline:5px}.builder-litrus-toolbar button,.builder-litrus-toolbar a,.builder-litrus-device-controls summary{padding-inline:7px;font-size:11px}}
        </style>
        <main style="width:100%;min-width:0;height:100dvh;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:var(--bg);color:var(--text-main);">
          <header class="builder-litrus-toolbar" aria-label="Shop builder controls">
            <button id="builder-litrus-publish" type="button">Publish</button>
            ${draftEditor ? "" : `<a id="builder-litrus-store-details" href="/account/web/store?tenant=${encodeURIComponent(tenant.id)}" data-route="/account/web/store?tenant=${encodeURIComponent(tenant.id)}">Store</a>`}
            <button id="builder-litrus-sections" type="button">Sections</button>
            <button id="builder-litrus-advanced" type="button">Advanced</button>
            <details class="builder-litrus-device-controls" id="builder-litrus-devices" hidden>
              <summary aria-label="Devices"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="15" rx="2"/><path d="M8 16h3M19 8h2v12h-7v-1"/></svg><span>Devices</span></summary>
              <div class="builder-litrus-device-menu" role="group" aria-label="Preview device">
                <button type="button" data-litrus-preview-device="fit" aria-pressed="true">Fit</button>
                <button type="button" data-litrus-preview-device="phone" aria-pressed="false">Phone</button>
                <button type="button" data-litrus-preview-device="tablet" aria-pressed="false">Tablet</button>
                <button type="button" data-litrus-preview-device="laptop" aria-pressed="false">Laptop</button>
              </div>
            </details>
          </header>
          <iframe id="builder-litrus-mixer" title="Shop builder" src="/litrus-mixer/index.html?craft=1" allow="clipboard-read; clipboard-write" style="display:block;width:100%;min-width:0;height:100%;border:0;background:var(--bg);"></iframe>
        </main>
        <div id="product-modal-container"></div>
      `;
  },

  renderWebsiteStoreEditor() {
    const store = SQLiteEngine.getStore();
    AppUtils.updateSEO({ title: "Edit store details — Craft", description: "Update your store name, description, and customer-facing contact details." });
    return `
    ${StoreRenderers.renderNavbar("/account/web")}
    <main class="container" style="padding:20px 0 48px;max-width:760px;">
      <a href="/account/web/site?tenant=${encodeURIComponent(AppController.getActiveTenant().id)}" data-route="/account/web/site?tenant=${encodeURIComponent(AppController.getActiveTenant().id)}" class="studio-back-link" aria-label="Back to website editor">&larr;</a>
      <header style="margin:12px 0 18px;">
        <h1 class="section-heading" style="font-size:1.6rem;margin:0;">Edit store</h1>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:.88rem;">Update the store details customers see across this website.</p>
      </header>
      <form id="website-store-form" style="display:grid;gap:14px;">
        <label class="form-field"><span class="form-label">Store name</span><input class="form-input" name="name" maxlength="120" required value="${AppUtils.escapeHTML(store.name || "")}"></label>
        <label class="form-field"><span class="form-label">Tagline</span><input class="form-input" name="tagline" maxlength="240" value="${AppUtils.escapeHTML(store.tagline || "")}"></label>
        <label class="form-field"><span class="form-label">Store description</span><textarea class="form-input" name="description" maxlength="2000" style="min-height:120px;padding-top:10px;">${AppUtils.escapeHTML(store.description || "")}</textarea></label>
        <label class="form-field"><span class="form-label">Location</span><input class="form-input" name="location" maxlength="160" value="${AppUtils.escapeHTML(store.location || "")}"></label>
        <label class="form-field"><span class="form-label">Contact email</span><input class="form-input" name="email" type="email" maxlength="160" value="${AppUtils.escapeHTML(store.email || "")}"></label>
        <label class="form-field"><span class="form-label">Contact phone</span><input class="form-input" name="phone" type="tel" maxlength="60" value="${AppUtils.escapeHTML(store.phone || "")}"></label>
        <label class="form-field"><span class="form-label">Announcement bar text</span><input class="form-input" name="announcement" maxlength="240" value="${AppUtils.escapeHTML(store.announcement || "")}"></label>
        <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;"><input type="checkbox" name="announcementActive" ${store.announcement_active ? "checked" : ""}> Show announcement bar</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:.88rem;"><input type="checkbox" name="installPromptEnabled" ${store.install_prompt_enabled === 0 || store.install_prompt_enabled === "0" || store.install_prompt_enabled === false ? "" : "checked"}> Enable the app install invitation for shoppers</label>
        <p style="margin:-8px 0 0;color:var(--text-muted);font-size:.82rem;">Show a brief invitation for five seconds when shoppers visit. They tap Install before their browser opens its install prompt.</p>
        <button type="submit" class="btn-primary" style="min-height:44px;">Save store details</button>
      </form>
    </main>
    ${StoreRenderers.renderFooter()}
    `;
  },

  renderProductsManager() {
    const products = SQLiteEngine.select("products", p => p.status !== "archived", (a, b) => b.id - a.id);
    const categories = SQLiteEngine.getCategories();
    const activeTenant = AppController.getActiveTenant();

    AppUtils.updateSEO({
      title: "Products Management — Craft Studio",
      description: "Manage catalog products, pricing, stock, images, and categories."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/products')}
      <main class="container product-manager-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
          </div>
          <button class="btn-primary" id="btn-add-product" style="padding: 0 20px; height: 44px;" ${categories.length ? "" : "disabled"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add New Product</span>
          </button>
        </div>
        ${categories.length ? "" : `<p style="margin: 0 0 20px; color: var(--text-muted);">Add a category first, then you can add products.</p>`}

        <div class="product-manager-filters">
          <input type="text" id="admin-prod-search" class="search-input" placeholder="Search products..." />
          <select id="admin-prod-cat" class="filter-select">
            <option value="">All Categories</option>
            ${categories.map(c => `<option value="${c.id}">${AppUtils.escapeHTML(c.name)}</option>`).join("")}
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; margin:0 0 14px;">
          <button type="button" class="btn-secondary" id="btn-publish-cloudflare">Deploy storefront</button>
        </div>
        <p style="margin:0 0 14px; color:var(--text-muted); font-size:.85rem;">Editing <strong>${AppUtils.escapeHTML(activeTenant.name)}</strong> · ${AppUtils.escapeHTML(activeTenant.hostname)} · <a href="/account/profile/webs" data-route="/account/profile/webs">Switch website</a></p>

        <div class="product-list" id="admin-products-list">
          ${products.map(p => {
            const cat = categories.find(c => c.id === p.category_id);
            const image = p.images && p.images[0] ? p.images[0] : "";
            const stockColor = p.stock <= 0 ? "var(--danger)" : (p.stock <= 10 ? "var(--warning)" : "var(--text-main)");
            return `
              <details class="product-list-item" data-prod-id="${p.id}" data-category-id="${p.category_id || ""}" data-search="${AppUtils.escapeHTML(`${p.name} ${p.sku} ${p.brand}`.toLowerCase())}">
                <summary>
                  ${image ? `<img class="product-list-thumb" src="${AppUtils.escapeHTML(image)}" alt="${AppUtils.escapeHTML(p.name)}" loading="lazy">` : `<span class="product-list-thumb" aria-hidden="true"></span>`}
                  <span class="product-list-name">${AppUtils.escapeHTML(p.name)}</span>
                  <button type="button" class="product-list-delete" data-action="admin-del-prod" data-id="${p.id}" aria-label="Delete ${AppUtils.escapeHTML(p.name)}" title="Delete product">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
                  </button>
                  <button type="button" class="product-list-edit" data-action="admin-edit-prod" data-id="${p.id}" aria-label="Edit ${AppUtils.escapeHTML(p.name)}" title="Edit product">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
                  </button>
                </summary>
                <div class="product-list-details">
                  <div class="product-list-detail"><strong>Category</strong>${cat ? AppUtils.escapeHTML(cat.name) : "Unassigned"}</div>
                  <div class="product-list-detail"><strong>Price</strong>${AppUtils.formatMoney(p.price)}</div>
                  <div class="product-list-detail"><strong>Cost</strong>${AppUtils.formatMoney(p.cost_price || 0)}</div>
                  <div class="product-list-detail"><strong>Stock</strong><span style="color:${stockColor};">${p.stock} units</span></div>
                  <div class="product-list-detail"><strong>Discount</strong>${p.discount || 0}%</div>
                  <div class="product-list-detail product-list-description"><strong>Description</strong>${AppUtils.escapeHTML(p.description || "No description.")}</div>
                  <div class="product-list-actions">
                    <button data-action="admin-edit-prod" data-id="${p.id}" class="option-chip">Edit details</button>
                    <button data-action="admin-dup-prod" data-id="${p.id}" class="option-chip">Duplicate</button>
                  </div>
                </div>
              </details>
            `;
          }).join("") || `<div style="padding: 36px 24px; border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
            <h2 style="font-size: 1.2rem; margin-bottom: 8px;">No products yet</h2>
            <p style="color: var(--text-muted);">${categories.length ? "Add your first product to start building the storefront." : "Create a category first to organize your products."}</p>
            ${categories.length ? "" : `<a href="/account/categories" class="btn-primary" data-route="/account/categories" style="display: inline-flex; margin-top: 18px;">Open Categories</a>`}
          </div>`}
        </div>

        <!-- Product Modal Editor Container -->
        <div id="product-modal-container"></div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderDashboard(period = "30d") {
    const orders = SQLiteEngine.select("orders");
    const products = SQLiteEngine.select("products");
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lowStock = products.filter(p => p.stock <= 10);
    const topProducts = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5);

    AppUtils.updateSEO({
      title: "Business Dashboard & Analytics — Craft Studio",
      description: "Business analytics, order velocity, inventory risks, and data-driven intelligence."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/dashboard')}
      <main class="container management-module-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading" style="font-size: 2rem;">Business Intelligence</h1>
            <p style="color: var(--text-muted); font-size: 0.875rem;">Autonomous real-time reporting generated from the embedded SQLite database.</p>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="option-chip ${period === 'today' ? 'active' : ''}" data-action="dash-period" data-period="today">Today</button>
            <button class="option-chip ${period === '7d' ? 'active' : ''}" data-action="dash-period" data-period="7d">7 Days</button>
            <button class="option-chip ${period === '30d' ? 'active' : ''}" data-action="dash-period" data-period="30d">30 Days</button>
            <button class="option-chip ${period === '90d' ? 'active' : ''}" data-action="dash-period" data-period="90d">90 Days</button>
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="metrics-row">
          <div class="metric-card">
            <span class="metric-label">Store Traffic</span>
            <span class="metric-value">92,450</span>
            <span class="metric-trend">+14.2% vs previous period</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Product Views</span>
            <span class="metric-value">384,100</span>
            <span class="metric-trend">+22.7% high engagement</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Total Revenue</span>
            <span class="metric-value">${AppUtils.formatMoney(totalRevenue + 429650)}</span>
            <span class="metric-trend">+24.5% commercial growth</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Average Order Value</span>
            <span class="metric-value">$300.87</span>
            <span class="metric-trend">+8.9% basket depth</span>
          </div>
        </div>

        <!-- Interactive SVG Trend Chart & Analysis -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 32px;">
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 16px;">Revenue &amp; Velocity Trajectory</h3>
            <svg viewBox="0 0 600 200" style="width: 100%; height: auto; overflow: visible;">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#18181B" stop-opacity="0.15" />
                  <stop offset="100%" stop-color="#18181B" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <!-- Grid lines -->
              <line x1="0" y1="40" x2="600" y2="40" stroke="var(--border-subtle)" stroke-width="1" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="var(--border-subtle)" stroke-width="1" />
              <line x1="0" y1="120" x2="600" y2="120" stroke="var(--border-subtle)" stroke-width="1" />
              <line x1="0" y1="160" x2="600" y2="160" stroke="var(--border-subtle)" stroke-width="1" />
              <!-- Area fill -->
              <polygon points="0,170 50,150 100,160 150,130 200,110 250,125 300,90 350,95 400,60 450,75 500,45 550,55 600,25 600,200 0,200" fill="url(#grad)" />
              <!-- Trend line -->
              <polyline points="0,170 50,150 100,160 150,130 200,110 250,125 300,90 350,95 400,60 450,75 500,45 550,55 600,25" fill="none" stroke="var(--accent)" stroke-width="2.5" />
            </svg>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-dim); margin-top: 12px;">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4 (Peak Trajectory)</span>
            </div>
          </div>

          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Autonomous Business Analysis</h3>
            <div style="font-size: 0.875rem; line-height: 1.6; color: var(--text-muted); display: flex; flex-direction: column; gap: 12px;">
              <p>
                <strong>Outperforming Categories:</strong> Men's Sartorial and Horology account for <strong>52%</strong> of store volume, driven by high repeat-client acquisition.
              </p>
              <p>
                <strong>Inventory Warning:</strong> <strong>${lowStock.length}</strong> catalog items have reached their reorder threshold. Automated restock triggers recommended for cashmere knitwear.
              </p>
              <p>
                <strong>Conversion Health:</strong> Current basket checkout completion stands at <strong>3.72%</strong>, 1.4% above luxury e-commerce benchmarks.
              </p>
            </div>
          </div>
        </div>

        <!-- Top Products & Inventory Warnings Table -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 16px;">Top Performing Artifacts</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${topProducts.map(p => `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                  <div>
                    <strong style="font-size: 0.875rem; display: block;">${AppUtils.escapeHTML(p.name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${AppUtils.escapeHTML(p.brand)} &bull; ${p.rating} ★</span>
                  </div>
                  <span style="font-weight: 600; font-size: 0.875rem;">${AppUtils.formatMoney(p.price)}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 16px;">Inventory Attention (${lowStock.length})</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${lowStock.slice(0, 5).map(p => `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                  <div>
                    <strong style="font-size: 0.875rem; display: block;">${AppUtils.escapeHTML(p.name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--warning); font-weight: 600;">Stock: ${p.stock} units remaining</span>
                  </div>
                  <a href="/account/inventory" class="option-chip" data-route="/account/inventory" style="font-size: 0.75rem;">Restock</a>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderCategoriesManager() {
    const categories = SQLiteEngine.getCategories();
    const activeTenant = AppController.getActiveTenant();

    AppUtils.updateSEO({
      title: "Categories Manager — Craft Studio",
      description: "Manage department taxonomy, banners, descriptions, and product assignments."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/categories')}
      <main class="container management-module-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
          </div>
        </div>

        <div class="category-manager-actions">
          <button class="btn-primary" id="btn-add-category" style="height: 42px; padding: 0 16px;">+ Add Category</button>
          <button type="button" class="btn-secondary" id="btn-publish-cloudflare">Deploy storefront</button>
        </div>
        <p style="margin:0 0 14px; color:var(--text-muted); font-size:.85rem;">Editing <strong>${AppUtils.escapeHTML(activeTenant.name)}</strong> · ${AppUtils.escapeHTML(activeTenant.hostname)} · <a href="/account/profile/webs" data-route="/account/profile/webs">Switch website</a></p>

        <div class="category-manager-list">
          ${categories.map(c => `
            <div class="category-manager-row">
              <a href="/category/${encodeURIComponent(c.slug)}?studio=1" class="category-manager-open" data-route="/category/${encodeURIComponent(c.slug)}?studio=1" aria-label="Open ${AppUtils.escapeHTML(c.name)} department">
                <span>${AppUtils.escapeHTML(c.name)}</span>
                <span aria-hidden="true">›</span>
              </a>
              <button type="button" class="product-list-edit" data-action="edit-category" data-id="${c.id}" aria-label="Edit ${AppUtils.escapeHTML(c.name)}" title="Edit category">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
              </button>
              <button type="button" class="product-list-delete" data-action="delete-category" data-id="${c.id}" aria-label="Delete ${AppUtils.escapeHTML(c.name)}" title="Delete category">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
              </button>
            </div>
          `).join("") || `<p style="padding: 28px 20px; text-align: center; color: var(--text-muted);">No categories yet. Add a category to organize your products.</p>`}
        </div>
        <div id="category-modal-container"></div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderTenantsManager() {
    AppUtils.updateSEO({
      title: "My Shops — Craft Studio",
      description: "Manage the online shops linked to your Craft account."
    });
    return `
      ${StoreRenderers.renderNavbar('/account/tenants')}
      <main class="container management-module-main" style="padding:24px 0 80px; max-width:800px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading" style="font-size:2rem;">My shops</h1>
            <p style="color:var(--text-muted); font-size:.875rem;">Your main website is <code>rrobin.co.ke</code>. Other websites you create have separate products, categories, and addresses.</p>
          </div>
        </div>
        <section style="margin:20px 0; padding:18px; border:1px solid var(--border); border-radius:var(--radius);">
          <h2 style="font-size:1.05rem; margin:0 0 12px;">Create a shop</h2>
          <p style="margin:0 0 12px; color:var(--text-muted); font-size:.85rem;">Sign in to your Craft account first. Each new shop gets its own website and catalog.</p>
          <a class="btn-secondary" href="/account/web/studio/websites/webmaker" data-start-new-website>Create a shop or website</a>
        </section>
        <div id="tenant-manager-status" role="status" style="color:var(--text-muted); margin:12px 0;"></div>
        <div id="tenant-manager-list" class="product-list" style="padding:0 12px;"></div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderInventory() {
    const products = SQLiteEngine.select("products", p => p.status !== "archived");
    const activeTenant = AppController.getActiveTenant();
    const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalAssetValuation = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock || 0)), 0);
    const totalRetailValuation = products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);

    AppUtils.updateSEO({
      title: "Inventory & Warehouse — Craft Studio",
      description: "Manage warehouse stock counts, unit costs, retail valuations, and restock triggers."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/inventory')}
      <main class="container management-module-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading" style="font-size: 2rem;">Inventory Valuation &amp; Stock</h1>
            <p style="color: var(--text-muted); font-size: 0.875rem;">POS and website use this device’s shared SQLite stock; changes sync to D1 when online.</p>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Showing inventory for <strong>${AppUtils.escapeHTML(activeTenant.name)}</strong> · ${AppUtils.escapeHTML(activeTenant.hostname)} · <a href="/account/profile/webs" data-route="/account/profile/webs">Switch website</a></p>
          </div>
        </div>

        <div class="metrics-row inventory-metrics">
          <div class="metric-card">
            <span class="metric-label">Total Warehouse Units</span>
            <span class="metric-value">${totalUnits}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Across ${products.length} SKUs</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Inventory Asset Cost</span>
            <span class="metric-value">${AppUtils.formatMoney(totalAssetValuation)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Capital invested</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Projected Retail Value</span>
            <span class="metric-value">${AppUtils.formatMoney(totalRetailValuation)}</span>
            <span class="metric-trend">+${totalAssetValuation ? Math.round((totalRetailValuation - totalAssetValuation) / totalAssetValuation * 100) : 0}% margin</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Low Stock Alerts</span>
            <span class="metric-value">${products.filter(p => p.stock <= 10).length}</span>
            <span style="font-size: 0.75rem; color: var(--warning);">Require supplier reorder</span>
          </div>
        </div>

        <input type="search" id="inventory-search" class="inventory-search" placeholder="Search products..." aria-label="Search inventory by product name or SKU">
        <div class="inventory-list">
          ${products.map(p => `
            <details class="inventory-item" data-inv-id="${p.id}" data-search="${AppUtils.escapeHTML(`${p.name} ${p.sku} ${p.brand || ""}`.toLowerCase())}">
              <summary>
                <span class="inventory-item-name">${AppUtils.escapeHTML(p.name)}</span>
                <span class="inventory-item-stock">${p.stock} in stock</span>
                <span class="inventory-item-price">${AppUtils.formatMoney(p.price)}</span>
              </summary>
              <div class="inventory-item-details">
                <div><strong>SKU</strong>${AppUtils.escapeHTML(p.sku)}</div>
                <div><strong>Asset value</strong>${AppUtils.formatMoney((p.cost_price || 0) * p.stock)}</div>
                <div><strong>Status</strong><span style="color:${p.stock <= 0 ? "var(--danger)" : p.stock <= 10 ? "var(--warning)" : "var(--success)"};">${p.stock <= 0 ? "Out of Stock" : p.stock <= 10 ? "Low Stock" : "Optimal"}</span></div>
                <label class="inventory-edit-field"><strong>Selling price</strong><input type="number" data-inv-price min="0.01" step="0.01" value="${Number(p.price).toFixed(2)}" aria-label="Selling price"></label>
                <label class="inventory-edit-field"><strong>Unit cost</strong><input type="number" data-inv-cost min="0" step="0.01" value="${Number(p.cost_price || 0).toFixed(2)}" aria-label="Unit cost"></label>
                <label class="inventory-edit-field"><strong>Stock quantity</strong><input type="number" data-inv-stock min="0" step="1" value="${Math.max(0, Number(p.stock) || 0)}" aria-label="Stock quantity"></label>
                <div class="inventory-item-actions">
                  <button type="button" data-action="save-inventory-item" data-id="${p.id}" class="btn-primary inventory-save-button">Save</button>
                  <button data-action="restock-qty" data-id="${p.id}" data-add="10" class="option-chip" style="font-size:0.75rem;padding:4px 8px;">+10 Units</button>
                  <button data-action="restock-qty" data-id="${p.id}" data-add="25" class="option-chip" style="font-size:0.75rem;padding:4px 8px;">+25 Units</button>
                </div>
              </div>
            </details>
          `).join("")}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderSettings() {
    const store = SQLiteEngine.getStore();
    const appearance = AppController.getStudioAppearance();
    const storeColors = [
      { name: "White", value: "#FFFFFF" },
      { name: "Black", value: "#18181B" },
      { name: "Slate", value: "#475569" },
      { name: "Espresso", value: "#7C4A2D" },
      { name: "Home blue", value: "#244EE8" },
      { name: "Navy", value: "#1E3A8A" },
      { name: "Sky blue", value: "#0284C7" },
      { name: "Teal", value: "#0F766E" },
      { name: "Emerald", value: "#059669" },
      { name: "Moss", value: "#4D7C0F" },
      { name: "Violet", value: "#7C3AED" },
      { name: "Plum", value: "#9333EA" },
      { name: "Rose", value: "#E11D48" },
      { name: "Coral", value: "#E85D4F" },
      { name: "Amber", value: "#D97706" }
    ];
    const currentColor = /^#[0-9a-f]{6}$/i.test(appearance.primary_color || "") ? appearance.primary_color.toUpperCase() : "#18181B";
    const isPresetColor = storeColors.some(color => color.value === currentColor);

    AppUtils.updateSEO({
      title: "Settings — Craft Studio",
      description: "Customize store typography, color palettes, card border radius, and store preferences."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/settings')}
      <main class="container store-settings-main">
        <div class="studio-page-header store-settings-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading">Settings</h1>
          </div>
        </div>

        <form id="store-settings-form" class="store-settings-form">
          <div class="form-group-card store-settings-card">
            <h3 class="form-card-title">App appearance</h3>
            <div class="form-field">
              <span class="form-label">App accent color</span>
              <div class="store-design-options store-color-options">
                ${storeColors.map(color => `
                  <label class="store-design-choice">
                    <input type="radio" name="primaryColor" value="${color.value}" ${currentColor === color.value ? "checked" : ""} />
                    <span class="store-color-swatch" style="--swatch:${color.value};"></span><span>${color.name}</span>
                  </label>
                `).join("")}
                <label class="store-design-choice store-custom-color-choice">
                  <input type="radio" name="primaryColor" value="${currentColor}" ${isPresetColor ? "" : "checked"} />
                  <input type="color" id="custom-store-color" class="store-custom-color" value="${currentColor}" aria-label="Choose a custom accent color" />
                  <span>Custom</span>
                </label>
              </div>
            </div>

            <div class="form-field" style="margin-top:14px;">
              <span class="form-label">Card corners</span>
              <div class="store-design-options">
                <label class="store-design-choice">
                  <input type="radio" name="cardRadius" value="0px" ${appearance.card_radius === '0px' || appearance.card_radius === 'sharp' ? 'checked' : ''} />
                  <span>Sharp</span>
                </label>
                <label class="store-design-choice">
                  <input type="radio" name="cardRadius" value="4px" ${appearance.card_radius === '4px' || appearance.card_radius === 'minimal' || !appearance.card_radius ? 'checked' : ''} />
                  <span>Subtle</span>
                </label>
                <label class="store-design-choice">
                  <input type="radio" name="cardRadius" value="10px" ${appearance.card_radius === '10px' || appearance.card_radius === 'rounded' ? 'checked' : ''} />
                  <span>Rounded</span>
                </label>
              </div>
            </div>

          </div>

          <div class="form-group-card store-settings-card">
            <h3 class="form-card-title">Storefront Announcement</h3>
            <div class="form-field">
              <label class="form-label">Banner Notice Text</label>
              <input type="text" name="announcement" class="form-input" value="${AppUtils.escapeHTML(store.announcement || '')}" />
            </div>
            <div style="margin-top: 12px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.875rem;">
                <input type="checkbox" name="announcementActive" ${store.announcement_active ? 'checked' : ''} />
                <span>Display Announcement Bar</span>
              </label>
            </div>
          </div>

          <button type="submit" class="btn-primary" style="min-height:44px;">Save store design</button>
        </form>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderWeb() {
    return StudioRenderers.renderMainShopWorkspace("/account/web");
  },

  renderPlans() {
    const plans = SQLiteEngine.getPlans();

    AppUtils.updateSEO({
      title: "Plans — Craft",
      description: "Scale your commerce house with our tiered enterprise plans."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/plans')}
      <main class="container management-module-main plans-main" style="padding: 48px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1>Plans &amp; pricing</h1>
          </div>
        </div>

        <div class="plans-list">
          ${plans.map(p => `
            <article class="plan-card ${p.is_current ? "is-current" : ""}">
              ${(p.is_current || p.badge) ? `
                <div class="plan-card-topline">
                  <span class="product-badge ${p.is_current ? "badge-flagship" : ""}">${p.is_current ? "Current Plan" : AppUtils.escapeHTML(p.badge)}</span>
                </div>
              ` : ""}
              <h2>${AppUtils.escapeHTML(p.name)}</h2>
              <p class="plan-card-description">${AppUtils.escapeHTML(p.description)}</p>
              <div class="plan-card-price">
                <strong>KES ${Number(p.price).toLocaleString("en-KE")}</strong>
                <span>/${AppUtils.escapeHTML(p.billing_period || "month")}</span>
              </div>
              <ul class="plan-card-features">
                ${(p.features || []).slice(0, 3).map(f => `
                  <li>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${AppUtils.escapeHTML(f)}</span>
                  </li>
                `).join("")}
              </ul>
              ${(p.features || []).length > 3 ? `
                <details class="plan-card-more">
                  <summary>See ${p.features.length - 3} more features</summary>
                  <ul class="plan-card-features">
                    ${p.features.slice(3).map(f => `
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>${AppUtils.escapeHTML(f)}</span>
                      </li>
                    `).join("")}
                  </ul>
                </details>
              ` : ""}
              <div>
                ${p.is_current ? `
                  <button class="btn-secondary plan-card-action" style="cursor: default; background: var(--surface-subtle);">Active Plan</button>
                ` : `
                  <button class="btn-primary plan-card-action" data-action="upgrade-plan" data-slug="${p.slug}">Choose ${AppUtils.escapeHTML(p.name)}</button>
                `}
              </div>
            </article>
          `).join("")}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  // Static Information Pages
  renderStaticPage(type) {
    const pages = {
      privacy: {
        title: "Privacy Policy & Data Security",
        content: `
          <h2>Commitment to Client Discretion</h2>
          <p>Craft stores your local storefront and POS data on this device.</p>
          <h3>Data Retention &amp; Local SQLite Storage</h3>
          <p>All catalog preferences, saved shopping bag configurations, and favorites remain housed within your private browser storage engine. We do not sell, rent, or distribute client metrics to third-party data brokers.</p>
          <h3>Your Rights Under GDPR &amp; CCPA</h3>
          <p>Your local store data can be managed from Web Builder.</p>
        `
      },
      terms: {
        title: "Terms and Conditions of Sale",
        content: `
          <h2>Authenticity &amp; Ethical Sourcing</h2>
          <p>Every piece presented in our collections is guaranteed 100% authentic and ethically crafted in accordance with our fair-labor and sustainable textile charters.</p>
          <h3>Pricing &amp; Multi-Currency Settlement</h3>
          <p>All displayed valuations reflect net selling prices. Applicable taxes and customs duties for international destinations are calculated during encrypted checkout.</p>
          <h3>Limitation of Liability</h3>
          <p>Artifacts are designed for enduring daily longevity when cared for in adherence with the provided maintenance directives.</p>
        `
      },
      cookies: {
        title: "Cookie Governance & Preferences",
        content: `
          <h2>Session Integrity &amp; State Persistence</h2>
          <p>We utilize local browser mechanisms (including LocalStorage and sessionStorage) strictly to preserve your active shopping bag contents and design studio preferences across page reloads.</p>
          <p>No non-essential third-party advertising tracking cookies are embedded in our application.</p>
        `
      },
      about: {
        title: "About Craft",
        content: `
          <h2>The Intersection of Form and Substance</h2>
          <p>Craft helps you build and manage your online store.</p>
          <h3>Traceable Craftsmanship</h3>
          <p>We partner directly with multi-generational family mills in Biella, Okayama, Northampton, and Solothurn. By eliminating wholesale intermediaries, we ensure masterwork craftsmanship accessible at direct atelier pricing.</p>
        `
      },
      contact: {
        title: "Client Concierge & Locations",
        content: `
          <h2>Private Assistance</h2>
          <p>Our dedicated concierge team is available to assist with bespoke sizing questions, international delivery tracking, and gift consultations.</p>
          <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius); margin: 24px 0;">
            <p>Use Web Builder to manage your online store.</p>
            <p style="margin-top: 8px;"><strong>Telephone:</strong> +1 (800) 482-9102 / +41 44 211 4820</p>
            <p style="margin-top: 8px;"><strong>Hours:</strong> Monday &ndash; Saturday, 08:00 &ndash; 20:00 CET</p>
          </div>
        `
      },
      help: {
        title: "Client Help Center & Care Guidelines",
        content: `
          <h2>Frequently Addressed Topics</h2>
          <p>Browse our guidance dossiers below or contact our private concierge for tailored support.</p>
          <h3>Order Tracking &amp; Dispatch</h3>
          <p>Orders are dispatched within 24 business hours. A tracking code is generated immediately upon carrier induction.</p>
          <h3>Sizing Guidance</h3>
          <p>Our tailored garments follow traditional European sizing. Please consult the dedicated dimension chips on each product dossier before placing your order.</p>
        `
      },
      faq: {
        title: "Frequently Asked Questions",
        content: `
          <h2>Common Inquiries</h2>
          <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 24px;">
            <div style="background: var(--surface); padding: 20px; border: 1px solid var(--border); border-radius: var(--radius);">
              <strong>Where are your products manufactured?</strong>
              <p style="color: var(--text-muted); margin-top: 6px;">Our cashmere is knit in Biella, Italy; denim woven in Kojima, Japan; timepieces assembled in Biel/Bienne, Switzerland; and leather goods crafted in Florence.</p>
            </div>
            <div style="background: var(--surface); padding: 20px; border: 1px solid var(--border); border-radius: var(--radius);">
              <strong>How does complimentary return shipping work?</strong>
              <p style="color: var(--text-muted); margin-top: 6px;">Every parcel includes a pre-printed, prepaid return dispatch label. You have 30 calendar days to evaluate the piece in your home.</p>
            </div>
            <div style="background: var(--surface); padding: 20px; border: 1px solid var(--border); border-radius: var(--radius);">
              <strong>Are custom monograms available?</strong>
              <p style="color: var(--text-muted); margin-top: 6px;">Complimentary debossed leather monograms and engraved signet rings are available upon request through our private concierge.</p>
            </div>
          </div>
        `
      },
      shipping: {
        title: "Carbon-Neutral Delivery",
        content: `
          <h2>Worldwide Dispatch Standards</h2>
          <p>Shipping details can be added to your store as your business grows.</p>
          <div style="margin: 24px 0;">
            <p><strong>Complimentary Express Delivery:</strong> On all orders exceeding $150.</p>
            <p style="margin-top: 8px;"><strong>Standard Delivery:</strong> $25 flat rate for orders under $150.</p>
            <p style="margin-top: 8px;"><strong>Delivery Timelines:</strong> 2-3 business days to North America and Europe; 3-5 business days to Asia-Pacific.</p>
          </div>
        `
      },
      returns: {
        title: "30-Day Guaranteed Returns & Exchanges",
        content: `
          <h2>Unconditional Evaluation Window</h2>
          <p>We invite you to experience the tactile quality and proportion of our artifacts in your own home. Should a piece not meet your exacting standards, return it within 30 days for a full refund or exchange.</p>
          <h3>Return Conditions</h3>
          <p>Garments and leather goods must be returned unwashed, unworn, and with all original security tags and dust sleeves intact.</p>
        `
      }
    };

    const page = pages[type] || pages.privacy;

    AppUtils.updateSEO({
      title: `${page.title} — Craft`,
      description: `${page.title} for Craft.`
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="container" style="padding: 64px 0 96px; max-width: 820px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <span>${AppUtils.escapeHTML(page.title)}</span>
        </div>
        <h1 style="font-family: var(--font-serif); font-size: 2.75rem; font-weight: 400; margin-bottom: 32px;">${AppUtils.escapeHTML(page.title)}</h1>
        <div style="font-size: 1rem; line-height: 1.8; color: var(--text-muted);">
          ${page.content}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  }
};

  // Master Client Router & Event Controller for Craft









const WEBSITE_BUILDER_DRAFT_TENANT_ID = "__new_website_draft__";
const WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY = "ESHOP_NEW_WEBSITE_PREVIOUS_TENANT_V1";
const WEBSITE_BUILDER_DRAFT_SYNC_KEY = "ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1";

window.localStorage.removeItem("ESHOP_CLOUDFLARE_PUBLISH_TOKEN_V1");

const AppController = {
  carouselTimer: null,
  carouselIndex: 0,
  lastRenderedPath: null,

  isStorefrontVisitPath(path) {
    return typeof path === "string" && (
      path === "/categories" ||
      path.startsWith("/pages/") ||
      path.startsWith("/category/") ||
      path.startsWith("/product/") ||
      ["/search", "/bag", "/checkout", "/checkout/confirmation", "/favorites"].includes(path)
    );
  },

  recordWebVisit(path) {
    if (!this.isStorefrontVisitPath(path)) return;
    try {
      if (!Array.isArray(SQLiteEngine.db.tables.web_visits)) SQLiteEngine.db.tables.web_visits = [];
      const tenantId = this.getActiveTenant().id;
      const visitorKey = `ESHOP_WEB_VISITOR_V1:${encodeURIComponent(tenantId)}`;
      const sessionKey = `ESHOP_WEB_SESSION_V1:${encodeURIComponent(tenantId)}`;
      const getOrCreateId = (storage, key) => {
        let id = storage.getItem(key);
        if (!id) {
          id = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
          storage.setItem(key, id);
        }
        return id;
      };
      let device = "Desktop";
      if (/tablet|ipad/i.test(navigator.userAgent)) device = "Tablet";
      else if (/mobile|android|iphone/i.test(navigator.userAgent)) device = "Mobile";
      const sessionId = getOrCreateId(window.sessionStorage, sessionKey);
      SQLiteEngine.insert("web_visits", {
        tenant_id: tenantId,
        visitor_id: getOrCreateId(window.localStorage, visitorKey),
        session_id: sessionId,
        path: path || "/",
        device,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        created_at: new Date().toISOString()
      });
      const recordedVisits = SQLiteEngine.db.tables.web_visits;
      if (recordedVisits.length > 10000) {
        recordedVisits.splice(0, recordedVisits.length - 10000);
        SQLiteEngine.save();
      }
      if (path === "/checkout") this.recordWebEvent("checkout_started");
      void window.ShopSQLite?.flush().catch(error => console.error("Storefront visit could not be saved.", error));
    } catch (error) {
      console.error("Storefront visit could not be recorded.", error);
    }
  },

  recordWebEvent(event, details = {}) {
    try {
      const tenantId = this.getActiveTenant().id;
      const getOrCreateId = (storage, key) => {
        let id = storage.getItem(key);
        if (!id) {
          id = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
          storage.setItem(key, id);
        }
        return id;
      };
      SQLiteEngine.insert("web_events", {
        tenant_id: tenantId,
        visitor_id: getOrCreateId(window.localStorage, `ESHOP_WEB_VISITOR_V1:${encodeURIComponent(tenantId)}`),
        session_id: getOrCreateId(window.sessionStorage, `ESHOP_WEB_SESSION_V1:${encodeURIComponent(tenantId)}`),
        event,
        ...details,
        created_at: new Date().toISOString()
      });
      const events = SQLiteEngine.db.tables.web_events;
      if (events.length > 10000) {
        events.splice(0, events.length - 10000);
        SQLiteEngine.save();
      }
      void window.ShopSQLite?.flush().catch(error => console.error("Storefront activity could not be saved.", error));
    } catch (error) {
      console.error("Storefront activity could not be recorded.", error);
    }
  },

  getActiveTenant() {
    try {
      const active = JSON.parse(window.localStorage.getItem("ESHOP_ACTIVE_TENANT_V1") || "null");
      if (active && typeof active.id === "string") {
        return {
          id: active.id,
          name: active.name || active.id,
          hostname: active.hostname || `${active.id}.rrobin.co.ke`
        };
      }
    } catch (error) {
      console.warn("Saved active shop selection is invalid.", error);
    }
    return { id: "main", name: "Main shop", hostname: "rrobin.co.ke" };
  },

  studioAppearanceKey() {
    return `ESHOP_STUDIO_APPEARANCE_V1:${encodeURIComponent(this.getActiveTenant().id)}`;
  },

  getStudioAppearance() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(this.studioAppearanceKey()) || "null");
      if (!saved || typeof saved !== "object") return { primary_color: "#18181B", card_radius: "4px" };
      const primaryColor = /^#[0-9a-f]{6}$/i.test(saved.primary_color || "") ? saved.primary_color : "#18181B";
      const channels = primaryColor.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
      const isOldBlueAccent = channels[2] > channels[0] * 1.12 && channels[2] > channels[1] * 1.04;
      if (isOldBlueAccent) {
        saved.primary_color = "#18181B";
        window.localStorage.setItem(this.studioAppearanceKey(), JSON.stringify(saved));
      }
      return {
        primary_color: isOldBlueAccent ? "#18181B" : primaryColor,
        card_radius: ["0px", "4px", "10px"].includes(saved.card_radius) ? saved.card_radius : "4px"
      };
    } catch (error) {
      console.warn("Saved app appearance could not be read.", error);
      return { primary_color: "#18181B", card_radius: "4px" };
    }
  },

  getBuilderCatalogSnapshot() {
    return {
      products: SQLiteEngine.select("products"),
      categories: SQLiteEngine.getCategories(),
      store: SQLiteEngine.getStore(),
      pages: SQLiteEngine.getPages(),
      appearance: this.getStudioAppearance()
    };
  },

  async persistBuilderCatalogMutation(mutation) {
    const value = mutation();
    await window.ShopSQLite.flush();
    return { value, catalog: this.getBuilderCatalogSnapshot() };
  },

  installBuilderSqliteBridge() {
    const persist = mutation => this.persistBuilderCatalogMutation(mutation);
    window.EshopBuilderSqlite = {
      saveProduct: data => persist(() => SQLiteEngine.saveProduct(data)),
      deleteProduct: id => persist(() => SQLiteEngine.deleteProduct(id)),
      duplicateProduct: id => persist(() => SQLiteEngine.duplicateProduct(id)),
      saveCategory: data => persist(() => SQLiteEngine.saveCategory(data)),
      deleteCategory: id => persist(() => SQLiteEngine.deleteCategory(id)),
      updateInventoryStock: (productId, stock) => persist(() => SQLiteEngine.updateInventoryStock(productId, stock)),
      createOrder: (data, items) => persist(() => SQLiteEngine.createOrder(data, items))
    };
  },

  tenantCatalogs() {
    if (!Array.isArray(SQLiteEngine.db.tables.tenant_catalogs)) {
      SQLiteEngine.db.tables.tenant_catalogs = [];
    }
    return SQLiteEngine.db.tables.tenant_catalogs;
  },

  isWebsiteBuilderDraftTenant(tenantId) {
    return tenantId === WEBSITE_BUILDER_DRAFT_TENANT_ID;
  },

  async websiteBuilderSourceCatalog() {
    const activeTenant = this.getActiveTenant();
    const cachedMainCatalog = this.tenantCatalogs().find(item => item.tenant_id === "main");
    let source;
    if (activeTenant.id === WEBSITE_BUILDER_DRAFT_TENANT_ID) {
      source = cachedMainCatalog;
      if (!source) throw new Error("The Main Store catalog is not available on this device.");
    } else if (activeTenant.id === "main") {
      source = {
        products: SQLiteEngine.select("products"),
        categories: SQLiteEngine.getCategories()
      };
    } else {
      if (!cachedMainCatalog) throw new Error("The Main Store catalog is not available on this device.");
      source = cachedMainCatalog;
    }

    const categories = JSON.parse(JSON.stringify(source.categories || []));
    const products = JSON.parse(JSON.stringify(source.products || []))
      .filter(product => product && product.status !== "archived");
    let nextCategoryId = categories.reduce((maximum, category) =>
      Math.max(maximum, Number(category.id) || 0), 0);
    const categoriesByName = new Map(categories.map(category =>
      [String(category.name || "").trim().toLocaleLowerCase(), category]));
    const ensureCategory = name => {
      const categoryName = String(name || "").trim();
      if (!categoryName) return null;
      const key = categoryName.toLocaleLowerCase();
      if (categoriesByName.has(key)) return categoriesByName.get(key);
      const category = { id: ++nextCategoryId, name: categoryName };
      categories.push(category);
      categoriesByName.set(key, category);
      return category;
    };
    const categoriesById = new Map(categories.map(category => [String(category.id), category]));
    products.forEach(product => {
      const category = categoriesById.get(String(product.category_id ?? product.categoryId));
      product.category_name ||= product.categoryName || category?.name || "";
      if (!category && product.category_name) {
        const added = ensureCategory(product.category_name);
        if (added) product.category_id = added.id;
      }
    });

    let posProductCount = 0;
    let posConnected = false;
    if (window.ShopPOS?.listProducts && window.ShopPOS?.listCategories) {
      const [posProducts, posCategories] = await Promise.all([
        window.ShopPOS.listProducts(),
        window.ShopPOS.listCategories()
      ]);
      if (!Array.isArray(posProducts) || !Array.isArray(posCategories)) {
        throw new Error("Main Store/POS returned an invalid product catalog.");
      }
      posConnected = true;
      const posCategoryName = product => String(product.categoryName || product.category_name ||
        posCategories.find(category => Number(category.id) === Number(product.categoryId ?? product.category_id))?.name || "").trim();
      posCategories.forEach(category => ensureCategory(category.name));
      let nextProductId = products.reduce((maximum, product) =>
        Math.max(maximum, Number(product.id) || 0), 0);
      const productsBySku = new Map(products.filter(product => product.sku)
        .map(product => [String(product.sku).trim().toLocaleLowerCase(), product]));
      const productsByName = new Map(products.map(product => [
        `${String(product.name || "").trim().toLocaleLowerCase()}|${String(product.category_name || "").trim().toLocaleLowerCase()}`,
        product
      ]));
      for (const posProduct of posProducts.filter(product => product?.active !== false)) {
        const name = String(posProduct.name || "").trim();
        if (!name) continue;
        const sku = String(posProduct.sku || "").trim();
        const categoryName = posCategoryName(posProduct);
        const key = `${name.toLocaleLowerCase()}|${categoryName.toLocaleLowerCase()}`;
        const existing = (sku && productsBySku.get(sku.toLocaleLowerCase())) || productsByName.get(key);
        if (existing) {
          const category = ensureCategory(categoryName);
          if (!existing.category_name && category) {
            existing.category_id = category.id;
            existing.category_name = category.name;
          }
          if (existing.stock === undefined || existing.stock === null || existing.stock === "") {
            existing.stock = Math.max(0, Number(posProduct.stock) || 0);
          }
          if (!existing.sku && sku) {
            existing.sku = sku;
            productsBySku.set(sku.toLocaleLowerCase(), existing);
          }
          continue;
        }
        const category = ensureCategory(categoryName);
        const posAttributes = Array.isArray(posProduct.taxonomyAttributes)
          ? posProduct.taxonomyAttributes
          : [];
        products.push({
          id: ++nextProductId,
          source_pos_product_id: posProduct.id,
          name,
          sku,
          barcode: String(posProduct.barcode || ""),
          brand: String(posProduct.brand || ""),
          price: Math.max(0, Number(posProduct.price) || 0),
          cost_price: Math.max(0, Number(posProduct.buyingPrice) || 0),
          stock: Math.max(0, Number(posProduct.stock) || 0),
          description: String(posProduct.description || ""),
          images: posProduct.imageUri ? [String(posProduct.imageUri)] : [],
          media_type: "image",
          taxonomy_category_id: posProduct.taxonomyCategoryId || null,
          taxonomy_custom_category: posProduct.taxonomyCustomCategory || "",
          taxonomy_attributes: posAttributes,
          sizes: [],
          colors: [],
          variants: [],
          category_id: category?.id ?? null,
          category_name: category?.name || categoryName
        });
        const added = products[products.length - 1];
        if (sku) productsBySku.set(sku.toLocaleLowerCase(), added);
        productsByName.set(key, added);
        posProductCount += 1;
      }
    }
    return { products, categories, posProductCount, posConnected };
  },

  async prepareWebsiteBuilderDraftTenant(draft, themeId) {
    const activeTenant = this.getActiveTenant();
    const sourceCatalog = await this.websiteBuilderSourceCatalog();
    draft.products = sourceCatalog.products;
    draft.categories = sourceCatalog.categories;
    StudioRenderers.saveWebsiteBuilderDraft(draft);
    if (activeTenant.id !== WEBSITE_BUILDER_DRAFT_TENANT_ID &&
        !window.localStorage.getItem(WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY)) {
      window.localStorage.setItem(WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY, JSON.stringify(activeTenant));
    }
    const savedCatalog = this.tenantCatalogs().find(item =>
      item.tenant_id === WEBSITE_BUILDER_DRAFT_TENANT_ID);
    const availableThemes = StudioRenderers.websiteThemesForPicker();
    const selectedTheme = availableThemes.find(theme =>
      theme.id === themeId) || availableThemes.find(theme =>
      theme.id === draft.selected_theme) || availableThemes[0];
    const catalogSignature = value => JSON.stringify({
      categories: value.categories.map(category => [String(category.id), category.name]),
      products: value.products.map(product => [
        String(product.id),
        String(product.source_product_id || ""),
        product.name,
        Number(product.price) || 0,
        Number(product.cost_price) || 0,
        Number(product.stock) || 0,
        String(product.category_id),
        String(product.sku || ""),
        String(product.description || ""),
        String(product.media_type || "image"),
        String(product.video_path || ""),
        Array.isArray(product.images) ? product.images.map(image => {
          const value = String(image || "");
          return [value.length, value.slice(0, 64), value.slice(-32)];
        }) : [],
        Array.isArray(product.spin_frames) ? product.spin_frames : [],
        String(product.taxonomy_category_id || ""),
        String(product.taxonomy_category_name || ""),
        String(product.taxonomy_custom_category || ""),
        Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes : [],
        String(product.option1_name || ""),
        String(product.option2_name || ""),
        Array.isArray(product.sizes) ? product.sizes : [],
        Array.isArray(product.colors) ? product.colors : [],
        Array.isArray(product.variants) ? product.variants : []
      ])
    });
    const signature = catalogSignature(draft);
    const savedSignature = window.localStorage.getItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY) || "";
    const hasSavedDraftCatalog = Boolean(savedCatalog?.draft_signature);
    const catalogIsCurrent = Boolean(savedSignature === signature && savedCatalog?.draft_signature === signature);
    const previousDraftStore = hasSavedDraftCatalog ? savedCatalog.store || {} : {};
    const draftStore = {
      name: "New website draft",
      title: "New website draft",
      website_theme_id: selectedTheme?.id || "litrus-mixer",
      section_layout: draft.section_layout,
      primary_color: "#18181B",
      background_color: "#FAFAF8",
      text_color: "#18181B"
    };
    [
      "primary_color", "background_color", "surface_color", "text_color",
      "font_family", "display_font_family", "mono_font_family", "color_theme",
      "accent2_color", "accent3_color", "design_theme", "card_shape", "card_radius"
    ].forEach(key => {
      if (typeof previousDraftStore[key] === "string") draftStore[key] = previousDraftStore[key];
    });
    const draftTenant = {
      id: WEBSITE_BUILDER_DRAFT_TENANT_ID,
      name: "New website draft",
      hostname: "Draft — not created yet"
    };
    const draftCatalog = catalogIsCurrent ? savedCatalog : {
      products: draft.products,
      categories: draft.categories,
      inventory: [],
      pages: [],
      store: draftStore
    };
    if (activeTenant.id !== WEBSITE_BUILDER_DRAFT_TENANT_ID || !catalogIsCurrent) {
      this.setActiveTenantCatalog(draftTenant, draftCatalog);
      if (!catalogIsCurrent) {
        const cachedDraft = this.tenantCatalogs().find(item =>
          item.tenant_id === WEBSITE_BUILDER_DRAFT_TENANT_ID);
        if (cachedDraft) cachedDraft.draft_signature = "";
        SQLiteEngine.save();
      }
    }

    if (!selectedTheme) return;

    draft.selected_theme = selectedTheme.id;
    SQLiteEngine.updateStore({
      website_theme_id: selectedTheme.id,
      section_layout: draft.section_layout
    });
    this.cacheActiveTenantCatalog();
    const cachedDraft = this.tenantCatalogs().find(item =>
      item.tenant_id === WEBSITE_BUILDER_DRAFT_TENANT_ID);
    if (cachedDraft) cachedDraft.draft_signature = signature;
    await window.ShopSQLite.flush();
    window.localStorage.setItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY, signature);
  },

  restoreWebsiteBuilderPreviousTenant() {
    if (this.getActiveTenant().id !== WEBSITE_BUILDER_DRAFT_TENANT_ID) return;
    let previousTenant;
    try {
      previousTenant = JSON.parse(window.localStorage.getItem(WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY) || "null");
    } catch (error) {
      console.warn("Previous shop selection for the website draft is invalid.", error);
    }
    if (!previousTenant?.id || this.isWebsiteBuilderDraftTenant(previousTenant.id)) {
      previousTenant = { id: "main", name: "Main shop", hostname: "rrobin.co.ke" };
    }
    const catalog = this.tenantCatalogs().find(item => item.tenant_id === previousTenant.id);
    if (!catalog) {
      AppUtils.showToast("Could not restore the shop that was open before the website draft.", "danger");
      return;
    }
    this.setActiveTenantCatalog(previousTenant, catalog);
    window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY);
  },

  cacheActiveTenantCatalog() {
    const tenant = this.getActiveTenant();
    const existing = this.tenantCatalogs().find(item => item.tenant_id === tenant.id);
    const catalog = {
      tenant_id: tenant.id,
      name: tenant.name,
      hostname: tenant.hostname,
      owner_token: existing?.owner_token || "",
      draft_signature: existing?.draft_signature || "",
      products: JSON.parse(JSON.stringify(SQLiteEngine.select("products"))),
      categories: JSON.parse(JSON.stringify(SQLiteEngine.getCategories())),
      inventory: JSON.parse(JSON.stringify(SQLiteEngine.select("inventory"))),
      store: {
        ...JSON.parse(JSON.stringify(SQLiteEngine.getStore())),
        hold_duration_hours: Number(StudioRenderers.getWorkspaceSetting("max_hold_hours", 24))
      },
      pages: JSON.parse(JSON.stringify(SQLiteEngine.getPages()))
    };
    const savedCatalogs = this.tenantCatalogs();
    const index = savedCatalogs.findIndex(item => item.tenant_id === tenant.id);
    if (index < 0) savedCatalogs.push(catalog);
    else savedCatalogs[index] = catalog;
    SQLiteEngine.save();
  },

  setWebsiteProductHoldState(productIds, enabled) {
    const ids = new Set(productIds.map(Number).filter(Number.isSafeInteger));
    const updatedCount = SQLiteEngine.update(
      "products",
      product => product.status !== "archived" && ids.has(Number(product.id)),
      product => ({ ...product, booking_enabled: Boolean(enabled) })
    );
    if (updatedCount) this.cacheActiveTenantCatalog();
    return updatedCount;
  },

  setActiveTenantCatalog(tenant, catalog) {
    if (!Array.isArray(catalog.products) || !Array.isArray(catalog.categories)) {
      throw new Error("The selected shop has an invalid catalog.");
    }
    const products = JSON.parse(JSON.stringify(catalog.products));
    const categories = JSON.parse(JSON.stringify(catalog.categories));
    const store = catalog.store && typeof catalog.store === "object" ? catalog.store : {};
    this.cacheActiveTenantCatalog();
    SQLiteEngine.db.tables.products = products;
    SQLiteEngine.db.tables.categories = categories;
    SQLiteEngine.db.tables.pages = Array.isArray(catalog.pages)
      ? JSON.parse(JSON.stringify(catalog.pages))
      : [];
    SQLiteEngine.db.tables.inventory = Array.isArray(catalog.inventory)
      ? JSON.parse(JSON.stringify(catalog.inventory))
      : products.map(product => ({
        product_id: product.id,
        sku: product.sku,
        stock: Number(product.stock || 0),
        cost_price: Number(product.cost_price || 0),
        selling_price: Number(product.price || 0),
        low_stock_threshold: 10,
        status: product.stock <= 0 ? "out_of_stock" : product.stock <= 10 ? "low_stock" : "in_stock"
      }));
    SQLiteEngine.db.tables.store = [JSON.parse(JSON.stringify(store))];
    window.localStorage.setItem("ESHOP_ACTIVE_TENANT_V1", JSON.stringify(tenant));
    const draft = {
      tenant_id: tenant.id,
      name: tenant.name,
      hostname: tenant.hostname,
      owner_token: tenant.owner_token || this.tenantCatalogs().find(item => item.tenant_id === tenant.id)?.owner_token || "",
      products: JSON.parse(JSON.stringify(products)),
      categories: JSON.parse(JSON.stringify(categories)),
      inventory: JSON.parse(JSON.stringify(SQLiteEngine.db.tables.inventory)),
      store: JSON.parse(JSON.stringify(store)),
      pages: JSON.parse(JSON.stringify(SQLiteEngine.db.tables.pages))
    };
    const savedCatalogs = this.tenantCatalogs();
    const index = savedCatalogs.findIndex(item => item.tenant_id === tenant.id);
    if (index < 0) savedCatalogs.push(draft);
    else savedCatalogs[index] = draft;
    SQLiteEngine.save();
    this.applyThemeSettings();
  },

  async applyWebsiteBuilderDraft(draft, themeId) {
    if (!Array.isArray(draft?.products) ||
        !Array.isArray(draft.categories) || !draft.categories.length) {
      throw new Error("Add at least one category in Webmaker before creating this website.");
    }
    const categoryIds = new Map();
    for (const category of draft.categories) {
      const existing = new Set(SQLiteEngine.getCategories().map(item => item.id));
      SQLiteEngine.saveCategory({ name: category.name });
      const saved = SQLiteEngine.getCategories().find(item => !existing.has(item.id) && item.name === category.name);
      if (!saved) throw new Error(`Could not save website category "${category.name}".`);
      categoryIds.set(category.id, saved.id);
    }
    for (const product of draft.products) {
      const stock = Math.max(0, Number(product.stock) || 0);
      const saved = SQLiteEngine.saveProduct({
        name: product.name,
        sku: product.sku || "",
        brand: product.brand || "",
        price: Number(product.price) || 0,
        original_price: Number(product.price) || 0,
        cost_price: Math.max(0, Number(product.cost_price) || 0),
        stock,
        description: product.description || "",
        category_id: categoryIds.get(product.category_id) ?? null,
        images: Array.isArray(product.images) ? product.images : [],
        media_type: ["image", "cutout", "spin", "video"].includes(product.media_type) ? product.media_type : "image",
        spin_frames: Array.isArray(product.spin_frames) ? product.spin_frames : [],
        video_url: product.video_url || "",
        video_path: product.video_path || "",
        taxonomy_category_id: product.taxonomy_category_id || null,
        taxonomy_category_name: product.taxonomy_category_name || "",
        taxonomy_custom_category: product.taxonomy_custom_category || null,
        taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes : [],
        sizes: Array.isArray(product.sizes) ? product.sizes : [],
        colors: Array.isArray(product.colors) ? product.colors : [],
        variants: Array.isArray(product.variants) ? product.variants : []
      });
      if (!saved) throw new Error(`Could not save website product "${product.name}".`);
    }
    const selectedTheme = StudioRenderers.websiteThemes().find(theme =>
      theme.id === (themeId || draft.selected_theme)
    );
    if (!selectedTheme) {
      throw new Error("Choose a website theme before creating this website.");
    }
    SQLiteEngine.updateStore({
      website_theme_id: selectedTheme.id,
      section_layout: draft.section_layout || { order: [], hidden: [], removed: [], added: [] },
      ...(selectedTheme?.preview_appearance || {})
    });
    this.cacheActiveTenantCatalog();
    await window.ShopSQLite.flush();
  },

  cloudflareConnection(tenantId = this.getActiveTenant().id) {
    const tenant = this.tenantCatalogs().find(item => item.tenant_id === tenantId);
    const token = tenant?.owner_token ||
      window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") ||
      (tenantId === "main"
        ? this.tenantCatalogs().find(item => item.tenant_id === "main")?.owner_token
        : "") ||
      "";
    const endpoint = window.localStorage.getItem("ESHOP_CLOUDFLARE_PUBLISH_URL_V1") ||
      "https://eshop-storefront.ryanrobin07-ek.workers.dev";
    let origin;
    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
        throw new Error("Use an HTTPS Cloudflare Worker URL.");
      }
      origin = url.origin;
    } catch (error) {
      throw new Error(error.message || "Enter a valid Cloudflare Worker URL.");
    }
    return { token, origin };
  },

  async restoreAccountWebsites(tenants, origin) {
    for (const tenant of tenants || []) {
      if (!tenant.owner_token || !tenant.id) continue;
      const response = await fetch(new URL(`/api/catalog?tenant=${encodeURIComponent(tenant.id)}&private=1`, origin), {
        headers: { Authorization: `Bearer ${tenant.owner_token}` }
      });
      const catalog = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(catalog.error || `Could not restore ${tenant.name || tenant.id}.`);
      const existing = this.tenantCatalogs().find(item => item.tenant_id === tenant.id);
      if (existing) {
        existing.owner_token = tenant.owner_token;
        existing.name = tenant.name || existing.name;
        existing.hostname = tenant.hostname || existing.hostname;
      } else {
        this.tenantCatalogs().push({
          tenant_id: tenant.id,
          name: tenant.name || tenant.id,
          hostname: tenant.hostname || `${tenant.id}.rrobin.co.ke`,
          owner_token: tenant.owner_token,
          products: Array.isArray(catalog.products) ? catalog.products : [],
          categories: Array.isArray(catalog.categories) ? catalog.categories : [],
          inventory: Array.isArray(catalog.inventory) ? catalog.inventory : [],
          store: catalog.store && typeof catalog.store === "object" ? catalog.store : {},
          pages: Array.isArray(catalog.pages) ? catalog.pages : []
        });
      }
    }
    SQLiteEngine.save();
    await window.ShopSQLite.flush();
  },

  async cloudflareRequest(path, options = {}, tenantId = this.getActiveTenant().id, anonymous = false, credentialOverride = "") {
    let draftLitrusImageRequest = false;
    if (this.isWebsiteBuilderDraftTenant(this.getActiveTenant().id) ||
        this.isWebsiteBuilderDraftTenant(tenantId)) {
      const [route, query] = this.currentRoute().split("?");
      const routeParams = new URLSearchParams(query || "");
      const finalTenantSetup = route === "/account/web/site" &&
        routeParams.get("new") === "1" &&
        routeParams.get("finish") === "1";
      const pathUrl = new URL(path, window.location.origin);
      const bootstrapTenantId = pathUrl.searchParams.get("tenant");
      const bootstrapRequest = finalTenantSetup && !!credentialOverride &&
        tenantId !== WEBSITE_BUILDER_DRAFT_TENANT_ID && bootstrapTenantId === tenantId &&
        (pathUrl.pathname === "/api/catalog" &&
          String(options.method || "GET").toUpperCase() === "PUT" ||
          pathUrl.pathname === "/api/theme-publish" &&
          String(options.method || "GET").toUpperCase() === "POST");
      draftLitrusImageRequest = route === "/account/web/site" &&
        routeParams.get("new") === "1" &&
        routeParams.get("edit") === "1" &&
        routeParams.get("theme") === "litrus-mixer" &&
        tenantId === "main" &&
        pathUrl.pathname === "/api/images/draft-search" &&
        String(options.method || "GET").toUpperCase() === "POST";
      const rollbackCreatedTenant = finalTenantSetup && !!credentialOverride &&
        tenantId !== WEBSITE_BUILDER_DRAFT_TENANT_ID &&
        path === `/api/tenants/${encodeURIComponent(tenantId)}` &&
        String(options.method || "GET").toUpperCase() === "DELETE";
      const creatingTenant = path === "/api/tenants" &&
        String(options.method || "GET").toUpperCase() === "PUT" &&
        finalTenantSetup;
      if (!creatingTenant && !bootstrapRequest && !rollbackCreatedTenant && !draftLitrusImageRequest) {
        throw new Error("Cloudflare requests are disabled for the local website draft until final setup.");
      }
    }
    const connection = this.cloudflareConnection(tenantId);
    const token = draftLitrusImageRequest ? "" : credentialOverride || connection.token;
    const { origin } = connection;
    if (!token && !anonymous) throw new Error(tenantId === "main"
      ? "Sign in to the Craft account that owns the main website. Tap Sign in at the top of the screen."
      : "Sign in to the Craft account that owns this shop. Tap Sign in at the top of the screen.");
    let response;
    try {
      response = await fetch(new URL(path, origin), {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(options.body ? { "Content-Type": "application/json" } : {})
        }
      });
    } catch (error) {
      if (error instanceof TypeError && navigator.onLine === false) {
        throw new Error("You're offline. This action needs an internet connection; your local app data is still available.");
      }
      throw error;
    }
    const body = await response.text();
    let result;
    try {
      result = JSON.parse(body);
    } catch {
      throw new Error(body || `Cloudflare returned HTTP ${response.status}.`);
    }
    if (!response.ok) {
      const error = new Error(result.error || `Cloudflare returned HTTP ${response.status}.`);
      error.status = response.status;
      if (typeof result.error_code === "string") error.code = result.error_code;
      throw error;
    }
    return result;
  },

  async loadTenantCatalog(tenant) {
    const draft = this.tenantCatalogs().find(item => item.tenant_id === tenant.id);
    if (draft) {
      this.setActiveTenantCatalog(tenant, draft);
      return;
    }
    if (tenant.id !== "main" && !tenant.owner_token) {
      throw new Error("This shop's private key is not on this device. Shop access can’t be recovered without the original device.");
    }
    const catalog = await this.cloudflareRequest(
      `/api/catalog?tenant=${encodeURIComponent(tenant.id)}&private=1`,
      {},
      tenant.id
    );
    if (tenant.id === "main" && !catalog.products.length && !catalog.categories.length) {
      throw new Error("The main shop has no published catalog. Choose Deploy storefront to publish the device catalog first.");
    }
    this.setActiveTenantCatalog(tenant, catalog);
  },

  async refreshTenantList(container) {
    const status = document.getElementById("tenant-manager-status");
    if (status) status.textContent = "Loading your shops…";
    const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
    const localTenants = this.tenantCatalogs().filter(item =>
      item.tenant_id !== "__new_website_draft__");
    let remoteTenants = [];
    if (sessionToken) {
      const result = await this.cloudflareRequest("/api/tenants", {}, "main", false, sessionToken);
      remoteTenants = Array.isArray(result.tenants) ? result.tenants : [];
    }
    const tenantsById = new Map();
    for (const tenant of [...localTenants, ...remoteTenants]) {
      if (!tenant?.id && !tenant?.tenant_id) continue;
      const id = tenant.id || tenant.tenant_id;
      if (this.isWebsiteBuilderDraftTenant(id)) continue;
      const saved = localTenants.find(item => item.tenant_id === id);
      tenantsById.set(id, {
        ...saved,
        ...tenant,
        id,
        name: tenant.name || saved?.name || id,
        hostname: tenant.hostname || saved?.hostname || (id === "main" ? "rrobin.co.ke" : `${id}.rrobin.co.ke`)
      });
    }
    const tenants = [...tenantsById.values()].sort((a, b) =>
      a.id === "main" ? -1 : b.id === "main" ? 1 : a.name.localeCompare(b.name));
    container.innerHTML = tenants.map(tenant => {
      const active = this.getActiveTenant().id === tenant.id;
      return `
        <article class="product-list-item" style="display:flex; align-items:center; gap:12px; padding:14px;">
          <div style="min-width:0; flex:1;">
            <strong style="display:block;">${AppUtils.escapeHTML(tenant.name)}</strong>
            <small style="display:block; color:var(--text-muted);">${AppUtils.escapeHTML(tenant.hostname)}</small>
          </div>
          <a class="option-chip" href="https://${encodeURIComponent(tenant.hostname)}" target="_blank" rel="noopener">Open</a>
          <button type="button" class="btn-secondary" data-load-tenant="${AppUtils.escapeHTML(tenant.id)}" ${active ? "disabled" : ""}>${active ? "Editing" : "Edit shop"}</button>
        </article>`;
    }).join("");
    if (status) status.textContent = sessionToken
      ? `${tenants.length} shop${tenants.length === 1 ? "" : "s"} linked to your account.`
      : `${tenants.length} shop${tenants.length === 1 ? "" : "s"} available on this device. Sign in to see shops linked to your account.`;
    container.querySelectorAll("[data-load-tenant]").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        button.textContent = "Loading…";
        try {
          const tenant = tenants.find(item => item.id === button.dataset.loadTenant);
          if (!tenant) throw new Error("Selected shop is no longer in the Cloudflare shop list.");
          await this.loadTenantCatalog(tenant);
          AppUtils.showToast(`Now editing ${tenant.name}`);
          this.navigate("/account/products");
        } catch (error) {
          AppUtils.showToast(error.message || "Could not load this shop.", "danger");
          button.disabled = false;
          button.textContent = "Edit shop";
        }
      };
    });
  },

  initTenantManager() {
    const tenantList = document.getElementById("tenant-manager-list");
    if (!tenantList) return;
    void this.refreshTenantList(tenantList).catch(error => {
      const status = document.getElementById("tenant-manager-status");
      if (status) status.textContent = error.message || "Could not load shops saved on this device.";
    });
  },

  renderLaunchpad() {
    document.title = "Home — Craft";
    const hasAccountSession = Boolean(window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1"));
    const username = hasAccountSession
      ? window.localStorage.getItem("ESHOP_ACCOUNT_USERNAME_V1")?.trim() || "there"
      : "there";
    return `
      <main class="home-screen" aria-label="Craft home">
        <header class="home-screen-header">
          <p class="home-screen-greeting">Hi, ${AppUtils.escapeHTML(username)} <span aria-hidden="true">👋</span></p>
          <a class="home-screen-profile" href="/app-account" data-route="/app-account" aria-label="Account" title="Account">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2z"/></svg>
          </a>
        </header>
        <section class="home-screen-main" aria-label="Shop workspaces">
          <div class="home-launcher-group" role="group" aria-label="POS and workspaces">
            <a class="home-pos-card" href="/pos" data-route="/pos" aria-label="Open POS">
              <span class="home-pos-mark" aria-hidden="true">POS</span>
              <span class="home-pos-copy"><strong>Open POS</strong><small>Start a sale or manage payments</small></span>
              <span class="home-pos-arrow" aria-hidden="true">→</span>
            </a>
            <nav class="home-workspace-grid" aria-label="Choose a workspace">
              <a class="home-workspace-card home-workspace-card-main" href="/account/main-shop" data-route="/account/main-shop" aria-label="Main Store">
                <strong>Main Store</strong>
                <small>Products, orders and inventory</small>
              </a>
              <a class="home-workspace-card home-workspace-card-craft" href="/account/web" data-route="/account/web" aria-label="Craft Web Studio">
                <strong>Craft</strong>
                <small>Build and manage your storefront</small>
              </a>
            </nav>
            <nav class="home-shortcut-grid" aria-label="Quick actions">
              <a class="home-shortcut-link" href="/store/products" data-route="/store/products">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3z"/><path d="M4 7.5V16l8 5 8-5V7.5M12 12v9"/></svg>
                <span>Products</span>
              </a>
              <a class="home-shortcut-link" href="/store/inventory" data-route="/store/inventory">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M7 4v4M12 10v4M17 16v4"/></svg>
                <span>Inventory</span>
              </a>
              <a class="home-shortcut-link" href="/store/orders" data-route="/store/orders">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/></svg>
                <span>Orders</span>
              </a>
              <a class="home-shortcut-link" href="/store/categories" data-route="/store/categories">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
                <span>Categories</span>
              </a>
            </nav>
          </div>
          <section class="home-dashboard" data-home-dashboard aria-label="Store overview" aria-live="polite" aria-busy="true">
            <p class="home-dashboard-loading" role="status">Loading your store overview…</p>
            <div class="home-dashboard-skeleton" aria-hidden="true">
              <div class="home-metric-grid">
                ${Array.from({ length: 3 }, () => `<article class="home-data-card"><span class="home-data-label home-skeleton-line is-short"></span><strong class="home-data-value home-skeleton-line is-value"></strong><small class="home-data-note home-skeleton-line is-medium"></small></article>`).join("")}
              </div>
              <div class="home-panel-grid">
                <section class="home-panel home-panel-compact">
                  <div class="home-panel-heading"><div><span class="home-panel-kicker home-skeleton-line is-short"></span><h2 class="home-skeleton-line is-medium is-heading"></h2></div></div>
                </section>
                <section class="home-panel home-panel-compact">
                  <div class="home-panel-heading"><div><span class="home-panel-kicker home-skeleton-line is-short"></span><h2 class="home-skeleton-line is-medium is-heading"></h2></div></div>
                  ${Array.from({ length: 2 }, () => `<div class="home-attention-row"><span><strong class="home-skeleton-line is-medium"></strong><small class="home-skeleton-line is-long"></small></span><span class="home-attention-count home-skeleton-line"></span></div>`).join("")}
                </section>
              </div>
              <section class="home-panel">
                <div class="home-panel-heading"><div><span class="home-panel-kicker home-skeleton-line is-short"></span><h2 class="home-skeleton-line is-medium is-heading"></h2></div><span class="home-skeleton-line is-short"></span></div>
                ${Array.from({ length: 3 }, () => `<div class="home-recent-row"><div class="home-recent-copy"><strong class="home-skeleton-line is-medium"></strong><small class="home-skeleton-line is-short"></small></div><div class="home-recent-total"><strong class="home-skeleton-line is-short"></strong><small class="home-skeleton-line is-medium"></small></div></div>`).join("")}
              </section>
            </div>
          </section>
        </section>
      </main>
    `;
  },

  async loadHomeDashboard() {
    const dashboard = document.querySelector("[data-home-dashboard]");
    if (!dashboard) return;
    try {
      const snapshot = await StudioRenderers.getMainShopSnapshot();
      if (!dashboard.isConnected) return;
      const currency = String(snapshot.currency || "KES").toUpperCase();
      const excludedStatuses = new Set(["refunded", "voided", "cancelled", "canceled", "failed"]);
      const sales = snapshot.sales.filter(sale =>
        sale.currency === currency && !excludedStatuses.has(String(sale.status || "").toLowerCase()));
      const localDateKey = value => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      };
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayKey = localDateKey(today);
      const yesterdayKey = localDateKey(yesterday);
      const todaySales = sales.filter(sale => localDateKey(sale.date) === todayKey);
      const yesterdaySales = sales.filter(sale => localDateKey(sale.date) === yesterdayKey);
      const totalFor = items => items.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
      const todayTotal = totalFor(todaySales);
      const lowStockCount = snapshot.products.filter(product =>
        product.stock != null && Number.isFinite(Number(product.stock)) && Number(product.stock) <= 5).length;
      const pendingPaymentCount = sales.filter(sale =>
        Number(sale.collected) < Number(sale.total)).length;
      const money = amount => StudioRenderers.formatMainShopMoney(amount, currency);
      const recentSales = sales.slice(0, 3);
      const recentRows = recentSales.length
        ? recentSales.map(sale => {
          const itemName = (sale.lineItems || []).map(item => String(item.name || "").trim()).find(Boolean)
            || `${Number(sale.itemCount) || 0} items`;
          const nameCharacters = Array.from(itemName);
          const itemLabel = nameCharacters.length > 12
            ? `${nameCharacters.slice(0, 11).join("")}…`
            : itemName;
          const channelLabel = /web|online/i.test(String(sale.channel || "")) ? "Web" : "POS";
          return `<div class="home-recent-row">
            <div class="home-recent-copy">
              <strong>${AppUtils.escapeHTML(itemLabel)}</strong>
              <small>${channelLabel}</small>
            </div>
            <div class="home-recent-total">
              <strong>${AppUtils.escapeHTML(money(sale.total))}</strong>
              <small>Payment</small>
            </div>
          </div>`;
        }).join("")
        : `<p class="home-empty">No sales recorded yet.</p>`;
      dashboard.innerHTML = `
        <div class="home-metric-grid" aria-label="Today’s sales summary">
          <article class="home-data-card">
            <span class="home-data-label">Sales today</span>
            <strong class="home-data-value">${AppUtils.escapeHTML(money(todayTotal))}</strong>
            <small class="home-data-note">${todaySales.length} sale${todaySales.length === 1 ? "" : "s"} recorded · includes unpaid</small>
          </article>
          <article class="home-data-card">
            <span class="home-data-label">Orders</span>
            <strong class="home-data-value">${todaySales.length}</strong>
            <small class="home-data-note">Today across POS and web</small>
          </article>
          <article class="home-data-card">
            <span class="home-data-label">Average order</span>
            <strong class="home-data-value">${AppUtils.escapeHTML(money(todaySales.length ? todayTotal / todaySales.length : 0))}</strong>
            <small class="home-data-note">Today</small>
          </article>
        </div>
        <div class="home-panel-grid">
          <section class="home-panel home-panel-compact" aria-label="Yesterday’s sales">
            <div class="home-panel-heading">
              <div><span class="home-panel-kicker">Yesterday</span><h2>${yesterdaySales.length} sale${yesterdaySales.length === 1 ? "" : "s"}</h2></div>
            </div>
          </section>
          <section class="home-panel home-panel-compact" aria-label="Needs attention">
            <div class="home-panel-heading"><div><span class="home-panel-kicker">Needs attention</span><h2>Store checks</h2></div></div>
            <div class="home-attention-row"><span><strong>Low stock</strong><small>5 units or fewer</small></span><span class="home-attention-count">${lowStockCount}</span></div>
            <div class="home-attention-row"><span><strong>Payment follow-up</strong><small>Unpaid or part-paid sales</small></span><span class="home-attention-count">${pendingPaymentCount}</span></div>
          </section>
        </div>
        <section class="home-panel" aria-label="Recent orders">
          <div class="home-panel-heading">
            <div><span class="home-panel-kicker">Activity</span><h2>Recent orders</h2></div>
            <a class="home-panel-link" href="/store/orders" data-route="/store/orders">View all</a>
          </div>
          ${recentRows}
        </section>
      `;
      dashboard.setAttribute("aria-busy", "false");
    } catch (error) {
      console.error("Could not load the Craft home dashboard.", error);
      if (dashboard.isConnected) {
        dashboard.innerHTML = `<p class="home-dashboard-error" role="alert">Store overview could not be loaded: ${AppUtils.escapeHTML(error instanceof Error ? error.message : String(error))}</p>`;
        dashboard.setAttribute("aria-busy", "false");
      }
    }
  },

  async init() {
    // Initialize SQLite Engine
    if (window.ShopPOSReady) await window.ShopPOSReady;
    else if (window.ShopSQLiteReady) await window.ShopSQLiteReady;
    await SQLiteEngine.init(categories, products, storeInfo, plans, demoAnalytics);
    this.cacheActiveTenantCatalog();
    this.installBuilderSqliteBridge();
    await SQLiteEngine.resetBuildYourWebDataOnce();

    // Apply saved store theme settings
    this.applyThemeSettings();

    // Attach global click & route interception
    this.bindEvents();
    window.addEventListener("online", () => {
      void this.syncPendingStorefrontOrders().catch(error => {
        console.error("Queued storefront orders could not be synced.", error);
      });
    });
    void this.syncPendingStorefrontOrders().catch(error => {
      console.error("Queued storefront orders could not be synced.", error);
    });

    // Handle initial route
    this.handleRoute(this.currentRoute());
    window.dispatchEvent(new Event("craft:app-ready"));
    this.startOwnerAlertPolling();

    // Browser back / forward buttons
    window.addEventListener("hashchange", () => {
      this.handleRoute(this.currentRoute(), true);
    });
  },

  // Shows each Worker outbox alert (new order, booking, hold, paid-but-short-stock) once.
  startOwnerAlertPolling() {
    const owner = window.BusinessNotifications?.owner;
    if (!owner || this.ownerAlertTimer) return;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      const tenantId = this.getActiveTenant().id;
      const result = await owner.poll(tenantId);
      if (!result || this.getActiveTenant().id !== tenantId) return;
      result.fresh.slice(0, 3).forEach(alert =>
        AppUtils.showToast(alert.title, alert.kind === "attention" || alert.kind === "booking_refund" ? "danger" : "success"));
      if (result.fresh.length > 3) {
        AppUtils.showToast(`${result.fresh.length - 3} more new shop alerts.`);
      }
    };
    this.ownerAlertTimer = window.setInterval(() => void check(), owner.pollIntervalMs);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void check();
    });
    window.setTimeout(() => void check(), 5000);
  },

  async syncPendingStorefrontOrders() {
    if (navigator.onLine === false || !window.EshopInventoryBridge?.createStorefrontOrder) return;
    const prefix = "ESHOP_PENDING_STOREFRONT_ORDERS_V1:";
    const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter(key => key?.startsWith(prefix));
    for (const key of keys) {
      let pending;
      try {
        pending = JSON.parse(window.localStorage.getItem(key) || "[]");
      } catch (error) {
        console.error("A queued storefront order could not be read.", error);
        continue;
      }
      if (!Array.isArray(pending)) continue;
      const tenantId = decodeURIComponent(key.slice(prefix.length));
      const remaining = [];
      for (const item of pending) {
        try {
          const response = await window.EshopInventoryBridge.createStorefrontOrder(tenantId, item.payload);
          const order = response.order;
          this.update("orders", saved => saved.order_number === item.local_order_number, saved => ({
            ...saved, ...order, id: saved.id, order_number: order.order_number
          }));
          await window.ShopSQLite.flush();
        } catch (error) {
          remaining.push(item);
          console.warn("A queued storefront order is still waiting to sync.", error);
        }
      }
      if (remaining.length) window.localStorage.setItem(key, JSON.stringify(remaining));
      else window.localStorage.removeItem(key);
    }
  },

  applyThemeSettings(appearance = this.getStudioAppearance()) {
    const themeTarget = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(appearance.primary_color || "")) {
      const channels = appearance.primary_color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
      const toHex = values => `#${values.map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
      const mixHex = (channelsToMix, target, amount) => toHex(channelsToMix.map((channel, index) =>
        channel + (parseInt(target.slice(1).slice(index * 2, index * 2 + 2), 16) - channel) * amount));
      const luminance = channels
        .map(channel => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const isWhiteAccent = appearance.primary_color.toUpperCase() === "#FFFFFF";
      const isDarkAccent = luminance <= 0.179;
      const foreground = "#18181B";
      const accentForeground = isWhiteAccent || !isDarkAccent ? "#18181B" : "#FFFFFF";
      const surfaceTarget = isDarkAccent && !isWhiteAccent ? "#000000" : "#FFFFFF";
      const blend = amount => mixHex(channels, surfaceTarget, amount);
      themeTarget.style.setProperty("--accent", appearance.primary_color);
      themeTarget.style.setProperty("--accent-hover", isWhiteAccent ? "#F4F4F5" : toHex(channels.map(channel => channel * 0.82)));
      themeTarget.style.setProperty("--accent-light", isWhiteAccent ? "#F4F4F5" : blend(isDarkAccent ? 0.7 : 0.82));
      themeTarget.style.setProperty("--accent-contrast", accentForeground);
      themeTarget.style.setProperty("--bg", "#FFFFFF");
      themeTarget.style.setProperty("--surface", "#FFFFFF");
      themeTarget.style.setProperty("--surface-subtle", "#F5F5F5");
      themeTarget.style.setProperty("--surface-hover", "#EBEBEB");
      themeTarget.style.setProperty("--border", "#E2E2E5");
      themeTarget.style.setProperty("--border-subtle", "#F0F0F1");
      themeTarget.style.setProperty("--text-main", foreground);
      themeTarget.style.setProperty("--text-muted", "#66666B");
      themeTarget.style.setProperty("--text-dim", "#8A8A90");
      themeTarget.style.setProperty("--badge-bg", "#F0F0F1");
      themeTarget.style.setProperty("--badge-text", foreground);
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.setAttribute("content", appearance.primary_color);
    }
    const radii = {
      "0px": ["0px", "0px", "0px"],
      "4px": ["4px", "2px", "6px"],
      "10px": ["10px", "5px", "14px"]
    };
    const [radius, smallRadius, largeRadius] = radii[appearance.card_radius] || radii["4px"];
    themeTarget.style.setProperty("--radius", radius);
    themeTarget.style.setProperty("--radius-sm", smallRadius);
    themeTarget.style.setProperty("--radius-lg", largeRadius);
  },

  setAppShellTheme(path, params = new URLSearchParams()) {
    const isAppShell = path === "/" || path === "" || path === "/account" ||
      path.startsWith("/account/") || path === "/app-account" || path === "/pos" ||
      path.startsWith("/pos/") || path === "/store" || path.startsWith("/store/");
    const isAppScreen = isAppShell || path === "/categories" ||
      path === "/store" || path.startsWith("/store/");
    const isNewLitrusEditor = path === "/account/web/site" &&
      params.get("new") === "1" && params.get("edit") === "1" &&
      params.get("theme") === "litrus-mixer";
    const isExistingLitrusEditor = path === "/account/web/site" &&
      params.get("new") !== "1" &&
      SQLiteEngine.getStore().website_theme_id === "litrus-mixer";
    const isCraftAppUi = isAppShell && path !== "/account/web/site";
    const showScreenFade = isAppScreen && path !== "/" &&
      !isNewLitrusEditor && !isExistingLitrusEditor;
    document.body.classList.toggle("app-shell", isAppShell);
    document.body.classList.toggle("craft-app-ui", isCraftAppUi);
    document.body.classList.toggle("app-screen-fade-active", showScreenFade);
    if (isAppShell) {
      this.applyThemeSettings();
      return;
    }

    ["--accent", "--accent-hover", "--accent-light", "--accent-contrast", "--bg",
      "--surface", "--surface-subtle", "--surface-hover", "--border", "--border-subtle",
      "--text-main", "--text-muted", "--text-dim", "--badge-bg", "--badge-text",
      "--radius", "--radius-sm", "--radius-lg"]
      .forEach(property => document.documentElement.style.removeProperty(property));
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", "#18181B");
  },

  currentRoute() {
    const h = (window.location.hash || "").replace(/^#/, "");
    return h ? (h.charAt(0) === "/" ? h : "/" + h) : "/";
  },

  navigate(path, openWorkspaceHome = false) {
    /* Hash routing: works from file://, any sub-path, or a hosted page */
    if (this.currentRoute() === path) { this.handleRoute(path); window.scrollTo(0, 0); return; }
    window.location.hash = "#" + path;   /* hashchange -> handleRoute */
    window.scrollTo(0, 0);
  },

  handleRoute(fullPath, shouldScroll = true, draftPrepared = false) {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer);
      this.carouselTimer = null;
    }

    const appRoot = document.getElementById("app");
    if (!appRoot) return;

    const [path, queryString] = fullPath.split("?");
    document.body.classList.toggle("app-interior-theme", path !== "/");
    const params = new URLSearchParams(queryString || "");
    if (path === "/mpesa" || path.startsWith("/mpesa/")) {
      this.navigate("/", true);
      return;
    }
    if ((path === "/account/web/site" && params.get("new") !== "1" || path === "/account/web/store") && params.has("tenant")) {
      const tenantId = params.get("tenant");
      const catalog = this.tenantCatalogs().find(item => item.tenant_id === tenantId);
      if (!catalog) {
        AppUtils.showToast("This website is not saved on this device. Select it again from Profile → Webs.", "danger");
        this.navigate("/account/profile/webs");
        return;
      }
      if (this.getActiveTenant().id !== tenantId) {
        this.setActiveTenantCatalog({
          id: tenantId,
          name: catalog.name || catalog.store?.name || tenantId,
          hostname: catalog.hostname || (tenantId === "main" ? "rrobin.co.ke" : `${tenantId}.rrobin.co.ke`),
          owner_token: catalog.owner_token || ""
        }, catalog);
      }
    }
    if (path === "/account/web/site" && params.get("new") === "1") {
      if (!draftPrepared) {
        appRoot.innerHTML = `<main class="container" style="padding:48px 16px;text-align:center;">Preparing your new website preview...</main>`;
        this.prepareWebsiteBuilderDraftTenant(
          StudioRenderers.websiteBuilderDraft(),
          params.get("theme") || StudioRenderers.websiteBuilderDraft().selected_theme
        ).then(() => {
          if (this.currentRoute() === fullPath) this.handleRoute(fullPath, shouldScroll, true);
        }).catch(error => {
          console.error("The new website draft could not be opened.", error);
          AppUtils.showToast(error.message || "The new website draft could not be opened.", "danger");
          this.navigate("/account/web/studio/websites/list");
        });
        return;
      }
    } else if (this.getActiveTenant().id === WEBSITE_BUILDER_DRAFT_TENANT_ID) {
      this.restoreWebsiteBuilderPreviousTenant();
    }
    this.setAppShellTheme(path, params);
    const previousPath = this.lastRenderedPath;

    let html = "";

    // Route matching
    if (path === "/" || path === "") {
      html = this.renderLaunchpad();
    } else if (path === "/pos" || path.startsWith("/pos/")) {
      html = window.ShopPOS.render(path, params);
    } else if (path === "/categories") {
      html = StoreRenderers.renderCategoriesList();
    } else if (path.startsWith("/pages/")) {
      const slug = decodeURIComponent(path.slice("/pages/".length).replace(/\/$/, ""));
      html = StoreRenderers.renderCustomPage(slug) || `
        ${StoreRenderers.renderNavbar()}
        <main class="container" style="padding:80px 16px; text-align:center;">
          <h1 class="section-heading">Page not found</h1>
          <p style="color:var(--text-muted);">This page may have been removed or is not published.</p>
          <a href="/" class="btn-primary" data-route="/" style="display:inline-flex; margin-top:20px;">Return home</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    } else if (path.startsWith("/category/")) {
      const slug = path.replace("/category/", "").replace(/\/$/, "");
      html = StoreRenderers.renderCategory(
        slug,
        params.get("sort") || "featured",
        params.get("minPrice"),
        params.get("maxPrice"),
        params.get("inStock"),
        params.get("studio") === "1"
      );
    } else if (path.startsWith("/product/")) {
      const slug = path.replace("/product/", "").replace(/\/$/, "");
      html = StoreRenderers.renderProduct(slug);
    } else if (path === "/search") {
      html = StoreRenderers.renderSearch(params.get("q") || "", params.get("sort") || "featured");
    } else if (path === "/bag") {
      html = StoreRenderers.renderBag();
    } else if (path === "/checkout") {
      html = StoreRenderers.renderCheckout();
    } else if (path === "/checkout/confirmation") {
      html = StoreRenderers.renderOrderConfirmation(params.get("orderId"), params.get("reference"));
    } else if (path === "/favorites") {
      html = StoreRenderers.renderFavorites();
    } else if (path === "/app-account") {
      html = StudioRenderers.renderAppAccount();
    } else if (path === "/account" || path === "/account/main-shop" || path.startsWith("/account/main-shop/") || path === "/account/dashboard" || path.startsWith("/account/customers") || path === "/account/payments") {
      html = StudioRenderers.renderMainShopWorkspace(path);
    } else if (path === "/account/web" || path.startsWith("/account/web/studio/")) {
      html = StudioRenderers.renderMainShopWorkspace(path);
    } else if (["/store/products", "/store/products/manage", "/store/manage/products", "/store/manage/categories", "/store/categories", "/store/inventory", "/store/split-shop", "/store/revenue", "/store/channels", "/store/sales", "/store/orders", "/store/bookings", "/store/payments"].includes(path)) {
      html = StudioRenderers.renderMainShopWorkspace(path);
    } else if (path === "/account/profile" || path.startsWith("/account/profile/")) {
      html = StudioRenderers.renderProfileScreen(path);
    } else if (path.startsWith("/account/web/themes/")) {
      html = StudioRenderers.renderWebsiteTheme(decodeURIComponent(path.slice("/account/web/themes/".length)));
      if (!html) {
        html = `
          ${StoreRenderers.renderNavbar("/account")}
          <main class="container" style="padding:40px 0;">
            <a href="/account/web/studio/websites/list" class="studio-back-link" data-route="/account/web/studio/websites/list" aria-label="Back to websites">&larr;</a>
            <h1 class="section-heading" style="margin-top:12px;">Theme not found</h1>
          </main>
          ${StoreRenderers.renderFooter()}
        `;
      }
    } else if (path === "/account/web/site") {
      html = StudioRenderers.renderWebsiteEditor(params.get("new") === "1");
    } else if (path === "/account/web/store") {
      html = StudioRenderers.renderWebsiteStoreEditor();
    } else if (path === "/account/products") {
      html = StudioRenderers.renderProductsManager();
    } else if (path === "/account/dashboard") {
      html = StudioRenderers.renderMainShopWorkspace(path);
    } else if (path === "/account/categories") {
      html = StudioRenderers.renderCategoriesManager();
    } else if (path === "/account/tenants") {
      html = StudioRenderers.renderTenantsManager();
    } else if (path === "/account/inventory") {
      html = StudioRenderers.renderInventory();
    } else if (path === "/account/settings") {
      html = StudioRenderers.renderSettings();
    } else if (path === "/account/web" || path.startsWith("/account/web/studio/")) {
      html = StudioRenderers.renderMainShopWorkspace(path);
    } else if (path === "/account/plans") {
      html = StudioRenderers.renderPlans();
    } else if (["/privacy", "/terms", "/cookies", "/about", "/contact", "/help", "/faq", "/shipping", "/returns"].includes(path)) {
      html = StudioRenderers.renderStaticPage(path.replace("/", ""));
    } else {
      // 404 handler
      html = `
        ${StoreRenderers.renderNavbar()}
        <main class="container" style="padding: 100px 0; text-align: center;">
          <h1 style="font-family: var(--font-serif); font-size: 3rem; margin-bottom: 12px;">404 &bull; Page Not Found</h1>
          <p style="color: var(--text-muted); margin-bottom: 32px;">The screen you are seeking is unavailable or has been relocated.</p>
          <a href="/" class="btn-primary" data-route="/" style="max-width: 200px; margin: 0 auto;">Return to Home</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    appRoot.innerHTML = html;
    const searchConsoleSettingsMatch = path.match(/^\/account\/profile\/webs\/([^/]+)$/);
    if (searchConsoleSettingsMatch) {
      try {
        const searchConsoleTenantId = decodeURIComponent(searchConsoleSettingsMatch[1]);
        if (searchConsoleTenantId !== "main") void StoreRenderers.loadGoogleSearchStatus(searchConsoleTenantId);
      } catch (error) {
        console.error("Search Console settings route is invalid.", error);
      }
    }
    const websiteDomainSettingsMatch = path.match(/^\/account\/profile\/webs\/([^/]+)\/domains$/);
    if (websiteDomainSettingsMatch) {
      try {
        const domainTenantId = decodeURIComponent(websiteDomainSettingsMatch[1]);
        if (domainTenantId !== "main") void StoreRenderers.loadCustomHostnameStatus(domainTenantId);
      } catch (error) {
        console.error("Website domains route is invalid.", error);
      }
    }
    if (previousPath !== fullPath) this.recordWebVisit(path);
    this.lastRenderedPath = fullPath;
    if (shouldScroll) window.scrollTo(0, 0);

    // Post-render lifecycle setups
    this.postRenderSetup(path, params);
    try {
      const activeTenant = this.getActiveTenant();
      const connection = this.cloudflareConnection(activeTenant.id);
      window.CraftAI?.mount({
        path,
        tenantId: activeTenant.id,
        tenantName: activeTenant.name,
        token: connection.token,
        origin: connection.origin,
        // Lets the AI helper see what a service shop sells instead of treating it as an empty stock room.
        offerType: window.EshopServiceModel.offerTypeForCatalogue(SQLiteEngine.select("products", product => product.status !== "archived"), SQLiteEngine.getStore().offer_type),
        // A service is whichever item carries a duration, whatever the shop is set to. Asking the
        // shop setting hid every service in a shop that also sells goods.
        listServices: () => SQLiteEngine
          .select("products", product => product.status !== "archived" && product.active !== false && product.active !== 0)
          .filter(product => window.EshopServiceModel.isService(product))
          .map(product => ({
            name: product.name,
            price: product.price ?? product.selling_price ?? 0,
            duration_minutes: product.duration_minutes
          }))
      });
    } catch (error) {
      console.warn("Craft AI could not be initialized for this screen.", error);
      window.CraftAI?.mount({ path, tenantId: this.getActiveTenant().id });
    }
  },

  bindWebsiteBuilderEvents() {
    const editorRouteParams = new URLSearchParams(this.currentRoute().split("?")[1] || "");
    const draftEditor = editorRouteParams.get("new") === "1" && editorRouteParams.get("edit") === "1";
    const sharedCatalogRefresh = document.getElementById("website-wizard-refresh-catalog");
    const sharedCatalogStatus = document.getElementById("website-wizard-catalog-status");
    const sharedCategoryList = document.getElementById("website-wizard-category-list");
    const sharedProductList = document.getElementById("website-wizard-product-list");
    const sharedProductSearch = document.getElementById("website-wizard-product-search");
    const sharedProductCount = document.getElementById("website-wizard-product-count");
    if (sharedCatalogRefresh && sharedCatalogStatus && sharedCategoryList && sharedProductList &&
        sharedProductSearch && sharedProductCount) {
      let products = SQLiteEngine.select("products").filter(product => product.status !== "archived");
      let categories = SQLiteEngine.getCategories();
      const renderSharedCatalog = () => {
        const categoryById = new Map(categories.map(category => [String(category.id), category.name]));
        sharedCategoryList.innerHTML = categories.map(category =>
          `<div class="website-wizard-category-row"><span>${AppUtils.escapeHTML(category.name)}</span></div>`
        ).join("") || `<p class="studio-panel-note">No Store categories yet. Add them in Store or POS.</p>`;
        const query = sharedProductSearch.value.trim().toLocaleLowerCase();
        const matches = products.filter(product =>
          `${product.name || ""} ${product.sku || ""} ${product.category_name || ""}`.toLocaleLowerCase().includes(query));
        const visible = matches.slice(0, 50);
        sharedProductCount.textContent = query
          ? `Showing ${visible.length} of ${matches.length} matches · ${products.length} total`
          : `Showing ${visible.length} of ${products.length} products`;
        sharedProductList.innerHTML = visible.map(product => {
          const image = Array.isArray(product.images)
            ? product.images.find(value => typeof value === "string" && /^(data:image\/|https?:\/\/|\/)/i.test(value))
            : "";
          const category = product.category_name || categoryById.get(String(product.category_id ?? product.categoryId)) || "Uncategorized";
          return `<article class="website-wizard-product-row">
            ${image ? `<img class="website-wizard-product-thumb" src="${AppUtils.escapeHTML(image)}" alt="">` : `<span class="website-wizard-product-thumb" aria-hidden="true"></span>`}
            <span class="website-wizard-product-copy"><strong>${AppUtils.escapeHTML(product.name || "Unnamed product")}</strong><span>${AppUtils.escapeHTML(category)}</span></span>
            <span>${AppUtils.escapeHTML(String(product.stock ?? 0))} in stock</span>
            <strong>${AppUtils.formatMoney(product.price ?? 0)}</strong>
          </article>`;
        }).join("") || `<p class="studio-panel-note">${query ? "No Store products match your search." : "No Store products yet. Add products in Store or POS to show them here."}</p>`;
      };
      sharedProductSearch.oninput = renderSharedCatalog;
      const refreshSharedCatalog = async () => {
        sharedCatalogRefresh.disabled = true;
        sharedCatalogStatus.textContent = "Refreshing the Main Store/POS catalog…";
        try {
          const catalog = await this.websiteBuilderSourceCatalog();
          products = catalog.products;
          categories = catalog.categories;
          const draft = StudioRenderers.websiteBuilderDraft();
          draft.products = products;
          draft.categories = categories;
          StudioRenderers.saveWebsiteBuilderDraft(draft);
          window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
          renderSharedCatalog();
          sharedCatalogStatus.textContent = `Showing ${products.length} products and ${categories.length} categories${catalog.posConnected ? ` from Main Store/POS${catalog.posProductCount ? `, including ${catalog.posProductCount} POS-only products` : ""}` : " from Main Store; POS is unavailable on this device"}. Edit the catalog in Store or POS.`;
        } catch (error) {
          console.error("The shared Store/POS catalog could not be loaded in Webmaker.", error);
          sharedCatalogStatus.textContent = error instanceof Error ? error.message : "The shared catalog could not be loaded.";
          AppUtils.showToast(sharedCatalogStatus.textContent, "danger");
        } finally {
          sharedCatalogRefresh.disabled = false;
        }
      };
      sharedCatalogRefresh.onclick = () => { void refreshSharedCatalog(); };
      renderSharedCatalog();
      void refreshSharedCatalog();
    }

    const identityForm = document.getElementById("website-wizard-identity-form");
    if (identityForm) {
      const nameInput = identityForm.elements.name;
      const addressInput = identityForm.elements.address;
      const slugify = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "").slice(0, 40).replace(/-$/g, "");
      let addressEdited = Boolean(addressInput.value);
      addressInput.addEventListener("input", () => { addressEdited = true; });
      nameInput.addEventListener("input", () => {
        if (!addressEdited) addressInput.value = slugify(nameInput.value);
      });
      identityForm.onsubmit = event => {
        event.preventDefault();
        const error = document.getElementById("website-wizard-identity-error");
        const name = nameInput.value.trim();
        const address = slugify(addressInput.value);
        if (!name || !address) {
          if (error) {
            error.textContent = "Enter a shop name and a website address.";
            error.hidden = false;
          }
          return;
        }
        const draft = StudioRenderers.websiteBuilderDraft();
        draft.shop_name = name;
        draft.shop_kind = identityForm.elements.kind.value.trim();
        draft.shop_address = address;
        draft.wizard_step = "catalogue";
        StudioRenderers.saveWebsiteBuilderDraft(draft);
        this.handleRoute(this.currentRoute());
      };
    }
    const editIdentity = document.getElementById("website-wizard-edit-identity");
    if (editIdentity) editIdentity.onclick = () => {
      const draft = StudioRenderers.websiteBuilderDraft();
      draft.wizard_step = "identity";
      StudioRenderers.saveWebsiteBuilderDraft(draft);
      this.handleRoute(this.currentRoute());
    };
    const categoryForm = document.getElementById("website-wizard-category-form");
    if (categoryForm) categoryForm.onsubmit = event => {
      event.preventDefault();
      const formData = new FormData(categoryForm);
      const name = String(formData.get("name") || "").trim();
      if (!name) return;
      const draft = StudioRenderers.websiteBuilderDraft();
      const categoryId = String(formData.get("id") || "");
      if (draft.categories.some(category => String(category.id) !== categoryId &&
          category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        AppUtils.showToast("That category is already in your new website draft.", "danger");
        return;
      }
      if (categoryId) {
        const category = draft.categories.find(item => String(item.id) === categoryId);
        if (!category) {
          AppUtils.showToast("That category is no longer in this website draft.", "danger");
          return;
        }
        category.name = name;
        draft.products.forEach(product => {
          if (String(product.category_id) === categoryId) product.category_name = name;
        });
      } else {
        draft.categories.push({ id: Date.now() + draft.categories.length, name });
      }
      StudioRenderers.saveWebsiteBuilderDraft(draft);
      this.handleRoute(this.currentRoute());
    };
    const categoryList = document.getElementById("website-wizard-category-list");
    if (categoryList) categoryList.onclick = event => {
      const removeButton = event.target.closest("[data-remove-wizard-category]");
      if (removeButton) {
        const draft = StudioRenderers.websiteBuilderDraft();
        const removeId = removeButton.dataset.removeWizardCategory;
        const inUse = draft.products.filter(product => String(product.category_id) === removeId).length;
        if (inUse) {
          AppUtils.showToast(`${inUse} product${inUse === 1 ? " is" : "s are"} in this category. Move or remove ${inUse === 1 ? "it" : "them"} first.`, "danger");
          return;
        }
        draft.categories = draft.categories.filter(category => String(category.id) !== removeId);
        window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
        StudioRenderers.saveWebsiteBuilderDraft(draft);
        this.handleRoute(this.currentRoute());
        return;
      }
      const button = event.target.closest("[data-edit-wizard-category]");
      if (!button || !categoryForm) return;
      const category = StudioRenderers.websiteBuilderDraft().categories.find(item =>
        String(item.id) === button.dataset.editWizardCategory);
      if (!category) return;
      categoryForm.elements.id.value = String(category.id);
      categoryForm.elements.name.value = category.name;
      categoryForm.querySelector('button[type="submit"]').textContent = "Save category";
      categoryForm.elements.name.focus();
    };

    const productList = document.getElementById("website-wizard-product-list");
    const productSearch = document.getElementById("website-wizard-product-search");
    const productCount = document.getElementById("website-wizard-product-count");
    const productForm = document.getElementById("website-wizard-product-form");
    const cancelProductEdit = document.getElementById("website-wizard-cancel-product-edit");
    const createProductButton = document.getElementById("website-wizard-create-product");
    if (createProductButton && productForm) createProductButton.onclick = () => {
      productForm.hidden = !productForm.hidden;
      if (!productForm.hidden) productForm.querySelector('[name="name"]')?.focus();
    };
    if (productList && productSearch && productCount && productForm) {
      let editingProduct = null;
      const media = {
        mode: "image",
        imageFiles: [],
        videoBlob: null,
        videoPath: "",
        spinFrames: [],
        cutoutImages: []
      };
      const mediaStatus = productForm.querySelector("[data-wizard-media-status]");
      const mediaPreview = productForm.querySelector("[data-wizard-media-preview]");
      const imageInput = productForm.querySelector("[data-wizard-product-images]");
      const videoInput = productForm.querySelector("[data-wizard-video-file]");
      const nativeMedia = window.EshopNativeMedia;
      const isAndroidApp = nativeMedia?.Capacitor?.getPlatform?.() === "android";
      let previewUrls = [];

      const setMediaStatus = message => {
        if (mediaStatus) mediaStatus.textContent = message;
      };
      const clearMediaPreview = () => {
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        previewUrls = [];
        mediaPreview?.replaceChildren();
        if (mediaPreview) mediaPreview.hidden = true;
      };
      const showMediaPreview = (files, video = false) => {
        clearMediaPreview();
        if (!mediaPreview || !files.length) return;
        files.slice(0, video ? 1 : 8).forEach(file => {
          const url = URL.createObjectURL(file);
          previewUrls.push(url);
          if (video) {
            const element = document.createElement("video");
            element.src = url;
            element.controls = true;
            element.playsInline = true;
            mediaPreview.append(element);
          } else {
            const element = document.createElement("img");
            element.src = url;
            element.alt = "Selected product photo";
            mediaPreview.append(element);
          }
        });
        mediaPreview.hidden = false;
      };
      const setMediaMode = (mode, reset = false) => {
        if (reset) {
          media.imageFiles = [];
          media.videoBlob = null;
          media.videoPath = "";
          media.spinFrames = [];
          media.cutoutImages = [];
          if (imageInput) imageInput.value = "";
          if (videoInput) videoInput.value = "";
          clearMediaPreview();
        }
        media.mode = mode;
        productForm.querySelectorAll("[data-wizard-media-mode]").forEach(button => {
          button.setAttribute("aria-pressed", String(button.dataset.wizardMediaMode === mode));
        });
        const photoLabel = productForm.querySelector("[data-wizard-photo-label]");
        const videoOptions = productForm.querySelector("[data-wizard-video-options]");
        if (photoLabel) photoLabel.hidden = mode !== "image";
        if (videoOptions) videoOptions.hidden = mode !== "video" && mode !== "spin";
        setMediaStatus(mode === "spin"
          ? isAndroidApp ? "Choose or record a product video. Craft will generate 24 rotatable frames on this Android device." : "360° processing requires the Android Craft app and Google Play services."
          : mode === "cutout"
            ? isAndroidApp ? "Choose product photos for on-device background removal." : "Cutout requires the Android Craft app and Google Play services."
            : mode === "video"
              ? "Choose or record a product video. MP4, WebM, and QuickTime are supported."
              : "Add up to 8 photos. Images are compressed before saving.");
      };
      const bindProductFields = product => {
        const taxonomyHost = productForm.querySelector("[data-wizard-product-taxonomy]");
        const variantsHost = productForm.querySelector("[data-wizard-product-variants]");
        if (!taxonomyHost || !variantsHost) throw new Error("The new-website product form is missing product details.");
        taxonomyHost.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
          categoryId: product?.taxonomy_category_id || product?.taxonomyCategoryId || "",
          categoryName: product?.taxonomy_category_name || product?.taxonomyCategoryName || "",
          customCategory: product?.taxonomy_custom_category || product?.taxonomyCustomCategory || "",
          attributes: product?.taxonomy_attributes || product?.taxonomyAttributes || []
        });
        window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyHost);
        variantsHost.innerHTML = window.EshopProductVariants.createProductVariantFields({
          // Without the saved options list, a third option and every per-value price reset to 0
          // the moment a product was reopened for editing.
          options: Array.isArray(product?.options) ? product.options : [],
          option1Name: product?.option1_name || "",
          option2Name: product?.option2_name || "",
          sizes: product?.sizes || [],
          colors: product?.colors || [],
          variants: product?.variants || []
        });
        window.EshopProductVariants.bindProductVariantFields(variantsHost.firstElementChild || variantsHost);
        // The new-store wizard is where most products are made, and it had no way to charge by
        // attribute; only the Craft store form and the till did.
        const pricingHost = productForm.querySelector("[data-wizard-product-attribute-pricing]");
        if (pricingHost) {
          pricingHost.innerHTML = window.EshopAttributePricing.createAttributePricingFields({
            pricedAttributes: product?.priced_attributes || []
          });
          window.EshopAttributePricing.bindAttributePricingFields(
            pricingHost.firstElementChild || pricingHost,
            () => window.EshopProductTaxonomy.readAvailableTaxonomyAttributes(productForm)
          );
        }
      };
      // Picking a category changes which attributes exist, so the pricing editor follows at once.
      productForm.addEventListener("product-taxonomy-change", () => {
        productForm.querySelector("[data-wizard-product-attribute-pricing] [data-attribute-pricing]")
          ?.refreshAttributePricing?.();
      });
      const renderDraftProducts = () => {
        const allProducts = StudioRenderers.websiteBuilderDraft().products;
        const query = productSearch.value.trim().toLocaleLowerCase();
        const matches = allProducts.filter(product =>
          `${product.name || ""} ${product.sku || ""} ${product.category_name || ""}`.toLocaleLowerCase().includes(query));
        const visible = matches.slice(0, 50);
        productCount.textContent = query
          ? `Showing ${visible.length} of ${matches.length} matches · ${allProducts.length} total`
          : `Showing ${visible.length} of ${allProducts.length} products`;
        productList.innerHTML = visible.map(product => {
          const image = Array.isArray(product.images)
            ? product.images.find(value => typeof value === "string" && /^(data:image\/|https?:\/\/|\/)/i.test(value))
            : "";
          return `<article class="website-wizard-product-row">
            ${image ? `<img class="website-wizard-product-thumb" src="${AppUtils.escapeHTML(image)}" alt="">` : `<span class="website-wizard-product-thumb" aria-hidden="true"></span>`}
            <span class="website-wizard-product-copy"><strong>${AppUtils.escapeHTML(product.name || "Unnamed product")}</strong><span>${AppUtils.escapeHTML(product.category_name || "Uncategorized")}</span></span>
            <strong>Sell ${AppUtils.escapeHTML(String(product.price ?? 0))}</strong>
            <span class="website-wizard-product-actions"><button class="btn-secondary website-wizard-compact-action" type="button" data-edit-wizard-product="${AppUtils.escapeHTML(String(product.id))}">Edit</button><button class="btn-secondary website-wizard-compact-action" type="button" data-remove-wizard-product="${AppUtils.escapeHTML(String(product.id))}" aria-label="Remove ${AppUtils.escapeHTML(product.name || "product")} from this website">Remove</button></span>
          </article>`;
        }).join("") || `<p class="studio-panel-note">${query ? "No products match your search." : "No products yet. Add from Store or create one below."}</p>`;
      };
      const selectNativeVideo = async record => {
        if (!isAndroidApp || !nativeMedia?.Camera) return null;
        const selected = record
          ? await nativeMedia.Camera.recordVideo({ isPersistent: true, includeMetadata: true })
          : (await nativeMedia.Camera.chooseFromGallery({
            mediaType: nativeMedia.MediaTypeSelection.Video,
            includeMetadata: true
          })).results?.[0];
        return selected || null;
      };
      const loadSelectedVideo = async (record = false) => {
        if (!isAndroidApp) {
          videoInput?.click();
          return;
        }
        try {
          setMediaStatus(record ? "Opening video camera…" : "Opening video gallery…");
          const selected = await selectNativeVideo(record);
          if (!selected?.uri) {
            setMediaStatus("No video was selected.");
            return;
          }
          const url = selected.webPath || nativeMedia.Capacitor.convertFileSrc(selected.uri);
          const response = await fetch(url);
          if (!response.ok) throw new Error("The selected video could not be opened.");
          media.videoBlob = await response.blob();
          media.videoPath = await AppUtils.storeLocalProductVideo(media.videoBlob);
          showMediaPreview([media.videoBlob], true);
          setMediaStatus("Video selected and saved locally.");
        } catch (error) {
          console.error("New-website product video could not be selected.", error);
          setMediaStatus(error instanceof Error ? error.message : "The product video could not be selected.");
        }
      };
      const processSpinVideo = async record => {
        if (!isAndroidApp || !nativeMedia?.ProductCutout || !nativeMedia?.Camera) {
          setMediaStatus("360° processing requires the Android Craft app and Google Play services.");
          return;
        }
        try {
          setMediaStatus(record ? "Opening video camera…" : "Opening video gallery…");
          const selected = await selectNativeVideo(record);
          if (!selected?.uri) {
            setMediaStatus("No video was selected.");
            return;
          }
          setMediaStatus("Generating 24 product spin frames…");
          const result = await nativeMedia.ProductCutout.processVideo({
            path: selected.uri,
            count: 24,
            width: 720
          });
          media.spinFrames = (result.frames || []).map(path =>
            String(path).startsWith(LOCAL_PRODUCT_MEDIA_PREFIX) ? String(path) : `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
          if (!media.spinFrames.length) throw new Error("No 360° frames were generated. Try a clearer product video.");
          clearMediaPreview();
          const image = document.createElement("img");
          image.src = nativeMedia.Capacitor.convertFileSrc(result.frames[0]);
          image.alt = "Generated 360-degree product preview";
          mediaPreview?.append(image);
          if (mediaPreview) mediaPreview.hidden = false;
          setMediaStatus(`${media.spinFrames.length} rotatable product frames are ready.`);
        } catch (error) {
          console.error("New-website 360 product media could not be processed.", error);
          setMediaStatus(error instanceof Error ? error.message : "360° product media could not be processed.");
        }
      };
      const processCutoutPhotos = async () => {
        if (!isAndroidApp || !nativeMedia?.ProductCutout || !nativeMedia?.Camera) {
          setMediaStatus("Cutout requires the Android Craft app and Google Play services.");
          return;
        }
        try {
          setMediaStatus("Choose up to 8 product photos…");
          const result = await nativeMedia.Camera.chooseFromGallery({
            mediaType: nativeMedia.MediaTypeSelection.Photo,
            allowMultipleSelection: true,
            limit: 8,
            quality: 100
          });
          const paths = (result.results || []).map(item => item.uri).filter(Boolean).slice(0, 8);
          if (!paths.length) {
            setMediaStatus("No product photos were selected.");
            return;
          }
          setMediaStatus("Removing photo backgrounds…");
          const processed = await nativeMedia.ProductCutout.cutoutImages({ paths, width: 1200 });
          media.cutoutImages = (processed.images || []).map(path =>
            String(path).startsWith(LOCAL_PRODUCT_MEDIA_PREFIX) ? String(path) : `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
          if (!media.cutoutImages.length) throw new Error("No cutout photos were created.");
          clearMediaPreview();
          media.cutoutImages.forEach(path => {
            const image = document.createElement("img");
            image.src = nativeMedia.Capacitor.convertFileSrc(path.slice(LOCAL_PRODUCT_MEDIA_PREFIX.length));
            image.alt = "Product photo with background removed";
            mediaPreview?.append(image);
          });
          if (mediaPreview) mediaPreview.hidden = false;
          setMediaStatus(`${media.cutoutImages.length} cutout photos are ready.`);
        } catch (error) {
          console.error("New-website product cutout could not be processed.", error);
          setMediaStatus(error instanceof Error ? error.message : "Product photo background removal failed.");
        }
      };
      const resetProductForm = () => {
        editingProduct = null;
        productForm.reset();
        productForm.elements.id.value = "";
        productForm.querySelector('button[type="submit"]').textContent = "Add product";
        if (cancelProductEdit) cancelProductEdit.hidden = true;
        bindProductFields(null);
        setMediaMode("image", true);
      };

      bindProductFields(null);
      setMediaMode("image");
      productSearch.oninput = renderDraftProducts;
      renderDraftProducts();
      productList.onclick = event => {
        const editButton = event.target.closest("[data-edit-wizard-product]");
        if (editButton) {
          editingProduct = StudioRenderers.websiteBuilderDraft().products.find(item =>
            String(item.id) === editButton.dataset.editWizardProduct);
          if (!editingProduct) return;
          productForm.hidden = false;
          productForm.elements.id.value = String(editingProduct.id);
          productForm.elements.name.value = editingProduct.name || "";
          productForm.elements.price.value = String(editingProduct.price ?? "");
          productForm.elements.cost_price.value = String(editingProduct.cost_price ?? "");
          productForm.elements.stock.value = String(editingProduct.stock ?? 0);
          productForm.elements.sku.value = editingProduct.sku || "";
          productForm.elements.description.value = editingProduct.description || "";
          productForm.elements.category_id.value = String(editingProduct.category_id ?? "");
          productForm.querySelector('button[type="submit"]').textContent = "Save product";
          if (cancelProductEdit) cancelProductEdit.hidden = false;
          bindProductFields(editingProduct);
          setMediaMode(editingProduct.media_type === "spin" ? "spin"
            : editingProduct.media_type === "video" ? "video"
              : editingProduct.media_type === "cutout" ? "cutout" : "image");
          media.videoPath = editingProduct.video_path || "";
          media.spinFrames = Array.isArray(editingProduct.spin_frames) ? editingProduct.spin_frames.slice() : [];
          media.cutoutImages = editingProduct.media_type === "cutout" && Array.isArray(editingProduct.images)
            ? editingProduct.images.slice()
            : [];
          productForm.scrollIntoView({ behavior: "smooth", block: "center" });
          productForm.elements.name.focus();
          return;
        }
        const button = event.target.closest("[data-remove-wizard-product]");
        if (!button) return;
        const draft = StudioRenderers.websiteBuilderDraft();
        draft.products = draft.products.filter(product =>
          String(product.id) !== button.dataset.removeWizardProduct);
        window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
        StudioRenderers.saveWebsiteBuilderDraft(draft);
        this.handleRoute(this.currentRoute());
      };
      productForm.querySelectorAll("[data-wizard-media-mode]").forEach(button => {
        button.addEventListener("click", () => {
          const mode = button.dataset.wizardMediaMode;
          setMediaMode(mode, mode !== media.mode);
          if (mode === "cutout") void processCutoutPhotos();
        });
      });
      imageInput?.addEventListener("change", () => {
        media.imageFiles = Array.from(imageInput.files || []);
        if (media.imageFiles.length > 8) {
          media.imageFiles = [];
          imageInput.value = "";
          clearMediaPreview();
          setMediaStatus("Choose up to 8 product photos.");
          return;
        }
        showMediaPreview(media.imageFiles);
        setMediaStatus(`${media.imageFiles.length} photo${media.imageFiles.length === 1 ? "" : "s"} selected.`);
      });
      videoInput?.addEventListener("change", () => {
        media.videoBlob = videoInput.files?.[0] || null;
        media.videoPath = "";
        if (media.videoBlob) {
          showMediaPreview([media.videoBlob], true);
          setMediaStatus(`${media.videoBlob.name} selected. It will be saved locally with this draft.`);
        }
      });
      productForm.querySelector("[data-wizard-video-pick]")?.addEventListener("click", () => {
        if (media.mode === "spin") void processSpinVideo(false);
        else void loadSelectedVideo(false);
      });
      productForm.querySelector("[data-wizard-video-record]")?.addEventListener("click", () => {
        if (media.mode === "spin") void processSpinVideo(true);
        else void loadSelectedVideo(true);
      });
      productForm.onsubmit = async event => {
        event.preventDefault();
        const submit = productForm.querySelector('button[type="submit"]');
        const draft = StudioRenderers.websiteBuilderDraft();
        const category = draft.categories.find(item => String(item.id) === String(productForm.elements.category_id.value));
        const name = productForm.elements.name.value.trim();
        const price = Number(productForm.elements.price.value);
        const costText = productForm.elements.cost_price.value.trim();
        const costPrice = costText ? Number(costText) : null;
        const stock = Number(productForm.elements.stock.value);
        if (!category) {
          AppUtils.showToast("Add or choose a category for this product.", "danger");
          return;
        }
        if (!name || !Number.isFinite(price) || price < 0 ||
            (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
            !Number.isSafeInteger(stock) || stock < 0) {
          AppUtils.showToast("Enter a product name, valid selling and cost prices, and whole-number stock.", "danger");
          return;
        }
        if (media.mode === "video" && !media.videoPath && !media.videoBlob && !editingProduct?.video_path) {
          AppUtils.showToast("Choose a product video before saving.", "danger");
          return;
        }
        if (media.mode === "spin" && !media.spinFrames.length && !editingProduct?.spin_frames?.length) {
          AppUtils.showToast("Generate 360° frames before saving this product.", "danger");
          return;
        }
        if (media.mode === "cutout" && !media.cutoutImages.length &&
            !(editingProduct?.media_type === "cutout" && editingProduct.images?.length)) {
          AppUtils.showToast("Choose photos and remove their backgrounds before saving.", "danger");
          return;
        }
        if (submit) submit.disabled = true;
        try {
          const taxonomy = window.EshopProductTaxonomy.readProductTaxonomyFields(productForm);
          const variants = window.EshopProductVariants.readProductVariantFields(productForm);
          const imageFiles = media.mode === "image" ? media.imageFiles : [];
          if (imageFiles.length > 8 || imageFiles.some(file => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
            throw new Error("Choose up to 8 product photos, each smaller than 5 MB.");
          }
          const images = media.mode === "image"
            ? imageFiles.length
              ? await Promise.all(imageFiles.map(file => AppUtils.compressImageFile(file, { maxDimension: 1200, maxBytes: 250_000 })))
              : Array.isArray(editingProduct?.images) ? editingProduct.images.slice(0, 8) : []
            : media.mode === "spin"
              ? media.spinFrames.length ? [media.spinFrames[0]] : editingProduct.images.slice(0, 8)
              : media.mode === "cutout"
                ? media.cutoutImages.length ? media.cutoutImages.slice(0, 8) : editingProduct.images.slice(0, 8)
                : Array.isArray(editingProduct?.images) ? editingProduct.images.slice(0, 8) : [];
          const videoPath = media.mode === "video"
            ? media.videoPath || (media.videoBlob ? await AppUtils.storeLocalProductVideo(media.videoBlob) : editingProduct?.video_path || "")
            : "";
          const spinFrames = media.mode === "spin" ? media.spinFrames.slice() : [];
          const values = {
            name,
            sku: productForm.elements.sku.value.trim(),
            price,
            cost_price: costPrice ?? 0,
            category_id: category.id,
            category_name: category.name,
            description: productForm.elements.description.value.trim(),
            images,
            media_type: media.mode === "image" ? "image" : media.mode === "spin" ? "spin" : media.mode,
            spin_frames: spinFrames,
            video_url: "",
            video_path: videoPath,
            taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
            taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
            taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
            taxonomy_attributes: taxonomy.taxonomyAttributes,
            priced_attributes: window.EshopAttributePricing.readAttributePricingFields(
              productForm.querySelector("[data-wizard-product-attribute-pricing] [data-attribute-pricing]")
            ),
            ...variants,
            stock: variants.stock ?? stock
          };
          if (editingProduct) {
            const target = draft.products.find(product => String(product.id) === String(editingProduct.id));
            if (!target) throw new Error("That product is no longer in this website draft.");
            Object.assign(target, values);
          } else {
            draft.products.push({ id: Date.now() + draft.products.length, ...values });
          }
          StudioRenderers.saveWebsiteBuilderDraft(draft);
          this.handleRoute(this.currentRoute());
        } catch (error) {
          console.error("New-website product could not be saved.", error);
          setMediaStatus(error instanceof Error ? error.message : "Product could not be saved.");
          AppUtils.showToast(error instanceof Error ? error.message : "Product could not be saved.", "danger");
        } finally {
          if (submit) submit.disabled = false;
        }
      };
      if (cancelProductEdit) cancelProductEdit.onclick = resetProductForm;
    }

    const clearProducts = document.getElementById("website-wizard-clear-products");
    if (clearProducts) clearProducts.onclick = () => {
      const draft = StudioRenderers.websiteBuilderDraft();
      draft.products = [];
      window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
      StudioRenderers.saveWebsiteBuilderDraft(draft);
      this.handleRoute(this.currentRoute());
    };

    const loadStore = document.getElementById("website-wizard-load-store");
    if (loadStore) loadStore.onclick = async () => {
      const picker = document.getElementById("website-wizard-store-picker");
      const status = document.getElementById("website-wizard-store-count");
      const list = document.getElementById("website-wizard-store-list");
      const closeButton = document.getElementById("website-wizard-store-close");
      const importButton = document.getElementById("website-wizard-import-store");
      const searchInput = document.getElementById("website-wizard-store-search");
      const categoryFilter = document.getElementById("website-wizard-store-category");
      const selectAll = document.getElementById("website-wizard-store-select-all");
      if (!picker || !status || !list || !importButton || !searchInput || !categoryFilter || !selectAll) return;

      picker.hidden = false;
      list.innerHTML = "";
      status.textContent = "Loading all Store products…";
      loadStore.disabled = true;
      loadStore.textContent = "Loading Store…";
      if (closeButton) closeButton.onclick = () => { picker.hidden = true; };

      try {
        if (!window.ShopPOS?.listProducts || !window.ShopPOS?.listCategories) {
          throw new Error("Store inventory is not available in this app session.");
        }
        const products = await window.ShopPOS.listProducts();
        const categories = await window.ShopPOS.listCategories();
        if (!Array.isArray(products) || !Array.isArray(categories)) {
          throw new Error("Store returned an invalid product catalog.");
        }
        const categoryName = product => String(product.categoryName || product.category_name ||
          categories.find(category => Number(category.id) === Number(product.categoryId ?? product.category_id))?.name || "").trim();
        const namedCategories = [...new Set(products.map(categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        categoryFilter.innerHTML = `<option value="all">All categories</option><option value="general">General (uncategorized)</option>${namedCategories.map(name => `<option value="${AppUtils.escapeHTML(name.toLocaleLowerCase())}">${AppUtils.escapeHTML(name)}</option>`).join("")}`;
        const selectedProductIds = new Set();
        const renderStoreProducts = () => {
          const query = searchInput.value.trim().toLocaleLowerCase();
          const selectedCategory = categoryFilter.value;
          const matchingProducts = products.map((product, index) => ({ product, index, category: categoryName(product) }))
            .filter(({ product, category }) => {
              const categoryMatches = selectedCategory === "all" ||
                (selectedCategory === "general" ? !category : category.toLocaleLowerCase() === selectedCategory);
              return categoryMatches && (!query || `${product.name} ${product.sku || ""} ${product.description || ""} ${category}`.toLocaleLowerCase().includes(query));
            });
          const visibleProducts = matchingProducts.slice(0, 50);
          list.innerHTML = visibleProducts.map(({ product, index, category }) => `<label class="studio-list-row" style="display:flex;align-items:center;gap:9px;min-height:52px;padding:6px 4px;">
            <input type="checkbox" data-wizard-store-product="${index}" ${selectedProductIds.has(index) ? "checked" : ""}>
            ${product.imageUri ? `<img src="${AppUtils.escapeHTML(product.imageUri)}" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:7px;">` : ""}
            <span style="flex:1;min-width:0;"><strong>${AppUtils.escapeHTML(product.name || "Unnamed product")}</strong><span>${AppUtils.escapeHTML(category || "General")} · ${AppUtils.escapeHTML(String(product.stock ?? 0))} in stock</span></span>
            <strong>${AppUtils.escapeHTML(String(product.price ?? ""))}</strong>
          </label>`).join("") || `<p class="studio-panel-note">No products match this filter.</p>`;
          status.textContent = `${visibleProducts.length < matchingProducts.length ? `Showing ${visibleProducts.length} of ${matchingProducts.length} matches` : `${matchingProducts.length} matches`} · ${products.length} Store products · ${selectedProductIds.size} selected`;
          importButton.disabled = selectedProductIds.size === 0;
          selectAll.checked = visibleProducts.length > 0 && visibleProducts.every(({ index }) => selectedProductIds.has(index));
          selectAll.indeterminate = !selectAll.checked && visibleProducts.some(({ index }) => selectedProductIds.has(index));
        };
        list.onchange = event => {
          const checkbox = event.target.closest("[data-wizard-store-product]");
          if (!checkbox) return;
          const index = Number(checkbox.dataset.wizardStoreProduct);
          if (checkbox.checked) selectedProductIds.add(index);
          else selectedProductIds.delete(index);
          renderStoreProducts();
        };
        searchInput.oninput = renderStoreProducts;
        categoryFilter.onchange = renderStoreProducts;
        selectAll.onchange = () => {
          const query = searchInput.value.trim().toLocaleLowerCase();
          const selectedCategory = categoryFilter.value;
          products.map((product, index) => ({ product, index, category: categoryName(product) }))
            .filter(({ product, category }) => {
              const categoryMatches = selectedCategory === "all" ||
                (selectedCategory === "general" ? !category : category.toLocaleLowerCase() === selectedCategory);
              return categoryMatches && (!query || `${product.name} ${product.sku || ""} ${product.description || ""} ${category}`.toLocaleLowerCase().includes(query));
            })
            .slice(0, 50)
            .forEach(({ index }) => {
              if (selectAll.checked) selectedProductIds.add(index);
              else selectedProductIds.delete(index);
            });
          renderStoreProducts();
        };
        importButton.onclick = () => {
          const draft = StudioRenderers.websiteBuilderDraft();
          let addedCount = 0;
          for (const index of selectedProductIds) {
            const product = products[index];
            if (!product) continue;
            const name = categoryName(product) || "General";
            let category = draft.categories.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
            if (!category) {
              category = { id: Date.now() + draft.categories.length, name };
              draft.categories.push(category);
            }
            if (draft.products.some(item => item.source_product_id === product.id)) continue;
            draft.products.push({
              id: Date.now() + draft.products.length,
              source_product_id: product.id,
              name: String(product.name || "Unnamed product"),
              sku: String(product.sku || ""),
              brand: String(product.brand || ""),
              price: Number(product.price ?? product.selling_price) || 0,
              cost_price: Number(product.cost_price ?? product.costPrice) || 0,
              stock: Math.max(0, Number(product.stock) || 0),
              description: String(product.description || ""),
              images: Array.isArray(product.images) ? product.images.slice(0, 8) : product.imageUri ? [product.imageUri] : [],
              media_type: ["image", "cutout", "spin", "video"].includes(product.media_type) ? product.media_type : "image",
              spin_frames: Array.isArray(product.spin_frames) ? product.spin_frames.slice() : [],
              video_path: String(product.video_path || ""),
              video_url: String(product.video_url || ""),
              taxonomy_category_id: product.taxonomy_category_id || null,
              taxonomy_category_name: String(product.taxonomy_category_name || ""),
              taxonomy_custom_category: product.taxonomy_custom_category || null,
              taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes : [],
              priced_attributes: Array.isArray(product.priced_attributes) ? product.priced_attributes : [],
              sizes: Array.isArray(product.sizes) ? product.sizes : [],
              colors: Array.isArray(product.colors) ? product.colors : [],
              variants: Array.isArray(product.variants) ? product.variants : [],
              category_id: category.id,
              category_name: category.name
            });
            addedCount += 1;
          }
          StudioRenderers.saveWebsiteBuilderDraft(draft);
          AppUtils.showToast(`${addedCount} Store product${addedCount === 1 ? "" : "s"} added to the new website draft.`);
          this.handleRoute(this.currentRoute());
        };
        renderStoreProducts();
      } catch (error) {
        console.error("Store products could not be loaded for the new website wizard.", error);
        status.textContent = error.message || "Store products could not be loaded.";
        AppUtils.showToast(status.textContent, "danger");
      } finally {
        loadStore.disabled = false;
        loadStore.textContent = "Choose products from Store";
      }
    };
  },

  postRenderSetup(path, params) {
    const draftEditor = params.get("new") === "1" && params.get("edit") === "1";
    if (path === "/") {
      void this.loadHomeDashboard();
    }
    if (path === "/account/web/studio/websites/webmaker") {
      this.bindWebsiteBuilderEvents();
      // Categories are never preloaded from Store or POS: the owner adds the ones this shop needs,
      // or brings them in with the products they pick from Store.
    }
    if (path === "/account/web/site") {
      const litrusFrame = document.getElementById("builder-litrus-mixer");
      if (litrusFrame) {
        // Releasing the taxonomy here was a guess at the crash, and it was the wrong one: the app
        // dies on a single 54 MB bitmap allocation, not on the taxonomy. All the release bought was
        // a quarter-second re-decode the next time a product form opened, so it is gone.
        const isDraftEditor = params.get("new") === "1" && params.get("edit") === "1";
        const draftId = isDraftEditor ? StudioRenderers.websiteBuilderDraft().draft_id : "";
        // The shop this editor session belongs to. Everything the editor sends is applied to this
        // shop only, never to whichever shop happens to be active when the message arrives.
        const openedTenantId = this.getActiveTenant().id;
        const litrusScope = isDraftEditor ? `draft:${draftId || "new"}` : `tenant:${openedTenantId}`;
        const litrusRecipeKey = `litrus-mixer-recipe:${litrusScope}`;
        const litrusDesignKey = `liquid-html-theme-draft:litrus-mixer:${litrusScope}`;
        const savedLitrusRecipe = StudioRenderers.getWorkspaceSetting(litrusRecipeKey, null);
        const savedLitrusHtml = isDraftEditor ? "" : StudioRenderers.getWorkspaceSetting(litrusDesignKey, "");
        let litrusSaveQueue = Promise.resolve();
        const validLitrusHtml = html => window.EshopLitrusHost.isValidHtml(html);
        const saveLitrusDesign = payload => {
          const save = litrusSaveQueue.then(async () => {
            if (!window.ShopSQLite) throw new Error("The app database is not ready.");
            await this.saveLitrusMixerCatalog(payload, isDraftEditor, openedTenantId);
            StudioRenderers.setWorkspaceSetting(litrusDesignKey, payload.html);
            if (payload.recipe?.litrus === "mixer-recipe" && payload.recipe.v === 1) {
              StudioRenderers.setWorkspaceSetting(litrusRecipeKey, payload.recipe);
            }
            await window.ShopSQLite.flush();
          });
          litrusSaveQueue = save.catch(() => {});
          return save;
        };
        const sendCatalog = () => {
          try {
            const store = SQLiteEngine.getStore();
            const categories = SQLiteEngine.getCategories();
            const products = SQLiteEngine.select("products", product => product.status !== "archived")
              .map(product => {
                const productCategoryIds = Array.isArray(product.category_ids) &&
                    String(product.category_ids[0] ?? "") === String(product.category_id ?? "")
                  ? product.category_ids
                  : product.category_id == null ? [] : [product.category_id];
                return {
                  id: product.id,
                  name: product.name,
                  price: product.price ?? product.selling_price ?? 0,
                  description: product.description || "",
                  images: Array.isArray(product.images) ? product.images : [],
                  image: (Array.isArray(product.images) ? product.images[0] : "") ||
                    product.imageUri || product.image || "",
                  media_type: product.media_type || "image",
                  // Up to 36 base64 frames per product, all of it serialised into one postMessage.
                  // That is what the 54 MB allocation was that killed the app when the builder
                  // opened. The builder only previews; the saved frames are kept here and restored
                  // on the way back, so sending a count instead loses nothing but the spin preview.
                  spin_frame_count: Array.isArray(product.spin_frames) ? product.spin_frames.length : 0,
                  video_url: product.video_url || "",
                  booking_enabled: product.booking_enabled === true || product.booking_enabled === 1,
                  // Only a service carries a duration. Defaulting every product to an hour made
                  // the builder treat the whole catalogue as bookable time.
                  duration_minutes: window.EshopServiceModel.serviceDuration(product) || null,
                  category_names: categories
                    .filter(category => productCategoryIds.some(id => String(category.id) === String(id)))
                    .map(category => category.name)
                };
              });
            const draft = isDraftEditor ? StudioRenderers.websiteBuilderDraft() : null;
            litrusFrame.contentWindow?.postMessage({
              type: "craft-litrus-catalog",
              recipe: savedLitrusRecipe,
              catalog: {
                existing_html: validLitrusHtml(savedLitrusHtml) ? savedLitrusHtml : "",
                shop: {
                  name: draft?.shop_name || (isDraftEditor ? "" : store.name),
                  is_new_shop_draft: isDraftEditor,
                  draft_id: draft?.draft_id || "",
                  currency: store.currency || "KES",
                  offer_type: window.EshopServiceModel.offerTypeForCatalogue(products, store.offer_type),
                  service_days: Array.isArray(store.service_days) ? store.service_days : [1, 2, 3, 4, 5, 6],
                  service_open_time: store.service_open_time || "09:00",
                  service_close_time: store.service_close_time || "17:00",
                  service_timezone: store.service_timezone || "Africa/Nairobi",
                  service_buffer_minutes: Number(store.service_buffer_minutes) || 0,
                  service_deposit_percent: Number(store.service_deposit_percent) || 0,
                  service_capacity: Math.min(20, Math.max(1, Math.round(Number(store.service_capacity)) || 1)),
                  service_cancel_cutoff_hours: store.service_cancel_cutoff_hours === undefined || store.service_cancel_cutoff_hours === "" || !Number.isFinite(Number(store.service_cancel_cutoff_hours)) ? 2 : Math.min(168, Math.max(0, Math.round(Number(store.service_cancel_cutoff_hours)))),
                  service_max_reschedules: store.service_max_reschedules === undefined || store.service_max_reschedules === "" || !Number.isFinite(Number(store.service_max_reschedules)) ? 2 : Math.min(10, Math.max(0, Math.round(Number(store.service_max_reschedules)))),
                  tagline: store.tagline || "",
                  description: store.description || "",
                  email: store.email || "",
                  phone: store.phone || "",
                  whatsapp: store.whatsapp || store.whatsapp_number || "",
                  address: store.location_address || store.address || "",
                  delivery_fee: store.delivery_fee || "",
                  free_delivery_over: store.free_delivery_over || "",
                  about: store.about || ""
                },
                categories: categories.map(category => ({ id: category.id, name: category.name })),
                products
              }
            }, window.location.origin);
          } catch (error) {
            console.error("Craft could not send the shop catalog to Litrus Mixer.", error);
            AppUtils.showToast(error.message || "Could not load the shop catalog into Litrus Mixer.", "danger");
          }
        };
        if (this.litrusMixerMessageHandler) {
          window.removeEventListener("message", this.litrusMixerMessageHandler);
        }
        const litrusHost = window.EshopLitrusHost;
        this.litrusMixerMessageHandler = litrusHost.createMessageHandler({
          // Pinned when the editor opens: the handler refuses messages once another shop is active.
          tenantId: openedTenantId,
          isDraftEditor,
          getActiveTenantId: () => this.getActiveTenant().id,
          getFrameWindow: () => litrusFrame.contentWindow,
          origin: window.location.origin,
          sendTheme: () => {
            const appTheme = getComputedStyle(document.documentElement);
            const themeValue = (property, fallback) => appTheme.getPropertyValue(property).trim() || fallback;
            litrusFrame.contentWindow?.postMessage({
              type: "craft-litrus-theme",
              theme: {
                background: themeValue("--surface-subtle", "#f5f5f5"),
                surface: themeValue("--surface", "#fff"),
                text: themeValue("--text-main", "#18181b"),
                muted: themeValue("--text-muted", "#66666b"),
                border: themeValue("--border", "#e2e2e5"),
                accent: themeValue("--accent", "#18181b"),
                accentText: themeValue("--accent-contrast", "#fff")
              }
            }, window.location.origin);
          },
          sendCatalog,
          saveDesign: saveLitrusDesign,
          searchImages: ({ tenantId, isDraft, images }) => this.cloudflareRequest(
            isDraft ? "/api/images/draft-search" : `/api/images/search?tenant=${encodeURIComponent(tenantId)}`,
            { method: "POST", body: JSON.stringify({ images }) },
            tenantId,
            isDraft
          ),
          reply: (frameWindow, message) => frameWindow.postMessage(message, window.location.origin),
          setMode: mode => {
            const devices = document.getElementById("builder-litrus-devices");
            const previewing = mode === "preview";
            const sections = document.getElementById("builder-litrus-sections");
            const advanced = document.getElementById("builder-litrus-advanced");
            if (sections) sections.hidden = previewing;
            if (advanced) advanced.hidden = previewing;
            if (devices) {
              devices.hidden = !previewing;
              if (devices.hidden) devices.open = false;
            }
          },
          toast: (message, type) => AppUtils.showToast(message, type),
          finishDraft: () => this.navigate("/account/web/site?new=1&finish=1&theme=litrus-mixer"),
          openPublish: () => this.openCloudflarePublishModal(true)
        });
        window.addEventListener("message", this.litrusMixerMessageHandler);
        const publishButton = document.getElementById("builder-litrus-publish");
        const sectionsButton = document.getElementById("builder-litrus-sections");
        const advancedButton = document.getElementById("builder-litrus-advanced");
        sectionsButton?.addEventListener("click", () => {
          litrusFrame.contentWindow?.craftLitrusShowSections?.();
        });
        advancedButton?.addEventListener("click", () => {
          litrusFrame.contentWindow?.craftLitrusSetMode?.("advanced");
        });
        publishButton?.addEventListener("click", () => {
          litrusFrame.contentDocument?.getElementById("craftPublish")?.click();
        });
        document.querySelectorAll("[data-litrus-preview-device]").forEach(button => {
          button.addEventListener("click", () => {
            const device = button.dataset.litrusPreviewDevice;
            const previewButton = litrusFrame.contentDocument?.querySelector(
              `[data-preview-device="${device}"]`
            );
            if (!previewButton) return;
            previewButton.click();
            document.querySelectorAll("[data-litrus-preview-device]").forEach(control => {
              control.setAttribute("aria-pressed", control === button ? "true" : "false");
            });
            const devices = document.getElementById("builder-litrus-devices");
            if (devices) devices.open = false;
          });
        });
      } else if (this.litrusMixerMessageHandler) {
        window.removeEventListener("message", this.litrusMixerMessageHandler);
        this.litrusMixerMessageHandler = null;
      }
    }
    if (path === "/account/web/site") {
      this.bindWebsiteBuilderEvents();
    }
    if (path.startsWith("/account/web/themes/") ||
        (path === "/account/web/site" && params.get("new") === "1")) {
      const draft = StudioRenderers.websiteBuilderDraft();
      if (!draft.categories.length) {
        AppUtils.showToast("Add a category before choosing a theme.", "danger");
        this.navigate("/account/web/studio/websites/list");
      } else if (path === "/account/web/site" && params.get("new") === "1" &&
          !StudioRenderers.websiteThemesForPicker().some(theme =>
            theme.id === (params.get("theme") || draft.selected_theme))) {
        AppUtils.showToast("Choose a website theme before creating this website.", "danger");
        this.navigate("/account/web/studio/websites/list");
      }
    }
    const businessFilterToggle = document.querySelector("[data-business-filter-toggle]");
    const businessFilters = document.getElementById("business-date-filters");
    if (businessFilterToggle && businessFilters) {
      businessFilterToggle.addEventListener("click", () => {
        const expanded = businessFilterToggle.getAttribute("aria-expanded") !== "true";
        businessFilterToggle.setAttribute("aria-expanded", String(expanded));
        businessFilterToggle.setAttribute("aria-label", expanded ? "Hide filters" : "Show filters");
        businessFilters.hidden = !expanded;
      });
    }
    const googleAuthParams = new URLSearchParams(this.currentRoute().split("?")[1] || "");
    const googleTicket = googleAuthParams.get("google_ticket");
    if (googleTicket && !this.googleAuthCompleting) {
      this.googleAuthCompleting = true;
      void (async () => {
        try {
          const completionSecret = window.localStorage.getItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1") || "";
          window.localStorage.removeItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1");
          const result = await this.cloudflareRequest(
            "/api/auth/google/complete",
            {
              method: "POST",
              body: JSON.stringify({ ticket: googleTicket, completion_secret: completionSecret })
            },
            "main",
            true
          );
          if (!result.ok || !result.session_token) throw new Error("Craft could not complete Google sign-in.");
          window.localStorage.setItem("ESHOP_ACCOUNT_SESSION_V1", result.session_token);
          window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", result.username || "");
          window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", result.email || "");
          await this.restoreAccountWebsites(result.tenants, this.cloudflareConnection("main").origin);
          this.navigate(`/app-account?${result.google_linked ? "google_linked=1" : ""}`);
        } catch (error) {
          console.error("Google sign-in could not be completed.", error);
          this.navigate("/app-account?google_error=failed");
        } finally {
          this.googleAuthCompleting = false;
        }
      })();
    }
    if (googleAuthParams.has("google_error")) {
      window.localStorage.removeItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1");
    }
    const startGoogleAuth = async (button, mode) => {
      if (!button) return;
      button.disabled = true;
      try {
        const sessionToken = mode === "link"
          ? window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || ""
          : "";
        const result = await this.cloudflareRequest(
          "/api/auth/google/start",
          {
            method: "POST",
            body: JSON.stringify({
              mode,
              native: window.Capacitor?.isNativePlatform?.() === true
            })
          },
          "main",
          mode !== "link",
          sessionToken
        );
        if (!result.authorization_url) throw new Error("Google did not provide a sign-in link.");
        if (!result.completion_secret) throw new Error("Craft did not provide a secure sign-in verifier.");
        window.localStorage.setItem("ESHOP_GOOGLE_AUTH_COMPLETION_SECRET_V1", result.completion_secret);
        if (window.Capacitor?.isNativePlatform?.()) {
          if (!window.EshopAuthBrowser?.open) {
            throw new Error("Secure Google sign-in is unavailable. Update the Craft app and try again.");
          }
          await window.EshopAuthBrowser.open({ url: result.authorization_url });
          return;
        }
        window.location.assign(result.authorization_url);
      } catch (error) {
        console.error("Google account sign-in could not be started.", error);
        const accountError = document.getElementById("app-account-error");
        if (accountError) {
          accountError.textContent = error.message || "Google sign-in could not be started.";
          accountError.hidden = false;
        } else {
          AppUtils.showToast(error.message || "Google sign-in could not be started.", "danger");
        }
        button.disabled = false;
      }
    };
    document.getElementById("app-account-google")?.addEventListener("click", event => {
      void startGoogleAuth(event.currentTarget, "login");
    });
    document.getElementById("app-account-google-link")?.addEventListener("click", event => {
      void startGoogleAuth(event.currentTarget, "link");
    });
    const appAccountForm = document.getElementById("app-account-form");
    if (appAccountForm) {
      const accountError = document.getElementById("app-account-error");
      const passwordField = appAccountForm.elements.namedItem("password");
      const confirmField = appAccountForm.elements.namedItem("confirmPassword");
      const emailField = appAccountForm.elements.namedItem("email");
      const emailContainer = document.getElementById("app-account-email-field");
      const confirmContainer = document.getElementById("app-account-confirm-field");
      const forgotPasswordButton = document.getElementById("app-account-forgot-password");
      const recoveryPanel = document.getElementById("app-account-recovery");
      const turnstileContainer = document.getElementById("app-account-turnstile");
      const verificationHelp = document.getElementById("app-account-verification-help");
      const submitButton = appAccountForm.querySelector('button[type="submit"]');
      let turnstileWidgetId = null;
      let turnstileSetupStarted = false;
      let turnstileRequested = false;
      let turnstileToken = "";
      let autoSubmitEnabled = true;
      let authSubmitting = false;
      const getWorkerOrigin = () => this.cloudflareConnection("main").origin;
      const setAuthMode = mode => {
        const registering = mode === "register";
        appAccountForm.dataset.authMode = registering ? "register" : "login";
        accountError.hidden = true;
        accountError.textContent = "";
        verificationHelp.hidden = true;
        verificationHelp.textContent = "";
        emailContainer.hidden = !registering;
        emailField.required = registering;
        confirmContainer.hidden = !registering;
        turnstileContainer.hidden = !registering || !turnstileRequested;
        if (!registering) {
          turnstileRequested = false;
          turnstileToken = "";
          if (turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
        }
        confirmField.required = registering;
        confirmField.value = "";
        passwordField.autocomplete = registering ? "new-password" : "current-password";
        document.getElementById("app-account-heading").textContent = registering
          ? "Create your app account"
          : "Sign in to your app account";
        submitButton.textContent = appAccountForm.dataset.authMode === "register" ? "Create app account" : "Sign in";
        forgotPasswordButton.hidden = registering;
        appAccountForm.querySelectorAll("[data-app-auth-mode]").forEach(button => {
          const active = button.dataset.appAuthMode === (registering ? "register" : "login");
          button.setAttribute("aria-pressed", String(active));
          button.className = active ? "btn-primary" : "btn-secondary";
        });
      };
      const fetchAuth = async (endpoint, body) => {
        let response;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          try {
          response = await fetch(new URL(endpoint, getWorkerOrigin()), {
            method: body ? "POST" : "GET",
            headers: body ? { "Content-Type": "application/json" } : {},
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal
          });
          } finally {
            clearTimeout(timeout);
          }
        } catch (error) {
          throw new Error(error.name === "AbortError"
            ? "Cloudflare account service took too long to respond. Check your connection and try again."
            : `Could not connect to Cloudflare account service. Check internet access and the Worker URL. ${error.message || ""}`.trim());
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          const codes = Array.isArray(result.error_codes) && result.error_codes.length
            ? ` (${result.error_codes.join(", ")})`
            : "";
          const error = new Error(`${result.error || `Account service returned HTTP ${response.status}.`}${codes}`);
          error.status = response.status;
          throw error;
        }
        return result;
      };
      appAccountForm.querySelectorAll("[data-app-auth-mode]").forEach(button => {
        button.onclick = () => {
          const registering = button.dataset.appAuthMode === "register";
          setAuthMode(button.dataset.appAuthMode);
          if (!registering) return;
        };
      });
      const updateTurnstileVisibility = () => {
        const registering = appAccountForm.dataset.authMode === "register";
        const fieldsValid = appAccountForm.elements.namedItem("username").checkValidity()
          && passwordField.checkValidity()
          && confirmField.checkValidity()
          && passwordField.value === confirmField.value;
        const shouldShow = registering && fieldsValid;
        if (!shouldShow) {
          turnstileRequested = false;
          turnstileToken = "";
          turnstileContainer.hidden = true;
          verificationHelp.hidden = true;
          if (turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
          return;
        }
        if (turnstileRequested) return;
        turnstileRequested = true;
        turnstileContainer.hidden = false;
        void configureTurnstile();
      };
      appAccountForm.addEventListener("input", () => {
        autoSubmitEnabled = true;
        accountError.hidden = true;
        updateTurnstileVisibility();
      });
      appAccountForm.querySelectorAll("[data-app-toggle-password]").forEach(button => {
        button.onclick = () => {
          const field = appAccountForm.elements.namedItem(button.dataset.appTogglePassword);
          if (!field) return;
          const visible = field.type === "password";
          field.type = visible ? "text" : "password";
          button.textContent = visible ? "Hide" : "Show";
          button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${button.dataset.appTogglePassword === "password" ? "password" : "confirm password"}`);
        };
      });
      const configureTurnstile = async () => {
        if (turnstileWidgetId !== null || turnstileSetupStarted) return;
        turnstileSetupStarted = true;
        const widget = document.getElementById("app-account-turnstile");
        try {
          const config = await fetchAuth("/api/auth/config");
          if (!config.turnstile_site_key) throw new Error("Human verification is not configured yet. Please try again later.");
          if (!window.turnstile) {
            await new Promise((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
              script.async = true;
              script.defer = true;
              const timeout = setTimeout(() => reject(new Error("Cloudflare verification is taking too long to load. Check your connection and try again.")), 15000);
              script.onload = () => { clearTimeout(timeout); resolve(); };
              script.onerror = () => { clearTimeout(timeout); reject(new Error("Cloudflare human verification could not be loaded.")); };
              document.head.appendChild(script);
            });
          }
          if (!turnstileRequested || appAccountForm.dataset.authMode !== "register") return;
          turnstileWidgetId = window.turnstile.render(widget, {
            sitekey: config.turnstile_site_key,
            appearance: "always",
            callback(token) {
              turnstileToken = token;
              accountError.hidden = true;
              verificationHelp.textContent = autoSubmitEnabled
                ? "Verification complete. Creating your account…"
                : "Verification refreshed. Tap Create app account to try again.";
              verificationHelp.hidden = false;
              if (autoSubmitEnabled && !authSubmitting) appAccountForm.requestSubmit(submitButton);
            },
            "expired-callback"() { turnstileToken = ""; },
            "error-callback"(code) {
              turnstileToken = "";
              widget.classList.add("app-account-turnstile-error");
              widget.setAttribute("role", "alert");
              widget.textContent = `Cloudflare verification failed${code ? ` (${code})` : ""}. Check the site key and allowed hostnames, including localhost for Android.`;
            }
          });
        } catch (error) {
          widget.textContent = error.message || "Cloudflare human verification is unavailable.";
          widget.setAttribute("role", "alert");
          console.error("Turnstile could not be initialized.", error);
        } finally {
          turnstileSetupStarted = false;
        }
      };
      setAuthMode("login");
      appAccountForm.onsubmit = async event => {
        event.preventDefault();
        if (authSubmitting) return;
        const formData = new FormData(appAccountForm);
        const username = String(formData.get("username") || "").trim().toLowerCase();
        const password = String(formData.get("password") || "");
        const confirmPassword = String(formData.get("confirmPassword") || "");
        const registering = appAccountForm.dataset.authMode === "register";
        accountError.hidden = true;
        if (registering && password !== confirmPassword) {
          accountError.textContent = "The passwords do not match.";
          accountError.hidden = false;
          return;
        }
        if (registering && !turnstileToken) {
          accountError.textContent = "Complete the Cloudflare checkbox to create your account.";
          accountError.hidden = false;
          return;
        }
        authSubmitting = true;
        submitButton.disabled = true;
        submitButton.textContent = registering ? "Creating account…" : "Signing in…";
        try {
          const origin = getWorkerOrigin();
          const result = await fetchAuth(`/api/auth/${registering ? "register" : "login"}`, {
            username,
            password,
            ...(registering ? {
              email: String(formData.get("email") || "").trim(),
              turnstile_token: turnstileToken
            } : {})
          });
          if (!result.ok || !result.session_token) throw new Error("The account service did not create a secure session.");
          window.localStorage.setItem("ESHOP_ACCOUNT_SESSION_V1", result.session_token);
          window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", result.username || username);
          window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", result.email || "");
          await this.restoreAccountWebsites(result.tenants, origin);
          AppUtils.showToast(registering ? "Your Craft app account is ready." : "You are signed in.");
          const continueTo = new URLSearchParams(this.currentRoute().split("?")[1] || "").get("continue") || "";
          if (continueTo.startsWith("/account/web/site?new=1&finish=1&theme=") ||
              continueTo.startsWith("/account/web/site?new=1&theme=")) this.navigate(continueTo);
          else this.handleRoute("/app-account");
        } catch (error) {
          console.error("App account sign-in failed.", error);
          if (registering && error.status === 409) {
            setAuthMode("login");
            accountError.textContent = "This account already exists. Sign in to keep using it—no new account is needed.";
            accountError.hidden = false;
            return;
          }
          accountError.textContent = error.message || "Could not sign in to the app account.";
          accountError.hidden = false;
          if (registering) {
            autoSubmitEnabled = false;
            turnstileToken = "";
            if (turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
          }
        } finally {
          authSubmitting = false;
          submitButton.disabled = false;
          submitButton.textContent = registering ? "Create app account" : "Sign in";
        }
      };
      const recoveryEmail = document.getElementById("app-account-recovery-email");
      const recoveryCode = document.getElementById("app-account-recovery-code");
      const recoveryError = document.getElementById("app-account-recovery-error");
      const recoveryStatus = document.getElementById("app-account-recovery-status");
      const recoveryStepFields = [
        ["app-account-recovery-code-field", "app-account-verify-reset-code"],
        ["app-account-new-password-field", "app-account-confirm-new-password-field", "app-account-reset-password"]
      ];
      let resetToken = "";
      const showRecoveryStep = step => {
        recoveryStepFields.forEach((fields, index) => {
          fields.forEach(id => { document.getElementById(id).hidden = index !== step - 1; });
        });
        document.getElementById("app-account-recovery-email-field").hidden = step >= 2;
        document.getElementById("app-account-send-reset-code").hidden = step >= 1;
      };
      const showRecoveryError = error => {
        recoveryError.textContent = error.message || "Could not reset the password.";
        recoveryError.hidden = false;
      };
      forgotPasswordButton.onclick = () => {
        recoveryError.hidden = true;
        recoveryEmail.value = emailField.value.trim();
        resetToken = "";
        showRecoveryStep(0);
        appAccountForm.hidden = true;
        recoveryPanel.hidden = false;
        recoveryEmail.focus();
      };
      document.getElementById("app-account-recovery-cancel").onclick = () => {
        recoveryPanel.hidden = true;
        appAccountForm.hidden = false;
        recoveryError.hidden = true;
        resetToken = "";
      };
      document.getElementById("app-account-send-reset-code").onclick = async event => {
        const button = event.currentTarget;
        recoveryError.hidden = true;
        if (!recoveryEmail.reportValidity()) return;
        button.disabled = true;
        button.textContent = "Sending code…";
        try {
          const result = await fetchAuth("/api/auth/request-reset-code", { email: recoveryEmail.value.trim() });
          recoveryStatus.textContent = result.message || "If an account uses that email, a reset code will arrive shortly.";
          recoveryCode.required = true;
          showRecoveryStep(1);
          recoveryCode.focus();
        } catch (error) {
          showRecoveryError(error);
        } finally {
          button.disabled = false;
          button.textContent = "Send recovery code";
        }
      };
      document.getElementById("app-account-verify-reset-code").onclick = async event => {
        const button = event.currentTarget;
        recoveryError.hidden = true;
        if (!recoveryCode.reportValidity()) return;
        button.disabled = true;
        button.textContent = "Verifying…";
        try {
          const result = await fetchAuth("/api/auth/verify-reset-code", {
            email: recoveryEmail.value.trim(),
            code: recoveryCode.value.trim()
          });
          if (!result.reset_token) throw new Error("The recovery code was not accepted.");
          resetToken = result.reset_token;
          recoveryCode.required = false;
          showRecoveryStep(2);
          document.getElementById("app-account-new-password").focus();
        } catch (error) {
          showRecoveryError(error);
        } finally {
          button.disabled = false;
          button.textContent = "Verify code";
        }
      };
      document.getElementById("app-account-reset-password").onclick = async event => {
        const button = event.currentTarget;
        const newPassword = document.getElementById("app-account-new-password");
        const confirmNewPassword = document.getElementById("app-account-confirm-new-password");
        recoveryError.hidden = true;
        if (!newPassword.reportValidity() || !confirmNewPassword.reportValidity()) return;
        if (newPassword.value !== confirmNewPassword.value) {
          showRecoveryError(new Error("The passwords do not match."));
          return;
        }
        button.disabled = true;
        button.textContent = "Resetting password…";
        try {
          const result = await fetchAuth("/api/auth/reset-password", {
            reset_token: resetToken,
            password: newPassword.value
          });
          recoveryStatus.textContent = result.message || "Your password has been reset. Sign in with your new password.";
          recoveryPanel.hidden = true;
          appAccountForm.hidden = false;
          setAuthMode("login");
          accountError.textContent = "Password reset. Sign in with your new password.";
          accountError.hidden = false;
          passwordField.value = "";
          newPassword.value = "";
          confirmNewPassword.value = "";
          resetToken = "";
        } catch (error) {
          showRecoveryError(error);
        } finally {
          button.disabled = false;
          button.textContent = "Reset password";
        }
      };
    }
    const appAccountSignout = document.getElementById("app-account-signout");
    const recoveryEmailForm = document.getElementById("app-account-recovery-email-form");
    if (recoveryEmailForm) {
      recoveryEmailForm.onsubmit = async event => {
        event.preventDefault();
        const button = recoveryEmailForm.querySelector('button[type="submit"]');
        const status = document.getElementById("app-account-recovery-email-status");
        const errorMessage = document.getElementById("app-account-recovery-email-error");
        const formData = new FormData(recoveryEmailForm);
        status.hidden = true;
        errorMessage.hidden = true;
        button.disabled = true;
        try {
          const response = await fetch(new URL("/api/auth/set-recovery-email", this.cloudflareConnection("main").origin), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || ""}`
            },
            body: JSON.stringify({
              email: String(formData.get("email") || "").trim(),
              password: String(formData.get("password") || "")
            })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || `Account service returned HTTP ${response.status}.`);
          window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", result.email || "");
          recoveryEmailForm.elements.namedItem("password").value = "";
          status.textContent = "Recovery email saved. Use an address you can access to receive password reset codes.";
          status.hidden = false;
        } catch (error) {
          errorMessage.textContent = error.message || "Could not save the recovery email.";
          errorMessage.hidden = false;
        } finally {
          button.disabled = false;
        }
      };
    }
    if (appAccountSignout) {
      appAccountSignout.onclick = async () => {
        const session = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        let revokeFailed = false;
        try {
          const response = await fetch(new URL("/api/auth/logout", this.cloudflareConnection("main").origin), {
            method: "POST",
            headers: { Authorization: `Bearer ${session}` }
          });
          if (!response.ok) throw new Error(`Account service returned HTTP ${response.status}.`);
        } catch (error) {
          console.error("Could not revoke the app account session remotely.", error);
          revokeFailed = true;
        }
        window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
        window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
        window.localStorage.removeItem("ESHOP_ACCOUNT_EMAIL_V1");
        if (revokeFailed) AppUtils.showToast("Signed out on this device, but the server session could not be revoked.", "danger");
        else AppUtils.showToast("You are signed out.");
        this.navigate("/", true);
      };
    }
    const newWebsiteForm = document.getElementById("new-website-form");
    if (newWebsiteForm && !newWebsiteForm.querySelector('[name="username"]')) {
      newWebsiteForm.onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(newWebsiteForm);
        const name = String(formData.get("name") || "").trim();
        const id = String(formData.get("id") || "")
          .trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        const websiteDraft = StudioRenderers.websiteBuilderDraft();
        const errorElement = document.getElementById("new-website-error");
        const submitButton = newWebsiteForm.querySelector('button[type="submit"]');
        errorElement.hidden = true;
        if (!websiteDraft.categories.length) {
          errorElement.textContent = "Add a category in Webmaker before creating a website.";
          errorElement.hidden = false;
          return;
        }
        if (!name || !id || !sessionToken) {
          errorElement.textContent = "Enter a website name and address while signed in to your app account.";
          errorElement.hidden = false;
          return;
        }
        if (this.getActiveTenant().id !== WEBSITE_BUILDER_DRAFT_TENANT_ID) {
          errorElement.textContent = "The editor draft is not active. Return to the editor and finish again.";
          errorElement.hidden = false;
          return;
        }
        submitButton.disabled = true;
        submitButton.textContent = "Creating website…";
        let createdTenant = null;
        let tenantOwnerToken = "";
        let storefrontPublished = false;
        try {
          this.cacheActiveTenantCatalog();
          const draftCatalog = this.tenantCatalogs().find(item =>
            item.tenant_id === WEBSITE_BUILDER_DRAFT_TENANT_ID);
          if (!draftCatalog?.products?.length || !draftCatalog?.categories?.length) {
            throw new Error("The editor draft has no products or categories. Return to the editor and try again.");
          }
          const availableThemes = StudioRenderers.websiteThemesForPicker();
          const selectedThemeEntry = availableThemes.find(theme => theme.id === params.get("theme")) ||
            availableThemes.find(theme => theme.id === websiteDraft.selected_theme) ||
            availableThemes[0];
          const selectedTheme = selectedThemeEntry?.id;
          if (!selectedTheme) throw new Error("The Craft storefront theme is unavailable.");
          const appEditableTheme = selectedThemeEntry.editor_mode === "app";
          const liquidHtmlTheme = selectedThemeEntry.editor_mode === "liquid-html";
          const litrusMixerTheme = selectedThemeEntry.editor_mode === "litrus";
          if (!appEditableTheme && !liquidHtmlTheme && !litrusMixerTheme) {
            throw new Error(`${selectedThemeEntry.name} cannot be used for a new website yet.`);
          }
          const store = {
            ...(draftCatalog.store || {}),
            id,
            name,
            title: name,
            website_theme_id: selectedTheme,
            element_edits: []
          };
          const draftId = StudioRenderers.websiteBuilderDraft().draft_id || "new";
          const litrusDraftScope = `draft:${draftId}`;
          const themeDesignKey = litrusMixerTheme
            ? `liquid-html-theme-draft:litrus-mixer:${litrusDraftScope}`
            : `liquid-html-theme-draft:${selectedTheme}`;
          let savedThemeDesign = liquidHtmlTheme || litrusMixerTheme
            ? StudioRenderers.getWorkspaceSetting(themeDesignKey, "")
            : "";
          const savedLitrusRecipe = litrusMixerTheme
            ? StudioRenderers.getWorkspaceSetting(`litrus-mixer-recipe:${litrusDraftScope}`, null)
            : null;
          if (litrusMixerTheme) {
            savedThemeDesign = this.renameLitrusMixerStorefront(savedThemeDesign, name);
            StudioRenderers.setWorkspaceSetting(themeDesignKey, savedThemeDesign);
          }
          const initialCatalog = {
            products: draftCatalog.products.map(product => ({
              id: product.id,
              name: product.name,
              slug: product.slug,
              brand: product.brand,
              sku: product.sku,
              category_id: product.category_id,
              price: product.price,
              original_price: product.original_price,
              discount: product.discount,
              stock: product.stock,
              rating: product.rating,
              review_count: product.review_count,
              description: product.description,
              is_flagship: product.is_flagship,
              is_new: product.is_new,
              is_featured: product.is_featured,
              is_bestseller: product.is_bestseller,
              images: Array.isArray(product.images) ? product.images : [],
              sizes: product.sizes,
              colors: product.colors,
              tags: product.tags,
              status: product.status,
              duration_minutes: product.duration_minutes,
              booking_enabled: product.booking_enabled,
              option1_name: product.option1_name,
              option2_name: product.option2_name,
              option3_name: product.option3_name,
              option4_name: product.option4_name,
              options: Array.isArray(product.options) ? product.options : [],
              variants: Array.isArray(product.variants) ? product.variants : [],
              taxonomy_category_id: product.taxonomy_category_id || null,
              taxonomy_category_name: product.taxonomy_category_name || "",
              taxonomy_custom_category: product.taxonomy_custom_category || null,
              taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes : [],
              priced_attributes: Array.isArray(product.priced_attributes) ? product.priced_attributes : []
            })),
            categories: draftCatalog.categories.map(category => ({
              id: category.id,
              name: category.name,
              slug: category.slug,
              description: category.description,
              image: "",
              featured: category.featured
            })),
            store: { ...(draftCatalog.store || {}), id, name, title: name,
              website_theme_id: selectedTheme, element_edits: [] },
            pages: draftCatalog.pages || []
          };
          const result = await this.cloudflareRequest("/api/tenants", {
            method: "PUT",
            body: JSON.stringify({ id, name })
          }, "main", false, sessionToken);
          if (!result.tenant || !result.owner_token) {
            throw new Error("Cloudflare did not return the new website's private key.");
          }
          createdTenant = result.tenant;
          tenantOwnerToken = result.owner_token;
          initialCatalog.store = { ...store, id: result.tenant.id };
          const tenantQuery = `?tenant=${encodeURIComponent(result.tenant.id)}`;
          const publishedCatalog = await this.cloudflareRequest(`/api/catalog${tenantQuery}`, {
            method: "PUT",
            body: JSON.stringify(initialCatalog)
          }, result.tenant.id, false, result.owner_token);
          if (publishedCatalog.ok !== true || typeof publishedCatalog.updated_at !== "string") {
            throw new Error("Cloudflare did not confirm the new website catalog.");
          }
          let filledHtml;
          if (litrusMixerTheme) {
            if (typeof savedThemeDesign !== "string" ||
                !savedThemeDesign.includes('<meta name="eshop-filled-theme" content="litrus-mixer">')) {
              throw new Error("Publish the Litrus Mixer design from Preview before creating this website.");
            }
            filledHtml = savedThemeDesign;
          } else if (appEditableTheme) {
            const renderLiquidStorefront = window.EshopLiquidStorefront?.render;
            if (typeof renderLiquidStorefront !== "function") {
              throw new Error("My Own Theme's Liquid renderer is not ready.");
            }
            const draftSettingsKey = `liquid-theme-viewer:${this.getActiveTenant().id}:draft:${selectedTheme}`;
            let draftSettings = StudioRenderers.getWorkspaceSetting(draftSettingsKey, null);
            if (typeof draftSettings === "string") {
              try {
                draftSettings = JSON.parse(draftSettings);
              } catch (error) {
                throw new Error(`Saved My Own Theme settings are invalid: ${error.message}`);
              }
            }
            if (draftSettings !== null &&
                (!draftSettings || typeof draftSettings !== "object" || Array.isArray(draftSettings))) {
              throw new Error("Saved My Own Theme settings are invalid.");
            }
            const themeRoot = new URL("/liquid-themes/my-own-theme/", window.location.origin);
            filledHtml = await renderLiquidStorefront(initialCatalog, {
              baseUrl: `https://${result.tenant.hostname}/`,
              settings: draftSettings,
              loadFile: async path => {
                const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
                if (!response.ok) throw new Error(`Could not load My Own Theme file ${path} (${response.status}).`);
                return response.text();
              }
            });
          } else {
            const renderTheme = window.EshopLiquidHtmlThemeRenderer?.render;
            if (typeof renderTheme !== "function") {
              throw new Error(`${selectedThemeEntry.name}'s Liquid renderer is not ready.`);
            }
            const themeRoot = new URL(`/theme-packages/${selectedTheme}/`, window.location.origin);
            filledHtml = await renderTheme(selectedTheme, initialCatalog, {
              baseUrl: `https://${result.tenant.hostname}/`,
              loadFile: async path => {
                if (path === "index.html" && savedThemeDesign) return savedThemeDesign;
                const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
                if (!response.ok) {
                  throw new Error(`Could not load ${selectedThemeEntry.name} file ${path} (${response.status}).`);
                }
                return response.text();
              }
            });
          }
          const publishedTheme = await this.cloudflareRequest(`/api/theme-publish${tenantQuery}`, {
            method: "POST",
            body: JSON.stringify({
              theme_id: selectedTheme,
              catalog_updated_at: publishedCatalog.updated_at,
              html: filledHtml
            })
          }, result.tenant.id, false, result.owner_token);
          if (publishedTheme.ok !== true || publishedTheme.theme_id !== selectedTheme) {
            throw new Error("Cloudflare did not confirm the shop-specific storefront publish.");
          }
          storefrontPublished = true;
          this.setActiveTenantCatalog({ ...result.tenant, owner_token: result.owner_token }, {
            ...draftCatalog,
            owner_token: result.owner_token,
            store
          });
          if (savedThemeDesign) StudioRenderers.setWorkspaceSetting(
            `liquid-html-theme-draft:litrus-mixer:tenant:${result.tenant.id}`,
            savedThemeDesign
          );
          if (savedLitrusRecipe) StudioRenderers.setWorkspaceSetting(
            `litrus-mixer-recipe:tenant:${result.tenant.id}`,
            savedLitrusRecipe
          );
          const catalogs = this.tenantCatalogs();
          const temporaryIndex = catalogs.findIndex(item =>
            item.tenant_id === WEBSITE_BUILDER_DRAFT_TENANT_ID);
          if (temporaryIndex >= 0) catalogs.splice(temporaryIndex, 1);
          SQLiteEngine.save();
          if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
          await window.ShopSQLite.flush();
          window.localStorage.removeItem("ESHOP_NEW_WEBSITE_DRAFT_V1");
          window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
          window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY);
          AppUtils.showToast(`Website created at ${result.tenant.hostname}. It uses your app account's Paystack default.`);
          this.navigate(`/account/web/site?tenant=${encodeURIComponent(result.tenant.id)}`);
        } catch (error) {
          console.error("Website setup failed.", error);
          if (createdTenant && !storefrontPublished) {
            try {
              await this.cloudflareRequest(
                `/api/tenants/${encodeURIComponent(createdTenant.id)}`,
                { method: "DELETE" },
                createdTenant.id,
                false,
                tenantOwnerToken
              );
            } catch (cleanupError) {
              console.error("Could not remove the incomplete new website.", cleanupError);
              error.message = `${error.message || "Could not publish this website safely."} The website account was created but not fully published; do not share its address yet.`;
            }
          }
          if (error.status === 401) {
            window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
            window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
            window.localStorage.removeItem("ESHOP_ACCOUNT_EMAIL_V1");
            const continueTheme = params.get("theme") || websiteDraft.selected_theme;
            const continueTo = this.currentRoute().split("?")[0] + `?new=1&finish=1&theme=${encodeURIComponent(continueTheme)}`;
            const accountRoute = `/app-account?continue=${encodeURIComponent(continueTo)}`;
            this.navigate(accountRoute);
            return;
          }
          errorElement.textContent = error.message || "Could not set up this website.";
          errorElement.hidden = false;
          submitButton.disabled = false;
          submitButton.textContent = "Set up";
        }
      };
    }
    if (newWebsiteForm?.querySelector('[name="username"]')) {
      const authError = document.getElementById("shop-account-error");
      const passwordField = newWebsiteForm.elements.namedItem("password");
      const confirmField = newWebsiteForm.elements.namedItem("confirmPassword");
      const confirmContainer = document.getElementById("shop-password-confirm-field");
      const accountPanel = document.getElementById("shop-account-panel");
      let existingAccountSession = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
      const submitButton = newWebsiteForm.querySelector('button[type="submit"]');
      let turnstileWidgetId = null;
      let turnstileSetupStarted = false;
      let turnstileToken = "";
      if (existingAccountSession) {
        accountPanel.hidden = true;
        accountPanel.style.display = "none";
        accountPanel.querySelectorAll("input, button").forEach(control => { control.disabled = true; });
      }
      const setAuthMode = mode => {
        const registering = mode === "register";
        newWebsiteForm.dataset.authMode = registering ? "register" : "login";
        confirmContainer.hidden = !registering;
        const turnstileContainer = document.getElementById("shop-turnstile-widget");
        turnstileContainer.hidden = !registering;
        if (!registering) turnstileToken = "";
        confirmField.required = registering;
        confirmField.value = "";
        passwordField.autocomplete = registering ? "new-password" : "current-password";
        document.getElementById("shop-account-heading").textContent = registering ? "Create your account" : "Sign in";
        submitButton.textContent = registering ? "Create account & website" : "Sign in & create website";
        newWebsiteForm.querySelectorAll("[data-shop-auth-mode]").forEach(button => {
          const active = button.dataset.shopAuthMode === (registering ? "register" : "login");
          button.setAttribute("aria-pressed", String(active));
          button.className = active ? "btn-primary" : "btn-secondary";
        });
      };
      const getWorkerOrigin = () => this.cloudflareConnection("main").origin;
      const fetchAuth = async (path, body, sessionToken = "") => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let response;
        try {
          response = await fetch(new URL(path, getWorkerOrigin()), {
            method: body ? "POST" : "GET",
            headers: {
              ...(body ? { "Content-Type": "application/json" } : {}),
              ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal
          });
        } catch (error) {
          throw new Error(error.name === "AbortError"
            ? "Cloudflare account service took too long to respond. Check your connection and try again."
            : `Could not connect to Cloudflare account service. ${error.message || ""}`.trim());
        } finally {
          clearTimeout(timeout);
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(result.error || `Account service returned HTTP ${response.status}.`);
          error.status = response.status;
          throw error;
        }
        return result;
      };
      newWebsiteForm.querySelectorAll("[data-shop-auth-mode]").forEach(button => {
        button.onclick = () => {
          const registering = button.dataset.shopAuthMode === "register";
          setAuthMode(button.dataset.shopAuthMode);
          if (!registering) {
            turnstileToken = "";
            return;
          }
          if (turnstileWidgetId === null) void configureTurnstile();
          else window.turnstile?.reset(turnstileWidgetId);
        };
      });
      newWebsiteForm.querySelectorAll("[data-toggle-password]").forEach(button => {
        button.onclick = () => {
          const field = newWebsiteForm.elements.namedItem(button.dataset.togglePassword);
          if (!field) return;
          const visible = field.type === "password";
          field.type = visible ? "text" : "password";
          button.textContent = visible ? "Hide" : "Show";
          button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${button.dataset.togglePassword === "password" ? "password" : "confirm password"}`);
        };
      });
      setAuthMode("register");
      const configureTurnstile = async () => {
        if (turnstileWidgetId !== null || turnstileSetupStarted) return;
        turnstileSetupStarted = true;
        const widget = document.getElementById("shop-turnstile-widget");
        try {
          const config = await fetchAuth("/api/auth/config");
          if (!config.turnstile_site_key) throw new Error("Human verification is not configured yet. Please try again later.");
          if (!window.turnstile) {
            await new Promise((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
              script.async = true;
              script.defer = true;
              const timeout = setTimeout(() => reject(new Error("Cloudflare verification is taking too long to load. Check your connection and try again.")), 15000);
              script.onload = () => { clearTimeout(timeout); resolve(); };
              script.onerror = () => { clearTimeout(timeout); reject(new Error("Cloudflare human verification could not be loaded.")); };
              document.head.appendChild(script);
            });
          }
          turnstileWidgetId = window.turnstile.render(widget, {
            sitekey: config.turnstile_site_key,
            appearance: "always",
            callback(token) {
              turnstileToken = token;
              newWebsiteForm.elements.namedItem("turnstileToken").value = token;
            },
            "expired-callback"() {
              turnstileToken = "";
              newWebsiteForm.elements.namedItem("turnstileToken").value = "";
            },
            "error-callback"(code) {
              turnstileToken = "";
              newWebsiteForm.elements.namedItem("turnstileToken").value = "";
              widget.setAttribute("role", "alert");
              widget.textContent = `Cloudflare verification failed${code ? ` (${code})` : ""}. Check the site key and allowed hostnames, including localhost for Android.`;
            }
          });
        } catch (error) {
          widget.textContent = error.message || "Cloudflare human verification is unavailable.";
          widget.setAttribute("role", "alert");
          console.error("Turnstile could not be initialized.", error);
        } finally {
          turnstileSetupStarted = false;
        }
      };
      const checkExistingSession = async () => {
        if (!existingAccountSession) {
          if (newWebsiteForm.dataset.authMode === "register") void configureTurnstile();
          return;
        }
        submitButton.disabled = true;
        try {
          const session = await fetchAuth("/api/auth/session", null, existingAccountSession);
          window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", session.username || "");
          window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", session.email || "");
        } catch (error) {
          if (error.status === 401) {
            window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
            window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
            existingAccountSession = "";
            accountPanel.hidden = false;
            accountPanel.style.display = "grid";
            accountPanel.querySelectorAll("input, button").forEach(control => { control.disabled = false; });
            setAuthMode("login");
            authError.textContent = "Your account session expired. Sign in again to continue; you do not need to create another account.";
            authError.hidden = false;
          } else {
            authError.textContent = error.message || "Could not check your account session.";
            authError.hidden = false;
          }
        } finally {
          submitButton.disabled = false;
        }
      };
      setAuthMode("login");
      void checkExistingSession();
      newWebsiteForm.onsubmit = async event => {
        event.preventDefault();
        const websiteDraft = StudioRenderers.websiteBuilderDraft();
        if (!websiteDraft.categories.length) {
          this.navigate("/account/web/studio/websites/list");
          AppUtils.showToast("Add a category before creating a website.", "danger");
          return;
        }
        const formData = new FormData(newWebsiteForm);
        const name = String(formData.get("name") || "").trim();
        const id = String(formData.get("id") || "")
          .trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const username = String(formData.get("username") || "").trim().toLowerCase();
        const password = String(formData.get("password") || "");
        const confirmPassword = String(formData.get("confirmPassword") || "");
        const registering = newWebsiteForm.dataset.authMode === "register";
        authError.hidden = true;
        if (!name || !id || (!existingAccountSession && (!username || !password))) {
          authError.textContent = "Enter the shop name, website address, username, and password.";
          authError.hidden = false;
          return;
        }
        if (!existingAccountSession && registering && password !== confirmPassword) {
          authError.textContent = "The passwords do not match.";
          authError.hidden = false;
          return;
        }
        if (!existingAccountSession && registering && !turnstileToken) {
          authError.textContent = "Complete the Cloudflare checkbox above before creating your account.";
          authError.hidden = false;
          return;
        }
        submitButton.disabled = true;
        submitButton.textContent = existingAccountSession
          ? "Creating website…"
          : registering ? "Creating account…" : "Signing in…";
        try {
          const origin = getWorkerOrigin();
          const accountResult = existingAccountSession
            ? { ok: true, session_token: existingAccountSession, tenants: [] }
            : await fetchAuth(`/api/auth/${registering ? "register" : "login"}`, {
              username,
              password,
              ...(registering ? { turnstile_token: turnstileToken } : {})
            });
          if (!accountResult.ok || !accountResult.session_token) throw new Error("The account service did not create a secure session.");
          if (!existingAccountSession) {
            window.localStorage.setItem("ESHOP_ACCOUNT_SESSION_V1", accountResult.session_token);
            window.localStorage.setItem("ESHOP_ACCOUNT_USERNAME_V1", accountResult.username || username);
            window.localStorage.setItem("ESHOP_ACCOUNT_EMAIL_V1", accountResult.email || "");
          }
          await this.restoreAccountWebsites(accountResult.tenants, origin);
          submitButton.textContent = "Creating website…";
          throw new Error("Website creation is available only from the final setup form.");
        } catch (error) {
          console.error("Account or website creation failed.", error);
          if (!existingAccountSession && registering && error.status === 409) {
            setAuthMode("login");
            authError.textContent = "This account already exists. Sign in to attach the new website to your existing account.";
            authError.hidden = false;
            submitButton.disabled = false;
            submitButton.textContent = "Sign in & create website";
            return;
          }
          if (existingAccountSession && error.status === 401) {
            window.localStorage.removeItem("ESHOP_ACCOUNT_SESSION_V1");
            window.localStorage.removeItem("ESHOP_ACCOUNT_USERNAME_V1");
            existingAccountSession = "";
            accountPanel.hidden = false;
            accountPanel.style.display = "grid";
            accountPanel.querySelectorAll("input, button").forEach(control => { control.disabled = false; });
            setAuthMode("login");
          }
          authError.textContent = `${error.message || "Could not create the website."}${existingAccountSession ? " If your account session expired, sign in again from Account on the home screen." : ""}`;
          authError.hidden = false;
          turnstileToken = "";
          newWebsiteForm.elements.namedItem("turnstileToken").value = "";
          if (registering && turnstileWidgetId !== null) window.turnstile?.reset(turnstileWidgetId);
          submitButton.disabled = false;
          submitButton.textContent = existingAccountSession
            ? "Set up"
            : registering ? "Create account & website" : "Sign in & create website";
        }
      };
    }

    const loadHostedThemePreview = async (frame, theme, catalog, assetUrl = theme.preview_url) => {
      const themeUrl = new URL(assetUrl || "", window.location.origin);
      if (theme.studio_url || theme.editor_mode === "app" ||
          theme.editor_mode === "liquid-html") {
        const expectedAssetUrls = theme.id === "craft-main-storefront"
          ? [new URL("/liquid-themes/my-own-theme/studio.html", window.location.origin).href]
          : [new URL(`/theme-packages/${theme.id}/index.html`, window.location.origin).href];
        if (theme.studio_url && theme.id !== "craft-main-storefront") expectedAssetUrls.push(
          new URL(`/theme-packages/${theme.id}/studio.html`, window.location.origin).href);
        if (!expectedAssetUrls.includes(themeUrl.href)) {
          throw new Error("The selected local theme asset URL is invalid.");
        }
        const response = await fetch(themeUrl.href, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load the selected theme preview (${response.status}).`);
        let source = await response.text();
        const isThemeStudioAsset = Boolean(theme.studio_url &&
          themeUrl.href === new URL(theme.studio_url, window.location.origin).href);
        if (theme.editor_mode === "liquid-html" && !isThemeStudioAsset) {
          const renderTheme = window.EshopLiquidHtmlThemeRenderer?.render;
          if (typeof renderTheme !== "function") {
            throw new Error(`${theme.name}'s Liquid renderer is not ready.`);
          }
          const themeRoot = new URL(".", themeUrl).href;
          return renderTheme(theme.id, catalog, {
            baseUrl: themeRoot,
            loadFile: async path => {
              if (path === "index.html") return source;
              const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
              if (!response.ok) throw new Error(`Could not load ${theme.name} file ${path} (${response.status}).`);
              return response.text();
            }
          });
        }
        if (isThemeStudioAsset && theme.id === "craft-main-storefront") {
          const routeParams = new URLSearchParams(AppController.currentRoute().split("?")[1] || "");
          const viewerTenantId = AppController.getActiveTenant().id;
          const viewerSettingKey = `liquid-theme-viewer:${viewerTenantId}:${routeParams.get("new") === "1" ? "draft:" : ""}${theme.id}`;
          let savedSettings = StudioRenderers.getWorkspaceSetting(viewerSettingKey, null);
          if (typeof savedSettings === "string") {
            try {
              savedSettings = JSON.parse(savedSettings);
            } catch (error) {
              throw new Error(`Saved My Own Theme settings are invalid: ${error.message}`);
            }
          }
          if (savedSettings !== null &&
              (!savedSettings || typeof savedSettings !== "object" || Array.isArray(savedSettings))) {
            throw new Error("Saved My Own Theme settings are invalid.");
          }
          const config = JSON.stringify({
            embedded: true,
            key: viewerSettingKey,
            settings: savedSettings,
            catalog: {
              store: {
                name: String(catalog.store?.name || catalog.store?.title || ""),
                title: String(catalog.store?.title || ""),
                tagline: String(catalog.store?.tagline || ""),
                description: String(catalog.store?.description || ""),
                currency: String(catalog.store?.currency || "KES")
              },
              products: (Array.isArray(catalog.products) ? catalog.products : [])
                .filter(product => product && product.status !== "archived")
                .map(product => ({
                  name: String(product.name || ""),
                  description: String(product.description || ""),
                  price: Number(product.price ?? product.selling_price ?? product.sellingPrice ?? product.price_cents) || 0,
                  images: Array.isArray(product.images) ? product.images : [],
                  image: product.image || product.imageUri || product.image_uri || ""
                })),
              categories: (Array.isArray(catalog.categories) ? catalog.categories : [])
                .filter(category => category && category.status !== "archived" && category.published !== false)
                .map(category => ({
                  name: String(category.name || ""),
                  description: String(category.description || ""),
                  image: category.image || category.imageUri || category.image_uri || ""
                }))
            }
          }).replace(/</g, "\\u003c");
          const baseHref = new URL(".", themeUrl).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          const bootstrap = `<base href="${baseHref}"><script>window.EshopThemeViewerConfig=${config};document.documentElement.dataset.eshopEmbedded="true";<\/script>`;
          return source.replace(/<head\b[^>]*>/i, match => `${match}${bootstrap}`);
        }
        if (theme.editor_mode === "app" && !isThemeStudioAsset) {
          const { fillEditableStorefrontTheme, craftStudioAppearance } =
            await window.EshopThemeRuntime.loadEditableStorefrontTheme();
          let savedStudio = null;
          if (theme.id === "craft-main-storefront") {
            try {
              const raw = window.localStorage.getItem("craft.main-storefront.studio.v1");
              savedStudio = raw ? JSON.parse(raw) : null;
            } catch (error) {
              console.warn("Could not read saved Craft Studio theme settings.", error);
            }
          }
          const studioData = this.getActiveTenant().id === "main" && !draftEditor
            ? savedStudio
            : craftStudioAppearance(savedStudio);
          return fillEditableStorefrontTheme(
            source,
            catalog,
            themeUrl.href,
            studioData
          );
        }
        const scriptTagName = "scr" + "ipt";
        const configPattern = new RegExp(`(<${scriptTagName}\\b[^>]*\\bid=["']ff-config["'][^>]*>)([\\s\\S]*?)(<\\/${scriptTagName}>)`, "i");
        const configScript = source.match(configPattern);
        const siteDataPattern = new RegExp(`(<${scriptTagName}\\b[^>]*\\bid=["']ff-site-data["'][^>]*>)([\\s\\S]*?)(<\\/${scriptTagName}>)`, "i");
        const siteDataScript = source.match(siteDataPattern);
        if (!configScript || !siteDataScript) {
          const embeddedDataPattern = new RegExp(`(<${scriptTagName}\\b[^>]*\\bid=["'](?:data|embeddedData)["'][^>]*>)([\\s\\S]*?)(<\\/${scriptTagName}>)`, "i");
          const embeddedDataScript = source.match(embeddedDataPattern);
          if (!embeddedDataScript) throw new Error(`The ${theme.name} theme has no supported catalog data.`);
          const themeData = JSON.parse(embeddedDataScript[2]);
          const sourceCategories = Array.isArray(catalog.categories) ? catalog.categories : [];
          const safeId = (value, fallback) => String(value ?? fallback)
            .trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || String(fallback);
          const slugify = value => String(value || "").trim().toLocaleLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
          const uniqueSlug = (value, id, used) => {
            const base = slugify(value);
            const slug = used.has(base) ? `${base}-${slugify(id)}` : base;
            used.add(slug);
            return slug;
          };
          const usedCategorySlugs = new Set();
          const previewCategories = sourceCategories.map((category, index) => {
            const id = `eshop-category-${safeId(category.id, index + 1)}`;
            return {
              id,
              slug: uniqueSlug(category.slug || category.name, id, usedCategorySlugs),
              name: String(category.name || "Category"),
              description: String(category.description || ""),
              parentId: category.parent_id == null && category.parentId == null
                ? null
                : `eshop-category-${safeId(category.parent_id ?? category.parentId, "")}`,
              hue: Number(category.hue) || 200,
              media: String(category.image || category.media || ""),
              published: category.status !== "archived" && category.published !== false && category.published !== 0,
              position: Number(category.position) || index
            };
          });
          const categoryBySourceId = new Map(sourceCategories.map((category, index) =>
            [String(category.id), previewCategories[index]]));
          const categoryByName = new Map(previewCategories.map(category =>
            [category.name.trim().toLocaleLowerCase(), category]));
          const usedProductSlugs = new Set();
          const products = (Array.isArray(catalog.products) ? catalog.products : [])
            .filter(product => product && product.status !== "archived")
            .map((product, index) => {
              const id = `eshop-product-${safeId(product.id, index + 1)}`;
              const category = categoryBySourceId.get(String(product.category_id ?? product.categoryId ?? ""))
                || categoryByName.get(String(product.category_name || product.categoryName || product.category || "")
                  .trim().toLocaleLowerCase());
              const rawImage = product.images?.[0] || product.imageUri || product.image_uri || product.image || "";
              const image = typeof rawImage === "string" ? rawImage : rawImage?.url || rawImage?.src || "";
              const template = themeData.products?.[index] || {};
              return {
                ...template,
                id,
                slug: uniqueSlug(product.slug || product.name, id, usedProductSlugs),
                name: String(product.name || "Product"),
                description: String(product.description || ""),
                price: Number(product.price ?? product.selling_price ?? product.sellingPrice ?? product.price_cents) || 0,
                salePrice: Number(product.sale_price ?? product.salePrice) || null,
                stock: Math.max(0, Number(product.stock ?? product.stock_count) || 0),
                badge: String(product.badge || ""),
                featured: Boolean(product.featured ?? product.is_featured),
                published: product.status !== "archived" && product.published !== false && product.published !== 0,
                position: Number(product.position) || index,
                categoryIds: category ? [category.id] : [],
                hue: Number(product.hue ?? template.hue) || 200,
                media: String(image),
                dietary: Array.isArray(product.dietary) ? product.dietary : [],
                portion: String(product.portion || ""),
                colors: Array.isArray(product.colors) ? product.colors : [],
                sizes: Array.isArray(product.sizes) ? product.sizes : []
              };
            });
          const mergedThemeData = { ...themeData, categories: previewCategories, products };
          const safeThemeData = JSON.stringify(mergedThemeData).replace(/</g, "\\u003c");
          source = source.replace(embeddedDataScript[0],
            `${embeddedDataScript[1]}${safeThemeData}${embeddedDataScript[3]}`);
          const baseHref = new URL(".", themeUrl).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          return source.replace(/<head\b[^>]*>/i, match =>
            `${match}<base href="${baseHref}">`);
        }
        const storageConfig = JSON.parse(configScript[2]).storage || {};
        const baseSiteData = JSON.parse(siteDataScript[2]);
        let siteData = baseSiteData;
        if (storageConfig.siteKey) {
          const savedThemeSite = window.localStorage.getItem(storageConfig.siteKey);
          if (savedThemeSite) {
            const parsedThemeSite = JSON.parse(savedThemeSite);
            if (!parsedThemeSite || typeof parsedThemeSite !== "object" || Array.isArray(parsedThemeSite)) {
              throw new Error(`The saved ${theme.name} Studio settings are invalid.`);
            }
            siteData = { ...baseSiteData, ...parsedThemeSite };
          }
        }
        const themeStorageKeys = [storageConfig.siteKey, storageConfig.revisionKey]
          .filter(key => typeof key === "string" && key);
        if (theme.editor_mode === "app" && theme.id === "craft-main-storefront") {
          themeStorageKeys.push(
            "craft.main-storefront.studio.v1",
            "storefront.cart",
            "storefront.wishlist"
          );
        }
        const products = Array.isArray(catalog.products) ? catalog.products : [];
        const savedTemplates = Array.isArray(siteData.products) ? siteData.products : [];
        const templates = savedTemplates.length
          ? savedTemplates
          : (Array.isArray(baseSiteData.products) ? baseSiteData.products : []);
        if (products.length && !templates.length) throw new Error(`The ${theme.name} storefront has no product template.`);
        const previewIds = products.map((product, index) =>
          templates[index]?.id ?? `eshop-preview-${index + 1}`);
        const toSlug = value => String(value || "").trim().toLocaleLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
        const previewCategories = Array.isArray(catalog.categories) ? catalog.categories : [];
        siteData.categories = previewCategories.map((category, index) => ({
          id: `eshop-category-${index + 1}`,
          name: String(category.name || "Category"),
          slug: toSlug(category.name),
          description: ""
        }));
        const previewCategoryById = new Map(previewCategories.map((category, index) =>
          [String(category.id), siteData.categories[index]]));
        siteData.products = products.map((product, index) => {
          const template = templates[index % templates.length];
          const productCategoryId = product.category_id ?? product.categoryId;
          const productCategoryName = String(
            product.category_name || product.categoryName || product.category || ""
          ).toLocaleLowerCase();
          const categoryIndex = previewCategoryById.has(String(productCategoryId))
            ? previewCategories.findIndex(item => String(item.id) === String(productCategoryId))
            : previewCategories.findIndex(item => String(item.name).toLocaleLowerCase() === productCategoryName);
          const category = categoryIndex >= 0 ? siteData.categories[categoryIndex] : null;
          const rawImage = product.images?.[0] || product.imageUri || product.image_uri || product.image || "";
          const image = typeof rawImage === "string" ? rawImage : rawImage?.url || rawImage?.src || "";
          return {
            ...template,
            id: previewIds[index],
            slug: toSlug(product.name),
            name: String(product.name || "Product"),
            brand: String(product.brand || ""),
            price: Number(product.price ?? product.price_cents ?? template.price) || 0,
            comparePrice: null,
            description: String(product.description || ""),
            category: category ? toSlug(category.name) : "",
            subcategories: [],
            rating: 0,
            reviewCount: 0,
            badge: "",
            attributes: {},
            colors: [],
            sizes: [],
            reviews: [],
            specs: [],
            materials: [],
            technology: [],
            careGuide: "",
            fitAdvice: "",
            unit: "",
            coveragePerUnit: null,
            weightKg: null,
            leadTimeDays: null,
            assemblyRequired: false,
            assemblyFee: null,
            bulkTiers: [],
            warranty: "",
            whatsInTheBox: [],
            highlights: [],
            stock: Math.max(0, Number(product.stock) || 0),
            image,
            gallery: image ? [image] : []
          };
        });
        const originalIds = new Map(templates.map((product, index) =>
          [String(product.id), previewIds[index % previewIds.length] || ""]));
        const rewriteProductRefs = (value, key = "") => {
          if (Array.isArray(value)) {
            if (/productids$/i.test(key)) return [...previewIds];
            return value.map(item => rewriteProductRefs(item));
          }
          if (value && typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([childKey, child]) =>
              [childKey, rewriteProductRefs(child, childKey)]));
          }
          if (typeof value === "string" && /productid$/i.test(key)) {
            return originalIds.get(value) ?? previewIds[0] ?? "";
          }
          return value;
        };
        siteData.sections = rewriteProductRefs(siteData.sections);
        source = source.replace(siteDataScript[0],
          `${siteDataScript[1]}${JSON.stringify(siteData)}${siteDataScript[3]}`);
        const baseHref = new URL(".", themeUrl).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const base = `<base href="${baseHref}">`;
        const studioStorageRead = isThemeStudioAsset ? "get.call(this,key)" : "null";
        const isolatedStorage = theme.studio_url
          ? "<scr" + "ipt>(()=>{const p=Storage.prototype;const get=p.getItem;const set=p.setItem;const remove=p.removeItem;const allowed=new Set(" + JSON.stringify(themeStorageKeys) + ");const siteKey=" + JSON.stringify(storageConfig.siteKey || "") + ";window.addEventListener('storage',event=>{if(event.key===siteKey)event.stopImmediatePropagation()},true);p.getItem=function(key){if(String(key)===siteKey)return " + studioStorageRead + ";return allowed.has(String(key))?get.call(this,key):null};p.setItem=function(key,value){if(allowed.has(String(key)))set.call(this,key,value)};p.removeItem=function(key){if(allowed.has(String(key)))remove.call(this,key)};p.clear=()=>{}})();<\/scr" + "ipt>"
          : "<scr" + "ipt>(()=>{const storage=Storage.prototype;storage.getItem=()=>null;storage.setItem=()=>{};storage.removeItem=()=>{};storage.clear=()=>{}})();<\/scr" + "ipt>";
        const srcdocUrlShim = "<scr" + "ipt>(()=>{const NativeURL=window.URL;window.URL=class extends NativeURL{constructor(input,base){super(input,base===\"null\"?document.baseURI:base)}}})();<\/scr" + "ipt>";
        return /<head\b[^>]*>/i.test(source)
          ? source.replace(/<head\b[^>]*>/i, match => `${match}${base}${isolatedStorage}${srcdocUrlShim}`)
          : `${base}${isolatedStorage}${srcdocUrlShim}${source}`;
      }
      if (themeUrl.origin !== "https://eshop-storefront.ryanrobin07-ek.workers.dev" ||
          themeUrl.pathname !== `/themes/${theme.id}/index.html` ||
          !/^[a-z0-9][a-z0-9-]{0,63}$/.test(theme.id)) {
        throw new Error("The selected theme URL is invalid.");
      }
      const { fillThemeForShop } = await window.EshopThemeRuntime.loadThemeSkeleton();
      const filledHtml = await fillThemeForShop(theme.id, catalog, {
        baseHref: themeUrl.href
      });
      const apiGuard = `<script>(()=>{const blocked=path=>/^\\/api\\//.test(path);const deny=()=>Promise.reject(new Error("Live website APIs are disabled in editor preview."));const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input.url,document.baseURI);return blocked(url.pathname)?deny():originalFetch(input,init)};const originalOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){if(blocked(new URL(url,document.baseURI).pathname))throw new DOMException("Live website APIs are disabled in editor preview.","AbortError");return originalOpen.call(this,method,url,...args)};const beacon=navigator.sendBeacon?.bind(navigator);if(beacon)navigator.sendBeacon=(url,...args)=>blocked(new URL(url,document.baseURI).pathname)?false:beacon(url,...args)})();<\/script>`;
      return filledHtml.replace(/<head\b[^>]*>/i, match => `${match}${apiGuard}`);
    };
    const themePreviewFrames = [...document.querySelectorAll("[data-theme-storefront-preview]")]
      .filter(frame => frame.dataset.themePreviewDirect !== "1");
    const themePreviewQueue = [];
    const routedHostedPreviewDocuments = new WeakSet();
    let activeThemePreviewLoads = 0;
    const pumpThemePreviewQueue = () => {
      while (activeThemePreviewLoads < 2 && themePreviewQueue.length) {
        const frame = themePreviewQueue.shift();
        if (!frame.isConnected) continue;
        activeThemePreviewLoads += 1;
        void (async () => {
          try {
            const theme = StudioRenderers.websiteThemes().find(item =>
              item.id === frame.dataset.themeStorefrontPreview &&
              (item.preview_url === frame.dataset.themePreviewRemote ||
                item.studio_url === frame.dataset.themePreviewRemote));
            if (!theme) throw new Error("The selected theme preview is unavailable.");
            const draft = StudioRenderers.websiteBuilderDraft();
            const html = await loadHostedThemePreview(frame, theme, {
              products: draft.products,
              categories: draft.categories,
              store: { name: "Your new website", title: "Your new website", currency: "KES" },
              pages: []
            }, frame.dataset.themePreviewRemote);
            if (!frame.isConnected) return;
            frame.dataset.themePreviewLoaded = "1";
            frame.srcdoc = html;
          } catch (error) {
            console.error("Could not load the hosted theme preview.", error);
            const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
            if (placeholder) placeholder.textContent = error.message || "Filled theme preview unavailable.";
          } finally {
            activeThemePreviewLoads -= 1;
            pumpThemePreviewQueue();
          }
        })();
      }
    };
    themePreviewFrames.forEach(frame => {
      frame.addEventListener("load", () => {
        if (frame.dataset.themePreviewLoaded !== "1" ||
            frame.contentDocument?.URL !== "about:srcdoc") return;
        const previewDocument = frame.contentDocument;
        const previewWindow = frame.contentWindow;
        if (previewDocument && previewWindow && !routedHostedPreviewDocuments.has(previewDocument)) {
          routedHostedPreviewDocuments.add(previewDocument);
          previewDocument.addEventListener("click", event => {
            const target = event.target?.closest?.("a[href]");
            const href = target?.getAttribute("href")?.trim();
            if (!href?.startsWith("#/")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            previewWindow.location.hash = href;
          }, true);
        }
        frame.style.visibility = "visible";
        const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
        if (placeholder) placeholder.hidden = true;
      });
    });
    if (themePreviewFrames.length && typeof IntersectionObserver === "function") {
      const themePreviewObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const frame = entry.target;
          if (!entry.isIntersecting || frame.dataset.themePreviewQueued === "1") return;
          themePreviewObserver.unobserve(frame);
          frame.dataset.themePreviewQueued = "1";
          themePreviewQueue.push(frame);
        });
        pumpThemePreviewQueue();
      }, { rootMargin: "300px 0px" });
      themePreviewFrames.forEach(frame => {
        if (frame.dataset.themePreviewRemote) themePreviewObserver.observe(frame);
        else {
          const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
          if (placeholder) placeholder.textContent = "Theme preview unavailable.";
        }
      });
    } else {
      themePreviewFrames.forEach(frame => {
        const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
        if (placeholder) placeholder.textContent = "Theme preview is unavailable in this browser.";
      });
    }



    // 1. Hero Carousel Setup
    const heroSection = document.getElementById("hero-carousel");
    if (heroSection) {
      this.initHeroCarousel();
    }

    // 2. Search dropdown wiring
    this.initSearchInputs();

    // 3. Category filters
    this.initCategoryFilters();

    // 4. Product detail interactions
    this.initProductDetail();

    // 5. Checkout forms
    this.initCheckoutForm();
    this.initPaystackReturn();

    const newsletterForm = document.getElementById("web-newsletter-signup");
    if (newsletterForm) {
      newsletterForm.querySelector("[data-enable-notifications]")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        const status = newsletterForm.querySelector('[role="status"]');
        button.disabled = true;
        try {
          const message = await window.BusinessNotifications.enable(this.getActiveTenant().id);
          if (status) status.textContent = message;
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not enable notifications.";
        } finally {
          button.disabled = false;
        }
      });
      newsletterForm.querySelector("[data-disable-notifications]")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        const status = newsletterForm.querySelector('[role="status"]');
        button.disabled = true;
        try {
          const message = await window.BusinessNotifications.disable(this.getActiveTenant().id);
          if (status) status.textContent = message;
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "Could not turn notifications off.";
        } finally {
          button.disabled = false;
        }
      });
      newsletterForm.addEventListener("submit", async event => {
        event.preventDefault();
        const status = newsletterForm.querySelector('[role="status"]');
        const button = newsletterForm.querySelector('button[type="submit"]');
        const email = String(new FormData(newsletterForm).get("email") || "").trim().toLocaleLowerCase();
        if (button) button.disabled = true;
        if (status) status.textContent = "";
        try {
          const tenantId = this.getActiveTenant().id;
          const result = await this.cloudflareRequest(
            `/api/newsletter/subscribe?tenant=${encodeURIComponent(tenantId)}`,
            { method: "POST", body: JSON.stringify({ email, consent: true }) },
            tenantId,
            true
          );
          newsletterForm.reset();
          if (status) status.textContent = result.subscribed
            ? "This email is already subscribed."
            : "Check your email for a confirmation link to finish subscribing.";
        } catch (error) {
          console.error("Newsletter subscription could not be sent.", error);
          if (status) status.textContent = error instanceof Error ? error.message : "Could not send the subscription request.";
        } finally {
          if (button) button.disabled = false;
        }
      });
    }

    // 6. Studio editor modals & inputs
    this.initStudioModals();

    if (path === "/account" || path === "/account/main-shop" || path.startsWith("/account/main-shop/") || path === "/account/dashboard" || path.startsWith("/account/customers") || path === "/account/payments" || path === "/account/web" || path.startsWith("/account/web/studio/") || path.startsWith("/store/")) {
      void StudioRenderers.loadMainShopWorkspace(path);
    }

    const inventorySearch = document.getElementById("inventory-search");
    if (inventorySearch) {
      inventorySearch.oninput = () => {
        const query = inventorySearch.value.trim().toLowerCase();
        document.querySelectorAll(".inventory-item").forEach(item => {
          item.hidden = !item.dataset.search.includes(query);
        });
      };
    }
  },

  initHeroCarousel() {
    const slides = document.querySelectorAll(".hero-slide");
    const dots = document.querySelectorAll(".hero-dot");
    const prevBtn = document.getElementById("hero-prev");
    const nextBtn = document.getElementById("hero-next");
    const carousel = document.getElementById("hero-carousel");
    if (!slides.length) return;

    this.carouselIndex = 0;
    const showSlide = (idx) => {
      this.carouselIndex = (idx + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("active", i === this.carouselIndex));
      dots.forEach((d, i) => d.classList.toggle("active", i === this.carouselIndex));
    };

    if (prevBtn) prevBtn.onclick = () => showSlide(this.carouselIndex - 1);
    if (nextBtn) nextBtn.onclick = () => showSlide(this.carouselIndex + 1);

    dots.forEach((dot, i) => {
      dot.onclick = () => showSlide(i);
    });

    const startAuto = () => {
      if (this.carouselTimer) clearInterval(this.carouselTimer);
      this.carouselTimer = setInterval(() => {
        showSlide(this.carouselIndex + 1);
      }, 5500);
    };

    startAuto();

    if (carousel) {
      carousel.addEventListener("mouseenter", () => {
        if (this.carouselTimer) clearInterval(this.carouselTimer);
      });
      carousel.addEventListener("mouseleave", () => {
        startAuto();
      });
    }
  },

  initSearchInputs() {
    const input = document.getElementById("navbar-search-input");
    const dropdown = document.getElementById("search-quick-dropdown");
    if (!input || !dropdown) return;

    let debounceTimer = null;
    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const q = e.target.value.trim();
      if (q.length < 2) {
        dropdown.classList.remove("active");
        dropdown.innerHTML = "";
        return;
      }
      debounceTimer = setTimeout(() => {
        const results = SQLiteEngine.getProducts({ query: q, limit: 5 }).items;
        if (!results.length) {
          dropdown.innerHTML = `<div style="padding: 16px; font-size: 0.8125rem; color: var(--text-muted); text-align: center;">No pieces found for "${AppUtils.escapeHTML(q)}"</div>`;
        } else {
          dropdown.innerHTML = `
            ${results.map(p => `
              <a href="/product/${p.slug}" class="search-result-item" data-route="/product/${p.slug}">
                <img src="${p.images && p.images[0] ? p.images[0] : ''}" alt="" class="search-result-thumb">
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 0.875rem;">${AppUtils.escapeHTML(p.name)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${AppUtils.escapeHTML(p.brand)} &bull; ${AppUtils.formatMoney(p.price)}</div>
                </div>
              </a>
            `).join("")}
            <a href="/search?q=${encodeURIComponent(q)}" class="search-result-item" data-route="/search?q=${encodeURIComponent(q)}" style="font-weight: 600; font-size: 0.8125rem; justify-content: center; background: var(--surface-subtle);">
              View all results for "${AppUtils.escapeHTML(q)}" &rarr;
            </a>
          `;
        }
        dropdown.classList.add("active");
      }, 180);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = input.value.trim();
        dropdown.classList.remove("active");
        if (q) this.navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-box")) {
        dropdown.classList.remove("active");
      }
    });
  },

  initCategoryFilters() {
    const sortSelect = document.getElementById("cat-sort-select");
    const priceFilter = document.getElementById("cat-price-filter");
    const stockFilter = document.getElementById("cat-stock-filter");
    const resetBtn = document.getElementById("reset-cat-filters");

    const apply = () => {
      const path = this.currentRoute().split("?")[0];
      const params = new URLSearchParams();
      if (new URLSearchParams(this.currentRoute().split("?")[1] || "").get("studio") === "1") params.set("studio", "1");
      if (sortSelect && sortSelect.value !== "featured") params.set("sort", sortSelect.value);
      if (priceFilter && priceFilter.value) {
        if (priceFilter.value === "0-200") params.set("maxPrice", "200");
        else if (priceFilter.value === "200-500") { params.set("minPrice", "200"); params.set("maxPrice", "500"); }
        else if (priceFilter.value === "500-1000") { params.set("minPrice", "500"); params.set("maxPrice", "1000"); }
        else if (priceFilter.value === "1000+") params.set("minPrice", "1000");
      }
      if (stockFilter && stockFilter.checked) params.set("inStock", "1");
      const qs = params.toString();
      this.navigate(path + (qs ? `?${qs}` : ""));
    };

    if (sortSelect) sortSelect.onchange = apply;
    if (priceFilter) priceFilter.onchange = apply;
    if (stockFilter) stockFilter.onchange = apply;
    if (resetBtn) resetBtn.onclick = () => {
      const path = this.currentRoute().split("?")[0];
      const isStudioView = new URLSearchParams(this.currentRoute().split("?")[1] || "").get("studio") === "1";
      this.navigate(path + (isStudioView ? "?studio=1" : ""));
    };
  },

  initProductDetail() {
    // Gallery Thumbnails
    const thumbs = document.querySelectorAll("[data-action='switch-thumb']");
    const mainImg = document.getElementById("main-product-img");
    thumbs.forEach(btn => {
      btn.onclick = () => {
        thumbs.forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        const src = btn.getAttribute("data-src");
        if (mainImg && src) mainImg.src = src;
      };
    });

    // Option Chips
    document.querySelectorAll(".options-chips .option-chip").forEach(chip => {
      chip.onclick = () => {
        const parent = chip.parentElement;
        if (parent) {
          parent.querySelectorAll(".option-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
        }
        const productId = Number(document.getElementById("btn-add-to-bag")?.getAttribute("data-id"));
        const product = productId ? SQLiteEngine.getProductById(productId) : null;
        if (!product) return;
        const value1 = document.querySelector("#product-size-chips .option-chip.active")?.getAttribute("data-val") || "";
        const value2 = document.querySelector("#product-color-chips .option-chip.active")?.getAttribute("data-val") || "";
        const variant = (product.variants || []).find(item =>
          (item.option1_value ?? item.size ?? "") === value1 &&
          (item.option2_value ?? item.color ?? "") === value2);
        const price = document.querySelector(".product-price-box .price-current");
        if (price) price.textContent = AppUtils.formatMoney(variant?.price ?? product.price);
        const stock = document.getElementById("product-stock-status");
        if (stock) {
          const quantity = Number(variant?.stock ?? product.stock);
          stock.textContent = quantity > 10
            ? "In Stock (Ready to dispatch)"
            : quantity > 0 ? `Low Stock (${quantity} units remain)` : "Sold Out";
          stock.style.color = quantity > 0 ? "var(--success)" : "var(--danger)";
        }
      };
    });

    // Quantity Stepper
    const qtyInput = document.getElementById("prod-qty-input");
    const btnInc = document.getElementById("prod-qty-inc");
    const btnDec = document.getElementById("prod-qty-dec");
    if (qtyInput && btnInc && btnDec) {
      btnInc.onclick = () => { qtyInput.value = Math.min(20, (Number(qtyInput.value) || 1) + 1); };
      btnDec.onclick = () => { qtyInput.value = Math.max(1, (Number(qtyInput.value) || 1) - 1); };
    }

    // Add to Bag Button
    const btnAdd = document.getElementById("btn-add-to-bag");
    if (btnAdd) {
      btnAdd.onclick = () => {
        const prodId = Number(btnAdd.getAttribute("data-id"));
        const qty = Number(qtyInput ? qtyInput.value : 1);
        const activeSize = document.querySelector("#product-size-chips .option-chip.active");
        const activeColor = document.querySelector("#product-color-chips .option-chip.active");
        if (!SQLiteEngine.addToCart(prodId, qty, activeSize ? activeSize.getAttribute("data-val") : null, activeColor ? activeColor.getAttribute("data-val") : null)) return;
        AppUtils.showToast("Artifact added to your shopping bag");
        this.updateNavBadges();
      };
    }

    // Buy Now Button
    const btnBuyNow = document.getElementById("btn-buy-now");
    if (btnBuyNow) {
      btnBuyNow.onclick = () => {
        const prodId = Number(btnBuyNow.getAttribute("data-id"));
        const qty = Number(qtyInput ? qtyInput.value : 1);
        const activeSize = document.querySelector("#product-size-chips .option-chip.active");
        const activeColor = document.querySelector("#product-color-chips .option-chip.active");
        if (!SQLiteEngine.addToCart(prodId, qty, activeSize ? activeSize.getAttribute("data-val") : null, activeColor ? activeColor.getAttribute("data-val") : null)) return;
        this.navigate("/checkout");
      };
    }

    // Accordions
    document.querySelectorAll(".accordion-trigger").forEach(trig => {
      trig.onclick = () => {
        const targetId = "acc-" + trig.getAttribute("data-accordion");
        const body = document.getElementById(targetId);
        if (body) {
          const isOpen = body.classList.contains("active");
          body.classList.toggle("active", !isOpen);
          trig.querySelector("span:last-child").textContent = isOpen ? "+" : "−";
        }
      };
    });
  },

  initCheckoutForm() {
    const form = document.getElementById("checkout-main-form");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton?.disabled) return;
        const submitLabel = submitButton?.textContent || "";
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Submitting order…";
        }
        const formData = new FormData(form);
        const cart = SQLiteEngine.getCart();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = 0;
        const discount = 0;
        const total = subtotal;
        const tenantId = this.getActiveTenant().id;

        const orderData = {
          tenant_id: tenantId,
          customer_name: `${formData.get("firstName")} ${formData.get("lastName")}`.trim(),
          customer_email: formData.get("email"),
          customer_phone: formData.get("phone"),
          shipping_address: "",
          city: "",
          postal_code: "",
          country: "",
          payment_method: "Unpaid order",
          subtotal,
          discount,
          shipping,
          total
        };

        const idempotencyKey = crypto.randomUUID();
        let holdIds = [];
        try {
          const storedHolds = JSON.parse(window.localStorage.getItem(`eshop-holds:${location.host}`) || "[]");
          const cartProductIds = new Set(cart.map(item => String(item.product_id)));
          const orderName = orderData.customer_name.replace(/\s+/g, " ").toLocaleLowerCase();
          const orderEmail = String(orderData.customer_email || "").trim().toLocaleLowerCase();
          const orderPhone = String(orderData.customer_phone || "").replace(/\D/g, "");
          if (Array.isArray(storedHolds)) {
            holdIds = storedHolds.filter(hold => hold && typeof hold.id === "string"
              && cartProductIds.has(String(hold.product_id))
              && Date.parse(hold.expires_at) > Date.now()
              && String(hold.customer_name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase() === orderName
              && (String(hold.contact || "").includes("@")
                ? String(hold.contact).trim().toLocaleLowerCase() === orderEmail
                : String(hold.contact || "").replace(/\D/g, "") === orderPhone)).map(hold => hold.id);
          }
        } catch (error) {
          console.warn("Product holds could not be attached to the storefront order.", error);
        }
        const orderPayload = {
          idempotency_key: idempotencyKey,
          customer_name: orderData.customer_name,
          customer_email: orderData.customer_email,
          customer_phone: orderData.customer_phone,
          hold_ids: holdIds,
          items: cart.map(item => ({ product_id: item.product_id, quantity: Number(item.quantity || 1) }))
        };
        let serverOrder = null;
        let orderSyncPending = false;
        try {
          const response = await window.EshopInventoryBridge.createStorefrontOrder(tenantId, orderPayload);
          serverOrder = response.order;
          orderData.order_number = serverOrder.order_number;
          orderData.total = serverOrder.total;
          orderData.subtotal = serverOrder.subtotal;
          orderData.discount = serverOrder.discount;
          orderData.shipping = serverOrder.shipping;
          orderData.payment_status = serverOrder.payment_status;
          orderData.status = serverOrder.status;
          orderData.created_at = serverOrder.created_at;
          orderData.currency = serverOrder.currency;
        } catch (error) {
          const canRetry = navigator.onLine === false || error?.status === 404 || error?.status >= 500
            || error instanceof TypeError || error?.name === "AbortError";
          if (!canRetry) {
            AppUtils.showToast(error instanceof Error ? error.message : "The shop could not accept this order.", "danger");
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = submitLabel;
            }
            return;
          }
          orderData.order_number = `ORD-${idempotencyKey.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
          orderSyncPending = true;
          const pendingKey = `ESHOP_PENDING_STOREFRONT_ORDERS_V1:${encodeURIComponent(tenantId)}`;
          const pending = JSON.parse(window.localStorage.getItem(pendingKey) || "[]");
          pending.push({ idempotency_key: idempotencyKey, payload: orderPayload, local_order_number: orderData.order_number });
          window.localStorage.setItem(pendingKey, JSON.stringify(pending.slice(-100)));
          console.warn("Storefront order saved locally and queued for server sync.", error);
        }
        const orderItems = serverOrder
          ? serverOrder.items.map(item => ({
            product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.unit_price
          }))
          : cart;
        orderData.status ||= "pending";
        const created = SQLiteEngine.createOrder(orderData, orderItems);
        await window.ShopSQLite.flush();
        if (serverOrder && !orderSyncPending) {
          try {
            const payment = await window.EshopInventoryBridge.initializeStorefrontPayment(tenantId, serverOrder.order_number);
            window.location.assign(payment.authorization_url);
            return;
          } catch (error) {
            AppUtils.showToast(
              `Order saved unpaid. ${error instanceof Error ? error.message : "Paystack checkout could not start."}`,
              "danger"
            );
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = submitLabel;
            }
            this.navigate(`/checkout/confirmation?orderId=${created.order_number}`);
            return;
          }
        }
        AppUtils.showToast(orderSyncPending
          ? "Unpaid order saved on this device and queued to sync when internet returns."
          : "Unpaid order saved with the shop. No payment has been collected.");
        this.navigate(`/checkout/confirmation?orderId=${created.order_number}`);
      };
    }
  },

  async initPaystackReturn() {
    const [path, queryString] = this.currentRoute().split("?");
    if (path !== "/checkout/confirmation") return;
    const params = new URLSearchParams(queryString || "");
    const reference = params.get("reference");
    const status = document.querySelector("[data-payment-status]");
    const retryButton = document.querySelector("[data-paystack-retry]");
    retryButton?.addEventListener("click", async () => {
      retryButton.disabled = true;
      retryButton.textContent = "Opening secure payment…";
      try {
        const orderNumber = params.get("orderId");
        const order = SQLiteEngine.getOrder(orderNumber);
        if (!orderNumber || !order) throw new Error("Order details are not available on this device.");
        const payment = await window.EshopInventoryBridge.initializeStorefrontPayment(
          order.tenant_id || this.getActiveTenant().id, orderNumber
        );
        window.location.assign(payment.authorization_url);
      } catch (error) {
        retryButton.disabled = false;
        retryButton.textContent = "Continue to secure payment";
        if (status) status.textContent = error instanceof Error ? error.message : "Paystack checkout could not start.";
      }
    });
    if (!reference) return;
    if (status) status.textContent = "Checking payment with Paystack…";
    try {
      const result = await window.EshopInventoryBridge.verifyStorefrontPayment(
        params.get("tenant") || this.getActiveTenant().id, reference
      );
      let localOrder = SQLiteEngine.getOrder(result.order_number);
      if (!localOrder && result.order) {
        const remoteOrder = result.order;
        localOrder = SQLiteEngine.insert("orders", {
          tenant_id: result.tenant_id,
          order_number: remoteOrder.order_number,
          customer_name: remoteOrder.customer_name,
          customer_email: remoteOrder.customer_email,
          customer_phone: remoteOrder.customer_phone,
          total: remoteOrder.total,
          subtotal: remoteOrder.subtotal,
          discount: remoteOrder.discount,
          shipping: 0,
          currency: remoteOrder.currency,
          payment_method: result.payment_status === "paid" ? "Paystack" : "Paystack payment pending",
          payment_status: result.payment_status,
          status: result.payment_status === "paid" ? "paid" : remoteOrder.status,
          created_at: remoteOrder.created_at,
          items: remoteOrder.items.map(item => ({
            product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.unit_price
          }))
        });
        await window.ShopSQLite.flush();
        this.handleRoute(this.currentRoute(), false);
        return;
      }
      SQLiteEngine.update("orders", order => order.order_number === result.order_number
        && (!result.tenant_id || !order.tenant_id || order.tenant_id === result.tenant_id), order => ({
        ...order,
        ...(result.payment_status === "paid" ? { status: "paid", payment_method: "Paystack" } : {}),
        payment_status: result.payment_status
      }));
      if (result.payment_status === "paid") {
        await window.ShopSQLite.flush();
        if (status) status.textContent = "Payment confirmed by Paystack";
      } else if (status) {
        status.textContent = result.payment_status === "failed"
          ? "Payment was not confirmed. No payment has been recorded."
          : "Payment is pending confirmation.";
      }
      if (result.payment_status !== "paid") await window.ShopSQLite.flush();
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Payment confirmation is not available yet.";
    }
  },

  async uploadCatalogImage(image, apiUrl, tenant, token, onStored) {
    if (typeof image !== "string" || !image) return image || "";
    const isDataImage = /^data:image\//i.test(image);
    let imageSource = image;
    if (!isDataImage) {
      if (image.startsWith("/")) return image;
      let sourceUrl;
      try {
        sourceUrl = new URL(image);
      } catch {
        return image;
      }
      if (!["http:", "https:"].includes(sourceUrl.protocol)) return image;
      const tenantHostname = String(tenant.hostname || "").toLowerCase();
      const isRrobinDomain = sourceUrl.hostname === "rrobin.co.ke" ||
        sourceUrl.hostname.endsWith(".rrobin.co.ke");
      if (isRrobinDomain || sourceUrl.hostname === tenantHostname) return image;
      imageSource = sourceUrl.href;
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(imageSource));
    const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const cacheKey = `ESHOP_CATALOG_MEDIA_UPLOADS_V1:${tenant.id}`;
    let uploadedMedia = {};
    try {
      const savedMedia = window.localStorage.getItem(cacheKey);
      uploadedMedia = savedMedia ? JSON.parse(savedMedia) : {};
    } catch (error) {
      console.warn("Previously uploaded catalog image cache could not be read; image may be uploaded again.", error);
    }
    if (!uploadedMedia || typeof uploadedMedia !== "object" || Array.isArray(uploadedMedia)) uploadedMedia = {};
    const cachedUrl = uploadedMedia[fingerprint];
    if (typeof cachedUrl === "string") {
      try {
        const cachedPublicUrl = new URL(cachedUrl);
        if (cachedPublicUrl.protocol === "https:" && cachedPublicUrl.pathname.startsWith(`/media/${tenant.id}/`)) {
          if (onStored) onStored({ reused: true });
          return cachedPublicUrl.href;
        }
      } catch (error) {
        console.warn("Cached catalog image URL is invalid; uploading the image again.", error);
      }
    }
    const source = await fetch(imageSource, isDataImage
      ? undefined
      : { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!source.ok) throw new Error("A saved product image could not be read for publishing.");
    const sourceBlob = await source.blob();
    if (!sourceBlob.type.startsWith("image/")) {
      throw new Error("The product image URL did not return an image.");
    }
    const compressedDataUrl = await AppUtils.compressImageFile(
      new File([sourceBlob], "catalog-image", { type: sourceBlob.type }),
      // Catalogue photos are what a customer pins and zooms on a modern phone screen, so they are
      // kept at 1600px. The small copy baked into the published HTML is made separately by the editor.
      { maxDimension: 1600, maxBytes: 2_800_000 }
    );
    const compressedResponse = await fetch(compressedDataUrl);
    if (!compressedResponse.ok) throw new Error("A compressed product image could not be prepared for publishing.");
    const compressedBlob = await compressedResponse.blob();
    const endpoint = new URL("/api/media", apiUrl.origin);
    endpoint.searchParams.set("tenant", tenant.id);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": compressedBlob.type
      },
      body: compressedBlob
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(responseText || `Cloudflare image upload returned HTTP ${response.status}.`);
    }
    if (!response.ok || result.ok !== true || typeof result.url !== "string") {
      throw new Error(result.error || `Cloudflare image upload returned HTTP ${response.status}.`);
    }
    const publicUrl = new URL(result.url);
    if (publicUrl.protocol !== "https:" || !publicUrl.pathname.startsWith(`/media/${tenant.id}/`)) {
      throw new Error("Cloudflare returned an invalid public image URL.");
    }
    if (onStored) onStored({ reused: result.reused === true });
    uploadedMedia[fingerprint] = publicUrl.href;
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(uploadedMedia));
    } catch (error) {
      console.error("Uploaded image URL could not be cached; a future publish may upload this unchanged image again.", error);
    }
    return publicUrl.href;
  },

  async uploadCatalogVideo(blob, apiUrl, tenant, token) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("Choose a video to upload.");
    if (blob.size > 50_000_000) throw new Error("Videos must be smaller than 50 MB.");
    const contentType = String(blob.type || "").split(";")[0].toLowerCase();
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(contentType)) {
      throw new Error("Choose an MP4, WebM, or QuickTime video.");
    }
    const endpoint = new URL("/api/media", apiUrl.origin);
    endpoint.searchParams.set("tenant", tenant.id);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType
      },
      body: blob
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(responseText || `Cloudflare video upload returned HTTP ${response.status}.`);
    }
    if (!response.ok || result.ok !== true || typeof result.url !== "string") {
      throw new Error(result.error || `Cloudflare video upload returned HTTP ${response.status}.`);
    }
    const publicUrl = new URL(result.url);
    if (publicUrl.protocol !== "https:" || !publicUrl.pathname.startsWith(`/media/${tenant.id}/`)) {
      throw new Error("Cloudflare returned an invalid public video URL.");
    }
    return publicUrl.href;
  },

  renameLitrusMixerStorefront(html, shopName) {
    if (typeof html !== "string" ||
        !html.includes('<meta name="eshop-filled-theme" content="litrus-mixer">')) {
      throw new Error("The saved Litrus storefront is incomplete.");
    }
    const snapshotMatch = html.match(/var SPD=(\{[^\r\n]*\});\r?\n([ \t]*)function SPRT/);
    if (!snapshotMatch) throw new Error("The saved Litrus storefront catalog could not be updated.");
    let snapshot;
    try {
      snapshot = JSON.parse(snapshotMatch[1]);
    } catch (error) {
      throw new Error(`The saved Litrus storefront catalog is invalid: ${error.message}`);
    }
    if (!snapshot || typeof snapshot !== "object" || !snapshot.shop || typeof snapshot.shop !== "object") {
      throw new Error("The saved Litrus storefront catalog is incomplete.");
    }
    snapshot.shop.name = shopName;
    const escapedName = AppUtils.escapeHTML(shopName);
    const updateBrand = markup => typeof markup === "string"
      ? markup.replace(/(<a\b[^>]*class=["'][^"']*\bsp-logo\b[^"']*["'][^>]*>)[\s\S]*?(<\/a>)/i,
        (_match, opening, closing) => `${opening}${escapedName}${closing}`)
      : markup;
    if (snapshot.shell && typeof snapshot.shell === "object") {
      snapshot.shell.head = updateBrand(snapshot.shell.head);
    }
    if (snapshot.pages && typeof snapshot.pages === "object") {
      Object.keys(snapshot.pages).forEach(route => {
        snapshot.pages[route] = updateBrand(snapshot.pages[route]);
      });
    }
    const serialized = JSON.stringify(snapshot)
      .replace(/</g, "\\u003c")
      .replace(/\u2028|\u2029/g, character => character === "\u2028" ? "\\u2028" : "\\u2029");
    const updated = html.replace(snapshotMatch[0], `var SPD=${serialized};\n${snapshotMatch[2]}function SPRT`);
    return updated.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedName}</title>`);
  },

  async saveLitrusMixerCatalog(input, isDraftEditor, expectedTenantId) {
    const data = input?.catalog;
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.products) ||
        data.categories.length > 1000 || data.products.length > 1000 ||
        !data.shop || typeof data.shop !== "object") {
      throw new Error("Litrus Mixer returned an invalid shop catalog.");
    }
    const tenant = this.getActiveTenant();
    // The product tables belong to the active shop, so a save queued for another shop must not run.
    if (expectedTenantId && tenant.id !== expectedTenantId) {
      throw new Error("The active shop changed while the website editor was open, so nothing was saved. Reopen the website editor for the shop you want to edit.");
    }
    const current = this.tenantCatalogs().find(item => item.tenant_id === tenant.id);
    if (!current) throw new Error("The current shop catalog is not available on this device.");
    // The live product store is newer than the cached tenant catalog (POS sales and
    // inventory edits do not refresh the cache), so read stock, status and archived
    // products from it when it exists.
    const liveSelect = typeof SQLiteEngine?.select === "function";
    const currentProducts = liveSelect ? SQLiteEngine.select("products") : current.products || [];
    const currentInventory = liveSelect ? SQLiteEngine.select("inventory") : current.inventory || [];
    const names = data.categories.map(category => {
      const name = String(category?.name || "").trim();
      if (!name || name.length > 80) throw new Error("A Litrus category name is empty or too long.");
      return name;
    });
    const categoryIds = new Map();
    const categories = names.map((name, index) => {
      const existing = current.categories.find(category =>
        String(category.name || "").toLocaleLowerCase() === name.toLocaleLowerCase());
      const id = existing?.id ?? Date.now() + index;
      categoryIds.set(name.toLocaleLowerCase(), id);
      return { ...(existing || {}), id, name };
    });
    const builderProducts = data.products.map((item, index) => {
      const name = String(item?.name || "").trim();
      const price = Number(item?.price);
      if (!name || name.length > 120 || !Number.isFinite(price) || price < 0) {
        throw new Error("A Litrus product has an invalid name or price.");
      }
      const original = currentProducts.find(product => String(product.id) === String(item.id));
      const categoryNames = Array.isArray(item.category_names)
        ? [...new Set(item.category_names.map(value => String(value || "").trim()).filter(Boolean))]
        : typeof item.category_name === "string" && item.category_name.trim()
          ? [item.category_name.trim()]
          : [];
      const productCategoryIds = [...new Set(categoryNames
        .map(name => categoryIds.get(name.toLocaleLowerCase()))
        .filter(id => id != null))];
      const image = typeof item.image === "string" ? item.image : "";
      const images = Array.isArray(item.images)
        ? item.images.filter(value => typeof value === "string").slice(0, 8)
        : image ? [image] : [];
      if (image && images[0] !== image) images.unshift(image);
      const mediaType = ["image", "cutout", "spin", "video"].includes(item.media_type)
        ? item.media_type
        : original?.media_type || "image";
      const durationMinutes = Number(item.duration_minutes);
      return {
        ...(original || {}),
        id: original?.id ?? Date.now() + categories.length + index,
        name,
        price,
        description: String(item.description || "").slice(0, 2000),
        images: images.slice(0, 8),
        media_type: mediaType,
        spin_frames: Array.isArray(item.spin_frames)
          ? item.spin_frames.filter(value => typeof value === "string").slice(0, 36)
          : original?.spin_frames || [],
        video_url: typeof item.video_url === "string" ? item.video_url : original?.video_url || "",
        booking_enabled: item.booking_enabled === true || item.booking_enabled === 1,
        ...(Number.isSafeInteger(durationMinutes) ? { duration_minutes: durationMinutes } :
          Number.isSafeInteger(Number(original?.duration_minutes))
            ? { duration_minutes: Number(original.duration_minutes) }
            : {}),
        category_id: productCategoryIds[0] ?? null,
        category_ids: productCategoryIds,
        category_names: categoryNames.filter(name => categoryIds.has(name.toLocaleLowerCase())),
        sizes: Array.isArray(item.sizes) ? item.sizes : original?.sizes || [],
        colors: Array.isArray(item.colors) ? item.colors : original?.colors || [],
        option1_name: item.option1_name || original?.option1_name || "",
        option2_name: item.option2_name || original?.option2_name || "",
        variants: Array.isArray(item.variants) ? item.variants.slice(0, 100) : original?.variants || [],
        taxonomy_category_id: item.taxonomy_category_id ?? original?.taxonomy_category_id ?? null,
        taxonomy_category_name: item.taxonomy_category_name || original?.taxonomy_category_name || "",
        taxonomy_custom_category: item.taxonomy_custom_category || original?.taxonomy_custom_category || "",
        taxonomy_attributes: Array.isArray(item.taxonomy_attributes)
          ? item.taxonomy_attributes
          : original?.taxonomy_attributes || [],
        priced_attributes: Array.isArray(item.priced_attributes)
          ? item.priced_attributes
          : original?.priced_attributes || [],
        stock: Math.max(0, Number(original?.stock) || 0),
        status: original?.status || "active"
      };
    });
    // Litrus only knows the products the host sent it, and the host never sends
    // archived ones. Merge them back untouched so an autosave cannot delete them;
    // they stay hidden from the storefront because every publish path skips them.
    const builderProductIds = new Set(builderProducts.map(product => String(product.id)));
    const archivedProducts = currentProducts.filter(product =>
      product?.status === "archived" && !builderProductIds.has(String(product.id)));
    const products = [...builderProducts, ...archivedProducts];
    const shop = data.shop;
    const store = {
      ...(current.store || {}),
      name: String(shop.name || current.store?.name || tenant.name).slice(0, 120),
      title: String(shop.name || current.store?.title || tenant.name).slice(0, 120),
      website_theme_id: "litrus-mixer",
      currency: String(shop.currency || current.store?.currency || "KES").slice(0, 8),
      tagline: String(shop.tagline || "").slice(0, 240),
      description: String(shop.description || "").slice(0, 2000),
      email: String(shop.email || "").slice(0, 160),
      phone: String(shop.phone || "").slice(0, 60),
      whatsapp: String(shop.whatsapp || "").slice(0, 40),
      location_address: String(shop.address || "").slice(0, 200),
      delivery_fee: Number(shop.delivery_fee) || 0,
      free_delivery_over: Number(shop.free_delivery_over) || 0,
      about: String(shop.about || "").slice(0, 4000),
      // Saving from the builder must not flatten a shop that sells goods and time side by side.
      offer_type: window.EshopServiceModel.offerTypeForCatalogue(products, shop.offer_type),
      service_days: Array.isArray(shop.service_days) ? shop.service_days.map(Number) : [1, 2, 3, 4, 5, 6],
      service_open_time: String(shop.service_open_time || "09:00"),
      service_close_time: String(shop.service_close_time || "17:00"),
      service_timezone: String(shop.service_timezone || "Africa/Nairobi"),
      service_buffer_minutes: Number(shop.service_buffer_minutes) || 0,
      service_deposit_percent: Number(shop.service_deposit_percent) || 0,
      service_capacity: Math.min(20, Math.max(1, Math.round(Number(shop.service_capacity)) || 1)),
      service_cancel_cutoff_hours: shop.service_cancel_cutoff_hours === undefined || shop.service_cancel_cutoff_hours === "" || !Number.isFinite(Number(shop.service_cancel_cutoff_hours)) ? 2 : Math.min(168, Math.max(0, Math.round(Number(shop.service_cancel_cutoff_hours)))),
      service_max_reschedules: shop.service_max_reschedules === undefined || shop.service_max_reschedules === "" || !Number.isFinite(Number(shop.service_max_reschedules)) ? 2 : Math.min(10, Math.max(0, Math.round(Number(shop.service_max_reschedules))))
    };
    this.setActiveTenantCatalog(tenant, {
      ...current,
      products,
      categories,
      store,
      inventory: currentInventory.filter(record =>
        products.some(product => String(product.id) === String(record.product_id)))
    });
    if (isDraftEditor) {
      const draft = StudioRenderers.websiteBuilderDraft();
      draft.categories = categories.map(category => ({ id: category.id, name: category.name }));
      draft.products = builderProducts.map(product => ({
        id: product.id,
        source_product_id: product.source_product_id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        description: product.description,
        images: product.images,
        option1_name: product.option1_name || "",
        option2_name: product.option2_name || "",
        sizes: product.sizes || [],
        colors: product.colors || [],
        variants: product.variants || [],
        category_id: product.category_id,
        category_name: product.category_name
      }));
      draft.shop_name = store.name;
      draft.selected_theme = "litrus-mixer";
      StudioRenderers.saveWebsiteBuilderDraft(draft);
      const signature = JSON.stringify({
        categories: categories.map(category => [String(category.id), category.name]),
        products: builderProducts.map(product => [
          String(product.id),
          String(product.source_product_id || ""),
          product.name,
          Number(product.price) || 0,
          Number(product.stock) || 0,
          String(product.category_id)
        ])
      });
      const cachedDraft = this.tenantCatalogs().find(item => item.tenant_id === tenant.id);
      if (cachedDraft) cachedDraft.draft_signature = signature;
      window.localStorage.setItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY, signature);
    }
    if (!window.ShopSQLite) throw new Error("The app database is not ready.");
  },

  openCloudflarePublishModal(publishImmediately = false) {
    if (this.isWebsiteBuilderDraftTenant(this.getActiveTenant().id)) {
      AppUtils.showToast("A local website draft cannot be published. Finish setup to create its live shop.", "danger");
      return;
    }
    const modalContainer = document.getElementById("product-modal-container") ||
      document.getElementById("category-modal-container");
    if (!modalContainer) return;

    const tenant = this.getActiveTenant();
    const connection = this.cloudflareConnection(tenant.id);
    const token = connection.token;
    const apiUrl = new URL("/api/catalog", connection.origin);
    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="cloudflare-publish-modal-overlay">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="cloudflare-publish-title">
          <button class="modal-close-btn" id="cloudflare-publish-close" aria-label="Close">&times;</button>
          <h2 class="product-editor-title" id="cloudflare-publish-title">Deploy storefront</h2>
          <p style="color:var(--text-muted); margin:0 0 16px;">Publish <strong>${AppUtils.escapeHTML(tenant.name)}</strong>'s Products and Categories to <strong>${AppUtils.escapeHTML(tenant.hostname)}</strong>.</p>
          <form id="cloudflare-publish-form" style="display:flex; flex-direction:column; gap:14px;">
            <p style="color:var(--text-muted); font-size:0.8rem; margin:0;">Uploaded photos are compressed on this device, saved locally, then uploaded to R2 when you publish. Their R2 links are included in the live website catalog.</p>
            <div style="display:flex; gap:10px; margin-top:6px;">
              <button type="submit" class="btn-primary" id="cloudflare-publish-submit" style="flex:1;">Publish catalog</button>
              <button type="button" class="btn-secondary" id="cloudflare-publish-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("cloudflare-publish-close").onclick = close;
    document.getElementById("cloudflare-publish-cancel").onclick = close;
    document.getElementById("cloudflare-publish-modal-overlay").onclick = event => {
      if (event.target.id === "cloudflare-publish-modal-overlay") close();
    };

    const form = document.getElementById("cloudflare-publish-form");
    form.onsubmit = async event => {
      event.preventDefault();
      if (!token) {
        AppUtils.showToast("Sign in to the Craft account that owns this website before publishing.", "danger");
        return;
      }
      apiUrl.search = `?tenant=${encodeURIComponent(tenant.id)}`;
      apiUrl.hash = "";

      const products = SQLiteEngine.select("products", product => product.status !== "archived");
      const categories = SQLiteEngine.getCategories();
      const store = SQLiteEngine.getStore();
      const submitButton = document.getElementById("cloudflare-publish-submit");
      submitButton.disabled = true;
      submitButton.textContent = "Preparing images…";
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      try {
        const themeId = String(store.website_theme_id || "litrus-mixer");
        const litrusMixerTheme = themeId === "litrus-mixer";
        const themeClient = litrusMixerTheme ? null : await window.EshopThemeRuntime.loadThemeSkeleton();
        const selectedTheme = StudioRenderers.websiteThemes().find(theme => theme.id === themeId);
        const appEditableTheme = selectedTheme?.editor_mode === "app";
        const liquidHtmlTheme = selectedTheme?.editor_mode === "liquid-html";
        if (themeId !== "classic" && !appEditableTheme && !liquidHtmlTheme && !litrusMixerTheme &&
            !themeClient?.isSupportedThemeId(themeId)) {
          throw new Error(`Theme "${themeId}" cannot be published yet because its shop-data mapping is not verified.`);
        }
        await window.ShopSQLite.flush();
        const mapWithConcurrency = async (items, limit, worker) => {
          const results = new Array(items.length);
          let nextIndex = 0;
          let failed = false;
          let failure;
          const workerCount = Math.min(items.length, Math.max(1, limit));
          await Promise.all(Array.from({ length: workerCount }, async () => {
            while (!failed) {
              const index = nextIndex++;
              if (index >= items.length) return;
              try {
                results[index] = await worker(items[index], index);
              } catch (error) {
                failed = true;
                failure = error;
              }
            }
          }));
          if (failed) throw failure;
          return results;
        };
        const uploadedImages = new Map();
        const uploadedProductImages = new Map();
        let imageCount = 0;
        let uploadedR2ImageCount = 0;
        let reusedR2ImageCount = 0;
        let fallbackProductImageCount = 0;
        const recordImageStorage = result => {
          if (result.reused) reusedR2ImageCount += 1;
          else uploadedR2ImageCount += 1;
        };
        const publishImage = async image => {
          if (typeof image !== "string" || !/^data:image\//i.test(image)) return image || "";
          if (!uploadedImages.has(image)) {
            imageCount += 1;
            submitButton.textContent = `Uploading image ${imageCount}…`;
            const upload = this.uploadCatalogImage(image, apiUrl, tenant, token, recordImageStorage).catch(error => {
              uploadedImages.delete(image);
              throw error;
            });
            uploadedImages.set(image, upload);
          }
          return uploadedImages.get(image);
        };
        const publishProductImage = async image => {
          if (typeof image !== "string" || !image || /^data:image\//i.test(image)) {
            return publishImage(image);
          }
          if (image.startsWith(LOCAL_PRODUCT_MEDIA_PREFIX) ||
              image.startsWith(INDEXEDDB_PRODUCT_MEDIA_PREFIX)) {
            const blob = await AppUtils.readLocalProductMedia(image);
            const file = new File([blob], "product-media", { type: blob.type || "image/png" });
            const compressedImage = await AppUtils.compressImageFile(file, {
              maxDimension: 1800,
              maxBytes: 2_500_000,
              maxInputBytes: 40 * 1024 * 1024
            });
            return publishImage(compressedImage);
          }
          let imageUrl;
          try {
            imageUrl = new URL(image);
          } catch {
            return image;
          }
          if (!["http:", "https:"].includes(imageUrl.protocol)) return image;
          const ownHostname = String(tenant.hostname || "").toLowerCase();
          if (imageUrl.hostname === "rrobin.co.ke" ||
              imageUrl.hostname.endsWith(".rrobin.co.ke") ||
              imageUrl.hostname === ownHostname) return image;
          if (!uploadedProductImages.has(image)) {
            imageCount += 1;
            submitButton.textContent = `Uploading image ${imageCount}…`;
            uploadedProductImages.set(image, (async () => {
              try {
                const uploadedUrl = await this.uploadCatalogImage(
                  image, apiUrl, tenant, token, recordImageStorage
                );
                return uploadedUrl;
              } catch (error) {
                fallbackProductImageCount += 1;
                console.warn("External product image could not be copied to R2; keeping its original URL.", error);
                return image;
              }
            })());
          }
          return uploadedProductImages.get(image);
        };
        const publishProducts = await mapWithConcurrency(products, 2, async product => {
          const { video_path: videoPath, ...publishableProduct } = product;
          let videoUrl = product.video_url || "";
          if (videoPath) {
            submitButton.textContent = "Uploading product video…";
            videoUrl = await this.uploadCatalogVideo(
              await AppUtils.readLocalProductMedia(videoPath),
              apiUrl,
              tenant,
              token
            );
          }
          return {
            ...publishableProduct,
            images: await mapWithConcurrency(
              Array.isArray(product.images) ? product.images : [],
              1,
              publishProductImage
            ),
            spin_frames: await mapWithConcurrency(
              Array.isArray(product.spin_frames) ? product.spin_frames : [],
              1,
              publishProductImage
            ),
            video_url: videoUrl
          };
        });
        const publishCategories = await mapWithConcurrency(categories, 2, async category => ({
          ...category,
          image: await publishImage(category.image || "")
        }));
        const publishStore = {
          ...store,
          hold_duration_hours: Number(StudioRenderers.getWorkspaceSetting("max_hold_hours", 24)),
          website_theme_id: themeId,
          element_edits: await mapWithConcurrency(
            Array.isArray(store.element_edits) ? store.element_edits : [],
            2,
            async edit => ({
              ...edit,
              src: edit.kind === "image" ? await publishImage(edit.src || "") : edit.src,
              originalSrc: edit.kind === "image" ? await publishImage(edit.originalSrc || "") : edit.originalSrc
            })
          )
        };
        submitButton.textContent = "Publishing catalog…";
        const response = await fetch(apiUrl.href, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            products: publishProducts,
            categories: publishCategories,
            store: publishStore,
            pages: SQLiteEngine.getPages()
          })
        });
        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText);
        } catch {
          throw new Error(responseText || `Cloudflare returned HTTP ${response.status}.`);
        }
        if (!response.ok) throw new Error(result.error || `Cloudflare returned HTTP ${response.status}.`);
        if (result.ok !== true) throw new Error("Cloudflare did not confirm the catalog publish.");

        if (themeId !== "classic") {
          if (!selectedTheme) throw new Error("The selected theme is no longer available.");
          submitButton.textContent = "Filling and publishing storefront…";
          const filledCatalog = {
            products: publishProducts,
            categories: publishCategories,
            store: publishStore,
            pages: SQLiteEngine.getPages()
          };
          let filledHtml;
          if (litrusMixerTheme) {
            filledHtml = StudioRenderers.getWorkspaceSetting(
              `liquid-html-theme-draft:litrus-mixer:tenant:${tenant.id}`, "");
            if (typeof filledHtml !== "string" ||
                !filledHtml.includes('<meta name="eshop-filled-theme" content="litrus-mixer">')) {
              throw new Error("Publish the Litrus Mixer design from Preview before publishing this shop.");
            }
          } else if (appEditableTheme) {
            const renderLiquidStorefront = window.EshopLiquidStorefront?.render;
            if (typeof renderLiquidStorefront !== "function") {
              throw new Error("My Own Theme's Liquid renderer is not ready.");
            }
            const viewerSettingKey = `liquid-theme-viewer:${tenant.id}:${themeId}`;
            let viewerSettings = StudioRenderers.getWorkspaceSetting(viewerSettingKey, null);
            if (typeof viewerSettings === "string") {
              try {
                viewerSettings = JSON.parse(viewerSettings);
              } catch (error) {
                throw new Error(`Saved My Own Theme settings are invalid: ${error.message}`);
              }
            }
            if (viewerSettings !== null &&
                (!viewerSettings || typeof viewerSettings !== "object" || Array.isArray(viewerSettings))) {
              throw new Error("Saved My Own Theme settings are invalid.");
            }
            const themeRoot = new URL("/liquid-themes/my-own-theme/", window.location.origin);
            filledHtml = await renderLiquidStorefront(filledCatalog, {
              baseUrl: `https://${tenant.hostname}/`,
              settings: viewerSettings,
              loadFile: async path => {
                const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
                if (!response.ok) throw new Error(`Could not load My Own Theme file ${path} (${response.status}).`);
                return response.text();
              }
            });
          } else if (liquidHtmlTheme) {
            const renderTheme = window.EshopLiquidHtmlThemeRenderer?.render;
            if (typeof renderTheme !== "function") {
              throw new Error(`${selectedTheme.name}'s Liquid renderer is not ready.`);
            }
            const savedThemeDesign = StudioRenderers.getWorkspaceSetting(
              `liquid-html-theme-draft:${themeId}`, "");
            const themeRoot = new URL(`/theme-packages/${themeId}/`, window.location.origin);
            filledHtml = await renderTheme(themeId, filledCatalog, {
              baseUrl: `https://${tenant.hostname}/`,
              loadFile: async path => {
                if (path === "index.html" && savedThemeDesign) return savedThemeDesign;
                const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
                if (!response.ok) {
                  throw new Error(`Could not load ${selectedTheme.name} file ${path} (${response.status}).`);
                }
                return response.text();
              }
            });
          } else {
            filledHtml = await themeClient.fillThemeForShop(themeId, filledCatalog, {
              baseHref: selectedTheme.preview_url,
              authorization: token,
              tenantId: tenant.id
            });
          }
          const themePublishUrl = new URL("/api/theme-publish", apiUrl.origin);
          themePublishUrl.search = `?tenant=${encodeURIComponent(tenant.id)}`;
          const themeResponse = await fetch(themePublishUrl.href, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              theme_id: themeId,
              catalog_updated_at: result.updated_at,
              html: filledHtml
            })
          });
          const themeResponseText = await themeResponse.text();
          let themeResult;
          try {
            themeResult = JSON.parse(themeResponseText);
          } catch {
            throw new Error(themeResponseText || `Cloudflare returned HTTP ${themeResponse.status}.`);
          }
          if (!themeResponse.ok || themeResult.ok !== true) {
            throw new Error(themeResult.error || `Filled storefront publish failed (${themeResponse.status}).`);
          }
        }

        close();
        AppUtils.showToast(
          `Published ${result.product_count} products and ${result.category_count} categories; ` +
          `${uploadedR2ImageCount} new image${uploadedR2ImageCount === 1 ? "" : "s"} saved to R2` +
          (reusedR2ImageCount ? `, ${reusedR2ImageCount} reused` : "") +
          "." +
          (fallbackProductImageCount
            ? ` ${fallbackProductImageCount} external product image${fallbackProductImageCount === 1 ? "" : "s"} kept its original URL after upload failed.`
            : "")
        );
      } catch (error) {
        console.error("Cloudflare storefront publishing failed.", error);
        AppUtils.showToast(error.message || "Could not publish the catalog to Cloudflare.", "danger");
        submitButton.disabled = false;
        submitButton.textContent = "Publish catalog";
      }
    };
    if (publishImmediately) form.requestSubmit();
  },

  initStudioModals() {
    this.initTenantManager();
    const publishButton = document.getElementById("btn-publish-cloudflare");
    if (publishButton) publishButton.onclick = () => this.openCloudflarePublishModal();

    const productSearch = document.getElementById("admin-prod-search");
    const productCategory = document.getElementById("admin-prod-cat");
    const productList = document.getElementById("admin-products-list");
    if (productSearch && productCategory && productList) {
      const filterProducts = () => {
        const query = productSearch.value.trim().toLowerCase();
        const categoryId = productCategory.value;
        productList.querySelectorAll(".product-list-item").forEach(item => {
          const matchesQuery = !query || item.dataset.search.includes(query);
          const matchesCategory = !categoryId || item.dataset.categoryId === categoryId;
          item.hidden = !matchesQuery || !matchesCategory;
        });
      };
      productSearch.addEventListener("input", filterProducts);
      productCategory.addEventListener("change", filterProducts);
    }

    // 1. Add Product Trigger
    const btnAddProd = document.getElementById("btn-add-product");
    const modalContainer = document.getElementById("product-modal-container");
    if (btnAddProd && modalContainer) {
      btnAddProd.onclick = () => this.openProductModal(null);
    }

    // 2. Settings form
    const settingsForm = document.getElementById("store-settings-form");
    if (settingsForm) {
      const customColorInput = document.getElementById("custom-store-color");
      const customColorRadio = settingsForm.querySelector(".store-custom-color-choice input[type='radio']");
      const selectedAppearance = () => ({
        primary_color: settingsForm.querySelector('input[name="primaryColor"]:checked')?.value || this.getStudioAppearance().primary_color,
        card_radius: settingsForm.querySelector('input[name="cardRadius"]:checked')?.value || "4px"
      });
      settingsForm.addEventListener("change", () => this.applyThemeSettings(selectedAppearance()));
      if (customColorInput && customColorRadio) {
        customColorInput.addEventListener("input", () => {
          customColorRadio.value = customColorInput.value.toUpperCase();
          customColorRadio.checked = true;
          this.applyThemeSettings(selectedAppearance());
        });
      }
      settingsForm.onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(settingsForm);
        const appearance = selectedAppearance();
        window.localStorage.setItem(this.studioAppearanceKey(), JSON.stringify(appearance));
        SQLiteEngine.updateStore({
          announcement: fd.get("announcement"),
          announcement_active: fd.get("announcementActive") ? 1 : 0
        });
        this.cacheActiveTenantCatalog();
        this.applyThemeSettings(appearance);
        AppUtils.showToast("App appearance saved. It now applies throughout the app.");
      };
    }

    // 3. Web form
    const webForm = document.getElementById("store-web-form");
    if (webForm) {
      webForm.onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(webForm);
        SQLiteEngine.updateStore({
          name: fd.get("name"),
          tagline: fd.get("tagline"),
          title: fd.get("seoTitle"),
          description: fd.get("seoDescription")
        });
        AppUtils.showToast("Web appearance updated");
      };
    }

    const websiteStoreForm = document.getElementById("website-store-form");
    if (websiteStoreForm) {
      websiteStoreForm.onsubmit = async event => {
        event.preventDefault();
        const data = new FormData(websiteStoreForm);
        SQLiteEngine.updateStore({
          name: String(data.get("name") || "").trim(),
          tagline: String(data.get("tagline") || "").trim(),
          description: String(data.get("description") || "").trim(),
          location: String(data.get("location") || "").trim(),
          email: String(data.get("email") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          announcement: String(data.get("announcement") || "").trim(),
          announcement_active: data.get("announcementActive") ? 1 : 0,
          install_prompt_enabled: data.get("installPromptEnabled") ? 1 : 0
        });
        this.cacheActiveTenantCatalog();
        try {
          if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
          await window.ShopSQLite.flush();
          AppUtils.showToast("Store details saved. Publish the website to apply changes live.");
        } catch (error) {
          console.error("Store details could not be saved.", error);
          AppUtils.showToast(error.message || "Could not save store details.", "danger");
        }
      };
    }

  },

  openCategoryModal(category) {
    const modalContainer = document.getElementById("category-modal-container");
    if (!modalContainer) return;
    const isEdit = !!category;
    const returnRoute = this.currentRoute().startsWith("/account/web/site")
      ? "/account/web/site"
      : "/account/categories";

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="category-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="category-editor-title">
        <div class="modal-card">
          <button class="modal-close-btn" id="category-modal-close" aria-label="Close">&times;</button>
          <h2 class="product-editor-title" id="category-editor-title">${isEdit ? "Edit category" : "Add category"}</h2>
          <form id="category-editor-form" class="product-editor-form" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" name="id" value="${category ? category.id : ""}">
            <div class="form-field">
              <label class="form-label" for="category-name">Category name *</label>
              <input id="category-name" type="text" name="name" class="form-input" required maxlength="80" value="${category ? AppUtils.escapeHTML(category.name) : ""}">
            </div>
            <div class="form-field">
              <label class="form-label" for="category-description">Description</label>
              <textarea id="category-description" name="description" class="form-input" maxlength="500" style="height:90px;padding-top:8px;">${category ? AppUtils.escapeHTML(category.description || "") : ""}</textarea>
            </div>
            <div class="form-field">
              <label class="form-label" for="category-image">Department image URL</label>
              <input id="category-image" type="url" name="image" class="form-input" value="${category ? AppUtils.escapeHTML(category.image || "") : ""}" placeholder="https://...">
            </div>
            <div class="product-editor-actions" style="margin-top:8px;">
              <button type="submit" class="btn-primary">${isEdit ? "Save Changes" : "Create Category"}</button>
              <button type="button" class="btn-secondary" id="category-modal-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("category-modal-close").onclick = close;
    document.getElementById("category-modal-cancel").onclick = close;
    document.getElementById("category-modal-overlay").onclick = (event) => {
      if (event.target.id === "category-modal-overlay") close();
    };

    const form = document.getElementById("category-editor-form");
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const id = data.get("id");
      SQLiteEngine.saveCategory({
        id: id ? Number(id) : undefined,
        name: String(data.get("name")).trim(),
        description: String(data.get("description") || "").trim(),
        image: String(data.get("image") || "").trim(),
        featured: category ? category.featured : 0
      });
      AppUtils.showToast(isEdit ? "Category updated" : "Category created");
      close();
      this.handleRoute(returnRoute, false);
    };
    document.getElementById("category-name").focus();
  },

  readProductImage(file) {
    return AppUtils.compressImageFile(file);
  },

  openProductModal(product, initialCategoryId = null) {
    const modalContainer = document.getElementById("product-modal-container");
    if (!modalContainer) return;
    const returnToWebsite = this.currentRoute().startsWith("/account/web/site");
    const categories = SQLiteEngine.getCategories();
    const isEdit = !!product;
    const currentImage = product && product.images && product.images[0] ? product.images[0] : "";

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="prod-modal-overlay">
        <div class="modal-card">
          <button class="modal-close-btn" id="modal-close-x">&times;</button>
          <h2 class="product-editor-title">
            ${isEdit ? 'Edit product' : 'Add product'}
          </h2>
          <form id="modal-product-form" class="product-editor-form" style="display: flex; flex-direction: column; gap: 14px;">
            <input type="hidden" name="id" value="${product ? product.id : ''}" />
            <input type="hidden" name="brand" value="${AppUtils.escapeHTML(product ? product.brand : '')}" />
            <input type="hidden" name="sku" value="${AppUtils.escapeHTML(product ? product.sku : '')}" />
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Product Name *</label>
                <input type="text" name="name" class="form-input" required value="${product ? AppUtils.escapeHTML(product.name) : ''}" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Category *</label>
                <select name="categoryId" class="form-input" required>
                  <option value="">Choose a category</option>
                  ${categories.map(c => `
                    <option value="${c.id}" ${product ? product.category_id === c.id ? 'selected' : '' : Number(initialCategoryId) === c.id ? 'selected' : ''}>${AppUtils.escapeHTML(c.name)}</option>
                  `).join("")}
                </select>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Selling Price ($) *</label>
                <input type="number" name="price" class="form-input" required value="${product ? product.price : ''}" />
              </div>
              <div class="form-field">
                <label class="form-label">Cost Price ($) *</label>
                <input type="number" name="costPrice" class="form-input" required value="${product ? product.cost_price : ''}" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Warehouse Stock Units *</label>
                <input type="number" name="stock" class="form-input" required value="${product ? product.stock : ''}" />
              </div>
              <div class="form-field">
                <label class="form-label">Discount Percentage (%)</label>
                <input type="number" name="discount" class="form-input" value="${product ? product.discount : 0}" />
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">Product photos (up to 8)</label>
              <input type="url" name="image" class="form-input" value="${AppUtils.escapeHTML(currentImage)}" placeholder="Optional image URL" />
              <input type="file" name="imageFile" class="form-input" accept="image/*" multiple aria-label="Upload up to 8 product photos" />
              <small style="color: var(--text-muted);">Choose up to 8 photos to save in this device's SQLite catalog. Selected photos replace existing photos and the URL.</small>
              <img id="product-image-preview" src="${AppUtils.escapeHTML(currentImage)}" alt="Product photo preview" ${currentImage ? "" : "hidden"} style="width: 88px; height: 88px; object-fit: cover; border-radius: 8px;" />
              <small data-product-image-selection role="status" aria-live="polite"></small>
            </div>

            <div class="form-field">
              <label class="form-label">Description</label>
              <textarea name="description" class="form-input" style="height: 80px; padding-top: 8px;">${product ? AppUtils.escapeHTML(product.description) : ''}</textarea>
            </div>

            <div class="product-editor-checks" style="margin: 8px 0;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
                <input type="checkbox" name="isFlagship" ${product && product.is_flagship ? 'checked' : ''} />
                <span>Feature on storefront</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem;">
                <input type="checkbox" name="isFeatured" ${product && product.is_featured ? 'checked' : ''} />
                <span>Show as featured</span>
              </label>
            </div>

            <div class="product-editor-actions" style="margin-top: 8px;">
              <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Create Product'}</button>
              <button type="button" class="btn-secondary" id="modal-btn-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("modal-close-x").onclick = close;
    document.getElementById("modal-btn-cancel").onclick = close;

    const modalForm = document.getElementById("modal-product-form");
    const imageInput = modalForm.elements.namedItem("imageFile");
    const imagePreview = document.getElementById("product-image-preview");
    const imageSelectionStatus = modalForm.querySelector("[data-product-image-selection]");
    const taxonomyMarkup = document.createElement("div");
    taxonomyMarkup.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
      categoryId: product?.taxonomy_category_id || "",
      categoryName: product?.taxonomy_category_name || "",
      customCategory: product?.taxonomy_custom_category || "",
      attributes: product?.taxonomy_attributes || []
    });
    const taxonomyFields = taxonomyMarkup.firstElementChild;
    modalForm.elements.namedItem("categoryId").closest(".form-grid").insertAdjacentElement("afterend", taxonomyFields);
    window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyFields);
    const variantsMarkup = document.createElement("div");
    variantsMarkup.innerHTML = window.EshopProductVariants.createProductVariantFields({
      option1Name: product?.option1_name || "",
      option2Name: product?.option2_name || "",
      sizes: product?.variants?.length ? product.sizes || [] : [],
      colors: product?.variants?.length ? product.colors || [] : [],
      variants: product?.variants || []
    });
    const variantFields = variantsMarkup.firstElementChild;
    taxonomyFields.insertAdjacentElement("afterend", variantFields);
    window.EshopProductVariants.bindProductVariantFields(variantFields);
    let previewObjectUrl = "";
    imageInput.addEventListener("change", () => {
      const files = Array.from(imageInput.files || []);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = "";
      if (!files.length) {
        imagePreview.src = currentImage;
        imagePreview.hidden = !currentImage;
        if (imageSelectionStatus) imageSelectionStatus.textContent = "";
        return;
      }
      if (files.length > 8 || files.some(file => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
        AppUtils.showToast("Choose up to 8 images, each smaller than 5 MB.", "danger");
        imageInput.value = "";
        imagePreview.src = currentImage;
        imagePreview.hidden = !currentImage;
        if (imageSelectionStatus) imageSelectionStatus.textContent = "";
        return;
      }
      previewObjectUrl = URL.createObjectURL(files[0]);
      imagePreview.src = previewObjectUrl;
      imagePreview.hidden = false;
      if (imageSelectionStatus) imageSelectionStatus.textContent = `${files.length} photo${files.length === 1 ? "" : "s"} selected.`;
    });
    modalForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(modalForm);
      const prodId = fd.get("id");
      const selectedImages = Array.from(imageInput.files || []);
      if (selectedImages.length > 8 || selectedImages.some(file => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
        AppUtils.showToast("Choose up to 8 images, each smaller than 5 MB.", "danger");
        return;
      }
      let saved;
      try {
        const imageUrl = String(fd.get("image") || "").trim();
        const images = selectedImages.length
          ? await Promise.all(selectedImages.map(file => this.readProductImage(file)))
          : imageUrl !== currentImage
            ? imageUrl ? [imageUrl] : []
            : Array.isArray(product?.images) ? product.images.slice(0, 8) : currentImage ? [currentImage] : [];
        const taxonomy = window.EshopProductTaxonomy.readProductTaxonomyFields(modalForm);
        const productVariants = window.EshopProductVariants.readProductVariantFields(modalForm);
        saved = SQLiteEngine.saveProduct({
          id: prodId ? Number(prodId) : undefined,
          name: fd.get("name"),
          brand: fd.get("brand"),
          sku: fd.get("sku"),
          category_id: Number(fd.get("categoryId")),
          price: Number(fd.get("price")),
          cost_price: Number(fd.get("costPrice")),
          original_price: Number(fd.get("price")),
          discount: Number(fd.get("discount") || 0),
          stock: productVariants.stock ?? Number(fd.get("stock")),
          description: fd.get("description"),
          is_flagship: fd.get("isFlagship") ? 1 : 0,
          is_featured: fd.get("isFeatured") ? 1 : 0,
          taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
          taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
          taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
          taxonomy_attributes: taxonomy.taxonomyAttributes,
          ...productVariants,
          images
        });
        if (saved.sku && Number.isSafeInteger(Number(saved.stock))) {
          await window.EshopInventoryBridge?.setLocalStock(
            this.getActiveTenant().id, saved.sku, Number(saved.stock)
          );
        }
      } catch (error) {
        console.error("Could not save the product photo and product to SQLite.", error);
        AppUtils.showToast("Product could not be saved. Check the selected photo and try again.", "danger");
        return;
      }
      AppUtils.showToast(`Product "${saved.name}" saved`);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      close();
      this.handleRoute(returnToWebsite ? "/account/web/site" : initialCategoryId ? this.currentRoute() : "/account/products");
    };
  },

  updateNavBadges() {
    const cart = SQLiteEngine.getCart();
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badge = document.getElementById("nav-cart-badge");
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }
  },

  bindEvents() {
    // The Android back button is handled by src/back-button.js (installed from src/bootstrap.js).

    document.addEventListener("change", (e) => {
      const agreement = e.target.closest("#privacy-policy-agreement");
      if (agreement) {
        try {
          window.localStorage.setItem("ESHOP_PRIVACY_POLICY_AGREED_V1", agreement.checked ? "accepted" : "declined");
        } catch (error) {
          console.error("Privacy agreement choice could not be saved.", error);
          AppUtils.showToast(error.message || "Privacy agreement choice could not be saved.", "danger");
        }
        return;
      }
      const syncMode = e.target.closest('input[name="device-sync-mode"]');
      if (syncMode) {
        try {
          window.localStorage.setItem("ESHOP_DEVICE_SYNC_MODE_V1", syncMode.value);
          const customOptions = document.getElementById("device-sync-custom-options");
          if (customOptions) customOptions.hidden = syncMode.value !== "custom";
        } catch (error) {
          console.error("Device sync preference could not be saved.", error);
          AppUtils.showToast(error.message || "Device sync preference could not be saved.", "danger");
        }
        return;
      }
      const syncField = e.target.closest("[data-device-sync-field]");
      if (syncField) {
        try {
          window.localStorage.setItem(`ESHOP_DEVICE_SYNC_FIELD_V1:${syncField.dataset.deviceSyncField}`, String(syncField.checked));
        } catch (error) {
          console.error("Custom device sync preferences could not be saved.", error);
          AppUtils.showToast(error.message || "Custom device sync preferences could not be saved.", "danger");
        }
      }
    });

    document.addEventListener("click", async (e) => {
      // 1. Intercept internal data-route links
      const startNewWebsite = e.target.closest("[data-start-new-website]");
      if (startNewWebsite) {
        e.preventDefault();
        try {
          await StudioRenderers.resetWebsiteBuilderDraft();
          this.navigate("/account/web/studio/websites/webmaker");
        } catch (error) {
          console.error("The previous website draft could not be cleared.", error);
          AppUtils.showToast(error.message || "Could not start a clean website draft.", "danger");
        }
        return;
      }
      const link = e.target.closest("[data-route]");
      if (link && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const route = link.getAttribute("data-route");
        this.navigate(route, link.hasAttribute("data-home-screen"));
        return;
      }

      const loadWebsiteStats = e.target.closest("[data-load-website-stats]");
      if (loadWebsiteStats) {
        const tenantId = loadWebsiteStats.dataset.loadWebsiteStats || "";
        const status = document.querySelector("[data-website-stats-status]");
        const content = document.querySelector("[data-website-stats-content]");
        const website = this.tenantCatalogs().find(item => item.tenant_id === tenantId);
        const credential = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") ||
          website?.owner_token || "";
        loadWebsiteStats.disabled = true;
        if (status) status.textContent = "Loading usage…";
        if (content) content.replaceChildren();
        try {
          if (!credential) throw new Error("Sign in to the account that owns this website.");
          const result = await this.cloudflareRequest(
            `/api/tenants/${encodeURIComponent(tenantId)}/usage`,
            {},
            tenantId,
            false,
            credential
          );
          const r2 = result.r2 || {};
          const d1 = result.d1 || {};
          const formatBytes = value => {
            const bytes = Number(value) || 0;
            if (bytes < 1024) return `${bytes} B`;
            const units = ["KB", "MB", "GB", "TB"];
            let size = bytes / 1024;
            let unit = 0;
            while (size >= 1024 && unit < units.length - 1) {
              size /= 1024;
              unit++;
            }
            return `${size.toFixed(1)} ${units[unit]}`;
          };
          if (content) content.innerHTML = `
            <div class="website-usage-grid">
              <div class="website-usage-card"><span>R2 objects</span><strong>${Number(r2.objects) || 0}</strong><small>${AppUtils.escapeHTML(formatBytes(r2.bytes))}${r2.complete === false ? " · partial scan" : ""}</small></div>
              <div class="website-usage-card"><span>D1 records</span><strong>${Number(d1.total_records) || 0}</strong><small>Tenant-scoped rows</small></div>
            </div>
            <div class="website-usage-tables" aria-label="Database records by table">
              ${(Array.isArray(d1.tables) ? d1.tables : []).map(table => `<div class="website-usage-table-row"><span>${AppUtils.escapeHTML(table.name)}</span><strong>${Number(table.count) || 0}</strong></div>`).join("") || "<p>No tenant-scoped D1 records yet.</p>"}
            </div>`;
          if (status) status.textContent = "Usage updated.";
        } catch (error) {
          console.error("Website usage could not be loaded.", error);
          if (status) status.textContent = error.message || "Website usage could not be loaded.";
          AppUtils.showToast(error.message || "Website usage could not be loaded.", "danger");
        } finally {
          loadWebsiteStats.disabled = false;
        }
        return;
      }

      const customDomainAction = e.target.closest("[data-custom-domain-action]");
      if (customDomainAction) {
        const tenantId = customDomainAction.dataset.tenantId || "";
        const action = customDomainAction.dataset.customDomainAction;
        const hostnameInput = document.getElementById("custom-domain-hostname");
        const status = document.getElementById("custom-domain-status");
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        if (!sessionToken) {
          if (status) status.textContent = "Sign in to the account that owns this shop to manage its domain.";
          return;
        }
        if (action === "remove" && !confirm("Disconnect this custom subdomain from the shop?")) return;
        customDomainAction.disabled = true;
        try {
          let result;
          if (action === "connect") {
            const hostname = hostnameInput?.value.trim() || "";
            if (!hostname) throw new Error("Enter the subdomain you want to connect.");
            result = await this.cloudflareRequest(
              `/api/custom-hostnames?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "POST", body: JSON.stringify({ hostname }) },
              tenantId,
              false,
              sessionToken
            );
          } else if (action === "remove") {
            result = await this.cloudflareRequest(
              `/api/custom-hostnames?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "DELETE" },
              tenantId,
              false,
              sessionToken
            );
            if (hostnameInput) hostnameInput.value = "";
          } else {
            result = await this.cloudflareRequest(
              `/api/custom-hostnames?tenant_id=${encodeURIComponent(tenantId)}`,
              {},
              tenantId,
              false,
              sessionToken
            );
          }
          await StoreRenderers.loadCustomHostnameStatus(tenantId, result);
        } catch (error) {
          console.error("Custom domain action failed.", error);
          if (status) status.textContent = error.message || "Custom domain action failed.";
          AppUtils.showToast(error.message || "Custom domain action failed.", "danger");
          customDomainAction.disabled = false;
        }
        return;
      }

      const searchConsoleSave = e.target.closest("[data-search-console-save]");
      const searchConsoleRemove = e.target.closest("[data-search-console-remove]");
      const searchConsoleAction = searchConsoleSave || searchConsoleRemove;
      if (searchConsoleAction) {
        const tenantId = searchConsoleSave?.dataset.searchConsoleSave ||
          searchConsoleRemove?.dataset.searchConsoleRemove;
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        const status = document.getElementById("google-search-status");
        const verificationTag = document.getElementById("search-console-verification-tag");
        if (!sessionToken) {
          if (status) status.textContent = "Sign in to your Craft account to manage this shop’s verification tag.";
          return;
        }
        if (searchConsoleRemove && !confirm("Remove the Google Search Console verification tag from this shop?")) {
          return;
        }
        searchConsoleAction.disabled = true;
        try {
          if (searchConsoleSave) {
            const tag = verificationTag?.value.trim() || "";
            if (!tag) throw new Error("Paste the complete HTML verification tag from Google Search Console first.");
            await this.cloudflareRequest(
              `/api/search-console/verification?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "POST", body: JSON.stringify({ verification_tag: tag }) },
              tenantId,
              false,
              sessionToken
            );
            AppUtils.showToast("Google verification tag published. Return to Search Console and click Verify.");
          } else {
            await this.cloudflareRequest(
              `/api/search-console/verification?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "DELETE" },
              tenantId,
              false,
              sessionToken
            );
            if (verificationTag) verificationTag.value = "";
            AppUtils.showToast("Google verification tag removed from this shop.");
          }
          await StoreRenderers.loadGoogleSearchStatus(tenantId);
        } catch (error) {
          console.error("Search Console verification tag could not be updated.", error);
          if (status) status.textContent = error.message || "Search Console verification tag could not be updated.";
          AppUtils.showToast(error.message || "Google Search Console action failed.", "danger");
        } finally {
          searchConsoleAction.disabled = false;
        }
        return;
      }

      const deleteWebsite = e.target.closest("[data-delete-website]");
      if (deleteWebsite) {
        const tenantId = deleteWebsite.dataset.deleteWebsite;
        if (tenantId === "main") {
          AppUtils.showToast("The main Craft website cannot be deleted.", "danger");
          return;
        }
        const website = this.tenantCatalogs().find(item => item.tenant_id === tenantId);
        const websiteName = website?.name || website?.store?.name || tenantId;
        const hostname = website?.hostname || `${tenantId}.rrobin.co.ke`;
        if (!confirm(`Permanently delete "${websiteName}" (${hostname}) and its live catalog? This cannot be undone.`)) return;
        deleteWebsite.disabled = true;
        deleteWebsite.textContent = "Deleting…";
        try {
          if (this.getActiveTenant().id === tenantId) {
            await this.loadTenantCatalog({ id: "main", name: "Craft", hostname: "rrobin.co.ke" });
          }
          await this.cloudflareRequest(`/api/tenants/${encodeURIComponent(tenantId)}`, {
            method: "DELETE"
          }, tenantId);
          const catalogs = this.tenantCatalogs();
          const index = catalogs.findIndex(item => item.tenant_id === tenantId);
          if (index >= 0) catalogs.splice(index, 1);
          SQLiteEngine.save();
          AppUtils.showToast(`Website "${websiteName}" deleted.`);
          this.navigate("/account/profile/webs");
        } catch (error) {
          console.error(`Website "${websiteName}" could not be deleted.`, error);
          AppUtils.showToast(error.message || "Website could not be deleted.", "danger");
          deleteWebsite.disabled = false;
          deleteWebsite.textContent = "Delete web";
        }
        return;
      }

      const manageWebsite = e.target.closest("[data-manage-website]");
      if (manageWebsite) {
        const website = this.tenantCatalogs().find(item => item.tenant_id === manageWebsite.dataset.manageWebsite);
        if (!website) {
          AppUtils.showToast("This website is not saved on this device.", "danger");
          return;
        }
        try {
          this.setActiveTenantCatalog({
            id: website.tenant_id,
            name: website.name || website.store?.name || website.tenant_id,
            hostname: website.hostname || (website.tenant_id === "main" ? "rrobin.co.ke" : `${website.tenant_id}.rrobin.co.ke`),
            owner_token: website.owner_token || ""
          }, website);
          AppUtils.showToast(`Now managing ${website.name || website.store?.name || website.tenant_id}. Products, Inventory, and Categories now use this website.`);
          this.navigate("/account/web/studio/store/products");
        } catch (error) {
          console.error("Could not switch to the selected website catalog.", error);
          AppUtils.showToast(error.message || "Could not select this website.", "danger");
        }
        return;
      }

      const editWebsite = e.target.closest("[data-edit-website]");
      if (editWebsite) {
        const website = this.tenantCatalogs().find(item => item.tenant_id === editWebsite.dataset.editWebsite);
        if (!website) {
          AppUtils.showToast("This website is no longer saved on this device.", "danger");
          return;
        }
        try {
          this.setActiveTenantCatalog({
            id: website.tenant_id,
            name: website.name || website.tenant_id,
            hostname: website.hostname || `${website.tenant_id}.rrobin.co.ke`,
            owner_token: website.owner_token || ""
          }, website);
          this.navigate(`/account/web/site?tenant=${encodeURIComponent(website.tenant_id)}`);
        } catch (error) {
          AppUtils.showToast(error.message || "Could not open this website.", "danger");
        }
        return;
      }

      const editStore = e.target.closest("[data-edit-store]");
      if (editStore) {
        const website = this.tenantCatalogs().find(item => item.tenant_id === editStore.dataset.editStore);
        if (!website) {
          AppUtils.showToast("This website is no longer saved on this device.", "danger");
          return;
        }
        try {
          this.setActiveTenantCatalog({
            id: website.tenant_id,
            name: website.name || website.tenant_id,
            hostname: website.hostname || `${website.tenant_id}.rrobin.co.ke`,
            owner_token: website.owner_token || ""
          }, website);
          this.navigate("/account/web/store");
        } catch (error) {
          AppUtils.showToast(error.message || "Could not open this store.", "danger");
        }
        return;
      }

      if (e.target.closest("#btn-add-website-category")) {
        this.openCategoryModal(null);
        return;
      }
      if (e.target.closest("#btn-add-website-product")) {
        if (!SQLiteEngine.getCategories().length) {
          AppUtils.showToast("Add a category before adding products.", "danger");
          this.navigate("/account/categories");
          return;
        }
        this.openProductModal(null);
        return;
      }

      // 2. Mobile Menu Toggle
      if (e.target.closest("#mobile-menu-toggle")) {
        const drawer = document.getElementById("mobile-nav-drawer");
        if (drawer) drawer.classList.add("active");
        return;
      }
      if (e.target.closest("#mobile-drawer-close") || e.target.id === "mobile-nav-drawer") {
        const drawer = document.getElementById("mobile-nav-drawer");
        if (drawer) drawer.classList.remove("active");
        return;
      }

      if (e.target.closest("#btn-add-category")) {
        this.openCategoryModal(null);
        return;
      }

      const addDepartmentProductBtn = e.target.closest("[data-action='studio-add-department-product']");
      if (addDepartmentProductBtn) {
        this.openProductModal(null, Number(addDepartmentProductBtn.getAttribute("data-category-id")));
        return;
      }

      const editCategoryBtn = e.target.closest("[data-action='edit-category']");
      if (editCategoryBtn) {
        const id = Number(editCategoryBtn.getAttribute("data-id"));
        const category = SQLiteEngine.getCategories().find(item => item.id === id);
        if (category) this.openCategoryModal(category);
        return;
      }

      const deleteCategoryBtn = e.target.closest("[data-action='delete-category']");
      if (deleteCategoryBtn) {
        const id = Number(deleteCategoryBtn.getAttribute("data-id"));
        const category = SQLiteEngine.getCategories().find(item => item.id === id);
        if (!category) return;
        const productCount = SQLiteEngine.select("products", product => product.category_id === id).length;
        const affectedProducts = productCount
          ? ` ${productCount} assigned product${productCount === 1 ? " will" : "s will"} become unassigned.`
          : "";
        if (confirm(`Delete "${category.name}"?${affectedProducts}`)) {
          SQLiteEngine.deleteCategory(id);
          AppUtils.showToast("Category deleted");
          this.handleRoute("/account/categories", false);
        }
        return;
      }

      // 3. Quick Add to Bag on product cards
      const quickAddBtn = e.target.closest("[data-action='quick-add']");
      if (quickAddBtn) {
        e.stopPropagation();
        const prodId = Number(quickAddBtn.getAttribute("data-id"));
        SQLiteEngine.addToCart(prodId, 1);
        AppUtils.showToast("Artifact added to your shopping bag");
        this.updateNavBadges();
        return;
      }

      // 4. Toggle Favorites Heart
      const favBtn = e.target.closest("[data-action='toggle-fav']");
      if (favBtn) {
        e.stopPropagation();
        const prodId = Number(favBtn.getAttribute("data-id"));
        const added = SQLiteEngine.toggleFavorite(prodId);
        favBtn.classList.toggle("active", added);
        const svg = favBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", added ? "#E11D48" : "none");
        AppUtils.showToast(added ? "Saved to your favorites" : "Removed from favorites");
        return;
      }

      // 5. Bag quantity adjusters
      const cartQtyBtn = e.target.closest("[data-action='cart-qty']");
      if (cartQtyBtn) {
        const cartId = Number(cartQtyBtn.getAttribute("data-id"));
        const delta = Number(cartQtyBtn.getAttribute("data-delta"));
        SQLiteEngine.updateCartQty(cartId, delta);
        this.handleRoute("/bag", false);
        return;
      }

      // 6. Bag remove item
      const cartRemoveBtn = e.target.closest("[data-action='cart-remove']");
      if (cartRemoveBtn) {
        const cartId = Number(cartRemoveBtn.getAttribute("data-id"));
        SQLiteEngine.removeCartItem(cartId);
        this.handleRoute("/bag", false);
        return;
      }

      // 8. Admin Products: Edit
      const editProdBtn = e.target.closest("[data-action='admin-edit-prod']");
      if (editProdBtn) {
        const id = Number(editProdBtn.getAttribute("data-id"));
        const prod = SQLiteEngine.getProductById(id);
        if (prod) this.openProductModal(prod);
        return;
      }

      // 9. Admin Products: Duplicate
      const dupProdBtn = e.target.closest("[data-action='admin-dup-prod']");
      if (dupProdBtn) {
        const id = Number(dupProdBtn.getAttribute("data-id"));
        SQLiteEngine.duplicateProduct(id);
        AppUtils.showToast("Artifact duplicated");
        this.handleRoute("/account/products", false);
        return;
      }

      // 10. Admin Products: Delete
      const delProdBtn = e.target.closest("[data-action='admin-del-prod']");
      if (delProdBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you wish to delete this artifact from the SQLite catalog?")) {
          const id = Number(delProdBtn.getAttribute("data-id"));
          SQLiteEngine.deleteProduct(id);
          AppUtils.showToast("Artifact deleted from catalog");
          this.handleRoute("/account/products", false);
        }
        return;
      }

      const saveInventoryBtn = e.target.closest("[data-action='save-inventory-item']");
      if (saveInventoryBtn) {
        const row = saveInventoryBtn.closest(".inventory-item");
        const productId = Number(saveInventoryBtn.getAttribute("data-id"));
        const product = SQLiteEngine.getProductById(productId);
        if (!row || !product) {
          AppUtils.showToast("Could not find this inventory item", "danger");
          return;
        }

        const priceInput = row.querySelector("[data-inv-price]");
        const costInput = row.querySelector("[data-inv-cost]");
        const stockInput = row.querySelector("[data-inv-stock]");
        const inputs = [priceInput, costInput, stockInput];
        const invalidInput = inputs.find(input => !input || !input.reportValidity());
        if (invalidInput) return;

        const price = Number(priceInput.value);
        const costPrice = Number(costInput.value);
        const stock = Number(stockInput.value);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(costPrice) || costPrice < 0 || !Number.isInteger(stock) || stock < 0) {
          AppUtils.showToast("Enter valid prices and a whole-number stock quantity", "danger");
          return;
        }

        SQLiteEngine.saveProduct({ ...product, price, cost_price: costPrice, stock });
        await window.EshopInventoryBridge?.setLocalStock(this.getActiveTenant().id, product.sku, stock);
        AppUtils.showToast("Inventory details updated");
        this.handleRoute("/account/inventory", false);
        return;
      }

      // 11. Quick Restock Units
      const restockBtn = e.target.closest("[data-action='restock-qty']");
      if (restockBtn) {
        const id = Number(restockBtn.getAttribute("data-id"));
        const add = Number(restockBtn.getAttribute("data-add"));
        const prod = SQLiteEngine.getProductById(id);
        if (prod) {
          const newStock = prod.stock + add;
          SQLiteEngine.updateInventoryStock(id, newStock);
          await window.EshopInventoryBridge?.setLocalStock(this.getActiveTenant().id, prod.sku, newStock);
          AppUtils.showToast(`Restocked +${add} units in SQLite database`);
          this.handleRoute("/account/inventory", false);
        }
        return;
      }

      // 12. Dashboard period selector
      const dashPeriodBtn = e.target.closest("[data-action='dash-period']");
      if (dashPeriodBtn) {
        const period = dashPeriodBtn.getAttribute("data-period");
        this.navigate(`/account/dashboard?period=${period}`);
        return;
      }

      // 13. Upgrade Plan selection
      const planBtn = e.target.closest("[data-action='upgrade-plan']");
      if (planBtn) {
        const slug = planBtn.getAttribute("data-slug");
        SQLiteEngine.selectPlan(slug);
        AppUtils.showToast(`Selected ${slug.toUpperCase()} tier! Upgrade processed.`);
        this.handleRoute("/account/plans", false);
        return;
      }

      // 14. Reset Database
      if (e.target.id === "btn-reset-database") {
        if (confirm("Reset the embedded SQLite database to the default seed state?")) {
          SQLiteEngine.reset(categories, products, storeInfo, plans, demoAnalytics);
          AppUtils.showToast("Database restored to initial seed state");
          this.handleRoute("/account", false);
        }
        return;
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const searchConsoleButton = document.querySelector("[data-search-console-save], [data-search-console-remove]");
      const tenantId = searchConsoleButton?.dataset.searchConsoleSave ||
        searchConsoleButton?.dataset.searchConsoleRemove;
      if (tenantId) StoreRenderers.loadGoogleSearchStatus(tenantId);
    });

    // Mobile Search Input
    document.addEventListener("keydown", (e) => {
      if (e.target && e.target.id === "mobile-search-input" && e.key === "Enter") {
        const q = e.target.value.trim();
        const drawer = document.getElementById("mobile-nav-drawer");
        if (drawer) drawer.classList.remove("active");
        if (q) this.navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    });
  }
};

window.EshopInventoryBridge = {
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
  getPaystackBanks(tenantId) {
    return this.paystackSetupRequest(
      `/api/payments/paystack/banks?tenant=${encodeURIComponent(tenantId)}`, tenantId, {}, true
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


  // Initialize once DOM is ready
  window.AppController = AppController;
  window.AppUtils = AppUtils;
  // This file used to be an inline script, so DOMContentLoaded always came after src/bootstrap.js.
  // As a module it runs before bootstrap; keep waiting for DOMContentLoaded so init() still sees
  // window.ShopPOSReady.
  if (document.readyState === "complete") {
    AppController.init();
  } else {
    document.addEventListener("DOMContentLoaded", () => AppController.init(), { once: true });
  }

// Shared with the screen and shell modules.
export { AppUtils, SQLiteEngine, StoreRenderers };
