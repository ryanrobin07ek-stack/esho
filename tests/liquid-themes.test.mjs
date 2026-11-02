import assert from "node:assert/strict";
import test from "node:test";
import { renderTheme } from "../experiments/liquid-themes/render.mjs";

const fogoCatalog = {
  store: { name: "Fogo" },
  categories: [{ id: 1, name: "Shoes" }],
  products: [{ id: 1, name: "Fogo Runner", price: 2500, image: "https://images.test/runner.webp" }]
};

test("different Liquid templates change presentation without changing shop content", async () => {
  const editorial = await renderTheme("editorial", fogoCatalog);
  const market = await renderTheme("market", fogoCatalog);

  for (const html of [editorial, market]) {
    assert.match(html, /Fogo Runner/);
    assert.match(html, /Shoes/);
    assert.doesNotMatch(html, /Chapa|Sartorial/);
  }
  assert.match(editorial, /font: 16px Georgia/);
  assert.match(market, /font: 16px Arial/);
});

test("Liquid output escapes merchant text and rejects unknown templates", async () => {
  const html = await renderTheme("market", {
    ...fogoCatalog,
    store: { name: "<script>alert(1)</script>" },
    products: [{ id: 2, name: "<img src=x onerror=alert(1)>", price: 10 }]
  });

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>|<img src=x onerror=/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  await assert.rejects(() => renderTheme("missing", fogoCatalog), /Unknown Liquid theme/);
});
