// Orders > Quotations screen.
import { escapeHtml, money } from '../../till/format.js';

export function createQuotationsScreen({ state, tabsTitle, card, field, statusTag, button }) {
  function renderQuotations() {
    const params = new URLSearchParams(((window.location.hash || '').split('?')[1]) || '');
    const editing = state.quotations.find((item) => item.id === Number(params.get('edit') || 0));
    const lineFor = (product) => editing?.items.find((line) => line.productId === product.id);
    const customLines = editing ? editing.items.filter((line) => !state.products.some((product) => product.id === line.productId)) : [];
    const customSlots = Math.max(2, customLines.length);
    const locked = editing?.status === 'converted';
    return `<section class="pos-content">${tabsTitle('Quotations', 'Build a quotation from catalogue or custom items, save it, and convert it to an invoice.')}
      ${card(`<h3>${editing ? 'Edit quotation' : 'New quotation'}</h3><form class="pos-form" data-pos-form="quotation">
        <input type="hidden" name="id" value="${editing?.id || 0}">
        ${field('Customer name', 'customerName', editing?.customer_name || '', { required: true })}
        ${field('Contact · optional', 'customerContact', editing?.customer_contact || '')}
        ${field('Notes · optional', 'notes', editing?.notes || '')}
        <h4>Catalogue products</h4>
        <div class="pos-product-picks pos-quote-product-grid">${state.products.map((product) => `<label class="pos-product-tile pos-quote-product">
          <input type="checkbox" name="products" value="${product.id}" aria-label="Select ${escapeHtml(product.name)}" ${lineFor(product) ? 'checked' : ''}>
          ${product.imageUri ? `<img src="${escapeHtml(product.imageUri)}" alt="">` : '<span class="pos-product-placeholder">+</span>'}
          <strong>${escapeHtml(product.name)}</strong>
          <span>${money(product.price, state.settings.currency)}</span>
          <input type="number" name="quantity_${product.id}" min="1" max="99999" step="1" value="${lineFor(product)?.quantity || 1}" aria-label="Quantity of ${escapeHtml(product.name)}">
        </label>`).join('') || '<p class="pos-help">No products in catalogue yet.</p>'}</div>
        <h4>Custom items</h4>
        ${Array.from({ length: customSlots }, (_, index) => `<div class="pos-cart-item">
          ${field('Item name', `customName${index + 1}`, customLines[index]?.name || '')}
          ${field('Qty', `customQty${index + 1}`, customLines[index]?.quantity || '', { type: 'number', min: '1', step: '1' })}
          ${field('Price', `customPrice${index + 1}`, customLines[index]?.unitPrice ?? '', { type: 'number', min: '0', step: '0.01' })}
        </div>`).join('')}
        ${locked ? '<p class="pos-help">This quotation was converted to an invoice and can no longer be edited.</p>'
          : `<div class="pos-form-actions"><button type="submit" class="btn-primary">Save quotation</button>
            ${editing ? '<a href="/pos/orders/quotations" data-route="/pos/orders/quotations" class="btn-secondary">Cancel</a>' : ''}</div>`}
      </form>`)}
      ${card(`<h3>Saved quotations · ${state.quotations.length}</h3>${state.quotations.map((quotation) => `<div class="pos-category-row">
        <strong>${escapeHtml(quotation.quotation_number)}<small>${escapeHtml(quotation.customer_name)} · ${new Date(quotation.created_at).toLocaleDateString()} · ${quotation.items.length} line${quotation.items.length === 1 ? '' : 's'}</small></strong>
        <span>${statusTag(quotation.status === 'converted' ? 'Converted' : 'Open', quotation.status === 'converted' ? 'is-good' : '')}</span>
        <b>${money(quotation.total, quotation.currency)}</b>
        <a href="/pos/orders/quotations?edit=${quotation.id}" data-route="/pos/orders/quotations?edit=${quotation.id}" class="btn-secondary">${quotation.status === 'converted' ? 'View' : 'Edit'}</a>
        ${quotation.status === 'converted' ? '' : button('Convert to invoice', 'convert-quotation', `data-id="${quotation.id}"`)}
        ${button('Print / PDF', 'print-quotation', `data-id="${quotation.id}"`, true)}
        ${button('Delete', 'delete-quotation', `data-id="${quotation.id}"`, true)}
      </div>`).join('') || '<p class="pos-help">Saved quotations will appear here.</p>'}`)}</section>`;
  }

  return { renderQuotations };
}
