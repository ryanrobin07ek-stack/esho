import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// The two pure helpers, loaded without the app module they sit beside.
async function loadHelpers() {
  const source = await readFile(new URL('../src/screens/craft/direct-payments.js', import.meta.url), 'utf8');
  const start = source.indexOf('const MPESA_KINDS');
  const end = source.indexOf('export function renderDirectPayments');
  const code = source.slice(start, end).replace(/export function /g, 'function ');
  return vm.runInNewContext(`${code}; ({ normalizePaymentOptions, paymentOptionsProblem })`);
}

test('payment options are cleaned, and anything left empty counts as switched off', async () => {
  const { normalizePaymentOptions } = await loadHelpers();
  const options = normalizePaymentOptions({
    mpesa: { enabled: true, kind: 'paybill', number: '247 247', account: '  Shop  A ' },
    cash: { enabled: true },
    bank: { enabled: true, details: '   ' }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(options)), {
    mpesa: { enabled: true, kind: 'paybill', number: '247247', account: 'Shop A' },
    cash: { enabled: true },
    bank: { enabled: false, details: '' }
  });
  assert.equal(normalizePaymentOptions(null).mpesa.enabled, false);
  assert.equal(normalizePaymentOptions({ mpesa: { enabled: true, kind: 'till', number: '' } }).mpesa.enabled, false);
  assert.equal(normalizePaymentOptions({ mpesa: { enabled: true, kind: 'bogus', number: '12345' } }).mpesa.kind, 'till');
});

test('payment options that cannot work are refused with a reason', async () => {
  const { paymentOptionsProblem } = await loadHelpers();
  const base = { mpesa: { enabled: false }, cash: { enabled: false }, bank: { enabled: false, details: '' } };
  assert.equal(paymentOptionsProblem(base), '');
  assert.match(paymentOptionsProblem({ ...base, mpesa: { enabled: true, kind: 'till', number: '12' } }), /Till number/);
  assert.match(paymentOptionsProblem({ ...base, mpesa: { enabled: true, kind: 'phone', number: '0712' } }), /phone number/);
  assert.equal(paymentOptionsProblem({ ...base, mpesa: { enabled: true, kind: 'phone', number: '0712 345 678' } }), '');
  assert.match(paymentOptionsProblem({ ...base, bank: { enabled: true, details: '' } }), /bank details/);
});

test('the Payments screen shows the card, saves it, and the builder and checkout receive it', async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(await read('src/screens/craft/payments.js'), /\$\{renderDirectPayments\(\)\}<\/section>/);
  assert.match(await read('src/app/main.js'), /this\.bindPaystackSetup\(container, tenantId\);\s*bindDirectPayments\(container\);/);
  assert.match(await read('src/screens/builder/builder.js'), /payment_options: store\.payment_options/);
  const mixer = await read('public/litrus-mixer/index.html');
  assert.match(mixer, /SHOP\.paymentOptions=shop\.payment_options/);
  assert.match(mixer, /directPayments:typeof window\.litrusDirectPaymentChoices==='function'/);
  assert.match(mixer, /'<h2>Payment<\/h2>'\+payGroupHTML\(s\)/);
  assert.doesNotMatch(mixer, /value="Mobile money \/ M-Pesa"/, 'the made-up payment choices are gone from the template');
  assert.match(await read('public/litrus-mixer/live-catalog.js'), /global\.litrusDirectPaymentChoices = directPaymentChoices;/);
});
