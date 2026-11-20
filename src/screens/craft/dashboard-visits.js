// Craft dashboard visits screen (/account/main-shop/visits).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account/main-shop/visits")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderDashboardVisits({ analyticsLoadCard, analyticsVisits, locationGrid, metric, recentVisitRows, snapshot, storefrontUniqueCount, storefrontVisitCount }) {
      const visitFrequency = snapshot.remoteAnalytics
        ? (storefrontVisitCount / Math.max(1, storefrontUniqueCount)).toFixed(1)
        : analyticsVisits.length ? (analyticsVisits.length / Math.max(1, new Set(analyticsVisits.map(visit => visit.session_id)).size)).toFixed(1) : "—";
      return `<section class="studio-workspace-section">
        <div class="studio-metric-grid studio-metric-grid-featured">${metric("Visits", storefrontVisitCount, "", "/account/web/studio/dashboard/traffic")}${metric("Unique visitors", storefrontUniqueCount, "", "/account/web/studio/dashboard/traffic")}${metric(snapshot.remoteAnalytics ? "Visits per visitor" : "Pages per visit", visitFrequency, "", "/account/web/studio/dashboard/traffic")}</div>
        ${analyticsLoadCard}
        ${locationGrid}
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Visit history</h2></div>
          ${snapshot.remoteAnalytics ? recentVisitRows || `<p class="store-workspace-empty">No visits yet.</p>` : analyticsVisits.slice(0, 100).map(visit => `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(visit.path || "/")}</strong><span>${AppUtils.escapeHTML(visit.device || "Unknown device")}</span></div><span>${AppUtils.escapeHTML(AppUtils.formatDateTime(visit.created_at))}</span></article>`).join("") || `<p class="store-workspace-empty">No visits yet.</p>`}
        </article></section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderDashboardVisits() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/main-shop/visits", snapshot, true);
}

export function unmount() {}
