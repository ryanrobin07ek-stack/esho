// More > Settings screen.
import { PAYMENT_METHODS, escapeHtml, fromCents, money, today } from '../../till/format.js';

export function createSettingsScreen({ state, tabsTitle, card, field, button, select }) {
  function renderSettings(params = new URLSearchParams()) {
    const setting = state.settings;
    const editingExpense = state.expenses.find((expense) => expense.id === Number(params.get('expense') || 0));
    return `<section class="pos-content">
      ${tabsTitle('POS settings', 'Store currency, tax, expenses and till controls.')}
      ${card(`<h3>Store settings</h3><form class="pos-form" data-pos-form="settings">
        ${field('Tax rate (%)', 'taxRate', setting.taxRate, { type: 'number', min: '0', max: '100', step: '0.01', required: true })}
        ${field('Currency code', 'currency', setting.currency, { required: true, placeholder: 'KES' })}
        <button class="btn-primary" type="submit">Save settings</button></form>`)}
      ${card(`<h3>Bluetooth / USB barcode scanner</h3>
        <p class="pos-help">Optional external barcode scanners type into this field like a keyboard. Pair Bluetooth scanners in your device’s Bluetooth settings or plug in a USB scanner, then focus this field and scan. Scanned products are added to the current sale; open Sell to review and checkout.</p>
        <label class="pos-field"><span>Scan barcode / SKU</span>
          <input type="text" data-pos-barcode-input autocomplete="off" placeholder="Focus here, then scan a product" aria-label="Bluetooth or USB barcode scanner input">
        </label>`)}
      ${card(`<h3>Cloud backup and sync</h3>
        <p class="pos-help">${setting.cloudSyncEnabled
          ? `Cloud backup and sync is enabled for ${escapeHtml(setting.cloudSyncTenantId)}. This device’s POS products, stock, expenses, settings, suppliers, orders, and receipts sync with other registers connected to this shop.`
          : 'Save this device’s POS records to your shop’s cloud account and sync them with your other registers, including the phone app. Your local data stays on this device too. This is separate from the customer-facing online shop.'}</p>
        ${state.cloudSyncError || setting.cloudSyncError
          ? `<p class="pos-help" role="alert">${escapeHtml(state.cloudSyncError || setting.cloudSyncError)}</p>` : ''}
        <div class="pos-form-actions">
          ${button(setting.cloudSyncEnabled ? 'Turn off cloud backup and sync' : 'Enable cloud backup and sync', 'toggle-cloud-sync', '', true)}
          ${setting.cloudSyncEnabled ? button('Save and sync now', 'sync-cloud-now') : ''}
        </div>
        <p class="pos-help">Changes are saved locally first and sent when online. Cloud-connected registers check for updates every few seconds while this app is open. For faster direct live sync, keep a nearby connection open on both registers. Enable this on each register using the same shop. Cloud data includes customer names and phone numbers saved on receipts and supplier contacts.</p>`)}
      ${card(`<h3>Nearby device sync</h3>
        <p class="pos-help">The phone scans this register’s QR once. The PC then asks you to approve the phone before any POS data is sent. Internet is needed briefly to set up the connection; the encrypted POS transfer goes directly over the same Wi-Fi. Transfers can include receipt customer names and phone numbers. Only approve a register you trust; both registers must select the same shop.</p>
        <p class="pos-help" role="status" aria-live="polite" data-nearby-sync-status>${escapeHtml(state.nearbySyncStatus || 'Choose Create pairing QR on the PC, then scan it once with the phone.')}</p>
        <div class="pos-form-actions">
          ${window.Capacitor?.getPlatform?.() === 'android' ? `${button('Receive over Bluetooth', 'nearby-bt-host', '', true)}
          ${button('Find a Bluetooth register', 'nearby-bt-find')}` : ''}
          ${button('Create pairing QR', 'nearby-sync-create', '', true)}
          ${button('Scan pairing QR', 'nearby-sync-join')}
          ${button('End nearby sync', 'nearby-sync-stop')}
        </div>
        <p class="pos-help">Keep both registers open to stay connected. While connected, saved changes transfer automatically in seconds; closing either register ends nearby live sync. For syncing while a register is closed or away, enable Cloud backup and sync above.</p>`)}
      ${card(`<h3>${editingExpense ? 'Edit expense' : 'Record an expense'}</h3><form class="pos-form" data-pos-form="expense">
        <input type="hidden" name="id" value="${editingExpense?.id || 0}">
        ${field('Date', 'date', editingExpense?.expense_date || today(), { type: 'date', required: true })}
        ${field('Category', 'category', editingExpense?.category || '', { required: true, placeholder: 'Rent, transport, supplies' })}
        ${field('Description', 'label', editingExpense?.label || '', { required: true })}
        ${field('Amount', 'amount', editingExpense ? fromCents(editingExpense.amount_cents) : '', { type: 'number', min: '0.01', step: '0.01', required: true })}
        ${select('Paid by', 'paymentMethod', [...PAYMENT_METHODS, 'Unknown'].map((item) => [item, item]), editingExpense?.payment_method || 'Cash')}
        ${field('Note', 'note', editingExpense?.note || '')}<div class="pos-form-actions"><button class="btn-primary">${editingExpense ? 'Update expense' : 'Save expense'}</button>
          ${editingExpense ? '<a href="/pos/settings" data-route="/pos/settings" class="btn-secondary">Cancel</a>' : ''}</div></form>`)}
      ${card(`<h3>Recent expenses</h3>${state.expenses.slice(0,20).map((item) => `<div class="pos-category-row">
        <strong>${escapeHtml(item.label)}<small>${escapeHtml(item.category)} · ${escapeHtml(item.expense_date)}</small></strong>
        <span>${escapeHtml(item.payment_method)}</span><b>${money(fromCents(item.amount_cents), item.currency)}</b>
        ${button('Edit', 'edit-expense', `data-id="${item.id}"`, true)}
        ${button('Delete', 'delete-expense', `data-id="${item.id}"`, true)}</div>`).join('') || '<p class="pos-help">No expenses recorded yet.</p>'}`)}
      ${card(`<h3>Cash drawer</h3>
        <form class="pos-form" data-pos-form="movement">
          ${select('Movement', 'type', [['float_in','Float in'],['bank_drop','Bank drop'],['petty_out','Petty cash out']], 'float_in')}
          ${field('Amount', 'amount', '', { type: 'number', min: '0.01', step: '0.01', required: true })}
          ${field('Note', 'note', '')}<button class="btn-secondary">Record movement</button></form>
        ${state.cashMovements.length ? `<h4>Recent movements</h4>${state.cashMovements.map((movement) =>
          `<div class="pos-category-row"><strong>${escapeHtml(movement.movement_type.replace('_', ' '))}<small>${new Date(movement.created_at).toLocaleString()} · ${escapeHtml(movement.note || '')}</small></strong>
            <b>${money(fromCents(movement.amount_cents), movement.currency)}</b></div>`).join('')}` : ''}
        <form class="pos-form" data-pos-form="till"><h4>Close till</h4>
          ${field('Date', 'date', today(), { type: 'date', required: true })}
          ${field('Counted cash', 'countedCash', '', { type: 'number', min: '0', step: '0.01', required: true })}
          <button class="btn-primary">Save till close</button></form>
        <h4>Recent till closes</h4>${state.tillCloses.map((item) => `<div class="pos-category-row"><strong>${escapeHtml(item.close_date)}</strong>
          <span>Expected ${money(fromCents(item.expected_cash_cents), item.currency)}</span><b>Difference ${money(fromCents(item.difference_cents), item.currency)}</b></div>`).join('') || '<p class="pos-help">No till closes saved.</p>'}`)}
    </section>`;
  }

  return { renderSettings };
}
