// Creates and upgrades the till's local SQLite tables.
import { rows, run } from './db.js';
import { recoverInterruptedBulkChange } from './safety-copy.js';

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
      taxonomy_category_id TEXT,
      taxonomy_custom_category TEXT,
      taxonomy_attributes_json TEXT NOT NULL DEFAULT '[]',
      variants_json TEXT NOT NULL DEFAULT '[]',
      priced_attributes_json TEXT NOT NULL DEFAULT '[]',
      image_embedding BLOB,
      low_stock_threshold INTEGER NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      duration_minutes INTEGER,
      supplier_id TEXT,
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
      unit_cost_captured INTEGER NOT NULL DEFAULT 0,
      variant_id TEXT,
      variant_label TEXT,
      attributes_json TEXT,
      attributes_label TEXT
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
    CREATE UNIQUE INDEX IF NOT EXISTS pos_sale_payments_mpesa_ref_unique
      ON pos_sale_payments(mpesa_ref) WHERE mpesa_ref IS NOT NULL AND mpesa_ref != '';
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
      status TEXT NOT NULL DEFAULT 'unpaid',
      paid_at TEXT,
      sale_receipt TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_contact TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      subtotal_cents INTEGER NOT NULL,
      tax_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      invoice_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pos_quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL REFERENCES pos_quotations(id) ON DELETE CASCADE,
      product_id INTEGER,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL
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
  // A reload or crash in the middle of a bulk rewrite leaves safety copies behind: undo the
  // half-finished rewrite before anything reads or migrates the tables.
  if (await recoverInterruptedBulkChange()) {
    console.warn('An interrupted POS data rewrite was rolled back from its safety copy.');
  }
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
  if (!productColumns.some((column) => column.name === 'taxonomy_category_id')) {
    await run('ALTER TABLE pos_products ADD COLUMN taxonomy_category_id TEXT');
  }
  if (!productColumns.some((column) => column.name === 'taxonomy_custom_category')) {
    await run('ALTER TABLE pos_products ADD COLUMN taxonomy_custom_category TEXT');
  }
  if (!productColumns.some((column) => column.name === 'taxonomy_attributes_json')) {
    await run("ALTER TABLE pos_products ADD COLUMN taxonomy_attributes_json TEXT NOT NULL DEFAULT '[]'");
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
  if (!productColumns.some((column) => column.name === 'duration_minutes')) {
    await run('ALTER TABLE pos_products ADD COLUMN duration_minutes INTEGER');
  }
  if (!productColumns.some((column) => column.name === 'supplier_id')) {
    await run('ALTER TABLE pos_products ADD COLUMN supplier_id TEXT');
  }
  if (!productColumns.some((column) => column.name === 'priced_attributes_json')) {
    await run("ALTER TABLE pos_products ADD COLUMN priced_attributes_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!productColumns.some((column) => column.name === 'variants_json')) {
    await run("ALTER TABLE pos_products ADD COLUMN variants_json TEXT NOT NULL DEFAULT '[]'");
  }
  const saleItemColumns = await rows('PRAGMA table_info(pos_sale_items)');
  if (!saleItemColumns.some((column) => column.name === 'variant_id')) {
    await run('ALTER TABLE pos_sale_items ADD COLUMN variant_id TEXT');
  }
  if (!saleItemColumns.some((column) => column.name === 'variant_label')) {
    await run('ALTER TABLE pos_sale_items ADD COLUMN variant_label TEXT');
  }
  if (!saleItemColumns.some((column) => column.name === 'attributes_json')) {
    await run('ALTER TABLE pos_sale_items ADD COLUMN attributes_json TEXT');
  }
  if (!saleItemColumns.some((column) => column.name === 'attributes_label')) {
    await run('ALTER TABLE pos_sale_items ADD COLUMN attributes_label TEXT');
  }
  const invoiceColumns = await rows('PRAGMA table_info(pos_invoices)');
  if (!invoiceColumns.some((column) => column.name === 'status')) {
    await run("ALTER TABLE pos_invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'unpaid'");
  }
  if (!invoiceColumns.some((column) => column.name === 'paid_at')) {
    await run('ALTER TABLE pos_invoices ADD COLUMN paid_at TEXT');
  }
  if (!invoiceColumns.some((column) => column.name === 'sale_receipt')) {
    await run('ALTER TABLE pos_invoices ADD COLUMN sale_receipt TEXT');
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

export { initializePosDatabase };
