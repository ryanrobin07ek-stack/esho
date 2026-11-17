import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  bindProductVariantFields,
  createProductVariantFields,
  readProductVariantFields
} from "../src/product-variants.js";

test("variant editor preserves legacy apparel options and independent stock and prices", () => {
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
    option1_name: "Size",
    option2_name: "Color",
    sizes: ["S", "M"],
    colors: ["Black", "Blue"],
    variants: [
      { id: '["S","Black"]', option1_name: "Size", option1_value: "S", option2_name: "Color", option2_value: "Black", size: "S", color: "Black", price: 12.5, stock: 5 },
      { id: '["S","Blue"]', option1_name: "Size", option1_value: "S", option2_name: "Color", option2_value: "Blue", size: "S", color: "Blue", price: null, stock: 0 },
      { id: '["M","Black"]', option1_name: "Size", option1_value: "M", option2_name: "Color", option2_value: "Black", size: "M", color: "Black", price: null, stock: 0 },
      { id: '["M","Blue"]', option1_name: "Size", option1_value: "M", option2_name: "Color", option2_value: "Blue", size: "M", color: "Blue", price: null, stock: 0 }
    ],
    stock: 5
  });
  dom.window.close();
});

test("variant editor supports merchant-defined non-apparel options", () => {
  const dom = new JSDOM(`<form>${createProductVariantFields({
    option1Name: "Pack size",
    option2Name: "Flavor"
  })}</form>`);
  const { document, Event } = dom.window;
  const form = document.querySelector("form");
  const widget = form.querySelector("[data-product-variants]");
  bindProductVariantFields(widget);

  const option1Values = widget.querySelector('[data-variant-option-values="1"]');
  const option2Values = widget.querySelector('[data-variant-option-values="2"]');
  option1Values.value = "250 g, 500 g";
  option1Values.dispatchEvent(new Event("change"));
  option2Values.value = "Plain, Vanilla";
  option2Values.dispatchEvent(new Event("change"));
  assert.equal(widget.querySelectorAll("[data-variant-row]").length, 4);
  const cereal = widget.querySelector('[data-variant-row][data-option1-value="500 g"][data-option2-value="Vanilla"]');
  assert.match(cereal.textContent, /Pack size: 500 g/);
  assert.match(cereal.textContent, /Flavor: Vanilla/);
  cereal.querySelector("[data-variant-price]").value = "4.5";
  cereal.querySelector("[data-variant-stock]").value = "12";

  const result = readProductVariantFields(form);
  assert.equal(result.option1_name, "Pack size");
  assert.equal(result.option2_name, "Flavor");
  assert.deepEqual(result.sizes, ["250 g", "500 g"]);
  assert.deepEqual(result.colors, ["Plain", "Vanilla"]);
  assert.equal(result.variants[3].option1_value, "500 g");
  assert.equal(result.variants[3].option2_value, "Vanilla");
  assert.equal(result.variants[3].price, 4.5);
  assert.equal(result.variants[3].stock, 12);
  assert.equal(result.stock, 12);
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
