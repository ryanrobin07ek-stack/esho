import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  bindProductVariantFields,
  createProductVariantFields,
  readProductVariantFields
} from "../src/product-variants.js";

test("variant editor creates size/color combinations with independent stock and optional prices", () => {
  const dom = new JSDOM(`<form>${createProductVariantFields({
    sizes: ["S", "M"],
    colors: ["Black", "Blue"],
    variants: [{ size: "S", color: "Black", price: 12.5, stock: 3 }]
  })}</form>`);
  const { document } = dom.window;
  const form = document.querySelector("form");
  const widget = form.querySelector("[data-product-variants]");
  bindProductVariantFields(widget);

  assert.equal(widget.querySelectorAll("[data-variant-row]").length, 4);
  const first = widget.querySelector('[data-variant-row][data-size="S"][data-color="Black"]');
  assert.equal(first.querySelector("[data-variant-price]").value, "12.5");
  assert.equal(first.querySelector("[data-variant-stock]").value, "3");
  first.querySelector("[data-variant-stock]").value = "5";

  assert.deepEqual(readProductVariantFields(form), {
    sizes: ["S", "M"],
    colors: ["Black", "Blue"],
    variants: [
      { id: '["S","Black"]', size: "S", color: "Black", price: 12.5, stock: 5 },
      { id: '["S","Blue"]', size: "S", color: "Blue", price: null, stock: 0 },
      { id: '["M","Black"]', size: "M", color: "Black", price: null, stock: 0 },
      { id: '["M","Blue"]', size: "M", color: "Blue", price: null, stock: 0 }
    ],
    stock: 5
  });
  dom.window.close();
});

test("variant editor leaves products without options on the shared product stock", () => {
  const dom = new JSDOM(`<form>${createProductVariantFields()}</form>`);
  const { document } = dom.window;
  const form = document.querySelector("form");
  bindProductVariantFields(form);
  assert.deepEqual(readProductVariantFields(form), {
    sizes: [],
    colors: [],
    variants: []
  });
  dom.window.close();
});
