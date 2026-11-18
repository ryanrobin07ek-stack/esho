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
const variantsOf = async (app, id) => (await app.listProducts()).find(product => product.id === id).variants;
const sizes = [
  { id: 'S', option1_name: 'Size', option1_value: 'S', price: 1000, stock: 4 },
  { id: 'M', option1_name: 'Size', option1_value: 'M', price: 1200, stock: 3 },
  { id: 'L', option1_name: 'Size', option1_value: 'L', price: 1500, stock: 0 }
];

test('a till product sold in sizes keeps each size price and counts its own stock', async () => {
  const { app, queryRows } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const shirtId = await addProduct(app, {
    name: 'Poplin Shirt', categoryId, price: 1000, sku: 'SHIRT-1',
    stock: 999, buyingPrice: 400, lowStockThreshold: 2, variants: sizes
  });
  const saved = await variantsOf(app, shirtId);
  assert.equal(saved.length, 3);
  assert.deepEqual(saved.map(variant => variant.label), ['S', 'M', 'L']);
  assert.deepEqual(saved.map(variant => variant.price), [1000, 1200, 1500]);
  // The product total is the sizes added up, so the typed 999 cannot drift from what is on the shelf.
  assert.equal(stockOf(queryRows, shirtId), 7);
});

test('selling one size moves only that size, on the receipt and in stock', async () => {
  const { app, queryRows } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const shirtId = await addProduct(app, {
    name: 'Poplin Shirt', categoryId, price: 1000, sku: 'SHIRT-2',
    stock: 0, buyingPrice: 400, lowStockThreshold: 2, variants: sizes
  });
  const sale = await app.saveSale(
    [{ productId: shirtId, name: 'Poplin Shirt', quantity: 2, unitPrice: 1200, variantId: 'M', variantLabel: 'M' }],
    { paymentMethod: 'Cash', paid: true }
  );
  const afterSale = await variantsOf(app, shirtId);
  assert.equal(afterSale.find(variant => variant.id === 'M').stock, 1, 'two mediums left the shelf');
  assert.equal(afterSale.find(variant => variant.id === 'S').stock, 4, 'small is untouched');
  assert.equal(stockOf(queryRows, shirtId), 5, 'the product total follows the sizes');

  const line = queryRows('SELECT variant_id,variant_label FROM pos_sale_items WHERE sale_id=?', [sale.id])[0];
  assert.equal(line.variant_id, 'M');
  assert.equal(line.variant_label, 'M');
  const listed = (await app.listSales()).find(item => item.id === sale.id);
  assert.equal(listed.items[0].variantLabel, 'M', 'the receipt says which size was sold');
});

test('a size cannot be oversold out of stock that only exists in another size', async () => {
  const { app, queryRows } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const shirtId = await addProduct(app, {
    name: 'Poplin Shirt', categoryId, price: 1000, sku: 'SHIRT-3',
    stock: 0, buyingPrice: 400, lowStockThreshold: 2, variants: sizes
  });
  // Seven shirts are in stock, but only three of them are mediums.
  await assert.rejects(
    () => app.saveSale(
      [{ productId: shirtId, name: 'Poplin Shirt', quantity: 4, unitPrice: 1200, variantId: 'M', variantLabel: 'M' }],
      { paymentMethod: 'Cash', paid: true }
    ),
    /has 3 in stock, 4 requested/
  );
  assert.equal(stockOf(queryRows, shirtId), 7, 'the refused sale moved nothing');
  await assert.rejects(
    () => app.saveSale(
      [{ productId: shirtId, name: 'Poplin Shirt', quantity: 1, unitPrice: 1500, variantId: 'GONE', variantLabel: 'XL' }],
      { paymentMethod: 'Cash', paid: true }
    ),
    /no longer available/
  );
});

test('refunding a sized sale puts the shirt back in the size it left in', async () => {
  const { app, queryRows } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const shirtId = await addProduct(app, {
    name: 'Poplin Shirt', categoryId, price: 1000, sku: 'SHIRT-4',
    stock: 0, buyingPrice: 400, lowStockThreshold: 2, variants: sizes
  });
  const sale = await app.saveSale(
    [{ productId: shirtId, name: 'Poplin Shirt', quantity: 3, unitPrice: 1200, variantId: 'M', variantLabel: 'M' }],
    { paymentMethod: 'Cash', paid: true }
  );
  assert.equal((await variantsOf(app, shirtId)).find(variant => variant.id === 'M').stock, 0);
  await app.reverseSale(sale.id, 'refunded');
  const restored = await variantsOf(app, shirtId);
  assert.equal(restored.find(variant => variant.id === 'M').stock, 3, 'the mediums come back as mediums');
  assert.equal(restored.find(variant => variant.id === 'S').stock, 4);
  assert.equal(stockOf(queryRows, shirtId), 7);
});

test('time is not sold in sizes, and an option still needs a value', async () => {
  const { app } = await startPos();
  const categoryId = (await app.listCategories())[0].id;
  const haircutId = await addProduct(app, {
    name: 'Haircut', categoryId, price: 500, sku: 'CUT-1',
    isService: true, durationMinutes: 45, variants: sizes
  });
  const haircut = (await app.listProducts()).find(product => product.id === haircutId);
  assert.deepEqual(haircut.variants, [], 'a service carries no options');
  assert.equal(haircut.durationMinutes, 45);
  assert.equal(haircut.stock, null, 'a service counts no stock');

  await assert.rejects(() => app.saveProduct({
    name: 'Broken', categoryId, price: 10, sku: 'BRK-1', barcode: '', expiryDate: '', active: true,
    variants: [{ id: 'x', option1_value: '', option2_value: '', price: 1, stock: 1 }]
  }), /needs a value/);
});
