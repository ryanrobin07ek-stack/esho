import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { convertThemeSkeleton } from "../scripts/convert-theme-skeletons.mjs";
import { fillThemeSkeleton } from "../public/theme-skeleton-engine.js";

const themeIds = {
  cira: "cira-atelier-event-architecture-management",
  aura: "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  kicks: "kicks-vault-curated-sneaker-footwear-archive"
};

const products = count => Array.from({ length: count }, (_, index) => ({
  id: `shop-product-${index + 1}`,
  name: `Shop Product ${index + 1}`,
  description: `Shop-owned description ${index + 1}`,
  price: (index + 1) * 125,
  stock: index + 2,
  category_id: index % 2 ? "cat-b" : "cat-a",
  images: index === 0 ? ["https://shop.example.test/product-1.webp"] : []
}));

const shopData = count => ({
  products: products(count),
  categories: [
    { id: "cat-a", name: "Collection A", slug: "collection-a" },
    { id: "cat-b", name: "Collection B", slug: "collection-b" },
    { id: "empty", name: "Empty category", slug: "empty" }
  ],
  store: {
    name: "Owner Shop",
    description: "A shop-owned description.",
    phone: "+254711222333",
    email: "owner@shop.example.test",
    location_address: "Owner address",
    currency: "KES"
  }
});

const parser = new JSDOM("").window.DOMParser;
const conversions = new Map();
const convert = id => {
  if (!conversions.has(id)) conversions.set(id, convertThemeSkeleton(id));
  return conversions.get(id);
};

function executeThemeScripts(window) {
  window.tailwind = { config: {} };
  window.lucide = { createIcons() {} };
  window.ScrollTrigger = { refresh() {} };
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.gsap = {
    registerPlugin() {},
    from() {},
    to() {},
    fromTo() {},
    timeline() {
      return { to() { return this; }, from() { return this; }, fromTo() { return this; }, set() { return this; } };
    }
  };
  for (const script of window.document.querySelectorAll("script:not([src])")) {
    if (script.type && !/^(text|application)\/(java|ecma)script$/i.test(script.type)) continue;
    window.eval(script.textContent);
  }
}

function visibleTextNodes(document) {
  const walker = document.createTreeWalker(document.body, document.defaultView.NodeFilter.SHOW_TEXT);
  const text = [];
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    if (node.parentElement.closest("script,style,noscript,svg,[data-skeleton-text]")) continue;
    text.push(node.textContent.trim());
  }
  return text;
}

test("pilot converter removes demo-visible text, image references, and JS catalogues", async () => {
  const cases = [
    {
      id: themeIds.cira,
      forbidden: [
        "Timeless Gatherings Begin With Purpose.",
        "Orangery Twilight Banquet",
        "hero_event_gala_1791801775087.jpg",
        "+00 (0) 000 000 0000"
      ]
    },
    {
      id: themeIds.aura,
      forbidden: [
        "Radiant Silk Serum Foundation SPF 25",
        "Lumière Velours Hydrating Matte Lipstick",
        "photo-1586495777744-4413f21062fa",
        "Unlock the secrets of captivating",
        "Radiant skin transformations curated across Kenya",
        "Botanical Actives",
        "Celebrate transformation. High-performance clean cosmetics",
        "Call beauty advisor",
        "+254 700 892 000",
        "concierge@auraluxe.co.ke"
      ]
    },
    {
      id: themeIds.kicks,
      forbidden: [
        "Air Max 270 Infrared Core",
        "Air Force 1 '07 Triple White",
        "photo-1542291026-7eec264c27ff",
        "18500"
      ]
    }
  ];

  for (const { id, forbidden } of cases) {
    const { html, schema } = await convert(id);
    assert.equal(schema.version, 2);
    assert.equal(schema.themeId, id);
    for (const leak of forbidden) assert.equal(html.includes(leak), false, `${id} leaked ${leak}`);

    const dom = new JSDOM(html);
    assert.equal(dom.window.document.querySelector("img[src]"), null, `${id} retained an image source`);
    assert.equal(/url\(\s*['"]?https?:/i.test(html), false, `${id} retained a CSS image URL`);
    const visible = dom.window.document.body.textContent.replace(/\s+/g, " ").trim();
    for (const phrase of forbidden) assert.equal(visible.includes(phrase), false, `${id} displayed ${phrase}`);
    assert.ok(schema.tokens.colors && Object.keys(schema.tokens.colors).length > 0);
    dom.window.close();
  }
});

test("Aura runtime renders its layout as bars and retains interaction handlers", async () => {
  const { html } = await convert(themeIds.aura);
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://shop.example.test" });
  const { window } = dom;
  executeThemeScripts(window);
  window.renderHomeView();

  const view = window.document.querySelector("#view-container");
  assert.ok(view?.querySelector("section"));
  assert.ok(view?.querySelectorAll(".eshop-skeleton-bar").length > 0);
  assert.equal(view?.querySelectorAll(".card-zoom").length, 8, "seeded bestseller and popular card rails remain visible");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(visibleTextNodes(window.document), []);
  assert.equal(/Unlock the secrets|Botanical Actives|Radiant skin transformations/.test(view?.textContent || ""), false);
  assert.ok(view?.querySelector('a[href="#shop"]'));
  for (const handler of ["addToCart", "openSearchModal", "openCartDrawer", "closeMobileMenu"]) {
    assert.equal(typeof window[handler], "function", `${handler} handler remains available`);
  }
  dom.window.close();
});

test("Kicks empty preview retains four rendered product-card skeletons", async () => {
  const { html } = await convert(themeIds.kicks);
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://shop.example.test" });
  const { window } = dom;
  executeThemeScripts(window);
  window.renderCatalog();
  await new Promise(resolve => setImmediate(resolve));

  const cards = [...window.document.querySelectorAll("#catalog-grid .product-card")];
  assert.equal(cards.length, 4);
  assert.ok(cards.every(card => card.querySelector(".eshop-skeleton-bar")));
  assert.ok(cards.every(card => card.querySelector("img.eshop-placeholder-media")));
  assert.equal(window.document.querySelector("#catalog-grid img[src]"), null);
  assert.deepEqual(visibleTextNodes(window.document), []);
  dom.window.close();
});

test("Kicks renders mapped shop products with cart and filter handlers intact", async () => {
  const { html, schema } = await convert(themeIds.kicks);
  const data = shopData(1);
  data.products[0].brand = "Owner Brand";
  const filled = fillThemeSkeleton(html, schema, data, { DOMParser: parser });
  const dom = new JSDOM(filled, { runScripts: "outside-only", url: "https://shop.example.test" });
  const { window } = dom;
  executeThemeScripts(window);
  window.renderCatalog();

  const card = window.document.querySelector(".product-card");
  assert.ok(card);
  assert.match(card.textContent, /Shop Product 1/);
  assert.equal(card.querySelector("img")?.getAttribute("src"), "https://shop.example.test/product-1.webp");
  assert.equal(typeof window.addToCart, "function");
  assert.equal(typeof window.filterByCategory, "function");
  dom.window.close();
});

test("Cira product cards keep delegated category filters and detail modal behavior", async () => {
  const { html, schema } = await convert(themeIds.cira);
  const filled = fillThemeSkeleton(html, schema, shopData(2), { DOMParser: parser });
  const dom = new JSDOM(filled, { runScripts: "outside-only", url: "https://shop.example.test" });
  const { window } = dom;
  executeThemeScripts(window);
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

  const cards = [...window.document.querySelectorAll(".js-portfolio-card")];
  assert.equal(cards.length, 2);
  assert.equal(cards[0].getAttribute("data-category"), "collection-a");
  const secondCategory = window.document.querySelector('.filter-btn[data-filter="collection-b"]');
  assert.ok(secondCategory);
  secondCategory.click();
  assert.equal(cards[0].classList.contains("is-hidden"), true);
  assert.equal(cards[1].classList.contains("is-hidden"), false);

  cards[1].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(window.document.querySelector("#studyModalBackdrop")?.classList.contains("is-open"), true);
  assert.equal(window.document.querySelector("#modalStudyTitle")?.textContent, "Shop Product 2");
  dom.window.close();
});

test("Cira repeater handles zero, one, exact-fit, and more-than-fit products", async () => {
  const { html, schema } = await convert(themeIds.cira);
  for (const [count, expectedLive, expectedEditor] of [
    [0, 0, 4],
    [1, 1, 4],
    [4, 4, 4],
    [6, 6, 6]
  ]) {
    const data = shopData(count);
    const live = fillThemeSkeleton(html, schema, data, { DOMParser: parser, mode: "live" });
    const editor = fillThemeSkeleton(html, schema, data, { DOMParser: parser, mode: "editor" });
    const liveDocument = new JSDOM(live).window.document;
    const editorDocument = new JSDOM(editor).window.document;
    assert.equal(liveDocument.querySelectorAll(".portfolio-item").length, expectedLive, `live count ${count}`);
    assert.equal(editorDocument.querySelectorAll(".portfolio-item").length, expectedEditor, `editor count ${count}`);
    assert.equal(liveDocument.querySelector(".brand-wordmark")?.textContent, "Owner Shop");
    assert.equal(liveDocument.querySelectorAll("[data-slot='category.name']").length, count ? Math.min(count, 2) : 0);
    assert.equal(liveDocument.querySelector(".portfolio-item img")?.getAttribute("src") ?? null, count
      ? "https://shop.example.test/product-1.webp"
      : null);
    assert.equal(liveDocument.querySelector(".portfolio-gallery")?.hidden, count === 0);
    liveDocument.defaultView.close();
    editorDocument.defaultView.close();
  }
});

test("JS-native repeaters receive only shop products and categories", async () => {
  for (const [id, productBinding, categoryBinding] of [
    [themeIds.aura, "auraCatalogue", "auraCategories"],
    [themeIds.kicks, "kicksBlueprints", "kicksCategories"]
  ]) {
    const { html, schema } = await convert(id);
    for (const count of [0, 1, 4, 6]) {
      const filled = fillThemeSkeleton(html, schema, shopData(count), { DOMParser: parser });
      const productMatch = filled.match(new RegExp(`__ESHOP_DATA_${productBinding}__`));
      assert.equal(productMatch, null, `${id} retained its unresolved ${productBinding} token`);
      const mappedData = id === themeIds.aura
        ? (await import("../public/theme-skeleton-data.js")).mapAuraData(shopData(count))
        : (await import("../public/theme-skeleton-data.js")).mapKicksData(shopData(count));
      const mappedProducts = id === themeIds.aura ? mappedData.auraCatalogue : mappedData.kicksBlueprints;
      const mappedCategories = id === themeIds.aura ? mappedData.auraCategories : mappedData.kicksCategories;
      assert.equal(mappedProducts.length, count, `${id} product count ${count}`);
      if (id === themeIds.aura && count) {
        assert.equal(mappedProducts[0].name, products(count)[0].name);
        assert.equal(mappedProducts[0].priceKES, products(count)[0].price);
        assert.equal(mappedProducts[0].isPopular, true);
        assert.equal(mappedProducts[0].isBestseller, true);
        if (count > 4) assert.equal(mappedProducts[4].isPopular, false);
      }
      const expectedCategories = new Set(products(count).map(product => product.category_id)).size;
      assert.equal(mappedCategories.length, expectedCategories + (id === themeIds.aura ? 1 : 0));
      assert.ok(filled.includes(`__ESHOP_DATA_${categoryBinding}__`) === false);
      assert.equal(filled.includes("Radiant Silk Serum Foundation SPF 25"), false);
      assert.equal(filled.includes("Air Max 270 Infrared Core"), false);
    }
  }
});

test("Aura home page shows shop products when none are explicitly highlighted", async () => {
  const themeDirectory = new URL(`../public/theme-skeletons/${themeIds.aura}/`, import.meta.url);
  const [html, schemaText] = await Promise.all([
    readFile(new URL("index.html", themeDirectory), "utf8"),
    readFile(new URL("schema-v2.json", themeDirectory), "utf8")
  ]);
  const schema = JSON.parse(schemaText);
  const filled = fillThemeSkeleton(html, schema, shopData(6), { DOMParser: parser });
  const dom = new JSDOM(filled, { runScripts: "outside-only", url: "https://shop.example.test/" });
  executeThemeScripts(dom.window);
  dom.window.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  const cards = [...dom.window.document.querySelectorAll("#view-container .card-zoom")];
  assert.ok(cards.length >= 4);
  assert.match(dom.window.document.querySelector("#view-container")?.textContent || "", /Shop Product 1/);
  dom.window.close();
});

test("contact action slots use the shop phone number", () => {
  const html = '<!doctype html><a data-slot="store.phone" data-slot-attr="href" data-slot-prefix="tel:"></a>';
  const schema = { themeId: "contact-slot-test", repeaters: [], jsonLd: false };
  const filled = fillThemeSkeleton(html, schema, shopData(0), { DOMParser: parser });
  const document = new JSDOM(filled).window.document;
  assert.equal(document.querySelector("a")?.getAttribute("href"), "tel:+254711222333");
  document.defaultView.close();
});
