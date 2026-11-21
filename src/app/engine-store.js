// SQLiteEngine: store details, product and category writes, stock and plans.
// Moved verbatim out of src/app/main.js; main.js spreads these back in at the same spots.
import { plans, storeInfo } from './main.js';

export const engineStore = {
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
