// Two pricing systems sit side by side in every product form: option values (Size L +500) become
// variants that hold stock, attribute prices (Leather +300) hold none. Each card says so in one
// line, the same words everywhere, because every form builds these cards from the same two factories.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readAppScript } from "./helpers/app-source.mjs";
import { createProductVariantFields } from "../src/product-variants.js";
import { createAttributePricingFields } from "../src/attribute-pricing-fields.js";

const OPTIONS_HINT = "Each choice can change the price and has its own stock.";
const ATTRIBUTES_HINT = "Adds to the price; no separate stock.";

test("each pricing card has one helper line under its heading", () => {
  const lineAfterHeading = (html, heading) => html.split("</h3>")[0].endsWith(heading) &&
    html.split("</h3>")[1].trim().split("\n")[0];
  assert.equal(lineAfterHeading(createProductVariantFields(), "Options <span>Optional</span>"),
    `<p class="editor-card-hint">${OPTIONS_HINT}</p>`);
  assert.equal(lineAfterHeading(createAttributePricingFields(), "Attribute prices <span>Optional</span>"),
    `<p class="editor-card-hint">${ATTRIBUTES_HINT}</p>`);
});

test("every product form uses the shared cards, so the wording cannot drift", async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const forms = {
    "src/app/main.js": await readAppScript(),
    "src/screens/craft/new-store-products.js": await read("src/screens/craft/new-store-products.js"),
    "src/screens/till/catalogue-inventory.js": await read("src/screens/till/catalogue-inventory.js")
  };
  for (const [file, source] of Object.entries(forms)) {
    assert.match(source, /createProductVariantFields\(/, `${file} builds Options from the shared card`);
    assert.match(source, /createAttributePricingFields\(/, `${file} builds Attribute prices from the shared card`);
    assert.doesNotMatch(source, /<h3>(Options|Attribute prices)\b/, `${file} has no hand-written copy of a card heading`);
  }
  const css = await read("src/editor-cards.css");
  assert.match(css, /> p\.editor-card-hint \{[^}]*font-size: 0\.74rem;/, "the line stays small");
});
