// Routing: current route, leave guard, navigate and handleRoute.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils, SQLiteEngine, StoreRenderers, StudioRenderers, WEBSITE_BUILDER_DRAFT_TENANT_ID } from './main.js';

export const routingController = {
  currentRoute() {
    const h = (window.location.hash || "").replace(/^#/, "");
    return h ? (h.charAt(0) === "/" ? h : "/" + h) : "/";
  },

  // Asks the current screen's leave guard (set by the website builder while it has unsaved changes).
  confirmRouteLeave(nextRoute) {
    if (typeof this.routeLeaveGuard !== "function") return true;
    try {
      return this.routeLeaveGuard(nextRoute) !== false;
    } catch (error) {
      console.error("Could not check the screen for unsaved changes.", error);
      return true;
    }
  },

  navigate(path, openWorkspaceHome = false) {
    /* Hash routing: works from file://, any sub-path, or a hosted page */
    if (this.currentRoute() === path) {
      // Re-showing the same screen rebuilds it, which would drop unsaved builder changes too.
      if (!this.confirmRouteLeave(path)) return;
      this.handleRoute(path); window.scrollTo(0, 0); return;
    }
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
};
