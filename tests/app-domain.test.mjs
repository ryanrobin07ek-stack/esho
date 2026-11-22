import assert from 'node:assert/strict';
import test from 'node:test';
import { createDomain, DOMAIN } from '../src/app/domain.js';

test('the default domain is rrobin.co.ke and loads under plain node', () => {
  assert.equal(DOMAIN.root, 'rrobin.co.ke');
  assert.equal(createDomain().root, 'rrobin.co.ke');
  assert.equal(createDomain(undefined).apex, 'rrobin.co.ke');
  assert.equal(createDomain('').root, 'rrobin.co.ke');
});

test('default domain builds the same host names as before', () => {
  const domain = createDomain('rrobin.co.ke');
  assert.equal(domain.shopHost('main'), 'rrobin.co.ke');
  assert.equal(domain.shopHost('glowmuse'), 'glowmuse.rrobin.co.ke');
  assert.equal(domain.customersTarget, 'customers.rrobin.co.ke');
});

test('craft.ke follows the same rules', () => {
  const domain = createDomain('craft.ke');
  assert.equal(domain.root, 'craft.ke');
  assert.equal(domain.apex, 'craft.ke');
  assert.equal(domain.shopHost('main'), 'craft.ke');
  assert.equal(domain.shopHost('x'), 'x.craft.ke');
  assert.equal(domain.customersTarget, 'customers.craft.ke');
});

test('own hosts are the apex, www and subdomains only', () => {
  for (const root of ['rrobin.co.ke', 'craft.ke']) {
    const domain = createDomain(root);
    assert.equal(domain.isOwnHost(root), true);
    assert.equal(domain.isOwnHost(`www.${root}`), true);
    assert.equal(domain.isOwnHost(`shop.${root}`), true);
    assert.equal(domain.isOwnHost(`a.b.${root}`), true);
    assert.equal(domain.isOwnHost(`evil${root}`), false);
    assert.equal(domain.isOwnHost(`${root}.evil.com`), false);
    assert.equal(domain.isOwnHost('example.com'), false);
    assert.equal(domain.isOwnHost(''), false);
    assert.equal(domain.isOwnHost(undefined), false);
  }
  assert.equal(createDomain('craft.ke').isOwnHost('shop.rrobin.co.ke'), false);
  assert.equal(createDomain('rrobin.co.ke').isOwnHost('shop.craft.ke'), false);
});

test('an invalid root falls back to rrobin.co.ke', () => {
  const invalid = [
    'https://craft.ke', 'craft.ke/', 'craft.ke:8080', 'Craft.KE', 'craft', 'craft..ke',
    '.craft.ke', 'craft.ke.', ' craft.ke', 'craft.ke ', 'a b.ke', null, 42, {},
  ];
  for (const root of invalid) {
    assert.equal(createDomain(root).root, 'rrobin.co.ke', `root ${JSON.stringify(root)} must fall back`);
  }
});

test('a main host under the root moves only the main store; shops and own-host checks are unchanged', () => {
  const domain = createDomain('craft.ke', 'app.craft.ke');
  assert.equal(domain.root, 'craft.ke');
  assert.equal(domain.apex, 'app.craft.ke');
  assert.equal(domain.shopHost('main'), 'app.craft.ke');
  assert.equal(domain.shopHost('glowmuse'), 'glowmuse.craft.ke');
  assert.equal(domain.customersTarget, 'customers.craft.ke');
  assert.equal(domain.isOwnHost('app.craft.ke'), true);
  assert.equal(domain.isOwnHost('craft.ke'), true);
  assert.equal(domain.isOwnHost('evil.com'), false);
});

test('an invalid main host is ignored and the main store stays on the root', () => {
  const invalid = ['', ' ', 'evil.com', 'app.evil.com', 'a.b.craft.ke', 'bad_label.craft.ke', '.craft.ke', 'craft.ke', 'https://app.craft.ke', 'app.craft.ke/', null, 42, {}];
  for (const value of invalid) {
    const domain = createDomain('craft.ke', value);
    assert.equal(domain.apex, 'craft.ke', String(value));
    assert.equal(domain.shopHost('main'), 'craft.ke', String(value));
  }
  assert.equal(createDomain('craft.ke', ' App.Craft.KE ').apex, 'app.craft.ke');
  assert.equal(createDomain(undefined, 'app.rrobin.co.ke').apex, 'app.rrobin.co.ke', 'the main host is checked against the root that is actually used');
  assert.equal(createDomain('rrobin.co.ke', 'app.craft.ke').apex, 'rrobin.co.ke');
});
