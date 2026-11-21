// Shops (tenants) screen (/account/tenants) and its live tenant list.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, StoreRenderers, StudioRenderers } from '../../app/main.js';
import { DOMAIN } from '../../app/domain.js';

export const tenantsScreen = {
  renderTenantsManager() {
    AppUtils.updateSEO({
      title: "My Shops — Craft Studio",
      description: "Manage the online shops linked to your Craft account."
    });
    return `
      ${StoreRenderers.renderNavbar('/account/tenants')}
      <main class="container management-module-main" style="padding:24px 0 80px; max-width:800px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading" style="font-size:2rem;">My shops</h1>
            <p style="color:var(--text-muted); font-size:.875rem;">Your main website is <code>${DOMAIN.apex}</code>. Other websites you create have separate products, categories, and addresses.</p>
          </div>
        </div>
        <section style="margin:20px 0; padding:18px; border:1px solid var(--border); border-radius:var(--radius);">
          <h2 style="font-size:1.05rem; margin:0 0 12px;">Create a shop</h2>
          <p style="margin:0 0 12px; color:var(--text-muted); font-size:.85rem;">Sign in to your Craft account first. Each new shop gets its own website and catalog.</p>
          <a class="btn-secondary" href="/account/web/studio/websites/webmaker" data-start-new-website>Create a shop or website</a>
        </section>
        <div id="tenant-manager-status" role="status" style="color:var(--text-muted); margin:12px 0;"></div>
        <div id="tenant-manager-list" class="product-list" style="padding:0 12px;"></div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

export const tenantsController = {
  async refreshTenantList(container) {
    const status = document.getElementById("tenant-manager-status");
    if (status) status.textContent = "Loading your shops…";
    const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
    const localTenants = this.tenantCatalogs().filter(item =>
      item.tenant_id !== "__new_website_draft__");
    let remoteTenants = [];
    if (sessionToken) {
      const result = await this.cloudflareRequest("/api/tenants", {}, "main", false, sessionToken);
      remoteTenants = Array.isArray(result.tenants) ? result.tenants : [];
    }
    const tenantsById = new Map();
    for (const tenant of [...localTenants, ...remoteTenants]) {
      if (!tenant?.id && !tenant?.tenant_id) continue;
      const id = tenant.id || tenant.tenant_id;
      if (this.isWebsiteBuilderDraftTenant(id)) continue;
      const saved = localTenants.find(item => item.tenant_id === id);
      tenantsById.set(id, {
        ...saved,
        ...tenant,
        id,
        name: tenant.name || saved?.name || id,
        hostname: tenant.hostname || saved?.hostname || DOMAIN.shopHost(id)
      });
    }
    const tenants = [...tenantsById.values()].sort((a, b) =>
      a.id === "main" ? -1 : b.id === "main" ? 1 : a.name.localeCompare(b.name));
    container.innerHTML = tenants.map(tenant => {
      const active = this.getActiveTenant().id === tenant.id;
      return `
        <article class="product-list-item" style="display:flex; align-items:center; gap:12px; padding:14px;">
          <div style="min-width:0; flex:1;">
            <strong style="display:block;">${AppUtils.escapeHTML(tenant.name)}</strong>
            <small style="display:block; color:var(--text-muted);">${AppUtils.escapeHTML(tenant.hostname)}</small>
          </div>
          <a class="option-chip" href="https://${encodeURIComponent(tenant.hostname)}" target="_blank" rel="noopener">Open</a>
          <button type="button" class="btn-secondary" data-load-tenant="${AppUtils.escapeHTML(tenant.id)}" ${active ? "disabled" : ""}>${active ? "Editing" : "Edit shop"}</button>
        </article>`;
    }).join("");
    if (status) status.textContent = sessionToken
      ? `${tenants.length} shop${tenants.length === 1 ? "" : "s"} linked to your account.`
      : `${tenants.length} shop${tenants.length === 1 ? "" : "s"} available on this device. Sign in to see shops linked to your account.`;
    container.querySelectorAll("[data-load-tenant]").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        button.textContent = "Loading…";
        try {
          const tenant = tenants.find(item => item.id === button.dataset.loadTenant);
          if (!tenant) throw new Error("Selected shop is no longer in the Cloudflare shop list.");
          await this.loadTenantCatalog(tenant);
          AppUtils.showToast(`Now editing ${tenant.name}`);
          this.navigate("/account/products");
        } catch (error) {
          AppUtils.showToast(error.message || "Could not load this shop.", "danger");
          button.disabled = false;
          button.textContent = "Edit shop";
        }
      };
    });
  },
  initTenantManager() {
    const tenantList = document.getElementById("tenant-manager-list");
    if (!tenantList) return;
    void this.refreshTenantList(tenantList).catch(error => {
      const status = document.getElementById("tenant-manager-status");
      if (status) status.textContent = error.message || "Could not load shops saved on this device.";
    });
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StudioRenderers.renderTenantsManager(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StudioRenderers.renderTenantsManager();
  AppController.initTenantManager();
}

export function unmount() {}
