// New-website draft tenant handling.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils, SQLiteEngine, StudioRenderers, WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY, WEBSITE_BUILDER_DRAFT_SYNC_KEY, WEBSITE_BUILDER_DRAFT_TENANT_ID } from './main.js';

export const websiteDraftTenantController = {
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
    // A new store has the products and categories its owner added in the wizard (by hand or with
    // Add from Store). Replacing them here with the whole Main Store/POS catalogue is what filled
    // every new website with all Store products and wiped the owner's own on the way in.
    draft.products = Array.isArray(draft.products) ? draft.products : [];
    draft.categories = Array.isArray(draft.categories) ? draft.categories : [];
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
        Number(product.duration_minutes) || 0,
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
};

export const websiteDraftApplyController = {
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
      // A service from the wizard keeps its duration and, like the store form, counts no stock.
      const durationMinutes = window.EshopServiceModel.serviceDuration(product) || null;
      const stock = durationMinutes ? null : Math.max(0, Number(product.stock) || 0);
      const saved = SQLiteEngine.saveProduct({
        name: product.name,
        sku: product.sku || "",
        brand: product.brand || "",
        price: Number(product.price) || 0,
        original_price: Number(product.price) || 0,
        cost_price: Math.max(0, Number(product.cost_price) || 0),
        stock,
        duration_minutes: durationMinutes,
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
};
