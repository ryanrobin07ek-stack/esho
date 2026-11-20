// Craft dashboard overview screen (/account/dashboard).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account" || path === "/account/main-shop" || path === "/account/main-shop/" || path === "/account/dashboard")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderDashboardOverview({ currency, metric, paidSales, recentVisitRows, snapshot, storefrontVisitCount, webSales }) {
      const movingProducts = new Map();
      paidSales.forEach(sale => sale.lineItems.forEach(item => movingProducts.set(item.name, (movingProducts.get(item.name) || 0) + item.quantity)));
      const moving = [...movingProducts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const awaiting = SQLiteEngine.select("orders", order => !["paid", "completed", "refunded", "cancelled", "canceled", "failed"].includes(String(order.status || "").toLowerCase()));
      const recentVisitEmpty = `<p class="store-workspace-empty">No visits yet.</p>`;
      return `
        <section class="studio-workspace-section">
          <div class="studio-metric-grid studio-metric-grid-featured">${metric("Paid web revenue", this.formatMainShopMoney(window.EshopRevenue.sumRevenue(webSales), currency), "", "/account/web/studio/store/orders")}${metric("Customer visits", storefrontVisitCount, "", "/account/web/studio/dashboard/visits")}${metric("Awaiting payments", awaiting.length, "", "/account/web/studio/store/orders")}</div>
          <div class="studio-dashboard-grid">
            <article class="studio-panel"><div class="studio-panel-heading"><div><span class="studio-workspace-kicker">RECENT ACTIVITY</span><h2 class="studio-overview-activity-title">Storefront visit history</h2></div><div class="studio-overview-activity-actions"><button type="button" class="studio-overview-load" data-business-cloud-analytics>Load</button><a href="/account/main-shop/visits" data-route="/account/main-shop/visits">View all</a></div></div>
              <p class="studio-panel-note" data-business-cloud-analytics-status role="status">${snapshot.remoteAnalyticsError
                ? "Could not load visits."
                : snapshot.remoteAnalytics
                  ? "Recent visits."
                  : "Analytics not loaded."}</p>
              ${recentVisitRows || recentVisitEmpty}
            </article>
            <article class="studio-panel"><div class="studio-panel-heading"><div><span class="studio-workspace-kicker">WEB SHOP</span><h2 class="studio-overview-activity-title">What’s moving</h2></div><a href="/account/main-shop/performance" data-route="/account/main-shop/performance">Performance</a></div>
              ${moving.map(([name, quantity]) => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(name)}</strong><span>${quantity} sold</span></article>`).join("") || `<p class="store-workspace-empty">No paid product sales yet. Completed sales will show the products gaining momentum.</p>`}
            </article>
          </div>
        </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderDashboardOverview() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/dashboard", snapshot, true);
}

export function unmount() {}
