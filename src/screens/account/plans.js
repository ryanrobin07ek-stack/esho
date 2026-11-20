// Plans screen (/account/plans).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StoreRenderers, StudioRenderers } from '../../app/main.js';

export const plansScreen = {
  renderPlans() {
    const plans = SQLiteEngine.getPlans();

    AppUtils.updateSEO({
      title: "Plans — Craft",
      description: "Scale your commerce house with our tiered enterprise plans."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/plans')}
      <main class="container management-module-main plans-main" style="padding: 48px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1>Plans &amp; pricing</h1>
          </div>
        </div>

        <div class="plans-list">
          ${plans.map(p => `
            <article class="plan-card ${p.is_current ? "is-current" : ""}">
              ${(p.is_current || p.badge) ? `
                <div class="plan-card-topline">
                  <span class="product-badge ${p.is_current ? "badge-flagship" : ""}">${p.is_current ? "Current Plan" : AppUtils.escapeHTML(p.badge)}</span>
                </div>
              ` : ""}
              <h2>${AppUtils.escapeHTML(p.name)}</h2>
              <p class="plan-card-description">${AppUtils.escapeHTML(p.description)}</p>
              <div class="plan-card-price">
                <strong>KES ${Number(p.price).toLocaleString("en-KE")}</strong>
                <span>/${AppUtils.escapeHTML(p.billing_period || "month")}</span>
              </div>
              <ul class="plan-card-features">
                ${(p.features || []).slice(0, 3).map(f => `
                  <li>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${AppUtils.escapeHTML(f)}</span>
                  </li>
                `).join("")}
              </ul>
              ${(p.features || []).length > 3 ? `
                <details class="plan-card-more">
                  <summary>See ${p.features.length - 3} more features</summary>
                  <ul class="plan-card-features">
                    ${p.features.slice(3).map(f => `
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>${AppUtils.escapeHTML(f)}</span>
                      </li>
                    `).join("")}
                  </ul>
                </details>
              ` : ""}
              <div>
                ${p.is_current ? `
                  <button class="btn-secondary plan-card-action" style="cursor: default; background: var(--surface-subtle);">Active Plan</button>
                ` : `
                  <button class="btn-primary plan-card-action" data-action="upgrade-plan" data-slug="${p.slug}">Choose ${AppUtils.escapeHTML(p.name)}</button>
                `}
              </div>
            </article>
          `).join("")}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StudioRenderers.renderPlans(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StudioRenderers.renderPlans();
}

export function unmount() {}
