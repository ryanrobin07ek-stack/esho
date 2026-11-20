// Craft dashboard traffic screen (/account/main-shop/traffic).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account/main-shop/traffic")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderDashboardTraffic({ analyticsLoadCard, analyticsVisits, deviceRows, locationGrid, metric, pageRows, snapshot, storefrontUniqueCount, storefrontVisitCount }) {
      const productPageViews = snapshot.remoteAnalytics
        ? (snapshot.remoteAnalytics.product_views || []).reduce((total, item) => total + (Number(item.views) || 0), 0)
        : analyticsVisits.filter(visit => visit.path.startsWith("/product/")).length;
      return `<section class="studio-workspace-section">
        <div class="studio-metric-grid studio-metric-grid-featured">${metric("Total visits", storefrontVisitCount, "", "/account/web/studio/dashboard/visits")}${metric("Unique visitors", storefrontUniqueCount, "", "/account/web/studio/dashboard/visits")}${metric("Product page views", productPageViews, "", "/account/web/studio/dashboard/product-intelligence")}</div>
        ${analyticsLoadCard}
        ${locationGrid}
        <div class="studio-dashboard-grid"><article class="studio-panel"><div class="studio-panel-heading"><h2>Most visited pages</h2></div>${pageRows || `<p class="store-workspace-empty">No pages yet.</p>`}</article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Devices</h2></div>${deviceRows || `<p class="store-workspace-empty">No devices yet.</p>`}</article></div>
      </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderDashboardTraffic() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/main-shop/traffic", snapshot, true);
}

export function unmount() {}
