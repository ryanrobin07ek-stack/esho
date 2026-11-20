// Sales & receipts screen.
import { isReversedSale } from '../../revenue-definition.js';
import { PAYMENT_METHODS, escapeHtml, localDateKey, money, today } from '../../till/format.js';
import { reversalLabel } from '../../till/sales.js';

export function createSalesScreen({
  state, tabsTitle, metric, empty, card, statusTag, field, select
}) {
  function renderSales(params) {
    const openId = Number(params.get('open') || state.expandedSale);
    const sales = state.sales;
    const todays = sales.filter((sale) => localDateKey(sale.created_at) === today());
    const total = (items) => items.reduce((sum, sale) => sum + sale.total, 0);
    return `<section class="pos-content">
      ${tabsTitle('Sales & receipts', 'Review receipts, record outstanding payments and track credit.')}
      <div class="pos-metrics">
        ${metric('Today', money(total(todays), state.settings.currency), `${todays.length} sales`)}
        ${metric('All time', money(total(sales), state.settings.currency), `${sales.length} receipts`)}
        ${metric('Outstanding', money(sales.filter((sale) => !sale.paid).reduce((sum, sale) => sum + sale.total - sale.amountPaid, 0), state.settings.currency), 'Unpaid balance')}
      </div>
      ${sales.map((sale) => `<article class="pos-card pos-record">
        <button type="button" class="pos-record-head" data-pos-action="toggle-sale" data-id="${sale.id}">
          <span><strong>${escapeHtml(sale.receipt_number)}</strong><small>${escapeHtml(sale.items.map((item) => item.name).slice(0, 2).join(', '))} · ${new Date(sale.created_at).toLocaleString()}</small></span>
          <span><b>${money(sale.total, sale.currency)}</b>${statusTag(isReversedSale(sale) ? reversalLabel(sale) : sale.paid ? 'Paid' : sale.payment_status === 'partial' ? 'Part-paid' : 'Unpaid', sale.paid ? 'is-good' : 'is-warning')}</span>
        </button>
        ${openId === sale.id ? `<div class="pos-record-details">
          <div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Item</th><th>Qty</th><th>Each</th><th>Total</th></tr></thead><tbody>
          ${sale.items.map((item) => `<tr><td>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''}${item.attributesLabel ? ` · ${escapeHtml(item.attributesLabel)}` : ''}</td><td>${item.quantity}</td><td>${money(item.unitPrice, sale.currency)}</td><td>${money(item.quantity * item.unitPrice, sale.currency)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="pos-total-line"><span>Subtotal / discount / tax</span><b>${money(sale.subtotal, sale.currency)} / ${money(sale.discount, sale.currency)} / ${money(sale.tax, sale.currency)}</b></div>
          <div class="pos-total-line is-total"><span>Balance due</span><b>${money(Math.max(0, sale.total - sale.amountPaid), sale.currency)}</b></div>
          <p class="pos-help">Customer: ${escapeHtml(sale.customer_name || 'Not recorded')} · Method: ${escapeHtml(sale.payment_method || 'Not recorded')}</p>
          ${isReversedSale(sale) ? `<p class="pos-help"><strong>${escapeHtml(reversalLabel(sale))}</strong> · stock was returned and this sale is left out of reports.</p>` : `<div class="pos-inline-actions"><button type="button" class="btn-secondary" data-pos-action="refund-sale" data-id="${sale.id}">Refund</button><button type="button" class="btn-secondary" data-pos-action="void-sale" data-id="${sale.id}">Void</button></div>`}
          ${!sale.paid && !isReversedSale(sale) ? `<form class="pos-inline-form" data-pos-form="payment">
            <input type="hidden" name="saleId" value="${sale.id}">
            ${field('Amount', 'amount', (sale.total - sale.amountPaid).toFixed(2), { type: 'number', min: '0.01', step: '0.01', required: true })}
            ${select('Method', 'method', PAYMENT_METHODS.map((method) => [method, method]), sale.payment_method || 'Cash')}
              ${field('Mobile-money reference · optional', 'mpesaRef', '')}
              <button class="btn-primary">Record payment</button>
          </form>` : ''}
          <button type="button" class="btn-secondary" data-pos-action="print-sale" data-id="${sale.id}">Print receipt</button>
        </div>` : ''}
      </article>`).join('') || empty('No sales yet', 'Sales saved from checkout will appear here.')}
      ${state.cloudSales.filter((sale) => !sales.some((local) => local.receipt_number === sale.receipt_number)).length
        ? card(`<h3>Receipts from other synced devices</h3>
          ${state.cloudSales.filter((sale) => !sales.some((local) => local.receipt_number === sale.receipt_number))
            .map((sale) => `<div class="pos-category-row"><strong>${escapeHtml(sale.receipt_number || sale.id)}
              <small>${escapeHtml((sale.items || []).map((item) => item.name).slice(0, 2).join(', '))} · ${escapeHtml(sale.customer_name || 'No customer recorded')}</small></strong>
              <span>${new Date(sale.created_at).toLocaleString()}</span><b>${money(Number(sale.total) || 0, sale.currency || state.settings.currency)}</b>
            </div>`).join('')}`) : ''}
    </section>`;
  }

  return { renderSales };
}
