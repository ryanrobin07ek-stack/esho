// Craft cloud connection and requests.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { SQLiteEngine, WEBSITE_BUILDER_DRAFT_TENANT_ID } from './main.js';

export const cloudflareController = {
  cloudflareConnection(tenantId = this.getActiveTenant().id) {
    const tenant = this.tenantCatalogs().find(item => item.tenant_id === tenantId);
    const token = tenant?.owner_token ||
      window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") ||
      (tenantId === "main"
        ? this.tenantCatalogs().find(item => item.tenant_id === "main")?.owner_token
        : "") ||
      "";
    const endpoint = window.localStorage.getItem("ESHOP_CLOUDFLARE_PUBLISH_URL_V1") ||
      "https://eshop-storefront.ryanrobin07-ek.workers.dev";
    let origin;
    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
        throw new Error("Use an HTTPS Cloudflare Worker URL.");
      }
      origin = url.origin;
    } catch (error) {
      throw new Error(error.message || "Enter a valid Cloudflare Worker URL.");
    }
    return { token, origin };
  },

  async restoreAccountWebsites(tenants, origin) {
    for (const tenant of tenants || []) {
      if (!tenant.owner_token || !tenant.id) continue;
      const response = await fetch(new URL(`/api/catalog?tenant=${encodeURIComponent(tenant.id)}&private=1`, origin), {
        headers: { Authorization: `Bearer ${tenant.owner_token}` }
      });
      const catalog = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(catalog.error || `Could not restore ${tenant.name || tenant.id}.`);
      const existing = this.tenantCatalogs().find(item => item.tenant_id === tenant.id);
      if (existing) {
        existing.owner_token = tenant.owner_token;
        existing.name = tenant.name || existing.name;
        existing.hostname = tenant.hostname || existing.hostname;
      } else {
        this.tenantCatalogs().push({
          tenant_id: tenant.id,
          name: tenant.name || tenant.id,
          hostname: tenant.hostname || `${tenant.id}.rrobin.co.ke`,
          owner_token: tenant.owner_token,
          products: Array.isArray(catalog.products) ? catalog.products : [],
          categories: Array.isArray(catalog.categories) ? catalog.categories : [],
          inventory: Array.isArray(catalog.inventory) ? catalog.inventory : [],
          store: catalog.store && typeof catalog.store === "object" ? catalog.store : {},
          pages: Array.isArray(catalog.pages) ? catalog.pages : []
        });
      }
    }
    SQLiteEngine.save();
    await window.ShopSQLite.flush();
  },

  async cloudflareRequest(path, options = {}, tenantId = this.getActiveTenant().id, anonymous = false, credentialOverride = "") {
    let draftLitrusImageRequest = false;
    if (this.isWebsiteBuilderDraftTenant(this.getActiveTenant().id) ||
        this.isWebsiteBuilderDraftTenant(tenantId)) {
      const [route, query] = this.currentRoute().split("?");
      const routeParams = new URLSearchParams(query || "");
      const finalTenantSetup = route === "/account/web/site" &&
        routeParams.get("new") === "1" &&
        routeParams.get("finish") === "1";
      const pathUrl = new URL(path, window.location.origin);
      const bootstrapTenantId = pathUrl.searchParams.get("tenant");
      const bootstrapRequest = finalTenantSetup && !!credentialOverride &&
        tenantId !== WEBSITE_BUILDER_DRAFT_TENANT_ID && bootstrapTenantId === tenantId &&
        (pathUrl.pathname === "/api/catalog" &&
          String(options.method || "GET").toUpperCase() === "PUT" ||
          pathUrl.pathname === "/api/theme-publish" &&
          String(options.method || "GET").toUpperCase() === "POST");
      draftLitrusImageRequest = route === "/account/web/site" &&
        routeParams.get("new") === "1" &&
        routeParams.get("edit") === "1" &&
        routeParams.get("theme") === "litrus-mixer" &&
        tenantId === "main" &&
        pathUrl.pathname === "/api/images/draft-search" &&
        String(options.method || "GET").toUpperCase() === "POST";
      const rollbackCreatedTenant = finalTenantSetup && !!credentialOverride &&
        tenantId !== WEBSITE_BUILDER_DRAFT_TENANT_ID &&
        path === `/api/tenants/${encodeURIComponent(tenantId)}` &&
        String(options.method || "GET").toUpperCase() === "DELETE";
      const creatingTenant = path === "/api/tenants" &&
        String(options.method || "GET").toUpperCase() === "PUT" &&
        finalTenantSetup;
      if (!creatingTenant && !bootstrapRequest && !rollbackCreatedTenant && !draftLitrusImageRequest) {
        throw new Error("Cloudflare requests are disabled for the local website draft until final setup.");
      }
    }
    const connection = this.cloudflareConnection(tenantId);
    const token = draftLitrusImageRequest ? "" : credentialOverride || connection.token;
    const { origin } = connection;
    if (!token && !anonymous) throw new Error(tenantId === "main"
      ? "Sign in to the Craft account that owns the main website. Tap Sign in at the top of the screen."
      : "Sign in to the Craft account that owns this shop. Tap Sign in at the top of the screen.");
    let response;
    try {
      response = await fetch(new URL(path, origin), {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(options.body ? { "Content-Type": "application/json" } : {})
        }
      });
    } catch (error) {
      if (error instanceof TypeError && navigator.onLine === false) {
        throw new Error("You're offline. This action needs an internet connection; your local app data is still available.");
      }
      throw error;
    }
    const body = await response.text();
    let result;
    try {
      result = JSON.parse(body);
    } catch {
      throw new Error(body || `Cloudflare returned HTTP ${response.status}.`);
    }
    if (!response.ok) {
      const error = new Error(result.error || `Cloudflare returned HTTP ${response.status}.`);
      error.status = response.status;
      if (typeof result.error_code === "string") error.code = result.error_code;
      throw error;
    }
    return result;
  },
};
