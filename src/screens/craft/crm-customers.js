// Craft CRM customers screen (/account/customers).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account/customers" || path === "/account/customers/")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderCrmCustomers({ customerRows, customers, metric, newsletterSubscribers }) {
      return `<section class="studio-workspace-section"><div class="studio-metric-grid studio-metric-grid-featured">${metric("Identified web customers", customers.length, "", "/account/web/studio/crm/customers")}${metric("Repeat customers", customers.filter(customer => customer.orders > 1).length, "", "/account/web/studio/crm/customers")}${metric("Newsletter subscribers", newsletterSubscribers.length, "", "/account/web/studio/crm/subscribers")}</div>
      <article class="studio-panel"><div class="studio-panel-heading"><div><span class="studio-workspace-kicker">CUSTOMER RELATIONSHIPS</span><h2>Returning customers</h2></div><a href="/account/customers/loyalty" data-route="/account/customers/loyalty">Manage points</a></div>
        ${customerRows || `<p class="store-workspace-empty">Customers will appear after they place an order with an email address or phone number.</p>`}</article></section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderCrmCustomers() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/customers", snapshot, true);
}

export function unmount() {}
