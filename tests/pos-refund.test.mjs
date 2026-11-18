// A recorded sale must be reversible: before this the POS had no refund, void or return at all, so a
// mis-rung sale was permanent and kept inflating stock movements, Net sales and Profit forever.
import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { createPosApp } from '../src/pos.js';

async function startPos() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const runSql = (statement, values = []) => {
    db.run(statement, values);
    return { changes: db.getRowsModified() };
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
  return { app, queryRows };
}

// saveProduct does not return an id under the sql.js shim, so the row is found by its SKU.
async function addProduct(app, fields) {
  await app.saveProduct({ barcode: '', expiryDate: '', active: true, ...fields });
  return (await app.listProducts()).find(product => product.sku === fields.sku).id;
}

const stockOf = (queryRows, id) => queryRows('SELECT stock_count FROM pos_products WHERE id=?', [id])[0].stock_count;

test('refunding a sale puts tracked stock back and takes the sale out of the reports', async () => {
  const { app, queryRows } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const soapId = await addProduct(app, {
    name: 'Soap', categoryId, price: 100, sku: 'SOAP-1', barcode: '', expiryDate: '',
    stock: 10, buyingPrice: 40, lowStockThreshold: 3, active: true
  });

  const sale = await app.saveSale(
    [{ productId: soapId, name: 'Soap', quantity: 3, unitPrice: 100 }],
    { paymentMethod: 'Cash', paid: true }
  );
  assert.equal(stockOf(queryRows, soapId), 7, 'selling 3 of 10 leaves 7');

  const result = await app.reverseSale(sale.id, 'refunded');
  assert.equal(result.status, 'refunded');
  assert.equal(result.restocked, 1);
  assert.equal(stockOf(queryRows, soapId), 10, 'a refund puts the 3 back');

  const row = queryRows('SELECT payment_status,paid,amount_paid_cents FROM pos_sales WHERE id=?', [sale.id])[0];
  assert.equal(row.payment_status, 'refunded');
  assert.equal(row.paid, 0);
  assert.equal(row.amount_paid_cents, 0);

  // The receipt is still on file for the owner, it just no longer counts as business done.
  const sales = await app.listSales();
  assert.equal(sales.find(item => item.id === sale.id).payment_status, 'refunded');
});

test('a sale cannot be reversed twice, so stock is never handed back more than once', async () => {
  const { app, queryRows } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const mugId = await addProduct(app, {
    name: 'Mug', categoryId, price: 250, sku: 'MUG-1', barcode: '', expiryDate: '',
    stock: 5, buyingPrice: 100, lowStockThreshold: 2, active: true
  });
  const sale = await app.saveSale(
    [{ productId: mugId, name: 'Mug', quantity: 2, unitPrice: 250 }],
    { paymentMethod: 'Cash', paid: true }
  );
  assert.equal(stockOf(queryRows, mugId), 3);
  await app.reverseSale(sale.id, 'voided');
  assert.equal(stockOf(queryRows, mugId), 5);
  await assert.rejects(() => app.reverseSale(sale.id, 'refunded'), /already been reversed/);
  assert.equal(stockOf(queryRows, mugId), 5, 'the second attempt changes nothing');
  assert.equal(queryRows('SELECT payment_status FROM pos_sales WHERE id=?', [sale.id])[0].payment_status, 'voided');
});

test('a service or any product with no stock number is left alone by a refund', async () => {
  const { app, queryRows } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const haircutId = await addProduct(app, {
    name: 'Haircut', categoryId, price: 800, sku: 'CUT-1', barcode: '', expiryDate: '',
    stock: '', buyingPrice: '', lowStockThreshold: 0, active: true
  });
  assert.equal(stockOf(queryRows, haircutId), null, 'an untracked item has no stock number');
  const sale = await app.saveSale(
    [{ productId: haircutId, name: 'Haircut', quantity: 1, unitPrice: 800 }],
    { paymentMethod: 'Cash', paid: true }
  );
  assert.equal(stockOf(queryRows, haircutId), null);
  await app.reverseSale(sale.id, 'refunded');
  assert.equal(stockOf(queryRows, haircutId), null, 'nothing to put back, and nothing invented');
});
