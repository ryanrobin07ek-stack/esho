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
