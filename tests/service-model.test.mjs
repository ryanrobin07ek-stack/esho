import assert from 'node:assert/strict';
import test from 'node:test';
import { tracksStock as analyticsTracksStock } from '../src/local-analytics.js';
import {
  OFFER_TYPES, deductsStock, isOutOfStock, isService, normalizeOfferType, normalizeServiceDuration,
  offerTypeForCatalogue, primaryAction, primaryActionLabel, sellsProducts, sellsServices,
  serviceDuration, tracksStock
} from '../src/service-model.js';

const haircut = { id: 1, name: 'Haircut', price: 800, duration_minutes: 45, stock: null };
const shampoo = { id: 2, name: 'Shampoo', price: 950, stock: 12 };
const madeToOrder = { id: 3, name: 'Tailored shirt', price: 3000, stock: null };

test('a salon that also sells cosmetics is describable: the shop is "both"', () => {
  assert.equal(offerTypeForCatalogue([haircut, shampoo]), 'both');
  assert.equal(offerTypeForCatalogue([haircut]), 'services');
  assert.equal(offerTypeForCatalogue([shampoo]), 'products');
  // An empty catalogue keeps whatever the owner chose.
  assert.equal(offerTypeForCatalogue([], 'services'), 'services');
  assert.equal(offerTypeForCatalogue([], 'nonsense'), 'products');
  assert.ok(OFFER_TYPES.includes('both'));
  assert.equal(sellsProducts('both') && sellsServices('both'), true);
  assert.equal(sellsProducts('services'), false);
  assert.equal(sellsServices('products'), false);
});

test('being a service is a property of the item, never of the shop', () => {
  assert.equal(isService(haircut), true);
  assert.equal(isService(shampoo), false);
  // Rows written by older code or by the builder are still read correctly.
  assert.equal(isService({ kind: 'service' }), true);
  assert.equal(isService({ is_service: 1 }), true);
  assert.equal(isService({ durationMinutes: 30 }), true);
  assert.equal(isService(null), false);
  // The same catalogue gives each card its own button, side by side.
  assert.deepEqual([haircut, shampoo].map(primaryAction), ['book', 'add_to_bag']);
  assert.deepEqual([haircut, shampoo].map(primaryActionLabel), ['Book', 'Add to bag']);
});

test('a service is never out of stock and never moves an inventory number', () => {
  assert.equal(tracksStock(haircut), false);
  assert.equal(deductsStock(haircut), false);
  assert.equal(isOutOfStock(haircut), false);
  // Even a service row that somehow carries stock 0 stays sellable at the till.
  assert.equal(isOutOfStock({ ...haircut, stock: 0 }), false);
  // Ordinary goods are unchanged.
  assert.equal(tracksStock(shampoo), true);
  assert.equal(deductsStock(shampoo), true);
  assert.equal(isOutOfStock({ ...shampoo, stock: 0 }), true);
  // A made-to-order good with no stock number is sellable, not "out of stock".
  assert.equal(tracksStock(madeToOrder), false);
  assert.equal(isOutOfStock(madeToOrder), false);
});

test('stock tracking still agrees with the analytics rule for ordinary goods', () => {
  for (const product of [shampoo, madeToOrder, { stock: 0 }, { stock: '' }, { stock: 'abc' }]) {
    assert.equal(tracksStock(product), analyticsTracksStock(product), JSON.stringify(product));
  }
  // The one deliberate difference: analytics counts a service's stock, this module never does.
  assert.equal(analyticsTracksStock({ duration_minutes: 45, stock: 3 }), true);
  assert.equal(tracksStock({ duration_minutes: 45, stock: 3 }), false);
});

test('durations snap onto the 15-240 minute grid the booking endpoints accept', () => {
  assert.equal(normalizeServiceDuration(50), 45, 'snaps to the nearest grid point, not upward');
  assert.equal(normalizeServiceDuration(7), 15);
  assert.equal(normalizeServiceDuration(400), 240);
  assert.equal(normalizeServiceDuration(45), 45);
  assert.equal(normalizeServiceDuration(0), 0);
  assert.equal(normalizeServiceDuration('90'), 90);
  assert.equal(normalizeServiceDuration('abc'), 0);
  assert.equal(serviceDuration(haircut), 45);
  assert.equal(serviceDuration(shampoo), 0);
  // Reading a product back gives the value the server would accept, not the typed one.
  assert.equal(serviceDuration({ duration_minutes: 50 }), 45);
});

test('an unknown offer type degrades to products instead of hiding the catalogue', () => {
  assert.equal(normalizeOfferType('SERVICES'), 'services');
  assert.equal(normalizeOfferType(' both '), 'both');
  assert.equal(normalizeOfferType(undefined), 'products');
  assert.equal(normalizeOfferType('retail'), 'products');
});
