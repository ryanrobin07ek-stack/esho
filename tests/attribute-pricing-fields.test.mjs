// The owner needs somewhere to say "Leather costs 500 more". This is that editor: it offers the
// chosen category's own attributes, and only the choices the shop actually sells.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import test from "node:test";
import {
  bindAttributePricingFields,
  createAttributePricingFields,
  readAttributePricingFields
} from "../src/attribute-pricing-fields.js";

const shoeAttributes = [
  {
    attributeId: "gid://shopify/TaxonomyAttribute/9",
    attributeName: "Footwear material",
    values: [{ value: "Leather" }, { value: "Canvas" }, { value: "Suede" }]
  },
  {
    attributeId: "gid://shopify/TaxonomyAttribute/1",
    attributeName: "Color",
    values: [{ value: "Beige" }, { value: "Red" }]
  }
];

function openEditor({ pricedAttributes = [], attributes = shoeAttributes } = {}) {
  const dom = new JSDOM(`<form>${createAttributePricingFields({ pricedAttributes })}</form>`);
  const form = dom.window.document.querySelector("form");
  const widget = form.querySelector("[data-attribute-pricing]");
  bindAttributePricingFields(widget, () => attributes);
  return { dom, form, widget };
}

test("the owner adds a priced choice and it reads back ready to charge", () => {
  const { widget, form } = openEditor();
  assert.deepEqual(readAttributePricingFields(widget), [], "nothing is priced to begin with");

  widget.querySelector("[data-attribute-pricing-add]").click();
  const row = widget.querySelector("[data-priced-attribute]");
  assert.ok(row, "a row appears for the first attribute of the category");
  assert.equal(row.querySelector("[data-priced-attribute-name]").value, "Footwear material");

  row.querySelector("[data-priced-value-delta]").value = "500";
  const saved = readAttributePricingFields(widget);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].attributeName, "Footwear material");
  assert.equal(saved[0].attributeId, "gid://shopify/TaxonomyAttribute/9",
    "the id travels so the storefront and till match the same attribute");
  assert.deepEqual(saved[0].values, [
    { valueId: "", value: "Leather", priceDelta: 500 }
  ]);
  assert.ok(form.querySelector("[data-attribute-pricing]"), "the editor stays part of the form");
});

test("a second choice can be added, and removing the last one unprices the attribute", () => {
  const { widget } = openEditor();
  widget.querySelector("[data-attribute-pricing-add]").click();
  widget.querySelector("[data-priced-value-delta]").value = "500";
  widget.querySelector("[data-priced-value-add]").click();

  const values = widget.querySelectorAll("[data-priced-value]");
  assert.equal(values.length, 2, "the next unused choice is offered");
  assert.equal(values[1].querySelector("[data-priced-value-name]").value, "Canvas");
  assert.equal(readAttributePricingFields(widget)[0].values[0].priceDelta, 500,
    "the typed price survives the re-render");

  values[1].querySelector("[data-priced-value-remove]").click();
  assert.equal(widget.querySelectorAll("[data-priced-value]").length, 1);
  widget.querySelector("[data-priced-value-remove]").click();
  assert.deepEqual(readAttributePricingFields(widget), [],
    "an attribute with no choices left is not priced at all");
});

test("switching the attribute offers that attribute's own choices", () => {
  const { widget, dom } = openEditor();
  widget.querySelector("[data-attribute-pricing-add]").click();
  const select = widget.querySelector("[data-priced-attribute-name]");
  select.value = "Color";
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

  const row = widget.querySelector("[data-priced-attribute]");
  assert.equal(row.querySelector("[data-priced-attribute-name]").value, "Color");
  const offered = [...row.querySelectorAll("[data-priced-value-name] option")].map(option => option.value);
  assert.deepEqual(offered, ["Beige", "Red"], "the shoe-material choices are gone");
  assert.equal(readAttributePricingFields(widget)[0].attributeId, "gid://shopify/TaxonomyAttribute/1");
});

test("a saved product reopens with its prices, and no category means nothing to price yet", () => {
  const { widget } = openEditor({
    pricedAttributes: [{
      attributeId: "gid://shopify/TaxonomyAttribute/9",
      attributeName: "Footwear material",
      values: [{ value: "Leather", priceDelta: 500 }, { value: "Canvas", priceDelta: 0 }]
    }]
  });
  const saved = readAttributePricingFields(widget);
  assert.equal(saved[0].values.length, 2);
  assert.equal(saved[0].values[0].priceDelta, 500);

  // Before a category is chosen there are no attributes to offer, and the editor says so instead of
  // showing an empty box the owner cannot use.
  const { widget: empty } = openEditor({ attributes: [] });
  assert.equal(empty.querySelector("[data-attribute-pricing-add]").disabled, true);
  assert.match(empty.querySelector("[data-attribute-pricing-status]").textContent, /Pick the product type/);
});
