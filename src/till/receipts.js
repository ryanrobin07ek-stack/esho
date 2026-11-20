// Printable receipts, quotations and invoices.
import { escapeHtml, money } from './format.js';

export function createTillReceipts({ toast }) {
  function printDocument(title, content) {
    const popup = window.open('', '_blank');
    if (!popup) {
      toast('Allow pop-ups to print or save this document as PDF.', true);
      return;
    }
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width"><style>
      body{font:14px Arial,sans-serif;max-width:680px;margin:30px auto;color:#111;padding:0 18px}h1{text-align:center}
      table{width:100%;border-collapse:collapse}td,th{padding:9px 4px;border-bottom:1px solid #ddd;text-align:left}
      .right{text-align:right}.total{font-weight:bold;border-top:2px solid #111;padding-top:12px}@media print{button{display:none}}
      </style></head><body>${content}<script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  // The customer's copy must always show what the sale came to, how it was paid, and what is still
  // owed. It used to print "Paid · 0.00" on a settled sale, because it showed the balance under a
  // "Paid" label and never showed the total or the method at all.
  function receiptPaymentLine(sale) {
    const paidSoFar = Number(sale.amountPaid) || 0;
    const balance = Math.max(0, Number(sale.total || 0) - paidSoFar);
    const rawMethod = sale.payment_method && sale.payment_method !== 'Unknown' ? sale.payment_method : '';
    const method = rawMethod ? ` · ${escapeHtml(rawMethod)}` : '';
    if (sale.paid) return `<p>Paid in full${method}</p>`;
    if (paidSoFar > 0) {
      return `<p>Paid ${money(paidSoFar, sale.currency)}${method} · Balance due ${money(balance, sale.currency)}</p>`;
    }
    return `<p>Unpaid · Balance due ${money(balance, sale.currency)}${method}</p>`;
  }

  function receiptHtml(sale) {
    return `<h1>Craft · Receipt</h1><p>${escapeHtml(sale.receipt_number)} · ${new Date(sale.created_at).toLocaleString()}</p>
      <p>${escapeHtml(sale.customer_name || '')} ${escapeHtml(sale.customer_phone || '')}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${sale.items.map((item) =>
        `<tr><td>${escapeHtml(item.name)}${item.variantLabel ? ` · ${escapeHtml(item.variantLabel)}` : ''}${item.attributesLabel ? ` · ${escapeHtml(item.attributesLabel)}` : ''}</td><td>${item.quantity}</td><td>${money(item.unitPrice, sale.currency)}</td><td>${money(item.quantity * item.unitPrice, sale.currency)}</td></tr>`).join('')}
      </tbody></table><p>Subtotal ${money(sale.subtotal, sale.currency)} · Discount ${money(sale.discount, sale.currency)} · Tax ${money(sale.tax, sale.currency)}</p>
      <p class="total">Total · ${money(sale.total, sale.currency)}</p>
      ${receiptPaymentLine(sale)}`;
  }

  function quotationHtml(quotation) {
    return `<h1>Craft · Quotation</h1><p>${escapeHtml(quotation.quotation_number)} · Prepared ${new Date(quotation.created_at).toLocaleDateString()}</p>
      <p>Customer: ${escapeHtml(quotation.customer_name)} ${escapeHtml(quotation.customer_contact)}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${quotation.items.map((item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice, quotation.currency)}</td><td>${money(item.quantity * item.unitPrice, quotation.currency)}</td></tr>`).join('')}
      </tbody></table><p>Subtotal ${money(quotation.subtotal, quotation.currency)} · Tax ${money(quotation.tax, quotation.currency)}</p>
      <p class="total">Quoted total · ${money(quotation.total, quotation.currency)}</p><p>${escapeHtml(quotation.notes)}</p>
      <p>Quotation only · not a tax invoice or completed sale.</p>`;
  }

  function invoiceHtml(invoice) {
    return `<h1>Craft · Invoice</h1><p>${escapeHtml(invoice.invoice_number)} · ${new Date(invoice.created_at).toLocaleDateString()}</p>
      <p>Bill to: ${escapeHtml(invoice.customer_name)} ${escapeHtml(invoice.customer_contact)}</p>
      ${invoice.due_date ? `<p>Due: ${escapeHtml(invoice.due_date)}</p>` : ''}
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${invoice.items.map((item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice, invoice.currency)}</td><td>${money(item.quantity * item.unitPrice, invoice.currency)}</td></tr>`).join('')}
      </tbody></table><p>Subtotal ${money(invoice.subtotal, invoice.currency)} · Tax ${money(invoice.tax, invoice.currency)}</p>
      <p class="total">${invoice.status === 'paid' ? 'Paid' : 'Amount due'} · ${money(invoice.total, invoice.currency)}</p><p>${escapeHtml(invoice.notes)}</p>`;
  }

  return { printDocument, receiptHtml, quotationHtml, invoiceHtml };
}
