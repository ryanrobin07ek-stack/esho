import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const posSource = await readFile(new URL("../src/pos.js", import.meta.url), "utf8");
const appStyles = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("POS Sell keeps checkout floating while products remain scrollable", () => {
  const mobileStart = appStyles.indexOf("@media (max-width: 760px)");
  const mobileEnd = appStyles.indexOf("@media (max-width: 520px)", mobileStart);
  const mobileStyles = appStyles.slice(mobileStart, mobileEnd);

  assert.match(posSource, /<select name="category"><option value="">All<\/option>/);
  assert.match(posSource, /state\.category = categorySelect\.value/);
  assert.match(posSource, /String\(product\.categoryId\) === state\.category/);
  assert.doesNotMatch(posSource, /pos-category-filter|selectedCategoryIds/);
  const paymentMethods = ["Cash", "Mobile money", "Card", "Bank", "Other"]
    .map((method) => posSource.indexOf(`data-method="${method}"`));
  assert.ok(paymentMethods.every((index) => index >= 0));
  assert.ok(paymentMethods.every((index, position) => position === 0 || paymentMethods[position - 1] < index));
  assert.match(posSource, /data-pos-action="set-discount"/);
  assert.match(posSource, /role="dialog" aria-modal="true"/);
  assert.match(posSource, /data-pos-form="discount"/);
  assert.doesNotMatch(posSource, /prompt\(`Discount amount/);
  assert.match(posSource, /discountCents \/ subtotal \* 100/);
  assert.match(posSource, /data\.discountAmount/);
  assert.match(posSource, /pos-main\$\{path === '\/pos' \? ' pos-sell-screen' : ''\}/);
  assert.match(appStyles, /\.pos-main\.pos-sell-screen \.pos-header-divider\s*\{\s*margin-bottom:\s*0;/);
  assert.match(posSource, /class="pos-card pos-cart \$\{emptyCart \? 'is-empty' : 'is-open'\}"/);
  assert.match(mobileStyles, /\.pos-cart-items\s*\{[^}]*max-height:\s*78px/);
  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart);
  assert.match(mobileStyles, /\.pos-cart\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*950;[^}]*bottom:\s*env\(safe-area-inset-bottom/);
  assert.match(mobileStyles, /\.pos-cart\s*\{[^}]*top:\s*auto/);
  assert.match(mobileStyles, /\.pos-cart\s*\{[^}]*height:\s*min\(42vh,\s*360px\)/);
  assert.match(mobileStyles, /\.pos-cart\.is-empty\s*\{\s*display:\s*none/);
  assert.match(mobileStyles, /\.pos-product-grid\s*\{[^}]*padding-bottom:\s*calc\(42vh/);
  assert.match(mobileStyles, /\.pos-scanner-entry\s*\{[^}]*position:\s*sticky/);
  assert.match(mobileStyles, /\.pos-checkout-actions\s*\{[^}]*position:\s*sticky/);
  assert.match(mobileStyles, /\.pos-checkout-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3/);
  assert.match(mobileStyles, /\.pos-cart \.pos-cart-item input\[type="number"\]\s*\{[^}]*width:\s*38px;[^}]*min-height:\s*28px/);
  assert.match(mobileStyles, /\.pos-cart \.pos-checkout-actions button\s*\{[^}]*height:\s*28px !important;[^}]*font-size:\s*0\.65rem !important/);
  assert.match(mobileStyles, /\.pos-cart \.pos-checkout-complete\s*\{[^}]*height:\s*28px !important/);
  assert.match(appStyles, /\.pos-discount-modal\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*1200/);
});
