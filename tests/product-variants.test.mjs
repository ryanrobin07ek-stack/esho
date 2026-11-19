// Product options used to be two, hardcoded, with no way to say what a value costs. These cover the
// two things that changed: options are a list now, and a value can carry its own price change.
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  MAX_OPTIONS,
  bindProductVariantFields,
  createProductVariantFields,
  readProductVariantFields
} from "../src/product-variants.js";

function openEditor(saved = {}, basePrice = "") {
  const dom = new JSDOM(`<form><label>Price<input name="price" value="${basePrice}"></label>
    <label>Stock<input name="stock" value="0"></label>${createProductVariantFields(saved)}</form>`);
  const form = dom.window.document.querySelector("form");
  const widget = form.querySelector("[data-product-variants]");
  bindProductVariantFields(widget);
  return { dom, form, widget };
}

// Fills option `index` (0-based), adding a block first when there isn't one.
function setOption(widget, dom, index, name, values) {
  while (widget.querySelectorAll("[data-variant-option]").length <= index) {
    widget.querySelector("[data-variant-add-option]").click();
  }
  const block = widget.querySelectorAll("[data-variant-option]")[index];
  block.querySelector("[data-variant-option-name]").value = name;
  const valueBox = block.querySelector("[data-variant-option-values]");
  valueBox.value = values;
  valueBox.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function priceValue(widget, dom, optionIndex, value, amount) {
  const block = widget.querySelectorAll("[data-variant-option]")[optionIndex];
  const input = block.querySelector(`[data-variant-value-price="${value}"]`);
  assert.ok(input, `a price box should exist for ${value}`);
  input.value = String(amount);
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

test("a saved apparel product reopens with its sizes, prices and stock intact", () => {
  const { widget, form } = openEditor({
    sizes: ["S", "M"],
    colors: ["Black", "Blue"],
    variants: [{ size: "S", color: "Black", price: 12.5, stock: 3 }]
  });
  assert.equal(widget.querySelectorAll("[data-variant-row]").length, 4);
  const first = widget.querySelector('[data-variant-row][data-size="S"][data-color="Black"]');
  assert.equal(first.querySelector("[data-variant-price]").value, "12.5");
  assert.equal(first.querySelector("[data-variant-stock]").value, "3");

  first.querySelector("[data-variant-price]").value = "12.5";
  first.querySelector("[data-variant-stock]").value = "5";
  const saved = readProductVariantFields(form);
  assert.equal(saved.stock, 5);
  assert.deepEqual(saved.sizes, ["S", "M"]);
  assert.deepEqual(saved.colors, ["Black", "Blue"]);
  // The old two-value id shape is kept, so a cart or order placed earlier still matches.
  assert.equal(saved.variants[0].id, '["S","Black"]');
  assert.equal(saved.variants[0].size, "S");
  assert.equal(saved.variants[0].color, "Black");
  assert.equal(saved.variants[0].option1_name, "Size");
});

test("an owner can use more than two options", () => {
  const { widget, form, dom } = openEditor();
  setOption(widget, dom, 0, "Size", "S, M");
  setOption(widget, dom, 1, "Colour", "Black, Blue");
  setOption(widget, dom, 2, "Fabric", "Cotton, Linen");
  assert.equal(widget.querySelectorAll("[data-variant-row]").length, 8, "2 x 2 x 2 combinations");

  const saved = readProductVariantFields(form);
  assert.equal(saved.options.length, 3);
  assert.deepEqual(saved.options.map(option => option.name), ["Size", "Colour", "Fabric"]);
  const cotton = saved.variants.find(variant =>
    variant.option1_value === "M" && variant.option2_value === "Blue" && variant.option3_value === "Cotton");
  assert.ok(cotton, "the third option reaches the saved variant");
  assert.equal(cotton.option3_name, "Fabric");
  assert.equal(cotton.id, '["M","Blue","Cotton"]');

  // A fourth is allowed; a fifth is not.
  setOption(widget, dom, 3, "Finish", "Matte");
  assert.equal(readProductVariantFields(form).options.length, MAX_OPTIONS);
  assert.equal(widget.querySelector("[data-variant-add-option]").disabled, true);
});

test("a value carries its own price change, and every combination with it follows", () => {
  const { widget, form, dom } = openEditor({}, "1000");
  setOption(widget, dom, 0, "Size", "S, L");
  setOption(widget, dom, 1, "Colour", "Black, Red");
  // Said once, instead of typing a price into every combination containing Large.
  priceValue(widget, dom, 0, "L", 200);
  priceValue(widget, dom, 1, "Red", 50);

  const large = widget.querySelector('[data-variant-row][data-option1-value="L"][data-option2-value="Black"]');
  assert.equal(large.querySelector("[data-variant-price]").value, "1200", "1000 base + 200 for Large");
  const both = widget.querySelector('[data-variant-row][data-option1-value="L"][data-option2-value="Red"]');
  assert.equal(both.querySelector("[data-variant-price]").value, "1250", "both adjustments add up");
  const plain = widget.querySelector('[data-variant-row][data-option1-value="S"][data-option2-value="Black"]');
  assert.equal(plain.querySelector("[data-variant-price]").value, "", "an unadjusted value stays on the product price");

  const saved = readProductVariantFields(form);
  assert.equal(saved.options[0].values.find(value => value.value === "L").priceDelta, 200);
  assert.equal(saved.options[1].values.find(value => value.value === "Red").priceDelta, 50);
  assert.equal(saved.variants.find(variant => variant.id === '["L","Red"]').price, 1250);
  // A price typed over the suggestion wins.
  both.querySelector("[data-variant-price]").value = "1500";
  assert.equal(readProductVariantFields(form).variants.find(variant => variant.id === '["L","Red"]').price, 1500);
});

test("removing an option rebuilds the combinations, and the editor refuses a broken setup", () => {
  const { widget, form, dom } = openEditor();
  setOption(widget, dom, 0, "Size", "S, M");
  setOption(widget, dom, 1, "Colour", "Black, Blue");
  assert.equal(widget.querySelectorAll("[data-variant-row]").length, 4);

  widget.querySelectorAll("[data-variant-option]")[1].querySelector("[data-variant-remove-option]").click();
  assert.equal(widget.querySelectorAll("[data-variant-row]").length, 2, "only the sizes are left");
  assert.equal(readProductVariantFields(form).options.length, 1);

  // Values without a name is a setup the owner must fix, not something saved silently.
  setOption(widget, dom, 1, "", "Red, Blue");
  assert.match(widget.querySelector("[data-variant-status]").textContent, /Name every option/);
  assert.throws(() => readProductVariantFields(form), /name and values for option 2/);
});

test("a product with no options stays on the shared product stock", () => {
  const { widget, form } = openEditor();
  assert.equal(widget.querySelectorAll("[data-variant-option]").length, 1,
    "one empty block is shown so the owner can see where to type");
  assert.equal(widget.querySelectorAll("[data-variant-row]").length, 0);
  assert.deepEqual(readProductVariantFields(form), { sizes: [], colors: [], options: [], variants: [] });
  assert.equal(form.querySelector('[name="stock"]').disabled, false, "the product's own stock still applies");
});
