// Craft dashboard performance screen (/account/main-shop/performance).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account/main-shop/performance" || path === "/store/revenue")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderDashboardPerformance({ abandonedRows, activityRows, currency, dayStart, metric, monthStart, orderRows, paidSales, revenueIn, salesIn, uniqueIn, weekStart }) {
      const weekSales = salesIn(weekStart);
      const monthSales = salesIn(monthStart);
      const pendingOrders = SQLiteEngine.select("orders", order => !["paid", "completed", "refunded", "cancelled", "canceled", "failed"].includes(String(order.status || "").toLowerCase()));
      const cart = SQLiteEngine.getCart();
      const performanceMetrics = [
        ["Visits", [uniqueIn(dayStart), uniqueIn(weekStart), uniqueIn(monthStart)], "/account/web/studio/dashboard/traffic"],
        ["Orders", [salesIn(dayStart).length, weekSales.length, monthSales.length], "/account/web/studio/store/orders"],
        ["Revenue", [
          this.formatMainShopMoney(revenueIn(dayStart), currency),
          this.formatMainShopMoney(revenueIn(weekStart), currency),
          this.formatMainShopMoney(revenueIn(monthStart), currency)
        ], "/account/web/studio/store/orders"]
      ];
      return `<section class="studio-workspace-section">
        <div class="studio-performance-metrics" aria-label="Visits, orders, and revenue">
          ${performanceMetrics.map(([label, values, route]) => `<a class="studio-performance-metric" href="${route}" data-route="${route}" aria-label="${label}">
            <strong class="studio-performance-label">${label}</strong>
            ${values.map((value, index) => `<span class="studio-performance-period"><small>${["Today", "This week", "This month"][index]}</small><strong>${AppUtils.escapeHTML(String(value))}</strong></span>`).join("")}
          </a>`).join("")}
        </div>
        <div class="studio-dashboard-grid"><article class="studio-panel"><div class="studio-panel-heading"><h2>Paid conversion</h2></div>${metric("Paid web orders", paidSales.length)}${metric("Paid web order value", this.formatMainShopMoney(window.EshopRevenue.sumRevenue(paidSales), currency))}<p class="studio-panel-note">Conversion rate is not calculated until visits and paid orders can be joined using shared visitor attribution.</p></article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Orders awaiting payment</h2><a href="/store/orders" data-route="/store/orders">Open orders</a></div>${orderRows(pendingOrders)}</article></div>
        <div class="studio-dashboard-grid"><article class="studio-panel"><div class="studio-panel-heading"><h2>Checkouts without an order</h2></div><p class="studio-panel-note">Browser-local sessions that entered checkout and have no later order record.</p>${abandonedRows || `<p class="store-workspace-empty">No unfinished checkout sessions recorded.</p>`}</article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Product likes &amp; baskets</h2></div>${activityRows || `<p class="store-workspace-empty">Product activity will appear after visitors like or add items to their basket.</p>`}</article></div>
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Current basket on this device</h2></div>${cart.map(item => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(item.name || "Store product")}</strong><span>${Number(item.quantity) || 1} in basket</span></article>`).join("") || `<p class="store-workspace-empty">No active basket on this device.</p>`}</article>
      </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderDashboardPerformance() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/main-shop/performance", snapshot, true);
}

export function unmount() {}
