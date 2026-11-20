// Craft store bookings screen (/account/web/studio/store/bookings).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers } from '../../app/main.js';

// Body of the `if (page.route === "/account/web/studio/store/bookings")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderStoreBookings({ bookings, remoteHoldRows, remoteHolds, snapshot }) {
        const holdHours = Number(this.getWorkspaceSetting("max_hold_hours", 24));
        const activeProductCount = SQLiteEngine.select("products", product => product.status !== "archived").length;
        // A salon that also sells shampoo still takes bookings, so this follows the catalogue.
        const servicesShop = window.EshopServiceModel.sellsServices(
          window.EshopServiceModel.offerTypeForCatalogue(SQLiteEngine.select("products", product => product.status !== "archived"), SQLiteEngine.getStore().offer_type)
        );
        return `<section class="studio-workspace-section">
          ${servicesShop ? this.renderServiceAppointmentsPanel(snapshot) : ""}
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Storefront hold settings</h2></div>
            <p class="studio-panel-note">Set the hold duration and manage product eligibility. Publish the storefront after changes.</p>
            <form class="store-workspace-form" data-studio-form="booking-settings"><label>Maximum hold duration (hours)<input name="maxHoldHours" type="number" min="1" max="720" step="1" value="${holdHours}" required></label><button type="submit" class="btn-primary">Save hold settings</button><p role="status"></p></form>
          </article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Apply holds to all products</h2></div>
            <p class="studio-panel-note">Enable or disable customer holds for all ${activeProductCount} active website products at once. You can still change individual products afterward; this does not change stock.</p>
            <div class="studio-inline-actions">
              <button type="button" class="btn-primary" data-store-holds-all="enable" ${activeProductCount ? "" : "disabled"}>Enable holds for all products</button>
              <button type="button" class="btn-secondary" data-store-holds-all="disable" ${activeProductCount ? "" : "disabled"}>Disable holds for all products</button>
            </div>
          </article>
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Bookings and holds</h2></div>
            ${bookings.map(booking => {
              const expired = new Date(booking.expires_at).getTime() <= Date.now();
              return `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(booking.product_name)} · ${booking.quantity}</strong><span>${AppUtils.escapeHTML(booking.customer_name)} · ${AppUtils.escapeHTML(booking.contact)} · Expires ${AppUtils.escapeHTML(booking.expires_at)}</span></div><div class="studio-row-end"><span>${expired ? "Expired" : AppUtils.escapeHTML(booking.status || "On hold")}</span>${!expired && booking.status !== "released" ? `<button type="button" class="btn-secondary" data-release-hold="${booking.id}">Release</button>` : ""}</div></article>`;
            }).join("") || `<p class="store-workspace-empty">No bookings or holds recorded yet.</p>`}
          </article>
          ${servicesShop ? "" : this.renderServiceAppointmentsPanel(snapshot)}
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Storefront hold requests</h2><button type="button" class="btn-secondary studio-load-button" data-online-holds-load aria-label="Load hold requests">Load</button></div>
            <p class="studio-panel-note" data-online-holds-status>${snapshot.remoteHoldsError ? AppUtils.escapeHTML(snapshot.remoteHoldsError) : snapshot.remoteHolds ? `${remoteHolds.length} live hold${remoteHolds.length === 1 ? "" : "s"} loaded.` : "Customer holds reserve available website stock immediately until released or expired."}</p>
            ${remoteHoldRows}
          </article>
        </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderStoreBookings() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/web/studio/store/bookings", snapshot, true);
}

export function unmount() {}
