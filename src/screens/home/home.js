// Craft home screen (/): the launchpad and its summary dashboard.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, StudioRenderers } from '../../app/main.js';

export const homeScreen = {
  renderLaunchpad() {
    document.title = "Home — Craft";
    const hasAccountSession = Boolean(window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1"));
    const username = hasAccountSession
      ? window.localStorage.getItem("ESHOP_ACCOUNT_USERNAME_V1")?.trim() || "there"
      : "there";
    return `
      <main class="home-screen" aria-label="Craft home">
        <header class="home-screen-header">
          <p class="home-screen-greeting">Hi, ${AppUtils.escapeHTML(username)} <span aria-hidden="true">👋</span></p>
          <a class="home-screen-profile" href="/app-account" data-route="/app-account" aria-label="Account" title="Account">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2z"/></svg>
          </a>
        </header>
        <section class="home-screen-main" aria-label="Shop workspaces">
          <div class="home-launcher-group" role="group" aria-label="POS and workspaces">
            <a class="home-pos-card" href="/pos" data-route="/pos" aria-label="Open POS">
              <span class="home-pos-mark" aria-hidden="true">POS</span>
              <span class="home-pos-copy"><strong>Open POS</strong><small>Start a sale or manage payments</small></span>
              <span class="home-pos-arrow" aria-hidden="true">→</span>
            </a>
            <nav class="home-workspace-grid" aria-label="Choose a workspace">
              <a class="home-workspace-card home-workspace-card-main" href="/account/main-shop" data-route="/account/main-shop" aria-label="Main Store">
                <strong>Main Store</strong>
                <small>Products, orders and inventory</small>
              </a>
              <a class="home-workspace-card home-workspace-card-craft" href="/account/web" data-route="/account/web" aria-label="Craft Web Studio">
                <strong>Craft</strong>
                <small>Build and manage your storefront</small>
              </a>
            </nav>
            <nav class="home-shortcut-grid" aria-label="Quick actions">
              <a class="home-shortcut-link" href="/store/products" data-route="/store/products">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3z"/><path d="M4 7.5V16l8 5 8-5V7.5M12 12v9"/></svg>
                <span>Products</span>
              </a>
              <a class="home-shortcut-link" href="/store/inventory" data-route="/store/inventory">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M7 4v4M12 10v4M17 16v4"/></svg>
                <span>Inventory</span>
              </a>
              <a class="home-shortcut-link" href="/store/orders" data-route="/store/orders">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/></svg>
                <span>Orders</span>
              </a>
              <a class="home-shortcut-link" href="/store/categories" data-route="/store/categories">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
                <span>Categories</span>
              </a>
            </nav>
          </div>
          <section class="home-dashboard" data-home-dashboard aria-label="Store overview" aria-live="polite" aria-busy="true">
            <p class="home-dashboard-loading" role="status">Loading your store overview…</p>
            <div class="home-dashboard-skeleton" aria-hidden="true">
              <div class="home-metric-grid">
                ${Array.from({ length: 3 }, () => `<article class="home-data-card"><span class="home-data-label home-skeleton-line is-short"></span><strong class="home-data-value home-skeleton-line is-value"></strong><small class="home-data-note home-skeleton-line is-medium"></small></article>`).join("")}
              </div>
              <div class="home-panel-grid">
                <section class="home-panel home-panel-compact">
                  <div class="home-panel-heading"><div><span class="home-panel-kicker home-skeleton-line is-short"></span><h2 class="home-skeleton-line is-medium is-heading"></h2></div></div>
                </section>
                <section class="home-panel home-panel-compact">
                  <div class="home-panel-heading"><div><span class="home-panel-kicker home-skeleton-line is-short"></span><h2 class="home-skeleton-line is-medium is-heading"></h2></div></div>
                  ${Array.from({ length: 2 }, () => `<div class="home-attention-row"><span><strong class="home-skeleton-line is-medium"></strong><small class="home-skeleton-line is-long"></small></span><span class="home-attention-count home-skeleton-line"></span></div>`).join("")}
                </section>
              </div>
              <section class="home-panel">
                <div class="home-panel-heading"><div><span class="home-panel-kicker home-skeleton-line is-short"></span><h2 class="home-skeleton-line is-medium is-heading"></h2></div><span class="home-skeleton-line is-short"></span></div>
                ${Array.from({ length: 3 }, () => `<div class="home-recent-row"><div class="home-recent-copy"><strong class="home-skeleton-line is-medium"></strong><small class="home-skeleton-line is-short"></small></div><div class="home-recent-total"><strong class="home-skeleton-line is-short"></strong><small class="home-skeleton-line is-medium"></small></div></div>`).join("")}
              </section>
            </div>
          </section>
        </section>
      </main>
    `;
  },
  async loadHomeDashboard() {
    const dashboard = document.querySelector("[data-home-dashboard]");
    if (!dashboard) return;
    try {
      const snapshot = await StudioRenderers.getMainShopSnapshot();
      if (!dashboard.isConnected) return;
      const currency = String(snapshot.currency || "KES").toUpperCase();
      const excludedStatuses = new Set(["refunded", "voided", "cancelled", "canceled", "failed"]);
      const sales = snapshot.sales.filter(sale =>
        sale.currency === currency && !excludedStatuses.has(String(sale.status || "").toLowerCase()));
      const localDateKey = value => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      };
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayKey = localDateKey(today);
      const yesterdayKey = localDateKey(yesterday);
      const todaySales = sales.filter(sale => localDateKey(sale.date) === todayKey);
      const yesterdaySales = sales.filter(sale => localDateKey(sale.date) === yesterdayKey);
      const totalFor = items => items.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
      const todayTotal = totalFor(todaySales);
      const lowStockCount = snapshot.products.filter(product =>
        product.stock != null && Number.isFinite(Number(product.stock)) && Number(product.stock) <= 5).length;
      const pendingPaymentCount = sales.filter(sale =>
        Number(sale.collected) < Number(sale.total)).length;
      const money = amount => StudioRenderers.formatMainShopMoney(amount, currency);
      const recentSales = sales.slice(0, 3);
      const recentRows = recentSales.length
        ? recentSales.map(sale => {
          const itemName = (sale.lineItems || []).map(item => String(item.name || "").trim()).find(Boolean)
            || `${Number(sale.itemCount) || 0} items`;
          const nameCharacters = Array.from(itemName);
          const itemLabel = nameCharacters.length > 12
            ? `${nameCharacters.slice(0, 11).join("")}…`
            : itemName;
          const channelLabel = /web|online/i.test(String(sale.channel || "")) ? "Web" : "POS";
          return `<div class="home-recent-row">
            <div class="home-recent-copy">
              <strong>${AppUtils.escapeHTML(itemLabel)}</strong>
              <small>${channelLabel}</small>
            </div>
            <div class="home-recent-total">
              <strong>${AppUtils.escapeHTML(money(sale.total))}</strong>
              <small>Payment</small>
            </div>
          </div>`;
        }).join("")
        : `<p class="home-empty">No sales recorded yet.</p>`;
      dashboard.innerHTML = `
        <div class="home-metric-grid" aria-label="Today’s sales summary">
          <article class="home-data-card">
            <span class="home-data-label">Sales today</span>
            <strong class="home-data-value">${AppUtils.escapeHTML(money(todayTotal))}</strong>
            <small class="home-data-note">${todaySales.length} sale${todaySales.length === 1 ? "" : "s"} recorded · includes unpaid</small>
          </article>
          <article class="home-data-card">
            <span class="home-data-label">Orders</span>
            <strong class="home-data-value">${todaySales.length}</strong>
            <small class="home-data-note">Today across POS and web</small>
          </article>
          <article class="home-data-card">
            <span class="home-data-label">Average order</span>
            <strong class="home-data-value">${AppUtils.escapeHTML(money(todaySales.length ? todayTotal / todaySales.length : 0))}</strong>
            <small class="home-data-note">Today</small>
          </article>
        </div>
        <div class="home-panel-grid">
          <section class="home-panel home-panel-compact" aria-label="Yesterday’s sales">
            <div class="home-panel-heading">
              <div><span class="home-panel-kicker">Yesterday</span><h2>${yesterdaySales.length} sale${yesterdaySales.length === 1 ? "" : "s"}</h2></div>
            </div>
          </section>
          <section class="home-panel home-panel-compact" aria-label="Needs attention">
            <div class="home-panel-heading"><div><span class="home-panel-kicker">Needs attention</span><h2>Store checks</h2></div></div>
            <div class="home-attention-row"><span><strong>Low stock</strong><small>5 units or fewer</small></span><span class="home-attention-count">${lowStockCount}</span></div>
            <div class="home-attention-row"><span><strong>Payment follow-up</strong><small>Unpaid or part-paid sales</small></span><span class="home-attention-count">${pendingPaymentCount}</span></div>
          </section>
        </div>
        <section class="home-panel" aria-label="Recent orders">
          <div class="home-panel-heading">
            <div><span class="home-panel-kicker">Activity</span><h2>Recent orders</h2></div>
            <a class="home-panel-link" href="/store/orders" data-route="/store/orders">View all</a>
          </div>
          ${recentRows}
        </section>
      `;
      dashboard.setAttribute("aria-busy", "false");
    } catch (error) {
      console.error("Could not load the Craft home dashboard.", error);
      if (dashboard.isConnected) {
        dashboard.innerHTML = `<p class="home-dashboard-error" role="alert">Store overview could not be loaded: ${AppUtils.escapeHTML(error instanceof Error ? error.message : String(error))}</p>`;
        dashboard.setAttribute("aria-busy", "false");
      }
    }
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through AppController.renderLaunchpad(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = AppController.renderLaunchpad();
  void AppController.loadHomeDashboard();
}

export function unmount() {}
