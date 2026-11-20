// Craft CRM points screen (/account/customers/loyalty).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account/customers/loyalty")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderCrmPoints({ currency, customerRows, customers, metric }) {
      const pointsPerVisit = Number(this.getWorkspaceSetting("points_per_visit", 1));
      const pointsPerCurrency = Number(this.getWorkspaceSetting("points_per_currency", 0));
      return `<section class="studio-workspace-section">
        <div class="studio-metric-grid studio-metric-grid-featured">${metric("Points per visit", pointsPerVisit)}${metric("Pts / " + AppUtils.escapeHTML(currency) + " spent", pointsPerCurrency)}${metric("Customers with points", customers.filter(customer => customer.points > 0).length)}</div>
        <form class="store-workspace-form crm-points-rules" data-studio-form="loyalty-settings"><h2>Points rules</h2><p>Points per verified visit and each full ${AppUtils.escapeHTML(currency)} spent.</p><div class="studio-form-grid"><label>Pts / verified visit<input name="pointsPerVisit" type="number" min="0" step="1" value="${pointsPerVisit}" required></label><label>Pts / full ${AppUtils.escapeHTML(currency)} spent<input name="pointsPerCurrency" type="number" min="0" step="1" value="${pointsPerCurrency}" required></label></div><button type="submit" class="btn-primary">Save rules</button><p role="status"></p></form>
        <form class="store-workspace-form" data-studio-form="points-adjust"><h2>Record verified activity or adjust points</h2><label>Customer<select name="customerKey" required><option value="">Choose a customer</option>${customers.map(customer => `<option value="${AppUtils.escapeHTML(customer.key)}">${AppUtils.escapeHTML(customer.name)} · ${customer.points} points</option>`).join("")}</select></label><div class="studio-form-grid"><label>Verified paid purchase amount (${AppUtils.escapeHTML(currency)})<input name="purchaseAmount" type="number" min="0" step="0.01" placeholder="Optional"></label><label>Manual adjustment (+/- points)<input name="delta" type="number" step="1" placeholder="Optional"></label></div><label class="studio-check-label"><input name="verifiedVisit" type="checkbox" value="yes"> Add points for one verified visit</label><label>Reason for manual adjustment<input name="reason" maxlength="140" placeholder="Required only for a manual adjustment"></label><button type="submit" class="btn-primary">Record points</button><p role="status"></p></form>
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Points balances</h2></div>${customerRows || `<p class="store-workspace-empty">No identified customers yet.</p>`}</article>
      </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderCrmPoints() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/customers/loyalty", snapshot, true);
}

export function unmount() {}
