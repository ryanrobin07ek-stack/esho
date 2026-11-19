// Quotation records in local SQLite, and turning a quotation into an invoice.
import { rows, run, stmt, transaction } from './db.js';
import { assertTotals, fromCents, nowIso, numberTag, toCents } from './format.js';
import { saveInvoice } from './invoices.js';
import { getSettings } from './settings-store.js';

async function listQuotations() {
  const quotations = await rows('SELECT * FROM pos_quotations ORDER BY created_at DESC,id DESC');
  const lines = await rows('SELECT quotation_id,product_id AS productId,name,quantity,unit_price_cents FROM pos_quotation_items ORDER BY quotation_id,id');
  for (const quotation of quotations) {
    quotation.subtotal = fromCents(quotation.subtotal_cents);
    quotation.tax = fromCents(quotation.tax_cents);
    quotation.total = fromCents(quotation.total_cents);
    quotation.items = lines.filter((line) => line.quotation_id === quotation.id)
      .map((line) => ({ productId: line.productId || 0, name: line.name, quantity: line.quantity, unitPrice: fromCents(line.unit_price_cents) }));
  }
  return quotations;
}

async function saveQuotation(data) {
  const customer = String(data.customerName || '').trim();
  if (!customer) throw new Error('Enter a customer name.');
  const settings = await getSettings();
  const items = data.items || [];
  const { subtotalCents, taxCents, totalCents } = assertTotals(items, settings.taxRate);
  const id = Number(data.id || 0);
  const existing = id ? (await rows('SELECT quotation_number,status FROM pos_quotations WHERE id=?', [id]))[0] : null;
  if (id && !existing) throw new Error('This quotation could not be found.');
  if (existing?.status === 'converted') throw new Error('This quotation was already converted to an invoice and cannot be edited.');
  const number = id ? existing.quotation_number : numberTag('QUO');
  const values = [customer, String(data.customerContact || '').trim(), String(data.notes || '').trim(),
    subtotalCents, taxCents, totalCents, settings.currency];
  const head = id
    ? [stmt('UPDATE pos_quotations SET customer_name=?,customer_contact=?,notes=?,subtotal_cents=?,tax_cents=?,total_cents=?,currency=? WHERE id=?', [...values, id]),
      stmt('DELETE FROM pos_quotation_items WHERE quotation_id=?', [id])]
    : [stmt(`INSERT INTO pos_quotations (quotation_number,customer_name,customer_contact,notes,subtotal_cents,tax_cents,total_cents,currency,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`, [number, ...values, nowIso()])];
  const lines = items.map((item) => stmt(`INSERT INTO pos_quotation_items (quotation_id,product_id,name,quantity,unit_price_cents)
    SELECT id,?,?,?,? FROM pos_quotations WHERE quotation_number=?`,
  [Number(item.productId) > 0 ? Number(item.productId) : null, item.name, item.quantity, toCents(item.unitPrice), number]));
  await transaction([...head, ...lines]);
  const saved = (await rows('SELECT id FROM pos_quotations WHERE quotation_number=?', [number]))[0];
  if (!saved) throw new Error('The quotation was saved but could not be read back.');
  return saved.id;
}

async function deleteQuotation(id) {
  await transaction([
    stmt('DELETE FROM pos_quotation_items WHERE quotation_id=?', [Number(id)]),
    stmt('DELETE FROM pos_quotations WHERE id=?', [Number(id)])
  ]);
}

async function convertQuotationToInvoice(id) {
  const quotation = (await listQuotations()).find((item) => item.id === Number(id));
  if (!quotation) throw new Error('This quotation could not be found.');
  if (quotation.status === 'converted') throw new Error('This quotation was already converted to an invoice.');
  const invoiceId = await saveInvoice({
    customerName: quotation.customer_name, customerContact: quotation.customer_contact,
    notes: quotation.notes, dueDate: '', items: quotation.items
  });
  await run("UPDATE pos_quotations SET status='converted',invoice_id=? WHERE id=?", [invoiceId, quotation.id]);
  return invoiceId;
}

export { listQuotations, saveQuotation, deleteQuotation, convertQuotationToInvoice };
