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
import { posPublishActions } from './studio-pos-publish.js';
import { managerRenderers, inventoryRenderer, staticPageRenderer } from './studio-managers.js';
import { inventoryBridgeMethods } from './inventory-bridge.js';
import { appUtilsMethods } from './app-utils.js';
import { storeRendererMethods } from './store-renderers.js';
import { engineCore } from './engine-core.js';

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

  ...engineCore,

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
export const openLocalProductMediaDatabase = () => {
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
  ...appUtilsMethods,
};

  // Storefront View Renderers for Craft



const StoreRenderers = {
  ...storeRendererMethods,

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

  ...posPublishActions,

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

  ...managerRenderers,

  ...tenantsScreen,

  ...inventoryRenderer,

  ...settingsScreen,

  renderWeb() {
    return StudioRenderers.renderMainShopWorkspace("/account/web");
  },

  ...plansScreen,

  ...staticPageRenderer,
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
  ...inventoryBridgeMethods,
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
