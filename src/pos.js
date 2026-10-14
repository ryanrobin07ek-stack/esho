import { registerPlugin } from '@capacitor/core';

const NearbyBluetooth = registerPlugin('NearbyBluetooth');

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
export function classifyQrCode(value) {
  const content = String(value ?? '').trim().slice(0, 2000);
  if (/^(?:ESHOP-)?RECEIPT[:/]/i.test(content) || /^eshop:\/\/receipt\//i.test(content)) {
    return { type: 'receipt', label: 'Receipt reference', content };
  }
  try {
    const url = new URL(content);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return { type: 'link', label: 'Store or web link', content: url.href };
    }
  } catch {}
  return { type: 'text', label: 'QR code text', content };
}
export function parseProductLabel(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fullText = lines.join('\n');
  const name = lines
    .filter((line) => /[a-z]/i.test(line) && !/\b(?:exp(?:iry)?|best before|use by|price|net wt|nutrition facts)\b/i.test(line))
    .sort((left, right) => right.length - left.length)[0] || '';
  const priceMatch = fullText.match(/(?:KES|KSh|USD|EUR|GBP|UGX|TZS|RWF|ZAR)\s*[:.]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)
    || fullText.match(/(?:^|\s)([0-9]+[.,][0-9]{2})(?=\s|$)/m);
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '').replace(',', '.')) : null;
  const expiryMatch = fullText.match(/\b(?:EXP(?:IRY)?|BBE|BEST\s*BEFORE|USE\s*BY)\s*[:.]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  let expiryDate = '';
  if (expiryMatch) {
    const [, dateText] = expiryMatch;
    let year, month, day;
    if (/^\d{4}/.test(dateText)) [year, month, day] = dateText.split(/[-/]/).map(Number);
    else {
      [day, month, year] = dateText.split(/[-/]/).map(Number);
      if (year < 100) year += year < 50 ? 2000 : 1900;
    }
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      expiryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return { name, price: Number.isFinite(price) ? price : null, expiryDate };
}
export function matchProductLabel(text, products) {
  const words = (value) => String(value ?? '').toLocaleLowerCase().match(/[a-z0-9]+/g) || [];
  const labelLines = String(text ?? '').split(/\r?\n/).map(words).filter((line) => line.length);
  const labelWords = labelLines.flat();
  if (!labelWords.length) return null;
  const matches = (products || []).filter((product) => {
    const nameWords = words(product.name);
    if (!nameWords.length) return false;
    return nameWords.length === 1
      ? labelLines.some((line) => line.length === 1 && line[0] === nameWords[0])
      : nameWords.length <= labelWords.length && labelWords.some((_, index) =>
        nameWords.every((word, offset) => labelWords[index + offset] === word));
  });
  if (!matches.length) return null;
  const specificity = (product) => words(product.name).length * 1000 + String(product.name).length;
  matches.sort((left, right) => specificity(right) - specificity(left));
  if (matches.length > 1 && specificity(matches[0]) === specificity(matches[1])) return null;
  return matches[0];
}
export const MIN_IMAGE_MATCH_SIMILARITY = 0.7;
export function suggestImageCategories(labels, categories) {
  const normalize = (value) => String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = {
    food: ['food', 'grocery', 'groceries', 'produce', 'fruit', 'vegetable', 'vegetables', 'snack', 'bread', 'dairy', 'meat', 'seafood'],
    drink: ['drink', 'drinks', 'beverage', 'beverages', 'water', 'juice', 'coffee', 'tea', 'soda', 'bottle', 'milk'],
    bakery: ['bakery', 'bread', 'cake', 'pastry', 'baked goods'],
    beauty: ['beauty', 'cosmetic', 'cosmetics', 'skincare', 'makeup', 'personal care'],
    household: ['household', 'cleaning', 'detergent', 'laundry', 'home'],
    electronics: ['electronics', 'electronic', 'device', 'phone', 'computer', 'appliance']
  };
  const normalizedLabels = (labels || []).map((label) => ({
    text: normalize(label.text),
    confidence: Number(label.confidence)
  })).filter((label) => label.text && Number.isFinite(label.confidence));
  return (categories || []).map((category) => {
    const name = normalize(category.name);
    if (!name) return null;
    let score = 0;
    let matchedLabel = '';
    for (const label of normalizedLabels) {
      let relevance = 0;
      if (label.text === name) relevance = 1;
      else if (label.text.includes(name) || name.includes(label.text)) relevance = 0.85;
      else {
        const categoryAliases = Object.entries(aliases).find(([, words]) => words.includes(name))?.[1] || [];
        const labelAliases = Object.entries(aliases).find(([, words]) => words.includes(label.text))?.[1] || [];
        if (categoryAliases.some((word) => labelAliases.includes(word))) relevance = 0.72;
      }
      const weighted = relevance * label.confidence;
      if (weighted > score) {
        score = weighted;
        matchedLabel = label.text;
      }
    }
    return score ? { categoryId: category.id, categoryName: category.name, label: matchedLabel, score } : null;
  }).filter(Boolean).sort((left, right) => right.score - left.score).slice(0, 3);
}
export function rankImageMatches(products, embedding, threshold = MIN_IMAGE_MATCH_SIMILARITY, limit = 3) {
  if (!(embedding instanceof Int8Array) || !embedding.length
    || !Number.isFinite(threshold) || threshold < -1 || threshold > 1
    || !Number.isSafeInteger(limit) || limit < 1) return [];
  const queryNorm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!queryNorm) return [];
  const matches = [];
  for (const product of products || []) {
    const hex = String(product.imageEmbeddingHex || '');
    let candidate = product.imageEmbedding;
    if (!(candidate instanceof Int8Array)) {
      if (!hex || hex.length !== embedding.length * 2 || !/^[\da-f]+$/i.test(hex)) continue;
      candidate = new Int8Array(embedding.length);
      for (let index = 0; index < candidate.length; index += 1) {
        const unsigned = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
        candidate[index] = unsigned > 127 ? unsigned - 256 : unsigned;
      }
    }
    if (candidate.length !== embedding.length) continue;
    let dot = 0, candidateNorm = 0;
    for (let index = 0; index < embedding.length; index += 1) {
      const value = candidate[index];
      dot += embedding[index] * value;
      candidateNorm += value * value;
    }
    if (!candidateNorm) continue;
    const similarity = dot / (queryNorm * Math.sqrt(candidateNorm));
    if (similarity >= threshold) matches.push({ product, similarity });
  }
  return matches.sort((left, right) => right.similarity - left.similarity).slice(0, limit);
}
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
const rows = async (sql, values = []) => (await window.ShopSQLite.query(sql, values)).values || [];
const run = (sql, values = []) => window.ShopSQLite.run(sql, values);
const transaction = (statements) => window.ShopSQLite.executeSet(statements, true);
const stmt = (statement, values = []) => ({ statement, values });
const assertDate = (date, label = 'Date') => {
  const parts = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  const parsed = parts ? new Date(Number(date.slice(0, 4)), Number(parts[1]) - 1, Number(parts[2])) : new Date(Number.NaN);
  if (!parts || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(date.slice(0, 4))
    || parsed.getMonth() !== Number(parts[1]) - 1 || parsed.getDate() !== Number(parts[2])) {
    throw new Error(`${label} must be a real calendar date in YYYY-MM-DD format.`);
  }
};
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

async function initializePosDatabase() {
  await window.ShopSQLite.execute(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS pos_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );
    CREATE TABLE IF NOT EXISTS pos_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES pos_categories(id),
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      buying_price_cents INTEGER,
      stock_count INTEGER DEFAULT 0 CHECK (stock_count IS NULL OR stock_count >= 0),
      sku TEXT,
      image_uri TEXT,
      expiry_date TEXT,
      image_embedding BLOB,
      low_stock_threshold INTEGER NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_business_records (
      tenant_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      server_revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, entity, record_id)
    );
    CREATE TABLE IF NOT EXISTS pos_cloud_outbox (
      change_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_inventory_queue (
      event_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      items_json TEXT NOT NULL,
      operation TEXT NOT NULL DEFAULT 'sale',
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shared_inventory (
      tenant_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, sku)
    );
    CREATE TABLE IF NOT EXISTS shared_inventory_events (
      tenant_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS shared_inventory_event_items (
      tenant_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (tenant_id, event_id, sku),
      FOREIGN KEY (tenant_id, event_id) REFERENCES shared_inventory_events(tenant_id, event_id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id, sku) REFERENCES shared_inventory(tenant_id, sku)
    );
    CREATE TRIGGER IF NOT EXISTS shared_inventory_check_stock
    BEFORE INSERT ON shared_inventory_event_items
    BEGIN
      SELECT RAISE(ABORT, 'insufficient_shared_stock')
      WHERE NOT EXISTS (
        SELECT 1 FROM shared_inventory
        WHERE tenant_id = NEW.tenant_id AND sku = NEW.sku AND stock >= NEW.quantity
      );
    END;
    CREATE TRIGGER IF NOT EXISTS shared_inventory_deduct_stock
    AFTER INSERT ON shared_inventory_event_items
    BEGIN
      UPDATE shared_inventory
      SET stock = stock - NEW.quantity, updated_at = datetime('now')
      WHERE tenant_id = NEW.tenant_id AND sku = NEW.sku;
    END;
    CREATE TABLE IF NOT EXISTS pos_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT NOT NULL UNIQUE,
      subtotal_cents INTEGER NOT NULL,
      tax_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      payment_method TEXT,
      paid INTEGER NOT NULL DEFAULT 0,
      customer_name TEXT,
      customer_phone TEXT,
      due_date TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      amount_paid_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
      product_id INTEGER,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL,
      unit_cost_cents INTEGER,
      unit_cost_captured INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pos_sale_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
      method TEXT,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      fee_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'confirmed',
      mpesa_ref TEXT,
      sender_name TEXT,
      sender_phone TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_key TEXT UNIQUE,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      currency TEXT NOT NULL DEFAULT 'KES',
      payment_method TEXT NOT NULL DEFAULT 'Unknown',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_contact TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      subtotal_cents INTEGER NOT NULL,
      tax_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES pos_invoices(id) ON DELETE CASCADE,
      product_id INTEGER,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('float_in', 'bank_drop', 'petty_out')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      currency TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_till_closes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      close_date TEXT NOT NULL,
      expected_cash_cents INTEGER NOT NULL,
      counted_cash_cents INTEGER NOT NULL,
      difference_cents INTEGER NOT NULL,
      currency TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('normal', 'set-time', 'counted')),
      status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'paused', 'completed')),
      started_at TEXT NOT NULL,
      scheduled_end_at TEXT,
      ended_at TEXT,
      intervals_json TEXT NOT NULL DEFAULT '[]',
      checkpoints_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pos_one_open_instance
      ON pos_instances((1)) WHERE status IN ('scheduled', 'active', 'paused');
  `);
  const productColumns = await rows('PRAGMA table_info(pos_products)');
  if (!productColumns.some((column) => column.name === 'sku')) {
    await run('ALTER TABLE pos_products ADD COLUMN sku TEXT');
  }
  if (!productColumns.some((column) => column.name === 'barcode')) {
    await run('ALTER TABLE pos_products ADD COLUMN barcode TEXT');
  }
  if (!productColumns.some((column) => column.name === 'expiry_date')) {
    await run('ALTER TABLE pos_products ADD COLUMN expiry_date TEXT');
  }
  if (!productColumns.some((column) => column.name === 'image_embedding')) {
    await run('ALTER TABLE pos_products ADD COLUMN image_embedding BLOB');
  }
  await window.ShopSQLite.execute('CREATE INDEX IF NOT EXISTS pos_products_barcode_lookup ON pos_products(barcode)');
  if (!productColumns.some((column) => column.name === 'low_stock_threshold')) {
    await run('ALTER TABLE pos_products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 3');
  }
  if (!productColumns.some((column) => column.name === 'active')) {
    await run('ALTER TABLE pos_products ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  }
  const saleColumns = await rows('PRAGMA table_info(pos_sales)');
  if (!saleColumns.some((column) => column.name === 'discount_cents')) {
    await run('ALTER TABLE pos_sales ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0');
  }
  const queueColumns = await rows('PRAGMA table_info(pos_inventory_queue)');
  if (!queueColumns.some((column) => column.name === 'operation')) {
    await run("ALTER TABLE pos_inventory_queue ADD COLUMN operation TEXT NOT NULL DEFAULT 'sale'");
  }
  const expenseColumns = await rows('PRAGMA table_info(pos_expenses)');
  if (!expenseColumns.some((column) => column.name === 'sync_key')) {
    await run('ALTER TABLE pos_expenses ADD COLUMN sync_key TEXT');
  }
  const expensesWithoutSyncKey = await rows('SELECT id FROM pos_expenses WHERE sync_key IS NULL');
  for (const expense of expensesWithoutSyncKey) {
    await run('UPDATE pos_expenses SET sync_key=? WHERE id=?', [`EXP-${crypto.randomUUID()}`, expense.id]);
  }
  await window.ShopSQLite.execute(`
    INSERT OR IGNORE INTO pos_categories (name) VALUES ('General'), ('Food'), ('Drinks'), ('Other');
    INSERT OR IGNORE INTO pos_settings (key, value) VALUES ('tax_rate', '0'), ('currency', 'KES');
  `);
}

async function getSettings() {
  const settings = Object.fromEntries((await rows('SELECT key, value FROM pos_settings')).map((row) => [row.key, row.value]));
  let insightPreferences = { dismissed: [], snoozed: {} };
  if (settings.insight_preferences) {
    try {
      const saved = JSON.parse(settings.insight_preferences);
      if (!saved || typeof saved !== 'object' || !Array.isArray(saved.dismissed)
        || !saved.snoozed || typeof saved.snoozed !== 'object' || Array.isArray(saved.snoozed)) {
        throw new Error('Saved POS insight preferences have an invalid format.');
      }
      insightPreferences = {
        dismissed: saved.dismissed.filter((item) => typeof item === 'string'),
        snoozed: Object.fromEntries(Object.entries(saved.snoozed)
          .filter(([key, value]) => typeof key === 'string' && Number.isFinite(value)))
      };
    } catch (error) {
      throw new Error(`Could not read saved POS insight preferences: ${error instanceof Error ? error.message : 'invalid data'}`);
    }
  }
  const monthlyRevenueGoal = settings.monthly_revenue_goal_cents == null
    ? null : Number(settings.monthly_revenue_goal_cents);
  if (monthlyRevenueGoal !== null && (!Number.isSafeInteger(monthlyRevenueGoal) || monthlyRevenueGoal <= 0)) {
    throw new Error('The saved monthly revenue goal is invalid. Update it in Overview insights.');
  }
  const currency = /^[A-Z]{3}$/.test(settings.currency || '') ? settings.currency : 'KES';
  const monthlyRevenueGoalCurrency = settings.monthly_revenue_goal_currency
    || (monthlyRevenueGoal === null ? null : currency);
  if (monthlyRevenueGoalCurrency !== null && !/^[A-Z]{3}$/.test(monthlyRevenueGoalCurrency)) {
    throw new Error('The saved monthly revenue goal currency is invalid. Update it in Overview insights.');
  }
  return {
    taxRate: Number.isFinite(Number(settings.tax_rate)) ? Number(settings.tax_rate) : 0,
    currency,
    monthlyRevenueGoal,
    monthlyRevenueGoalCurrency,
    insightPreferences,
    cloudSyncTenantId: String(settings.cloud_sync_tenant_id || ''),
    cloudSyncEnabled: settings.cloud_sync_enabled === '1',
    cloudSyncError: String(settings.cloud_sync_error || '')
  };
}

async function saveMonthlyRevenueGoal(amount, currency) {
  const cents = toCents(amount);
  const code = String(currency || '').toUpperCase();
  if (!Number.isSafeInteger(cents) || cents <= 0 || !/^[A-Z]{3}$/.test(code)) {
    throw new Error('Enter a positive monthly revenue goal in the store currency.');
  }
  await transaction([
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['monthly_revenue_goal_cents', String(cents)]),
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['monthly_revenue_goal_currency', code])
  ]);
}

async function saveInsightPreferences(preferences) {
  if (!preferences || !Array.isArray(preferences.dismissed) || !preferences.snoozed
    || typeof preferences.snoozed !== 'object' || Array.isArray(preferences.snoozed)) {
    throw new Error('Insight preferences could not be saved because their format is invalid.');
  }
  await run('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)',
    ['insight_preferences', JSON.stringify(preferences)]);
}

async function saveSettings(taxRate, currency) {
  const rate = Number(taxRate);
  const code = String(currency || '').trim().toUpperCase();
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 || !/^[A-Z]{3}$/.test(code)) {
    throw new Error('Tax must be from 0% to 100%, and currency must be a 3-letter code.');
  }

  await transaction([
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['tax_rate', String(rate)]),
    stmt('INSERT OR REPLACE INTO pos_settings (key, value) VALUES (?, ?)', ['currency', code])
  ]);
}

async function listProducts() {
  return rows(`SELECT p.id, p.name, p.sku, p.barcode, p.expiry_date AS expiryDate, p.category_id AS categoryId, c.name AS categoryName,
    p.price_cents, p.buying_price_cents, p.stock_count AS stock, p.image_uri AS imageUri,
    hex(p.image_embedding) AS imageEmbeddingHex,
    p.low_stock_threshold AS lowStockThreshold, p.active
    FROM pos_products p LEFT JOIN pos_categories c ON c.id = p.category_id ORDER BY p.name COLLATE NOCASE`)
    .then((items) => items.map((item) => ({
      id: item.id, name: item.name, sku: item.sku || '', barcode: item.barcode || '',
      expiryDate: item.expiryDate || '',
      categoryId: item.categoryId, categoryName: item.categoryName || '',
      price: fromCents(item.price_cents), buyingPrice: item.buying_price_cents == null ? null : fromCents(item.buying_price_cents),
      stock: item.stock, imageUri: item.imageUri, imageEmbedding: embeddingHexToInt8(item.imageEmbeddingHex || ''),
      lowStockThreshold: Number(item.lowStockThreshold) || 0,
      active: item.active !== 0
    })));
}

async function listCategories() {
  return rows('SELECT id, name FROM pos_categories ORDER BY name COLLATE NOCASE');
}

async function saveProduct(data) {
  const id = Number(data.id || 0);
  const name = String(data.name || '').trim();
  let sku = String(data.sku || '').trim();
  let barcode = data.barcode === undefined ? '' : String(data.barcode || '').trim();
  let expiryDate = data.expiryDate === undefined ? '' : String(data.expiryDate || '').trim();
  if (id > 0 && (!sku || data.barcode === undefined)) {
    const existing = (await rows('SELECT sku,barcode,expiry_date FROM pos_products WHERE id = ?', [id]))[0];
    if (!sku) sku = existing?.sku || '';
    if (data.barcode === undefined) barcode = existing?.barcode || '';
    if (data.expiryDate === undefined) expiryDate = existing?.expiry_date || '';
  }
  while (!sku) {
    const candidate = createSku();
    const existing = (await rows('SELECT id FROM pos_products WHERE sku = ? LIMIT 1', [candidate]))[0];
    if (!existing) sku = candidate;
  }
  const categoryId = Number(data.categoryId);
  const priceCents = toCents(data.price);
  const buyingCents = String(data.buyingPrice ?? '').trim() === '' ? null : toCents(data.buyingPrice);
  const stock = String(data.stock ?? '').trim() === '' ? null : Number(data.stock);
  const lowStockThreshold = Number(data.lowStockThreshold ?? 3);
  const active = data.active === false || data.active === '0' ? 0 : 1;
  if (expiryDate) assertDate(expiryDate, 'Expiry date');
  if (!name || sku.length > 120 || barcode.length > 120 || !Number.isSafeInteger(categoryId) || categoryId <= 0 || !Number.isSafeInteger(priceCents) || priceCents < 0
    || (buyingCents !== null && (!Number.isSafeInteger(buyingCents) || buyingCents < 0))
    || (stock !== null && (!Number.isSafeInteger(stock) || stock < 0))
    || !Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0) {
    throw new Error('Enter a name, category, valid prices, stock and reorder threshold.');
  }
  const category = (await rows('SELECT id FROM pos_categories WHERE id = ?', [categoryId]))[0];
  if (!category) throw new Error('Choose a category that still exists.');
  if (sku && (await rows('SELECT id FROM pos_products WHERE sku=? AND id<>? LIMIT 1', [sku, id]))[0]) {
    throw new Error('That barcode/SKU is already assigned to another product.');
  }
  if (barcode && (await rows('SELECT id FROM pos_products WHERE (barcode=? COLLATE NOCASE OR sku=? COLLATE NOCASE) AND id<>? LIMIT 1',
    [barcode, barcode, id]))[0]) {
    throw new Error('That barcode is already assigned to another product.');
  }
  const values = [name, categoryId, priceCents, buyingCents, stock, sku || null, barcode || null, expiryDate || null,
    String(data.imageUri || '').trim() || null,
    lowStockThreshold, active];
  const hasEmbedding = Object.hasOwn(data, 'imageEmbeddingHex');
  const embeddingHex = hasEmbedding ? String(data.imageEmbeddingHex || '') : '';
  if (hasEmbedding && embeddingHex && (!/^(?:[\da-f]{2}){128,4096}$/i.test(embeddingHex))) {
    throw new Error('The product image match profile is invalid. Choose the photo again and retry.');
  }
  if (id > 0) {
    const embeddingUpdate = hasEmbedding ? `,image_embedding=${embeddingHex ? `X'${embeddingHex}'` : 'NULL'}` : '';
    const result = await run(`UPDATE pos_products SET name=?,category_id=?,price_cents=?,buying_price_cents=?,stock_count=?,sku=?,barcode=?,expiry_date=?,image_uri=?,low_stock_threshold=?,active=?${embeddingUpdate} WHERE id=?`, [...values, id]);
    if (!result.changes?.changes) throw new Error('This product could not be found. Refresh and try again.');
    await recordSharedStockUpdate(sku, stock);
    return id;
  }
  const embeddingColumn = hasEmbedding ? ',image_embedding' : '';
  const embeddingValue = hasEmbedding ? `,${embeddingHex ? `X'${embeddingHex}'` : 'NULL'}` : '';
  const result = await run(`INSERT INTO pos_products (name,category_id,price_cents,buying_price_cents,stock_count,sku,barcode,expiry_date,image_uri,low_stock_threshold,active,created_at${embeddingColumn}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?${embeddingValue})`, [...values, nowIso()]);
  await recordSharedStockUpdate(sku, stock);
  return result.changes?.lastId;
}

async function recordSharedStockUpdate(sku, stock) {
  const tenantId = (await rows("SELECT value FROM pos_settings WHERE key='shared_tenant_id'"))[0]?.value;
  if (!tenantId || !sku || !Number.isSafeInteger(stock) || stock < 0) return;
  const eventId = numberTag('STOCK');
  const createdAt = nowIso();
  const body = JSON.stringify({ mode: 'replace', items: [{ sku, stock }] });
  await transaction([
    stmt(`INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(tenant_id,sku) DO UPDATE SET stock=excluded.stock,updated_at=excluded.updated_at`,
    [tenantId, sku, stock, createdAt]),
    stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
      [tenantId, eventId, createdAt]),
    stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
      VALUES (?,?,?,'connect','pending',?)`, [eventId, tenantId, body, createdAt])
  ]);
  await window.EshopInventoryBridge?.updateLocalStock?.(tenantId, [{ sku, stock }]);
  if (navigator.onLine !== false && window.EshopInventoryBridge?.hasTenantOwnerKey?.(tenantId) !== false) {
    try {
      await window.EshopInventoryBridge?.request?.(tenantId, 'connect', 'POST', JSON.parse(body));
      await run("UPDATE pos_inventory_queue SET status='synced',last_error=NULL,updated_at=? WHERE event_id=?",
        [nowIso(), eventId]);
    } catch (error) {
      await run('UPDATE pos_inventory_queue SET last_error=?,updated_at=? WHERE event_id=?',
        [String(error instanceof Error ? error.message : error).slice(0, 500), nowIso(), eventId]);
    }
  }
}

async function addCategory(name) {
  const value = String(name || '').trim();
  if (!value) throw new Error('Enter a category name.');
  await run('INSERT INTO pos_categories (name) VALUES (?)', [value]);
}

async function deleteProduct(id) {
  await run('DELETE FROM pos_products WHERE id = ?', [Number(id)]);
}

async function saveSale(items, { paymentMethod, paid, customerName, customerPhone, dueDate, allowOutOfStock, discount } = {}) {
  const settings = await getSettings();
  const { subtotalCents } = assertTotals(items, settings.taxRate);
  const discountCents = toCents(discount || 0);
  if (!Number.isSafeInteger(discountCents) || discountCents < 0 || discountCents > subtotalCents) {
    throw new Error('Discount must be between zero and the sale subtotal.');
  }
  const taxCents = Math.round((subtotalCents - discountCents) * settings.taxRate / 100);
  const totalCents = subtotalCents - discountCents + taxCents;
  const customer = String(customerName || '').trim();
  const phone = String(customerPhone || '').trim();
  const method = paymentMethod || null;
  if ((customer && !phone) || (!customer && phone)) throw new Error('Enter both customer name and phone, or leave both blank.');
  if (phone && !/^[+\d][\d\s()+-]{5,20}$/.test(phone)) throw new Error('Enter a valid customer phone number.');
  const date = String(dueDate || '').trim();
  if (date) assertDate(date, 'Credit due date');
  if (paid && date) throw new Error('A due date is only for an unpaid credit sale.');
  if (method && !PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');
  const quantityMap = new Map();
  items.forEach((item) => quantityMap.set(Number(item.productId), (quantityMap.get(Number(item.productId)) || 0) + Number(item.quantity)));
  const productData = new Map();
  for (const [productId, requested] of quantityMap) {
    const product = (await rows('SELECT id,name,sku,stock_count,buying_price_cents,active FROM pos_products WHERE id=?', [productId]))[0];
    if (!product) throw new Error('A product in this sale is no longer available.');
    if (product.active !== 1) throw new Error(`${product.name} is disabled and cannot be sold.`);
    if (!allowOutOfStock && product.stock_count !== null && requested > product.stock_count) {
      throw new Error(`${product.name} has ${product.stock_count} in stock, ${requested} requested.`);
    }
    productData.set(productId, product);
  }
  const awaitingMobilePayment = method === 'Mobile money' && !paid;
  const isPaid = Boolean(paid) && !awaitingMobilePayment;
  const createdAt = nowIso();
  const receipt = numberTag('SALE');
  const statements = [
    stmt(`INSERT INTO pos_sales (receipt_number,subtotal_cents,tax_cents,discount_cents,total_cents,currency,payment_method,paid,
      customer_name,customer_phone,due_date,payment_status,amount_paid_cents,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [receipt, subtotalCents, taxCents, discountCents, totalCents, settings.currency, method, isPaid ? 1 : 0, customer || null, phone || null,
      date || null, isPaid ? 'confirmed' : 'pending', isPaid ? totalCents : 0, createdAt])
  ];
  const itemStatements = items.map((item) => {
    const product = productData.get(Number(item.productId));
    return stmt(`INSERT INTO pos_sale_items
      (sale_id,product_id,name,quantity,unit_price_cents,unit_cost_cents,unit_cost_captured)
      SELECT id,?,?,?,?,?,1 FROM pos_sales WHERE receipt_number=?`,
    [item.productId, item.name, item.quantity, toCents(item.unitPrice),
      product.buying_price_cents == null ? null : Number(product.buying_price_cents), receipt]);
  });
  const paymentStatement = isPaid && totalCents > 0
    ? [stmt(`INSERT INTO pos_sale_payments (sale_id,method,amount_cents,created_at)
      SELECT id,?,?,? FROM pos_sales WHERE receipt_number=?`, [method, totalCents, createdAt, receipt])]
    : [];
  const stockStatements = [...quantityMap].map(([productId, quantity]) =>
    stmt('UPDATE pos_products SET stock_count=MAX(0,stock_count-?) WHERE id=? AND stock_count IS NOT NULL', [quantity, productId]));
  const connection = (await rows("SELECT value FROM pos_settings WHERE key='shared_tenant_id'"))[0]?.value;
  const sharedItems = new Map();
  if (connection) {
    for (const [productId, quantity] of quantityMap) {
      const sku = String(productData.get(productId)?.sku || '').trim();
      if (sku) sharedItems.set(sku, (sharedItems.get(sku) || 0) + quantity);
    }
  }
  const queueStatement = connection && sharedItems.size
    ? [
      stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
        [connection, receipt, createdAt]),
      ...[...sharedItems].map(([sku, quantity]) =>
        stmt('INSERT INTO shared_inventory_event_items (tenant_id,event_id,sku,quantity) VALUES (?,?,?,?)',
          [connection, receipt, sku, quantity])),
      stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
        VALUES (?,?,?,'sale','pending',?)`,
      [receipt, connection, JSON.stringify([...sharedItems].map(([sku, quantity]) => ({ sku, quantity }))), createdAt])
    ]
    : [];
  await transaction([...statements, ...itemStatements, ...paymentStatement, ...stockStatements, ...queueStatement]);
  if (connection && sharedItems.size) {
    const updated = await Promise.all([...sharedItems.keys()].map(async (sku) => ({
      sku,
      stock: Number((await rows('SELECT stock FROM shared_inventory WHERE tenant_id=? AND sku=?', [connection, sku]))[0]?.stock)
    })));
    await window.EshopInventoryBridge?.updateLocalStock?.(connection, updated);
  }
  const saved = (await rows('SELECT id FROM pos_sales WHERE receipt_number=?', [receipt]))[0];
  if (!saved) throw new Error('The sale transaction completed but its receipt could not be read.');
  return { id: saved.id, receiptNumber: receipt, total: fromCents(totalCents), currency: settings.currency };
}

async function recordSharedLocalSale(tenantId, eventId, items, updateMirrors = true) {
  const id = String(eventId || '').trim();
  if (!tenantId || !/^[a-zA-Z0-9_-]{1,120}$/.test(id) || !Array.isArray(items) || !items.length) {
    throw new Error('The shared stock sale is invalid.');
  }
  const normalized = new Map();
  for (const item of items) {
    const sku = String(item?.sku || '').trim();
    const quantity = Number(item?.quantity);
    if (!sku || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999) {
      throw new Error('Each shared stock item needs a SKU and a positive whole-number quantity.');
    }
    normalized.set(sku, (normalized.get(sku) || 0) + quantity);
  }
  const existing = (await rows('SELECT event_id FROM shared_inventory_events WHERE tenant_id=? AND event_id=?',
    [tenantId, id]))[0];
  if (existing) return { duplicate: true };
  const createdAt = nowIso();
  await transaction([
    stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
      [tenantId, id, createdAt]),
    ...[...normalized].map(([sku, quantity]) =>
      stmt('INSERT INTO shared_inventory_event_items (tenant_id,event_id,sku,quantity) VALUES (?,?,?,?)',
        [tenantId, id, sku, quantity])),
    stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
      VALUES (?,?,?,'sale','pending',?)`,
    [id, tenantId, JSON.stringify([...normalized].map(([sku, quantity]) => ({ sku, quantity }))), createdAt])
  ]);
  if (updateMirrors) {
    await window.EshopInventoryBridge?.updateLocalStock?.(tenantId, await Promise.all([...normalized.keys()].map(async (sku) => ({
      sku,
      stock: Number((await rows('SELECT stock FROM shared_inventory WHERE tenant_id=? AND sku=?', [tenantId, sku]))[0]?.stock)
    }))));
  }
  return { duplicate: false };
}

async function listSales() {
  const sales = await rows('SELECT * FROM pos_sales ORDER BY created_at DESC, id DESC');
  for (const sale of sales) {
    sale.subtotal = fromCents(sale.subtotal_cents);
    sale.tax = fromCents(sale.tax_cents);
    sale.discount = fromCents(sale.discount_cents);
    sale.total = fromCents(sale.total_cents);
    sale.amountPaid = fromCents(sale.amount_paid_cents);
    sale.items = (await rows('SELECT product_id AS productId,name,quantity,unit_price_cents,unit_cost_cents FROM pos_sale_items WHERE sale_id=? ORDER BY id', [sale.id]))
      .map((item) => ({ productId: item.productId || 0, name: item.name, quantity: item.quantity,
        unitPrice: fromCents(item.unit_price_cents), historicalUnitCost: item.unit_cost_cents == null ? null : fromCents(item.unit_cost_cents) }));
  }
  return sales;
}

async function listExpenses() {
  const items = await rows('SELECT * FROM pos_expenses ORDER BY expense_date DESC,id DESC');
  return items.map((item) => ({
    ...item,
    amount: fromCents(item.amount_cents),
    createdAt: item.created_at,
    date: item.expense_date
  }));
}

  function embeddingHexToInt8(hex) {
    const value = String(hex || '');
    if (!value || value.length % 2 || !/^[\da-f]+$/i.test(value)) return new Int8Array(0);
    const embedding = new Int8Array(value.length / 2);
    for (let index = 0; index < embedding.length; index += 1) {
      const unsigned = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
      embedding[index] = unsigned > 127 ? unsigned - 256 : unsigned;
    }
    return embedding;
  }

function businessRecordStatements(entity, recordId, payload, deleted = false, serverRevision = 0, tenantId = 'local') {
  if (!['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'].includes(entity)
    || !/^[A-Za-z0-9_-]{1,120}$/.test(String(recordId || ''))
    || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('This business record cannot be saved for sync.');
  }
  const changedAt = nowIso();
  const changeId = numberTag('SYNC');
  const payloadJson = JSON.stringify(payload);
  const scope = String(tenantId || 'local');
  return [
    stmt(`INSERT INTO pos_business_records (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
      payload_json=excluded.payload_json,deleted=excluded.deleted,
      server_revision=MAX(pos_business_records.server_revision,excluded.server_revision),updated_at=excluded.updated_at`,
    [scope, entity, String(recordId), payloadJson, deleted ? 1 : 0, serverRevision, changedAt]),
    stmt(`INSERT INTO pos_cloud_outbox (change_id,tenant_id,entity,record_id,payload_json,deleted,created_at)
      VALUES (?,?,?,?,?,?,?)`,
    [changeId, scope, entity, String(recordId), payloadJson, deleted ? 1 : 0, changedAt])
  ];
}

async function saveBusinessRecord(entity, recordId, payload, deleted = false, serverRevision = 0, tenantId = 'local') {
  await transaction(businessRecordStatements(entity, recordId, payload, deleted, serverRevision, tenantId));
}

async function listBusinessRecords(entity, tenantId = 'local') {
  const records = await rows(`SELECT record_id,payload_json,server_revision FROM pos_business_records
    WHERE tenant_id=? AND entity=? AND deleted=0 ORDER BY updated_at DESC`, [tenantId, entity]);
  return records.map((record) => {
    let payload;
    try {
      payload = JSON.parse(record.payload_json);
    } catch {
      throw new Error(`Saved ${entity} record ${record.record_id} has invalid data.`);
    }
    return { ...payload, id: record.record_id, serverRevision: Number(record.server_revision) || 0 };
  });
}

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
  const invoiceNumber = id
    ? (await rows('SELECT invoice_number FROM pos_invoices WHERE id=?', [id]))[0]?.invoice_number
    : numberTag('INV');
  if (!invoiceNumber) throw new Error('This invoice could not be found.');
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

function parseInstance(row) {
  let intervals = [];
  let checkpoints = [];
  try {
    const parsed = JSON.parse(row.intervals_json);
    if (Array.isArray(parsed)) intervals = parsed.filter((item) => item && typeof item.startedAt === 'string'
      && (item.endedAt === null || typeof item.endedAt === 'string'));
  } catch (error) { console.warn('Could not read instance intervals', error); }
  try {
    const parsed = JSON.parse(row.checkpoints_json);
    if (Array.isArray(parsed)) checkpoints = parsed.filter((item) => typeof item === 'string');
  } catch (error) { console.warn('Could not read instance checkpoints', error); }
  return { id: row.id, name: row.name, mode: row.mode, status: row.status, startedAt: row.started_at,
    scheduledEndAt: row.scheduled_end_at, endedAt: row.ended_at, intervals, checkpoints };
}

async function listInstances() {
  const now = nowIso();
  await transaction([
    stmt("UPDATE pos_instances SET status='active' WHERE status='scheduled' AND started_at<=?", [now])
  ]);
  const expired = await rows(`SELECT id,intervals_json,scheduled_end_at FROM pos_instances
    WHERE mode='set-time' AND status='active' AND scheduled_end_at IS NOT NULL AND scheduled_end_at<=?`, [now]);
  if (expired.length) {
    const statements = expired.map((instance) => {
      const intervalRows = JSON.parse(instance.intervals_json || '[]');
      const last = intervalRows[intervalRows.length - 1];
      if (last && !last.endedAt) last.endedAt = instance.scheduled_end_at;
      return stmt("UPDATE pos_instances SET status='completed',ended_at=?,intervals_json=? WHERE id=?",
        [instance.scheduled_end_at, JSON.stringify(intervalRows), instance.id]);
    });
    await transaction(statements);
  }
  return (await rows('SELECT * FROM pos_instances ORDER BY started_at DESC')).map(parseInstance);
}

async function startInstance(data) {
  const mode = INSTANCE_MODES.map(([value]) => value).includes(data.mode) ? data.mode : null;
  if (!mode) throw new Error('Choose a valid instance type.');
  let startedAt = nowIso();
  let scheduledEndAt = null;
  if (mode === 'set-time') {
    const start = data.startAt ? Date.parse(data.startAt) : Date.now();
    const end = data.endAt ? Date.parse(data.endAt) : start + Number(data.durationMinutes) * 60_000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > Date.now() + 24 * 60 * 60_000 || end <= start
      || end - start > 24 * 60 * 60_000) throw new Error('Choose a valid start and end time within a 24-hour period.');
    startedAt = new Date(start).toISOString();
    scheduledEndAt = new Date(end).toISOString();
  }
  const name = String(data.name || '').trim() || `Instance ${(await rows('SELECT COUNT(*) AS count FROM pos_instances'))[0].count + 1}`;
  const id = `instance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const status = Date.parse(startedAt) > Date.now() ? 'scheduled' : 'active';
  await transaction([
    stmt(`INSERT INTO pos_instances (id,name,mode,status,started_at,scheduled_end_at,intervals_json,checkpoints_json)
      SELECT ?,?,?,?,?,?,?, '[]' WHERE NOT EXISTS (
        SELECT 1 FROM pos_instances WHERE status IN ('scheduled','active','paused'))`,
    [id, name, mode, status, startedAt, scheduledEndAt, JSON.stringify([{ startedAt, endedAt: null }])])
  ]);
  if (!(await rows('SELECT id FROM pos_instances WHERE id=?', [id])).length) {
    throw new Error('Finish or pause the current instance before starting another.');
  }
}

async function updateInstance(id, action) {
  const row = (await rows('SELECT * FROM pos_instances WHERE id=?', [id]))[0];
  if (!row) throw new Error('This instance could not be found.');
  const instance = parseInstance(row);
  const now = nowIso();
  let { status, intervals, checkpoints, endedAt } = instance;
  if (action === 'checkpoint') {
    if (status !== 'active') throw new Error('Only an active instance can be checkpointed.');
    checkpoints = [...checkpoints, now];
  } else if (action === 'pause') {
    if (status !== 'active') throw new Error('Only an active instance can be paused.');
    intervals = intervals.map((item, index) => index === intervals.length - 1 && !item.endedAt ? { ...item, endedAt: now } : item);
    status = 'paused';
  } else if (action === 'resume') {
    if (status !== 'paused') throw new Error('Only a paused instance can be resumed.');
    status = 'active';
    intervals = [...intervals, { startedAt: now, endedAt: null }];
  } else if (action === 'stop') {
    if (status === 'completed') throw new Error('This instance is already complete.');
    intervals = intervals.map((item, index) => index === intervals.length - 1 && !item.endedAt ? { ...item, endedAt: now } : item);
    status = 'completed';
    endedAt = now;
  } else throw new Error('Unsupported instance action.');
  await run('UPDATE pos_instances SET status=?,ended_at=?,intervals_json=?,checkpoints_json=? WHERE id=?',
    [status, endedAt, JSON.stringify(intervals), JSON.stringify(checkpoints), id]);
}

function inInstance(instance, timestamp) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return false;
  return instance.intervals.some((interval) => {
    const start = Date.parse(interval.startedAt);
    const end = interval.endedAt ? Date.parse(interval.endedAt) : Date.now();
    return Number.isFinite(start) && time >= start && time <= end;
  });
}

async function instanceTotals(instance, currency) {
  const sales = await listSales();
  const expenses = await rows('SELECT currency,amount_cents,created_at FROM pos_expenses');
  const payments = await rows(`SELECT p.amount_cents,p.method,p.created_at,s.currency FROM pos_sale_payments p
    JOIN pos_sales s ON s.id=p.sale_id WHERE p.status='confirmed'`);
  const selected = currency.toUpperCase();
  const methods = {};
  const daily = {};
  let revenue = 0;
  let count = 0;
  for (const payment of payments) {
    if (payment.currency.toUpperCase() !== selected || !inInstance(instance, payment.created_at)) continue;
    const amount = fromCents(payment.amount_cents);
    revenue += amount;
    count++;
    const method = payment.method === 'Mobile money' ? 'M-Pesa' : payment.method || 'Other';
    methods[method] = (methods[method] || 0) + amount;
    const date = new Date(payment.created_at);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    daily[day] = (daily[day] || 0) + amount;
  }
  let expensesTotal = 0;
  expenses.forEach((expense) => {
    if (expense.currency.toUpperCase() === selected && inInstance(instance, expense.created_at)) expensesTotal += fromCents(expense.amount_cents);
  });
  return { revenue, expenses: expensesTotal, count, methods,
    daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => ({ day, amount })) };
}

export function createPosApp() {
  const state = { cart: [], invoiceItems: [], invoiceDraftId: null, search: '', category: '', expandedSale: 0, paymentMethod: '',
    sharedTenantId: '', pendingInventoryEvents: 0, inventorySyncError: '', discount: 0, activeTicketId: '',
    suppliers: [], purchases: [], tickets: [], cloudSales: [], cloudSyncError: '', cloudScopeId: 'local',
    nearbySyncStatus: '' };
  let initialized = false;
  let cloudSyncInProgress = false;
  let cloudSyncTimer = 0;
  let barcodeScanner = null;
  let nearbyPeer = null;
  let nearbyChannel = null;
  let nearbyOverlay = null;
  let nearbyIncoming = null;
  let nearbyRelaySession = null;
  let nearbyRole = '';
  let nearbyReady = false;
  let nearbyRemoteName = '';
  let nearbyLastSyncAt = '';
  let nearbyPendingChanges = new Map();
  let nearbyTransport = '';
  let nearbyBluetoothListeners = [];

  const routeLink = (path, label, selected) =>
    `<a href="${path}" data-route="${path}" class="pos-tab ${selected ? 'is-active' : ''}">${label}</a>`;
  const primarySection = (path) => path.startsWith('/pos/catalogue') || path === '/pos/inventory' ? 'catalogue'
    : path.startsWith('/pos/orders') || path === '/pos/invoices' ? 'orders'
      : path === '/pos' ? 'sell' : path.startsWith('/pos/overview') ? 'overview' : 'more';
  const subnav = (items, current) => `<nav class="pos-tabs pos-subnav" aria-label="Section navigation">
    ${items.map(([route, label]) => routeLink(route, label, current === route)).join('')}
  </nav>`;
  const screenTitle = (path) => {
    if (path === '/pos') return 'Sell';
    if (path === '/pos/overview') return 'Overview';
    if (path.startsWith('/pos/catalogue') || path === '/pos/inventory') {
      return path.endsWith('/products') ? 'Products'
        : path.endsWith('/categories') ? 'Categories'
          : path.endsWith('/suppliers') ? 'Suppliers' : 'Inventory';
    }
    if (path.startsWith('/pos/orders') || path === '/pos/invoices') {
      return path.endsWith('/invoices') ? 'Invoices'
        : path.endsWith('/quotations') ? 'Quotations' : 'Orders';
    }
    if (path === '/pos/sales') return 'Sales & receipts';
    if (path === '/pos/customers') return 'Customers';
    if (path.endsWith('/instances')) return 'Instances';
    if (path.endsWith('/settings')) return 'Settings';
    if (path === '/pos/more') return 'More';
    return '';
  };
  const commonHeader = (path) => {
    const hasSectionNav = Boolean(renderSectionNav(path));
    const title = screenTitle(path);
    return `
    <main class="container pos-main ${hasSectionNav ? 'pos-main-with-tabs' : ''}">
      <header class="pos-header">
        <a href="/" data-route="/" data-home-screen class="pos-brand ${path === '/pos/overview' ? 'pos-brand-overview' : ''}" aria-label="E-Shop home">
          <img src="/eshop-logo.png" alt="">
          ${title ? `<span>${escapeHtml(title)}</span>` : ''}
        </a>
      </header>
      <div class="pos-header-divider" aria-hidden="true"></div>
      <nav class="pos-bottom-nav" aria-label="Point of sale">
        ${routeLink('/pos', 'Sell', primarySection(path) === 'sell')}
        ${routeLink('/pos/overview', 'Overview', primarySection(path) === 'overview')}
        ${routeLink('/pos/catalogue/inventory', 'Catalogue', primarySection(path) === 'catalogue')}
        ${routeLink('/pos/orders', 'Orders', primarySection(path) === 'orders')}
        ${routeLink('/pos/more', 'More', primarySection(path) === 'more')}
      </nav>`;
  };

  const pageEnd = `</main>`;
  const card = (content, extra = '') => `<section class="pos-card ${extra}">${content}</section>`;
  const field = (label, name, value = '', options = {}) => `
    <label class="pos-field">
      <span>${label}</span>
      <input name="${name}" value="${escapeHtml(value)}" ${options.type ? `type="${options.type}"` : 'type="text"'}
        ${options.required ? 'required' : ''} ${options.min !== undefined ? `min="${options.min}"` : ''}
        ${options.step ? `step="${options.step}"` : ''} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''}
        ${options.readonly ? 'readonly' : ''}>
    </label>`;
  const select = (label, name, choices, selected) => `
    <label class="pos-field"><span>${label}</span><select name="${name}">
      ${choices.map(([value, title]) => `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(title)}</option>`).join('')}
    </select></label>`;
  const button = (label, action, attrs = '', secondary = false) =>
    `<button type="button" class="btn-${secondary ? 'secondary' : 'primary'}" data-pos-action="${action}" ${attrs}>${label}</button>`;
  const statusTag = (text, tone = '') => `<span class="pos-status ${tone}">${escapeHtml(text)}</span>`;
  const empty = (title, detail) => `<div class="pos-empty"><strong>${escapeHtml(title)}</strong> <span>${escapeHtml(detail)}</span></div>`;
  const tabsTitle = (title, detail, action = '') =>
    `<div class="pos-section-heading"><div><h2>${title}</h2><p>${detail}</p></div>${action}</div>`;
  const currentCartTotals = async () => {
    const settings = await getSettings();
    const subtotal = state.cart.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    const tax = Math.round(subtotal * settings.taxRate / 100);
    return { settings, subtotal, tax, total: subtotal + tax };
  };

  function render(path = '/pos', params = new URLSearchParams()) {
    const route = path.startsWith('/pos/') ? path : '/pos';
    const screen = route.slice('/pos'.length) || '/';
    return `${commonHeader(route)}${renderSectionNav(route)}${screen === '/' ? renderStore() :
      screen === '/inventory' || screen.startsWith('/catalogue') ? renderInventory(params, screen) :
      screen === '/sales' ? renderSales(params) :
      screen === '/customers' ? renderCustomers() :
      screen === '/invoices' || screen === '/orders/invoices' ? renderInvoices(params) :
      screen === '/orders' ? renderOrders() :
      screen === '/orders/quotations' ? renderQuotations() :
      screen === '/instances' || screen === '/more/instances' ? renderInstances(params) :
      screen === '/settings' || screen === '/more/settings' ? renderSettings(params) :
      screen === '/more' ? renderMore() :
      screen === '/overview' ? renderOverview(params) : empty('POS page not found', 'Choose a section above.')}${pageEnd}`;
  }

  function renderSectionNav(path) {
    if (path.startsWith('/pos/catalogue') || path === '/pos/inventory') {
      const current = path === '/pos/inventory' ? '/pos/catalogue/inventory' : path;
      return subnav([
        ['/pos/catalogue/inventory', 'Inventory'],
        ['/pos/catalogue/products', 'Products'],
        ['/pos/catalogue/categories', 'Categories'],
        ['/pos/catalogue/suppliers', 'Suppliers']
      ], current);
    }
    if (path.startsWith('/pos/orders') || path === '/pos/invoices') {
      const current = path === '/pos/invoices' ? '/pos/orders/invoices' : path;
      return subnav([
        ['/pos/orders', 'Orders'],
        ['/pos/orders/invoices', 'Invoices'],
        ['/pos/orders/quotations', 'Quotations']
      ], current);
    }
    if (path.startsWith('/pos/more') || path === '/pos/sales' || path === '/pos/customers') {
      return subnav([
        ['/pos/more', 'More'],
        ['/pos/sales', 'Sales & receipts'],
        ['/pos/customers', 'Customers'],
        ['/pos/more/instances', 'Instances'],
        ['/pos/more/settings', 'Settings']
      ], path);
    }
    return '';
  }

  function renderStore() {
    return `<section class="pos-content">
      <form class="pos-filter-row" data-pos-form="store-filter">
        <input name="search" value="${escapeHtml(state.search)}" placeholder="Search products" aria-label="Search products">
        <select name="category"><option value="">All</option>${state.categories.map((item) =>
          `<option value="${item.id}" ${String(item.id) === state.category ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>
      </form>
      <div class="pos-form-actions pos-scanner-entry">
        ${button('Scan with camera', 'scan-sale-barcode', '', true)}
      </div>
      <div class="pos-store-layout">
        <section class="pos-card pos-cart">
          ${state.cart.length ? `<div class="pos-cart-items">${state.cart.map((item) => `
            <div class="pos-cart-item">
              <strong>${escapeHtml(item.name)}</strong>
              <button type="button" class="pos-quantity-button" data-pos-action="cart-minus" data-id="${item.productId}" aria-label="Decrease">−</button>
              <input type="number" min="1" max="99999" value="${item.quantity}" aria-label="Quantity" data-pos-quantity="${item.productId}">
              <button type="button" class="pos-quantity-button" data-pos-action="cart-plus" data-id="${item.productId}" aria-label="Increase">+</button>
            </div>`).join('')}</div>` : empty('Your sale is empty', 'Tap a product to add it here.')}
          ${renderCartFooter()}
        </section>
        <section id="pos-product-grid" class="pos-product-grid" aria-label="Products">${renderProductTiles()}</section>
      </div>
    </section>`;
  }

  function renderProductTiles() {
    return state.products.filter((product) => product.active && (!state.category || String(product.categoryId) === state.category)
      && product.name.toLocaleLowerCase().includes(state.search.toLocaleLowerCase())).map((product) => `
        <button class="pos-product-tile" type="button" data-pos-action="add-cart" data-id="${product.id}">
          ${product.imageUri ? `<img src="${escapeHtml(product.imageUri)}" alt="">` : '<span class="pos-product-placeholder">+</span>'}
          <strong>${escapeHtml(product.name)}</strong>
          <span>${money(product.price, state.settings.currency)}</span>
          <small>${product.stock === null ? 'Stock not tracked' : `${product.stock} in stock`}</small>
        </button>`).join('') || empty(state.search ? 'No matching products' : 'No products yet', 'Add items in Inventory to start selling.');
  }

  function renderCartFooter() {
    if (!state.cart.length) return '';
    const subtotal = state.cart.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    const discountCents = Math.min(subtotal, Math.max(0, toCents(state.discount || 0)));
    const tax = Math.round((subtotal - discountCents) * state.settings.taxRate / 100);
    return `<form class="pos-form pos-checkout" data-pos-form="checkout">
      <input type="hidden" name="paymentMethod" value="${escapeHtml(state.paymentMethod)}">
      <div class="pos-payment-options" role="group" aria-label="Payment method">
        <button class="pos-payment-option ${state.paymentMethod === 'Cash' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Cash" aria-pressed="${state.paymentMethod === 'Cash'}"><span>Cash</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Mobile money' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Mobile money" aria-pressed="${state.paymentMethod === 'Mobile money'}">
          <span class="pos-payment-logo pos-payment-mpesa" aria-hidden="true">M</span><span>M-Pesa</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Bank' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Bank" aria-pressed="${state.paymentMethod === 'Bank'}"><span>Bank</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Card' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Card" aria-pressed="${state.paymentMethod === 'Card'}">
          <svg class="pos-payment-logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg><span>Card</span>
        </button>
        <button class="pos-payment-option ${state.paymentMethod === 'Other' ? 'is-selected' : ''}" type="button"
          data-pos-action="checkout-method" data-method="Other" aria-pressed="${state.paymentMethod === 'Other'}">
          <svg class="pos-payment-logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg><span>Other</span>
        </button>
      </div>
      <div class="pos-customer-fields">
        ${field('Name', 'customerName', '', { placeholder: 'Optional' })}
        ${field('Phone', 'customerPhone', '', { placeholder: 'Optional', type: 'tel' })}
      </div>
      <div class="pos-checkout-totals">
        <div class="pos-total-line"><span>Subtotal</span><b>${money(fromCents(subtotal), state.settings.currency)}</b></div>
        <label class="pos-field"><span>Discount</span><input name="discount" type="number" min="0" max="${fromCents(subtotal).toFixed(2)}" step="0.01" value="${state.discount || ''}" data-pos-discount></label>
        ${discountCents ? `<div class="pos-total-line"><span>Discount applied</span><b>−${money(fromCents(discountCents), state.settings.currency)}</b></div>` : ''}
        <div class="pos-total-line"><span>Tax · ${state.settings.taxRate}%</span><b>${money(fromCents(tax), state.settings.currency)}</b></div>
        <div class="pos-total-line is-total"><span>Total</span><b>${money(fromCents(subtotal - discountCents + tax), state.settings.currency)}</b></div>
      </div>
      <details class="pos-credit-details"><summary>Credit sale</summary>${field('Due date · optional', 'dueDate', '', { type: 'date' })}</details>
      <div class="pos-checkout-actions">
        <button class="btn-secondary" type="button" data-pos-action="park-ticket">Park order</button>
        <button class="btn-secondary" type="button" data-pos-action="cancel-sale">Cancel sale</button>
        <button class="btn-primary" type="submit">Complete sale</button>
      </div>
    </form>`;
  }

  function renderInventory(params, screen = '/inventory') {
    const edit = Number(params.get('edit') || 0);
    const product = state.products.find((item) => item.id === edit);
    const categories = state.categories;
    const websites = typeof window.EshopInventoryBridge?.websites === 'function'
      ? window.EshopInventoryBridge.websites() : [];
    const inventoryCloudLinked = state.sharedTenantId &&
      window.EshopInventoryBridge?.hasTenantOwnerKey?.(state.sharedTenantId) !== false;
    const websiteChoices = websites.map((website) => [website.tenant_id, website.name || website.tenant_id]);
    const selectedWebsite = state.sharedTenantId || websiteChoices[0]?.[0] || '';
    const requestedBarcode = params.get('barcode') || '';
    const productForm = (item = null) => `<form class="pos-form pos-editor-form" data-pos-form="product" novalidate>
      <input type="hidden" name="id" value="${item?.id || 0}">
      ${field('Product name', 'name', item?.name || '', { required: true, placeholder: 'Name' })}
      <input type="hidden" name="sku" value="${escapeHtml(item?.sku || '')}">
      <div class="pos-form-actions">
        <button type="button" class="btn-secondary" data-pos-action="scan-barcode">Scan barcode (optional)</button>
        <button type="button" class="btn-secondary" data-pos-action="scan-product-label">Scan product label</button>
      </div>
      <p class="pos-help">Scan a barcode or enter it below. A separate SKU is assigned automatically when needed.</p>
      ${field('Barcode · optional', 'barcode', item?.barcode || requestedBarcode, { placeholder: 'EAN, UPC or Code 128' })}
      <p class="pos-help" data-product-barcode-status role="status" aria-live="polite">${requestedBarcode
        ? `Barcode ${escapeHtml(requestedBarcode)} captured successfully. Complete the product details and save.`
        : item?.barcode ? `Saved barcode: ${escapeHtml(item.barcode)}`
          : 'No barcode captured yet.'}</p>
      <p class="pos-help" data-product-ocr-status role="status" aria-live="polite">OCR suggestions are optional; check them before saving.</p>
      ${select('Category', 'categoryId', categories.map((cat) => [cat.id, cat.name]), item?.categoryId || categories[0]?.id)}
      ${field('Selling price', 'price', item?.price ?? '', { type: 'number', min: '0', step: '0.01', required: true })}
      ${field('Expiry date · optional', 'expiryDate', item?.expiryDate || '', { type: 'date' })}
      ${field('Unit cost · optional', 'buyingPrice', item?.buyingPrice ?? '', { type: 'number', min: '0', step: '0.01' })}
      ${field('Stock · blank means untracked', 'stock', item?.stock ?? '', { type: 'number', min: '0', step: '1' })}
      ${field('Image URL · optional', 'imageUri', /^https?:\/\//i.test(item?.imageUri || '') ? item.imageUri : '', { placeholder: 'https://…' })}
      <input type="hidden" name="capturedProductImage" value="${/^data:image\//i.test(item?.imageUri || '') ? escapeHtml(item.imageUri) : ''}">
      <div class="pos-form-actions"><button type="button" class="btn-secondary" data-pos-action="take-product-photo">Take product photo</button></div>
      <label class="pos-field"><span>Upload image · max 1 MB</span><input name="imageFile" type="file" accept="image/*"></label>
      <img class="pos-product-image-preview" data-product-image-preview src="${escapeHtml(item?.imageUri || '')}" alt="Product photo preview" ${item?.imageUri ? '' : 'hidden'}>
      <p class="pos-help" data-product-image-capture-status role="status" aria-live="polite">Take a product photo or upload one to enable image suggestions and matching.</p>
      <div class="pos-form-actions"><button type="button" class="btn-secondary" data-pos-action="suggest-image-category">Suggest category from photo</button></div>
      <p class="pos-help" data-product-image-status role="status" aria-live="polite">Category suggestions use on-device image labels and never save automatically.</p>
      <div class="pos-image-category-suggestions" data-image-category-suggestions hidden></div>
      ${field('Reorder alert at', 'lowStockThreshold', item?.lowStockThreshold ?? 3, { type: 'number', min: '0', step: '1' })}
      ${select('POS status', 'active', [[1, 'Active'], [0, 'Disabled']], item?.active === false ? 0 : 1)}
      <div class="pos-form-actions"><button class="btn-primary" type="submit">${item ? 'Save product' : 'Add product'}</button>
        ${item ? `<a href="/pos/inventory" data-route="/pos/inventory" class="btn-secondary">Cancel</a>` : ''}</div>
      <p class="pos-help" data-product-submit-status role="status" aria-live="polite">Selling price is required. Photo matching is prepared after the product is saved.</p>
    </form>`;
    if (screen === '/catalogue/products') {
      return `<section class="pos-content">
        ${tabsTitle('Products', `${state.products.length} products`, `<a href="/pos/catalogue/products?new=1" data-route="/pos/catalogue/products?new=1" class="btn-primary">Add product</a>`)}
        ${params.get('edit') || params.get('new') === '1' ? card(`<h3>${product ? 'Edit product' : 'Add product'}</h3>${productForm(product)}`) : ''}
        ${card(`<div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>
          ${state.products.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.categoryName)}</td><td>${money(item.price, state.settings.currency)}</td><td>${item.stock === null ? '—' : item.stock}</td><td><a href="/pos/catalogue/products?edit=${item.id}" data-route="/pos/catalogue/products?edit=${item.id}" class="btn-secondary">Edit</a></td></tr>`).join('') || '<tr><td colspan="5">No products yet.</td></tr>'}
        </tbody></table></div>`)}</section>`;
    }
    if (screen === '/catalogue/categories') {
      return `<section class="pos-content">
        ${tabsTitle('Categories', 'Organize your catalogue.')}
        ${card(`<form class="pos-inline-form" data-pos-form="category"><input name="name" required placeholder="New category name"><button class="btn-primary">Add category</button></form>
          <div class="pos-category-list">${categories.map((cat) => `<div class="pos-category-row"><strong>${escapeHtml(cat.name)}</strong><span>${state.products.filter((p) => p.categoryId === cat.id).length} products</span>
            ${cat.name.toLowerCase() === 'other' ? '<small>Default category</small>' : button('Rename', 'rename-category', `data-id="${cat.id}"`, true)}
            ${cat.name.toLowerCase() === 'other' ? '' : button('Delete', 'delete-category', `data-id="${cat.id}"`, true)}
          </div>`).join('') || '<p class="pos-help">No categories yet.</p>'}</div>`)}</section>`;
    }
    if (screen === '/catalogue/suppliers') return renderSuppliers(params);
    if (screen === '/catalogue/inventory') {
      return `<section class="pos-content">
        ${tabsTitle('Inventory', `${state.products.length} products · stock on hand`)}
        ${card(`<h3>POS ↔ website stock</h3>
          ${websites.length ? `<label class="pos-field"><span>Website</span><select id="pos-shared-website">${websiteChoices.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedWebsite ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
            <p class="pos-help">${inventoryCloudLinked ? `Connected · ${escapeHtml(websites.find((item) => item.tenant_id === state.sharedTenantId)?.name || state.sharedTenantId)}. ${state.pendingInventoryEvents} POS sales waiting to sync.` : state.sharedTenantId ? 'Local products and stock remain available. Cloud stock sync is paused until this shop is linked once.' : 'Load website stock to import products into this device’s POS. POS-to-website live stock sync is a separate shop connection.'}</p>
            <div class="pos-form-actions">${button('Use POS stock for website', 'sync-shared-stock', 'data-source="pos"', true)}${button('Load website stock into POS', 'sync-shared-stock', 'data-source="website"', true)}</div>`
            : '<p class="pos-help">Create or select a website in Studio to connect inventory.</p>'}`)}
        ${card(`<div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>On hand</th><th>Reorder at</th><th>Status</th></tr></thead><tbody>
          ${state.products.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.sku || '—')}</td><td>${escapeHtml(item.categoryName)}</td><td>${item.stock === null ? 'Not tracked' : item.stock}</td><td>${item.lowStockThreshold}</td><td>${item.active ? 'Active' : 'Disabled'}</td></tr>`).join('') || '<tr><td colspan="6">No products yet.</td></tr>'}
        </tbody></table></div>`)}</section>`;
    }
    return `<section class="pos-content">
      ${tabsTitle('Inventory', 'Manage POS products, categories and stock.',
        `<div class="pos-form-actions"><button type="button" class="btn-secondary" data-pos-action="backup-export">Export inventory</button>
          <label class="btn-secondary pos-file-button">Import CSV<input type="file" accept="text/csv,.csv" data-pos-csv-import></label>
          <label class="btn-secondary pos-file-button">Restore backup<input type="file" accept="application/json,.json" data-pos-import></label></div>`)}
      ${card(`<h3>POS ↔ website stock</h3>
        ${websites.length ? `<label class="pos-field"><span>Website</span><select id="pos-shared-website">
          ${websiteChoices.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedWebsite ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
        </select></label>
        <p class="pos-help">${inventoryCloudLinked
          ? `Connected · ${escapeHtml(websites.find((item) => item.tenant_id === state.sharedTenantId)?.name || state.sharedTenantId)}. ${state.pendingInventoryEvents} POS sale${state.pendingInventoryEvents === 1 ? '' : 's'} waiting to sync.`
          : state.sharedTenantId
            ? 'Local products and stock remain available. Cloud stock sync is paused until this shop is linked once.'
            : 'Load website stock to import products into this device’s POS. POS-to-website live stock sync is separate and links matching SKUs.'}</p>
        ${state.sharedTenantId && state.pendingInventoryEvents && navigator.onLine === false
          ? '<p class="pos-help" role="status">Offline: shared stock changes are saved locally and queued for D1 sync.</p>'
          : state.inventorySyncError ? `<p class="pos-help" role="status">Latest sync issue: ${escapeHtml(state.inventorySyncError)}</p>` : ''}
        <div class="pos-form-actions">
          ${button('Use POS stock for website', 'sync-shared-stock', 'data-source="pos"', true)}
          ${button('Load website stock into POS', 'sync-shared-stock', 'data-source="website"', true)}
        </div>`
        : '<p class="pos-help">Create or select a website in Studio, then return here to connect its inventory.</p>'}`)}
      ${product ? card(`<h3>Edit product</h3>${productForm(product)}`) : ''}
      ${card(`<h3>Add product</h3>${productForm()}`)}
      ${card(`<h3>Categories</h3>
        <form class="pos-inline-form" data-pos-form="category"><input name="name" required placeholder="New category name"><button class="btn-secondary">Add category</button></form>
        <div class="pos-category-list">${categories.map((cat) => `<div class="pos-category-row">
          <strong>${escapeHtml(cat.name)}</strong><span>${state.products.filter((p) => p.categoryId === cat.id).length} products</span>
          ${cat.name.toLowerCase() === 'other' ? '<small>Default category</small>' : button('Rename', 'rename-category', `data-id="${cat.id}"`, true)}
          ${cat.name.toLowerCase() === 'other' ? '' : button('Delete', 'delete-category', `data-id="${cat.id}"`, true)}
        </div>`).join('')}</div>`)}
      ${card(`${tabsTitle('Products', `${state.products.length} products`)}
        <div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Reorder at</th><th>Status</th><th></th></tr></thead><tbody>
              ${state.products.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.sku || '—')}</td>
            <td>${escapeHtml(item.categoryName)}</td>
            <td>${money(item.price, state.settings.currency)}</td><td>${item.buyingPrice == null ? '—' : money(item.buyingPrice, state.settings.currency)}</td>
            <td>${item.stock === null ? '—' : item.stock}</td><td>${item.lowStockThreshold}</td><td>${item.active ? 'Active' : 'Disabled'}</td><td class="pos-row-actions">
              <a href="/pos/inventory?edit=${item.id}" data-route="/pos/inventory?edit=${item.id}" class="btn-secondary">Edit</a>
              ${item.sku ? button('Sync details to active website draft', 'sync-product-details', `data-id="${item.id}"`, true) : ''}
              ${button('Delete', 'delete-product', `data-id="${item.id}"`, true)}
            </td></tr>`).join('') || '<tr><td colspan="9">No products yet.</td></tr>'}
        </tbody></table></div>`)}
    </section>`;
  }

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
          <span><b>${money(sale.total, sale.currency)}</b>${statusTag(sale.paid ? 'Paid' : sale.payment_status === 'partial' ? 'Part-paid' : 'Unpaid', sale.paid ? 'is-good' : 'is-warning')}</span>
        </button>
        ${openId === sale.id ? `<div class="pos-record-details">
          <div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Item</th><th>Qty</th><th>Each</th><th>Total</th></tr></thead><tbody>
          ${sale.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice, sale.currency)}</td><td>${money(item.quantity * item.unitPrice, sale.currency)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="pos-total-line"><span>Subtotal / discount / tax</span><b>${money(sale.subtotal, sale.currency)} / ${money(sale.discount, sale.currency)} / ${money(sale.tax, sale.currency)}</b></div>
          <div class="pos-total-line is-total"><span>Balance due</span><b>${money(Math.max(0, sale.total - sale.amountPaid), sale.currency)}</b></div>
          <p class="pos-help">Customer: ${escapeHtml(sale.customer_name || 'Not recorded')} · Method: ${escapeHtml(sale.payment_method || 'Not recorded')}</p>
          ${!sale.paid ? `<form class="pos-inline-form" data-pos-form="payment">
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

  function renderSuppliers(params) {
    const editing = state.suppliers.find((item) => item.id === params.get('supplier'));
    const productChoices = [['', 'Select product'], ...state.products.map((product) => [product.sku, product.name])];
    return `<section class="pos-content">
      ${tabsTitle('Suppliers', `${state.suppliers.length} suppliers · purchase orders and stock receiving`)}
      ${card(`<h3>${editing ? 'Edit supplier' : 'Add supplier'}</h3>
        <form class="pos-form" data-pos-form="supplier">
          <input type="hidden" name="id" value="${escapeHtml(editing?.id || '')}">
          ${field('Supplier name', 'name', editing?.name || '', { required: true })}
          ${field('Phone', 'phone', editing?.phone || '', { type: 'tel' })}
          ${field('Email', 'email', editing?.email || '', { type: 'email' })}
          ${field('Supplies / notes', 'supplies', editing?.supplies || '')}
          <div class="pos-form-actions"><button class="btn-primary" type="submit">${editing ? 'Save supplier' : 'Add supplier'}</button>
            ${editing ? '<a href="/pos/catalogue/suppliers" data-route="/pos/catalogue/suppliers" class="btn-secondary">Cancel</a>' : ''}</div>
        </form>`) }
      ${card(`<h3>Purchase order</h3>
        ${state.suppliers.length ? `<form class="pos-form" data-pos-form="purchase">
          ${select('Supplier', 'supplierId', state.suppliers.map((item) => [item.id, item.name]), '')}
          ${field('Reference · optional', 'reference', '')}
          ${[1, 2, 3].map((index) => `<div class="pos-cart-item">
            ${select(`Product ${index}`, `product${index}`, productChoices, '')}
            ${field('Qty', `quantity${index}`, '', { type: 'number', min: '1', step: '1' })}
            ${field('Unit cost', `cost${index}`, '', { type: 'number', min: '0', step: '0.01' })}
          </div>`).join('')}
          <button class="btn-primary" type="submit">Create purchase order</button>
        </form>` : empty('Add a supplier first', 'Purchase orders are linked to supplier records.')}`)}
      ${card(`<h3>Suppliers</h3>${state.suppliers.map((item) => `<div class="pos-category-row">
        <strong>${escapeHtml(item.name)}<small>${escapeHtml(item.supplies || 'No supplies/notes')}</small></strong>
        <span>${escapeHtml(item.phone || item.email || 'No contact details')}</span>
        <a href="/pos/catalogue/suppliers?supplier=${encodeURIComponent(item.id)}" data-route="/pos/catalogue/suppliers?supplier=${encodeURIComponent(item.id)}" class="btn-secondary">Edit</a>
        ${button('Delete', 'delete-supplier', `data-record-id="${escapeHtml(item.id)}"`, true)}
      </div>`).join('') || '<p class="pos-help">No suppliers yet. Add a supplier to start tracking purchases.</p>'}`)}
      ${card(`<h3>Purchase orders</h3>${state.purchases.map((item) => `<div class="pos-category-row">
        <strong>${escapeHtml(item.reference || `PO-${item.id.slice(0, 8)}`)}<small>${escapeHtml(item.supplierName)} · ${item.items.length} line${item.items.length === 1 ? '' : 's'}</small></strong>
        <span>${escapeHtml(item.status)} · ${new Date(item.createdAt).toLocaleDateString()}</span>
        <span>${money(item.items.reduce((sum, line) => sum + line.quantity * line.unitCost, 0), state.settings.currency)}</span>
        ${item.status === 'ordered' ? button('Receive stock', 'receive-purchase', `data-record-id="${escapeHtml(item.id)}"`) : statusTag(item.status, item.status === 'received' ? 'is-good' : '')}
      </div>`).join('') || '<p class="pos-help">Purchase orders will appear here.</p>'}`)}
    </section>`;
  }

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

  function renderInvoices(params) {
    const id = Number(params.get('edit') || 0);
    const invoice = state.invoices.find((item) => item.id === id);
    const draftId = params.get('new') === '1' ? 0 : id;
    if (state.invoiceDraftId !== draftId) {
      state.invoiceDraftId = draftId;
      state.invoiceItems = id && invoice ? invoice.items.map((item) => ({ ...item })) : [];
    }
    const items = state.invoiceItems;
    const subtotal = items.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    const tax = Math.round(subtotal * state.settings.taxRate / 100);
    return `<section class="pos-content">
      ${tabsTitle('Invoices', 'Create, edit, print and share customer invoices.',
        `<a href="/pos/invoices?new=1" data-route="/pos/invoices?new=1" class="btn-primary">New invoice</a>`)}
      ${id || params.get('new') === '1' ? card(`<h3>${id ? 'Edit invoice' : 'New invoice'}</h3>
        <form class="pos-form" data-pos-form="invoice">
          <input type="hidden" name="id" value="${id}">
          ${field('Customer name', 'customerName', invoice?.customer_name || '', { required: true })}
          ${field('Contact · optional', 'customerContact', invoice?.customer_contact || '')}
          ${field('Due date · optional', 'dueDate', invoice?.due_date || '', { type: 'date' })}
          ${field('Notes · optional', 'notes', invoice?.notes || '')}
          <h4>Line items</h4>
          ${items.map((item, index) => `<div class="pos-cart-item"><div><strong>${escapeHtml(item.name)}</strong>
            <small>${item.quantity} × ${money(item.unitPrice, state.settings.currency)}</small></div>
            <input type="number" min="1" max="99999" value="${item.quantity}" data-invoice-qty="${index}" aria-label="Quantity">
            <input type="number" min="0" step="0.01" value="${item.unitPrice}" data-invoice-price="${index}" aria-label="Unit price">
            ${button('Remove', 'invoice-remove', `data-index="${index}"`, true)}</div>`).join('') || empty('No items', 'Add products below.')}
          <div class="pos-total-line"><span>Subtotal</span><b>${money(fromCents(subtotal), state.settings.currency)}</b></div>
          <div class="pos-total-line"><span>Tax · ${state.settings.taxRate}%</span><b>${money(fromCents(tax), state.settings.currency)}</b></div>
          <div class="pos-total-line is-total"><span>Total due</span><b>${money(fromCents(subtotal + tax), state.settings.currency)}</b></div>
          <button class="btn-primary" type="submit">Save invoice</button>
        </form>
        <h4>Add a product</h4><div class="pos-product-picks">${state.products.filter((product) => product.active).map((product) => button(
          `${escapeHtml(product.name)} · ${money(product.price, state.settings.currency)}`, 'invoice-add', `data-id="${product.id}"`, true)).join('')}</div>`) : ''}
      ${state.invoices.map((item) => `<article class="pos-card pos-invoice-row">
        <div><strong>${escapeHtml(item.invoice_number)}</strong><small>${escapeHtml(item.customer_name)} · ${new Date(item.created_at).toLocaleDateString()}</small></div>
        <b>${money(item.total, item.currency)}</b>
        <a href="/pos/invoices?edit=${item.id}" data-route="/pos/invoices?edit=${item.id}" class="btn-secondary">Edit</a>
        ${button('Print / PDF', 'print-invoice', `data-id="${item.id}"`, true)}
      </article>`).join('') || empty('No invoices yet', 'Create an invoice from the button above.')}
    </section>`;
  }

  function renderInstances(params) {
    const selected = state.instances.find((item) => item.id === params.get('id'));
    const active = state.instances.find((item) => item.status !== 'completed');
    return `<section class="pos-content">
      ${tabsTitle('Business instances', 'Group store revenue by a shift or timed work period.',
        `<a href="/pos" data-route="/pos" class="btn-secondary" aria-label="Back to checkout">&larr;</a>`)}
      ${active ? renderActiveInstance(active) : renderStartInstance()}
      ${selected ? renderInstanceSummary(selected) : ''}
      ${!selected ? card(`<h3>Saved instances</h3>${state.instances.filter((item) => item.status === 'completed').map((item) =>
        `<div class="pos-category-row"><strong>${escapeHtml(item.name)}</strong><span>${new Date(item.started_at).toLocaleString()}</span>
          ${statusTag(item.mode)}<a class="btn-secondary" href="/pos/instances?id=${encodeURIComponent(item.id)}" data-route="/pos/instances?id=${encodeURIComponent(item.id)}">Review</a></div>`).join('') || '<p class="pos-help">Completed instances will appear here.</p>'}`) : ''}
    </section>`;
  }

  function renderOrders() {
    return `<section class="pos-content">${tabsTitle('Orders', 'Park an unpaid cart and resume it later or on another synced device.',
      `<a href="/pos" data-route="/pos" class="btn-secondary">New sale</a>`)}
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

  function renderQuotations() {
    return `<section class="pos-content">${tabsTitle('Quotations', 'Build a quotation from catalogue or custom items.')}
      ${card(`<form class="pos-form" data-pos-form="quotation">
        ${field('Customer name', 'customerName', '', { required: true })}
        ${field('Contact · optional', 'customerContact', '')}
        <h4>Catalogue products</h4>
        <div class="pos-product-picks">${state.products.map((product) => `<label class="pos-quote-product"><input type="checkbox" name="products" value="${product.id}"><span>${escapeHtml(product.name)} · ${money(product.price, state.settings.currency)}</span></label>`).join('') || '<p class="pos-help">No products in catalogue yet.</p>'}</div>
        <h4>Custom item</h4>${field('Item name', 'customName', '')}${field('Price', 'customPrice', '', { type: 'number', min: '0', step: '0.01' })}
        <button type="submit" class="btn-primary">Create / print quotation</button>
      </form>`)}</section>`;
  }

  function renderMore() {
    return `<section class="pos-content">${tabsTitle('More', 'Business tools and settings.')}
      ${card(`<a class="btn-secondary" href="/pos/more/instances" data-route="/pos/more/instances">Business instances</a>
        <a class="btn-secondary" href="/pos/sales" data-route="/pos/sales">Sales & receipts</a>
        <a class="btn-secondary" href="/pos/more/settings" data-route="/pos/more/settings">Settings</a>`)}</section>`;
  }

  function renderStartInstance() {
    return card(`<h3>Start an instance</h3><form class="pos-form" data-pos-form="instance">
      ${field('Name · optional', 'name', '', { placeholder: `Instance ${state.instances.length + 1}` })}
      ${select('Type', 'mode', INSTANCE_MODES.map(([value, title]) => [value, title]), 'normal')}
      ${field('Duration · minutes (set-time only)', 'durationMinutes', '60', { type: 'number', min: '1', max: '1440' })}
      ${field('Start time · optional', 'startAt', '', { type: 'datetime-local' })}
      ${field('End time · optional', 'endAt', '', { type: 'datetime-local' })}
      <button class="btn-primary" type="submit">Start instance</button>
    </form>`);
  }

  function renderActiveInstance(instance) {
    const end = instance.scheduled_end_at ? new Date(instance.scheduled_end_at).toLocaleString() : '';
    return card(`<div class="pos-section-heading"><div><h3>${escapeHtml(instance.name)}</h3>
      <p>${statusTag(instance.status)} · ${escapeHtml(instance.mode)} · Started ${new Date(instance.started_at).toLocaleString()}</p></div>
      <strong class="pos-clock" data-instance-start="${escapeHtml(instance.started_at)}">${instance.status === 'paused' ? 'Paused' : elapsed(instance.started_at)}</strong></div>
      ${end ? `<p class="pos-help">Scheduled stop: ${end}</p>` : ''}
      <div class="pos-form-actions">
      ${instance.mode === 'counted' && instance.status === 'active' ? button('Checkpoint', 'instance-checkpoint', `data-id="${escapeHtml(instance.id)}"`) : ''}
      ${instance.mode === 'counted' ? button(instance.status === 'paused' ? 'Resume' : 'Pause', instance.status === 'paused' ? 'instance-resume' : 'instance-pause', `data-id="${escapeHtml(instance.id)}"`, true) : ''}
      ${instance.status !== 'scheduled' ? button('Stop & save', 'instance-stop', `data-id="${escapeHtml(instance.id)}"`) : ''}</div>`);
  }

  function renderInstanceSummary(instance) {
    const summary = state.instanceSummaries.get(instance.id) || { revenue: 0, expenses: 0, count: 0, methods: {}, daily: [] };
    return card(`<div class="pos-section-heading"><div><h3>${escapeHtml(instance.name)}</h3>
      <p>${new Date(instance.started_at).toLocaleString()} — ${instance.ended_at ? new Date(instance.ended_at).toLocaleString() : 'In progress'}</p></div>
      <a href="/pos/instances" data-route="/pos/instances" class="btn-secondary">All instances</a></div>
      <div class="pos-metrics">${metric('Revenue', money(summary.revenue, state.settings.currency), `${summary.count} payments`)}
        ${metric('Expenses', money(summary.expenses, state.settings.currency), 'During this period')}
        ${metric('Net', money(summary.revenue - summary.expenses, state.settings.currency), 'Revenue less expenses')}</div>
      <h4>Payments by method</h4>${Object.entries(summary.methods).map(([method, amount]) => `<div class="pos-total-line"><span>${escapeHtml(method)}</span><b>${money(amount, state.settings.currency)}</b></div>`).join('') || '<p class="pos-help">No payments recorded in this instance.</p>'}
      <h4>Checkpoints</h4>${instance.checkpoints.length ? instance.checkpoints.map((date) => `<p class="pos-help">${new Date(date).toLocaleString()}</p>`).join('') : '<p class="pos-help">No checkpoints yet.</p>'}`);
  }

  function metric(label, value, detail) {
    return `<div class="pos-metric"><small>${label}</small><strong>${value}</strong><span>${escapeHtml(detail)}</span></div>`;
  }

  function renderOverview(params = new URLSearchParams()) {
    const { sales, products, expenses, payments, settings } = state;
    const period = ['today', '7d', '30d', '90d', 'all'].includes(params.get('range')) ? params.get('range') : '30d';
    const requestedTab = params.get('tab') === 'Insights' ? 'Reports' : params.get('tab');
    const tab = ['Summary', 'Revenue', 'Profit', 'Products', 'Stock', 'Payments', 'Reports'].includes(requestedTab)
      ? requestedTab : 'Summary';
    const firstDate = new Date();
    firstDate.setHours(0, 0, 0, 0);
    if (period === '7d') firstDate.setDate(firstDate.getDate() - 6);
    if (period === '30d') firstDate.setDate(firstDate.getDate() - 29);
    if (period === '90d') firstDate.setDate(firstDate.getDate() - 89);
    const fromDate = period === 'all' ? '' : `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}-${String(firstDate.getDate()).padStart(2, '0')}`;
    const periodDays = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[period];
    const previousStart = periodDays ? new Date(firstDate) : null;
    if (previousStart) previousStart.setDate(previousStart.getDate() - periodDays);
    const previousStartKey = previousStart
      ? `${previousStart.getFullYear()}-${String(previousStart.getMonth() + 1).padStart(2, '0')}-${String(previousStart.getDate()).padStart(2, '0')}`
      : '';
    const inRange = (date) => !fromDate || localDateKey(date) >= fromDate;
    const selectedSales = sales.filter((sale) => sale.currency === settings.currency && inRange(sale.created_at));
    const paidSales = selectedSales.filter((sale) => sale.paid);
    const selectedExpenses = expenses.filter((expense) => expense.currency === settings.currency && inRange(expense.expense_date));
    const selectedPayments = payments.filter((payment) => payment.currency === settings.currency && inRange(payment.created_at));
    const paymentRevenue = selectedPayments.reduce((sum, payment) => sum + fromCents(payment.amount_cents), 0);
    const revenue = paidSales.reduce((sum, sale) => sum + sale.subtotal, 0);
    const taxCollected = paidSales.reduce((sum, sale) => sum + sale.tax, 0);
    const grossReceipts = paidSales.reduce((sum, sale) => sum + sale.total, 0);
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthStartKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const monthEndDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const monthRevenue = sales.filter((sale) => sale.currency === settings.currency && sale.paid
      && localDateKey(sale.created_at) >= monthStartKey
      && localDateKey(sale.created_at) < `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}-01`)
      .reduce((sum, sale) => sum + sale.subtotal, 0);
    const monthlyGoal = settings.monthlyRevenueGoal == null || settings.monthlyRevenueGoalCurrency !== settings.currency
      ? null : fromCents(settings.monthlyRevenueGoal);
    const staleGoalCurrency = monthlyGoal === null && settings.monthlyRevenueGoal != null
      ? settings.monthlyRevenueGoalCurrency : null;
    const monthProgress = monthlyGoal ? monthRevenue / monthlyGoal * 100 : null;
    const elapsedMonthDays = currentMonth.getDate();
    const requiredDailyRevenue = monthlyGoal ? Math.max(0, monthlyGoal - monthRevenue) / Math.max(1, monthEndDay - elapsedMonthDays) : null;
    const monthRunRate = monthRevenue / Math.max(1, elapsedMonthDays) * monthEndDay;
    const cogs = paidSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) =>
      lineSum + (item.historicalUnitCost == null ? 0 : item.historicalUnitCost * item.quantity), 0), 0);
    const costCoverageUnits = paidSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) =>
      lineSum + (item.historicalUnitCost == null ? 0 : item.quantity), 0), 0);
    const totalSoldUnits = paidSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) => lineSum + item.quantity, 0), 0);
    const costCoverage = totalSoldUnits ? costCoverageUnits / totalSoldUnits * 100 : 0;
    const operatingExpenses = selectedExpenses.reduce((sum, expense) => sum + fromCents(expense.amount_cents), 0);
    const productSales = new Map();
    paidSales.forEach((sale) => sale.items.forEach((item) => {
      const current = productSales.get(item.productId) || { id: item.productId, name: item.name, units: 0, revenue: 0, cost: 0, knownCostUnits: 0 };
      current.units += item.quantity;
      current.revenue += item.quantity * item.unitPrice;
      if (item.historicalUnitCost != null) {
        current.cost += item.historicalUnitCost * item.quantity;
        current.knownCostUnits += item.quantity;
      }
      productSales.set(item.productId, current);
    }));
    const productById = new Map(products.map((product) => [product.id, product]));
    const categories = new Map();
    const basketPairs = new Map();
    paidSales.forEach((sale) => {
      const productIds = [...new Set(sale.items.map((item) => Number(item.productId)).filter(Boolean))].sort((a, b) => a - b);
      for (let index = 0; index < productIds.length; index += 1) {
        for (let next = index + 1; next < productIds.length; next += 1) {
          const first = productIds[index];
          const second = productIds[next];
          const key = `${first}:${second}`;
          const pair = basketPairs.get(key) || { first: productById.get(first)?.name || sale.items.find((item) => item.productId === first)?.name || 'Product', second: productById.get(second)?.name || sale.items.find((item) => item.productId === second)?.name || 'Product', count: 0 };
          pair.count += 1;
          basketPairs.set(key, pair);
        }
      }
      sale.items.forEach((item) => {
        const category = productById.get(Number(item.productId))?.categoryName || 'Uncategorized';
        const current = categories.get(category) || { name: category, units: 0, revenue: 0, cost: 0, knownCostUnits: 0, orders: new Set() };
        current.units += item.quantity;
        current.revenue += item.quantity * item.unitPrice;
        if (item.historicalUnitCost != null) {
          current.cost += item.historicalUnitCost * item.quantity;
          current.knownCostUnits += item.quantity;
        }
        current.orders.add(sale.id);
        categories.set(category, current);
      });
    });
    const categoryRows = [...categories.values()].sort((a, b) => b.revenue - a.revenue);
    const totalCategoryRevenue = categoryRows.reduce((sum, category) => sum + category.revenue, 0);
    const frequentPairs = [...basketPairs.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const previousSales = periodDays ? sales.filter((sale) => sale.paid && sale.currency === settings.currency
      && localDateKey(sale.created_at) >= previousStartKey && localDateKey(sale.created_at) < fromDate) : [];
    const previousCategoryRevenue = new Map();
    previousSales.forEach((sale) => sale.items.forEach((item) => {
      const category = productById.get(Number(item.productId))?.categoryName || 'Uncategorized';
      previousCategoryRevenue.set(category, (previousCategoryRevenue.get(category) || 0) + item.quantity * item.unitPrice);
    }));
    const categoryChanges = categoryRows.map((category) => {
      const previous = previousCategoryRevenue.get(category.name) || 0;
      return { ...category, previous, change: previous ? (category.revenue - previous) / previous * 100 : null,
        share: totalCategoryRevenue ? category.revenue / totalCategoryRevenue * 100 : 0,
        margin: category.revenue && category.knownCostUnits === category.units
          ? (category.revenue - category.cost) / category.revenue * 100 : null };
    });
    const byMethod = {};
    selectedPayments.forEach((payment) => {
      const method = payment.method || 'Not recorded';
      byMethod[method] = (byMethod[method] || 0) + fromCents(payment.amount_cents);
    });
    const lowStock = products.filter((product) => product.active && product.stock !== null
      && product.stock > 0 && product.stock <= product.lowStockThreshold);
    const outOfStock = products.filter((product) => product.active && product.stock === 0);
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const overdueCredit = sales.filter((sale) => !sale.paid && sale.currency === settings.currency
      && sale.due_date && sale.due_date < todayKey);
    const daily = {};
    paidSales.forEach((sale) => {
      const date = new Date(sale.created_at);
      const day = Number.isFinite(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : localDateKey(sale.created_at);
      daily[day] = (daily[day] || 0) + sale.subtotal;
    });
    const previousPayments = periodDays ? payments.filter((payment) => payment.currency === settings.currency
      && localDateKey(payment.created_at) >= previousStartKey
      && localDateKey(payment.created_at) < fromDate) : [];
    const previousExpenses = periodDays ? expenses.filter((expense) => expense.currency === settings.currency
      && expense.expense_date >= previousStartKey && expense.expense_date < fromDate) : [];
    const previousRevenue = previousSales.reduce((sum, sale) => sum + sale.subtotal, 0);
    const previousPaymentRevenue = previousPayments.reduce((sum, payment) => sum + fromCents(payment.amount_cents), 0);
    const previousExpenseTotal = previousExpenses.reduce((sum, expense) => sum + fromCents(expense.amount_cents), 0);
    const previousByMethod = {};
    previousPayments.forEach((payment) => {
      const method = payment.method || 'Not recorded';
      previousByMethod[method] = (previousByMethod[method] || 0) + fromCents(payment.amount_cents);
    });
    const changeLabel = (current, previous) => !periodDays
      ? 'All-time totals'
      : previous > 0 ? `${((current - previous) / previous * 100).toFixed(0)}% vs prior period`
        : current > 0 ? 'New activity in this period' : 'No change';
    const weekdayTotals = Array.from({ length: 7 }, () => 0);
    const weekdayCounts = Array.from({ length: 7 }, () => 0);
    const hourTotals = Array.from({ length: 24 }, () => 0);
    const hourCounts = Array.from({ length: 24 }, () => 0);
    paidSales.forEach((sale) => {
      const date = new Date(sale.created_at);
      if (!Number.isFinite(date.getTime())) return;
      const amount = sale.subtotal;
      weekdayTotals[date.getDay()] += amount;
      hourTotals[date.getHours()] += amount;
      weekdayCounts[date.getDay()] += 1;
      hourCounts[date.getHours()] += 1;
    });
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const busiestWeekday = weekdayTotals.indexOf(Math.max(...weekdayTotals));
    const busiestHour = hourTotals.indexOf(Math.max(...hourTotals));
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 59);
    const recentDateKey = `${recentDate.getFullYear()}-${String(recentDate.getMonth() + 1).padStart(2, '0')}-${String(recentDate.getDate()).padStart(2, '0')}`;
    const recentMonth = new Date();
    recentMonth.setDate(recentMonth.getDate() - 29);
    const recentMonthKey = `${recentMonth.getFullYear()}-${String(recentMonth.getMonth() + 1).padStart(2, '0')}-${String(recentMonth.getDate()).padStart(2, '0')}`;
    const recentProductUnits = new Map();
    sales.filter((sale) => sale.paid && sale.currency === settings.currency && localDateKey(sale.created_at) >= recentMonthKey)
      .forEach((sale) => sale.items.forEach((item) =>
        recentProductUnits.set(item.productId, (recentProductUnits.get(item.productId) || 0) + item.quantity)));
    const recentlySoldProductIds = new Set(sales.filter((sale) => sale.paid && sale.currency === settings.currency
      && localDateKey(sale.created_at) >= recentDateKey).flatMap((sale) => sale.items.map((item) => item.productId)));
    const dormantStock = products.filter((product) => product.stock > 0 && !recentlySoldProductIds.has(product.id));
    const restockSuggestions = lowStock.map((product) => {
      const monthlyUnits = recentProductUnits.get(product.id) || 0;
      const dailyVelocity = monthlyUnits / 30;
      const targetUnits = dailyVelocity ? Math.ceil(dailyVelocity * 14) : 0;
      return { ...product, monthlyUnits, dailyVelocity, daysCover: dailyVelocity ? product.stock / dailyVelocity : null,
        suggestedUnits: Math.max(0, targetUnits - (product.stock || 0)) };
    });
    const stockMetrics = products.map((product) => {
      const monthlyUnits = recentProductUnits.get(product.id) || 0;
      const dailyVelocity = monthlyUnits / 30;
      return { ...product, monthlyUnits, daysCover: product.stock === null || !dailyVelocity ? null : product.stock / dailyVelocity,
        costValue: product.stock === null || product.buyingPrice == null ? null : product.stock * product.buyingPrice,
        retailValue: product.stock === null ? null : product.stock * product.price };
    });
    const inventoryCostValue = products.reduce((sum, product) =>
      sum + (product.stock === null || product.buyingPrice == null ? 0 : product.stock * product.buyingPrice), 0);
    const inventoryRetailValue = products.reduce((sum, product) =>
      sum + (product.stock === null ? 0 : product.stock * product.price), 0);
    const dormantStockValue = dormantStock.reduce((sum, product) =>
      sum + (product.buyingPrice == null ? 0 : product.stock * product.buyingPrice), 0);
    const expensesByCategory = {};
    selectedExpenses.forEach((expense) => {
      expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + fromCents(expense.amount_cents);
    });
    const customersByPhone = new Map();
    sales.filter((sale) => sale.paid && sale.currency === settings.currency && sale.customer_phone && sale.customer_name)
      .forEach((sale) => {
        const phone = String(sale.customer_phone).replace(/\D/g, '');
        if (!phone) return;
        const customer = customersByPhone.get(phone) || { name: sale.customer_name, orders: 0, spend: 0, firstSale: '', lastSale: '' };
        customer.orders += 1;
        customer.spend += sale.subtotal;
        customer.firstSale = !customer.firstSale || sale.created_at < customer.firstSale ? sale.created_at : customer.firstSale;
        customer.lastSale = sale.created_at > customer.lastSale ? sale.created_at : customer.lastSale;
        customersByPhone.set(phone, customer);
      });
    const customers = [...customersByPhone.values()].sort((a, b) => b.spend - a.spend);
    const repeatCustomers = customers.filter((customer) => customer.orders > 1);
    const inactiveCustomers = customers.filter((customer) => localDateKey(customer.lastSale) < recentDateKey);
    const oneTimeCustomers = customers.filter((customer) => customer.orders === 1);
    const loyalCustomers = customers.filter((customer) => customer.orders >= 3);
    const lapsedRepeatCustomers = customers.filter((customer) => customer.orders > 1
      && localDateKey(customer.lastSale) < recentDateKey);
    const customerRevenue = customers.reduce((sum, customer) => sum + customer.spend, 0);
    const customerConcentration = customerRevenue && customers.length
      ? customers.slice(0, Math.max(1, Math.ceil(customers.length * 0.2))).reduce((sum, customer) => sum + customer.spend, 0) / customerRevenue * 100 : 0;
    const customerRepeatRate = customers.length ? repeatCustomers.length / customers.length * 100 : 0;
    const newCustomersInRange = customers.filter((customer) => inRange(customer.firstSale));
    const repeatBuyersInRange = newCustomersInRange.filter((customer) => customer.orders > 1);
    const recentDailyValues = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - offset));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return daily[key] || 0;
    });
    const paceEstimate = recentDailyValues.filter((amount) => amount > 0).length >= 4
      ? recentDailyValues.reduce((sum, amount) => sum + amount, 0) : null;
    const periods = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['all', 'All time']];
    const tabs = ['Revenue', 'Profit', 'Products', 'Stock', 'Payments', 'Reports'];
    const routeFor = (nextTab, nextPeriod = period) => `/pos/overview?tab=${encodeURIComponent(nextTab)}&range=${encodeURIComponent(nextPeriod)}`;
    const tabLinks = tabs.map((item) => `<a class="pos-tab ${item === tab ? 'is-active' : ''}" href="${routeFor(item)}" data-route="${routeFor(item)}">${item}</a>`).join('');
    const rangeLinks = periods.map(([value, label]) => `<a class="pos-range ${value === period ? 'is-active' : ''}" href="${routeFor(tab, value)}" data-route="${routeFor(tab, value)}">${label}</a>`).join('');
    const revenueSeries = Object.entries(daily).sort(([first], [second]) => first.localeCompare(second)).slice(-14);
    const revenueTable = [...revenueSeries].reverse()
      .map(([date, amount]) => `<tr><td>${escapeHtml(date)}</td><td>${money(amount, settings.currency)}</td></tr>`).join('');
    const operatingProfitByDate = {};
    paidSales.forEach((sale) => {
      const key = localDateKey(sale.created_at);
      operatingProfitByDate[key] = (operatingProfitByDate[key] || 0) + sale.subtotal - sale.items.reduce((sum, item) =>
        sum + (item.historicalUnitCost == null ? 0 : item.historicalUnitCost * item.quantity), 0);
    });
    selectedExpenses.forEach((expense) => {
      operatingProfitByDate[expense.expense_date] = (operatingProfitByDate[expense.expense_date] || 0) - fromCents(expense.amount_cents);
    });
    const operatingProfitSeries = Object.entries(operatingProfitByDate).sort(([first], [second]) => first.localeCompare(second)).slice(-14);
    const rankedProducts = [...productSales.values()].sort((first, second) => second.revenue - first.revenue);
    const rankedEarners = rankedProducts.filter((item) => item.units > 0 && item.knownCostUnits === item.units)
      .sort((first, second) => (second.revenue - second.cost) - (first.revenue - first.cost));
    const productRevenue = rankedProducts.reduce((sum, item) => sum + item.revenue, 0);
    let cumulativeProductRevenue = 0;
    const productContribution = rankedProducts.map((item) => {
      const share = productRevenue ? item.revenue / productRevenue * 100 : 0;
      cumulativeProductRevenue += share;
      return { ...item, share, pareto: cumulativeProductRevenue - share < 80 ? 'A' : cumulativeProductRevenue - share < 95 ? 'B' : 'C' };
    });
    const topProductRows = productContribution.slice(0, 5).map((item, index) =>
      `<div class="pos-category-row"><strong>${index + 1}. ${escapeHtml(item.name)}<small>${item.units} units · ${item.share.toFixed(0)}% item revenue · ${item.knownCostUnits === item.units && item.revenue > 0 ? `${((item.revenue - item.cost) / item.revenue * 100).toFixed(0)}% known-cost margin` : `${item.knownCostUnits} of ${item.units} units costed`} · ${item.pareto} group</small></strong><b>${money(item.revenue, settings.currency)}</b></div>`).join('');
    const costHistory = new Map();
    sales.filter((sale) => sale.paid && sale.currency === settings.currency).forEach((sale) => sale.items.forEach((item) => {
      if (item.historicalUnitCost == null) return;
      const history = costHistory.get(item.productId) || { name: item.name, entries: [] };
      history.entries.push({ date: sale.created_at, cost: item.historicalUnitCost });
      costHistory.set(item.productId, history);
    }));
    const costIncreases = [...costHistory.values()].flatMap((item) => {
      const entries = item.entries.sort((a, b) => a.date.localeCompare(b.date));
      if (entries.length < 2) return [];
      const prior = entries.slice(0, -1).reduce((sum, entry) => sum + entry.cost, 0) / (entries.length - 1);
      const latest = entries[entries.length - 1].cost;
      return prior > 0 && latest > prior * 1.02 ? [{ name: item.name, change: (latest / prior - 1) * 100, latest }] : [];
    }).sort((a, b) => b.change - a.change);
    const belowCostProducts = rankedProducts.filter((item) => item.knownCostUnits === item.units && item.revenue > 0 && item.cost > item.revenue);
    const lowMarginProducts = rankedProducts.filter((item) => item.units >= 3 && item.knownCostUnits === item.units
      && item.revenue > 0 && (item.revenue - item.cost) / item.revenue < 0.1);
    const medianValue = (values) => {
      if (!values.length) return 0;
      const sorted = [...values].sort((first, second) => first - second);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const receiptValues = paidSales.map((sale) => sale.total);
    const receiptMedian = medianValue(receiptValues);
    const receiptMad = medianValue(receiptValues.map((amount) => Math.abs(amount - receiptMedian)));
    const largeReceiptThreshold = Math.max(receiptMedian * 2.5, receiptMedian + receiptMad * 3);
    const largeReceipts = paidSales.length >= 10 && receiptMedian > 0
      ? [...paidSales].filter((sale) => sale.total >= largeReceiptThreshold).sort((a, b) => b.total - a.total).slice(0, 3)
      : [];
    const timePatternDays = new Set(paidSales.map((sale) => localDateKey(sale.created_at))).size;
    const hasTimePatterns = paidSales.length >= 7 && timePatternDays >= 3;
    const breakEvenRevenue = revenue > cogs && operatingExpenses > 0 && costCoverage >= 99.999
      ? operatingExpenses / ((revenue - cogs) / revenue) : null;
    const cashSaleValues = paidSales.filter((sale) => sale.payment_method === 'Cash').map((sale) => sale.total);
    const medianCashSale = medianValue(cashSaleValues);
    const largeCashSales = cashSaleValues.length >= 10 && medianCashSale > 0
      ? paidSales.filter((sale) => sale.payment_method === 'Cash' && sale.total >= medianCashSale * 3)
        .sort((a, b) => b.total - a.total).slice(0, 5) : [];
    const overnightSales = paidSales.filter((sale) => {
      const date = new Date(sale.created_at);
      return Number.isFinite(date.getTime()) && date.getHours() >= 0 && date.getHours() < 5;
    });
    const monthSegments = (() => {
      const datedSales = sales.filter((sale) => sale.paid && sale.currency === settings.currency)
        .map((sale) => ({ sale, date: new Date(sale.created_at) }))
        .filter((item) => Number.isFinite(item.date.getTime())
          && (item.date.getFullYear() < currentMonth.getFullYear()
            || (item.date.getFullYear() === currentMonth.getFullYear() && item.date.getMonth() < currentMonth.getMonth())));
      const observedMonths = new Set(datedSales.map(({ date }) => `${date.getFullYear()}-${date.getMonth()}`));
      if (observedMonths.size < 3 || datedSales.length < 30) return [];
      const segments = [
        { label: 'days 1–7', matches: (day) => day <= 7 },
        { label: 'days 8–14', matches: (day) => day >= 8 && day <= 14 },
        { label: 'days 15–21', matches: (day) => day >= 15 && day <= 21 },
        { label: 'month end', matches: (day) => day >= 22 }
      ];
      return segments.map((segment) => {
        const matches = datedSales.filter(({ date }) => segment.matches(date.getDate()));
        const activeMonths = new Set(matches.map(({ date }) => `${date.getFullYear()}-${date.getMonth()}`)).size;
          const observedMonthKeys = observedMonths;
        const calendarDays = [...observedMonthKeys].reduce((total, key) => {
          const [year, month] = key.split('-').map(Number);
          const lastDay = new Date(year, month + 1, 0).getDate();
          const segmentDays = segment.label === 'days 1–7' || segment.label === 'days 8–14' || segment.label === 'days 15–21'
            ? 7 : lastDay - 21;
          return total + segmentDays;
        }, 0);
        const amount = matches.reduce((sum, { sale }) => sum + sale.subtotal, 0);
        return { label: segment.label, amount, days: calendarDays, activeMonths,
          averagePerCalendarDay: calendarDays ? amount / calendarDays : 0 };
      }).filter((segment) => segment.activeMonths >= 2);
    })();
    const weekdayDayCounts = Array.from({ length: 7 }, () => 0);
    const firstPaymentTimestamp = paidSales.reduce((earliest, sale) => {
      const timestamp = Date.parse(sale.created_at);
      return Number.isFinite(timestamp) ? Math.min(earliest, timestamp) : earliest;
    }, Number.POSITIVE_INFINITY);
    const observedStart = period === 'all' && Number.isFinite(firstPaymentTimestamp)
      ? new Date(firstPaymentTimestamp) : firstDate;
    const dayCursor = Number.isFinite(observedStart.getTime()) ? new Date(observedStart) : new Date();
    dayCursor.setHours(0, 0, 0, 0);
    const observationEnd = new Date();
    observationEnd.setHours(0, 0, 0, 0);
    while (dayCursor <= observationEnd) {
      weekdayDayCounts[dayCursor.getDay()] += 1;
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
    const weekdayDailyAverage = weekdayTotals.map((amount, day) => weekdayDayCounts[day] ? amount / weekdayDayCounts[day] : 0);
    const weekdayAverageRows = weekdayNames.map((name, day) => ({
      name, total: weekdayTotals[day], average: weekdayDailyAverage[day], count: weekdayCounts[day], dates: weekdayDayCounts[day]
    })).filter((day) => day.dates > 0).sort((a, b) => b.average - a.average);
    const validSalesDates = sales.map((sale) => new Date(sale.created_at)).filter((date) => Number.isFinite(date.getTime()));
    const dataQuality = {
      paidSalesWithoutCustomer: paidSales.filter((sale) => !sale.customer_phone || !sale.customer_name).length,
      paidSalesWithoutLines: paidSales.filter((sale) => !sale.items.length).length,
      paidSalesWithoutCosts: paidSales.filter((sale) => sale.items.some((item) => item.historicalUnitCost == null)).length,
      invalidDates: sales.length - validSalesDates.length
    };
    const alertCards = [];
    if (outOfStock.length) alertCards.push({
      id: `stock-out-${outOfStock.map((product) => product.id).sort((a, b) => a - b).join('-')}`,
      severity: 'critical', title: `${outOfStock.length} product${outOfStock.length === 1 ? '' : 's'} out of stock`,
      detail: `${outOfStock.slice(0, 4).map((product) => escapeHtml(product.name)).join(', ')}. Check inventory and recent demand before replenishing.`,
      href: '/pos/inventory'
    });
    if (belowCostProducts.length) alertCards.push({
      id: `below-cost-${belowCostProducts.map((product) => product.id).sort((a, b) => a - b).join('-')}`,
      severity: 'critical', title: `${belowCostProducts.length} product${belowCostProducts.length === 1 ? '' : 's'} have recorded costs above sales`,
      detail: `${belowCostProducts.slice(0, 4).map((product) => escapeHtml(product.name)).join(', ')}. Check the saved cost and realized prices; missing cost history can distort this signal.`,
      href: '/pos/overview?tab=Products'
    });
    if (overdueCredit.length) alertCards.push({
      id: `overdue-credit-${overdueCredit.map((sale) => sale.id).sort((a, b) => a - b).join('-')}`,
      severity: 'warning', title: `${overdueCredit.length} unpaid sale${overdueCredit.length === 1 ? '' : 's'} past due`,
      detail: `Outstanding overdue balance: ${money(overdueCredit.reduce((sum, sale) => sum + sale.total - sale.amountPaid, 0), settings.currency)}.`,
      href: '/pos/sales'
    });
    if (largeCashSales.length) alertCards.push({
      id: `large-cash-${largeCashSales.map((sale) => sale.id).sort((a, b) => a - b).join('-')}`,
      severity: 'warning', title: `${largeCashSales.length} unusually large cash receipt${largeCashSales.length === 1 ? '' : 's'} to review`,
      detail: `At least 3× the median cash receipt (${money(medianCashSale, settings.currency)}). This is a review prompt, not a fraud finding.`,
      href: '/pos/sales'
    });
    if (largeReceipts.length) alertCards.push({
      id: `large-receipt-${largeReceipts.map((sale) => sale.id).sort((a, b) => a - b).join('-')}`,
      severity: 'warning', title: `${largeReceipts.length} receipt${largeReceipts.length === 1 ? '' : 's'} exceed the robust size threshold`,
      detail: `At least the greater of 2.5× the median receipt (${money(receiptMedian, settings.currency)}) or median + 3 MAD. This is a review prompt, not a fraud finding.`,
      href: '/pos/sales'
    });
    if (overnightSales.length >= 2 && paidSales.length >= 10) alertCards.push({
      id: `overnight-sales-${monthStartKey}`,
      severity: 'warning', title: `${overnightSales.length} paid receipts between midnight and 5am`,
      detail: 'Review the receipts if the store is normally closed at those times. Timestamps use the device clock and can be inaccurate.',
      href: '/pos/sales'
    });
    if (costIncreases.length) alertCards.push({
      id: `cost-increase-${costIncreases.map((item) => item.name).sort().join('|')}`,
      severity: 'warning', title: `${costIncreases.length} recorded product cost${costIncreases.length === 1 ? '' : 's'} increased`,
      detail: `${costIncreases.slice(0, 3).map((item) => `${escapeHtml(item.name)} +${item.change.toFixed(0)}%`).join(', ')}. Based on saved sale-time costs, not supplier invoices.`,
      href: '/pos/overview?tab=Products'
    });
    if (monthlyGoal && monthRunRate < monthlyGoal && elapsedMonthDays >= 7) alertCards.push({
      id: `monthly-goal-pacing-${currentMonth.getFullYear()}-${currentMonth.getMonth()}`,
      severity: 'neutral', title: 'Monthly revenue goal is behind the current pace',
      detail: `The straight-line run rate is ${money(monthRunRate, settings.currency)} for this month against ${money(monthlyGoal, settings.currency)}. This is a descriptive pace, not a forecast.`,
      href: '/pos/overview?tab=Insights'
    });
    const savedPreferences = settings.insightPreferences;
    const activeAlerts = alertCards.filter((item) => !savedPreferences.dismissed.includes(item.id)
      && !(Number(savedPreferences.snoozed[item.id]) > Date.now()))
      .sort((a, b) => ({ critical: 0, warning: 1, neutral: 2 }[a.severity] - { critical: 0, warning: 1, neutral: 2 }[b.severity]));
    const dismissedAlertCount = savedPreferences.dismissed.length;
    const monthlyBenchmarks = (() => {
      const totals = new Map();
      sales.filter((sale) => sale.currency === settings.currency && sale.paid).forEach((sale) => {
        const date = new Date(sale.created_at);
        if (!Number.isFinite(date.getTime()) || (date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth())) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        totals.set(key, (totals.get(key) || 0) + sale.subtotal);
      });
      return [...totals.entries()].sort((a, b) => b[1] - a[1]);
    })();
    const credit = sales.filter((sale) => !sale.paid).reduce((sum, sale) =>
      sum + (sale.currency === settings.currency ? sale.total - sale.amountPaid : 0), 0);
    const missingCosts = products.filter((product) => product.buyingPrice == null).length;
    let panel = '';
    if (tab === 'Summary') {
      panel = `<section class="pos-overview-card" aria-label="Business totals">
        <div class="pos-overview-metrics">
          ${overviewMetric('Revenue', money(revenue, settings.currency), `Before tax · ${paidSales.length} fully paid sales`)}
          ${overviewMetric('Profit', money(revenue - cogs, settings.currency), `Sale-time costs cover ${costCoverage.toFixed(0)}% of units`)}
          ${overviewMetric('Operating profit', money(revenue - cogs - operatingExpenses, settings.currency), `${money(operatingExpenses, settings.currency)} expenses · recorded costs only`)}
          ${overviewMetric('Credit', money(credit, settings.currency), 'All unpaid balances')}
        </div>
      </section>
      ${card(`<h3>Recent revenue</h3>${renderRevenueChart(revenueSeries, settings.currency)}`, 'pos-revenue-card')}
      ${card(`<h3>Period comparison</h3>
        <div class="pos-insight-row"><strong>Paid net sales · before tax</strong><span>${money(revenue, settings.currency)} · ${changeLabel(revenue, previousRevenue)}</span></div>
        <div class="pos-insight-row"><strong>Recorded expenses</strong><span>${money(operatingExpenses, settings.currency)} · ${changeLabel(operatingExpenses, previousExpenseTotal)}</span></div>`)}
      ${card(`<h3>Top products</h3>${topProductRows || '<p class="pos-help">Product rankings appear after sales are recorded.</p>'}`)}
      ${paceEstimate === null ? '' : card(`<h3>Revenue pace estimate</h3><strong>${money(paceEstimate, settings.currency)}</strong><p class="pos-help">Estimated next 7 days from average daily net sales before tax over the last 7 days. A simple pace estimate, not a guarantee.</p>`)}
      ${card(`<h3>Quick insights</h3><div class="pos-insights">
        <p>${selectedSales.length ? `${selectedSales.length} sales recorded for this period.` : 'No sales recorded for this period.'}</p>
        <p>${lowStock.length ? `${lowStock.length} products need stock attention.` : 'No low-stock alerts.'}</p>
        <p>${missingCosts ? `${missingCosts} products have no unit cost, so profit may be understated.` : 'All products have a recorded unit cost.'}</p>
      </div>`)}
      ${monthlyGoal ? card(`<h3>Monthly net-sales goal</h3>
        <div class="pos-insight-row"><strong>${money(monthRevenue, settings.currency)} of ${money(monthlyGoal, settings.currency)}</strong><span>${Math.min(100, monthProgress).toFixed(0)}%</span></div>
        <div class="pos-goal-track" role="progressbar" aria-label="Monthly revenue goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, monthProgress).toFixed(0)}"><span style="width:${Math.min(100, monthProgress).toFixed(1)}%"></span></div>
        <p class="pos-help">${monthRevenue >= monthlyGoal ? 'Monthly target reached.' : `${money(requiredDailyRevenue, settings.currency)} per remaining day is needed to reach the goal; straight-line pace projects ${money(monthRunRate, settings.currency)}.`}</p>`) : ''}`;
    } else if (tab === 'Revenue') {
      panel = `<div class="pos-metrics">${metric('Net sales · before tax', money(revenue, settings.currency), `${paidSales.length} fully paid sales`)}
        ${metric('Payments received', money(paymentRevenue, settings.currency), `${selectedPayments.length} confirmed payments · includes tax`)}
        ${metric('Average paid sale', money(paidSales.length ? revenue / paidSales.length : 0, settings.currency), 'Net subtotal per fully paid sale')}</div>
        ${card(`<h3>Net sales by receipt date</h3>${renderRevenueChart(revenueSeries, settings.currency)}<div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Date</th><th>Net sales · before tax</th></tr></thead><tbody>${revenueTable || '<tr><td colspan="2">No paid sales in this period.</td></tr>'}</tbody></table></div>`)}`;
    } else if (tab === 'Profit') {
      panel = `<div class="pos-metrics">${metric('Net sales · before tax', money(revenue, settings.currency), `${paidSales.length} fully paid sales`)}
        ${metric('Cost of goods', money(cogs, settings.currency), 'Historical unit costs')}
        ${metric('Gross profit', money(revenue - cogs, settings.currency), 'Revenue less cost of goods')}
        ${metric('Operating profit', money(revenue - cogs - operatingExpenses, settings.currency), 'After recorded expenses')}</div>
        ${card(`<h3>Profit and loss</h3>
          <div class="pos-total-line"><span>Net sales · before tax</span><b>${money(revenue, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Tax on fully paid sales</span><b>${money(taxCollected, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Fully paid receipt total</span><b>${money(grossReceipts, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Payments received this period</span><b>${money(paymentRevenue, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Recorded cost of goods</span><b>− ${money(cogs, settings.currency)}</b></div>
          <div class="pos-total-line"><strong>Gross profit</strong><b>${money(revenue - cogs, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Recorded operating expenses</span><b>− ${money(operatingExpenses, settings.currency)}</b></div>
          <div class="pos-total-line"><strong>Operating profit</strong><b>${money(revenue - cogs - operatingExpenses, settings.currency)}</b></div>
          ${breakEvenRevenue === null ? `<p class="pos-help">${costCoverage < 99.999 ? `Break-even is withheld because saved sale-time costs cover only ${costCoverage.toFixed(0)}% of sold units.` : 'Break-even needs positive paid revenue, recorded product costs below revenue, and expenses in this period.'}</p>` : `<p class="pos-help">Approximate revenue to cover this period’s recorded expenses at the current gross margin: ${money(breakEvenRevenue, settings.currency)}. This does not separate fixed and variable costs.</p>`}
          <p class="pos-help">Sales revenue is the pre-tax subtotal of fully paid receipts by receipt-created date. Tax is shown separately, not treated as profit. Payments received follow payment dates and can include partial or cross-period settlements.</p>
          <p class="pos-help">${costCoverage < 99.999 ? `Only ${costCoverage.toFixed(0)}% of sold units have saved sale-time costs; missing costs make profit estimates too high.` : 'Profit uses saved sale-time unit costs and recorded POS expenses only.'}</p>`)
        }
        ${card(`<h3>Recorded operating-profit trend</h3>${renderProfitChart(operatingProfitSeries, settings.currency)}
          <p class="pos-help">Daily view uses pre-tax subtotals of fully paid receipts by sale-created date, less saved line costs and expenses entered for that date. It may not match payment-date cash totals above.</p>`)}
        ${card(`<h3>Expenses</h3>${selectedExpenses.map((expense) => `<div class="pos-category-row"><strong>${escapeHtml(expense.label)}<small>${escapeHtml(expense.category)} · ${escapeHtml(expense.expense_date)}</small></strong><b>${money(fromCents(expense.amount_cents), expense.currency)}</b></div>`).join('') || '<p class="pos-help">No expenses in this period.</p>'}`)}`;
    } else if (tab === 'Products') {
      panel = card(`<h3>Product performance</h3><div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Gross profit</th></tr></thead><tbody>
        ${rankedProducts.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.units}</td><td>${money(item.revenue, settings.currency)}</td><td>${item.knownCostUnits === item.units ? money(item.revenue - item.cost, settings.currency) : 'Incomplete costs'}</td></tr>`).join('') || '<tr><td colspan="4">No product sales in this period.</td></tr>'}
        </tbody></table></div>`);
    } else if (tab === 'Stock') {
      panel = `${card(`<h3>Stock health</h3><div class="pos-metrics">${metric('Known stock cost', money(inventoryCostValue, settings.currency), 'Tracked stock with saved buying cost')}
          ${metric('Retail value', money(inventoryRetailValue, settings.currency), 'Tracked stock at current prices')}
          ${metric('No sale in 60 days', money(dormantStockValue, settings.currency), `${dormantStock.length} dormant stocked products`)}</div>
        <div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>On hand</th><th>30d units</th><th>Days cover</th><th>Cost value</th><th>Retail value</th></tr></thead><tbody>
        ${stockMetrics.map((product) => `<tr><td>${escapeHtml(product.name)}</td><td>${product.stock === null ? 'Untracked' : product.stock}</td><td>${product.monthlyUnits || '—'}</td>
          <td>${product.stock === null ? 'Untracked' : product.daysCover === null ? 'No recent pace' : product.daysCover.toFixed(0)}</td>
          <td>${product.costValue === null ? '—' : money(product.costValue, settings.currency)}</td>
          <td>${product.retailValue === null ? '—' : money(product.retailValue, settings.currency)}</td></tr>`).join('') || '<tr><td colspan="6">No inventory yet.</td></tr>'}
        </tbody></table></div>
        <p class="pos-help">Days cover is current stock divided by units sold per day during the last 30 days. It is a rough run rate and does not account for lead time or seasonality.</p>`)}`;
    } else if (tab === 'Payments') {
      panel = card(`<h3>Payment method totals</h3>${Object.entries(byMethod).map(([method, amount]) => `<div class="pos-category-row"><strong>${escapeHtml(method)}</strong><b>${money(amount, settings.currency)}</b></div>`).join('') || '<p class="pos-help">No confirmed payments in this period.</p>'}`);
    } else {
      const topProducts = productContribution.slice(0, 5);
      const expenseRows = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
      const customerRows = customers.slice(0, 5);
      const topSeller = [...rankedProducts].sort((a, b) => b.units - a.units)[0];
      const topEarner = rankedEarners[0];
      const weekdayRows = weekdayNames.map((name, day) => ({ name, amount: weekdayTotals[day], count: weekdayCounts[day] }))
        .filter((day) => day.count).sort((a, b) => b.amount - a.amount);
      const busiestHourEntry = hourTotals.map((amount, hour) => ({ amount, hour, count: hourCounts[hour] }))
        .filter((entry) => entry.count).sort((a, b) => b.amount - a.amount)[0];
      panel = `<div class="pos-insights-dashboard">
        ${card(`<h3>Needs attention</h3>
          ${outOfStock.map((product) => `<div class="pos-insight-row"><div><strong>${escapeHtml(product.name)} is out of stock</strong><p>Review stock levels in Inventory.</p></div><a href="/pos/inventory" data-route="/pos/inventory" class="btn-secondary">Review</a></div>`).join('')}
          ${restockSuggestions.filter((product) => product.stock > 0).map((product) => `<div class="pos-insight-row"><div><strong>${escapeHtml(product.name)} · ${product.stock} left</strong><p>${product.monthlyUnits ? `Recent pace: ${product.monthlyUnits} units in 30 days · consider about ${product.suggestedUnits} more for 14-day cover.` : 'At or below the current 10-unit low-stock alert level; record sales to estimate restock pace.'}</p></div><a href="/pos/inventory" data-route="/pos/inventory" class="btn-secondary">Restock</a></div>`).join('')}
          ${overdueCredit.map((sale) => `<div class="pos-insight-row"><div><strong>Overdue ${escapeHtml(sale.receipt_number)}</strong><p>${escapeHtml(sale.customer_name || 'Customer')} · due ${escapeHtml(sale.due_date)} · ${money(sale.total - sale.amountPaid, sale.currency)} remaining</p></div><a href="/pos/sales?open=${sale.id}" data-route="/pos/sales?open=${sale.id}" class="btn-secondary">Review</a></div>`).join('')}
          ${missingCosts ? `<p class="pos-help">${missingCosts} products have no recorded unit cost; profit estimates may be understated.</p>` : ''}
          ${dormantStock.length ? `<p class="pos-help">${dormantStock.length} stocked products had no recorded sale in the last 60 days: ${dormantStock.slice(0, 4).map((product) => escapeHtml(product.name)).join(', ')}. Known buying-cost value tied in these items: ${money(dormantStockValue, settings.currency)}; products without a saved cost are excluded.</p>` : ''}
          ${!outOfStock.length && !lowStock.length && !overdueCredit.length && !missingCosts && !dormantStock.length ? '<p class="pos-help">No stock, overdue-credit, or product-cost alerts from the saved data.</p>' : ''}`)}
        ${card(`<h3>Sales trends</h3>
          <div class="pos-insight-row"><strong>Net sales before tax</strong><span>${money(revenue, settings.currency)} · ${changeLabel(revenue, previousRevenue)}</span></div>
          <div class="pos-insight-row"><strong>Sales created</strong><span>${selectedSales.length} in this period</span></div>
          <div class="pos-insight-row"><strong>Average paid sale</strong><span>${money(paidSales.length ? revenue / paidSales.length : 0, settings.currency)}</span></div>
          <div class="pos-insight-row"><strong>Busiest day</strong><span>${hasTimePatterns ? weekdayNames[busiestWeekday] : 'Not enough sales history yet'}</span></div>
          <div class="pos-insight-row"><strong>Strongest recorded hour</strong><span>${hasTimePatterns ? `${String(busiestHour).padStart(2, '0')}:00` : 'Not enough sales history yet'}</span></div>
          ${paceEstimate === null ? '<p class="pos-help">Revenue pace estimate needs fully paid sales on at least four separate days.</p>' : `<p class="pos-help">At the recent pace, the next 7 days net-sales estimate is ${money(paceEstimate, settings.currency)} before tax. This is a simple estimate, not a guarantee.</p>`}`)}
        ${card(`<h3>Revenue rhythm</h3>
          ${weekdayAverageRows.length && paidSales.length >= 14
            ? `<div class="pos-insight-row"><strong>Best average weekday</strong><span>${escapeHtml(weekdayAverageRows[0].name)} · ${money(weekdayAverageRows[0].average, settings.currency)}/calendar day</span></div>
              ${weekdayAverageRows.length > 1 ? `<div class="pos-insight-row"><strong>Slowest observed weekday</strong><span>${escapeHtml(weekdayAverageRows[weekdayAverageRows.length - 1].name)} · ${money(weekdayAverageRows[weekdayAverageRows.length - 1].average, settings.currency)}/calendar day</span></div>` : ''}
              <p class="pos-help">Weekday averages divide pre-tax net sales by every calendar occurrence in the selected range, including zero-sales days. Need at least 14 fully paid sales for comparison.</p>`
            : '<p class="pos-help">Weekday patterns need at least 14 fully paid sales in this period.</p>'}
          ${monthSegments.length ? (() => {
            const topSegment = [...monthSegments].sort((a, b) => b.averagePerCalendarDay - a.averagePerCalendarDay)[0];
            return `<div class="pos-insight-row"><strong>Strongest month segment</strong><span>${escapeHtml(topSegment.label)} · ${money(topSegment.averagePerCalendarDay, settings.currency)} per calendar day</span></div><p class="pos-help">Based on at least 30 paid sales over three or more months; revenue is divided by observed calendar days in each segment. This is descriptive, not proof of a payday effect.</p>`;
          })() : '<p class="pos-help">Month-segment patterns need at least 30 paid sales across 3 different months.</p>'}`)}
        ${card(`<h3>Product performance</h3>
          ${topProducts.map((item) => `<div class="pos-category-row"><strong>${escapeHtml(item.name)}<small>${item.units} units · ${item.share.toFixed(0)}% of sold-item revenue · ${item.knownCostUnits === item.units && item.revenue > 0 ? `${((item.revenue - item.cost) / item.revenue * 100).toFixed(0)}% fully costed margin` : `${item.knownCostUnits}/${item.units} units costed`} · ${item.pareto} contribution group</small></strong><b>${money(item.revenue, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Not enough sales history to rank products.</p>'}
          <div class="pos-insight-row"><strong>Top seller</strong><span>${topSeller ? `${escapeHtml(topSeller.name)} · ${topSeller.units} units` : 'Not enough sales yet'}</span></div>
          <div class="pos-insight-row"><strong>Highest fully costed gross profit</strong><span>${topEarner ? `${escapeHtml(topEarner.name)} · ${money(topEarner.revenue - topEarner.cost, settings.currency)}` : 'No product has complete sale-time costs yet'}</span></div>
          ${belowCostProducts.map((item) => `<p class="pos-help">${escapeHtml(item.name)} has recorded costs above its sales revenue; review its price or saved costs.</p>`).join('')}
          ${lowMarginProducts.map((item) => {
            const averageCost = item.cost / item.units;
            const targetPrice = averageCost / 0.9;
            const currentPrice = item.revenue / item.units;
            return `<p class="pos-help">${escapeHtml(item.name)} has a ${((item.revenue - item.cost) / item.revenue * 100).toFixed(0)}% fully costed margin. Reaching a 10% gross margin would require about ${money(Math.max(0, targetPrice - currentPrice), settings.currency)} more per unit at its average recorded cost; check market pricing before changing it.</p>`;
          }).join('')}
          <p class="pos-help">Margins use saved sale-time unit costs; missing costs count as zero, so actual profit may be lower.</p>`)}
        ${card(`<h3>Category performance</h3>
          ${categoryChanges.map((category) => `<div class="pos-category-row"><strong>${escapeHtml(category.name)}<small>${category.units} units · ${category.share.toFixed(0)}% mix · ${category.margin === null ? `${category.knownCostUnits}/${category.units} units costed` : `${category.margin.toFixed(0)}% fully costed margin`} · ${category.orders.size} paid sales${category.change === null ? '' : ` · ${category.change >= 0 ? '+' : ''}${category.change.toFixed(0)}% vs prior period`}</small></strong><b>${money(category.revenue, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Category comparisons appear after recorded sales. Categories use each product’s current assignment.</p>'}
          ${categoryChanges.length && !categoryChanges.some((category) => category.previous > 0) ? '<p class="pos-help">A prior-period category comparison needs sales in both periods.</p>' : ''}`)}
        ${card(`<h3>Basket patterns</h3>
          ${frequentPairs.map((pair) => `<div class="pos-category-row"><strong>${escapeHtml(pair.first)} + ${escapeHtml(pair.second)}<small>Recorded together</small></strong><b>${pair.count} sales</b></div>`).join('')
            || '<p class="pos-help">No multi-product baskets recorded in this period yet.</p>'}
          <p class="pos-help">Pairs count only paid sales containing both products; this is descriptive, not proof that one product caused the other sale.</p>`)}
        ${card(`<h3>Customers</h3>
          <div class="pos-insight-row"><strong>Identified customers</strong><span>${customers.length}</span></div>
          <div class="pos-insight-row"><strong>First known purchase in period</strong><span>${newCustomersInRange.length}</span></div>
          <div class="pos-insight-row"><strong>New-in-period customers with a later repeat</strong><span>${repeatBuyersInRange.length}</span></div>
          <div class="pos-insight-row"><strong>Repeat customers</strong><span>${repeatCustomers.length} · ${customerRepeatRate.toFixed(0)}% of identified</span></div>
          <div class="pos-insight-row"><strong>Single-purchase customers</strong><span>${oneTimeCustomers.length}</span></div>
          <div class="pos-insight-row"><strong>Loyal · 3+ paid sales</strong><span>${loyalCustomers.length}</span></div>
          <div class="pos-insight-row"><strong>Lapsed repeat customers</strong><span>${lapsedRepeatCustomers.length} · no sale in 60+ days</span></div>
          <div class="pos-insight-row"><strong>Top 20% spend share</strong><span>${customerConcentration.toFixed(0)}% of identified-customer revenue</span></div>
          <div class="pos-insight-row"><strong>Identified-customer sales</strong><span>${money(customerRevenue, settings.currency)}</span></div>
          ${customerRows.map((customer) => `<div class="pos-category-row"><strong>${escapeHtml(customer.name)}<small>${customer.orders} paid sales</small></strong><b>${money(customer.spend, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Save customer name and phone at checkout to see repeat and top-customer patterns.</p>'}
          <p class="pos-help">${inactiveCustomers.length} identified customers have no paid sale recorded in 60+ days.</p>
          <p class="pos-help">Customers are matched using their saved phone number and paid receipts.</p>`)}
        ${card(`<h3>Busy days and hours</h3>
          ${weekdayRows.map((day) => `<div class="pos-category-row"><strong>${day.name}<small>${day.count} fully paid receipts</small></strong><b>${money(day.amount, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Day and hour patterns need fully paid receipts.</p>'}
          <div class="pos-insight-row"><strong>Strongest hour</strong><span>${busiestHourEntry ? `${String(busiestHourEntry.hour).padStart(2, '0')}:00 · ${busiestHourEntry.count} receipts` : 'Not enough sales yet'}</span></div>
          <p class="pos-help">Net sales by receipt-created time; these totals are not normalized for different opening hours.</p>`)}
        ${card(`<h3>Recorded cost changes</h3>
          ${costIncreases.slice(0, 5).map((item) => `<div class="pos-insight-row"><strong>${escapeHtml(item.name)}</strong><span>Latest saved cost ${money(item.latest, settings.currency)} · up ${item.change.toFixed(0)}% vs earlier recorded costs</span></div>`).join('')
            || '<p class="pos-help">No increases can be confirmed from repeated sale-time cost records. This does not compare supplier invoices.</p>'}`)}
        ${card(`<h3>Payment mix changes</h3>
          ${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
            const priorAmount = previousByMethod[method] || 0;
            const currentShare = paymentRevenue ? amount / paymentRevenue * 100 : 0;
            const priorShare = previousPaymentRevenue ? priorAmount / previousPaymentRevenue * 100 : 0;
            const shift = previousPaymentRevenue ? `${currentShare - priorShare >= 0 ? '+' : ''}${(currentShare - priorShare).toFixed(0)} percentage points vs prior period` : 'No prior-period baseline';
            return `<div class="pos-category-row"><strong>${escapeHtml(method)}<small>${currentShare.toFixed(0)}% of payment collections · ${shift}</small></strong><b>${money(amount, settings.currency)}</b></div>`;
          }).join('') || '<p class="pos-help">No confirmed payments in this period.</p>'}
          <p class="pos-help">Payments are manually recorded in the POS; this does not reconcile mobile-money statements.</p>`)}
        ${card(`<h3>Large-receipt review</h3>
          ${largeReceipts.map((sale) => `<div class="pos-insight-row"><div><strong>${escapeHtml(sale.receipt_number)} · ${money(sale.total, settings.currency)}</strong><p>${escapeHtml(sale.customer_name || 'No customer saved')} · ${escapeHtml(sale.created_at.slice(0, 16).replace('T', ' '))}</p></div><a href="/pos/sales?open=${sale.id}" data-route="/pos/sales?open=${sale.id}" class="btn-secondary">Review</a></div>`).join('')
            || `<p class="pos-help">${paidSales.length < 10 ? 'Large-receipt review needs at least 10 paid sales in this period.' : 'No paid receipt exceeds the robust median/MAD review threshold.'}</p>`}
          <p class="pos-help">Threshold is the greater of 2.5× the median or median + 3 median absolute deviations. This is a review prompt, not a fraud finding.</p>`)}
        ${card(`<h3>Cash receipt review</h3>
          ${largeCashSales.map((sale) => `<div class="pos-insight-row"><div><strong>${escapeHtml(sale.receipt_number)} · ${money(sale.total, settings.currency)}</strong><p>${escapeHtml(sale.created_at.slice(0, 16).replace('T', ' '))}</p></div><a href="/pos/sales?open=${sale.id}" data-route="/pos/sales?open=${sale.id}" class="btn-secondary">Review</a></div>`).join('')
            || `<p class="pos-help">${cashSaleValues.length < 10 ? 'Unusual cash-sale screening requires at least 10 paid cash receipts.' : 'No cash receipt is at least 3× the median paid cash receipt.'}</p>`}
          <p class="pos-help">Median-based review reduces sensitivity to a few very large sales. This is not a fraud finding.</p>`)}
        ${card(`<h3>Seasonality and selling periods</h3>
          ${monthSegments.length ? monthSegments.map((segment) => `<div class="pos-category-row"><strong>${escapeHtml(segment.label)}<small>Revenue across ${segment.days} calendar days · sales in ${segment.activeMonths} months</small></strong><b>${money(segment.averagePerCalendarDay, settings.currency)}/day</b></div>`).join('')
            : '<p class="pos-help">Not enough history for a month-of-year or month-segment pattern: need 30 paid sales across at least 3 months. We do not label one month as seasonal from a single observation.</p>'}
          <p class="pos-help">These patterns can reflect opening days, recording habits, promotions, or seasonality. They are not causal or a forecast.</p>`)}
        ${card(`<h3>Data quality and confidence</h3>
          <div class="pos-insight-row"><strong>Receipts with missing line costs</strong><span>${dataQuality.paidSalesWithoutCosts} of ${paidSales.length}</span></div>
          <div class="pos-insight-row"><strong>Paid receipts without customer details</strong><span>${dataQuality.paidSalesWithoutCustomer}</span></div>
          <div class="pos-insight-row"><strong>Paid receipts without item lines</strong><span>${dataQuality.paidSalesWithoutLines}</span></div>
          <div class="pos-insight-row"><strong>Receipts with unreadable dates</strong><span>${dataQuality.invalidDates}</span></div>
          <p class="pos-help">Known-cost coverage is ${totalSoldUnits ? costCoverage.toFixed(0) : '0'}% of units in fully paid receipts. Expenses are user-entered; missing records cannot be inferred.</p>`)}
        ${card(`<h3>Actionable recommendations</h3>
          ${missingCosts ? `<p class="pos-help">Add buying costs for ${missingCosts} products to improve profit and product-margin estimates.</p>` : ''}
          ${belowCostProducts.length ? `<p class="pos-help">Review the price or saved buying cost for ${belowCostProducts.slice(0, 3).map((item) => escapeHtml(item.name)).join(', ')}; recorded costs exceed sales revenue.</p>` : ''}
          ${dormantStock.length ? `<p class="pos-help">Review ${dormantStock.slice(0, 3).map((product) => escapeHtml(product.name)).join(', ')}: these items have stock but no sale in 60 days.</p>` : ''}
          ${topSeller && topEarner && topSeller.id !== topEarner.id ? `<p class="pos-help">${escapeHtml(topSeller.name)} sells the most units, while ${escapeHtml(topEarner.name)} has the highest recorded gross profit. Compare their pricing and costs.</p>` : ''}
          ${frequentPairs.length ? `<p class="pos-help">Consider testing a bundle for ${escapeHtml(frequentPairs[0].first)} and ${escapeHtml(frequentPairs[0].second)}; they appeared together in ${frequentPairs[0].count} paid sales.</p>` : ''}
          ${!missingCosts && !belowCostProducts.length && !lowMarginProducts.length && !dormantStock.length && !(topSeller && topEarner && topSeller.id !== topEarner.id) && !frequentPairs.length ? '<p class="pos-help">No specific product action stands out from the currently recorded data.</p>' : ''}`)}
        ${card(`<h3>Goals and benchmarks</h3>
          ${monthlyGoal ? `<div class="pos-insight-row"><strong>Current month</strong><span>${money(monthRevenue, settings.currency)} / ${money(monthlyGoal, settings.currency)} · ${Math.min(100, monthProgress).toFixed(0)}%</span></div>
            <div class="pos-goal-track" role="progressbar" aria-label="Monthly revenue goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, monthProgress).toFixed(0)}"><span style="width:${Math.min(100, monthProgress).toFixed(1)}%"></span></div>
            <p class="pos-help">${monthRevenue >= monthlyGoal ? 'You reached this month’s target.' : `Needed per remaining day: ${money(requiredDailyRevenue, settings.currency)}. Straight-line month-end pace: ${money(monthRunRate, settings.currency)}; this assumes the current daily average continues.`}</p>`
            : `<p class="pos-help">${staleGoalCurrency ? `A saved goal is in ${escapeHtml(staleGoalCurrency)} while the store now uses ${escapeHtml(settings.currency)}. Save a new goal in the current currency to restart tracking.` : 'Set a monthly paid-revenue goal to track progress, required daily pace, and a simple run-rate comparison.'}</p>`}
          ${monthlyBenchmarks.length ? `<p class="pos-help">Best complete recorded month: ${escapeHtml(monthlyBenchmarks[0][0])} · ${money(monthlyBenchmarks[0][1], settings.currency)}. Personal historical benchmark only, not an industry comparison.</p>` : '<p class="pos-help">A complete-month benchmark appears after at least one previous month with recorded payments.</p>'}
          <form class="pos-inline-form" data-pos-form="revenue-goal">
            <label for="pos-monthly-goal">Monthly net-sales target · before tax</label>
            <input id="pos-monthly-goal" name="amount" type="number" min="0.01" step="0.01" required value="${monthlyGoal == null ? '' : monthlyGoal}" placeholder="e.g. 50000">
            <button class="btn-secondary">${monthlyGoal ? 'Update goal' : 'Save goal'}</button>
            ${monthlyGoal ? '<button class="btn-secondary" type="button" data-pos-action="clear-revenue-goal">Remove</button>' : ''}
          </form>`) }
        ${card(`<h3>Priority alerts</h3>
          ${activeAlerts.map((alert) => `<div class="pos-insight-alert is-${alert.severity}">
            <div><strong>${escapeHtml(alert.title)}</strong><p>${alert.detail}</p><a href="${alert.href}" data-route="${alert.href}">Review details</a></div>
            <div class="pos-alert-actions"><button type="button" data-pos-action="snooze-alert" data-key="${escapeHtml(alert.id)}">Snooze 24h</button><button type="button" data-pos-action="dismiss-alert" data-key="${escapeHtml(alert.id)}">Dismiss</button></div>
          </div>`).join('') || '<p class="pos-help">No active data-backed priority alerts. Continue recording accurate costs, receipts, and stock counts.</p>'}
          ${dismissedAlertCount ? `<button type="button" class="btn-secondary" data-pos-action="restore-alerts">Restore ${dismissedAlertCount} dismissed alert${dismissedAlertCount === 1 ? '' : 's'}</button>` : ''}
          <p class="pos-help">Alerts are ranked by severity and are review prompts, not diagnoses. Dismissals stay saved until restored; snoozes expire after 24 hours.</p>`)}
        ${card(`<h3>Money and cash flow</h3>
          ${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => `<div class="pos-category-row"><strong>${escapeHtml(method)}<small>${paymentRevenue ? (amount / paymentRevenue * 100).toFixed(0) : 0}% of payment collections</small></strong><b>${money(amount, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">No confirmed payments in this period.</p>'}
          <div class="pos-insight-row"><strong>Confirmed payments received</strong><span>${money(paymentRevenue, settings.currency)} · may include tax and partial settlements</span></div>
          <div class="pos-insight-row"><strong>Outstanding credit</strong><span>${money(credit, settings.currency)}${overdueCredit.length ? ` · ${overdueCredit.length} overdue` : ''}</span></div>
          <div class="pos-insight-row"><strong>Recorded expenses</strong><span>${money(operatingExpenses, settings.currency)} · ${changeLabel(operatingExpenses, previousExpenseTotal)}</span></div>
          ${expenseRows.map(([category, amount]) => `<div class="pos-category-row"><strong>${escapeHtml(category)}<small>Expense category</small></strong><b>${money(amount, settings.currency)}</b></div>`).join('')}
          <p class="pos-help">Only manually recorded POS payments and expenses are included.</p>`)}
      </div>`;
    }
    return `<section class="pos-content">
      <div class="pos-overview-controls">
        <nav class="pos-tabs pos-overview-tabs" aria-label="Overview sections">${tabLinks}</nav>
        <nav class="pos-ranges" aria-label="Analytics period">${rangeLinks}</nav>
      </div>
      ${panel}
    </section>`;
  }

  function overviewMetric(label, value, detail) {
    return `<div class="pos-overview-metric"><small>${label}</small><strong>${value}</strong><span>${escapeHtml(detail)}</span></div>`;
  }

  function renderRevenueChart(series, currency) {
    if (!series.length) return '<p class="pos-help">No fully paid sales in this period.</p>';
    const width = 600;
    const height = 220;
    const left = 30;
    const right = 570;
    const top = 16;
    const bottom = 166;
    const max = Math.max(...series.map(([, amount]) => amount), 1);
    const points = series.map(([date, amount], index) => ({
      date,
      amount,
      x: series.length === 1 ? (left + right) / 2 : left + index * (right - left) / (series.length - 1),
      y: bottom - amount / max * (bottom - top)
    }));
    const line = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${bottom} L${points[0].x.toFixed(1)},${bottom} Z`;
    const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
    return `<div class="pos-revenue-chart">
      <div class="pos-revenue-chart-total"><span>Net sales · before tax</span><strong>${money(series.reduce((sum, [, amount]) => sum + amount, 0), currency)}</strong></div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Net sales before tax over time">
        <path class="pos-revenue-chart-area" d="${area}"></path>
        <path class="pos-revenue-chart-line" d="${line}"></path>
        ${points.map(({ x, y }) => `<circle class="pos-revenue-chart-point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"></circle>`).join('')}
        ${points.map(({ x, date }, index) => labelIndexes.has(index)
          ? `<text class="pos-revenue-chart-label" x="${x.toFixed(1)}" y="202" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}">${escapeHtml(date.slice(5))}</text>`
          : '').join('')}
      </svg>
    </div>`;
  }

  function renderProfitChart(series, currency) {
    if (!series.length) return '<p class="pos-help">No fully paid receipts or expenses in this period to chart.</p>';
    const width = 600;
    const height = 220;
    const left = 30;
    const right = 570;
    const top = 16;
    const bottom = 166;
    const values = series.map(([, amount]) => amount);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const spread = max - min || 1;
    const yFor = (amount) => bottom - (amount - min) / spread * (bottom - top);
    const points = series.map(([date, amount], index) => ({
      date,
      amount,
      x: series.length === 1 ? (left + right) / 2 : left + index * (right - left) / (series.length - 1),
      y: yFor(amount)
    }));
    const line = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
    return `<div class="pos-revenue-chart">
      <div class="pos-revenue-chart-total"><span>Recorded operating profit</span><strong>${money(values.reduce((sum, amount) => sum + amount, 0), currency)}</strong></div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Recorded operating profit over time">
        <line class="pos-profit-chart-zero" x1="${left}" y1="${yFor(0).toFixed(1)}" x2="${right}" y2="${yFor(0).toFixed(1)}"></line>
        <path class="pos-revenue-chart-line" d="${line}"></path>
        ${points.map(({ x, y }) => `<circle class="pos-revenue-chart-point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"></circle>`).join('')}
        ${points.map(({ x, date }, index) => labelIndexes.has(index)
          ? `<text class="pos-revenue-chart-label" x="${x.toFixed(1)}" y="202" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}">${escapeHtml(date.slice(5))}</text>`
          : '').join('')}
      </svg>
    </div>`;
  }

  function renderSettings(params = new URLSearchParams()) {
    const setting = state.settings;
    const editingExpense = state.expenses.find((expense) => expense.id === Number(params.get('expense') || 0));
    return `<section class="pos-content">
      ${tabsTitle('POS settings', 'Store currency, tax, expenses and till controls.')}
      ${card(`<h3>Store settings</h3><form class="pos-form" data-pos-form="settings">
        ${field('Tax rate (%)', 'taxRate', setting.taxRate, { type: 'number', min: '0', max: '100', step: '0.01', required: true })}
        ${field('Currency code', 'currency', setting.currency, { required: true, placeholder: 'KES' })}
        <button class="btn-primary" type="submit">Save settings</button></form>`)}
      ${card(`<h3>Bluetooth / USB barcode scanner</h3>
        <p class="pos-help">Optional external barcode scanners type into this field like a keyboard. Pair Bluetooth scanners in your device’s Bluetooth settings or plug in a USB scanner, then focus this field and scan. Scanned products are added to the current sale; open Sell to review and checkout.</p>
        <label class="pos-field"><span>Scan barcode / SKU</span>
          <input type="text" data-pos-barcode-input autocomplete="off" placeholder="Focus here, then scan a product" aria-label="Bluetooth or USB barcode scanner input">
        </label>`)}
      ${card(`<h3>Cloud backup and sync</h3>
        <p class="pos-help">${setting.cloudSyncEnabled
          ? `Cloud backup and sync is enabled for ${escapeHtml(setting.cloudSyncTenantId)}. This device’s POS products, stock, expenses, settings, suppliers, orders, and receipts sync with other registers connected to this shop.`
          : 'Save this device’s POS records to your shop’s cloud account and sync them with your other registers, including the phone app. Your local data stays on this device too. This is separate from the customer-facing online shop.'}</p>
        ${state.cloudSyncError || setting.cloudSyncError
          ? `<p class="pos-help" role="alert">${escapeHtml(state.cloudSyncError || setting.cloudSyncError)}</p>` : ''}
        <div class="pos-form-actions">
          ${button(setting.cloudSyncEnabled ? 'Turn off cloud backup and sync' : 'Enable cloud backup and sync', 'toggle-cloud-sync', '', true)}
          ${setting.cloudSyncEnabled ? button('Save and sync now', 'sync-cloud-now') : ''}
        </div>
        <p class="pos-help">Changes are saved locally first and sent when online. Cloud-connected registers check for updates every few seconds while this app is open. For faster direct live sync, keep a nearby connection open on both registers. Enable this on each register using the same shop. Cloud data includes customer names and phone numbers saved on receipts and supplier contacts.</p>`)}
      ${card(`<h3>Nearby device sync</h3>
        <p class="pos-help">The phone scans this register’s QR once. The PC then asks you to approve the phone before any POS data is sent. Internet is needed briefly to set up the connection; the encrypted POS transfer goes directly over the same Wi-Fi. Transfers can include receipt customer names and phone numbers. Only approve a register you trust; both registers must select the same shop.</p>
        <p class="pos-help" role="status" aria-live="polite" data-nearby-sync-status>${escapeHtml(state.nearbySyncStatus || 'Choose Create pairing QR on the PC, then scan it once with the phone.')}</p>
        <div class="pos-form-actions">
          ${window.Capacitor?.getPlatform?.() === 'android' ? `${button('Receive over Bluetooth', 'nearby-bt-host', '', true)}
          ${button('Find a Bluetooth register', 'nearby-bt-find')}` : ''}
          ${button('Create pairing QR', 'nearby-sync-create', '', true)}
          ${button('Scan pairing QR', 'nearby-sync-join')}
          ${button('End nearby sync', 'nearby-sync-stop')}
        </div>
        <p class="pos-help">Keep both registers open to stay connected. While connected, saved changes transfer automatically in seconds; closing either register ends nearby live sync. For syncing while a register is closed or away, enable Cloud backup and sync above.</p>`)}
      ${card(`<h3>${editingExpense ? 'Edit expense' : 'Record an expense'}</h3><form class="pos-form" data-pos-form="expense">
        <input type="hidden" name="id" value="${editingExpense?.id || 0}">
        ${field('Date', 'date', editingExpense?.expense_date || today(), { type: 'date', required: true })}
        ${field('Category', 'category', editingExpense?.category || '', { required: true, placeholder: 'Rent, transport, supplies' })}
        ${field('Description', 'label', editingExpense?.label || '', { required: true })}
        ${field('Amount', 'amount', editingExpense ? fromCents(editingExpense.amount_cents) : '', { type: 'number', min: '0.01', step: '0.01', required: true })}
        ${select('Paid by', 'paymentMethod', [...PAYMENT_METHODS, 'Unknown'].map((item) => [item, item]), editingExpense?.payment_method || 'Cash')}
        ${field('Note', 'note', editingExpense?.note || '')}<div class="pos-form-actions"><button class="btn-primary">${editingExpense ? 'Update expense' : 'Save expense'}</button>
          ${editingExpense ? '<a href="/pos/settings" data-route="/pos/settings" class="btn-secondary">Cancel</a>' : ''}</div></form>`)}
      ${card(`<h3>Recent expenses</h3>${state.expenses.slice(0,20).map((item) => `<div class="pos-category-row">
        <strong>${escapeHtml(item.label)}<small>${escapeHtml(item.category)} · ${escapeHtml(item.expense_date)}</small></strong>
        <span>${escapeHtml(item.payment_method)}</span><b>${money(fromCents(item.amount_cents), item.currency)}</b>
        ${button('Edit', 'edit-expense', `data-id="${item.id}"`, true)}
        ${button('Delete', 'delete-expense', `data-id="${item.id}"`, true)}</div>`).join('') || '<p class="pos-help">No expenses recorded yet.</p>'}`)}
      ${card(`<h3>Cash drawer</h3>
        <form class="pos-form" data-pos-form="movement">
          ${select('Movement', 'type', [['float_in','Float in'],['bank_drop','Bank drop'],['petty_out','Petty cash out']], 'float_in')}
          ${field('Amount', 'amount', '', { type: 'number', min: '0.01', step: '0.01', required: true })}
          ${field('Note', 'note', '')}<button class="btn-secondary">Record movement</button></form>
        ${state.cashMovements.length ? `<h4>Recent movements</h4>${state.cashMovements.map((movement) =>
          `<div class="pos-category-row"><strong>${escapeHtml(movement.movement_type.replace('_', ' '))}<small>${new Date(movement.created_at).toLocaleString()} · ${escapeHtml(movement.note || '')}</small></strong>
            <b>${money(fromCents(movement.amount_cents), movement.currency)}</b></div>`).join('')}` : ''}
        <form class="pos-form" data-pos-form="till"><h4>Close till</h4>
          ${field('Date', 'date', today(), { type: 'date', required: true })}
          ${field('Counted cash', 'countedCash', '', { type: 'number', min: '0', step: '0.01', required: true })}
          <button class="btn-primary">Save till close</button></form>
        <h4>Recent till closes</h4>${state.tillCloses.map((item) => `<div class="pos-category-row"><strong>${escapeHtml(item.close_date)}</strong>
          <span>Expected ${money(fromCents(item.expected_cash_cents), item.currency)}</span><b>Difference ${money(fromCents(item.difference_cents), item.currency)}</b></div>`).join('') || '<p class="pos-help">No till closes saved.</p>'}`)}
    </section>`;
  }

  function elapsed(startedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  async function refresh() {
    const path = (window.location.hash || '#/pos').slice(1).split('?')[0] || '/pos';
    const params = new URLSearchParams((window.location.hash || '').split('?')[1] || '');
    if (!path.startsWith('/pos')) return;
    await loadState();
    const app = document.getElementById('app');
    if (app) app.innerHTML = render(path, params);
  }

  async function loadState() {
    const [products, categories, settings, sales, invoices, instances, expenses, cash, closes, payments,
      sharedTenant, queuedEvents, queueError] = await Promise.all([
      listProducts(), listCategories(), getSettings(), listSales(), listInvoices(), listInstances(),
      rows('SELECT * FROM pos_expenses ORDER BY expense_date DESC,id DESC'),
      rows('SELECT * FROM pos_cash_movements ORDER BY created_at DESC LIMIT 30'),
      rows('SELECT * FROM pos_till_closes ORDER BY close_date DESC,id DESC LIMIT 20'),
      rows(`SELECT p.amount_cents,p.method,p.created_at,s.currency FROM pos_sale_payments p
        JOIN pos_sales s ON s.id=p.sale_id WHERE p.status='confirmed'`),
      rows("SELECT value FROM pos_settings WHERE key='shared_tenant_id'"),
      rows("SELECT COUNT(*) AS count FROM pos_inventory_queue WHERE status!='synced'"),
      rows("SELECT last_error FROM pos_inventory_queue WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1")
    ]);
    state.products = products;
    state.categories = categories;
    state.settings = settings;
    state.sales = sales;
    state.cloudScopeId = settings.cloudSyncTenantId
      || window.EshopInventoryBridge?.activeWebsiteId?.() || 'local';
    [state.suppliers, state.purchases, state.tickets, state.cloudSales] = await Promise.all([
      listBusinessRecords('supplier', state.cloudScopeId), listBusinessRecords('purchase', state.cloudScopeId),
      listBusinessRecords('ticket', state.cloudScopeId), listBusinessRecords('sale', state.cloudScopeId)
    ]);
    state.cloudSyncError = settings.cloudSyncError;
    state.invoices = invoices;
    state.instances = instances;
    state.expenses = expenses;
    state.cashMovements = cash;
    state.tillCloses = closes;
    state.payments = payments;
    state.sharedTenantId = sharedTenant[0]?.value || '';
    state.pendingInventoryEvents = Number(queuedEvents[0]?.count || 0);
    state.inventorySyncError = queueError[0]?.last_error || '';
    if (state.sharedTenantId && window.EshopInventoryBridge?.hasTenantOwnerKey?.(state.sharedTenantId) === false) {
      state.inventorySyncError = '';
    }
    const summaries = await Promise.all(instances.map(async (instance) =>
      [instance.id, await instanceTotals(instance, settings.currency)]));
    state.instanceSummaries = new Map(summaries);
  }

  async function queueCloudRecord(entity, recordId, payload, deleted = false, serverRevision = 0) {
    await saveBusinessRecord(entity, recordId, payload, deleted, serverRevision, state.cloudScopeId);
    await sendNearbyChange({
      entity, record_id: String(recordId), payload, deleted,
      revision: Number(serverRevision) || 0, changed_at: nowIso()
    });
    if (state.settings?.cloudSyncEnabled) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = setTimeout(() => {
        void syncCloudBusinessRecords().catch((error) => {
          state.cloudSyncError = error instanceof Error ? error.message : 'Cloud sync failed.';
        });
      }, 300);
    }
  }

  async function stableRecordId(prefix, value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return `${prefix}-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  async function queueProduct(product, deleted = false) {
    if (!product || !Number.isSafeInteger(Number(product.id)) || Number(product.id) <= 0) {
      throw new Error('This product needs a saved product ID before it can sync.');
    }
    if (!product.sku) {
      let sku = '';
      while (!sku) {
        const candidate = createSku();
        const existing = (await rows('SELECT id FROM pos_products WHERE sku=? LIMIT 1', [candidate]))[0];
        if (!existing) sku = candidate;
      }
      await run('UPDATE pos_products SET sku=? WHERE id=? AND (sku IS NULL OR sku=?)', [sku, Number(product.id), '']);
      const updated = (await rows('SELECT sku FROM pos_products WHERE id=?', [Number(product.id)]))[0]?.sku;
      if (!updated) throw new Error(`Could not assign a sync SKU to ${product.name || 'a product'}.`);
      product.sku = updated;
    }
    const recordId = await stableRecordId('PRODUCT', product.sku);
    const imageUri = /^https?:\/\//i.test(product.imageUri || '') ? product.imageUri : '';
    const { imageEmbedding, imageEmbeddingHex, ...syncProduct } = product;
    await queueCloudRecord('product', recordId, { ...syncProduct, imageUri }, deleted);
  }

  async function queueCategory(category, deleted = false) {
    if (!category?.name) return;
    const recordId = await stableRecordId('CATEGORY', category.name.trim().toLocaleLowerCase());
    await queueCloudRecord('category', recordId, { name: category.name.trim() }, deleted);
  }

  async function queueExpense(expense, deleted = false) {
    if (!expense?.sync_key) throw new Error('This expense is missing its sync identity; edit and save it again.');
    await queueCloudRecord('expense', expense.sync_key, {
      expenseDate: expense.expense_date,
      category: expense.category,
      label: expense.label,
      amountCents: Number(expense.amount_cents),
      currency: expense.currency,
      paymentMethod: expense.payment_method,
      note: expense.note || '',
      createdAt: expense.created_at
    }, deleted);
  }

  async function queueSettings() {
    const settings = await getSettings();
    await queueCloudRecord('setting', 'settings', {
      taxRate: settings.taxRate,
      currency: settings.currency,
      monthlyRevenueGoal: settings.monthlyRevenueGoal,
      monthlyRevenueGoalCurrency: settings.monthlyRevenueGoalCurrency
    });
  }

  async function seedCatalogueSync() {
    for (const category of await listCategories()) await queueCategory(category);
    for (const product of await listProducts()) await queueProduct(product);
    for (const expense of await listExpenses()) await queueExpense(expense);
    await queueSettings();
  }

  async function seedCloudCatalogueForTenant(tenantId) {
    const seedKey = `cloud_catalogue_seeded:${tenantId}`;
    const seeded = (await rows('SELECT value FROM pos_settings WHERE key=?', [seedKey]))[0]?.value;
    if (seeded === '1') return;
    await seedCatalogueSync();
    for (const sale of await listSales()) {
      await saveBusinessRecord('sale', sale.receipt_number, sale, false, 0, tenantId);
    }
    await run('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', [seedKey, '1']);
  }

  async function applyRemoteChange(change) {
    const payload = change.payload;
    if (change.entity === 'category') {
      const category = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(payload.name || '').toLocaleLowerCase());
      if (change.deleted) {
        if (category && category.name.toLocaleLowerCase() !== 'other') {
          const products = await listProducts();
          const fallback = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === 'other');
          const statements = products.filter((item) => item.categoryId === category.id && fallback)
            .map((item) => stmt('UPDATE pos_products SET category_id=? WHERE id=?', [fallback.id, item.id]));
          statements.push(stmt('DELETE FROM pos_categories WHERE id=?', [category.id]));
          await transaction(statements);
        }
      } else if (!category) {
        await addCategory(payload.name);
      }
      return;
    }
    if (change.entity === 'product') {
      const product = (await listProducts()).find((item) => item.sku === payload.sku);
      if (change.deleted) {
        if (product) await run('DELETE FROM pos_products WHERE id=?', [product.id]);
        return;
      }
      let category = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(payload.categoryName || '').toLocaleLowerCase());
      if (!category) {
        await addCategory(payload.categoryName || 'Other');
        category = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(payload.categoryName || 'Other').toLocaleLowerCase());
      }
      if (!category) throw new Error('Could not restore a synced product category.');
      const values = [payload.name, category.id, toCents(payload.price), payload.buyingPrice == null ? null : toCents(payload.buyingPrice),
        payload.stock == null ? null : Number(payload.stock), payload.sku, payload.barcode || product?.barcode || null,
        payload.expiryDate || product?.expiryDate || null,
        String(payload.imageUri || '').slice(0, 200_000),
        Number(payload.lowStockThreshold) || 0, payload.active === false ? 0 : 1];
      if (product) {
        await run(`UPDATE pos_products SET name=?,category_id=?,price_cents=?,buying_price_cents=?,stock_count=?,sku=?,barcode=?,expiry_date=?,image_uri=?,
          low_stock_threshold=?,active=? WHERE id=?`, [...values, product.id]);
      } else {
        await run(`INSERT INTO pos_products (name,category_id,price_cents,buying_price_cents,stock_count,sku,barcode,expiry_date,image_uri,
          low_stock_threshold,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [...values, nowIso()]);
      }
      return;
    }
    if (change.entity === 'expense') {
      const current = (await rows('SELECT id FROM pos_expenses WHERE sync_key=?', [change.record_id]))[0];
      if (change.deleted) {
        if (current) await run('DELETE FROM pos_expenses WHERE id=?', [current.id]);
        return;
      }
      const values = [payload.expenseDate, payload.category, payload.label, Number(payload.amountCents),
        payload.currency, payload.paymentMethod, payload.note || ''];
      if (current) {
        await run(`UPDATE pos_expenses SET expense_date=?,category=?,label=?,amount_cents=?,currency=?,payment_method=?,note=? WHERE id=?`,
          [...values, current.id]);
      } else {
        await run(`INSERT INTO pos_expenses (sync_key,expense_date,category,label,amount_cents,currency,payment_method,note,created_at)
          VALUES (?,?,?,?,?,?,?,?,?)`, [change.record_id, ...values, payload.createdAt || nowIso()]);
      }
      return;
    }
    if (change.entity === 'setting') {
      await saveSettings(payload.taxRate, payload.currency);
      if (payload.monthlyRevenueGoal && payload.monthlyRevenueGoalCurrency) {
        await transaction([
          stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)',
            ['monthly_revenue_goal_cents', String(payload.monthlyRevenueGoal)]),
          stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)',
            ['monthly_revenue_goal_currency', payload.monthlyRevenueGoalCurrency])
        ]);
      } else {
        await transaction([
          stmt("DELETE FROM pos_settings WHERE key='monthly_revenue_goal_cents'", []),
          stmt("DELETE FROM pos_settings WHERE key='monthly_revenue_goal_currency'", [])
        ]);
      }
      return;
    }
    if (!['supplier', 'purchase', 'ticket', 'sale'].includes(change.entity)) {
      throw new Error('Cloud sync returned an unsupported business record.');
    }
    const payloadJson = JSON.stringify(payload);
    await run(`INSERT INTO pos_business_records
      (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
      payload_json=excluded.payload_json,deleted=excluded.deleted,
      server_revision=excluded.server_revision,updated_at=excluded.updated_at
      WHERE excluded.server_revision > pos_business_records.server_revision
        OR excluded.updated_at > pos_business_records.updated_at`,
    [state.cloudScopeId, change.entity, change.record_id, payloadJson, change.deleted ? 1 : 0,
      Number(change.revision) || 0, change.changed_at || nowIso()]);
  }

  async function syncCloudBusinessRecords() {
    if (cloudSyncInProgress || navigator.onLine === false || !state.settings?.cloudSyncEnabled) return;
    const tenantId = state.settings.cloudSyncTenantId;
    const bridge = window.EshopInventoryBridge;
    if (!tenantId || typeof bridge?.syncPosRecords !== 'function') return;
    cloudSyncInProgress = true;
    try {
      await seedCloudCatalogueForTenant(tenantId);
      let deviceId = (await rows("SELECT value FROM pos_settings WHERE key='cloud_sync_device_id'"))[0]?.value;
      if (!deviceId) {
        deviceId = `device-${crypto.randomUUID().replace(/-/g, '')}`;
        await run("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_device_id',?)", [deviceId]);
      }
      const pending = await rows(`SELECT change_id,entity,record_id,payload_json,deleted,created_at
        FROM pos_cloud_outbox WHERE tenant_id=? ORDER BY created_at LIMIT 100`, [tenantId]);
      for (let offset = 0; offset < pending.length; offset += 25) {
        const batch = pending.slice(offset, offset + 25);
        await bridge.syncPosRecords(tenantId, 'POST', {
          changes: batch.map((change) => ({
            change_id: change.change_id, device_id: deviceId, entity: change.entity,
            record_id: change.record_id, payload: JSON.parse(change.payload_json),
            deleted: change.deleted === 1, changed_at: change.created_at
          }))
        });
        await transaction(batch.map((change) =>
          stmt('DELETE FROM pos_cloud_outbox WHERE change_id=? AND tenant_id=?', [change.change_id, tenantId])));
      }
      const cursorKey = `cloud_sync_cursor:${tenantId}`;
      const cursor = Number((await rows('SELECT value FROM pos_settings WHERE key=?', [cursorKey]))[0]?.value || 0);
      let pageCursor = cursor;
      let latestRevision = cursor;
      let pagesRead = 0;
      let pageLength = 0;
      const latestChanges = new Map();
      do {
        const result = await bridge.syncPosRecords(tenantId, 'GET', { after: pageCursor, limit: 500 });
        if (!Array.isArray(result.changes) || !Number.isSafeInteger(Number(result.latest_revision))) {
          throw new Error('Cloud sync returned an invalid change list.');
        }
        latestRevision = Math.max(latestRevision, Number(result.latest_revision));
        pageLength = result.changes.length;
        for (const change of result.changes) {
          const revision = Number(change.revision) || 0;
          pageCursor = Math.max(pageCursor, revision);
          const key = `${change.entity}\u0000${change.record_id}`;
          const previous = latestChanges.get(key);
          if (!previous || revision > Number(previous.revision)) latestChanges.set(key, change);
        }
        pagesRead++;
      } while (pageCursor < latestRevision && pageLength === 500 && pagesRead < 20);

      for (const change of latestChanges.values()) {
        if (change.device_id === deviceId) continue;
        if (!['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'].includes(change.entity)
          || typeof change.record_id !== 'string' || !change.payload || typeof change.payload !== 'object') {
          throw new Error('Cloud sync returned an invalid business record.');
        }
        const hasLocalPending = (await rows(`SELECT change_id FROM pos_cloud_outbox
          WHERE tenant_id=? AND entity=? AND record_id=? LIMIT 1`,
        [tenantId, change.entity, change.record_id])).length > 0;
        if (hasLocalPending) continue;
        await applyRemoteChange(change);
        const payloadJson = JSON.stringify(change.payload);
        await run(`INSERT INTO pos_business_records
          (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
          payload_json=excluded.payload_json,deleted=excluded.deleted,
          server_revision=excluded.server_revision,updated_at=excluded.updated_at
          WHERE excluded.server_revision > pos_business_records.server_revision
            OR excluded.updated_at > pos_business_records.updated_at`,
        [tenantId, change.entity, change.record_id, payloadJson, change.deleted ? 1 : 0,
          Number(change.revision) || 0, change.changed_at || nowIso()]);
        await sendNearbyChange({
          entity: change.entity, record_id: change.record_id, payload: change.payload,
          deleted: Boolean(change.deleted), revision: Number(change.revision) || 0,
          changed_at: change.changed_at || nowIso()
        });
      }
      if (pageCursor > cursor) await run('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', [cursorKey, String(pageCursor)]);
      state.cloudSyncError = '';
      await transaction([
        stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", []),
        stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)", [`cloud_sync_last_sync:${tenantId}`, nowIso()])
      ]);
    } catch (error) {
      state.cloudSyncError = error instanceof Error ? error.message : 'Cloud sync failed.';
      await run("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_error',?)",
        [state.cloudSyncError]);
      throw error;
    } finally {
      cloudSyncInProgress = false;
      window.EshopInventoryBridge?.onPosSyncStatusChanged?.();
    }
  }

  async function getCloudSyncStatus() {
    const settings = await getSettings();
    const tenantId = settings.cloudSyncTenantId;
    const pending = tenantId
      ? Number((await rows('SELECT COUNT(*) AS count FROM pos_cloud_outbox WHERE tenant_id=?', [tenantId]))[0]?.count || 0)
      : 0;
    const lastSync = tenantId
      ? (await rows('SELECT value FROM pos_settings WHERE key=?', [`cloud_sync_last_sync:${tenantId}`]))[0]?.value || ''
      : '';
    return { enabled: settings.cloudSyncEnabled, tenant: tenantId, pending, lastSync, error: settings.cloudSyncError };
  }

  async function syncCloudNow() {
    await syncCloudBusinessRecords();
    if (state.cloudSyncError) throw new Error(state.cloudSyncError);
    await refresh();
  }

  async function disconnectCloudSync() {
    clearTimeout(cloudSyncTimer);
    await transaction([
      stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_enabled','0')", []),
      stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
    ]);
    state.settings = await getSettings();
    state.cloudSyncError = '';
    await refresh();
  }

  async function switchCloudSyncTenant(tenantId) {
    if (!/^[a-z0-9-]{1,80}$/.test(tenantId)
      || typeof window.EshopInventoryBridge?.syncPosRecords !== 'function'
      || window.EshopInventoryBridge.activeWebsiteId?.() !== tenantId) {
      throw new Error('Connect this register to the shop you want to sync first.');
    }
    await window.EshopInventoryBridge.syncPosRecords(tenantId, 'GET', { after: 0, limit: 1 });
    await transaction([
      stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', ['cloud_sync_tenant_id', tenantId]),
      stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', [`cloud_catalogue_seeded:${tenantId}`, '1']),
      stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
    ]);
    state.settings = await getSettings();
    state.cloudScopeId = tenantId;
    await syncCloudBusinessRecords();
    if (state.cloudSyncError) throw new Error(state.cloudSyncError);
    await refresh();
  }

  async function replaceWithCloudShop(tenantId) {
    if (!/^[a-z0-9-]{1,80}$/.test(tenantId)
      || typeof window.EshopInventoryBridge?.syncPosRecords !== 'function'
      || window.EshopInventoryBridge.activeWebsiteId?.() !== tenantId) {
      throw new Error('Connect this browser to the shop you want to use first.');
    }
    if (cloudSyncInProgress) throw new Error('Cloud sync is already running. Wait for it to finish, then try again.');

    const latestChanges = new Map();
    let cursor = 0;
    let latestRevision = 0;
    let pageLength = 0;
    let pagesRead = 0;
    do {
      const result = await window.EshopInventoryBridge.syncPosRecords(tenantId, 'GET', { after: cursor, limit: 500 });
      if (!Array.isArray(result.changes) || !Number.isSafeInteger(Number(result.latest_revision))) {
        throw new Error('The shop returned an invalid POS record list. Browser data has not been changed.');
      }
      latestRevision = Math.max(latestRevision, Number(result.latest_revision));
      pageLength = result.changes.length;
      for (const change of result.changes) {
        if (!change || !['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'].includes(change.entity)
          || typeof change.record_id !== 'string' || !change.payload || typeof change.payload !== 'object'
          || Array.isArray(change.payload) || !Number.isSafeInteger(Number(change.revision))) {
          throw new Error('The shop returned a malformed POS record. Browser data has not been changed.');
        }
        cursor = Math.max(cursor, Number(change.revision));
        const key = `${change.entity}\u0000${change.record_id}`;
        const previous = latestChanges.get(key);
        if (!previous || Number(change.revision) > Number(previous.revision)) latestChanges.set(key, change);
      }
      pagesRead += 1;
    } while (cursor < latestRevision && pageLength === 500 && pagesRead < 20);
    if (cursor < latestRevision) {
      throw new Error('The shop has more than 10,000 POS changes. Browser data has not been changed; sync through Cloudflare first.');
    }
    if (cloudSyncInProgress) throw new Error('Cloud sync started while preparing the replacement. Browser data has not been changed; wait and retry.');

    const orderedChanges = [...latestChanges.values()].sort((left, right) => {
      const priority = (entity) => entity === 'category' ? 0 : entity === 'product' ? 1 : 2;
      return priority(left.entity) - priority(right.entity) || Number(left.revision) - Number(right.revision);
    });
    clearTimeout(cloudSyncTimer);
    cloudSyncInProgress = true;
    state.cloudSyncError = '';
    try {
      await transaction([
        stmt('DELETE FROM shared_inventory_event_items', []),
        stmt('DELETE FROM shared_inventory_events', []),
        stmt('DELETE FROM shared_inventory', []),
        stmt('DELETE FROM pos_inventory_queue', []),
        stmt('DELETE FROM pos_invoice_items', []),
        stmt('DELETE FROM pos_invoices', []),
        stmt('DELETE FROM pos_sale_payments', []),
        stmt('DELETE FROM pos_sale_items', []),
        stmt('DELETE FROM pos_sales', []),
        stmt('DELETE FROM pos_cash_movements', []),
        stmt('DELETE FROM pos_till_closes', []),
        stmt('DELETE FROM pos_instances', []),
        stmt('DELETE FROM pos_expenses', []),
        stmt('DELETE FROM pos_products', []),
        stmt('DELETE FROM pos_categories', []),
        stmt('DELETE FROM pos_business_records', []),
        stmt('DELETE FROM pos_cloud_outbox', []),
        stmt('DELETE FROM pos_settings', []),
        stmt("INSERT INTO pos_categories (name) VALUES ('Other')", []),
        stmt("INSERT INTO pos_settings (key,value) VALUES ('currency','KES'),('tax_rate','0'),('cloud_sync_tenant_id',?),('cloud_sync_enabled','1'),(?, '1')",
          [tenantId, `cloud_catalogue_seeded:${tenantId}`])
      ]);
      state.cloudScopeId = tenantId;
      state.settings = await getSettings();
      for (const change of orderedChanges) {
        await applyRemoteChange(change);
        await run(`INSERT INTO pos_business_records
          (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
          payload_json=excluded.payload_json,deleted=excluded.deleted,
          server_revision=excluded.server_revision,updated_at=excluded.updated_at`,
        [tenantId, change.entity, change.record_id, JSON.stringify(change.payload),
          change.deleted ? 1 : 0, Number(change.revision), change.changed_at || nowIso()]);
      }
      await transaction([
        stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)", [`cloud_sync_cursor:${tenantId}`, String(cursor)]),
        stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)", [`cloud_sync_last_sync:${tenantId}`, nowIso()]),
        stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
      ]);
      state.settings = await getSettings();
      await refresh();
      return { imported: orderedChanges.length };
    } catch (error) {
      state.cloudSyncError = error instanceof Error ? error.message : 'Could not replace browser POS data from the shop.';
      await run("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_error',?)", [state.cloudSyncError]);
      await refresh();
      throw error;
    } finally {
      cloudSyncInProgress = false;
      window.EshopInventoryBridge?.onPosSyncStatusChanged?.();
    }
  }

  function setNearbySyncStatus(message) {
    state.nearbySyncStatus = message;
    const status = document.querySelector('[data-nearby-sync-status]');
    if (status) status.textContent = message;
  }

  function nearbyLocalDeviceName() {
    return window.Capacitor?.getPlatform?.() === 'android' ? 'Android phone' : 'Browser register';
  }

  function nearbyConnectedStatus(detail = '') {
    const peerName = nearbyRemoteName || 'nearby register';
    const lastUpdate = nearbyLastSyncAt ? ` · Last update ${nearbyLastSyncAt}` : '';
    setNearbySyncStatus(`Connected to ${peerName} · Live sync on${lastUpdate}${detail ? ` · ${detail}` : ''}`);
  }

  async function sendNearbyChange(change) {
    if (!nearbyChannel || nearbyChannel.readyState !== 'open') return;
    const key = `${change.entity}\u0000${change.record_id}`;
    nearbyPendingChanges.set(key, change);
    if (!nearbyReady) return;
    try {
      await flushNearbyChanges();
    } catch (error) {
      nearbyConnectedStatus(`Live update waiting to retry (${error.message || 'connection issue'})`);
    }
  }

  async function flushNearbyChanges() {
    if (!nearbyReady || nearbyChannel?.readyState !== 'open' || nearbyPendingChanges.size === 0) return;
    const changes = [...nearbyPendingChanges.entries()];
    nearbyPendingChanges.clear();
    for (let index = 0; index < changes.length; index += 1) {
      const [key, change] = changes[index];
      try {
        nearbyChannel.send(JSON.stringify({ type: 'record-change', tenant_id: state.cloudScopeId, change }));
      } catch (error) {
        for (const [pendingKey, pendingChange] of changes.slice(index)) {
          nearbyPendingChanges.set(pendingKey, pendingChange);
        }
        throw error;
      }
    }
  }

  async function markNearbyReady(detail = '') {
    nearbyReady = true;
    nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    nearbyConnectedStatus(detail);
    await flushNearbyChanges();
  }

  async function applyNearbyChange(change) {
    const supported = ['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'];
    if (!change || !supported.includes(change.entity) || typeof change.record_id !== 'string'
      || !change.payload || typeof change.payload !== 'object' || Array.isArray(change.payload)) {
      throw new Error('Nearby sync received a malformed business record.');
    }
    const current = (await rows(`SELECT payload_json,deleted,updated_at FROM pos_business_records
      WHERE tenant_id=? AND entity=? AND record_id=? LIMIT 1`,
    [state.cloudScopeId, change.entity, change.record_id]))[0];
    const payloadJson = JSON.stringify(change.payload);
    if (current && current.payload_json === payloadJson
      && Number(current.deleted) === (change.deleted ? 1 : 0)) return false;
    const currentTime = Date.parse(current?.updated_at || '') || 0;
    const incomingTime = Date.parse(change.changed_at || '') || 0;
    if (current && incomingTime && currentTime >= incomingTime) return false;
    await applyRemoteChange(change);
    await saveBusinessRecord(change.entity, change.record_id, change.payload, Boolean(change.deleted),
      Number(change.revision) || 0, state.cloudScopeId);
    await run(`DELETE FROM pos_cloud_outbox WHERE tenant_id=? AND entity=? AND record_id=?`,
      [state.cloudScopeId, change.entity, change.record_id]);
    return true;
  }

  async function createNearbySnapshot() {
    const tenantId = state.cloudScopeId;
    if (!tenantId || tenantId === 'local') {
      throw new Error('Choose a shop in Studio on both devices before pairing them.');
    }
    await seedCatalogueSync();
    for (const sale of await listSales()) {
      await saveBusinessRecord('sale', sale.receipt_number, sale, false, 0, tenantId);
    }
    const stored = await rows(`SELECT entity,record_id,payload_json,deleted,server_revision,updated_at
      FROM pos_business_records WHERE tenant_id=? ORDER BY entity,record_id`, [tenantId]);
    if (stored.length > 10000) throw new Error('This register has too many records for one nearby sync. Sync to Cloudflare first.');
    const records = stored.map((record) => {
      let payload;
      try {
        payload = JSON.parse(record.payload_json);
      } catch {
        throw new Error(`Saved ${record.entity} record ${record.record_id} is invalid and cannot be transferred.`);
      }
      return {
        entity: record.entity, record_id: record.record_id, payload,
        deleted: record.deleted === 1, revision: Number(record.server_revision) || 0,
        changed_at: record.updated_at
      };
    });
    return { tenant_id: tenantId, records };
  }

  async function sendNearbySnapshot(channel, purpose = 'initial') {
    if (channel.readyState !== 'open') throw new Error('Nearby device connection closed before sync started.');
    const snapshot = await createNearbySnapshot();
    const text = JSON.stringify(snapshot);
    if (new TextEncoder().encode(text).byteLength > 6 * 1024 * 1024) {
      throw new Error('Nearby sync is larger than the 6 MB transfer limit. Sync to Cloudflare first.');
    }
    const chunks = text.match(/[\s\S]{1,8000}/gu) || [];
    if (!chunks.length || chunks.length > 1000) throw new Error('Nearby sync exceeds the safe chunk limit. Sync to Cloudflare first.');
    const transferId = crypto.randomUUID();
    const send = async (message) => {
      while (channel.bufferedAmount > 256 * 1024 && channel.readyState === 'open') {
        await new Promise((resolve) => window.setTimeout(resolve, 30));
      }
      if (channel.readyState !== 'open') throw new Error('Nearby device connection closed during sync.');
      await channel.send(JSON.stringify(message));
    };
    await send({
      type: 'snapshot-start', transfer_id: transferId, tenant_id: snapshot.tenant_id,
      chunks: chunks.length, purpose
    });
    for (let index = 0; index < chunks.length; index += 1) {
      await send({ type: 'snapshot-chunk', transfer_id: transferId, index, content: chunks[index] });
    }
    setNearbySyncStatus(`Sent ${snapshot.records.length} records. Waiting for the other register to apply them…`);
  }

  async function applyNearbySnapshot(snapshot) {
    if (!snapshot || snapshot.tenant_id !== state.cloudScopeId || !Array.isArray(snapshot.records)
      || snapshot.records.length > 10000) {
      throw new Error('The nearby device belongs to a different shop or sent an invalid record set.');
    }
    let applied = 0;
    for (const change of snapshot.records) {
      if (await applyNearbyChange(change)) applied += 1;
    }
    await loadState();
    return applied;
  }

  async function handleNearbyMessage(channel, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      throw new Error('Nearby register sent an unreadable sync message.');
    }
    if (message.type === 'snapshot-start') {
      if (message.tenant_id !== state.cloudScopeId || !Number.isSafeInteger(message.chunks)
        || message.chunks < 1 || message.chunks > 1000 || typeof message.transfer_id !== 'string') {
        throw new Error('Nearby register sent invalid pairing data.');
      }
      nearbyIncoming = {
        transferId: message.transfer_id, tenantId: message.tenant_id,
        parts: new Array(message.chunks), received: 0, purpose: message.purpose || 'initial'
      };
      setNearbySyncStatus(`Receiving nearby POS data (${message.chunks} parts)…`);
      return;
    }
    if (message.type === 'snapshot-chunk') {
      if (!nearbyIncoming || message.transfer_id !== nearbyIncoming.transferId
        || !Number.isSafeInteger(message.index) || message.index < 0 || message.index >= nearbyIncoming.parts.length
        || typeof message.content !== 'string' || message.content.length > 8000) {
        throw new Error('Nearby register sent an invalid data chunk.');
      }
      if (nearbyIncoming.parts[message.index] === undefined) {
        nearbyIncoming.parts[message.index] = message.content;
        nearbyIncoming.received += 1;
        if (nearbyIncoming.received === nearbyIncoming.parts.length
          || nearbyIncoming.received % 20 === 0) {
          setNearbySyncStatus(`Receiving nearby POS data (${nearbyIncoming.received}/${nearbyIncoming.parts.length} parts)…`);
        }
      }
      if (nearbyIncoming.received === nearbyIncoming.parts.length) {
        const transfer = nearbyIncoming;
        nearbyIncoming = null;
        const snapshot = JSON.parse(transfer.parts.join(''));
        const count = await applyNearbySnapshot(snapshot);
        channel.send(JSON.stringify({ type: 'snapshot-ack', count, purpose: transfer.purpose }));
        if (transfer.purpose === 'initial') {
          if (nearbyRole === 'guest') {
            setNearbySyncStatus(`Connected to ${nearbyRemoteName || 'nearby register'}. Waiting for the first register…`);
          } else {
            await markNearbyReady(`${count} records received`);
          }
        } else {
          await markNearbyReady(`${count} records received`);
        }
        await refresh();
      }
      return;
    }
    if (message.type === 'snapshot-ack') {
      if (message.purpose === 'initial' && nearbyRole === 'host') {
        setNearbySyncStatus(`Initial records received. Getting the other register’s records…`);
        channel.send(JSON.stringify({ type: 'snapshot-request' }));
      } else if (message.purpose === 'initial-response') {
        await markNearbyReady(`${Number(message.count) || 0} records received`);
      } else {
        nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        nearbyConnectedStatus('Change delivered');
      }
      await refresh();
      return;
    }
    if (message.type === 'snapshot-request') {
      await sendNearbySnapshot(channel, 'initial-response');
      return;
    }
    if (message.type === 'hello') {
      nearbyRemoteName = typeof message.device_name === 'string' ? message.device_name.slice(0, 60) : 'nearby register';
      if (nearbyReady) nearbyConnectedStatus();
      return;
    }
    if (message.type === 'record-change') {
      if (!nearbyReady || message.tenant_id !== state.cloudScopeId) {
        throw new Error('A live update arrived from a different shop or before pairing finished.');
      }
      const applied = await applyNearbyChange(message.change);
      nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      nearbyConnectedStatus(applied ? 'New change received' : 'Already up to date');
      if (applied) await refresh();
      channel.send(JSON.stringify({
        type: 'record-change-ack',
        entity: message.change.entity,
        record_id: message.change.record_id
      }));
      return;
    }
    if (message.type === 'record-change-ack') {
      nearbyLastSyncAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      nearbyConnectedStatus('Change delivered');
      return;
    }
    throw new Error('Nearby register sent an unsupported sync message.');
  }

  function attachNearbyChannel(channel, alreadyOpen = false) {
    nearbyChannel = channel;
    const onopen = () => {
      nearbyReady = false;
      nearbyRemoteName = '';
      channel.send(JSON.stringify({ type: 'hello', device_name: nearbyLocalDeviceName() }));
      setNearbySyncStatus('Connection open. Checking shop records before live sync…');
      if (nearbyRole === 'host') {
        void sendNearbySnapshot(channel, 'initial').catch((error) => setNearbySyncStatus(error.message || 'Nearby sync failed.'));
      }
    };
    channel.onopen = onopen;
    channel.onmessage = (event) => {
      void handleNearbyMessage(channel, event.data).catch((error) => {
        setNearbySyncStatus(error.message || 'Nearby sync failed.');
      });
    };
    channel.onclose = () => {
      nearbyReady = false;
      nearbyPendingChanges.clear();
      setNearbySyncStatus('Nearby device disconnected. Live sync is off.');
    };
    channel.onerror = () => {
      nearbyReady = false;
      setNearbySyncStatus('Nearby device connection failed. Live sync is off.');
    };
    if (alreadyOpen) onopen();
  }

  async function clearNearbyBluetoothListeners() {
    const listeners = nearbyBluetoothListeners;
    nearbyBluetoothListeners = [];
    await Promise.all(listeners.map((listener) => listener.remove()));
  }

  async function connectNearbyBluetoothChannel() {
    if (nearbyChannel?.readyState === 'open') return;
    const channel = {
      readyState: 'open',
      bufferedAmount: 0,
      send: (data) => NearbyBluetooth.send({ data }),
      close: () => {}
    };
    attachNearbyChannel(channel, true);
  }

  async function listenForNearbyBluetoothDevices() {
    await clearNearbyBluetoothListeners();
    nearbyBluetoothListeners = await Promise.all([
      NearbyBluetooth.addListener('connected', (event) => {
        setNearbySyncStatus(`Connected to ${event.deviceName || 'nearby register'} over Bluetooth.`);
        void connectNearbyBluetoothChannel();
      }),
      NearbyBluetooth.addListener('message', (event) => {
        if (!nearbyChannel) return;
        void handleNearbyMessage(nearbyChannel, event.data).catch((error) => {
          setNearbySyncStatus(error.message || 'Bluetooth sync failed.');
        });
      }),
      NearbyBluetooth.addListener('deviceFound', (event) => {
        const list = nearbyOverlay?.querySelector('[data-bt-device-list]');
        if (!list || !event.address) return;
        const existing = [...list.querySelectorAll('[data-bt-address]')]
          .find((button) => button.dataset.btAddress === event.address);
        if (existing) return;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'btn-secondary';
        item.dataset.btAddress = event.address;
        item.textContent = `${event.name || 'Nearby register'} (${event.address})`;
        item.addEventListener('click', async () => {
          item.disabled = true;
          setNearbySyncStatus(`Connecting to ${event.name || 'nearby register'}…`);
          try {
            await NearbyBluetooth.connect({ address: event.address });
            nearbyOverlay?.remove();
            nearbyOverlay = null;
          } catch (error) {
            item.disabled = false;
            setNearbySyncStatus(error.message || 'Could not connect over Bluetooth.');
          }
        });
        list.appendChild(item);
      }),
      NearbyBluetooth.addListener('discoveryFinished', () => {
        const status = nearbyOverlay?.querySelector('[data-bt-discovery-status]');
        if (status) status.textContent = 'Search finished. Tap Search again or select a discovered register.';
      }),
      NearbyBluetooth.addListener('disconnected', () => {
        if (nearbyChannel) nearbyChannel.readyState = 'closed';
        nearbyReady = false;
        nearbyPendingChanges.clear();
        setNearbySyncStatus('Bluetooth register disconnected. Live sync is off.');
      }),
      NearbyBluetooth.addListener('error', (event) => {
        setNearbySyncStatus(event.message || 'Bluetooth sync failed.');
      })
    ]);
  }

  async function startBluetoothNearbySync(mode) {
    if (window.Capacitor?.getPlatform?.() !== 'android') {
      throw new Error('Bluetooth phone-to-phone sync is available in the Android app, not in a browser or web register.');
    }
    if (nearbyChannel || nearbyPeer) throw new Error('End the current nearby sync session before starting another.');
    if (!state.cloudScopeId || state.cloudScopeId === 'local') {
      throw new Error('Choose the same shop in Studio on both phones before pairing.');
    }
    nearbyRole = mode === 'host' ? 'host' : 'guest';
    await refresh();
    nearbyTransport = 'bluetooth';
    await listenForNearbyBluetoothDevices();
    if (mode === 'host') {
      setNearbySyncStatus('Allow Bluetooth visibility so the other phone can find this register.');
      await NearbyBluetooth.startHosting();
      setNearbySyncStatus('Bluetooth receiver is ready. On the other phone, tap Find a Bluetooth register.');
      return;
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#0009;display:grid;place-items:center;padding:16px';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(100%,520px);max-height:90vh;overflow:auto;background:#fff;color:#18181b;padding:20px;border-radius:16px">
      <h2>Find a Bluetooth register</h2>
      <p>Ask the other phone to tap “Receive over Bluetooth” and approve visibility. Select only a phone you trust.</p>
      <p data-bt-discovery-status role="status">Searching for nearby phones…</p>
      <div data-bt-device-list style="display:grid;gap:8px"></div>
      <div class="pos-form-actions"><button type="button" class="btn-secondary" data-bt-search>Search again</button>
      <button type="button" class="btn-secondary" data-bt-cancel>Cancel</button></div></section>`;
    document.body.appendChild(overlay);
    nearbyOverlay = overlay;
    overlay.querySelector('[data-bt-cancel]').addEventListener('click', () => {
      overlay.remove();
      nearbyOverlay = null;
      void stopNearbySync();
    }, { once: true });
    overlay.querySelector('[data-bt-search]').addEventListener('click', async () => {
      overlay.querySelector('[data-bt-device-list]').replaceChildren();
      overlay.querySelector('[data-bt-discovery-status]').textContent = 'Searching for nearby phones…';
      try {
        await NearbyBluetooth.startDiscovery();
      } catch (error) {
        setNearbySyncStatus(error.message || 'Bluetooth search failed.');
      }
    });
    await NearbyBluetooth.startDiscovery();
  }

  function prepareNearbyPeer(peer) {
    nearbyPeer = peer;
    peer.ondatachannel = (event) => attachNearbyChannel(event.channel);
    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
        setNearbySyncStatus(`Nearby connection ${peer.connectionState}.`);
      }
    };
  }

  async function waitForIceGathering(peer) {
    if (peer.iceGatheringState === 'complete') return;
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        peer.removeEventListener('icegatheringstatechange', onStateChange);
        reject(new Error('Could not prepare the Wi-Fi pairing code. Put both devices on the same Wi-Fi or phone hotspot, then try again.'));
      }, 20000);
      const onStateChange = () => {
        if (peer.iceGatheringState === 'complete') {
          window.clearTimeout(timeout);
          peer.removeEventListener('icegatheringstatechange', onStateChange);
          resolve();
        }
      };
      peer.addEventListener('icegatheringstatechange', onStateChange);
      onStateChange();
    });
  }

  async function showNearbyQr(title, data, onClose = () => {}) {
    const { BrowserQRCodeSvgWriter } = await import('@zxing/browser');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#0009;display:grid;place-items:center;padding:16px';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(100%,520px);max-height:90vh;overflow:auto;background:#fff;color:#18181b;padding:20px;border-radius:16px;text-align:center">
      <h2>${escapeHtml(title)}</h2><p>Scan this QR once using the trusted phone you want to sync with. The PC will ask you before any data is transferred.</p>
      <div data-nearby-qr style="max-width:100%;overflow:auto"></div>
      <p data-nearby-qr-status role="status">Waiting for your phone to scan this code…</p>
      <button type="button" class="btn-secondary" data-nearby-close>Close</button></section>`;
    const svg = new BrowserQRCodeSvgWriter().write(JSON.stringify(data), 320, 320);
    svg.style.maxWidth = '100%';
    overlay.querySelector('[data-nearby-qr]').appendChild(svg);
    document.body.appendChild(overlay);
    nearbyOverlay?.remove();
    nearbyOverlay = overlay;
    overlay.querySelector('[data-nearby-close]').addEventListener('click', () => {
      overlay.remove();
      if (nearbyOverlay === overlay) nearbyOverlay = null;
      onClose();
    }, { once: true });
  }

  async function scanNearbyQr() {
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:#0009;display:grid;place-items:center;padding:16px';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(100%,520px);background:#fff;color:#18181b;padding:20px;border-radius:16px">
      <h2>Scan nearby pairing QR</h2><video style="width:100%;max-height:55vh;object-fit:contain"></video>
      <p data-nearby-scan-status>Allow camera access and center the QR in view.</p>
      <button type="button" class="btn-secondary" data-nearby-scan-close>Cancel</button></section>`;
    document.body.appendChild(overlay);
    const video = overlay.querySelector('video');
    let controls = null;
    let settled = false;
    return new Promise((resolve, reject) => {
      const close = (value, error) => {
        if (settled) return;
        settled = true;
        controls?.stop();
        video.srcObject?.getTracks().forEach((track) => track.stop());
        overlay.remove();
        if (nearbyOverlay === overlay) nearbyOverlay = null;
        if (error) reject(error);
        else resolve(value);
      };
      overlay.querySelector('[data-nearby-scan-close]').addEventListener('click', () => close(''), { once: true });
      const reader = new BrowserQRCodeReader();
      void reader.decodeFromVideoDevice(undefined, video, (result, error) => {
        if (result) {
          try {
            const data = JSON.parse(result.getText());
            if (data.type !== 'offer' || typeof data.pairingId !== 'string'
              || typeof data.guestToken !== 'string' || typeof data.tenantId !== 'string') {
              throw new Error('This QR is not a nearby pairing code.');
            }
            close(data);
          } catch (parseError) {
            overlay.querySelector('[data-nearby-scan-status]').textContent =
              parseError instanceof Error ? parseError.message : 'The pairing QR is invalid.';
          }
        } else if (error && error.name !== 'NotFoundException') {
          overlay.querySelector('[data-nearby-scan-status]').textContent = 'Keep the pairing QR inside the camera view.';
        }
      }).then((value) => {
        controls = value;
        if (settled) controls.stop();
      }).catch((error) => close('', error));
    });
  }

  async function startNearbySync(mode) {
    if (typeof window.RTCPeerConnection !== 'function') {
      throw new Error('This browser does not support encrypted nearby device sync. Use Cloudflare sync on this device.');
    }
    const tenantId = state.cloudScopeId;
    if (!tenantId || tenantId === 'local') throw new Error('Choose the same shop in Studio on both devices before pairing.');
    if (nearbyPeer) throw new Error('End the current nearby sync session before starting another.');
    if (typeof window.EshopInventoryBridge?.nearbyPairing !== 'function') {
      throw new Error('This register needs an app update to use one-scan Wi-Fi pairing.');
    }
    setNearbySyncStatus(`Preparing encrypted Wi-Fi pairing for shop “${tenantId}”…`);
    const peer = new RTCPeerConnection({ iceServers: [] });
    prepareNearbyPeer(peer);
    await refresh();
    if (mode === 'create') {
      nearbyRole = 'host';
      setNearbySyncStatus('Creating a secure pairing code. Keep both registers online and on the same Wi-Fi…');
      attachNearbyChannel(peer.createDataChannel('eshop-pos-sync', { ordered: true }));
      await peer.setLocalDescription(await peer.createOffer());
      await waitForIceGathering(peer);
      const relay = await window.EshopInventoryBridge.nearbyPairing(tenantId, 'POST', {
        action: 'create',
        offer: { type: 'offer', sdp: peer.localDescription.sdp }
      });
      nearbyRelaySession = { id: relay.pairing_id, tenantId, sessionToken: relay.host_token };
      await showNearbyQr('Scan this with your phone', {
        type: 'offer', pairingId: relay.pairing_id, guestToken: relay.guest_token, tenantId
      }, () => {
        if (nearbyRelaySession?.id === relay.pairing_id) {
          void stopNearbySync('Nearby pairing cancelled.');
        }
      });
      setNearbySyncStatus('QR ready. Scan it once with your phone; then approve the phone on this PC.');
      void waitForNearbyAnswer(peer, tenantId, relay.pairing_id, relay.host_token);
      return;
    }
    nearbyRole = 'guest';
    setNearbySyncStatus('Opening the camera to scan the PC pairing code…');
    const offer = await scanNearbyQr();
    if (!offer || offer.type !== 'offer') throw new Error('That QR is not a nearby pairing offer.');
    if (offer.tenantId !== tenantId) throw new Error('Select the same shop on the phone and PC before pairing.');
    const relayOffer = await window.EshopInventoryBridge.nearbyPairing(tenantId, 'GET', {
      id: offer.pairingId,
      sessionToken: offer.guestToken
    });
    if (!relayOffer.offer || relayOffer.offer.type !== 'offer' || typeof relayOffer.offer.sdp !== 'string') {
      throw new Error('The PC pairing code expired. Create a new QR and scan it again.');
    }
    await peer.setRemoteDescription(relayOffer.offer);
    setNearbySyncStatus('Sending a secure answer. Check the PC to approve this phone…');
    await peer.setLocalDescription(await peer.createAnswer());
    await waitForIceGathering(peer);
    await window.EshopInventoryBridge.nearbyPairing(tenantId, 'POST', {
      action: 'answer',
      id: offer.pairingId,
      answer: { type: 'answer', sdp: peer.localDescription.sdp },
      sessionToken: offer.guestToken
    });
    setNearbySyncStatus('Phone verified. Waiting for the PC to approve the connection…');
  }

  async function waitForNearbyAnswer(peer, tenantId, id, hostToken) {
    const expiresAt = Date.now() + 180_000;
    try {
      while (Date.now() < expiresAt && nearbyPeer === peer) {
        const result = await window.EshopInventoryBridge.nearbyPairing(tenantId, 'GET', {
          id, sessionToken: hostToken
        });
        if (result.answer) {
          const qrStatus = nearbyOverlay?.querySelector('[data-nearby-qr-status]');
          if (qrStatus) qrStatus.textContent = 'Your phone is ready. Approve the connection on this PC to transfer POS data.';
          setNearbySyncStatus('Your phone is ready. Approve the connection on this PC to transfer POS data.');
          const accepted = window.confirm(`A phone scanned this PC’s pairing QR for shop “${tenantId}”. Allow it to connect and transfer POS data?`);
          if (!accepted) {
            await stopNearbySync('Connection declined. No POS data was transferred.');
            return;
          }
          await peer.setRemoteDescription(result.answer);
          let cleanupWarning = '';
          try {
            await window.EshopInventoryBridge.nearbyPairing(tenantId, 'DELETE', {
              id, sessionToken: hostToken
            });
          } catch (error) {
            cleanupWarning = ` Temporary pairing data will expire shortly (${error.message || 'cleanup failed'}).`;
          }
          nearbyRelaySession = null;
          nearbyOverlay?.remove();
          nearbyOverlay = null;
          setNearbySyncStatus(`Connection approved. Connecting directly over Wi-Fi…${cleanupWarning}`);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
      }
      if (nearbyPeer === peer) throw new Error('Pairing timed out. Create a new QR and try again.');
    } catch (error) {
      if (nearbyPeer === peer) {
        await stopNearbySync(error instanceof Error ? `Nearby pairing failed: ${error.message}` : 'Nearby pairing failed.');
      }
    }
  }

  async function stopNearbySync(message = 'Nearby sync session ended.') {
    const relay = nearbyRelaySession;
    nearbyRelaySession = null;
    if (relay) {
      try {
        await window.EshopInventoryBridge?.nearbyPairing?.(relay.tenantId, 'DELETE', {
          id: relay.id, sessionToken: relay.sessionToken
        });
      } catch (error) {
        message += ` Pairing cleanup failed: ${error.message || 'check your internet connection.'}`;
      }
    }
    if (nearbyTransport === 'bluetooth') {
      try {
        await NearbyBluetooth.stop();
      } catch (error) {
        setNearbySyncStatus(error.message || 'Could not stop Bluetooth sync cleanly.');
      }
      await clearNearbyBluetoothListeners();
    }
    nearbyTransport = '';
    nearbyChannel?.close();
    nearbyPeer?.close();
    nearbyChannel = null;
    nearbyPeer = null;
    nearbyIncoming = null;
    nearbyRole = '';
    nearbyReady = false;
    nearbyRemoteName = '';
    nearbyPendingChanges.clear();
    nearbyOverlay?.remove();
    nearbyOverlay = null;
    setNearbySyncStatus(message);
  }

  async function receivePurchaseOrder(recordId) {
    const purchase = state.purchases.find((item) => item.id === recordId);
    if (!purchase || purchase.status !== 'ordered') throw new Error('This purchase order is not available to receive.');
    const received = [];
    for (const line of purchase.items) {
      const product = (await rows('SELECT id,name,stock_count FROM pos_products WHERE sku=?', [line.sku]))[0];
      if (!product) throw new Error(`${line.name} is no longer in this catalogue; restore the product before receiving.`);
      const nextStock = (product.stock_count == null ? 0 : Number(product.stock_count)) + line.quantity;
      if (!Number.isSafeInteger(nextStock) || nextStock < 0) throw new Error(`Stock quantity for ${line.name} is invalid.`);
      received.push({ ...line, productId: Number(product.id), nextStock });
    }
    const updatedPurchase = { ...purchase, status: 'received', receivedAt: nowIso() };
    await transaction([
      ...received.map((line) => stmt(
        'UPDATE pos_products SET stock_count=?,buying_price_cents=? WHERE id=?',
        [line.nextStock, toCents(line.unitCost), line.productId]
      )),
      ...businessRecordStatements('purchase', purchase.id, updatedPurchase, false, 0, state.cloudScopeId)
    ]);
    const products = await listProducts();
    for (const line of received) {
      const product = products.find((item) => item.id === line.productId);
      if (!product) throw new Error(`Received stock for ${line.name}, but the updated product could not be loaded for sync.`);
      await queueProduct(product);
    }
    for (const line of received) await recordSharedStockUpdate(line.sku, line.nextStock);
  }

  async function syncInventorySales() {
    const queued = await rows("SELECT event_id,tenant_id,items_json,operation FROM pos_inventory_queue WHERE status!='synced' ORDER BY updated_at,rowid");
    if (navigator.onLine === false || !window.EshopInventoryBridge) return queued.length;
    const sharedTenant = (await rows("SELECT value FROM pos_settings WHERE key='shared_tenant_id'"))[0]?.value;
    const syncedTenants = new Set(sharedTenant ? [sharedTenant] : []);
    for (const event of queued) {
      if (window.EshopInventoryBridge.hasTenantOwnerKey?.(event.tenant_id) === false) continue;
      try {
        const body = JSON.parse(event.items_json);
        if (event.operation === 'connect') {
          await window.EshopInventoryBridge.request(event.tenant_id, 'connect', 'POST', body);
        } else {
          await window.EshopInventoryBridge.request(event.tenant_id, 'sale', 'POST', {
            event_id: event.event_id,
            items: body
          });
        }
        await run("UPDATE pos_inventory_queue SET status='synced',last_error=NULL,updated_at=? WHERE event_id=?",
          [nowIso(), event.event_id]);
        syncedTenants.add(event.tenant_id);
      } catch (error) {
        await run("UPDATE pos_inventory_queue SET status='pending',last_error=?,updated_at=? WHERE event_id=?",
          [String(error instanceof Error ? error.message : 'Sync failed').slice(0, 500), nowIso(), event.event_id]);
      }
    }
    for (const tenantId of syncedTenants) {
      let remote;
      try {
        remote = await window.EshopInventoryBridge.request(tenantId, 'connect', 'GET');
      } catch (error) {
        state.inventorySyncError = String(error instanceof Error ? error.message : error).slice(0, 500);
        await run('UPDATE pos_inventory_queue SET last_error=?,updated_at=? WHERE tenant_id=? AND status=?',
          [`Sales synced; latest D1 stock refresh failed: ${String(error instanceof Error ? error.message : error).slice(0, 400)}`,
            nowIso(), tenantId, 'synced']);
        continue;
      }
      if (!Array.isArray(remote.items)) continue;
      const items = remote.items.map((item) => ({
        sku: String(item.sku || ''),
        stock: Number(item.stock)
      })).filter((item) => item.sku && Number.isSafeInteger(item.stock) && item.stock >= 0);
      if (!items.length) continue;
      await transaction(items.map((item) =>
        stmt(`INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(tenant_id,sku) DO UPDATE SET stock=excluded.stock,updated_at=excluded.updated_at`,
        [tenantId, item.sku, item.stock, nowIso()])));
      await window.EshopInventoryBridge.updateLocalStock?.(tenantId, items);
      await run('UPDATE pos_inventory_queue SET last_error=NULL WHERE tenant_id=? AND status=?', [tenantId, 'synced']);
      state.inventorySyncError = '';
      for (const item of items) {
        await run('UPDATE pos_products SET stock_count=? WHERE sku=?', [item.stock, item.sku]);
      }
    }
    return (await rows("SELECT COUNT(*) AS count FROM pos_inventory_queue WHERE status!='synced'"))[0]?.count || 0;
  }

  async function syncSharedStock(source) {
    const websiteId = document.getElementById('pos-shared-website')?.value || '';
    if (!websiteId) throw new Error('Select a website to connect.');
    const bridge = window.EshopInventoryBridge;
    if (!bridge) throw new Error('Website sync is unavailable. Reload the app and try again.');
    const website = bridge.websites().find((item) => item.tenant_id === websiteId);
    if (!website) throw new Error('The selected website is no longer available. Refresh and try again.');
    let catalog = bridge.localCatalog(websiteId);
    if ((!catalog || !catalog.products?.length) && navigator.onLine !== false) {
      catalog = await bridge.catalog(websiteId);
    }
    if (!catalog) throw new Error('This website has no catalog saved on this device. Open it online once, then try again.');
    if (source === 'website') {
      const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
      const posCategories = await listCategories();
      const categoryIds = new Map(posCategories.map((category) => [normalize(category.name), category.id]));
      const posProducts = await listProducts();
      const productsBySku = new Map(posProducts.filter((product) => product.sku)
        .map((product) => [String(product.sku).trim().toLocaleUpperCase(), product]));
      const imported = [];
      for (const websiteProduct of (catalog.products || []).filter((product) => product.status !== 'archived')) {
        const name = String(websiteProduct.name || '').trim();
        if (!name) continue;
        const stock = websiteProduct.stock == null ? 0 : Number(websiteProduct.stock);
        if (!Number.isSafeInteger(stock) || stock < 0) {
          throw new Error(`${name} has an invalid website stock count.`);
        }
        const categoryName = String((catalog.categories || []).find((category) =>
          String(category.id) === String(websiteProduct.category_id))?.name
          || websiteProduct.category_name || websiteProduct.category || 'Other').trim() || 'Other';
        const categoryKey = normalize(categoryName);
        let categoryId = categoryIds.get(categoryKey);
        if (!categoryId) {
          await addCategory(categoryName);
          const createdCategory = (await listCategories()).find((category) => normalize(category.name) === categoryKey);
          if (!createdCategory) throw new Error(`Could not create POS category "${categoryName}".`);
          categoryId = createdCategory.id;
          categoryIds.set(categoryKey, categoryId);
        }
        const sku = String(websiteProduct.sku || '').trim();
        const existing = (sku && productsBySku.get(sku.toLocaleUpperCase()))
          || posProducts.find((product) => normalize(product.name) === normalize(name)
            && product.categoryId === categoryId);
        const productId = await saveProduct({
          id: existing?.id || 0,
          name: existing?.name || name,
          categoryId: existing?.categoryId || categoryId,
          price: existing?.price ?? (Number(websiteProduct.price) || 0),
          buyingPrice: existing?.buyingPrice ?? websiteProduct.cost_price ?? null,
          stock,
          sku: existing?.sku || sku,
          imageUri: existing?.imageUri || websiteProduct.images?.[0] || '',
          lowStockThreshold: existing?.lowStockThreshold ?? 3,
          active: existing?.active ?? true
        });
        const saved = (await listProducts()).find((product) => Number(product.id) === Number(productId));
        if (!saved) throw new Error(`${name} was not saved to POS inventory.`);
        if (saved.sku) productsBySku.set(saved.sku.toLocaleUpperCase(), saved);
        posProducts.push(saved);
        imported.push(saved);
      }
      if (!imported.length) throw new Error('This website has no products to load into POS.');
      await refresh();
      return { count: imported.length, pending: 0, localOnly: true };
    }
    const posBySku = new Map();
    for (const product of state.products) {
      const sku = String(product.sku || '').trim();
      if (!sku) continue;
      if (posBySku.has(sku)) throw new Error(`SKU ${sku} is used by more than one POS product.`);
      if (!Number.isSafeInteger(product.stock) || product.stock < 0) {
        throw new Error(`${product.name} needs a tracked whole-number stock count before syncing.`);
      }
      posBySku.set(sku, product);
    }
    const websiteBySku = new Map((catalog.products || [])
      .filter((product) => typeof product.sku === 'string' && product.sku.trim())
      .map((product) => [product.sku.trim(), product]));
    const matches = [...posBySku].filter(([sku]) => websiteBySku.has(sku));
    if (!matches.length) throw new Error('No SKUs match. Add the same SKU to a POS product and website product first.');
    const items = matches.map(([sku, product]) => ({
      sku,
      stock: source === 'pos' ? product.stock : Number(websiteBySku.get(sku).stock)
    }));
    if (items.some((item) => !Number.isSafeInteger(item.stock) || item.stock < 0)) {
      throw new Error('The selected source contains invalid stock counts.');
    }
    if (state.sharedTenantId === websiteId && !confirm('Reset shared stock to the selected source? This replaces the current shared quantities.')) {
      return { count: 0, pending: state.pendingInventoryEvents };
    }
    const eventId = `SYNC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = nowIso();
    const payload = JSON.stringify({ mode: 'replace', items });
    const replaceStatements = items.map((item) =>
      stmt(`INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)
        ON CONFLICT(tenant_id,sku) DO UPDATE SET stock=excluded.stock,updated_at=excluded.updated_at`,
      [websiteId, item.sku, item.stock, createdAt]));
    replaceStatements.push(
      stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
        [websiteId, eventId, createdAt]),
      stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
        VALUES (?,?,?,'connect','pending',?)`,
      [eventId, websiteId, payload, createdAt]),
      stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', ['shared_tenant_id', websiteId])
    );
    await transaction(replaceStatements);
    await bridge.updateLocalStock(websiteId, items);
    const pending = await syncInventorySales();
    await refresh();
    return { count: items.length, pending };
  }

  function toast(message, error = false) {
    let element = document.getElementById('pos-toast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'pos-toast';
      element.className = 'pos-toast';
      document.body.appendChild(element);
    }
    element.textContent = message;
    element.classList.toggle('is-error', error);
    element.classList.add('is-visible');
    clearTimeout(element._timer);
    element._timer = setTimeout(() => element.classList.remove('is-visible'), 2600);
  }

  async function restoreInventoryFile(file) {
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      throw new Error('The selected file is not valid JSON.');
    }
    if (!backup || backup.format !== 'audit-pos-inventory' || backup.version !== 1
      || !Array.isArray(backup.categories) || !Array.isArray(backup.products)) {
      throw new Error('Choose a supported POS inventory backup.');
    }
    const validCategories = backup.categories.every((category) => typeof category === 'string' && category.trim());
    const validProducts = backup.products.every((product) => product && typeof product.name === 'string' && product.name.trim()
      && typeof product.categoryName === 'string' && product.categoryName.trim()
      && (product.sku === undefined || (typeof product.sku === 'string' && product.sku.length <= 120))
      && (product.barcode === undefined || (typeof product.barcode === 'string' && product.barcode.length <= 120))
      && (product.expiryDate === undefined || (typeof product.expiryDate === 'string' && (!product.expiryDate || /^\d{4}-\d{2}-\d{2}$/.test(product.expiryDate))))
      && Number.isFinite(product.price) && product.price >= 0
      && (product.buyingPrice == null || (Number.isFinite(product.buyingPrice) && product.buyingPrice >= 0))
      && (product.stock == null || (Number.isSafeInteger(product.stock) && product.stock >= 0))
      && (product.image == null || (typeof product.image.mimeType === 'string' && /^image\/[A-Za-z0-9.+-]+$/.test(product.image.mimeType)
        && typeof product.image.base64 === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(product.image.base64))));
    if (!validCategories || !validProducts) throw new Error('The backup contains invalid inventory details.');
    const normalize = (name) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const categoryIds = new Map((await listCategories()).map((category) => [normalize(category.name), category.id]));
    for (const name of [...backup.categories, ...backup.products.map((item) => item.categoryName)]) {
      if (categoryIds.has(normalize(name))) continue;
      await addCategory(name.trim());
      (await listCategories()).forEach((category) => categoryIds.set(normalize(category.name), category.id));
    }
    let products = await listProducts();
    for (const item of backup.products) {
      const categoryId = categoryIds.get(normalize(item.categoryName));
      if (!categoryId) throw new Error(`Could not restore category "${item.categoryName}".`);
      const existing = products.find((product) => item.sku
        ? product.sku === item.sku
        : product.categoryId === categoryId && normalize(product.name) === normalize(item.name));
      const imageUri = item.image ? `data:${item.image.mimeType};base64,${item.image.base64}` : null;
      await saveProduct({
        id: existing?.id || 0, name: item.name.trim(), categoryId, price: item.price,
        buyingPrice: item.buyingPrice, stock: item.stock, sku: item.sku || existing?.sku || '',
        barcode: item.barcode ?? existing?.barcode ?? '', expiryDate: item.expiryDate ?? existing?.expiryDate ?? '', imageUri,
        lowStockThreshold: item.lowStockThreshold ?? existing?.lowStockThreshold ?? 3, active: item.active !== false
      });
      products = await listProducts();
    }
    return backup.products.length;
  }

  async function exportInventory() {
    const [categories, products] = await Promise.all([listCategories(), listProducts()]);
    const backup = {
      format: 'audit-pos-inventory', version: 1, createdAt: nowIso(),
      categories: categories.map((item) => item.name),
      products: products.map((product) => {
        const image = /^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(product.imageUri || '');
        return { name: product.name, sku: product.sku, barcode: product.barcode,
          expiryDate: product.expiryDate, categoryName: product.categoryName, price: product.price,
          buyingPrice: product.buyingPrice, stock: product.stock, lowStockThreshold: product.lowStockThreshold,
          active: product.active, image: image ? { mimeType: image[1], base64: image[2] } : null };
      })
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `eshop-pos-inventory-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importInventoryCsv(file) {
    const records = csvRows(await file.text());
    if (records.length < 2) throw new Error('The CSV must include a header and at least one product.');
    const headers = records.shift().map((header) => header.trim().toLocaleLowerCase().replace(/[\s_-]+/g, ''));
    const column = (name) => headers.indexOf(name);
    if (column('name') < 0 || column('price') < 0 || new Set(headers).size !== headers.length) {
      throw new Error('CSV needs unique headers including name and price.');
    }
    const values = (record, name) => column(name) < 0 ? '' : String(record[column(name)] ?? '').trim();
    const existingProducts = await listProducts();
    const existingCategories = await listCategories();
    const normalize = (value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const categoryMap = new Map(existingCategories.map((item) => [normalize(item.name), item]));
    const parsed = records.map((record, index) => {
      if (record.length > headers.length) throw new Error(`CSV row ${index + 2} has more cells than headers.`);
      const name = values(record, 'name');
      const sku = values(record, 'sku');
      const barcode = values(record, 'barcode');
      const expiryDate = values(record, 'expirydate');
      const price = Number(values(record, 'price'));
      const costText = values(record, 'buyingprice') || values(record, 'cost');
      const buyingPrice = costText ? Number(costText) : null;
      const stockText = values(record, 'stock');
      const stock = stockText ? Number(stockText) : null;
      const thresholdText = values(record, 'lowstockthreshold') || values(record, 'reorderat');
      const threshold = thresholdText ? Number(thresholdText) : null;
      const activeText = values(record, 'active').toLocaleLowerCase();
      const categoryName = values(record, 'category');
      if (!name || !Number.isFinite(price) || price < 0
        || (buyingPrice !== null && (!Number.isFinite(buyingPrice) || buyingPrice < 0))
        || (stock !== null && (!Number.isSafeInteger(stock) || stock < 0))
        || (threshold !== null && (!Number.isSafeInteger(threshold) || threshold < 0))
        || (sku && sku.length > 120) || (barcode && barcode.length > 120)
        || (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))
        || (activeText && !['1', '0', 'true', 'false', 'yes', 'no', 'active', 'disabled'].includes(activeText))) {
        throw new Error(`CSV row ${index + 2} has invalid product details.`);
      }
      const existing = (sku && existingProducts.find((item) => item.sku === sku))
        || (barcode && existingProducts.find((item) => item.barcode === barcode))
        || existingProducts.find((item) => normalize(item.name) === normalize(name));
      const category = categoryName
        ? categoryMap.get(normalize(categoryName)) || { name: categoryName, id: 0 }
        : existingCategories.find((item) => item.id === existing?.categoryId)
          || existingCategories.find((item) => normalize(item.name) === 'other');
      if (!category) throw new Error(`CSV row ${index + 2} needs a category or a default "Other" category.`);
      return { index, name, sku: sku || existing?.sku || '', barcode: barcode || existing?.barcode || '',
        expiryDate: expiryDate || existing?.expiryDate || '', price,
        buyingPrice: buyingPrice ?? existing?.buyingPrice ?? null,
        stock: stockText ? stock : existing?.stock ?? 0,
        lowStockThreshold: threshold ?? existing?.lowStockThreshold ?? 3,
        active: activeText ? !['0', 'false', 'no', 'disabled'].includes(activeText) : existing?.active ?? true,
        imageUri: existing?.imageUri || '', existing, categoryName: category.name };
    });
    const knownSkus = new Set(existingProducts.map((item) => item.sku).filter(Boolean));
    const knownBarcodes = new Set(existingProducts.map((item) => item.barcode).filter(Boolean));
    const incomingSkus = new Set();
    const incomingBarcodes = new Set();
    for (const item of parsed) {
      if (item.sku && (incomingSkus.has(item.sku) || (knownSkus.has(item.sku) && !item.existing))) {
        throw new Error(`CSV contains a duplicate or conflicting SKU "${item.sku}".`);
      }
      if (item.sku) incomingSkus.add(item.sku);
      if (item.barcode && (incomingBarcodes.has(item.barcode) || (knownBarcodes.has(item.barcode) && !item.existing))) {
        throw new Error(`CSV contains a duplicate or conflicting barcode "${item.barcode}".`);
      }
      if (item.barcode) incomingBarcodes.add(item.barcode);
    }
    if (!confirm(`Import ${parsed.length} products? Matching SKU or name will be updated; other products will remain.`)) return 0;
    for (const item of parsed) {
      let category = categoryMap.get(normalize(item.categoryName));
      if (!category) {
        await addCategory(item.categoryName);
        category = (await listCategories()).find((entry) => normalize(entry.name) === normalize(item.categoryName));
        if (!category) throw new Error(`Could not create category "${item.categoryName}".`);
        categoryMap.set(normalize(item.categoryName), category);
        await queueCategory(category);
      }
      const productId = await saveProduct({ ...item, id: item.existing?.id || 0, categoryId: category.id });
      await queueProduct((await listProducts()).find((product) => product.id === productId));
    }
    return parsed.length;
  }

  async function handleFileChange(event) {
    const input = event.target.closest('[data-pos-import], [data-pos-csv-import]');
    if (!input || !input.files?.[0]) return;
    try {
      const count = input.matches('[data-pos-csv-import]')
        ? await importInventoryCsv(input.files[0])
        : await restoreInventoryFile(input.files[0]);
      if (count) {
        toast(`${count} product${count === 1 ? '' : 's'} imported.`);
        await refresh();
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not import this inventory file.', true);
    } finally {
      input.value = '';
    }
  }

  async function readImageFile(file) {
    if (!file) return '';
    if (!window.AppUtils?.compressImageFile) {
      throw new Error('Image compression is not available in this app session.');
    }
    return window.AppUtils.compressImageFile(file, { maxDimension: 1800, maxBytes: 900_000 });
  }

  async function getProductVision() {
    const { ProductVision } = await import('./product-vision.js');
    return { plugin: ProductVision };
  }

  async function createProductImageEmbedding(productId, imageUri) {
    try {
      const imageBase64 = await prepareImageForVision(imageUri);
      const { plugin: vision } = await getProductVision();
      const profile = await vision.embedImage({ imageBase64 });
      const imageEmbeddingHex = embeddingBase64ToHex(profile.embedding, Number(profile.dimensions));
      const product = (await listProducts()).find((item) => item.id === productId);
      if (!product || product.imageUri !== imageUri) return;
      await saveProduct({ ...product, imageEmbeddingHex });
      const updated = (await listProducts()).find((item) => item.id === productId);
      if (updated) await queueProduct(updated);
      await loadState();
      return true;
    } catch (error) {
      toast(`Product saved. Photo matching is unavailable: ${error instanceof Error ? error.message : 'image profile failed'}`, true);
      return false;
    }
  }

  async function prepareImageForVision(dataUrl, size = 512) {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('Choose a readable product photo.');
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare the product photo for recognition.');
    context.drawImage(image,
      (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side,
      0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  }

  async function captureProductPhoto() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This device does not provide an in-app camera preview. Upload a product photo instead.');
    }
    const overlay = document.createElement('div');
    overlay.className = 'pos-scanner-overlay';
    overlay.innerHTML = `<section class="pos-scanner-shell" role="dialog" aria-modal="true" aria-label="Take product photo">
      <video class="pos-scanner-video" autoplay muted playsinline></video>
      <div class="pos-scanner-header"><h2>Take product photo</h2>
        <p>Center one product in the frame, then capture. The photo stays on this device.</p></div>
      <div class="pos-scanner-frame" aria-hidden="true"></div>
      <div class="pos-scanner-footer">
        <p class="pos-scanner-status" data-product-photo-status role="status" aria-live="polite">Starting camera…</p>
        <button type="button" class="pos-scanner-mode" data-product-photo-capture disabled>Capture photo</button>
        <button type="button" class="pos-scanner-close" data-product-photo-cancel>Cancel</button>
      </div>
    </section>`;
    document.body.appendChild(overlay);
    const video = overlay.querySelector('video');
    const status = overlay.querySelector('[data-product-photo-status]');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = stream;
      await video.play();
      const image = await new Promise((resolve, reject) => {
        const finish = (value) => {
          overlay.remove();
          resolve(value);
        };
        overlay.querySelector('[data-product-photo-cancel]').addEventListener('click', () => finish(''), { once: true });
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) finish('');
        }, { once: true });
        const capture = overlay.querySelector('[data-product-photo-capture]');
        capture.disabled = false;
        capture.addEventListener('click', () => {
          try {
            const side = Math.min(video.videoWidth, video.videoHeight);
            if (!side) throw new Error('The camera is not ready yet. Try again in a moment.');
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('Could not prepare this product photo.');
            context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2,
              side, side, 0, 0, canvas.width, canvas.height);
            finish(canvas.toDataURL('image/jpeg', 0.82));
          } catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Could not capture this photo.';
          }
        });
        status.textContent = 'Camera ready · frame the product, then capture.';
      });
      return image;
    } catch (error) {
      throw new Error(`Could not start product camera: ${error instanceof Error ? error.message : 'camera unavailable'}`);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      overlay.remove();
    }
  }

  function captureVideoFrameForVision(video, size = 512) {
    if (!video.videoWidth || !video.videoHeight) throw new Error('The camera is not ready yet. Try again in a moment.');
    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare a camera frame for image matching.');
    context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  }

  function embeddingBase64ToHex(encoded, dimensions) {
    if (typeof encoded !== 'string' || !Number.isSafeInteger(dimensions) || dimensions < 64 || dimensions > 2048) {
      throw new Error('The on-device image model returned an invalid match profile.');
    }
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    if (bytes.length !== dimensions) throw new Error('The on-device image model returned an incomplete match profile.');
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function handleSubmit(event) {
    const form = event.target.closest('form[data-pos-form]');
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const submitButton = form.querySelector?.('button[type="submit"]');
    const originalSubmitText = submitButton?.textContent || '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving…';
    }
    try {
      switch (form.dataset.posForm) {
        case 'store-filter':
          state.search = String(data.search || '').trim();
          state.category = String(data.category || '');
          await refresh();
          return;
        case 'product': {
          const requiredField = !String(data.name || '').trim()
            ? form.elements?.name
            : String(data.price ?? '').trim() === '' ? form.elements?.price : null;
          if (requiredField) {
            const message = requiredField.name === 'price'
              ? 'Enter a selling price before adding this product.'
              : 'Enter a product name before adding this product.';
            const status = form.querySelector('[data-product-submit-status]');
            if (status) status.textContent = message;
            requiredField.focus();
            requiredField.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
            toast(message, true);
            return;
          }
          const selectedImage = form.elements?.imageFile?.files?.[0];
          const uploadedImage = await readImageFile(selectedImage);
          const capturedImage = String(form.elements?.capturedProductImage?.value || '');
          const imageUri = uploadedImage || capturedImage || data.imageUri;
          data.imageUri = imageUri;
          const oldProduct = state.products.find((product) => product.id === Number(data.id));
          const imageChanged = Boolean(selectedImage) || imageUri !== (oldProduct?.imageUri || '')
            || (/^data:image\//i.test(imageUri || '') && !oldProduct?.imageEmbedding?.length);
          if (imageChanged) {
            data.imageEmbeddingHex = '';
          }
          const productId = await saveProduct(data);
          const product = (await listProducts()).find((item) => item.id === productId);
          if (!product) throw new Error('The product could not be loaded after saving. Refresh the catalogue and check before adding it again.');
          await queueProduct(product);
          toast('Product saved.');
          await refresh();
          if (imageChanged && /^data:image\//i.test(imageUri || '')) {
            void createProductImageEmbedding(productId, imageUri);
          }
          return;
        }
        case 'supplier': {
          const name = String(data.name || '').trim();
          const phone = String(data.phone || '').trim();
          const email = String(data.email || '').trim();
          if (!name || name.length > 160
            || (phone && !/^[+\d][\d\s()+-]{4,24}$/.test(phone))
            || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            throw new Error('Enter a supplier name and valid contact details.');
          }
          const id = String(data.id || `SUP-${crypto.randomUUID().replace(/-/g, '')}`);
          const supplier = { id, name, phone, email, supplies: String(data.supplies || '').trim().slice(0, 500), updatedAt: nowIso() };
          await queueCloudRecord('supplier', id, supplier);
          toast('Supplier saved.');
          break;
        }
        case 'purchase': {
          const supplier = state.suppliers.find((item) => item.id === data.supplierId);
          if (!supplier) throw new Error('Choose a supplier.');
          const items = [];
          for (const index of [1, 2, 3]) {
            const sku = String(data[`product${index}`] || '').trim();
            const quantityText = String(data[`quantity${index}`] || '').trim();
            const costText = String(data[`cost${index}`] || '').trim();
            if (!sku && !quantityText && !costText) continue;
            const quantity = Number(quantityText);
            const unitCost = Number(costText);
            const product = state.products.find((item) => item.sku === sku);
            if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999
              || !Number.isFinite(unitCost) || unitCost < 0) {
              throw new Error(`Complete product, whole-number quantity and valid unit cost on line ${index}.`);
            }
            items.push({ sku, productId: product.id, name: product.name, quantity, unitCost });
          }
          if (!items.length) throw new Error('Add at least one product to the purchase order.');
          const id = `PO-${crypto.randomUUID().replace(/-/g, '')}`;
          const purchase = {
            id, supplierId: supplier.id, supplierName: supplier.name,
            reference: String(data.reference || '').trim().slice(0, 80),
            items, status: 'ordered', createdAt: nowIso()
          };
          await queueCloudRecord('purchase', id, purchase);
          toast('Purchase order created.');
          break;
        }
        case 'category':
          await addCategory(data.name);
          await queueCategory((await listCategories()).find((item) => item.name.toLocaleLowerCase() === String(data.name).trim().toLocaleLowerCase()));
          toast('Category added.');
          break;
        case 'checkout': {
          const method = data.paymentMethod || null;
          const paid = Boolean(method && method !== 'Mobile money');
          let sale;
          try {
            sale = await saveSale(state.cart, { ...data, paymentMethod: method, paid });
          } catch (error) {
            if (!(error instanceof Error) || !/in stock, \d+ requested/.test(error.message)
              || !confirm(`${error.message}\n\nSell anyway? Stock will not go below zero.`)) throw error;
            sale = await saveSale(state.cart, { ...data, paymentMethod: method, paid, allowOutOfStock: true });
          }
          const savedSale = (await listSales()).find((item) => item.id === sale.id);
          if (savedSale) await queueCloudRecord('sale', savedSale.receipt_number, savedSale);
          const productsAfterSale = await listProducts();
          for (const productId of new Set(state.cart.map((item) => item.productId))) {
            const product = productsAfterSale.find((item) => item.id === productId);
            if (!product) throw new Error('The sale was saved, but an updated product could not be loaded for sync.');
            await queueProduct(product);
          }
          if (state.activeTicketId) {
            await queueCloudRecord('ticket', state.activeTicketId, { id: state.activeTicketId }, true);
            state.activeTicketId = '';
          }
          const pendingSharedSales = await syncInventorySales();
          state.cart = [];
          state.paymentMethod = '';
          state.discount = 0;
          toast(`Receipt ${sale.receiptNumber} saved${method === 'Mobile money' ? ' · awaiting manual confirmation' : ''}${pendingSharedSales ? ' · shared stock sync pending' : ''}.`);
          await refresh();
          return;
        }
        case 'payment': {
          const result = await recordPayment(data.saleId, data.amount, data.method, data);
          const paidSale = (await listSales()).find((item) => item.id === Number(data.saleId));
          if (paidSale) await queueCloudRecord('sale', paidSale.receipt_number, paidSale);
          toast(result.paid ? 'Sale fully paid.' : 'Payment recorded.');
          state.expandedSale = Number(data.saleId);
          break;
        }
        case 'invoice': {
          const items = state.invoiceItems;
          if (!items.length) throw new Error('Add at least one invoice item.');
          await saveInvoice({ ...data, items });
          state.invoiceItems = [];
          state.invoiceDraftId = null;
          window.location.hash = '#/pos/invoices';
          toast('Invoice saved.');
          break;
        }
        case 'quotation': {
          const productIds = new Set(new FormData(form).getAll('products').map(Number));
          const items = state.products.filter((product) => productIds.has(product.id))
            .map((product) => ({ name: product.name, quantity: 1, unitPrice: product.price }));
          const customName = String(data.customName || '').trim();
          const customPrice = String(data.customPrice || '').trim();
          if (customName || customPrice) {
            const amount = Number(customPrice);
            if (!customName || !Number.isFinite(amount) || amount < 0) {
              throw new Error('Enter both a custom item name and a valid price.');
            }
            items.push({ name: customName, quantity: 1, unitPrice: amount });
          }
          if (!items.length) throw new Error('Choose a catalogue product or enter a custom item.');
          const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
          const customer = escapeHtml(String(data.customerName || '').trim());
          const lines = items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice, state.settings.currency)}</td><td>${money(item.unitPrice * item.quantity, state.settings.currency)}</td></tr>`).join('');
          printDocument(`Quotation · ${customer}`, `<h1>E-Shop · Quotation</h1><p>Prepared ${new Date().toLocaleDateString()}</p><p>Customer: ${customer}</p><p>${escapeHtml(String(data.customerContact || ''))}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table><p class=\"total\">Quoted total · ${money(subtotal, state.settings.currency)}</p><p>Quotation only · not a tax invoice or completed sale.</p>`);
          return;
        }
        case 'instance':
          await startInstance(data);
          toast('Business instance started.');
          break;
        case 'settings':
          await saveSettings(data.taxRate, data.currency);
          await queueSettings();
          toast('POS settings saved.');
          break;
        case 'revenue-goal':
          await saveMonthlyRevenueGoal(data.amount, state.settings.currency);
          await queueSettings();
          toast('Monthly revenue goal saved.');
          break;
        case 'expense':
          await queueExpense(await saveExpense({ ...data, currency: state.settings.currency }));
          toast(Number(data.id) ? 'Expense updated.' : 'Expense saved.');
          break;
        case 'movement': {
          const amount = toCents(data.amount);
          if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a positive cash movement amount.');
          await run('INSERT INTO pos_cash_movements (movement_type,amount_cents,currency,note,created_at) VALUES (?,?,?,?,?)',
            [data.type, amount, state.settings.currency, String(data.note || '').trim(), nowIso()]);
          toast('Cash movement recorded.');
          break;
        }
        case 'till': {
          assertDate(data.date, 'Till date');
          const counted = toCents(data.countedCash);
          if (!Number.isSafeInteger(counted) || counted < 0) throw new Error('Enter a valid counted cash total.');
          const dayStart = new Date(`${data.date}T00:00:00`);
          const from = dayStart.toISOString();
          dayStart.setDate(dayStart.getDate() + 1);
          const to = new Date(dayStart.getTime() - 1).toISOString();
          const [cashPayments, cashExpenses, movements] = await Promise.all([
            rows(`SELECT p.amount_cents FROM pos_sale_payments p JOIN pos_sales s ON s.id=p.sale_id
              WHERE p.method='Cash' AND p.status='confirmed' AND s.currency=? AND p.created_at BETWEEN ? AND ?`,
            [state.settings.currency, from, to]),
            rows("SELECT amount_cents FROM pos_expenses WHERE payment_method='Cash' AND currency=? AND expense_date=?",
              [state.settings.currency, data.date]),
            rows('SELECT movement_type,amount_cents FROM pos_cash_movements WHERE currency=? AND created_at BETWEEN ? AND ?',
              [state.settings.currency, from, to])
          ]);
          const cashSales = cashPayments.reduce((sum, row) => sum + Number(row.amount_cents), 0);
          const expenseCents = cashExpenses.reduce((sum, row) => sum + Number(row.amount_cents), 0);
          const moved = movements.reduce((sum, row) => sum + (row.movement_type === 'float_in' ? 1 : -1) * Number(row.amount_cents), 0);
          const expected = cashSales - expenseCents + moved;
          await run('INSERT INTO pos_till_closes (close_date,expected_cash_cents,counted_cash_cents,difference_cents,currency) VALUES (?,?,?,?,?)',
            [data.date, expected, counted, counted - expected, state.settings.currency]);
          toast('Till close saved.');
          break;
        }
      }
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save this POS change.', true);
    } finally {
      if (submitButton?.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
      }
    }
  }

  async function findProductByCode(code) {
    const normalized = String(code || '').trim();
    if (!normalized || normalized.length > 120) return null;
    const matches = await rows(`SELECT id,name,sku,barcode,price_cents,active FROM pos_products
      WHERE barcode=? COLLATE NOCASE OR sku=? COLLATE NOCASE LIMIT 2`, [normalized, normalized]);
    if (matches.length > 1) throw new Error('This code matches more than one product. Fix duplicate barcodes or SKUs in the catalogue.');
    return matches[0] || null;
  }

  async function addScannedBarcode(code) {
    const value = String(code || '').trim();
    if (!value || value.length > 120) throw new Error('This barcode is too long to save as a product code.');
    const product = await findProductByCode(value);
    if (!product) {
      toast(`No product found for ${value}.`, true);
      if (confirm(`No product matches ${value}. Add a new product with this barcode?`)) {
        window.location.hash = `#/pos/catalogue/products?new=1&barcode=${encodeURIComponent(value)}`;
        return { captured: true };
      }
      return false;
    }
    if (!product.active) throw new Error('This product is disabled and cannot be added to a sale.');
    return addProductToSale(product);
  }

  async function addProductToSale(product, closeScanner = false) {
    if (!product?.active) throw new Error('This product is disabled and cannot be added to a sale.');
    const productId = Number(product.id);
    const unitPrice = product.price_cents == null ? Number(product.price) : fromCents(product.price_cents);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('This product has an invalid saved price. Edit it in Catalogue before adding it to a sale.');
    }
    const cartItem = state.cart.find((item) => item.productId === productId);
    if (cartItem) cartItem.quantity = Math.min(99999, cartItem.quantity + 1);
    else state.cart.push({
      productId, name: product.name, quantity: 1, unitPrice
    });
    if (closeScanner) await barcodeScanner?.close();
    await refresh();
    toast(`${product.name} added to this sale.`);
    return { added: true, name: product.name, closeScanner };
  }

  function showQrDetails(rawValue) {
    const qr = classifyQrCode(rawValue);
    const overlay = document.createElement('div');
    overlay.className = 'pos-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#0009;display:grid;place-items:center;padding:16px';
    const link = qr.type === 'link' ? `<p><a href="${escapeHtml(qr.content)}" target="_blank" rel="noopener noreferrer">Open link</a></p>` : '';
    overlay.innerHTML = `<section class="pos-card" role="dialog" aria-modal="true" aria-label="QR code result"
      style="width:min(100%,520px);max-height:90vh;overflow:auto;background:#fff;color:#18181b;padding:20px;border-radius:16px">
      <h2>${escapeHtml(qr.label)}</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(qr.content)}</pre>
      ${link}<button type="button" class="btn-secondary" data-qr-close>Close</button></section>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-qr-close]').addEventListener('click', close, { once: true });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
  }

  async function openBarcodeScanner(onBarcode, { allowProductLabel = false, productForm = null, initialMode = 'barcode' } = {}) {
    if (barcodeScanner) await barcodeScanner.close();
    const overlay = document.createElement('div');
    overlay.className = 'pos-scanner-overlay';
    overlay.innerHTML = `<section class="pos-scanner-shell" role="dialog" aria-modal="true" aria-label="Scan barcode or product label">
      <video class="pos-scanner-video" autoplay muted playsinline></video>
      <div class="pos-scanner-header"><h2 data-scanner-title>Scan barcode or QR code</h2>
        <p data-scanner-instructions>Center the code in the frame. Barcodes add products; QR codes show their contents.</p></div>
      <div class="pos-scanner-frame" aria-hidden="true"></div>
      <div class="pos-scanner-footer"><p class="pos-scanner-status" data-scanner-status role="status" aria-live="polite">Starting camera…</p>
        ${allowProductLabel ? `<div class="pos-scanner-modes" role="group" aria-label="Camera scan mode">
          <button type="button" class="pos-scanner-mode is-active" data-scanner-mode="barcode" aria-pressed="true">Barcode / QR</button>
          <button type="button" class="pos-scanner-mode" data-scanner-mode="label" aria-pressed="false">Product label</button>
          ${!productForm ? '<button type="button" class="pos-scanner-mode" data-scanner-mode="match" aria-pressed="false">Photo match</button>' : ''}
        </div>` : ''}
        <div class="pos-scanner-label-result" data-scanner-label-result hidden></div>
        <button type="button" class="pos-scanner-close" data-scanner-close>Cancel scan</button></div>
    </section>`;
    document.body.appendChild(overlay);
    const video = overlay.querySelector('video');
    const status = overlay.querySelector('[data-scanner-status]');
    const session = {
      closed: false, controls: null, stream: null, mode: initialMode, ocrBusy: false, imageMatchBusy: false,
      processingCode: false, labelFramesScanned: 0, failedImageProfiles: new Set(),
      lastOcrText: '', stableOcrFrames: 0, candidate: null, close: null
    };
    session.close = async () => {
      if (session.closed) return;
      session.closed = true;
      try {
        session.controls?.stop();
        (session.stream || video.srcObject)?.getTracks().forEach((track) => track.stop());
      } finally {
        overlay.remove();
        if (barcodeScanner === session) barcodeScanner = null;
      }
    };
    barcodeScanner = session;
    overlay.querySelector('[data-scanner-close]').addEventListener('click', () => {
      void session.close().catch((error) => toast(error instanceof Error ? error.message : 'Could not stop the scanner.', true));
    }, { once: true });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        void session.close().catch((error) => toast(error instanceof Error ? error.message : 'Could not stop the scanner.', true));
      }
    });
    if (allowProductLabel) {
      overlay.querySelectorAll('[data-scanner-mode]').forEach((button) => {
        const selected = button.dataset.scannerMode === session.mode;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.addEventListener('click', () => {
          session.mode = button.dataset.scannerMode;
          overlay.querySelectorAll('[data-scanner-mode]').forEach((modeButton) => {
            const selected = modeButton === button;
            modeButton.classList.toggle('is-active', selected);
            modeButton.setAttribute('aria-pressed', String(selected));
          });
          overlay.querySelector('[data-scanner-title]').textContent =
            session.mode === 'label' ? 'Scan product label'
              : session.mode === 'match' ? 'Find a product by photo' : 'Scan barcode or QR code';
          overlay.querySelector('[data-scanner-instructions]').textContent = session.mode === 'label'
            ? 'Hold the label steady in the frame. Text is read on this device.'
            : session.mode === 'match'
            ? 'Point at one product. Matching starts automatically; tap a result to add it.'
            : 'Center the code in the frame. Barcodes add products; QR codes show their contents.';
          overlay.querySelector('[data-scanner-label-result]').hidden = true;
          session.candidate = null;
          session.lastOcrText = '';
          session.stableOcrFrames = 0;
          session.labelFramesScanned = 0;
          status.textContent = session.mode === 'label'
            ? 'Looking for clear label text…' : session.mode === 'match'
            ? 'Camera ready · automatically scanning product photos…' : 'Camera ready · hold a code inside the frame.';
        });
      });
      overlay.querySelector('[data-scanner-title]').textContent =
        session.mode === 'label' ? 'Scan product label'
          : session.mode === 'match' ? 'Find a product by photo' : 'Scan barcode or QR code';
      overlay.querySelector('[data-scanner-instructions]').textContent = session.mode === 'label'
        ? 'Hold the label steady in the frame. Text is read on this device.'
        : session.mode === 'match'
        ? 'Point at one product. Matching starts automatically; tap a result to add it.'
        : 'Center the code in the frame. Barcodes add products; QR codes show their contents.';
    }
    const handleDetected = async (barcode) => {
      if (session.closed) return;
      const value = String(barcode?.rawValue || barcode?.displayValue || '').trim();
      if (!value) return;
      const now = Date.now();
      const lastSeen = barcodeScannerLastSeen.get(value) || 0;
      barcodeScannerLastSeen.set(value, now);
      if (now - lastSeen < 1400) return;
      if (session.processingCode) return;
      if (barcodeScannerLastSeen.size > 200) {
        for (const [seenCode, seenAt] of barcodeScannerLastSeen) {
          if (now - seenAt > 60_000) barcodeScannerLastSeen.delete(seenCode);
        }
      }
      if (barcode.format === 'QR_CODE') {
        if (!productForm) {
          await session.close();
          showQrDetails(value);
          return;
        }
        session.processingCode = true;
        try {
          const result = await onBarcode(value);
          if (result?.captured || result?.closeScanner) await session.close();
        } catch (error) {
          if (!session.closed) {
            status.textContent = error instanceof Error ? error.message : 'Could not process this QR code.';
            status.dataset.state = 'error';
          }
        } finally {
          session.processingCode = false;
        }
        return;
      }
      if (barcode.format && !['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128'].includes(barcode.format)) return;
      session.processingCode = true;
      try {
        const result = await onBarcode(value);
        if (session.closed) return;
        status.textContent = result?.captured
          ? 'Barcode captured successfully.'
          : result?.added
          ? `Added ${result.name}. Scan the next item.`
          : 'Barcode not found. You can add it as a new product.';
        status.dataset.state = result?.captured || result?.added ? 'success' : 'notice';
        if (result?.captured || result?.closeScanner) await session.close();
      } catch (error) {
        if (!session.closed) {
          status.textContent = error instanceof Error ? error.message : 'Could not process this barcode.';
          status.dataset.state = 'error';
        }
      } finally {
        session.processingCode = false;
      }
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device does not provide an in-app camera preview.');
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = session.stream;
      await video.play();
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { BarcodeFormat: ZXingBarcodeFormat } = await import('@zxing/library');
      const formatMap = new Map([
        [ZXingBarcodeFormat.QR_CODE, 'QR_CODE'],
        [ZXingBarcodeFormat.EAN_13, 'EAN_13'],
        [ZXingBarcodeFormat.EAN_8, 'EAN_8'],
        [ZXingBarcodeFormat.UPC_A, 'UPC_A'],
        [ZXingBarcodeFormat.UPC_E, 'UPC_E'],
        [ZXingBarcodeFormat.CODE_128, 'CODE_128']
      ]);
      const reader = new BrowserMultiFormatReader();
      session.controls = await reader.decodeFromVideoElement(video, (result, error) => {
        if (session.mode !== 'barcode') return;
        if (result) {
          void handleDetected({
            rawValue: result.getText(),
            displayValue: result.getText(),
            format: formatMap.get(result.getBarcodeFormat())
          });
        } else if (error && error.name !== 'NotFoundException') {
          status.textContent = 'Keep the code inside the camera view.';
        }
      });
      status.textContent = session.mode === 'label'
        ? 'Looking for clear label text…'
        : session.mode === 'match'
        ? 'Camera ready · automatically scanning product photos…'
        : 'Camera ready · center a code inside the frame.';
      if (allowProductLabel) void scanLabelFrames(session, video, overlay, status, productForm);
      if (allowProductLabel && !productForm) void scanPhotoMatchFrames(session, video, overlay, status);
    } catch (error) {
      await session.close();
      const message = error instanceof Error ? error.message : 'Camera scanning could not start.';
      throw new Error(`Could not start barcode scanning: ${message}`);
    }
  }

  async function scanPhotoMatchFrames(session, video, overlay, status) {
    let lastProcessedAt = 0;
    while (!session.closed) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      const resultPanel = overlay.querySelector('[data-scanner-label-result]');
      if (session.closed || session.mode !== 'match' || session.imageMatchBusy || session.processingCode
        || video.readyState < 2 || (resultPanel && !resultPanel.hidden)
        || Date.now() - lastProcessedAt < 550) continue;
      lastProcessedAt = Date.now();
      session.imageMatchBusy = true;
      try {
        status.textContent = 'Recognizing product…';
        const imageBase64 = captureVideoFrameForVision(video, 256);
        const { plugin: vision } = await getProductVision();
        const result = await vision.embedImage({ imageBase64 });
        const profileHex = embeddingBase64ToHex(result.embedding, Number(result.dimensions));
        const embedding = Int8Array.from(profileHex.match(/.{2}/g), (byte) => {
          const value = Number.parseInt(byte, 16);
          return value > 127 ? value - 256 : value;
        });
        const products = state.products.filter((product) => product.active);
        const matches = rankImageMatches(products, embedding);
        if (!matches.length) {
          const missingProfile = products.find((product) => !product.imageEmbedding?.length
            && !session.failedImageProfiles.has(product.id) && /^data:image\//i.test(product.imageUri || ''));
          if (missingProfile) {
            status.textContent = `Preparing saved photos · ${missingProfile.name}…`;
            if (!await createProductImageEmbedding(missingProfile.id, missingProfile.imageUri)) {
              session.failedImageProfiles.add(missingProfile.id);
            }
            continue;
          }
          const savedProfiles = products.filter((product) => product.imageEmbedding?.length).length;
          status.textContent = savedProfiles
            ? 'No close match yet · keep the product centered while scanning continues.'
            : products.some((product) => product.imageUri)
              ? 'Saved photos could not be prepared. Retake the photos or use barcode scanning.'
              : 'No saved product photos yet · take and save photos in Catalogue first.';
          status.dataset.state = savedProfiles || products.some((product) => product.imageUri) ? 'notice' : 'error';
          continue;
        }
        resultPanel.innerHTML = `<strong>Choose a product</strong>${matches.map(({ product, similarity }) => `
          <button type="button" class="pos-image-match" data-image-match="${escapeHtml(product.id)}">
            ${product.imageUri ? `<img src="${escapeHtml(product.imageUri)}" alt="">` : ''}
            <span><b>${escapeHtml(product.name)}</b><small>${Math.round(similarity * 100)}% photo similarity · ${escapeHtml(product.categoryName)}</small></span>
            <b>${money(product.price, state.settings.currency)}</b>
          </button>`).join('')}
          <button type="button" class="pos-scanner-close pos-scanner-rescan" data-match-none>None of these · keep scanning</button>`;
        resultPanel.hidden = false;
        status.textContent = 'Possible matches found. Tap the correct product to add it.';
        status.dataset.state = 'success';
        resultPanel.querySelectorAll('[data-image-match]').forEach((button) => {
          button.addEventListener('click', async () => {
            const product = state.products.find((item) => String(item.id) === button.dataset.imageMatch && item.active);
            if (!product) {
              status.textContent = 'That product is no longer available. Keep scanning.';
              status.dataset.state = 'error';
              resultPanel.hidden = true;
              return;
            }
            try {
              await addProductToSale(product, true);
            } catch (error) {
              status.textContent = error instanceof Error ? error.message : 'Could not add this product.';
              status.dataset.state = 'error';
            }
          }, { once: true });
        });
        resultPanel.querySelector('[data-match-none]').addEventListener('click', () => {
          resultPanel.hidden = true;
          status.textContent = 'Keep the next product centered · scanning automatically.';
          delete status.dataset.state;
        }, { once: true });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not scan the product photo.';
        status.dataset.state = 'error';
      } finally {
        session.imageMatchBusy = false;
      }
    }
  }

  async function scanLabelFrames(session, video, overlay, status, productForm) {
    let savedProducts = [];
    let Filesystem, Directory, TextRecognition, Script;
    try {
      if (!productForm) savedProducts = (await listProducts()).filter((product) => product.active);
      [{ Filesystem, Directory }, { TextRecognition, Script }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor-mlkit/text-recognition')
      ]);
    } catch (error) {
      status.textContent = error instanceof Error ? `Label scan failed: ${error.message}` : 'Label scan failed.';
      status.dataset.state = 'error';
      return;
    }
    let lastProcessedAt = 0;
    while (!session.closed) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (session.closed || session.mode !== 'label' || session.ocrBusy || video.readyState < 2
        || Date.now() - lastProcessedAt < 700) continue;
      const resultPanel = overlay.querySelector('[data-scanner-label-result]');
      if (resultPanel && !resultPanel.hidden) continue;
      lastProcessedAt = Date.now();
      session.ocrBusy = true;
      let framePath = '';
      try {
        const maxWidth = 960;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Could not prepare a camera frame for label reading.');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL('image/jpeg', 0.78).split(',')[1];
        const frame = await Filesystem.writeFile({
          path: `label-scan-${Date.now()}.jpg`, data: frameData, directory: Directory.Cache
        });
        framePath = frame.uri;
        const result = await TextRecognition.processImage({ path: framePath, script: Script.Latin });
        const text = String(result.text || '').trim();
        if (!text) {
          status.textContent = 'Keep the label steady and in focus…';
          continue;
        }
        session.labelFramesScanned += 1;
        if (text === session.lastOcrText) session.stableOcrFrames += 1;
        else {
          session.lastOcrText = text;
          session.stableOcrFrames = 1;
        }
        const suggestions = parseProductLabel(text);
        if (!productForm) {
          const product = matchProductLabel(text, savedProducts);
          if (product) {
            await addProductToSale(product, true);
            continue;
          }
          if (session.labelFramesScanned >= 4) {
            const resultPanel = overlay.querySelector('[data-scanner-label-result]');
            resultPanel.innerHTML = `<strong>No saved product matched this label</strong>
              <p>Save this product in Catalogue first, then scan its label here.</p>
              <button type="button" class="pos-scanner-close pos-scanner-rescan" data-label-rescan>Scan again</button>`;
            resultPanel.hidden = false;
            status.textContent = 'No saved product matched. Nothing was added to the sale.';
            status.dataset.state = 'notice';
            resultPanel.querySelector('[data-label-rescan]').addEventListener('click', () => {
              session.candidate = null;
              session.lastOcrText = '';
              session.stableOcrFrames = 0;
              session.labelFramesScanned = 0;
              resultPanel.hidden = true;
              status.textContent = 'Looking for a saved product…';
              delete status.dataset.state;
            }, { once: true });
          } else {
            status.textContent = 'Reading label…';
          }
        } else if (session.stableOcrFrames >= 2 && suggestions.name) {
          session.candidate = { text, suggestions };
          showLabelSuggestions(session, overlay, status, productForm);
        } else {
          status.textContent = 'Reading label… hold it steady for a moment.';
        }
      } catch (error) {
        status.textContent = error instanceof Error ? `Label scan failed: ${error.message}` : 'Label scan failed.';
        status.dataset.state = 'error';
      } finally {
        if (framePath) {
          await Filesystem.deleteFile({ path: framePath }).catch((error) => {
            console.warn('Could not remove temporary label-scan frame.', error);
          });
        }
        session.ocrBusy = false;
      }
    }
  }

  function showLabelSuggestions(session, overlay, status, productForm) {
    const result = overlay.querySelector('[data-scanner-label-result]');
    const { text, suggestions } = session.candidate;
    result.innerHTML = productForm
      ? `<strong>Product name found</strong><p>${escapeHtml(suggestions.name || '')}</p>
        <button type="button" class="pos-scanner-close pos-scanner-rescan" data-label-rescan>Scan again</button>
        <button type="button" class="pos-scanner-close pos-scanner-confirm" data-label-confirm>Use details</button>`
      : `<strong>Label read · check these details</strong>
        <label>Name<input data-label-name value="${escapeHtml(suggestions.name || '')}" maxlength="200"></label>
        <label>Price<input data-label-price type="number" min="0" step="0.01" value="${suggestions.price ?? ''}"></label>
        <label>Expiry date<input data-label-expiry type="date" value="${escapeHtml(suggestions.expiryDate || '')}"></label>
        <details><summary>Recognized text</summary><pre>${escapeHtml(text.slice(0, 1600))}</pre></details>
        <button type="button" class="pos-scanner-close pos-scanner-rescan" data-label-rescan>Scan another label</button>
        <button type="button" class="pos-scanner-close pos-scanner-confirm" data-label-confirm>Add product to sale</button>`;
    result.hidden = false;
    status.textContent = 'Label scanned successfully.';
    status.dataset.state = 'success';
    result.querySelector('[data-label-rescan]').addEventListener('click', () => {
      session.candidate = null;
      session.lastOcrText = '';
      session.stableOcrFrames = 0;
      result.hidden = true;
      status.textContent = 'Looking for clear label text…';
      delete status.dataset.state;
    }, { once: true });
    result.querySelector('[data-label-confirm]').addEventListener('click', async () => {
      if (productForm) {
        const name = String(session.candidate?.suggestions.name || '').trim();
        if (!name) {
          status.textContent = 'No product name was recognized. Scan again or enter it manually.';
          status.dataset.state = 'error';
          return;
        }
        productForm.elements.name.value = name;
        const nameStatus = productForm.querySelector('[data-product-ocr-status]');
        if (nameStatus) nameStatus.textContent = 'Product name filled from the label. Enter the remaining details below.';
        await session.close();
        return;
      }
      const data = {
        name: result.querySelector('[data-label-name]').value.trim(),
        price: result.querySelector('[data-label-price]').value,
        expiryDate: result.querySelector('[data-label-expiry]').value
      };
      try {
        if (!data.name || data.price === '' || !Number.isFinite(Number(data.price)) || Number(data.price) < 0) {
          throw new Error('Check that the product name and price are valid before adding it.');
        }
        const categoryId = state.categories.find((category) => category.name.toLowerCase() === 'general')?.id
          || state.categories[0]?.id;
        if (!categoryId) throw new Error('Create a product category before adding a scanned label.');
        const productId = await saveProduct({
          name: data.name, price: data.price, expiryDate: data.expiryDate, categoryId,
          stock: '', buyingPrice: '', lowStockThreshold: 3, active: true
        });
        const product = (await listProducts()).find((item) => item.id === productId);
        if (!product) throw new Error('The product was saved but could not be loaded into this sale.');
        await queueProduct(product);
        state.cart.push({ productId, name: product.name, quantity: 1, unitPrice: product.price });
        await session.close();
        await refresh();
        toast(`${product.name} added to this sale.`);
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not add the scanned product.';
        status.dataset.state = 'error';
      }
    }, { once: true });
  }

  const barcodeScannerLastSeen = new Map();

  async function handleScannerKeydown(event) {
    const input = event.target.closest('[data-pos-barcode-input]');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    const code = input.value.trim();
    input.value = '';
    if (!code) return;
    try {
      await addScannedBarcode(code);
      document.querySelector?.('[data-pos-barcode-input]')?.focus();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not add the scanned product.', true);
    }
  }

  async function handleClick(event) {
    const target = event.target.closest('[data-pos-action]');
    if (!target) return;
    const action = target.dataset.posAction;
    const id = Number(target.dataset.id || 0);
    try {
      if (action === 'scan-barcode') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        await openBarcodeScanner(async (code) => {
          if (code.length > 120) throw new Error('Barcode is too long to save as a product code.');
          form.elements.barcode.value = code;
          const result = form.querySelector('[data-product-barcode-status]');
          if (result) result.textContent = `Barcode ${code} captured successfully. Complete the product details and save.`;
          toast(`Barcode ${code} captured.`);
          return { captured: true };
        }, { allowProductLabel: true, productForm: form });
        return;
      } else if (action === 'take-product-photo') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        const status = form.querySelector('[data-product-image-capture-status]');
        const preview = form.querySelector('[data-product-image-preview]');
        if (status) status.textContent = 'Opening camera…';
        try {
          const imageUri = await captureProductPhoto();
          if (!imageUri) {
            if (status) status.textContent = 'Photo capture cancelled. Your product details were not changed.';
            return;
          }
          form.elements.capturedProductImage.value = imageUri;
          if (preview) {
            preview.src = imageUri;
            preview.hidden = false;
          }
          if (status) status.textContent = 'Photo captured. Save the product to keep it and create its image match profile.';
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not take a product photo.';
          if (status) status.textContent = message;
          toast(message, true);
        }
        return;
      } else if (action === 'suggest-image-category') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        const status = form.querySelector('[data-product-image-status]');
        const suggestions = form.querySelector('[data-image-category-suggestions]');
        const selectedImage = form.elements?.imageFile?.files?.[0];
        const dataUrl = await readImageFile(selectedImage) || form.elements.imageUri.value.trim();
        if (!dataUrl.startsWith('data:image/')) {
          if (status) status.textContent = 'Upload a product photo first to get an offline category suggestion.';
          toast('Upload a product photo first to get an offline category suggestion.', true);
          return;
        }
        if (status) status.textContent = 'Reading image labels on this device…';
        let ranked;
        let labels;
        try {
          const imageBase64 = await prepareImageForVision(dataUrl);
          const { plugin: vision } = await getProductVision();
          const result = await vision.labelImage({ imageBase64 });
          labels = result.labels || [];
          ranked = suggestImageCategories(labels, state.categories);
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : 'Could not read the product photo.';
          toast(error instanceof Error ? error.message : 'Could not read the product photo.', true);
          return;
        }
        if (!ranked.length) {
          if (suggestions) {
            suggestions.hidden = true;
            suggestions.replaceChildren();
          }
          if (status) status.textContent = 'No existing category matched the image labels. Choose a category manually.';
          return;
        }
        if (suggestions) {
          suggestions.innerHTML = ranked.map((item) =>
            `<button type="button" class="btn-secondary" data-image-category="${escapeHtml(item.categoryId)}">${escapeHtml(item.categoryName)}
              <small>${escapeHtml(item.label)} · ${Math.round(item.score * 100)}%</small></button>`).join('');
          suggestions.hidden = false;
          suggestions.querySelectorAll('[data-image-category]').forEach((button) => {
            button.addEventListener('click', () => {
              form.elements.categoryId.value = button.dataset.imageCategory;
              if (status) status.textContent = `${button.textContent.trim()} selected as a suggestion. Review it before saving.`;
              suggestions.hidden = true;
            });
          });
        }
        if (status) status.textContent = `Image labels: ${labels.slice(0, 3).map((label) => label.text).join(', ')}. Tap a suggested existing category to select it.`;
        return;
      } else if (action === 'scan-product-label') {
        const form = target.closest('form[data-pos-form="product"]');
        if (!form) return;
        await openBarcodeScanner(async () => null, {
          allowProductLabel: true, productForm: form, initialMode: 'label'
        });
        return;
      } else if (action === 'scan-sale-barcode') {
        await openBarcodeScanner(addScannedBarcode, { allowProductLabel: true });
        return;
      } else if (action === 'checkout-method') {
        const method = target.dataset.method;
        if (!PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');
        state.paymentMethod = method;
        await refresh();
      } else if (action === 'park-ticket') {
        if (!state.cart.length) throw new Error('Add products before parking this order.');
        const existing = state.tickets.find((item) => item.id === state.activeTicketId);
        const name = prompt('Order name (optional)', existing?.name || '');
        if (name === null) return;
        const id = state.activeTicketId || `TICKET-${crypto.randomUUID().replace(/-/g, '')}`;
        const ticket = {
          id, name: String(name).trim().slice(0, 100), items: state.cart.map((item) => ({ ...item })),
          discount: Number(state.discount) || 0, customerName: existing?.customerName || '',
          customerPhone: existing?.customerPhone || '', createdAt: existing?.createdAt || nowIso(),
          updatedAt: nowIso()
        };
        await queueCloudRecord('ticket', id, ticket);
        state.cart = [];
        state.discount = 0;
        state.paymentMethod = '';
        state.activeTicketId = '';
        toast('Order parked.');
        await refresh();
      } else if (action === 'resume-ticket') {
        const ticket = state.tickets.find((item) => item.id === target.dataset.recordId);
        if (!ticket) throw new Error('This parked order is no longer available.');
        if (state.cart.length && !confirm('Replace the current sale with this parked order?')) return;
        state.cart = ticket.items.map((item) => ({ ...item }));
        state.discount = Number(ticket.discount) || 0;
        state.activeTicketId = ticket.id;
        state.paymentMethod = '';
        window.location.hash = '#/pos';
        await refresh();
      } else if (action === 'delete-ticket') {
        const recordId = target.dataset.recordId || '';
        if (!recordId || !confirm('Delete this parked order?')) return;
        await queueCloudRecord('ticket', recordId, { id: recordId }, true);
        toast('Parked order deleted.');
        await refresh();
      } else if (action === 'delete-supplier') {
        const recordId = target.dataset.recordId || '';
        if (!recordId || !confirm('Delete this supplier? Existing purchase orders will keep their supplier details.')) return;
        await queueCloudRecord('supplier', recordId, { id: recordId }, true);
        toast('Supplier deleted.');
        await refresh();
      } else if (action === 'receive-purchase') {
        const recordId = target.dataset.recordId || '';
        if (!confirm('Receive this purchase order and add the quantities to stock?')) return;
        await receivePurchaseOrder(recordId);
        toast('Purchase order received; stock updated.');
        await refresh();
      } else if (action === 'toggle-cloud-sync') {
        if (state.settings.cloudSyncEnabled) {
          await transaction([
            stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_enabled','0')", []),
            stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
          ]);
          toast('Cloud sync disabled. Local data remains on this device.');
        } else {
          if (!confirm('Enable cloud backup and sync for this shop? This saves this device’s POS products, stock, categories, expenses, suppliers, purchase orders, parked orders, settings, and receipts to your shop’s cloud account and shares them with your other registers. Product and expense details, plus customer names and phone numbers on receipts, will be sent. Local data stays on this device too.')) return;
          const tenantId = window.EshopInventoryBridge?.activeWebsiteId?.();
          if (!tenantId || typeof window.EshopInventoryBridge?.syncPosRecords !== 'function') {
            throw new Error('Select an active Cloudflare website in Studio first.');
          }
          await window.EshopInventoryBridge.syncPosRecords(tenantId, 'GET', { after: 0, limit: 1 });
          const previousScope = state.cloudScopeId;
          await transaction([
            stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_tenant_id',?)", [tenantId]),
            stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_enabled','1')", []),
            stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
          ]);
          state.settings = await getSettings();
          state.cloudScopeId = tenantId;
          if (previousScope !== tenantId) {
            for (const entity of ['supplier', 'purchase', 'ticket']) {
              for (const record of await listBusinessRecords(entity, previousScope)) {
                await saveBusinessRecord(entity, record.id, record, false, 0, tenantId);
              }
            }
          }
          await seedCloudCatalogueForTenant(tenantId);
          await syncCloudBusinessRecords();
          toast('Cloud backup and sync enabled.');
        }
        await refresh();
      } else if (action === 'nearby-bt-host') {
        try {
          await startBluetoothNearbySync('host');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Bluetooth sync failed: ${error.message}` : 'Bluetooth sync failed.');
          throw error;
        }
      } else if (action === 'nearby-bt-find') {
        try {
          await startBluetoothNearbySync('find');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Bluetooth sync failed: ${error.message}` : 'Bluetooth sync failed.');
          throw error;
        }
      } else if (action === 'nearby-sync-create') {
        target.disabled = true;
        target.textContent = 'Preparing QR…';
        try {
          await startNearbySync('create');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Nearby sync failed: ${error.message}` : 'Nearby sync failed. Check the shop selection, camera access, and Wi-Fi connection.');
          throw error;
        } finally {
          const button = document.querySelector('[data-pos-action="nearby-sync-create"]');
          if (button) {
            button.disabled = false;
            button.textContent = 'Create pairing QR';
          }
        }
      } else if (action === 'nearby-sync-join') {
        target.disabled = true;
        target.textContent = 'Opening camera…';
        try {
          await startNearbySync('join');
        } catch (error) {
          await stopNearbySync(error instanceof Error ? `Nearby sync failed: ${error.message}` : 'Nearby sync failed. Check the shop selection, camera access, and Wi-Fi connection.');
          throw error;
        } finally {
          const button = document.querySelector('[data-pos-action="nearby-sync-join"]');
          if (button) {
            button.disabled = false;
            button.textContent = 'Scan pairing QR';
          }
        }
      } else if (action === 'nearby-sync-stop') {
        await stopNearbySync();
        await refresh();
      } else if (action === 'sync-cloud-now') {
        await syncCloudBusinessRecords();
        if (state.cloudSyncError) toast(`Cloud save and sync failed: ${state.cloudSyncError}`, true);
        else toast('Cloud save and sync complete.');
        await refresh();
      } else if (action === 'cancel-sale') {
        if (!state.cart.length) return;
        if (!confirm('Cancel this sale and clear all items?')) return;
        state.cart = [];
        state.paymentMethod = '';
        state.discount = 0;
        await refresh();
        toast('Sale cancelled.');
      } else if (action === 'add-cart') {
        const product = state.products.find((item) => item.id === id);
        if (!product || !product.active) throw new Error('This product is no longer available.');
        const existing = state.cart.find((item) => item.productId === id);
        if (existing) existing.quantity = Math.min(99999, existing.quantity + 1);
        else state.cart.push({ productId: id, name: product.name, quantity: 1, unitPrice: product.price });
        await refresh();
      } else if (action === 'cart-plus' || action === 'cart-minus') {
        state.cart = state.cart.flatMap((item) => {
          if (item.productId !== id) return [item];
          const quantity = item.quantity + (action === 'cart-plus' ? 1 : -1);
          return quantity > 0 ? [{ ...item, quantity }] : [];
        });
        await refresh();
      } else if (action === 'toggle-sale') {
        state.expandedSale = state.expandedSale === id ? 0 : id;
        await refresh();
      } else if (action === 'delete-product') {
        if (confirm('Delete this POS product? Saved receipts will keep their original line details.')) {
          const product = state.products.find((item) => item.id === id);
          if (!product) throw new Error('This product is no longer available.');
          await run('DELETE FROM pos_products WHERE id=?', [id]);
          await queueProduct(product, true);
          toast('Product deleted.');
          await refresh();
        }
      } else if (action === 'rename-category') {
        const category = state.categories.find((item) => item.id === id);
        const name = prompt('Category name', category?.name || '');
        if (name === null) return;
        if (!name.trim() || category?.name.toLowerCase() === 'other') throw new Error('Enter a valid category name.');
        await queueCategory(category, true);
        await run('UPDATE pos_categories SET name=? WHERE id=?', [name.trim(), id]);
        const renamed = (await listCategories()).find((item) => item.id === id);
        await queueCategory(renamed);
        for (const product of (await listProducts()).filter((item) => item.categoryId === id)) await queueProduct(product);
        toast('Category renamed.');
        await refresh();
      } else if (action === 'delete-category') {
        const category = state.categories.find((item) => item.id === id);
        if (!category || category.name.toLowerCase() === 'other') throw new Error('The default category cannot be deleted.');
        const count = state.products.filter((item) => item.categoryId === id).length;
        if (!confirm(`Delete ${category.name}? ${count ? 'Its products will move to Other.' : ''}`)) return;
        const fallback = state.categories.find((item) => item.name.toLowerCase() === 'other');
        await transaction([
          ...(fallback ? [stmt('UPDATE pos_products SET category_id=? WHERE category_id=?', [fallback.id, id])] : []),
          stmt('DELETE FROM pos_categories WHERE id=?', [id])
        ]);
        await queueCategory(category, true);
        if (fallback) {
          for (const product of (await listProducts()).filter((item) => item.categoryId === fallback.id)) {
            await queueProduct(product);
          }
        }
        toast('Category deleted.');
        await refresh();
      } else if (action === 'invoice-add') {
        const product = state.products.find((item) => item.id === id);
        if (!product) throw new Error('This product could not be found.');
        const found = state.invoiceItems.find((item) => item.productId === id);
        if (found) found.quantity = Math.min(99999, found.quantity + 1);
        else state.invoiceItems.push({ productId: id, name: product.name, quantity: 1, unitPrice: product.price });
        await refresh();
      } else if (action === 'invoice-remove') {
        state.invoiceItems.splice(Number(target.dataset.index), 1);
        await refresh();
      } else if (action.startsWith('instance-')) {
        const operation = action.replace('instance-', '');
        if (operation === 'stop' && !confirm('Stop and save this business instance?')) return;
        await updateInstance(target.dataset.id, operation);
        toast('Instance updated.');
        await refresh();
      } else if (action === 'delete-expense') {
        if (!confirm('Delete this expense?')) return;
        const expense = (await listExpenses()).find((item) => item.id === id);
        if (!expense) throw new Error('This expense is no longer available.');
        await run('DELETE FROM pos_expenses WHERE id=?', [id]);
        await queueExpense(expense, true);
        toast('Expense deleted.');
        await refresh();
      } else if (action === 'edit-expense') {
        window.location.hash = `#/pos/settings?expense=${id}`;
      } else if (action === 'print-sale') {
        const sale = state.sales.find((item) => item.id === id);
        if (sale) printDocument('Receipt', receiptHtml(sale));
      } else if (action === 'print-invoice') {
        const invoice = state.invoices.find((item) => item.id === id);
        if (invoice) printDocument('Invoice', invoiceHtml(invoice));
      } else if (action === 'backup-export') {
        await exportInventory();
        toast('Inventory backup downloaded.');
      } else if (action === 'sync-product-details') {
        const product = state.products.find((item) => item.id === id);
        if (!product || !product.sku) throw new Error('This product needs a SKU before its details can be synced.');
        const websiteId = window.EshopInventoryBridge?.activeWebsiteId?.();
        if (!websiteId || typeof window.EshopInventoryBridge?.syncProductDetails !== 'function')
          throw new Error('The active local website draft is unavailable.');
        const { imageEmbedding, ...webProduct } = product;
        await window.EshopInventoryBridge.syncProductDetails(websiteId, webProduct);
        toast('Product details saved to the active website draft.');
        await refresh();
      } else if (action === 'sync-shared-stock') {
        const result = await syncSharedStock(target.dataset.source);
        toast(result.localOnly
          ? `${result.count} website product${result.count === 1 ? '' : 's'} loaded into this device's POS. Cloud stock sharing is separate.`
          : `${result.count} matching products connected${result.pending ? ` · ${result.pending} sale${result.pending === 1 ? '' : 's'} waiting to sync` : ''}.`);
      } else if (action === 'snooze-alert' || action === 'dismiss-alert') {
        const key = String(target.dataset.key || '');
        if (!key) throw new Error('This insight alert could not be identified.');
        const preferences = state.settings.insightPreferences;
        const next = action === 'dismiss-alert'
          ? { dismissed: [...new Set([...preferences.dismissed, key])], snoozed: { ...preferences.snoozed } }
          : { dismissed: preferences.dismissed.filter((item) => item !== key),
            snoozed: { ...preferences.snoozed, [key]: Date.now() + 24 * 60 * 60 * 1000 } };
        await saveInsightPreferences(next);
        toast(action === 'dismiss-alert' ? 'Alert dismissed.' : 'Alert snoozed for 24 hours.');
        await refresh();
      } else if (action === 'restore-alerts') {
        await saveInsightPreferences({ dismissed: [], snoozed: {} });
        toast('Dismissed alerts restored.');
        await refresh();
      } else if (action === 'clear-revenue-goal') {
        await transaction([
          stmt('DELETE FROM pos_settings WHERE key=?', ['monthly_revenue_goal_cents']),
          stmt('DELETE FROM pos_settings WHERE key=?', ['monthly_revenue_goal_currency'])
        ]);
        toast('Monthly revenue goal removed.');
        await refresh();
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'POS action failed.', true);
    }
  }

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

  function receiptHtml(sale) {
    return `<h1>E-Shop · Receipt</h1><p>${escapeHtml(sale.receipt_number)} · ${new Date(sale.created_at).toLocaleString()}</p>
      <p>${escapeHtml(sale.customer_name || '')} ${escapeHtml(sale.customer_phone || '')}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${sale.items.map((item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice, sale.currency)}</td><td>${money(item.quantity * item.unitPrice, sale.currency)}</td></tr>`).join('')}
      </tbody></table><p>Subtotal ${money(sale.subtotal, sale.currency)} · Discount ${money(sale.discount, sale.currency)} · Tax ${money(sale.tax, sale.currency)}</p>
      <p class="total">${sale.paid ? 'Paid' : 'Balance'} · ${money(sale.total - sale.amountPaid, sale.currency)}</p>`;
  }

  function invoiceHtml(invoice) {
    return `<h1>E-Shop · Invoice</h1><p>${escapeHtml(invoice.invoice_number)} · ${new Date(invoice.created_at).toLocaleDateString()}</p>
      <p>Bill to: ${escapeHtml(invoice.customer_name)} ${escapeHtml(invoice.customer_contact)}</p>
      ${invoice.due_date ? `<p>Due: ${escapeHtml(invoice.due_date)}</p>` : ''}
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${invoice.items.map((item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice, invoice.currency)}</td><td>${money(item.quantity * item.unitPrice, invoice.currency)}</td></tr>`).join('')}
      </tbody></table><p>Subtotal ${money(invoice.subtotal, invoice.currency)} · Tax ${money(invoice.tax, invoice.currency)}</p>
      <p class="total">Amount due · ${money(invoice.total, invoice.currency)}</p><p>${escapeHtml(invoice.notes)}</p>`;
  }

  function handleInput(event) {
    const discount = event.target.closest('[data-pos-discount]');
    if (discount) {
      state.discount = discount.value === '' ? 0 : Number(discount.value);
      if (event.type === 'change') void refresh();
      return;
    }
    const searchInput = event.target.closest('.pos-filter-row input[name="search"]');
    if (searchInput) {
      state.search = searchInput.value.trim().toLocaleLowerCase();
      const productGrid = document.getElementById('pos-product-grid');
      if (productGrid) productGrid.innerHTML = renderProductTiles();
    }
    const categorySelect = event.target.closest('.pos-filter-row select[name="category"]');
    if (categorySelect) {
      state.category = categorySelect.value;
      const productGrid = document.getElementById('pos-product-grid');
      if (productGrid) productGrid.innerHTML = renderProductTiles();
    }
    const quantity = event.type === 'change' ? event.target.closest('[data-pos-quantity]') : null;
    if (quantity) {
      const item = state.cart.find((row) => row.productId === Number(quantity.dataset.posQuantity));
      const next = Number(quantity.value);
      if (item && Number.isSafeInteger(next) && next > 0 && next <= 99999) {
        item.quantity = next;
        void refresh();
      }
    }
    const invoiceQuantity = event.target.closest('[data-invoice-qty]');
    if (invoiceQuantity) {
      const item = state.invoiceItems[Number(invoiceQuantity.dataset.invoiceQty)];
      const next = Number(invoiceQuantity.value);
      if (item && Number.isSafeInteger(next) && next > 0 && next <= 99999) {
        item.quantity = next;
        void refresh();
      }
    }
    const invoicePrice = event.target.closest('[data-invoice-price]');
    if (invoicePrice) {
      const item = state.invoiceItems[Number(invoicePrice.dataset.invoicePrice)];
      const next = Number(invoicePrice.value);
      if (item && Number.isFinite(next) && next >= 0) {
        item.unitPrice = next;
        void refresh();
      }
    }
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    await initializePosDatabase();
    await loadState();
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleScannerKeydown);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleInput);
    document.addEventListener('change', handleFileChange);
    window.addEventListener('online', () => {
      void syncInventorySales().then(() => refresh()).catch((error) => {
        toast(error instanceof Error ? error.message : 'Could not sync POS inventory.', true);
      });
    });
    window.setInterval(() => {
      if (navigator.onLine !== false && state.sharedTenantId) {
        void syncInventorySales().then(() => refresh()).catch((error) => {
          toast(error instanceof Error ? error.message : 'Could not sync POS inventory.', true);
        });
      }
    }, 30000);
    void syncInventorySales();
    void syncCloudBusinessRecords().catch((error) => {
      state.cloudSyncError = error instanceof Error ? error.message : 'Cloud sync failed.';
    });
    window.addEventListener('online', () => {
      void syncCloudBusinessRecords().then(() => refresh()).catch((error) => {
        state.cloudSyncError = error instanceof Error ? error.message : 'Cloud sync failed.';
      });
    });
    window.setInterval(() => {
      if (state.settings?.cloudSyncEnabled && document.visibilityState !== 'hidden') {
        void syncCloudBusinessRecords().then(() => {
          const path = (window.location.hash || '').slice(1).split('?')[0];
          if (['/pos', '/pos/catalogue', '/pos/catalogue/products', '/pos/catalogue/suppliers',
            '/pos/orders', '/pos/sales'].includes(path)) return refresh();
          return undefined;
        }).catch((error) => {
          state.cloudSyncError = error instanceof Error ? error.message : 'Cloud sync failed.';
        });
      }
    }, 5000);
    const closeScannerOnLeave = () => {
      if (barcodeScanner) {
        void barcodeScanner.close().catch((error) => toast(error instanceof Error ? error.message : 'Could not stop the scanner.', true));
      }
    };
    window.addEventListener('pagehide', closeScannerOnLeave);
    window.addEventListener('hashchange', () => {
      closeScannerOnLeave();
      if ((window.location.hash || '').slice(1).split('?')[0].startsWith('/pos')) void refresh();
    });
    window.setInterval(() => {
      if ((window.location.hash || '').slice(1).split('?')[0] === '/pos/instances') void refresh();
    }, 15000);
  }

  return {
    init, render, refresh, recordSharedLocalSale, syncInventory: syncInventorySales,
    recordSharedStockUpdate, saveProduct, listProducts, listCategories, listSales, listExpenses, listInstances,
    getCloudSyncStatus, syncCloudNow, switchCloudSyncTenant, replaceWithCloudShop, disconnectCloudSync, stopNearbySync,
    getSettings, addCategory, deleteProduct, listBusinessRecords, findProductByCode, addScannedBarcode
  };
}
