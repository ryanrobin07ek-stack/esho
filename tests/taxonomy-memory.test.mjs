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

test("the saved-category match is cached, so opening a product form is not a scan", () => {
  // Matching normalised all 14,606 names on every call, twice, before the form drew anything.
  // Measured: 62 ms every time; 6 ms once the normalised names are kept.
  has(source, "const normalizedNameCache = new WeakMap();", "names are cached");
  has(source, "const normalizedFullNameCache = new WeakMap();", "and so are full paths");
  has(source, "const names = normalizedNames(categories);", "the matcher reads the cache");
  has(source, "const paths = normalizedFullNames(categories);", "including for the exact-path scan");
  // Releasing the taxonomy was a guess at the crash and only bought a re-decode, so it is not wired
  // to the builder any more. The function stays for a caller that genuinely needs it.
  has(source, "export function releaseProductTaxonomy", "the release is still available");
  assert.ok(!appHtml.includes("releaseProductTaxonomy?.()"),
    "the builder must not pay a re-decode for memory that was never the problem");
});

test("the builder payload does not carry 36 base64 frames per product", () => {
  // Measured on the phone: java.lang.OutOfMemoryError on a single 54,194,920 byte allocation when
  // the web builder opened. sendCatalog serialised every product's images AND up to 36 spin frames
  // into one postMessage.
  const start = appHtml.indexOf("const sendCatalog = () => {");
  assert.ok(start > 0, "sendCatalog should be findable");
  const body = appHtml.slice(start, appHtml.indexOf("litrusFrame.contentWindow?.postMessage", start));
  assert.ok(!body.includes("spin_frames: Array.isArray(product.spin_frames) ? product.spin_frames"),
    "the frames themselves must not be sent to the builder");
  has(body, "spin_frame_count:", "a count is enough for the preview");
  // And nothing is lost: a builder save that omits them restores what was already stored.
  has(appHtml, ": original?.spin_frames || [],",
    "frames the builder never saw must survive the round trip");
});
