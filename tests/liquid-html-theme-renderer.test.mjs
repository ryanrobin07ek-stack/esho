import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import { importStandaloneTheme, validateFilledTheme } from "../public/theme-importer.js";
import { renderLiquidHtmlTheme } from "../public/liquid-html-theme-renderer.js";

const parser = new JSDOM("").window.DOMParser;
const themeIds = ["stepz-footwear", "aviya-luxury"];
const catalog = {
  store: { currency: "KES", name: "Owner Store" },
  categories: [
    { id: "craft-category-running", name: "Owner Running", slug: "owner-running" },
    { id: "craft-category-casual", name: "Owner Casual", slug: "owner-casual" }
  ],
  products: [
    {
      id: "craft-product-742",
      name: "Merchant Runner",
      description: "Shop-owned product description.",
      price: 2500,
      category_id: "craft-category-running",
      brand: "Owner Brand",
      sku: "OWNER-SKU-742",
      images: [{ url: "https://shop.example.test/runner.webp" }],
      sizes: ["39", "40"],
      colors: ["blue"]
    },
    {
      id: "craft-product-981",
      name: "Merchant Loafer",
      description: "A second shop-owned description.",
      selling_price: 3200,
      category_id: "craft-category-casual",
      images: []
    }
  ]
};

async function themeSource(themeId) {
  return readFile(new URL(`../public/theme-packages/${themeId}/index.html`, import.meta.url), "utf8");
}

for (const themeId of themeIds) {
  test(`${themeId} imports and fills a real-shaped shop catalog`, async () => {
    const source = await themeSource(themeId);
    const imported = importStandaloneTheme(source, { themeId, DOMParser: parser });
    assert.equal(imported.manifest.status, "passed");
    assert.equal(imported.manifest.productCount, themeId === "stepz-footwear" ? 60 : 8);
    assert.ok(imported.manifest.fieldMap.required.includes("id"));
    assert.ok(imported.manifest.fieldMap.required.includes("category"));
    assert.ok(imported.manifest.repeaters.some(item => item.name === "products"));

    const html = await renderLiquidHtmlTheme(themeId, catalog, {
      DOMParser: parser,
      baseUrl: "https://shop.example.test/",
      loadFile: async () => source
    });
    const document = new JSDOM(html).window.document;
    const productIds = new Set(catalog.products.map(product => product.id));
    assert.equal(document.querySelectorAll("[data-eshop-filled-products]").length, 1);
    assert.deepEqual(
      JSON.parse(document.querySelector("[data-eshop-filled-products]").textContent).map(item => item.id),
      [...productIds]
    );
    assert.ok([...document.querySelectorAll("[data-product-id]")].every(element =>
      productIds.has(element.getAttribute("data-product-id"))));
    assert.ok([...document.querySelectorAll("[data-action][data-id]")].every(element =>
      productIds.has(element.getAttribute("data-id"))));
    assert.match(html, /Merchant Runner/);
    assert.match(html, /"categoryId":"craft-category-running"/);
    assert.doesNotMatch(html, /images\.unsplash\.com|STPZ-CN-001|Cloud Nine Ultra Prime|Wedding Ring/);
    assert.equal(validateFilledTheme(html, imported.manifest, catalog, { DOMParser: parser }).ok, true);
  });

  test(`${themeId} renders an empty catalog without sample product IDs`, async () => {
    const source = await themeSource(themeId);
    const imported = importStandaloneTheme(source, { themeId, DOMParser: parser });
    const emptyCatalog = { store: { currency: "KES" }, categories: [], products: [] };
    const html = await renderLiquidHtmlTheme(themeId, emptyCatalog, {
      DOMParser: parser,
      loadFile: async () => source
    });
    const document = new JSDOM(html).window.document;
    assert.deepEqual(JSON.parse(document.querySelector("[data-eshop-filled-products]").textContent), []);
    assert.equal(document.querySelectorAll("[data-product-id]").length, 0);
    assert.ok(document.querySelector(".eshop-empty-catalog"));
    assert.equal(validateFilledTheme(html, imported.manifest, emptyCatalog, { DOMParser: parser }).ok, true);
    assert.doesNotMatch(html, /Cloud Nine Ultra Prime|Wedding Ring|STPZ-CN-001/);
  });
}

test("generic importer resets sample state and disables simulated payment success", async () => {
  const source = await themeSource("stepz-footwear");
  const imported = importStandaloneTheme(source, { themeId: "stepz-footwear", DOMParser: parser });
  assert.ok(imported.manifest.stateReset.includes("cart"));
  assert.ok(imported.manifest.stateReset.includes("wishlist"));
  assert.ok(imported.manifest.stateReset.some(name => /simulate.*success/i.test(name)));
  assert.doesNotMatch(imported.html, /navigateTo\(['"]payment-success['"]\)/);
});

test("sample validation allows shop data that coincidentally matches a theme sample token", () => {
  const shop = {
    products: [{ id: "shop-cedar", name: "Aromatic Red Cedar Trees" }]
  };
  const html = `<html><body><p>${shop.products[0].name}</p><script type="application/json" data-eshop-filled-products>[{"id":"shop-cedar"}]</script></body></html>`;
  const result = validateFilledTheme(html, {
    fieldMap: {},
    demoTerms: ["CEDAR"]
  }, shop, { DOMParser: parser });
  assert.deepEqual(result, { ok: true, errors: [] });
});

test("saved Studio HTML keeps its design while rendering the current shop catalog", async () => {
  const source = await themeSource("aviya-luxury");
  const savedDesign = source.replace(
    "<title>Aviya Luxury Jewellery — Pure. Elegant. Forever.</title>",
    "<title>Merchant Studio Design</title>"
  );
  const html = await renderLiquidHtmlTheme("aviya-luxury", catalog, {
    DOMParser: parser,
    baseUrl: "https://shop.example.test/",
    loadFile: async path => {
      assert.equal(path, "index.html");
      return savedDesign;
    }
  });

  assert.match(html, /<title>Merchant Studio Design<\/title>/);
  assert.match(html, /Merchant Runner/);
  assert.doesNotMatch(html, /Wedding Ring/);
});

test("HTML-only themes use detected sibling cards and category chips without a JS catalog", async () => {
  const source = `<!doctype html><html><body>
    <nav data-eshop-category-list data-eshop-shop-route="#catalog">
      <a href="#chairs">Chairs</a><a href="#tables">Tables</a>
    </nav>
    <nav class="category-filter">
      <button data-filter="all">All</button>
      <button data-filter="chairs">Chairs</button>
      <button data-filter="tables">Tables</button>
    </nav>
    <section class="product-grid">
      <article class="product-card" data-product-id="sample-chair">
        <img src="https://images.unsplash.com/chair-demo.jpg">
        <h2>Sample Chair</h2><span class="product-price">$10</span>
      </article>
      <article class="product-card" data-product-id="sample-table">
        <img src="https://images.unsplash.com/table-demo.jpg">
        <h2>Sample Table</h2><span class="product-price">$20</span>
      </article>
    </section>
  </body></html>`;
  const imported = importStandaloneTheme(source, { themeId: "html-only", DOMParser: parser });
  assert.equal(imported.manifest.status, "passed");
  assert.ok(imported.manifest.repeaters.some(item => item.name === "products"));
  assert.ok(imported.manifest.repeaters.some(item => item.name === "categories"));

  const shop = {
    products: [
      { id: "craft-chair", name: "Owner Chair", price: 99, category_id: "decor", images: [] },
      { id: "craft-table", name: "Owner Table", price: 120, category_id: "living", images: [] }
    ],
    categories: [
      { id: "decor", name: "Home Decor" },
      { id: "living", name: "Living Room" }
    ]
  };
  const schema = {
    themeId: "html-only",
    fieldMap: imported.manifest.fieldMap,
    repeaters: imported.manifest.repeaters
  };
  const filled = (await import("../public/theme-skeleton-engine.js"))
    .fillThemeSkeleton(imported.html, schema, shop, { DOMParser: parser });
  const document = new JSDOM(filled).window.document;
  assert.deepEqual([...document.querySelectorAll("[data-product-id]")].map(item => item.dataset.productId),
    ["craft-chair", "craft-table"]);
  assert.deepEqual([...document.querySelectorAll("[data-eshop-category-link]")].map(item => item.textContent),
    ["Home Decor", "Living Room"]);
  assert.deepEqual([...document.querySelectorAll("[data-eshop-category-link]")].map(item => ({
    label: item.textContent,
    href: item.getAttribute("href"),
    filter: item.getAttribute("data-filter")
  })), [
    { label: "Home Decor", href: "#catalog", filter: "home-decor" },
    { label: "Living Room", href: "#catalog", filter: "living-room" }
  ]);
  assert.doesNotMatch(filled, /Sample Chair|Sample Table|images\.unsplash\.com/);
});

test("a single shop product remains a catalog repeater instead of a static sample card", async () => {
  const source = `<!doctype html><html><body>
    <section class="product-grid">
      <article class="product-card" data-product-id="sample-chair">
        <img src="/chair.jpg"><h2>Sample Chair</h2><span class="product-price">$10</span>
      </article>
    </section>
  </body></html>`;
  const imported = importStandaloneTheme(source, { themeId: "single-product", DOMParser: parser });
  assert.ok(imported.manifest.repeaters.some(item => item.name === "products"));
  const shop = {
    products: [{ id: "shop-chair", name: "Merchant Chair", price: 99, images: [] }],
    categories: []
  };
  const filled = (await import("../public/theme-skeleton-engine.js"))
    .fillThemeSkeleton(imported.html, {
      themeId: "single-product",
      fieldMap: imported.manifest.fieldMap,
      repeaters: imported.manifest.repeaters
    }, shop, { DOMParser: parser });
  const document = new JSDOM(filled).window.document;
  assert.deepEqual([...document.querySelectorAll("[data-product-id]")].map(item => item.dataset.productId),
    ["shop-chair"]);
  assert.match(filled, /Merchant Chair/);
  assert.doesNotMatch(filled, /Sample Chair/);
});
