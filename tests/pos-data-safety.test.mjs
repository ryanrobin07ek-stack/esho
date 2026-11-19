import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { createPosApp } from '../src/pos.js';
import { readAppSource } from './helpers/app-source.mjs';

// Behavioural tests for the paths that can replace or wipe a shop's catalogue: restoring an
// inventory backup, replacing a browser register from the cloud, background sync deletions,
// and the one-time sample-data reset when a restored database meets empty WebView storage.

const SQL = await initSqlJs({
  locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
});

async function createHarness({ confirmAnswer = true } = {}) {
  const db = new SQL.Database();
  const handlers = {};
  const root = { innerHTML: '' };
  const toasts = [];
  const toastElement = { classList: { add() {}, remove() {}, toggle() {} }, set textContent(value) { toasts.push(value); } };
  const runSql = (statement, values = []) => {
    db.run(statement, values);
    const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0;
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
  const saved = {
    window: globalThis.window, document: globalThis.document, confirm: globalThis.confirm,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  };
  const confirms = [];
  const harness = { db, runSql, queryRows, handlers, toasts, confirms, answer: confirmAnswer };
  globalThis.window = {
    location: { hash: '#/pos' },
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); },
    setInterval() { return 1; },
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
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); },
    getElementById(id) { return id === 'app' ? root : id === 'pos-toast' ? toastElement : null; },
    createElement() { return { className: '', classList: { add() {}, remove() {}, toggle() {} } }; },
    body: { appendChild() {} }
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  globalThis.confirm = (message) => { confirms.push(message); return harness.answer; };
  harness.restore = () => {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.confirm = saved.confirm;
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
    else delete globalThis.navigator;
  };
  harness.app = createPosApp();
  await harness.app.init();
  await settle();
  return harness;
}

// init() starts background sync work; let it finish before a test restores the globals.
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

const productRow = (harness, sku) => harness.queryRows('SELECT name,price_cents,stock_count,active FROM pos_products WHERE sku=?', [sku])[0];
const safetyTables = (harness) => harness.queryRows("SELECT name FROM sqlite_master WHERE name LIKE 'pos!_safety!_%' ESCAPE '!'");

async function addProducts(harness, products) {
  const categoryId = (await harness.app.listCategories())[0].id;
  for (const product of products) {
    await harness.app.saveProduct({ categoryId, price: 10, stock: 5, lowStockThreshold: 3, active: true, ...product });
  }
}

function backupInput(backup) {
  return {
    files: [{ async text() { return JSON.stringify(backup); } }],
    matches() { return false; },
    value: 'chosen'
  };
}

const importBackup = (harness, backup) => harness.handlers.change.at(-1)({
  target: { closest: (selector) => selector === '[data-pos-import], [data-pos-csv-import]' ? backupInput(backup) : null }
});

function cloudBridge(changes, { latestRevision = changes.length } = {}) {
  const calls = [];
  window.EshopInventoryBridge = {
    activeWebsiteId: () => 'shop-a',
    syncPosRecords: async (tenant, method, body) => {
      calls.push({ tenant, method, body });
      if (method === 'POST') return { ok: true };
      const after = Number(body?.after || 0);
      return {
        changes: changes.filter((change) => change.revision > after).slice(0, body?.limit || 500),
        latest_revision: latestRevision
      };
    },
    onPosSyncStatusChanged() {}
  };
  return calls;
}

const cloudProduct = (n, overrides = {}) => ({
  entity: 'product', record_id: `PRODUCT-${n}`, revision: n, device_id: 'other-device', deleted: false,
  changed_at: '2026-01-01T00:00:00.000Z',
  payload: { sku: `CLOUD-${n}`, name: `Cloud ${n}`, categoryName: 'General', price: 20, stock: 7, active: true },
  ...overrides
});

test('restoring an inventory backup asks first and shows what will be overwritten', async () => {
  const harness = await createHarness({ confirmAnswer: false });
  try {
    await addProducts(harness, [{ name: 'Soap', sku: 'SOAP', stock: 40, price: 5 }]);
    await importBackup(harness, {
      format: 'audit-pos-inventory', version: 1, createdAt: '2025-01-01T00:00:00.000Z', categories: ['General'],
      products: [{ name: 'Soap', sku: 'SOAP', categoryName: 'General', price: 4, stock: 3 }]
    });
    assert.equal(harness.confirms.length, 1, 'The owner is asked before anything is overwritten.');
    assert.match(harness.confirms[0], /2025-01-01/);
    assert.match(harness.confirms[0], /1 existing product will be overwritten/);
    assert.match(harness.confirms[0], /Soap: stock 40 → 3/);
    assert.equal(productRow(harness, 'SOAP').stock_count, 40, 'Declining leaves the newer stock untouched.');
    assert.equal(productRow(harness, 'SOAP').price_cents, 500);
    assert.deepEqual(safetyTables(harness), []);

    harness.answer = true;
    await importBackup(harness, {
      format: 'audit-pos-inventory', version: 1, categories: ['General'],
      products: [{ name: 'Soap', sku: 'SOAP', categoryName: 'General', price: 4, stock: 3 }]
    });
    assert.equal(productRow(harness, 'SOAP').stock_count, 3);
    assert.deepEqual(safetyTables(harness), [], 'The safety copy is removed after a successful restore.');
  } finally { harness.restore(); }
});

test('a restore that fails part-way leaves the catalogue exactly as it was', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, [
      { name: 'Soap', sku: 'SOAP', stock: 40, price: 5 },
      { name: 'Rice', sku: 'RICE', stock: 12, price: 9 }
    ]);
    const before = harness.queryRows('SELECT * FROM pos_products ORDER BY id');
    const categoriesBefore = harness.queryRows('SELECT * FROM pos_categories ORDER BY id');
    await importBackup(harness, {
      format: 'audit-pos-inventory', version: 1, categories: ['General', 'Brand new category'],
      products: [
        { name: 'Soap', sku: 'SOAP', categoryName: 'General', price: 1, stock: 1, barcode: '6001' },
        // Reusing the barcode makes the second write fail after the first one succeeded.
        { name: 'Rice', sku: 'RICE', categoryName: 'Brand new category', price: 1, stock: 1, barcode: '6001' }
      ]
    });
    assert.deepEqual(harness.queryRows('SELECT * FROM pos_products ORDER BY id'), before, 'Products are restored exactly.');
    assert.deepEqual(harness.queryRows('SELECT * FROM pos_categories ORDER BY id'), categoriesBefore, 'The new category is rolled back too.');
    assert.deepEqual(safetyTables(harness), []);
    assert.ok(harness.toasts.some((message) => /Nothing was changed/.test(message)), 'The owner is told nothing changed.');
  } finally { harness.restore(); }
});

test('replacing a browser register from the cloud needs explicit confirmation', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, [{ name: 'Soap', sku: 'SOAP' }]);
    cloudBridge([cloudProduct(1)]);
    await assert.rejects(harness.app.replaceWithCloudShop('shop-a'), /explicit confirmation/);
    assert.ok(productRow(harness, 'SOAP'));
  } finally { harness.restore(); }
});

test('an empty cloud shop never replaces a populated local catalogue', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, [{ name: 'Soap', sku: 'SOAP', stock: 9 }]);
    cloudBridge([]);
    await assert.rejects(harness.app.replaceWithCloudShop('shop-a', { confirmed: true }),
      /no POS products in the cloud, so replacing would erase 1 product/);
    assert.equal(productRow(harness, 'SOAP').stock_count, 9);
    assert.deepEqual(safetyTables(harness), []);
  } finally { harness.restore(); }
});

test('a replace that fails mid-way rolls the whole register back, sales and settings included', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, [{ name: 'Soap', sku: 'SOAP', stock: 9 }]);
    harness.runSql(`INSERT INTO pos_sales (receipt_number,subtotal_cents,tax_cents,total_cents,currency,paid,created_at)
      VALUES ('R-1',1000,0,1000,'KES',1,'2026-01-01T00:00:00.000Z')`);
    harness.runSql("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('tax_rate','16')");
    const snapshot = () => Object.fromEntries(['pos_products', 'pos_categories', 'pos_sales', 'pos_settings']
      .map((table) => [table, harness.queryRows(`SELECT * FROM ${table} ${table === 'pos_settings' ? "WHERE key<>'cloud_sync_error'" : ''} ORDER BY 1`)]));
    const before = snapshot();
    // The second cloud product has no price, which fails after the local tables were already cleared.
    cloudBridge([cloudProduct(1), cloudProduct(2, { payload: { sku: 'CLOUD-2', name: 'Broken', categoryName: 'General' } })]);
    await assert.rejects(harness.app.replaceWithCloudShop('shop-a', { confirmed: true }));
    assert.deepEqual(snapshot(), before, 'Everything is back exactly as it was.');
    assert.match(harness.queryRows("SELECT value FROM pos_settings WHERE key='cloud_sync_error'")[0].value, /previous browser data was restored/);
    assert.deepEqual(safetyTables(harness), []);
    assert.equal(productRow(harness, 'CLOUD-1'), undefined);
  } finally { harness.restore(); }
});

test('a successful replace swaps in the cloud catalogue and drops the safety copy', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, [{ name: 'Soap', sku: 'SOAP' }]);
    cloudBridge([cloudProduct(1), cloudProduct(2)]);
    const result = await harness.app.replaceWithCloudShop('shop-a', { confirmed: true });
    assert.equal(result.imported, 2);
    assert.equal(productRow(harness, 'SOAP'), undefined);
    assert.equal(productRow(harness, 'CLOUD-1').stock_count, 7);
    assert.deepEqual(safetyTables(harness), []);
  } finally { harness.restore(); }
});

test('a rewrite interrupted by a reload is undone from its safety copy on the next start', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, [{ name: 'Soap', sku: 'SOAP', stock: 9 }, { name: 'Rice', sku: 'RICE', stock: 4 }]);
    // Simulate a crash after the copy was taken and the tables were wiped.
    harness.runSql('CREATE TABLE pos_safety_pos_products AS SELECT * FROM pos_products');
    harness.runSql('CREATE TABLE pos_safety_pos_categories AS SELECT * FROM pos_categories');
    harness.runSql('DELETE FROM pos_products');
    assert.equal(harness.queryRows('SELECT COUNT(*) AS n FROM pos_products')[0].n, 0);
    const restarted = createPosApp();
    await restarted.init();
    await settle();
    assert.equal(productRow(harness, 'SOAP').stock_count, 9);
    assert.equal(productRow(harness, 'RICE').stock_count, 4);
    assert.deepEqual(safetyTables(harness), []);
  } finally { harness.restore(); }
});

test('background sync refuses to apply a mass deletion of the local catalogue until the owner confirms', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, Array.from({ length: 6 }, (_, index) => ({ name: `Item ${index}`, sku: `ITEM-${index}` })));
    const deletions = Array.from({ length: 6 }, (_, index) => ({
      entity: 'product', record_id: `PRODUCT-${index}`, revision: index + 1, device_id: 'other-device', deleted: true,
      changed_at: '2026-01-01T00:00:00.000Z', payload: { sku: `ITEM-${index}`, name: `Item ${index}` }
    }));
    const calls = cloudBridge(deletions);
    harness.runSql("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_enabled','1')");
    await harness.app.switchCloudSyncTenant('shop-a').then(
      () => assert.fail('The mass deletion should have paused sync.'),
      (error) => assert.equal(error.code, 'MASS_DELETE')
    );
    assert.equal(harness.queryRows('SELECT COUNT(*) AS n FROM pos_products')[0].n, 6, 'No product was deleted.');
    assert.ok(calls.some((call) => call.method === 'GET'));
    await harness.app.syncCloudNow({ allowMassDelete: true });
    assert.equal(harness.queryRows('SELECT COUNT(*) AS n FROM pos_products')[0].n, 0, 'Confirmed deletions are applied.');
  } finally { harness.restore(); }
});

test('opening a restored database with empty WebView storage never resets the catalogue', async () => {
  const app = await readAppSource();
  const start = app.indexOf('  async init(seedCategories, seedProducts, seedStore, seedPlans, seedAnalytics) {');
  const end = app.indexOf('\n  seedInitial(', start);
  assert.ok(start > 0 && end > start, 'SQLiteEngine.init should be extractable.');
  const initSource = app.slice(start, end).trim().replace(/,$/, '').replace(/^async /, '');
  const init = new Function('window', `return async function ${initSource}`);

  const makeEngine = (saved, localStorage) => {
    const writes = [];
    const engine = {
      db: { tables: {}, schema: {} },
      emptyCatalogKey: 'ESHOP_EMPTY_WEB_CATALOG_V1',
      storeBrandKey: 'ESHOP_STORE_BRAND_UPDATED_V1',
      seedInitial() {
        this.db = { tables: { store: [{ name: 'Craft Atelier' }], categories: [{ id: 1 }], products: [{ id: 1, name: 'Sample' }], inventory: [{ id: 1 }], orders: [] } };
      },
      getStore() { return this.db.tables.store[0]; },
      updateStore(values) { Object.assign(this.db.tables.store[0], values); }
    };
    const win = {
      localStorage,
      ShopSQLite: { async load() { return saved; }, async save(snapshot) { writes.push(snapshot); } }
    };
    engine.init = init(win);
    return { engine, writes };
  };
  const emptyStorage = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), values };
  };

  // Restored database: real products, brand-new WebView storage with no marker.
  const restoredProducts = [{ id: 7, name: 'Real product' }, { id: 8, name: 'Archived product', status: 'archived' }];
  const restored = { tables: { store: [{ name: 'My Shop' }], categories: [{ id: 1, name: 'Shoes' }], products: restoredProducts, inventory: [{ id: 7, stock: 4 }], orders: [] } };
  const storage = emptyStorage();
  const { engine, writes } = makeEngine(restored, storage);
  await engine.init([], [], {}, [], {});
  assert.deepEqual(engine.db.tables.products, restoredProducts);
  assert.deepEqual(engine.db.tables.inventory, [{ id: 7, stock: 4 }]);
  assert.equal(engine.db.tables.categories.length, 1);
  assert.equal(writes.length, 0, 'Nothing is written back over the restored data.');
  assert.equal(storage.getItem('ESHOP_EMPTY_WEB_CATALOG_V1'), '1', 'The marker is set so the reset never runs later.');

  // Unavailable storage (private window) must not crash or wipe anything either.
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const second = makeEngine(restored, blocked);
  await second.engine.init([], [], {}, [], {});
  assert.deepEqual(second.engine.db.tables.products, restoredProducts);

  // A genuine first run still starts with an empty catalogue instead of sample products.
  const fresh = makeEngine(null, emptyStorage());
  await fresh.engine.init([], [], {}, [], {});
  assert.deepEqual(fresh.engine.db.tables.products, []);
  assert.equal(fresh.writes.length, 1);
});

test('the one-time builder reset never blanks a restored shop and survives blocked storage', async () => {
  const app = await readAppSource();
  const start = app.indexOf('  async resetBuildYourWebDataOnce() {');
  const end = app.indexOf('\n  // Studio CRUD for Products', start);
  assert.ok(start > 0 && end > start, 'resetBuildYourWebDataOnce should be extractable.');
  const source = app.slice(start, end).trim().replace(/,$/, '').replace(/^async /, '');
  const build = new Function('window', 'storeInfo', `return async function ${source}`);
  const defaults = { name: 'Craft', title: 'Craft', tagline: '', description: '', location: '', email: '', phone: '', announcement: '', announcement_active: 0 };

  const makeEngine = (loadedExistingData, localStorage) => {
    const flushes = [];
    const engine = {
      builderResetKey: 'ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1',
      storageKey: 'ESHOP_SQLITE_DB_V1',
      loadedExistingData,
      saves: 0,
      db: { tables: {
        store: [{ name: 'Mama Mboga Shop', phone: '0700000000', email: 'shop@example.com', announcement: 'Open late' }],
        pages: [{ id: 1, title: 'About' }],
        hero_slides: [{ id: 1, title: 'Hero' }],
        products: [{ id: 1, name: 'Real product' }]
      } },
      updateStore(values) { Object.assign(this.db.tables.store[0], values); },
      save() { this.saves += 1; }
    };
    const win = { localStorage, ShopSQLite: { async flush() { flushes.push(1); } } };
    engine.run = build(win, defaults).bind(engine);
    return { engine, flushes };
  };
  const memoryStorage = () => {
    const values = new Map();
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key), values };
  };

  // Restored database, WebView storage without the marker: nothing is wiped.
  const storage = memoryStorage();
  const restored = makeEngine(true, storage);
  await restored.engine.run();
  assert.equal(restored.engine.db.tables.store[0].name, 'Mama Mboga Shop');
  assert.equal(restored.engine.db.tables.store[0].phone, '0700000000');
  assert.equal(restored.engine.db.tables.store[0].announcement, 'Open late');
  assert.equal(restored.engine.db.tables.pages.length, 1);
  assert.equal(restored.engine.db.tables.hero_slides.length, 1);
  assert.equal(restored.engine.db.tables.products.length, 1);
  assert.equal(restored.engine.saves, 0);
  assert.equal(storage.getItem('ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1'), '1');

  // Blocked storage (private window) must not throw, restored or fresh.
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const blockedRestored = makeEngine(true, blocked);
  await blockedRestored.engine.run();
  assert.equal(blockedRestored.engine.db.tables.store[0].name, 'Mama Mboga Shop');
  const blockedFresh = makeEngine(false, blocked);
  await blockedFresh.engine.run();

  // A genuine first run still gets the blank defaults, once.
  const freshStorage = memoryStorage();
  const fresh = makeEngine(false, freshStorage);
  await fresh.engine.run();
  assert.equal(fresh.engine.db.tables.store[0].name, 'Craft');
  assert.equal(fresh.engine.db.tables.store[0].phone, '');
  assert.equal(fresh.engine.db.tables.pages.length, 0);
  assert.equal(fresh.engine.saves, 1);
  assert.equal(fresh.flushes.length, 1);
  assert.equal(freshStorage.getItem('ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1'), '1');
  await fresh.engine.run();
  assert.equal(fresh.engine.saves, 1, 'The reset runs only once.');
});

test('restoring a backup never wipes a product photo, cost, barcode or reorder level it has no value for', async () => {
  const harness = await createHarness();
  try {
    await addProducts(harness, [{
      name: 'Soap', sku: 'SOAP', stock: 40, price: 5, buyingPrice: 3, barcode: '6009', lowStockThreshold: 8,
      imageUri: 'https://cdn.example.com/soap.jpg'
    }]);
    const details = () => harness.queryRows('SELECT image_uri,buying_price_cents,barcode,low_stock_threshold,stock_count FROM pos_products WHERE sku=?', ['SOAP'])[0];
    const before = details();
    assert.equal(before.image_uri, 'https://cdn.example.com/soap.jpg');

    // exportInventory writes image:null for linked (https) photos and may omit or blank the other details.
    const sameAsNow = {
      name: 'Soap', sku: 'SOAP', categoryName: 'General', price: 5, stock: 40, image: null, buyingPrice: null, barcode: '', lowStockThreshold: undefined
    };
    await importBackup(harness, { format: 'audit-pos-inventory', version: 1, categories: ['General'], products: [sameAsNow] });
    assert.match(harness.confirms.at(-1), /0 existing products will be overwritten/, 'A restore that changes nothing says so.');
    assert.deepEqual(details(), before, 'Photo, cost, barcode and reorder level survive the restore.');

    // A real change is listed with every field it touches, and still keeps what the backup lacks.
    await importBackup(harness, {
      format: 'audit-pos-inventory', version: 1, categories: ['General'],
      products: [{ ...sameAsNow, price: 4, stock: 12, lowStockThreshold: 2 }]
    });
    assert.match(harness.confirms.at(-1), /1 existing product will be overwritten with the backup’s stock, price, reorder level/);
    const after = details();
    assert.equal(after.stock_count, 12);
    assert.equal(after.low_stock_threshold, 2);
    assert.equal(after.image_uri, 'https://cdn.example.com/soap.jpg');
    assert.equal(after.buying_price_cents, before.buying_price_cents);
    assert.equal(after.barcode, '6009');

    // A photo that is in the backup is listed as a change and applied.
    await importBackup(harness, {
      format: 'audit-pos-inventory', version: 1, categories: ['General'],
      products: [{ ...sameAsNow, price: 4, stock: 12, lowStockThreshold: 2, image: { mimeType: 'image/png', base64: 'AAAA' } }]
    });
    assert.match(harness.confirms.at(-1), /overwritten with the backup’s photo/);
    assert.equal(details().image_uri, 'data:image/png;base64,AAAA');
  } finally { harness.restore(); }
});
