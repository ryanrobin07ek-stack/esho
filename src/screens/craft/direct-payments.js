// "Ways customers can pay you directly" on the Payments screen: M-Pesa (Till, Paybill or phone number),
// cash on delivery or pickup, and bank transfer. Saved on the website's store as `payment_options`;
// the published checkout (public/litrus-mixer/live-catalog.js) and the builder preview show exactly these,
// next to Paystack when it is connected. Orders taken this way are saved as paid-to-the-shop ("manual"),
// and the owner records the payment on the order as before.
import { AppController, AppUtils, SQLiteEngine } from '../../app/main.js';

const MPESA_KINDS = ['till', 'paybill', 'phone'];
const digits = value => String(value || '').replace(/\D/g, '');
const text = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** The saved options in one shape; anything missing or broken counts as switched off. */
export function normalizePaymentOptions(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const mpesa = source.mpesa && typeof source.mpesa === 'object' ? source.mpesa : {};
  const kind = MPESA_KINDS.includes(mpesa.kind) ? mpesa.kind : 'till';
  const number = kind === 'phone' ? text(mpesa.number, 20).replace(/[^\d+ ]/g, '') : digits(mpesa.number).slice(0, 12);
  return {
    mpesa: { enabled: mpesa.enabled === true && Boolean(number), kind, number, account: kind === 'paybill' ? text(mpesa.account, 40) : '' },
    cash: { enabled: source.cash?.enabled === true },
    bank: { enabled: source.bank?.enabled === true && Boolean(text(source.bank?.details, 300)), details: text(source.bank?.details, 300) }
  };
}

/** Checks the form's values; returns an error message, or "" when they can be saved. */
export function paymentOptionsProblem(options) {
  const { mpesa, bank } = options;
  if (mpesa.enabled) {
    const count = digits(mpesa.number).length;
    if (mpesa.kind === 'phone' && (count < 9 || count > 13)) return 'Enter the M-Pesa phone number customers send money to.';
    if (mpesa.kind !== 'phone' && (count < 5 || count > 12)) return `Enter your M-Pesa ${mpesa.kind === 'paybill' ? 'Paybill' : 'Till'} number (digits only).`;
  }
  if (bank.enabled && !bank.details) return 'Add the bank details customers should pay to.';
  return '';
}

export function renderDirectPayments() {
  const options = normalizePaymentOptions(SQLiteEngine.getStore().payment_options);
  const { mpesa, cash, bank } = options;
  const checked = on => (on ? ' checked' : '');
  const kindOption = (value, label) => `<option value="${value}"${mpesa.kind === value ? ' selected' : ''}>${label}</option>`;
  return `<article class="studio-panel" data-direct-payments-panel>
      <div class="studio-panel-heading"><h2>Ways customers can pay you directly</h2></div>
      <p class="studio-panel-note">Your website's checkout shows only what you switch on here, next to Paystack when it is connected. With nothing switched on and no Paystack, checkout says you will contact the customer about payment.</p>
      <form class="store-workspace-form" data-direct-payments autocomplete="off">
        <label class="direct-pay-toggle"><input type="checkbox" name="mpesa_enabled"${checked(mpesa.enabled)}> <span>M-Pesa</span></label>
        <div class="studio-form-grid" data-direct-pay-mpesa>
          <label>Type<select name="mpesa_kind">${kindOption('till', 'Buy Goods (Till number)')}${kindOption('paybill', 'Paybill')}${kindOption('phone', 'Send money (phone number)')}</select></label>
          <label><span data-direct-pay-number-label>Number</span><input name="mpesa_number" inputmode="numeric" maxlength="20" value="${AppUtils.escapeHTML(mpesa.number)}"></label>
          <label data-direct-pay-account>Account number customers use<input name="mpesa_account" maxlength="40" placeholder="Leave empty to use the order number" value="${AppUtils.escapeHTML(mpesa.account)}"></label>
        </div>
        <label class="direct-pay-toggle"><input type="checkbox" name="cash_enabled"${checked(cash.enabled)}> <span>Cash on delivery or pickup</span></label>
        <label class="direct-pay-toggle"><input type="checkbox" name="bank_enabled"${checked(bank.enabled)}> <span>Bank transfer</span></label>
        <label data-direct-pay-bank>Bank details customers pay to<textarea name="bank_details" maxlength="300" rows="3" placeholder="Bank, account name and account number">${AppUtils.escapeHTML(bank.details)}</textarea></label>
        <button type="submit" class="btn-primary">Save payment options</button>
        <p role="status" aria-live="polite" data-direct-payments-status></p>
      </form>
    </article>`;
}

function readForm(form) {
  const data = new FormData(form);
  return normalizePaymentOptions({
    mpesa: { enabled: data.get('mpesa_enabled') === 'on', kind: data.get('mpesa_kind'), number: data.get('mpesa_number'), account: data.get('mpesa_account') },
    cash: { enabled: data.get('cash_enabled') === 'on' },
    bank: { enabled: data.get('bank_enabled') === 'on', details: data.get('bank_details') }
  });
}

export function bindDirectPayments(container) {
  const form = container?.querySelector('[data-direct-payments]');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  const status = form.querySelector('[data-direct-payments-status]');
  const sync = () => {
    const kind = form.elements.mpesa_kind.value;
    const mpesaOn = form.elements.mpesa_enabled.checked;
    form.querySelector('[data-direct-pay-mpesa]').hidden = !mpesaOn;
    form.querySelector('[data-direct-pay-account]').hidden = kind !== 'paybill';
    form.querySelector('[data-direct-pay-number-label]').textContent = kind === 'phone' ? 'Phone number' : kind === 'paybill' ? 'Paybill number' : 'Till number';
    form.querySelector('[data-direct-pay-bank]').hidden = !form.elements.bank_enabled.checked;
  };
  form.addEventListener('change', sync);
  sync();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const raw = new FormData(form);
    const options = readForm(form);
    // Switched on but left empty: say so rather than quietly saving it as off.
    const wanted = { ...options, mpesa: { ...options.mpesa, enabled: raw.get('mpesa_enabled') === 'on' }, bank: { ...options.bank, enabled: raw.get('bank_enabled') === 'on' } };
    const problem = paymentOptionsProblem(wanted);
    if (problem) { status.textContent = problem; return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Saving…';
    try {
      SQLiteEngine.updateStore({ payment_options: options });
      AppController.cacheActiveTenantCatalog();
      if (!window.ShopSQLite) throw new Error('The app database is not ready.');
      await window.ShopSQLite.flush();
      status.textContent = 'Saved. Publish your website to show these at checkout.';
      AppUtils.showToast('Payment options saved.');
    } catch (error) {
      console.error('Payment options could not be saved.', error);
      status.textContent = error instanceof Error ? error.message : 'The payment options could not be saved.';
    } finally {
      button.disabled = false;
    }
  });
}
