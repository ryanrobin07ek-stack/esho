// Craft store orders screen (/account/web/studio/store/orders).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { SQLiteEngine, StudioRenderers } from '../../app/main.js';

// Body of the `if (page.route === "/account/web/studio/store/orders")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderStoreOrders({ orderRows, remoteOrderRows, snapshot }) {
        const orders = SQLiteEngine.select("orders", null, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return `<section class="studio-workspace-section">
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Orders</h2><button type="button" class="btn-secondary studio-load-button" data-business-online-orders-load aria-label="Load online orders">Load</button></div>
            <p class="studio-panel-note" data-online-orders-status>Orders and payment status are stored privately for this shop.</p>
            ${this.renderOrderAttentionSummary(snapshot.remoteOrders)}${orderRows(orders)}${remoteOrderRows}</article>
          ${this.renderOwnerAlertsPanel(snapshot)}
          ${this.renderDiscountPanel(snapshot)}
        </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderStoreOrders() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/web/studio/store/orders", snapshot, true);
}

export function unmount() {}
