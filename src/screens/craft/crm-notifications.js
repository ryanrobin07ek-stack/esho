// Craft CRM notifications screen (/account/web/studio/crm/notifications).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { StudioRenderers } from '../../app/main.js';

// Body of the `if (page.route === "/account/web/studio/crm/notifications")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderCrmNotifications({ snapshot }) {
        return `<section class="studio-workspace-section">${this.renderOwnerAlertsPanel(snapshot)}<article class="studio-panel">
          <span class="studio-workspace-kicker">CUSTOMER NOTIFICATIONS</span><h2>Website notifications</h2>
          <p class="studio-panel-note">Customers choose whether to receive browser notifications. Push delivery requires an active notification service and customer opt-in. Broadcasts are sent immediately to every opted-in device.</p>
          <div class="studio-dashboard-grid"><button type="button" class="btn-primary" data-enable-notifications>Enable notifications on this device</button><button type="button" class="btn-secondary" data-disable-notifications>Turn off notifications on this device</button></div>
          <p class="bl-push-status" role="status" aria-live="polite">Notification availability depends on browser support and customer permission.</p>
          <form class="store-workspace-form" data-business-broadcast>
            <h2>Send a push notification</h2>
            <label>Title<input name="title" maxlength="80" required></label>
            <label>Message<textarea name="body" rows="3" maxlength="240" required></textarea></label>
            <label>Open this page when tapped<input name="url" value="/" maxlength="300" required></label>
            <p class="studio-panel-note">This sends now to all browsers that opted in to this shop’s notifications.</p>
            <button type="submit" class="btn-primary">Send notification</button>
            <p role="status" aria-live="polite"></p>
          </form>
        </article></section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderCrmNotifications() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/web/studio/crm/notifications", snapshot, true);
}

export function unmount() {}
