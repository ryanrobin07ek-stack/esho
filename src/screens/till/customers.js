// Customers screen.
import { escapeHtml, money } from '../../till/format.js';

export function createCustomersScreen({ tabsTitle, card, state }) {
  function renderCustomers() {
    const customers = new Map();
    for (const sale of state.sales) {
      if (!sale.customer_phone || !sale.customer_name) continue;
      const key = sale.customer_phone.replace(/\D/g, '') || sale.customer_phone;
      const customer = customers.get(key) || {
        name: sale.customer_name, phone: sale.customer_phone, receipts: 0,
        revenue: 0, outstanding: 0, lastSale: sale.created_at
      };
      customer.receipts += 1;
      customer.revenue += sale.total;
      customer.outstanding += Math.max(0, sale.total - sale.amountPaid);
      if (sale.created_at > customer.lastSale) {
        customer.name = sale.customer_name;
        customer.lastSale = sale.created_at;
      }
      customers.set(key, customer);
    }
    const entries = [...customers.values()].sort((a, b) => b.revenue - a.revenue);
    return `<section class="pos-content">
      ${tabsTitle('Customers', `${entries.length} customer${entries.length === 1 ? '' : 's'} with recorded sales.`)}
      ${card(`<div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Customer</th><th>Phone</th><th>Receipts</th><th>Revenue</th><th>Outstanding</th><th>Last sale</th></tr></thead><tbody>
        ${entries.map((customer) => `<tr><td>${escapeHtml(customer.name)}</td><td>${escapeHtml(customer.phone)}</td><td>${customer.receipts}</td>
          <td>${money(customer.revenue, state.settings.currency)}</td><td>${money(customer.outstanding, state.settings.currency)}</td>
          <td>${new Date(customer.lastSale).toLocaleDateString()}</td></tr>`).join('')
          || '<tr><td colspan="6">Customer name and phone are recorded at checkout.</td></tr>'}
      </tbody></table></div>`)}</section>`;
  }

  return { renderCustomers };
}
