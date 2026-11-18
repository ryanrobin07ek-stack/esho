import assert from "node:assert/strict";
import test from "node:test";
import worker from "../cloudflare/worker.js";

// The Litrus storefront hides Paystack (and makes the email optional) only when the shop's published
// catalogue says store.paystack_connected is 0. The Worker computes that flag from the real Paystack state.

const SHOP_ID = "mama";
const PUBLISHED_KEY = `published-sites/${SHOP_ID}/litrus-mixer/catalog-v1.html`;
const PUBLISHED_PAGE = "<!doctype html><html><head><title>Shop</title></head><body><div id=\"store\"></div><script>window.LITRUS_LIVE_CATALOG_VERSION=1;</script></body></html>";

function makeEnv({ subaccount, secret = "sk_test_flag" } = {}) {
  const kv = new Map([
    [`tenant:${SHOP_ID}`, JSON.stringify({ id: SHOP_ID, name: "Mama Shoes", owner_username: "mama-owner", catalog_updated_at: "catalog-v1" })],
    [`published-theme:${SHOP_ID}`, JSON.stringify({ key: PUBLISHED_KEY, themeId: "litrus-mixer", catalogUpdatedAt: "catalog-v1" })]
  ]);
  const catalog = {
    store: { name: "Mama Shoes", website_theme_id: "litrus-mixer" },
    products: [{ id: 1, slug: "red-shoe", name: "Red Shoe", price: 25, stock: 1, images: [] }],
    categories: [],
    pages: []
  };
  return {
    PAYSTACK_SECRET_KEY: secret,
    TENANTS: {
      async get(key, type) {
        const value = kv.get(key);
        if (value == null) return null;
        return type === "json" && typeof value === "string" ? JSON.parse(value) : value;
      },
      async put(key, value) { kv.set(key, value); },
      async delete(key) { kv.delete(key); }
    },
    DB: {
      prepare(query) {
        return {
          bind() {
            return {
              async first() {
                if (query.includes("FROM catalog_snapshots")) return { payload: JSON.stringify(catalog), updated_at: "catalog-v1" };
                if (query.includes("FROM paystack_subaccounts") && !query.includes("paystack_owner_defaults")) return subaccount || null;
                return null;
              }
            };
          }
        };
      }
    },
    BUSINESS_ARCHIVE: {
      async get(key) {
        return key === PUBLISHED_KEY ? {
          body: PUBLISHED_PAGE,
          customMetadata: { themeId: "litrus-mixer", catalogUpdatedAt: "catalog-v1" },
          httpMetadata: { contentType: "text/html; charset=utf-8" }
        } : null;
      },
      async put() {}
    },
    ASSETS: { async fetch() { return new Response("<!doctype html><html><head></head><body></body></html>", { headers: { "Content-Type": "text/html" } }); } }
  };
}

async function publishedFlag(env) {
  const response = await worker.fetch(new Request(`https://${SHOP_ID}.rrobin.co.ke/`), env);
  assert.equal(response.status, 200);
  const html = await response.text();
  const embedded = html.match(/<script type="application\/json" id="eshop-published-catalog">([\s\S]*?)<\/script>/);
  assert.ok(embedded, "the page carries its catalogue");
  return JSON.parse(embedded[1]).store.paystack_connected;
}

test("a published shop reports whether Paystack is really connected", async () => {
  const connected = { subaccount_code: "ACCT_ok", status: "connected", account_mode: "test", is_verified: 0 };
  assert.equal(await publishedFlag(makeEnv({ subaccount: connected })), 1);
  assert.equal(await publishedFlag(makeEnv({ subaccount: null })), 0, "no Paystack account: hide Paystack");
  assert.equal(await publishedFlag(makeEnv({ subaccount: { ...connected, status: "pending" } })), 0);
  assert.equal(await publishedFlag(makeEnv({ subaccount: { ...connected, account_mode: "live", is_verified: 0 } })), 0,
    "a live account that is not verified cannot take payments");
  assert.equal(await publishedFlag(makeEnv({ subaccount: connected, secret: "" })), 0, "no server Paystack key: hide Paystack");
});
