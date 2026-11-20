// Shop builder: the bridge between Litrus Mixer and the local SQLite catalog. Saves are batched in
// src/sqlite.js (the web-builder crash fix); nothing here releases the taxonomy before the builder opens.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers, WEBSITE_BUILDER_DRAFT_SYNC_KEY } from '../../app/main.js';

export const builderCatalogBridge = {
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
};

export const litrusMixerCatalog = {
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
};
