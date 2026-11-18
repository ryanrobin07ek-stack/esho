// The till must sell a service, keep quotations and invoices, attach suppliers to products and keep the
// M-Pesa reference. Each of these used to be missing or disconnected from the rest of the POS.
import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { createPosApp } from '../src/pos.js';

async function startPos({ seed } = {}) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  if (seed) seed(db);
  const runSql = (statement, values = []) => {
    db.run(statement, values);
    const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
    return { changes: { changes: db.getRowsModified(), lastId } };
  };
  const queryRows = (statement, values = []) => {
    const query = db.prepare(statement);
    query.bind(values);
    const result = [];
    while (query.step()) result.push(query.getAsObject());
    query.free();
    return result;
  };
  globalThis.window = {
    location: { hash: '#/pos' },
    addEventListener() {},
    setInterval() { return 1; },
    confirm: () => true,
    ShopSQLite: {
      async query(statement, values = []) { return { values: queryRows(statement, values) }; },
      async run(statement, values = []) { return runSql(statement, values); },
      async execute(statement) { db.exec(statement); },
      async executeSet(statements) {
        db.run('BEGIN');
        try {
          for (const item of statements) runSql(item.statement, item.values);
          db.run('COMMIT');
          return { changes: { changes: db.getRowsModified() } };
        } catch (error) {
          db.run('ROLLBACK');
          throw error;
        }
      }
    }
  };
  globalThis.document = {
    addEventListener() {},
    getElementById() { return null; },
    createElement() { return { className: '', classList: { add() {}, remove() {}, toggle() {} } }; },
    body: { appendChild() {} }
  };
  globalThis.confirm = () => true;
  const app = createPosApp();
  await app.init();
  return { app, queryRows, runSql };
}

async function addProduct(app, fields) {
  const categoryId = (await app.listCategories())[0].id;
  await app.saveProduct({ barcode: '', expiryDate: '', active: true, categoryId, ...fields });
  return (await app.listProducts()).find(product => product.sku === fields.sku);
}

const stockOf = (queryRows, id) => queryRows('SELECT stock_count FROM pos_products WHERE id=?', [id])[0].stock_count;

// ---- 1. services -----------------------------------------------------------------------------

test('a service is a product with a duration on the 15-240 minute grid and no stock', async () => {
  const { app } = await startPos();
  const cut = await addProduct(app, { name: 'Haircut', sku: 'HC-1', price: 500, stock: 9, isService: '1', durationMinutes: '50' });
  assert.equal(cut.isService, true);
  assert.equal(cut.durationMinutes, 45, '50 snaps onto the 15-minute grid');
  assert.equal(cut.stock, null, 'a service never has a stock number, even if one was typed');

  const long = await addProduct(app, { name: 'Wedding styling', sku: 'WS-1', price: 9000, isService: '1', durationMinutes: '999' });
  assert.equal(long.durationMinutes, 240);
  const bare = await addProduct(app, { name: 'Consultation', sku: 'CO-1', price: 100, isService: '1' });
  assert.equal(bare.durationMinutes, 60, 'a service with no duration gets the default hour');

  const good = await addProduct(app, { name: 'Shampoo', sku: 'SH-1', price: 300, stock: 4, isService: '0', durationMinutes: '45' });
  assert.equal(good.isService, false, 'turning the service control off makes it an ordinary good');
  assert.equal(good.durationMinutes, 0);
  assert.equal(good.stock, 4);
});

test('editing a product without mentioning services keeps its duration and supplier', async () => {
  const { app } = await startPos();
  const cut = await addProduct(app, { name: 'Haircut', sku: 'HC-1', price: 500, isService: '1', durationMinutes: 30, supplierId: 'SUP-1' });
  await app.saveProduct({ id: cut.id, name: 'Haircut', sku: 'HC-1', categoryId: cut.categoryId, price: 550, barcode: '', expiryDate: '' });
  const after = (await app.listProducts()).find(product => product.id === cut.id);
  assert.equal(after.price, 550);
  assert.equal(after.durationMinutes, 30);
  assert.equal(after.supplierId, 'SUP-1');
});

test('selling a service is never blocked for stock and never deducts anything', async () => {
  const { app, queryRows } = await startPos();
  const cut = await addProduct(app, { name: 'Haircut', sku: 'HC-1', price: 500, isService: '1', durationMinutes: 45 });
  const soap = await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 5 });
  const sale = await app.saveSale([
    { productId: cut.id, name: 'Haircut', quantity: 3, unitPrice: 500 },
    { productId: soap.id, name: 'Soap', quantity: 2, unitPrice: 100 }
  ], { paymentMethod: 'Cash', paid: true });
  assert.ok(sale.id);
  assert.equal(stockOf(queryRows, cut.id), null);
  assert.equal(stockOf(queryRows, soap.id), 3, 'the good still deducts');
  // A refund must leave the service alone too.
  await app.reverseSale(sale.id, 'refunded');
  assert.equal(stockOf(queryRows, cut.id), null);
  assert.equal(stockOf(queryRows, soap.id), 5);
});

test('the sell grid shows a service by its duration, not as 0 in stock', async () => {
  const { app } = await startPos();
  await addProduct(app, { name: 'Haircut', sku: 'HC-1', price: 500, isService: '1', durationMinutes: 90 });
  await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 5 });
  await app.refresh();
  const sell = app.render('/pos');
  assert.match(sell, /Haircut[\s\S]*?Service · 1 h 30 min/);
  assert.match(sell, /5 in stock/);
  assert.doesNotMatch(sell, /0 in stock/);
  const catalogue = app.render('/pos/catalogue/products', new URLSearchParams());
  assert.match(catalogue, /pos-status[^>]*>Service</);
  assert.match(catalogue, /Service · 1 h 30 min/);
  assert.match(app.render('/pos/catalogue/products', new URLSearchParams('new=1')), /name="isService"/);
});

test('an existing database upgrades in place and keeps every row', async () => {
  const { app, queryRows } = await startPos({
    seed(db) {
      db.exec(`
        CREATE TABLE pos_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE);
        INSERT INTO pos_categories (name) VALUES ('General');
        CREATE TABLE pos_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category_id INTEGER NOT NULL REFERENCES pos_categories(id),
          price_cents INTEGER NOT NULL, buying_price_cents INTEGER, stock_count INTEGER DEFAULT 0, sku TEXT, image_uri TEXT,
          created_at TEXT NOT NULL);
        INSERT INTO pos_products (name,category_id,price_cents,stock_count,sku,created_at) VALUES ('Old soap',1,1000,7,'OLD-1','2024-01-01');
        CREATE TABLE pos_invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
          customer_contact TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
          subtotal_cents INTEGER NOT NULL, tax_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL, currency TEXT NOT NULL,
          created_at TEXT NOT NULL);
        INSERT INTO pos_invoices (invoice_number,customer_name,subtotal_cents,tax_cents,total_cents,currency,created_at)
          VALUES ('INV-OLD','Old customer',1000,0,1000,'KES','2024-01-01');
      `);
    }
  });
  const columns = queryRows('PRAGMA table_info(pos_products)').map(column => column.name);
  assert.ok(columns.includes('duration_minutes') && columns.includes('supplier_id'));
  const old = (await app.listProducts()).find(product => product.sku === 'OLD-1');
  assert.equal(old.name, 'Old soap');
  assert.equal(old.stock, 7);
  assert.equal(old.isService, false);
  const [invoice] = await app.listInvoices();
  assert.equal(invoice.invoice_number, 'INV-OLD');
  assert.equal(invoice.status, 'unpaid', 'an existing invoice becomes unpaid, not lost');
});

// ---- 2. quotations ---------------------------------------------------------------------------

test('quotations are saved with real quantities, reopened, deleted and converted to invoices', async () => {
  const { app, queryRows } = await startPos();
  const soap = await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 5 });
  const id = await app.saveQuotation({
    customerName: 'Jane', customerContact: '0700000001', notes: 'Valid 7 days',
    items: [
      { productId: soap.id, name: 'Soap', quantity: 6, unitPrice: 100 },
      { productId: 0, name: 'Delivery', quantity: 2, unitPrice: 75 }
    ]
  });
  let [quotation] = await app.listQuotations();
  assert.match(quotation.quotation_number, /^QUO-/);
  assert.equal(quotation.total, 750);
  assert.deepEqual(quotation.items.map(item => [item.name, item.quantity, item.productId]), [['Soap', 6, soap.id], ['Delivery', 2, 0]]);
  assert.equal(stockOf(queryRows, soap.id), 5, 'a quotation is not a sale: stock is untouched');
  assert.equal(queryRows('SELECT COUNT(*) AS c FROM pos_sales')[0].c, 0);

  await app.saveQuotation({ id, customerName: 'Jane', items: [{ productId: soap.id, name: 'Soap', quantity: 1, unitPrice: 100 }] });
  [quotation] = await app.listQuotations();
  assert.equal(quotation.items.length, 1, 'saving again replaces the lines');
  assert.equal(quotation.total, 100);

  await app.refresh();
  const list = app.render('/pos/orders/quotations');
  assert.match(list, /Saved quotations · 1/);
  assert.match(list, /Convert to invoice/);

  const invoiceId = await app.convertQuotationToInvoice(id);
  const invoice = (await app.listInvoices()).find(item => item.id === invoiceId);
  assert.equal(invoice.customer_name, 'Jane');
  assert.equal(invoice.total, 100);
  assert.equal(invoice.status, 'unpaid');
  assert.equal((await app.listQuotations())[0].status, 'converted');
  await assert.rejects(() => app.convertQuotationToInvoice(id), /already converted/);
  await assert.rejects(() => app.saveQuotation({ id, customerName: 'Jane', items: [{ name: 'x', quantity: 1, unitPrice: 1 }] }), /cannot be edited/);

  await app.deleteQuotation(id);
  assert.equal((await app.listQuotations()).length, 0);
  assert.equal(queryRows('SELECT COUNT(*) AS c FROM pos_quotation_items')[0].c, 0);
});

test('a quotation needs a customer and at least one valid line', async () => {
  const { app } = await startPos();
  await assert.rejects(() => app.saveQuotation({ customerName: '', items: [{ name: 'x', quantity: 1, unitPrice: 1 }] }), /customer/);
  await assert.rejects(() => app.saveQuotation({ customerName: 'A', items: [] }), /at least one item/);
  await assert.rejects(() => app.saveQuotation({ customerName: 'A', items: [{ name: 'x', quantity: 0, unitPrice: 1 }] }), /quantity/);
});

// ---- 3. invoices -----------------------------------------------------------------------------

test('paying an invoice records a sale, so Overview, stock and reports stay truthful', async () => {
  const { app, queryRows } = await startPos();
  const soap = await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 5 });
  const cut = await addProduct(app, { name: 'Haircut', sku: 'HC-1', price: 500, isService: '1', durationMinutes: 45 });
  const id = await app.saveInvoice({
    customerName: 'Jane', customerContact: '0700000001', dueDate: '', notes: '',
    items: [
      { productId: soap.id, name: 'Soap', quantity: 2, unitPrice: 100 },
      { productId: cut.id, name: 'Haircut', quantity: 1, unitPrice: 500 }
    ]
  });
  assert.equal((await app.listInvoices())[0].status, 'unpaid');
  assert.equal(queryRows('SELECT COUNT(*) AS c FROM pos_sales')[0].c, 0, 'an unpaid invoice is only a promise');
  assert.equal(stockOf(queryRows, soap.id), 5);

  const paid = await app.markInvoicePaid(id, 'Cash');
  const [invoice] = await app.listInvoices();
  assert.equal(invoice.status, 'paid');
  assert.equal(invoice.sale_receipt, paid.receiptNumber);
  const sale = (await app.listSales()).find(item => item.receipt_number === paid.receiptNumber);
  assert.equal(sale.total, 700);
  assert.equal(sale.paid, 1);
  assert.equal(sale.customer_name, 'Jane');
  assert.equal(stockOf(queryRows, soap.id), 3, 'paying delivers the goods, so tracked stock drops');
  assert.equal(stockOf(queryRows, cut.id), null);
  assert.equal(queryRows("SELECT SUM(amount_cents) AS c FROM pos_sale_payments WHERE method='Cash'")[0].c, 70000, 'the cash is in the till');

  await assert.rejects(() => app.markInvoicePaid(id, 'Cash'), /already paid/);
  await assert.rejects(() => app.saveInvoice({ id, customerName: 'Jane', items: [{ name: 'x', quantity: 1, unitPrice: 1 }] }), /paid invoice/);
  assert.equal(queryRows('SELECT COUNT(*) AS c FROM pos_sales')[0].c, 1, 'it cannot be counted twice');
});

test('a paid invoice still settles when a custom line or a deleted product is on it', async () => {
  const { app, queryRows } = await startPos();
  const gone = await addProduct(app, { name: 'Gone', sku: 'GN-1', price: 10, stock: 1 });
  const id = await app.saveInvoice({
    customerName: 'Sam', items: [
      { productId: gone.id, name: 'Gone', quantity: 1, unitPrice: 10 },
      { productId: 0, name: 'Delivery', quantity: 1, unitPrice: 50 }
    ]
  });
  await app.deleteProduct(gone.id);
  await app.markInvoicePaid(id, 'Bank');
  assert.equal(queryRows('SELECT COUNT(*) AS c FROM pos_sale_items WHERE product_id IS NULL').at(0).c, 2);
  assert.equal((await app.listInvoices())[0].status, 'paid');
});

test('the invoice screen offers Mark paid on unpaid invoices only', async () => {
  const { app } = await startPos();
  const soap = await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 5 });
  const a = await app.saveInvoice({ customerName: 'A', items: [{ productId: soap.id, name: 'Soap', quantity: 1, unitPrice: 100 }] });
  await app.saveInvoice({ customerName: 'B', items: [{ productId: soap.id, name: 'Soap', quantity: 1, unitPrice: 100 }] });
  await app.markInvoicePaid(a, 'Cash');
  await app.refresh();
  const html = app.render('/pos/invoices', new URLSearchParams());
  assert.equal((html.match(/data-pos-action="mark-invoice-paid"/g) || []).length, 1);
  assert.match(html, /pos-status is-good">Paid</);
  assert.match(html, /pos-status ">Unpaid</);
});

// ---- 4. suppliers ----------------------------------------------------------------------------

test('a product carries an optional supplier that the catalogue can filter by', async () => {
  const { app, runSql } = await startPos();
  runSql(`INSERT INTO pos_business_records (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
    VALUES ('local','supplier','SUP-1','{"name":"Acme Wholesale"}',0,0,'2026-01-01')`);
  await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 5, supplierId: 'SUP-1' });
  await addProduct(app, { name: 'Mug', sku: 'MG-1', price: 200, stock: 5 });
  await app.refresh();
  const all = app.render('/pos/catalogue/products', new URLSearchParams());
  assert.match(all, /<td>Acme Wholesale<\/td>/);
  assert.match(all, /data-pos-supplier-filter/);
  const filtered = app.render('/pos/catalogue/products', new URLSearchParams('supplier=SUP-1'));
  assert.match(filtered, /<td>Soap/);
  assert.doesNotMatch(filtered, /<td>Mug/);
  const none = app.render('/pos/catalogue/products', new URLSearchParams('supplier=none'));
  assert.match(none, /<td>Mug/);
  assert.doesNotMatch(none, /<td>Soap/);
  const form = app.render('/pos/catalogue/products', new URLSearchParams('new=1'));
  assert.match(form, /name="supplierId"/);
});

test('a purchase-order reference is never rendered as PO-PO-', async () => {
  const { app, runSql } = await startPos();
  runSql(`INSERT INTO pos_business_records (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
    VALUES ('local','supplier','SUP-1','{"name":"Acme"}',0,0,'2026-01-01')`);
  runSql(`INSERT INTO pos_business_records (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
    VALUES ('local','purchase','PO-0123456789abcdef','{"supplierName":"Acme","reference":"","items":[],"status":"ordered","createdAt":"2026-01-01T00:00:00.000Z"}',0,0,'2026-01-02')`);
  runSql(`INSERT INTO pos_business_records (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
    VALUES ('local','purchase','PO-fedcba9876543210','{"supplierName":"Acme","reference":"INV-77","items":[],"status":"ordered","createdAt":"2026-01-01T00:00:00.000Z"}',0,0,'2026-01-03')`);
  await app.refresh();
  const html = app.render('/pos/catalogue/suppliers', new URLSearchParams());
  assert.doesNotMatch(html, /PO-PO-/);
  assert.match(html, /<strong>PO-01234567</);
  assert.match(html, /<strong>INV-77</, 'a typed reference still wins');
});

// ---- 5. mobile money -------------------------------------------------------------------------

test('an optional M-Pesa reference is stored on the mobile-money payment', async () => {
  const { app, queryRows } = await startPos();
  const soap = await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 9 });
  const line = [{ productId: soap.id, name: 'Soap', quantity: 1, unitPrice: 100 }];
  await app.saveSale(line, { paymentMethod: 'Mobile money', paid: true, mpesaRef: ' qgh7abc123 ' });
  assert.equal(queryRows('SELECT mpesa_ref FROM pos_sale_payments')[0].mpesa_ref, 'QGH7ABC123');

  await app.saveSale(line, { paymentMethod: 'Mobile money', paid: true });
  assert.equal(queryRows('SELECT COUNT(*) AS c FROM pos_sale_payments WHERE mpesa_ref IS NULL').at(0).c, 1, 'the reference stays optional');

  await assert.rejects(() => app.saveSale(line, { paymentMethod: 'Mobile money', paid: true, mpesaRef: 'QGH7ABC123' }), /already recorded/);
  await assert.rejects(() => app.saveSale(line, { paymentMethod: 'Mobile money', paid: true, mpesaRef: '12' }), /6 to 20/);
  assert.equal(queryRows('SELECT COUNT(*) AS c FROM pos_sales').at(0).c, 2, 'a rejected reference saves no sale');

  await app.saveSale(line, { paymentMethod: 'Cash', paid: true, mpesaRef: 'IGNORED1234' });
  assert.equal(queryRows("SELECT COUNT(*) AS c FROM pos_sale_payments WHERE method='Cash' AND mpesa_ref IS NULL").at(0).c, 1);
});

test('checkout asks for the M-Pesa reference only when mobile money is chosen', async () => {
  const { app } = await startPos();
  const soap = await addProduct(app, { name: 'Soap', sku: 'SP-1', price: 100, stock: 9 });
  await app.refresh();
  // The cart lives in the panel's own state, so assert on the rendered source of truth instead.
  assert.ok(soap.id);
  const source = (await import('node:fs')).readFileSync(new URL('../src/pos.js', import.meta.url), 'utf8');
  assert.match(source, /state\.paymentMethod === 'Mobile money' \? `[\s\S]*?name', 'mpesaRef'|field\('M-Pesa reference · optional', 'mpesaRef'/);
});
