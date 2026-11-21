// Pins the fixes that came out of the independent review of the 2026-11-21 work.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('a service booking needs an email only when the shop takes a deposit', async () => {
  const live = await read('public/litrus-mixer/live-catalog.js');
  assert.match(live, /const emailNeeded = \(Number\(data\?\.shop\?\.serviceDepositPercent\) \|\| 0\) > 0;/);
  assert.match(live, /if \(customer\.customer_email \? !SERVICE_EMAIL_PATTERN\.test\(customer\.customer_email\) : emailNeeded\) \{/,
    'A blank email is accepted; a typed one must still be valid; a deposit still needs one for the receipt.');
  assert.doesNotMatch(live, /if \(!SERVICE_EMAIL_PATTERN\.test\(customer\.customer_email\)\) \{/, 'the old rule rejected a blank email');
});

test('the setup guide never starts for a shop that already has a name or products', async () => {
  const guide = await read('src/onboarding/onboarding.js');
  assert.match(guide, /const named = shop\.name\.trim\(\) && shop\.name\.trim\(\)\.toLowerCase\(\) !== 'craft';/);
  assert.match(guide, /webProducts = \(appStore\?\.select\?\.\('products'\) \|\| \[\]\)\.length;/);
  assert.match(guide, /if \(named \|\| webProducts\) \{ write\(STATE_KEY, 'existing'\); return; \}\s*\} catch \{ return; \}\s*startOnboarding\(\);/,
    'the check runs before the guide starts, so an existing name is never overwritten');
});

test('a blank price in the setup guide is not saved as a free product', async () => {
  const guide = await read('src/onboarding/onboarding.js');
  assert.match(guide, /if \(!name \|\| priceText === '' \|\| !Number\.isFinite\(price\) \|\| price < 0\) return fail\('Enter a product name and a price\.'\);/);
});

test('the builder no longer promises starter FAQs that are not shown', async () => {
  const mixer = await read('public/litrus-mixer/index.html');
  assert.doesNotMatch(mixer, /Starter FAQs will appear in the shop/);
  assert.match(mixer, /Your shop shows no FAQ section until you add one\./);
});

test('both catalogue save paths limit the public and private copies together', async () => {
  const worker = await read('cloudflare/worker.js');
  assert.match(worker, /storedPublic\.bytes \+ storedPrivate\.bytes > MAX_STORED_CATALOG_BYTES/);
  assert.match(worker, /patchedPublic\.bytes \+ patchedPrivate\.bytes > MAX_STORED_CATALOG_BYTES/);
});
