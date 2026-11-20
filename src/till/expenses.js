// Expense records in local SQLite.
import { rows, run } from './db.js';
import { assertDate, fromCents, nowIso, toCents } from './format.js';

async function listExpenses() {
  const items = await rows('SELECT * FROM pos_expenses ORDER BY expense_date DESC,id DESC');
  return items.map((item) => ({
    ...item,
    amount: fromCents(item.amount_cents),
    createdAt: item.created_at,
    date: item.expense_date
  }));
}

async function saveExpense(data) {
  const date = String(data.date || '').trim();
  assertDate(date, 'Expense date');
  const category = String(data.category || '').trim();
  const label = String(data.label || '').trim();
  const cents = toCents(data.amount);
  const currency = String(data.currency || '').trim().toUpperCase();
  const method = data.paymentMethod || 'Unknown';
  if (!category || !label || !Number.isSafeInteger(cents) || cents <= 0 || !/^[A-Z]{3}$/.test(currency)
    || !['Cash', 'Mobile money', 'Card', 'Unknown'].includes(method)) {
    throw new Error('Enter a category, description, positive amount and valid payment method.');
  }
  const id = Number(data.id || 0);
  const values = [date, category, label, cents, currency, method, String(data.note || '').trim()];
  if (id) {
    const result = await run('UPDATE pos_expenses SET expense_date=?,category=?,label=?,amount_cents=?,currency=?,payment_method=?,note=? WHERE id=?', [...values, id]);
    if (!result.changes?.changes) throw new Error('This expense could not be found. Refresh and try again.');
    return (await rows('SELECT * FROM pos_expenses WHERE id=?', [id]))[0];
  }
  const result = await run('INSERT INTO pos_expenses (sync_key,expense_date,category,label,amount_cents,currency,payment_method,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [`EXP-${crypto.randomUUID()}`, ...values, nowIso()]);
  return (await rows('SELECT * FROM pos_expenses WHERE id=?', [result.changes?.lastId]))[0];
}

export { listExpenses, saveExpense };
