import assert from "node:assert/strict";
import test from "node:test";
import worker from "../cloudflare/worker.js";

const ACCOUNT_TOKEN = "account-session-token";
const SHOP_ID = "mama";
const SHOP_URL = `https://${SHOP_ID}.rrobin.co.ke/`;
const VERIFICATION_TOKEN = "google-verification-token_123";

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function makeEnv(username = "mama-owner") {
  const kv = new Map([
    [`tenant:${SHOP_ID}`, JSON.stringify({ id: SHOP_ID, name: "Mama Shoes", owner_username: "mama-owner" })]
  ]);
  const catalog = {
    store: { name: "Mama Shoes", website_theme_id: "classic" },
    products: [{ id: 1, slug: "red-shoe", name: "Red Shoe", price: 25, stock: 1, images: [] }],
    categories: [],
    pages: []
  };
  return {
    kv,
    catalog,
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
          bind(...values) {
            return {
              async first() {
                if (query.includes("FROM account_tenants")) {
                  return values[0] === "mama-owner" && values[1] === SHOP_ID ? { owned: 1 } : null;
                }
                if (query.includes("FROM catalog_snapshots")) {
                  return { payload: JSON.stringify(catalog), updated_at: "catalog-v1" };
                }
                return null;
              }
            };
          }
        };
      }
    },
    BUSINESS_ARCHIVE: {},
    ASSETS: {
      async fetch() {
        return new Response("<!doctype html><html><head><title>Shop</title></head><body><div id=\"app\"></div></body></html>", {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    },
    accountUsername: username
  };
}

async function addAccountSession(env, username = env.accountUsername) {
  env.kv.set(`session:${await sha256Hex(ACCOUNT_TOKEN)}`, JSON.stringify({ username }));
}

function verificationRequest(method, body, token = ACCOUNT_TOKEN) {
  return new Request(`https://rrobin.co.ke/api/search-console/verification?tenant_id=${SHOP_ID}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

test("shop owner can publish and remove a Google verification tag without connecting Google", async () => {
  const env = makeEnv();
  await addAccountSession(env);

  const save = await worker.fetch(verificationRequest("POST", {
    verification_tag: `<meta name="google-site-verification" content="${VERIFICATION_TOKEN}">`
  }), env);
  assert.equal(save.status, 200);
  assert.deepEqual(await save.json(), { tokenSaved: true });

  const savedVerification = JSON.parse(env.kv.get(`google-site-verification:${SHOP_ID}`));
  assert.equal(savedVerification.content, VERIFICATION_TOKEN);
  assert.ok(savedVerification.version);

  const status = await worker.fetch(verificationRequest("GET"), env);
  assert.deepEqual(await status.json(), { tokenSaved: true });

  const shop = await worker.fetch(new Request(SHOP_URL), env);
  assert.equal(shop.status, 200);
  assert.match(await shop.text(), new RegExp(`name="google-site-verification" content="${VERIFICATION_TOKEN}"`));

  const remove = await worker.fetch(verificationRequest("DELETE"), env);
  assert.deepEqual(await remove.json(), { tokenSaved: false });
  assert.equal(env.kv.has(`google-site-verification:${SHOP_ID}`), false);
});

test("Search Console verification tags are restricted to the signed-in shop owner", async () => {
  const env = makeEnv();
  await addAccountSession(env, "someone-else");
  const response = await worker.fetch(verificationRequest("POST", {
    verification_tag: VERIFICATION_TOKEN
  }), env);
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /only manage Search Console verification/);
  assert.equal(env.kv.has(`google-site-verification:${SHOP_ID}`), false);
});

test("verification endpoint rejects missing authentication and malformed Google tags", async () => {
  const env = makeEnv();
  const unauthenticated = await worker.fetch(verificationRequest("GET", null, "missing-session"), env);
  assert.equal(unauthenticated.status, 401);

  await addAccountSession(env);
  const malformed = await worker.fetch(verificationRequest("POST", {
    verification_tag: '<meta name="not-google" content="bad-token">'
  }), env);
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /must be Google's google-site-verification tag/);
});
