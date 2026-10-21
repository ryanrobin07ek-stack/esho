import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import {
  fillThemeForShop,
  isSupportedThemeId,
  SUPPORTED_THEME_IDS
} from "../public/theme-skeleton-client.js";

const ids = {
  cira: "cira-atelier-event-architecture-management",
  aura: "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  kicks: "kicks-vault-curated-sneaker-footwear-archive"
};

const data = {
  products: [{
    id: "shop-item-1",
    name: "Owner Product One",
    description: "Description from this shop",
    price: 75,
    stock: 3,
    brand: "Owner Brand",
    category_id: "owner-category",
    images: ["https://shop.example.test/owner-product.webp"]
  }],
  categories: [{ id: "owner-category", name: "Owner Collection", slug: "owner-collection" }],
  store: {
    name: "Owner Shop",
    description: "Shop-owned details",
    phone: "+254711222333",
    email: "owner@shop.example.test",
    location_address: "Owner address",
    currency: "KES"
  },
  pages: []
};

const parser = new JSDOM("").window.DOMParser;

function templateFetcher(html, schema, requests = []) {
  return async (url, init = {}) => {
    requests.push({ url: String(url), headers: init.headers || {} });
    if (new URL(url).pathname.endsWith("/schema-v2.json")) {
      return { ok: true, async json() { return schema; } };
    }
    return { ok: true, async text() { return html; } };
  };
}

test("theme picker preview and publish share one filled output with only shop-owned data", async () => {
  for (const themeId of SUPPORTED_THEME_IDS) {
    assert.equal(isSupportedThemeId(themeId), true);
    const themeDirectory = new URL(`../public/theme-skeletons/${themeId}/`, import.meta.url);
    const [html, schemaText] = await Promise.all([
      readFile(new URL("index.html", themeDirectory), "utf8"),
      readFile(new URL("schema-v2.json", themeDirectory), "utf8")
    ]);
    const schema = JSON.parse(schemaText);
    const requests = [];
    const fetchImpl = templateFetcher(html, schema, requests);
    const options = {
      fetchImpl,
      DOMParser: parser,
      baseHref: `https://eshop-storefront.ryanrobin07-ek.workers.dev/themes/${themeId}/index.html`,
      authorization: "shop-owner-token",
      tenantId: "main"
    };
    const editorPreview = await fillThemeForShop(themeId, data, options);
    const publishedOutput = await fillThemeForShop(themeId, data, options);

    assert.equal(editorPreview, publishedOutput, `${themeId} preview and publish output differ`);
    assert.match(editorPreview, new RegExp(`<meta name="eshop-filled-theme" content="${themeId}">`));
    assert.match(editorPreview, /Owner Product One|Owner Shop/);
    assert.match(editorPreview, /owner-product\.webp/);
    assert.doesNotMatch(editorPreview, /__ESHOP_DATA_|data-eshop-skeleton-preview|data-eshop-skeleton-scrubber/);
    assert.doesNotMatch(editorPreview, /Radiant Silk Serum Foundation SPF 25|Air Max 270 Infrared Core|Timeless Gatherings Begin With Purpose/);
    assert.equal(requests.length, 4, `${themeId} loads HTML and schema for preview and publish`);
    assert.ok(requests.every(request => request.url.startsWith(`https://eshop-storefront.ryanrobin07-ek.workers.dev/theme-skeletons/${themeId}/`)));
    assert.ok(requests.every(request => new URL(request.url).searchParams.get("tenant") === "main"));
    assert.ok(requests.every(request => request.headers.Authorization === "Bearer shop-owner-token"));
    assert.ok(requests.every(request => request.headers["X-Eshop-Theme-Internal"] === "preview"));
  }
});

test("theme editor caches templates for offline preview", async () => {
  const themeId = ids.cira;
  const themeDirectory = new URL(`../public/theme-skeletons/${themeId}/`, import.meta.url);
  const requests = [];
  const entries = new Map();
  const cache = {
    async put(url, response) { entries.set(url, response); },
    async match(url) { return entries.get(url); }
  };
  const options = {
    DOMParser: parser,
    baseHref: `https://eshop-storefront.ryanrobin07-ek.workers.dev/themes/${themeId}/index.html`,
    cacheStorage: { async open() { return cache; } }
  };
  const fetchOnline = async url => {
      const requestUrl = new URL(url);
      requests.push(requestUrl.href);
      const path = requestUrl.pathname.endsWith("/schema-v2.json") ? "schema-v2.json" : "index.html";
      const body = await readFile(new URL(path, themeDirectory), "utf8");
      return path === "schema-v2.json"
        ? { ok: true, clone() { return this; }, async json() { return JSON.parse(body); } }
        : { ok: true, clone() { return this; }, async text() { return body; } };
  };
  const online = await fillThemeForShop(themeId, data, { ...options, fetchImpl: fetchOnline });
  let offlineRequests = 0;
  const offline = await fillThemeForShop(themeId, data, {
    ...options,
    fetchImpl: async () => {
      offlineRequests += 1;
      throw new Error("network unavailable");
    }
  });

  assert.ok(requests.length === 2);
  assert.equal(offlineRequests, 2);
  assert.match(online, /Owner Product One/);
  assert.equal(offline, online);
});

test("unsupported themes fail clearly before loading or exposing a skeleton", async () => {
  let requests = 0;
  await assert.rejects(
    fillThemeForShop("harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec", data, {
      fetchImpl: async () => { requests += 1; throw new Error("unexpected template request"); },
      DOMParser: parser
    }),
    /no verified theme|not available for shop-data filling/i
  );
  assert.equal(requests, 0);
  assert.equal(isSupportedThemeId("zima-fresh"), false);
});
