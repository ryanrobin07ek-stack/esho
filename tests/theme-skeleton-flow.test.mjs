import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { readdir, readFile } from "node:fs/promises";
import {
  fillThemeForShop,
  isSupportedThemeId,
  SUPPORTED_THEME_IDS
} from "../public/theme-skeleton-client.js";

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

test("rollout skeletons without verified mappings cannot be previewed or published", async () => {
  const skeletonRoot = new URL("../public/theme-skeletons/", import.meta.url);
  const entries = await readdir(skeletonRoot, { withFileTypes: true });
  const themeDirectories = entries.filter(entry => entry.isDirectory());
  assert.ok(themeDirectories.length > 0);
  assert.deepEqual(SUPPORTED_THEME_IDS, []);

  for (const entry of themeDirectories) {
    const schema = JSON.parse(await readFile(
      new URL(`${entry.name}/schema-v2.json`, skeletonRoot),
      "utf8"
    ));
    assert.deepEqual(schema.dataBindings, {}, schema.themeId);
    assert.equal(isSupportedThemeId(schema.themeId), false);
    await assert.rejects(
      fillThemeForShop(schema.themeId, data, {
        fetchImpl: async () => { assert.fail("Unmapped skeletons must be rejected before loading."); },
        DOMParser: parser
      }),
      /not available for shop-data filling/
    );
  }
});

test("unsupported themes fail clearly before loading or exposing a skeleton", async () => {
  let requests = 0;
  for (const themeId of [
    "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
    "cira-atelier-event-architecture-management",
    "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
    "kicks-vault-curated-sneaker-footwear-archive"
  ]) {
    await assert.rejects(
      fillThemeForShop(themeId, data, {
      fetchImpl: async () => { requests += 1; throw new Error("unexpected template request"); },
      DOMParser: parser
      }),
      /no verified theme|not available for shop-data filling/i
    );
    assert.equal(isSupportedThemeId(themeId), false);
  }
  assert.equal(requests, 0);
  assert.equal(isSupportedThemeId("zima-fresh"), false);
});
