// Orders > Invoices screen.
import { PAYMENT_METHODS, escapeHtml, fromCents, money, toCents } from '../../till/format.js';

export function createInvoicesScreen({ state, tabsTitle, card, field, empty, button, statusTag }) {
  function renderInvoices(params) {
    const id = Number(params.get('edit') || 0);
    const invoice = state.invoices.find((item) => item.id === id);
    const draftId = params.get('new') === '1' ? 0 : id;
    if (state.invoiceDraftId !== draftId) {
      state.invoiceDraftId = draftId;
      state.invoiceItems = id && invoice ? invoice.items.map((item) => ({ ...item })) : [];
    }
    const items = state.invoiceItems;
    const subtotal = items.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    const tax = Math.round(subtotal * state.settings.taxRate / 100);
    return `<section class="pos-content">
      ${tabsTitle('Invoices', 'Create, edit, print and share customer invoices.',
        `<a href="/pos/invoices?new=1" data-route="/pos/invoices?new=1" class="btn-primary">New invoice</a>`)}
      ${(id && invoice?.status !== 'paid') || params.get('new') === '1' ? card(`<h3>${id ? 'Edit invoice' : 'New invoice'}</h3>
        <form class="pos-form" data-pos-form="invoice">
          <input type="hidden" name="id" value="${id}">
          ${field('Customer name', 'customerName', invoice?.customer_name || '', { required: true })}
          ${field('Contact · optional', 'customerContact', invoice?.customer_contact || '')}
          ${field('Due date · optional', 'dueDate', invoice?.due_date || '', { type: 'date' })}
          ${field('Notes · optional', 'notes', invoice?.notes || '')}
          <h4>Line items</h4>
          ${items.map((item, index) => `<div class="pos-cart-item"><div><strong>${escapeHtml(item.name)}</strong>
            <small>${item.quantity} × ${money(item.unitPrice, state.settings.currency)}</small></div>
            <input type="number" min="1" max="99999" value="${item.quantity}" data-invoice-qty="${index}" aria-label="Quantity">
            <input type="number" min="0" step="0.01" value="${item.unitPrice}" data-invoice-price="${index}" aria-label="Unit price">
            ${button('Remove', 'invoice-remove', `data-index="${index}"`, true)}</div>`).join('') || empty('No items', 'Add products below.')}
          <div class="pos-total-line"><span>Subtotal</span><b>${money(fromCents(subtotal), state.settings.currency)}</b></div>
          <div class="pos-total-line"><span>Tax · ${state.settings.taxRate}%</span><b>${money(fromCents(tax), state.settings.currency)}</b></div>
          <div class="pos-total-line is-total"><span>Total due</span><b>${money(fromCents(subtotal + tax), state.settings.currency)}</b></div>
          <button class="btn-primary" type="submit">Save invoice</button>
        </form>
        <h4>Add a product</h4><div class="pos-product-picks">${state.products.filter((product) => product.active).map((product) => button(
          `${escapeHtml(product.name)} · ${money(product.price, state.settings.currency)}`, 'invoice-add', `data-id="${product.id}"`, true)).join('')}</div>`) : ''}
      ${state.invoices.map((item) => `<article class="pos-card pos-invoice-row">
        <div><strong>${escapeHtml(item.invoice_number)}</strong><small>${escapeHtml(item.customer_name)} · ${new Date(item.created_at).toLocaleDateString()}${item.status === 'paid' && item.sale_receipt ? ` · receipt ${escapeHtml(item.sale_receipt)}` : ''}</small></div>
        <b>${money(item.total, item.currency)}</b>
        ${statusTag(item.status === 'paid' ? 'Paid' : 'Unpaid', item.status === 'paid' ? 'is-good' : '')}
        ${item.status === 'paid' ? '' : `<a href="/pos/invoices?edit=${item.id}" data-route="/pos/invoices?edit=${item.id}" class="btn-secondary">Edit</a>
        <select data-invoice-pay-method aria-label="Payment method">${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select>
        ${button('Mark paid', 'mark-invoice-paid', `data-id="${item.id}"`)}`}
        ${button('Print / PDF', 'print-invoice', `data-id="${item.id}"`, true)}
      </article>`).join('') || empty('No invoices yet', 'Create an invoice from the button above.')}
    </section>`;
  }

  return { renderInvoices };
}
