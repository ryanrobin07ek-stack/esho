// An attribute used to be descriptive text only: an owner could say a shoe was leather but could not
// charge more for the leather one. These are the rules for charging, shared by every surface.
import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PRICED_ATTRIBUTES,
  MAX_PRICED_VALUES,
  attributePriceDelta,
  chosenAttributeLabel,
  hasPricedAttributes,
  normalizeChosenAttributes,
  normalizePricedAttributes,
  priceWithAttributes
} from "../src/attribute-pricing.js";

const material = {
  attributeId: "gid://shopify/TaxonomyAttribute/9",
  attributeName: "Footwear material",
  values: [
    { value: "Leather", priceDelta: 500 },
    { value: "Canvas", priceDelta: 0 },
    { value: "Offcut", priceDelta: -150 }
  ]
};
const colour = {
  attributeId: "gid://shopify/TaxonomyAttribute/1",
  attributeName: "Color",
  values: [{ value: "Beige", priceDelta: 0 }, { value: "Red", priceDelta: 100 }]
};

test("clicking through attributes changes the price, up or down", () => {
  const offered = [material, colour];
  const price = chosen => priceWithAttributes(1000, offered, chosen);
  assert.equal(price([]), 1000, "nothing chosen leaves the base price alone");
  assert.equal(price([{ attributeName: "Footwear material", value: "Leather" }]), 1500);
  assert.equal(price([{ attributeName: "Footwear material", value: "Canvas" }]), 1000);
  assert.equal(price([{ attributeName: "Footwear material", value: "Offcut" }]), 850,
    "an owner can also take money off");
  assert.equal(price([
    { attributeName: "Footwear material", value: "Leather" },
    { attributeName: "Color", value: "Red" }
  ]), 1600, "two priced attributes add up");
  // A shop cannot end up paying the customer.
  assert.equal(priceWithAttributes(100, [material], [{ attributeName: "Footwear material", value: "Offcut" }]), 0);
  assert.equal(attributePriceDelta([material], [{ attributeName: "Footwear material", value: "Leather" }]), 500);
});

test("a choice the product no longer offers is dropped, never charged for", () => {
  const picked = normalizeChosenAttributes([material], [
    { attributeName: "Footwear material", value: "Gold plated" },
    { attributeName: "Fabric", value: "Linen" }
  ]);
  assert.deepEqual(picked, [], "neither the unknown value nor the unknown attribute survives");
  assert.equal(priceWithAttributes(1000, [material], [{ attributeName: "Footwear material", value: "Gold plated" }]), 1000);
  // Matching ignores case, so a storefront and a till agree on "leather".
  assert.equal(normalizeChosenAttributes([material], [{ attributeName: "Footwear material", value: "leather" }])[0].value,
    "Leather");
  assert.equal(chosenAttributeLabel([{ value: "Leather" }, { value: "Red" }]), "Leather / Red");
  assert.equal(chosenAttributeLabel(null), "");
});

test("the owner's setup is checked, with wording that can be shown in the form", () => {
  assert.deepEqual(normalizePricedAttributes(null), []);
  assert.deepEqual(normalizePricedAttributes([{ attributeName: "Color", values: [] }]), [],
    "an attribute with no choices is not a priced attribute");
  assert.equal(normalizePricedAttributes([material])[0].values[0].priceDelta, 500);
  // A blank price means no change, not a broken product.
  assert.equal(normalizePricedAttributes([{ attributeName: "Color", values: [{ value: "Red", priceDelta: "" }] }])[0]
    .values[0].priceDelta, 0);

  assert.throws(() => normalizePricedAttributes([{ attributeName: "", attributeId: "x", values: [{ value: "Red" }] }]),
    /needs a name/);
  assert.throws(() => normalizePricedAttributes([material, { ...material }]), /listed twice/);
  assert.throws(() => normalizePricedAttributes([{
    attributeName: "Color", values: [{ value: "Red" }, { value: "red" }]
  }]), /lists red twice/);
  assert.throws(() => normalizePricedAttributes([{
    attributeName: "Color", values: [{ value: "Red", priceDelta: "abc" }]
  }]), /valid price change for Color: Red/);
  assert.throws(() => normalizePricedAttributes(
    Array.from({ length: MAX_PRICED_ATTRIBUTES + 1 }, (_, index) => ({
      attributeName: `Attribute ${index}`, values: [{ value: "x" }]
    }))
  ), /up to 5 attributes/);
  assert.throws(() => normalizePricedAttributes([{
    attributeName: "Color",
    values: Array.from({ length: MAX_PRICED_VALUES + 1 }, (_, index) => ({ value: `v${index}` }))
  }]), /up to 20 choices/);
});

test("a surface can tell whether a product needs asking about before it is sold", () => {
  assert.equal(hasPricedAttributes({ priced_attributes: [material] }), true);
  assert.equal(hasPricedAttributes({ pricedAttributes: [material] }), true);
  assert.equal(hasPricedAttributes({ priced_attributes: [] }), false);
  assert.equal(hasPricedAttributes({}), false);
  assert.equal(hasPricedAttributes(null), false);
});
