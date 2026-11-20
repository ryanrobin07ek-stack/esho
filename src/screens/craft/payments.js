// Craft payments screen (/account/payments).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, SQLiteEngine, StudioRenderers } from '../../app/main.js';

// Body of the `if (path === "/account/payments")` branch of StudioRenderers.renderMainShopContent(), moved verbatim.
// It reads that method's locals, which the method passes in by name.
export function renderPayments({ activeTenant }) {
      const storeCurrency = String(SQLiteEngine.getStore().currency || "KES").toUpperCase();
      const nativeCurrencySettings = window.Capacitor?.isNativePlatform?.() === true
        ? `<article class="studio-panel"><div class="studio-panel-heading"><h2>Website currency</h2><span>${AppUtils.escapeHTML(activeTenant.name || activeTenant.hostname)}</span></div>
          <p class="studio-panel-note">Choose the currency for this website. Changing it does not convert prices. Online payments require KES.</p>
          <form class="store-workspace-form" data-app-website-currency><label>Website currency<select name="currency" required>
            ${[
              ["KES", "Kenyan shilling (KES)"],
              ["USD", "US dollar (USD)"],
              ["EUR", "Euro (EUR)"],
              ["GBP", "British pound (GBP)"],
              ["TZS", "Tanzanian shilling (TZS)"],
              ["UGX", "Ugandan shilling (UGX)"],
              ["RWF", "Rwandan franc (RWF)"],
              ["NGN", "Nigerian naira (NGN)"],
              ["GHS", "Ghanaian cedi (GHS)"],
              ["ZAR", "South African rand (ZAR)"]
            ].map(([code, label]) => `<option value="${code}" ${storeCurrency === code ? "selected" : ""}>${label}</option>`).join("")}
            ${!["KES", "USD", "EUR", "GBP", "TZS", "UGX", "RWF", "NGN", "GHS", "ZAR"].includes(storeCurrency)
              ? `<option value="${AppUtils.escapeHTML(storeCurrency)}" selected>${AppUtils.escapeHTML(storeCurrency)}</option>`
              : ""}
          </select></label><button type="submit" class="btn-primary">Save website currency</button><p role="status" aria-live="polite"></p></form>
        </article>`
        : "";
      return `<section class="studio-workspace-section"><article class="studio-panel"><div class="studio-panel-heading"><h2>Payment account</h2><span data-paystack-status>Checking account…</span></div>
        <p class="studio-panel-note">Connect or change the account used for payments across your websites.</p>
        ${nativeCurrencySettings}
        <p class="studio-panel-note">Test mode cannot confirm payouts. In Live mode, the bank must be verified before connection. Only a reference and masked account details are stored.</p>
        <form class="store-workspace-form" data-paystack-setup autocomplete="off"><div class="studio-form-grid">
          <label>Business name<input name="business_name" maxlength="120" autocomplete="organization" required></label>
          <label>Bank<select name="settlement_bank" required><option value="">Loading banks…</option></select></label><button type="button" class="btn-secondary" data-paystack-retry hidden>Retry</button>
          <label>Bank account number<input name="account_number" inputmode="numeric" autocomplete="off" minlength="5" maxlength="20" pattern="[0-9]{5,20}" required></label>
          <label>Account contact name<input name="primary_contact_name" maxlength="120" autocomplete="name" required></label>
          <label>Contact email<input name="primary_contact_email" type="email" maxlength="240" autocomplete="email" required></label>
          <label>Contact phone<input name="primary_contact_phone" type="tel" maxlength="40" autocomplete="tel" required></label>
        </div><button type="submit" class="btn-primary" data-paystack-submit>Connect bank account</button><p role="status" data-paystack-form-status></p></form>
        <form class="store-workspace-form" data-paystack-reuse hidden style="display:none;"><h3>Use an existing account</h3>
          <p class="studio-panel-note">Choose an account already connected to one of your websites.</p>
          <label>Connected account<select name="source_tenant_id" required><option value="">Loading accounts…</option></select></label>
          <label style="display:flex;align-items:flex-start;gap:8px;"><input type="checkbox" name="confirm_reuse" required><span>Use this as the default payment account for my websites.</span></label>
          <button type="submit" class="btn-secondary" data-paystack-reuse-submit>Use this account</button><p role="status" data-paystack-reuse-status></p>
        </form>
        </article></section>`;
}

// Screen entry points. StudioRenderers.renderMainShopContent() computes the workspace data this screen
// reads and calls renderPayments() for its path; mount() draws the screen into root from a workspace snapshot.
export function mount(root, snapshot) {
  root.innerHTML = StudioRenderers.renderMainShopContent("/account/payments", snapshot, true);
}

export function unmount() {}
