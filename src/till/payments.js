// Recording payments against sales and invoices. Moved verbatim from pos.js: change payment
// behavior only with the owner's OK.
import { rows, run, stmt, transaction } from './db.js';
import { PAYMENT_METHODS, fromCents, nowIso, toCents } from './format.js';
import { listInvoices } from './invoices.js';
import { saveSale } from './sales.js';

async function recordPayment(saleId, amount, method, details = {}) {
  const cents = toCents(amount);
  const feeCents = toCents(details.fee || 0);
  if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isSafeInteger(feeCents) || feeCents < 0
    || !PAYMENT_METHODS.includes(method)) throw new Error('Enter a valid payment amount, fee and method.');
  const sale = (await rows('SELECT total_cents,amount_paid_cents,paid FROM pos_sales WHERE id=?', [Number(saleId)]))[0];
  if (!sale || sale.paid || cents > sale.total_cents - sale.amount_paid_cents) throw new Error('Payment must be within the remaining balance of an unpaid sale.');
  const remaining = sale.total_cents - sale.amount_paid_cents;
  const totalPaid = sale.amount_paid_cents + cents;
  const complete = totalPaid === sale.total_cents;
  await transaction([
    stmt(`INSERT INTO pos_sale_payments (sale_id,method,amount_cents,fee_cents,mpesa_ref,sender_name,sender_phone,created_at)
      VALUES (?,?,?,?,?,?,?,?)`,
    [Number(saleId), method, cents, feeCents, String(details.mpesaRef || '').trim() || null,
      String(details.senderName || '').trim() || null, String(details.senderPhone || '').trim() || null, nowIso()]),
    stmt('UPDATE pos_sales SET amount_paid_cents=?,paid=?,payment_status=?,payment_method=? WHERE id=?',
      [totalPaid, complete ? 1 : 0, complete ? 'confirmed' : 'partial', method, Number(saleId)])
  ]);
  return { remaining: fromCents(remaining - cents), paid: complete };
}

async function markSalePaid(saleId, method = null) {
  const sale = (await rows('SELECT total_cents,amount_paid_cents,paid FROM pos_sales WHERE id=?', [Number(saleId)]))[0];
  if (!sale || sale.paid) throw new Error('This unpaid sale could not be found.');
  const remaining = fromCents(sale.total_cents - sale.amount_paid_cents);
  if (remaining > 0) return recordPayment(saleId, remaining, method || 'Cash');
  await run("UPDATE pos_sales SET paid=1,payment_status='confirmed' WHERE id=?", [Number(saleId)]);
  return { paid: true, remaining: 0 };
}

// Paying an invoice records the settlement as an ordinary sale. A paid invoice then counts in Overview,
// reports, the till and stock exactly like a till sale, and there is one revenue path, not two. An unpaid
// invoice is only a promise, so it counts nowhere until it is paid.
async function markInvoicePaid(invoiceId, method = 'Cash', { mpesaRef } = {}) {
  const invoice = (await listInvoices()).find((item) => item.id === Number(invoiceId));
  if (!invoice) throw new Error('This invoice could not be found.');
  if (invoice.status === 'paid') throw new Error('This invoice is already paid.');
  const knownProducts = new Set((await rows('SELECT id FROM pos_products')).map((row) => Number(row.id)));
  const items = invoice.items.map((item) => ({
    productId: knownProducts.has(Number(item.productId)) ? Number(item.productId) : 0,
    name: item.name, quantity: item.quantity, unitPrice: item.unitPrice
  }));
  const contact = String(invoice.customer_contact || '').trim();
  const hasPhone = /^[+\d][\d\s()+-]{5,20}$/.test(contact);
  const sale = await saveSale(items, {
    paymentMethod: method, paid: true, allowOutOfStock: true, mpesaRef,
    customerName: hasPhone ? invoice.customer_name : '', customerPhone: hasPhone ? contact : ''
  });
  await run('UPDATE pos_sales SET customer_name=? WHERE id=?', [invoice.customer_name, sale.id]);
  await run("UPDATE pos_invoices SET status='paid',paid_at=?,sale_receipt=? WHERE id=? AND status<>'paid'",
    [nowIso(), sale.receiptNumber, invoice.id]);
  return { ...sale, invoiceNumber: invoice.invoice_number, productIds: [...new Set(items.map((item) => item.productId).filter(Boolean))] };
}

export { recordPayment, markInvoicePaid };
