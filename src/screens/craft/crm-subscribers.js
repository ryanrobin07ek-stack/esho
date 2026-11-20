// Craft CRM subscribers (newsletter) screen (/account/customers/newsletter).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, StudioRenderers } from '../../app/main.js';

// Body of the `if (["/account/customers/newsletter", "/account/web/studio/crm/newsletter"].includes(path))` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderCrmSubscribers({ metric, snapshot }) {
      const remoteSubscribers = snapshot.remoteNewsletter || [];
      const confirmedSubscribers = remoteSubscribers.filter(subscriber => subscriber.status === "subscribed").length;
      const pendingSubscribers = remoteSubscribers.filter(subscriber => subscriber.status === "pending").length;
      return `<section class="studio-workspace-section">
        <div class="studio-panel-heading newsletter-header"><h2>Email newsletter</h2><button type="button" class="btn-secondary newsletter-refresh-button" data-business-newsletter-refresh aria-label="Refresh subscribers" title="Refresh subscribers"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 17 5l3 2M4 17l3 2a7 7 0 0 0 11.5-4"/></svg></button></div>
        <div class="studio-metric-grid newsletter-metrics">${metric("Confirmed", confirmedSubscribers, "Campaign-ready")}${metric("Pending", pendingSubscribers, "Email unconfirmed")}</div>
        <p class="studio-panel-note">${snapshot.remoteNewsletterError ? `Could not load shared subscribers: ${AppUtils.escapeHTML(snapshot.remoteNewsletterError)}` : "Storefront signups are confirmed by email and shared with this shop in Cloudflare. Campaign delivery uses the configured Resend sender."}</p>
        <form class="store-workspace-form" data-business-newsletter-send><h2>Compose and send</h2><label>Subject<input name="subject" maxlength="120" required></label><label>Message<textarea name="message" rows="5" maxlength="4000" required></textarea></label><p class="studio-panel-note">Unsubscribe links are added automatically. The app reports provider acceptance, not guaranteed inbox delivery.</p><button type="submit" class="btn-primary" ${confirmedSubscribers ? "" : "disabled"}>Send to ${confirmedSubscribers} confirmed subscriber${confirmedSubscribers === 1 ? "" : "s"}</button><p role="status"></p></form>
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Subscribers (${remoteSubscribers.length})</h2></div>
          ${remoteSubscribers.length ? `<div class="store-bulk-actions newsletter-bulk-actions" data-newsletter-bulk>
            <label class="store-bulk-select-all"><input type="checkbox" data-newsletter-select-all><span>Select all subscribers</span></label>
            <span class="store-bulk-selection-count" data-newsletter-selection-count>0 selected</span>
            <button type="button" class="btn-secondary" data-newsletter-remove-selected disabled>Remove selected</button>
          </div>` : ""}
          <p role="status" aria-live="polite" data-newsletter-action-status></p>
          ${remoteSubscribers.map(subscriber => `<article class="studio-list-row newsletter-subscriber-row">
            <label class="newsletter-subscriber-select" aria-label="Select ${AppUtils.escapeHTML(subscriber.email)}"><input type="checkbox" data-newsletter-subscriber-select value="${AppUtils.escapeHTML(subscriber.id)}"></label>
            <div><strong>${AppUtils.escapeHTML(subscriber.name || subscriber.email)}</strong><span>${AppUtils.escapeHTML(subscriber.email)} · ${AppUtils.escapeHTML(subscriber.status)} · joined ${AppUtils.escapeHTML(subscriber.created_at)}</span></div>
            <button type="button" class="btn-secondary" data-remove-remote-subscriber="${AppUtils.escapeHTML(subscriber.id)}">Remove</button>
          </article>`).join("") || `<p class="store-workspace-empty">No storefront subscribers yet.</p>`}</article>
      </section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderCrmSubscribers() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/customers/newsletter", snapshot, true);
}

export function unmount() {}
