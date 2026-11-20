// Catalogue > Suppliers screen.
import { escapeHtml, money, purchaseLabel } from '../../till/format.js';

export function createCatalogueSuppliersScreen({
  state, tabsTitle, card, field, select, empty, button, statusTag
}) {
  function renderSuppliers(params) {
    const editing = state.suppliers.find((item) => item.id === params.get('supplier'));
    const productChoices = [['', 'Select product'], ...state.products.map((product) => [product.sku, product.name])];
    return `<section class="pos-content">
      ${tabsTitle('Suppliers', `${state.suppliers.length} suppliers · purchase orders and stock receiving`)}
      ${card(`<h3>${editing ? 'Edit supplier' : 'Add supplier'}</h3>
        <form class="pos-form" data-pos-form="supplier">
          <input type="hidden" name="id" value="${escapeHtml(editing?.id || '')}">
          ${field('Supplier name', 'name', editing?.name || '', { required: true })}
          ${field('Phone', 'phone', editing?.phone || '', { type: 'tel' })}
          ${field('Email', 'email', editing?.email || '', { type: 'email' })}
          ${field('Supplies / notes', 'supplies', editing?.supplies || '')}
          <div class="pos-form-actions"><button class="btn-primary" type="submit">${editing ? 'Save supplier' : 'Add supplier'}</button>
            ${editing ? '<a href="/pos/catalogue/suppliers" data-route="/pos/catalogue/suppliers" class="btn-secondary">Cancel</a>' : ''}</div>
        </form>`) }
      ${card(`<h3>Purchase order</h3>
        ${state.suppliers.length ? `<form class="pos-form" data-pos-form="purchase">
          ${select('Supplier', 'supplierId', state.suppliers.map((item) => [item.id, item.name]), '')}
          ${field('Reference · optional', 'reference', '')}
          ${[1, 2, 3].map((index) => `<div class="pos-cart-item">
            ${select(`Product ${index}`, `product${index}`, productChoices, '')}
            ${field('Qty', `quantity${index}`, '', { type: 'number', min: '1', step: '1' })}
            ${field('Unit cost', `cost${index}`, '', { type: 'number', min: '0', step: '0.01' })}
          </div>`).join('')}
          <button class="btn-primary" type="submit">Create purchase order</button>
        </form>` : empty('Add a supplier first', 'Purchase orders are linked to supplier records.')}`)}
      ${card(`<h3>Suppliers</h3>${state.suppliers.map((item) => `<div class="pos-category-row">
        <strong>${escapeHtml(item.name)}<small>${escapeHtml(item.supplies || 'No supplies/notes')}</small></strong>
        <span>${escapeHtml(item.phone || item.email || 'No contact details')}</span>
        <a href="/pos/catalogue/suppliers?supplier=${encodeURIComponent(item.id)}" data-route="/pos/catalogue/suppliers?supplier=${encodeURIComponent(item.id)}" class="btn-secondary">Edit</a>
        ${button('Delete', 'delete-supplier', `data-record-id="${escapeHtml(item.id)}"`, true)}
      </div>`).join('') || '<p class="pos-help">No suppliers yet. Add a supplier to start tracking purchases.</p>'}`)}
      ${card(`<h3>Purchase orders</h3>${state.purchases.map((item) => `<div class="pos-category-row">
        <strong>${escapeHtml(purchaseLabel(item))}<small>${escapeHtml(item.supplierName)} · ${item.items.length} line${item.items.length === 1 ? '' : 's'}</small></strong>
        <span>${escapeHtml(item.status)} · ${new Date(item.createdAt).toLocaleDateString()}</span>
        <span>${money(item.items.reduce((sum, line) => sum + line.quantity * line.unitCost, 0), state.settings.currency)}</span>
        ${item.status === 'ordered' ? button('Receive stock', 'receive-purchase', `data-record-id="${escapeHtml(item.id)}"`) : statusTag(item.status, item.status === 'received' ? 'is-good' : '')}
      </div>`).join('') || '<p class="pos-help">Purchase orders will appear here.</p>'}`)}
    </section>`;
  }

  return { renderSuppliers };
}
