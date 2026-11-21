// Active tenant, tenant catalogs and the studio appearance.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { SQLiteEngine, StudioRenderers } from './main.js';

export const activeTenantController = {
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
};

export const tenantCatalogsController = {
  tenantCatalogs() {
    if (!Array.isArray(SQLiteEngine.db.tables.tenant_catalogs)) {
      SQLiteEngine.db.tables.tenant_catalogs = [];
    }
    return SQLiteEngine.db.tables.tenant_catalogs;
  },
};

export const tenantCatalogCacheController = {
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
};

export const tenantCatalogLoadController = {
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
};
