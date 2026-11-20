// Craft dashboard product intelligence screen (/account/main-shop/product-intelligence).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account/main-shop/product-intelligence")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderDashboardProductIntelligence({ mostBookedProductRows, mostCartedProductRows, mostViewedProductRows, mostWishlistedProductRows, remoteProductAnalytics, snapshot }) {
      return `<section class="studio-workspace-section">
        <article class="studio-panel"><div class="studio-panel-heading"><div><span class="studio-workspace-kicker">PRODUCT INTELLIGENCE</span><h2>Product rankings</h2></div><button type="button" class="btn-secondary" data-business-product-analytics aria-label="Refresh product activity">Refresh</button></div>
          <p class="studio-panel-note" data-product-analytics-status>${snapshot.remoteProductAnalyticsError
            ? AppUtils.escapeHTML(snapshot.remoteProductAnalyticsError)
            : remoteProductAnalytics
              ? `Updated ${new Date(snapshot.remoteProductAnalyticsUpdatedAt || Date.now()).toLocaleTimeString()}. Batched anonymous activity from the last 30 days; bookings count submitted product holds.`
              : "Activity has not loaded yet. Refresh to load batched product views, cart additions, wishlist saves and bookings from the live storefront."}</p>
        </article>
        ${remoteProductAnalytics ? `<div class="studio-dashboard-grid">
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Most viewed products</h2></div><p class="studio-panel-note">Product page views · last 30 days</p>${mostViewedProductRows}</article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Most added to carts</h2></div><p class="studio-panel-note">Cart additions · last 30 days</p>${mostCartedProductRows}</article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Most wishlisted products</h2></div><p class="studio-panel-note">Anonymous wishlist saves · last 30 days</p>${mostWishlistedProductRows}</article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Most booked products</h2></div><p class="studio-panel-note">Submitted product holds · last 30 days</p>${mostBookedProductRows}</article>
        </div>` : ""}
      </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderDashboardProductIntelligence() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/main-shop/product-intelligence", snapshot, true);
}

export function unmount() {}
