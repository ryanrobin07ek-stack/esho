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
import { businessCloudActions } from './studio-business-cloud.js';
import { mainShopWorkspaceLoader } from './studio-workspace-load.js';
import { mainShopContentRenderer } from './studio-main-shop-content.js';
import { paystackSetupBindings } from './studio-paystack.js';
import { mainStoreManageScreens } from './studio-main-store-manage.js';
import { ordersPanels } from './studio-orders.js';
import { splitShopScreen } from './studio-split-shop.js';
import { snapshotCache, snapshotData } from './studio-snapshot.js';
import { workspaceShells, webStudioShells } from './studio-workspace.js';

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

  ...snapshotCache,

  ...signInScreen,

  ...workspaceShells,

  ...newStoreScreen,

  ...webStudioShells,

  ...snapshotData,

  ...splitShopScreen,

  ...mainStoreManageScreens,

  ...ordersPanels,

  ...mainShopContentRenderer,

  ...paystackSetupBindings,

  ...businessCloudActions,

  ...mainShopWorkspaceLoader,

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
