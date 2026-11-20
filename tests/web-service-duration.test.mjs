// The web side could not say an item was a service, so every product was handed to the builder as a
// 60-minute booking and a shop that sold goods and time at once lost its services entirely.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isService, offerTypeForCatalogue, serviceDuration } from "../src/service-model.js";
import { readAppSource } from "./helpers/app-source.mjs";

const appHtml = await readAppSource();
const bootstrap = await readFile(new URL("../src/bootstrap.js", import.meta.url), "utf8");

test("the web product form asks what the item is and how long it takes", () => {
  assert.match(appHtml, /name="itemType" data-web-product-item-type/);
  assert.match(appHtml, /<option value="service">Service<\/option>/);
  assert.match(appHtml, /data-web-product-duration hidden>How long it takes/);
  assert.match(appHtml, /name="durationMinutes">\$\{webServiceDurationOptions\(\)\}/);
  // A hidden required stock box would refuse the save with nothing on screen to fix.
  assert.match(appHtml, /if \(stockInput\) stockInput\.required = !isService;/);
  assert.match(appHtml, /duration_minutes: sellsTime \? durationMinutes : null,/);
  assert.match(appHtml, /stock: sellsTime \? null : productVariants\.stock \?\? stock,/);
});

const serviceFields = await readFile(new URL("../src/screens/craft/service-fields.js", import.meta.url), "utf8");

test("the new-website wizard asks what the item is and how long it takes", () => {
  // The wizard form uses the same 15-240 minute list as the store form.
  assert.match(serviceFields, /import \{ SQLiteEngine, webServiceDurationOptions \} from '\.\.\/\.\.\/app\/main\.js';/);
  assert.match(serviceFields, /<label data-service-duration\$\{startAsService \? "" : " hidden"\}>Duration<select name="duration_minutes">\$\{webServiceDurationOptions\(\)\}<\/select>/);
  assert.match(serviceFields, /if \(stockInput\) stockInput\.required = !service;/);
  assert.match(appHtml, /<label data-wizard-product-stock>Starting website stock/);
  assert.match(appHtml, /\$\{serviceFieldsHTML\(\)\}/);
  assert.match(serviceFields, /serviceFieldsHTML\(offerType = SQLiteEngine\.getStore\(\)\?\.offer_type\)/);
  // Saved, loaded back for editing, and carried into the real website products.
  assert.match(appHtml, /stock: durationMinutes \? null : variants\.stock \?\? stock,\s*duration_minutes: durationMinutes/);
  assert.match(appHtml, /serviceFields\.load\(editingProduct\);/);
  assert.match(appHtml, /const durationMinutes = window\.EshopServiceModel\.serviceDuration\(product\) \|\| null;/);
  assert.match(appHtml, /stock,\s*duration_minutes: durationMinutes,/);
  assert.match(appHtml, /Number\(product\.stock\) \|\| 0,\s*Number\(product\.duration_minutes\) \|\| 0,/,
    "changing only a duration must still refresh the published draft catalogue");
});

test("the builder is told the real duration and the real mix of what is sold", () => {
  assert.doesNotMatch(appHtml, /Number\(product\.duration_minutes\) \|\| 60/,
    "no product may be silently turned into an hour-long booking");
  assert.doesNotMatch(appHtml, /offer_type === "services" \? "services" : "products"/,
    'a shop that sells both must not be flattened to "products"');
  assert.match(appHtml, /window\.EshopServiceModel\.offerTypeForCatalogue\(products, store\.offer_type\)/);
  assert.match(bootstrap, /window\.EshopServiceModel = ServiceModel;/);
});

test("a shop that sells goods and time keeps both", () => {
  const catalogue = [{ name: "Shampoo", stock: 4 }, { name: "Haircut", duration_minutes: 45 }];
  assert.equal(offerTypeForCatalogue(catalogue, "products"), "both");
  assert.equal(serviceDuration(catalogue[1]), 45);
  assert.equal(isService(catalogue[0]), false);
  assert.equal(catalogue.filter(isService).length, 1, "the haircut is still findable in a mixed shop");
});
