// SQLiteEngine: start-up, seeding, save/reset and the generic select/insert/update/delete.
// Moved verbatim out of src/app/main.js; main.js spreads these back in at the same spots.

export const engineCore = {
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
};
