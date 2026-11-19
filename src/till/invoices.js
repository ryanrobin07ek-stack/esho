// Invoice records in local SQLite.
import { rows, stmt, transaction } from './db.js';
import { assertDate, assertTotals, fromCents, nowIso, numberTag, toCents } from './format.js';
import { getSettings } from './settings-store.js';

async function listInvoices() {
  const invoices = await rows('SELECT * FROM pos_invoices ORDER BY created_at DESC,id DESC');
  for (const invoice of invoices) {
    invoice.subtotal = fromCents(invoice.subtotal_cents);
    invoice.tax = fromCents(invoice.tax_cents);
    invoice.total = fromCents(invoice.total_cents);
    invoice.items = (await rows('SELECT product_id AS productId,name,quantity,unit_price_cents FROM pos_invoice_items WHERE invoice_id=? ORDER BY id', [invoice.id]))
      .map((item) => ({ productId: item.productId || 0, name: item.name, quantity: item.quantity, unitPrice: fromCents(item.unit_price_cents) }));
  }
  return invoices;
}

async function saveInvoice(data) {
  const customer = String(data.customerName || '').trim();
  const dueDate = String(data.dueDate || '').trim();
  if (!customer) throw new Error('Enter a customer name.');
  if (dueDate) assertDate(dueDate, 'Invoice due date');
  const settings = await getSettings();
  const { subtotalCents, taxCents, totalCents } = assertTotals(data.items || [], settings.taxRate);
  const id = Number(data.id || 0);
  const values = [customer, String(data.customerContact || '').trim(), dueDate,
    String(data.notes || '').trim(), subtotalCents, taxCents, totalCents, settings.currency];
  const existingInvoice = id ? (await rows('SELECT invoice_number,status FROM pos_invoices WHERE id=?', [id]))[0] : null;
  const invoiceNumber = id ? existingInvoice?.invoice_number : numberTag('INV');
  if (!invoiceNumber) throw new Error('This invoice could not be found.');
  if (existingInvoice?.status === 'paid') throw new Error('A paid invoice is already recorded as a sale and cannot be edited.');
  const statements = id
    ? [stmt(`UPDATE pos_invoices SET customer_name=?,customer_contact=?,due_date=?,notes=?,subtotal_cents=?,tax_cents=?,total_cents=?,currency=? WHERE id=?`, [...values, id]),
      stmt('DELETE FROM pos_invoice_items WHERE invoice_id=?', [id])]
    : [stmt(`INSERT INTO pos_invoices (invoice_number,customer_name,customer_contact,due_date,notes,subtotal_cents,tax_cents,total_cents,currency,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, [invoiceNumber, ...values, nowIso()])];
  const itemStatements = (data.items || []).map((item) => stmt(`INSERT INTO pos_invoice_items (invoice_id,product_id,name,quantity,unit_price_cents)
    SELECT id,?,?,?,? FROM pos_invoices WHERE invoice_number=?`, [item.productId || null, item.name, item.quantity, toCents(item.unitPrice), invoiceNumber]));
  await transaction([...statements, ...itemStatements]);
  const saved = (await rows('SELECT id FROM pos_invoices WHERE invoice_number=?', [invoiceNumber]))[0];
  if (!saved) throw new Error('Invoice was saved but could not be read back.');
  return saved.id;
}

export { listInvoices, saveInvoice };
