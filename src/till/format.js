// Small pure helpers the till shares: money and date formatting, HTML escaping, IDs,
// form checks and CSV parsing. No database, no DOM.
import {
  SERVICE_MAX_MINUTES, SERVICE_MIN_MINUTES, SERVICE_STEP_MINUTES
} from '../service-model.js';

const PAYMENT_METHODS = ['Cash', 'Mobile money', 'Card', 'Bank', 'Other'];
const INSTANCE_MODES = [
  ['normal', 'Normal', 'Start and stop when you choose.'],
  ['set-time', 'Set time', 'Stop automatically after a duration or at a chosen time.'],
  ['counted', 'Counted', 'Use checkpoints, pause, resume and stop.']
];
const fromCents = (value) => Number(value || 0) / 100;
const toCents = (value) => Math.round(Number(value) * 100);
const nowIso = () => new Date().toISOString();
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localDateKey = (value) => {
  const text = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isFinite(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : text.slice(0, 10);
};
const numberTag = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const createSku = () => {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return `ESHOP-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const money = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount || 0);
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
};

const assertDate = (date, label = 'Date') => {
  const parts = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  const parsed = parts ? new Date(Number(date.slice(0, 4)), Number(parts[1]) - 1, Number(parts[2])) : new Date(Number.NaN);
  if (!parts || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(date.slice(0, 4))
    || parsed.getMonth() !== Number(parts[1]) - 1 || parsed.getDate() !== Number(parts[2])) {
    throw new Error(`${label} must be a real calendar date in YYYY-MM-DD format.`);
  }
};
const durationLabel = (minutes) => {
  const total = Number(minutes) || 0;
  if (total < 60) return `${total} min`;
  return total % 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total / 60} h`;
};
const serviceChoices = () => Array.from(
  { length: (SERVICE_MAX_MINUTES - SERVICE_MIN_MINUTES) / SERVICE_STEP_MINUTES + 1 },
  (_, index) => { const minutes = SERVICE_MIN_MINUTES + index * SERVICE_STEP_MINUTES; return [minutes, durationLabel(minutes)]; }
);
// An id that already starts with "PO-" must not be prefixed again.
const purchaseLabel = (purchase) => String(purchase.reference || '').trim()
  || `PO-${String(purchase.id || '').replace(/^PO-/i, '').slice(0, 8)}`;
const assertTotals = (items, taxRate) => {
  if (!items.length) throw new Error('Add at least one item.');
  let subtotalCents = 0;
  for (const item of items) {
    const price = toCents(item.unitPrice);
    const quantity = Number(item.quantity);
    if (!item.name?.trim() || !Number.isSafeInteger(price) || price < 0
      || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999) {
      throw new Error('Check each item name, price and quantity.');
    }
    subtotalCents += price * quantity;
    if (!Number.isSafeInteger(subtotalCents)) throw new Error('The total is too large to save safely.');
  }
  const taxCents = Math.round(subtotalCents * taxRate / 100);
  if (!Number.isSafeInteger(taxCents) || !Number.isSafeInteger(subtotalCents + taxCents)) {
    throw new Error('The total including tax is too large to save safely.');
  }
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
};
const csvRows = (text) => {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV contains an unfinished quoted field.');
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
};

export {
  PAYMENT_METHODS, INSTANCE_MODES, fromCents, toCents, nowIso, today, localDateKey, numberTag,
  createSku, escapeHtml, money, assertDate, durationLabel, serviceChoices, purchaseLabel,
  assertTotals, csvRows
};
