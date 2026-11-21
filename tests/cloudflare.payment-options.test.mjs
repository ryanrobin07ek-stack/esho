// The ways a shop lets customers pay it directly must survive publishing (the Worker rebuilds the store
// from a fixed list of fields) and reach the storefront in the shape the checkout reads.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { normalizePaymentOptions } from '../cloudflare/payment-options.js';

test('payment options are cleaned of markup and unknown keys, and empty ones count as off', () => {
  assert.deepEqual(normalizePaymentOptions({
    mpesa: { enabled: true, kind: 'paybill', number: '247 247', account: '  Zawadi  <b>1</b> ' },
    cash: { enabled: true },
    bank: { enabled: true, details: 'Equity, Mama Zawadi Gifts' },
    evil: '<script>', extra: { enabled: true }
  }), {
    mpesa: { enabled: true, kind: 'paybill', number: '247247', account: 'Zawadi b 1 /b' },
    cash: { enabled: true },
    bank: { enabled: true, details: 'Equity, Mama Zawadi Gifts' }
  });
  assert.deepEqual(normalizePaymentOptions({ mpesa: { enabled: true, kind: 'till', number: '' }, bank: { enabled: true, details: '' }, cash: 'yes' }), {
    mpesa: { enabled: false, kind: 'till', number: '', account: '' },
    cash: { enabled: false },
    bank: { enabled: false, details: '' }
  });
  for (const broken of [undefined, null, 'nonsense', 7, [], { mpesa: 'x', bank: [] }]) {
    const out = normalizePaymentOptions(broken);
    assert.equal(out.mpesa.enabled, false);
    assert.equal(out.cash.enabled, false);
    assert.equal(out.bank.enabled, false);
  }
  assert.equal(normalizePaymentOptions({ mpesa: { enabled: true, kind: 'phone', number: '+254 712 345 678' } }).mpesa.number, '+254 712 345 678');
  assert.equal(normalizePaymentOptions({ mpesa: { enabled: true, kind: 'till', number: '1234567890123456' } }).mpesa.number.length, 12);
});

test('the Worker puts payment_options in the store it publishes (the fixed field list)', async () => {
  const worker = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
  assert.match(worker, /import \{ normalizePaymentOptions \} from "\.\/payment-options\.js";/);
  assert.match(worker, /section_layout: sectionLayout,[\s\S]{0,260}payment_options: normalizePaymentOptions\(storeInput\.payment_options\)\s*\};/,
    'Without this line the owner\'s payment options never reached the live checkout.');
});
