// The app was being killed by Android for using too much memory when the web builder opened. The
// taxonomy is ~12.8 MB of JSON (14,606 categories, 8,195 attributes, 73,133 values) and was held for
// the whole session, alongside the 1.5 MB encoded copy it came from.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/product-taxonomy.js", import.meta.url), "utf8");
const appHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const has = (text, snippet, why) => assert.ok(text.includes(snippet), `${why}\nmissing: ${snippet}`);

test("the encoded string is freed, but the bytes are kept so it can be decoded again", () => {
  has(source, "delete globalThis.__ESHOP_PRODUCT_TAXONOMY_GZIP__",
    "the 1.5 MB base64 string must not be held for the life of the page");
  has(source, "let compressedBytes;",
    "the compressed bytes are kept, or releasing the taxonomy leaves nothing to reload from");
  // The trap this guards: release() followed by load() must still work. Deleting the string without
  // keeping the bytes would leave the first product form opened after the web builder with no
  // categories at all.
  has(source, "if (compressedBytes) return compressedBytes;",
    "a second decode must reuse the kept bytes");
});

test("matching a saved category no longer builds the whole search index", () => {
  // searchProductTaxonomyCategories caches a normalised entry per category. Building that just to
  // match a name a product was saved with is what pushed the app over the edge.
  const matcher = source.slice(source.indexOf("export function findClosestProductTaxonomyCategory"));
  const body = matcher.slice(0, matcher.indexOf("\n}"));
  assert.ok(!body.includes("searchProductTaxonomyCategories"),
    "the closest-match path must not build or keep the search index");
  has(body, "bestNameMatch", "it scores names in one pass instead");
  has(source, "function bestNameMatch", "and that helper keeps nothing");
});

test("the taxonomy can be released, and the builder releases it", () => {
  has(source, "export function releaseProductTaxonomy", "there must be a way to drop it");
  has(source, "taxonomyPromise = undefined;", "releasing clears the cached decode");
  has(appHtml, "releaseProductTaxonomy?.()", "opening the web builder must let the taxonomy go");
});
