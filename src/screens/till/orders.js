// Orders screen.
import { escapeHtml, money } from '../../till/format.js';

export function createOrdersScreen({ tabsTitle, card, state, button }) {
  function renderOrders() {
    return `<section class="pos-content">${tabsTitle('Orders', 'Park an unpaid cart and resume it later or on another synced device.',
      `<a href="/pos" data-route="/pos" class="btn-secondary pos-orders-new-sale">New sale</a>`)}
      ${card(`<h3>Saved orders · ${state.tickets.length}</h3>
        ${state.tickets.map((ticket) => `<div class="pos-category-row">
          <strong>${escapeHtml(ticket.name || 'Saved order')}<small>${ticket.items.length} item${ticket.items.length === 1 ? '' : 's'} · ${new Date(ticket.createdAt).toLocaleString()}</small></strong>
          <span>${escapeHtml(ticket.customerName || 'No customer')}</span>
          <b>${money(ticket.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), state.settings.currency)}</b>
          ${button('Resume sale', 'resume-ticket', `data-record-id="${escapeHtml(ticket.id)}"`)}
          ${button('Delete', 'delete-ticket', `data-record-id="${escapeHtml(ticket.id)}"`, true)}
        </div>`).join('') || '<p class="pos-help">No parked orders. Use “Park order” in checkout to save a cart without completing the sale.</p>'}`)}
    </section>`;
  }

  return { renderOrders };
}
