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
import { engineCatalog } from './engine-catalog.js';
import { engineCart } from './engine-cart.js';
import { engineStore } from './engine-store.js';
import { storeInfo, heroSlides, categories, products, plans, demoAnalytics } from './seed-data.js';
import { WEBSITE_BUSINESS_TYPE_GROUPS, WEBSITE_BUSINESS_TYPE_THEME_OVERRIDES, WEBSITE_THEME_BUSINESS_GROUPS, webServiceDurationOptions } from './website-business-types.js';
import { LOCAL_PRODUCT_MEDIA_PREFIX, INDEXEDDB_PRODUCT_MEDIA_PREFIX, localProductMediaDatabasePromise, openLocalProductMediaDatabase } from './local-product-media.js';
export { LOCAL_PRODUCT_MEDIA_PREFIX, INDEXEDDB_PRODUCT_MEDIA_PREFIX, openLocalProductMediaDatabase } from './local-product-media.js';
export { webServiceDurationOptions } from './website-business-types.js';
export { storeInfo, categories, products, plans, demoAnalytics } from './seed-data.js';







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

  ...engineCatalog,

  ...engineCart,

  ...engineStore,
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
