import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import test from 'node:test';
import { bindMpesaToolEvents, renderMpesaToolScreen } from '../archive/mpesa-ui/mpesa-tools.js';

const pageIds = [
  'balance-flow', 'spending', 'trends', 'top-people', 'budgets', 'savings',
  'all', 'search', 'notes', 'reversals', 'duplicates', 'export',
  'contacts', 'merchants', 'recurring', 'debts', 'customers',
  'loans', 'fees', 'airtime', 'transfer-costs', 'sales', 'reconciliation',
  'fraud', 'fake-sms', 'app-lock', 'business-personal'
];

test('M-Pesa tools show transaction-backed screens and save local annotations', () => {
  const saved = new Map();
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalFormData = globalThis.FormData;
  const dom = new JSDOM('<form data-mpesa-tool-form="annotation" data-reference="ABC12345"><input name="note" value="Lunch"><input name="tag" value="work"><select name="category"><option selected>Food</option></select><select name="purpose"><option value="business" selected>Business</option></select><span data-mpesa-tool-status></span><button type="submit">Save</button></form>', { url: 'https://craft.test' });
  globalThis.window = {
    localStorage: {
      getItem: key => saved.get(key) || null,
      setItem: (key, value) => saved.set(key, value)
    }
  };
  globalThis.document = dom.window.document;
  globalThis.FormData = dom.window.FormData;
  try {
    const transactions = [
      { transactionCode: 'ABC12345', amount: 125, direction: 'received', channel: 'pochi', counterparty: 'Cafe', timestamp: Date.now() },
      { transactionCode: 'XYZ12345', amount: 50, direction: 'sent', channel: 'send_money', counterparty: 'Sam', timestamp: Date.now() }
    ];
    for (const id of pageIds) {
      const markup = renderMpesaToolScreen(id, transactions);
      assert.match(markup, /mpesa-tool-panel/, `${id} should render an actionable or explanatory tool panel`);
      assert.doesNotMatch(markup, /Other tools on this screen are not connected yet/);
    }
    assert.match(renderMpesaToolScreen('search', transactions, 'cafe', 'received', 'pochi'), /ABC12345/);
    assert.doesNotMatch(renderMpesaToolScreen('search', transactions, 'cafe', 'received', 'pochi'), /XYZ12345/);
    assert.match(renderMpesaToolScreen('notes', transactions), /data-mpesa-tool-form="annotation"/);
    assert.match(renderMpesaToolScreen('fake-sms', transactions), /Confirm each transaction in the official M-Pesa app/);

    let updated = false;
    bindMpesaToolEvents(() => { updated = true; }, () => {});
    dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    const persisted = JSON.parse(saved.get('CRAFT_MPESA_TOOLS_V1'));
    assert.equal(persisted.annotations.ABC12345.note, 'Lunch');
    assert.equal(persisted.annotations.ABC12345.category, 'Food');
    assert.equal(persisted.annotations.ABC12345.purpose, 'business');
    assert.equal(updated, true);
  } finally {
    dom.window.close();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.FormData = originalFormData;
  }
});
