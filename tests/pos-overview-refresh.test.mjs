import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'node:url';
import { createPosApp } from '../src/pos.js';

test('POS overview refreshes saved sales and includes unpaid receipts in the recorded-sales total', async () => {
  const SQL = await initSqlJs({
    locateFile: file => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  const listeners = {};
  const root = { innerHTML: '' };
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  const queryRows = (statement, values = []) => {
    const query = db.prepare(statement);
    query.bind(values);
    const result = [];
    while (query.step()) result.push(query.getAsObject());
    query.free();
    return result;
  };
  const run = (statement, values = []) => {
    db.run(statement, values);
    return { changes: { changes: db.getRowsModified(), lastId: db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0 } };
  };

  globalThis.window = {
    location: { hash: '#/pos/overview' },
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    setInterval() { return 1; },
    ShopSQLite: {
      async query(statement, values) { return { values: queryRows(statement, values) }; },
      async run(statement, values) { return run(statement, values); },
      async execute(statement) { db.exec(statement); },
      async executeSet(statements) {
        db.run('BEGIN');
        try {
          for (const item of statements) run(item.statement, item.values || []);
          db.run('COMMIT');
        } catch (error) {
          db.run('ROLLBACK');
          throw error;
        }
        return { changes: { changes: db.getRowsModified() } };
      }
    }
  };
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    getElementById(id) { return id === 'app' ? root : null; },
    querySelector() { return null; },
    createElement() { return { classList: { add() {}, remove() {}, toggle() {} } }; },
    body: { appendChild() {} }
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });

  try {
    const app = createPosApp();
    await app.init();
    const createdAt = new Date().toISOString();
    await run(`INSERT INTO pos_sales
      (receipt_number,subtotal_cents,tax_cents,discount_cents,total_cents,currency,payment_method,paid,
       payment_status,amount_paid_cents,created_at)
      VALUES ('PAID-1',10000,0,0,10000,'KES','Cash',1,'confirmed',10000,?)`, [createdAt]);
    await run(`INSERT INTO pos_sales
      (receipt_number,subtotal_cents,tax_cents,discount_cents,total_cents,currency,payment_method,paid,
       payment_status,amount_paid_cents,created_at)
      VALUES ('CREDIT-1',5000,0,0,5000,'KES',NULL,0,'pending',0,?)`, [createdAt]);

    await app.refresh();
    const overview = root.innerHTML;
    assert.match(overview, /Sales recorded/);
    assert.match(overview, /KES\s*150\.00/);
    assert.match(overview, /Revenue<\/small><strong>KES\s*150\.00/);
    assert.match(overview, /Credit<\/small><strong>KES\s*50\.00/);
    assert.match(overview, /2 receipts · includes unpaid sales/);
    assert.match(overview, /class="pos-card pos-period-comparison-card"/);
    assert.match(overview, /data-pos-action="refresh-overview"/);
    assert.match(overview, /<header class="pos-header">[\s\S]*?class="pos-brand pos-brand-back pos-brand-overview"[\s\S]*?<\/a>\s*<details class="workspace-menu pos-section-menu">[\s\S]*?circle cx="12" cy="5"/);
    assert.match(overview, /<nav class="pos-ranges"[\s\S]*?<\/nav>\s*<button type="button" class="pos-overview-refresh"[^>]*aria-label="Refresh overview"/);
    assert.doesNotMatch(overview, />Refresh Overview</);
    const revenueTab = app.render('/pos/overview', new URLSearchParams('tab=Revenue'));
    assert.match(revenueTab, /KES\s*150\.00/);
    assert.match(revenueTab, /Payments received/);
    const paymentsTab = app.render('/pos/overview', new URLSearchParams('tab=Payments'));
    assert.match(paymentsTab, /KES\s*0\.00/);
    assert.match(paymentsTab, /Outstanding credit/);
    assert.match(paymentsTab, /1 unpaid receipts/);
    const appStyles = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(appStyles, /body\.craft-app-ui #app \.pos-overview-card\s*\{[^}]*background-color:\s*#111 !important;[^}]*color:\s*#fff !important;/);
    assert.match(appStyles, /\.pos-overview-controls \.pos-ranges\s*\{[^}]*flex:\s*1 1 0[^}]*width:\s*auto/);
    assert.match(appStyles, /\.pos-content \.pos-overview-refresh\s*\{[^}]*width:\s*32px !important[^}]*height:\s*32px !important/);
    assert.match(appStyles, /\.pos-overview-refresh svg\s*\{[^}]*width:\s*19px[^}]*height:\s*19px/);
    for (const route of ['/pos', '/pos/overview', '/pos/catalogue/inventory', '/pos/orders', '/pos/more']) {
      assert.match(app.render('/pos'), new RegExp(`href="${route}" data-route="${route}"`));
    }
  } finally {
    db.close();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
    else delete globalThis.navigator;
  }
});
