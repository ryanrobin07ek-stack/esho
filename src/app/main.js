// The Craft app shell: router, renderers and controllers. Moved verbatim from the inline
// <script> in index.html; it is being split into src/screens and src/shell modules.
// Screen and shell modules moved out of this file.
import { bagScreen } from '../screens/shop/bag.js';
import { navIcon } from '../nav-icons.js';
import { favoritesScreen } from '../screens/shop/favorites.js';
import { orderConfirmationScreen } from '../screens/shop/order-confirmation.js';
import { categoriesScreen } from '../screens/shop/categories.js';
import { categoryScreen, categoryController } from '../screens/shop/category.js';
import { searchScreen } from '../screens/shop/search.js';
import { productScreen, productController } from '../screens/shop/product.js';
import { checkoutScreen, checkoutController } from '../screens/shop/checkout.js';
import { pagesScreen, pagesController } from '../screens/shop/pages.js';
import { signInScreen } from '../screens/account/sign-in.js';
import { profileScreen } from '../screens/account/profile.js';
import { settingsScreen } from '../screens/account/settings.js';
import { plansScreen } from '../screens/account/plans.js';
import { tenantsScreen, tenantsController } from '../screens/account/tenants.js';
import { homeScreen } from '../screens/home/home.js';
import { renderDashboardVisits } from '../screens/craft/dashboard-visits.js';
import { renderDashboardOverview } from '../screens/craft/dashboard-overview.js';
import { renderDashboardTraffic } from '../screens/craft/dashboard-traffic.js';
import { renderDashboardPerformance } from '../screens/craft/dashboard-performance.js';
import { renderDashboardProductIntelligence } from '../screens/craft/dashboard-product-intelligence.js';
import { renderStoreProducts } from '../screens/craft/store-products.js';
import { renderStoreCategories } from '../screens/craft/store-categories.js';
import { renderStoreInventory } from '../screens/craft/store-inventory.js';
import { renderStoreOrders } from '../screens/craft/store-orders.js';
import { renderStoreBookings } from '../screens/craft/store-bookings.js';
import { renderCrmCustomers } from '../screens/craft/crm-customers.js';
import { renderCrmPoints } from '../screens/craft/crm-points.js';
import { renderCrmSubscribers } from '../screens/craft/crm-subscribers.js';
import { renderCrmNotifications } from '../screens/craft/crm-notifications.js';
import { renderPayments } from '../screens/craft/payments.js';
import { bindDirectPayments } from '../screens/craft/direct-payments.js';
import { newStoreScreen, newStoreDraft, newStoreDraftSave, newStoreEvents } from '../screens/craft/new-store.js';
import { setupLitrusBuilder, builderScreen } from '../screens/builder/builder.js';
import { builderCatalogBridge, litrusMixerCatalog } from '../screens/builder/builder-catalog.js';
import { mountProductPricing, posPricingValues, readProductPricingFields, webPricingValues } from '../screens/main-store/product-pricing-fields.js';
import { visitsController } from './controller-visits.js';
import { activeTenantController, tenantCatalogsController, tenantCatalogCacheController, tenantCatalogLoadController } from './controller-tenant.js';
import { websiteDraftTenantController, websiteDraftApplyController } from './controller-website-draft.js';
import { cloudflareController } from './controller-cloudflare.js';
import { lifecycleController } from './controller-lifecycle.js';
import { themeController } from './controller-theme.js';
import { routingController } from './controller-routing.js';
import { searchInputsController } from './controller-search.js';
import { uploadsController } from './controller-uploads.js';
import { publishModalController } from './controller-publish.js';
import { modalsController } from './controller-modals.js';
import { eventsController } from './controller-events.js';
import { bindAccountSignIn } from './post-render-account.js';
import { bindNewWebsiteForms } from './post-render-new-website.js';
import { bindThemePreviews } from './post-render-theme-previews.js';
import { bindNewsletterSignup } from './post-render-newsletter.js';

// Module scope keeps these names private, as the old IIFE wrapper did; what screen and shell
// modules need is exported at the end.
  // Seed dataset for Craft
export const storeInfo = {
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

export const categories = [];

export const products = [];

// Craft's own pricing, in the currency the shop owner actually earns in. Every tier is a whole
// shop: the first is the till on one phone, the second adds the website and lets a team share the
// till, and the third is for an owner running several shops at once.
export const plans = [
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

export const demoAnalytics = {
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

export const LOCAL_PRODUCT_MEDIA_PREFIX = "craft-local-media:";
export const INDEXEDDB_PRODUCT_MEDIA_PREFIX = "craft-indexeddb-media:";
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

  ...pagesScreen,


  ...categoriesScreen,

  ...categoryScreen,

  ...productScreen,

  ...searchScreen,

  ...bagScreen,

  ...checkoutScreen,

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

  ...signInScreen,

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
      { route: "/account/main-shop", title: "Overview", section: "overview", icon: navIcon("overview") },
      { route: "/store/revenue", title: "Sales", section: "sales", icon: navIcon("sales") },
      { route: "/account/customers", title: "Customers", section: "customers", icon: navIcon("customers") },
      { route: "/store/manage/products", title: "Catalogue", section: "store", icon: navIcon("products") },
      { route: "/account/main-shop/finance", title: "More", section: "more", icon: navIcon("more") }
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
                ${website.id === WEBSITE_BUILDER_DRAFT_TENANT_ID
                  // A draft has no web address yet: plain text, and no "open live website" button.
                  ? `<p class="profile-website-domain">${AppUtils.escapeHTML(website.hostname)}</p>`
                  : `<p class="profile-website-domain"><a href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(website.hostname)}</a></p>`}
              </div>
              ${website.id === WEBSITE_BUILDER_DRAFT_TENANT_ID ? "" : `<a class="profile-website-live" href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener" aria-label="Open ${AppUtils.escapeHTML(website.name)} live website">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>
              </a>`}
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
              ${website.id === WEBSITE_BUILDER_DRAFT_TENANT_ID ? "" /* A draft has no domain, no visitors and nothing on the server to delete yet. */ : `
              <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(website.id)}/domains" data-route="/account/profile/webs/${encodeURIComponent(website.id)}/domains">Domains</a>
              <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(website.id)}/stats" data-route="/account/profile/webs/${encodeURIComponent(website.id)}/stats">Stats</a>
              <button class="btn-secondary profile-website-delete" type="button" data-delete-website="${AppUtils.escapeHTML(website.id)}"${website.id === "main" ? ' disabled title="The main Craft domain cannot be deleted."' : ""}>${deleteLabel}</button>`}
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
        title: "Overview",
        route: "/account/web/studio/dashboard/overview",
        icon: navIcon("overview"),
        tabs: [
          { title: "Overview", route: "/account/web/studio/dashboard/overview", contentPath: "/account/dashboard" },
          { title: "Visits", route: "/account/web/studio/dashboard/visits", contentPath: "/account/main-shop/visits" },
          { title: "Traffic", route: "/account/web/studio/dashboard/traffic", contentPath: "/account/main-shop/traffic" },
          { title: "Performance", route: "/account/web/studio/dashboard/performance", contentPath: "/account/main-shop/performance" },
          { title: "Product intelligence", route: "/account/web/studio/dashboard/product-intelligence", contentPath: "/account/main-shop/product-intelligence" }
        ]
      },
      {
        title: "Web shop",
        route: "/account/web/studio/store/products",
        icon: navIcon("products"),
        tabs: [
          { title: "Products", route: "/account/web/studio/store/products", contentPath: "/store/products" },
          { title: "Categories", route: "/account/web/studio/store/categories", contentPath: "/store/categories" },
          { title: "Inventory", route: "/account/web/studio/store/inventory", contentPath: "/store/inventory" },
          { title: "Orders", route: "/account/web/studio/store/orders", contentPath: "/account/web/studio/store/orders" },
          { title: "Bookings", route: "/account/web/studio/store/bookings", contentPath: "/account/web/studio/store/bookings" }
        ]
      },
      {
        title: "Customers",
        route: "/account/web/studio/crm/customers",
        icon: navIcon("customers"),
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
        icon: navIcon("websites"),
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
        icon: navIcon("payments"),
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

  ...newStoreScreen,

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
        <div data-product-pricing-variants></div><div data-product-pricing-attributes></div>
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
      mountProductPricing(form, product);
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
      const pricing = readProductPricingFields(form, message => { if (status) status.textContent = message; });
      if (!pricing) return;
      const stock = pricing.variants.length ? pricing.stock : Number(values.get("stock"));
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
            ...webPricingValues(pricing),
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
            ...posPricingValues(pricing),
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
          if (posProduct) {
            // publishPosProduct keeps the old web taxonomy when POS has none, and copies no options,
            // so write the chosen values explicitly.
            const published = SQLiteEngine.select("products").find(item => String(item.sku || "") === String(posProduct.sku || ""));
            if (published) {
              SQLiteEngine.saveProduct({
                ...published, id: published.id,
                ...webPricingValues(pricing),
                ...(taxonomy ? {
                  taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
                  taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
                  taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
                  taxonomy_attributes: taxonomy.taxonomyAttributes
                } : {})
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
        return renderStoreOrders.call(this, { orderRows, remoteOrderRows, snapshot });
      }
      if (page.route === "/account/web/studio/store/bookings") {
        return renderStoreBookings.call(this, { bookings, remoteHoldRows, remoteHolds, snapshot });
      }
      if (page.section.title === "Websites") return this.renderWebStudioWebsiteTool(page);
      if (page.route === "/account/web/studio/crm/notifications") {
        return renderCrmNotifications.call(this, { snapshot });
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
      return renderCrmCustomers.call(this, { customerRows, customers, metric, newsletterSubscribers });
    }
    if (path === "/account/customers/loyalty") {
      return renderCrmPoints.call(this, { currency, customerRows, customers, metric });
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
      return renderCrmSubscribers.call(this, { metric, snapshot });
    }
    if (path === "/account/payments") {
      return renderPayments.call(this, { activeTenant });
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
      return renderStoreCategories.call(this, { currency, snapshot, webProducts });
    }
    if (path === "/store/inventory") {
      return renderStoreInventory.call(this, { webProducts });
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
      bindDirectPayments(container);
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

  ...profileScreen,

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

  ...newStoreDraft,

  websiteThemesForPicker() {
    return this.websiteThemes().filter(theme =>
      theme.validation_status === "passed" &&
      (theme.editor_mode === "liquid-html" || theme.editor_mode === "litrus"));
  },

  ...newStoreDraftSave,


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

  ...builderScreen,

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

  ...tenantsScreen,

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

  ...settingsScreen,

  renderWeb() {
    return StudioRenderers.renderMainShopWorkspace("/account/web");
  },

  ...plansScreen,

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









export const WEBSITE_BUILDER_DRAFT_TENANT_ID = "__new_website_draft__";
export const WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY = "ESHOP_NEW_WEBSITE_PREVIOUS_TENANT_V1";
export const WEBSITE_BUILDER_DRAFT_SYNC_KEY = "ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1";

window.localStorage.removeItem("ESHOP_CLOUDFLARE_PUBLISH_TOKEN_V1");

export const AppController = {
  carouselTimer: null,
  carouselIndex: 0,
  lastRenderedPath: null,

  ...visitsController,

  ...activeTenantController,

  ...builderCatalogBridge,

  ...tenantCatalogsController,

  ...websiteDraftTenantController,

  ...tenantCatalogCacheController,

  ...websiteDraftApplyController,

  ...cloudflareController,

  ...tenantCatalogLoadController,

  ...tenantsController,


  ...homeScreen,


  ...lifecycleController,

  ...themeController,

  ...routingController,

  ...newStoreEvents,

  postRenderSetup(path, params) {
    const draftEditor = params.get("new") === "1" && params.get("edit") === "1";
    if (path === "/") {
      void this.loadHomeDashboard();
      // First-run setup guide and the Get started checklist (src/onboarding).
      void import("../onboarding/onboarding.js").then(module => module.onHomeShown({ SQLiteEngine }));
    }
    if (path === "/account/web/studio/websites/webmaker") {
      this.bindWebsiteBuilderEvents();
      // Categories are never preloaded from Store or POS: the owner adds the ones this shop needs,
      // or brings them in with the products they pick from Store.
    }
    setupLitrusBuilder.call(this, params, path);
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
    bindAccountSignIn.call(this);
    bindNewWebsiteForms.call(this, params);

    bindThemePreviews.call(this, draftEditor);



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

    bindNewsletterSignup.call(this);

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

  ...pagesController,

  ...searchInputsController,

  ...categoryController,

  ...productController,

  ...checkoutController,


  ...uploadsController,

  ...litrusMixerCatalog,

  ...publishModalController,

  ...modalsController,

  ...eventsController,
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
