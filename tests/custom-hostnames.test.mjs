import assert from "node:assert/strict";
import test from "node:test";
import worker from "../cloudflare/worker.js";

const ACCOUNT_TOKEN = "custom-domain-account-token";
const SHOP_ID = "mama";
const ZONE_ID = "test-zone";

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createDatabase(hostnameRows = []) {
  const rows = new Map(hostnameRows.map(row => [row.hostname, { ...row }]));
  return {
    rows,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes("FROM account_tenants")) {
                return values[0] === "shop-owner" && values[1] === SHOP_ID ? { owned: 1 } : null;
              }
              if (query.includes("FROM custom_hostnames") && query.includes("WHERE tenant_id=?")) {
                return [...rows.values()].find(row => row.tenant_id === values[0]) || null;
              }
              if (query.includes("FROM custom_hostnames") && query.includes("WHERE hostname=?")) {
                const row = rows.get(values[0]);
                if (query.includes("status='active'")) {
                  return row?.status === "active" && row.ssl_status === "active"
                    ? { tenant_id: row.tenant_id }
                    : null;
                }
                return row ? { tenant_id: row.tenant_id } : null;
              }
              throw new Error(`Unsupported first query: ${query}`);
            },
            async run() {
              if (query.includes("INSERT INTO custom_hostnames")) {
                const [hostname, tenant_id, cloudflare_hostname_id, status, ssl_status,
                  validation_records, created_at, updated_at] = values;
                rows.set(hostname, {
                  hostname, tenant_id, cloudflare_hostname_id, status, ssl_status,
                  validation_records, created_at, updated_at
                });
              } else if (query.includes("UPDATE custom_hostnames")) {
                const [status, ssl_status, validation_records, updated_at, hostname] = values;
                const row = rows.get(hostname);
                if (row) Object.assign(row, { status, ssl_status, validation_records, updated_at });
              } else if (query.includes("DELETE FROM custom_hostnames")) {
                for (const [hostname, row] of rows) {
                  if (row.tenant_id === values[0]) rows.delete(hostname);
                }
              } else {
                throw new Error(`Unsupported run query: ${query}`);
              }
              return { success: true, meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}

async function createEnv(hostnameRows = [], username = "shop-owner") {
  const kv = new Map([
    [`tenant:${SHOP_ID}`, JSON.stringify({ id: SHOP_ID, name: "Mama Shoes", owner_username: "shop-owner" })],
    [`session:${await sha256Hex(ACCOUNT_TOKEN)}`, JSON.stringify({ username })]
  ]);
  const DB = createDatabase(hostnameRows);
  return {
    DB,
    kv,
    CLOUDFLARE_ZONE_ID: ZONE_ID,
    CLOUDFLARE_API_TOKEN: "test-cloudflare-token",
    CUSTOM_HOSTNAME_TARGET: "customers.rrobin.co.ke",
    TENANTS: {
      async get(key, type) {
        const value = kv.get(key);
        if (value == null) return null;
        return type === "json" && typeof value === "string" ? JSON.parse(value) : value;
      },
      async put(key, value) { kv.set(key, value); },
      async delete(key) { kv.delete(key); }
    },
    ASSETS: {
      async fetch(request) {
        return new Response(new URL(request.url).searchParams.get("tenant") || "unmapped");
      }
    }
  };
}

function apiRequest(method, body, token = ACCOUNT_TOKEN) {
  return new Request(`https://rrobin.co.ke/api/custom-hostnames?tenant_id=${SHOP_ID}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

test("shop owner creates a custom subdomain and only active TLS mappings route to the shop", async () => {
  const env = await createEnv();
  const originalFetch = globalThis.fetch;
  let cloudflareCreateBody;
  globalThis.fetch = async (input, options = {}) => {
    assert.match(String(input), new RegExp(`/zones/${ZONE_ID}/custom_hostnames$`));
    assert.equal(options.headers.Authorization, "Bearer test-cloudflare-token");
    cloudflareCreateBody = JSON.parse(options.body);
    return Response.json({
      success: true,
      result: {
        id: "cf-hostname-id",
        hostname: cloudflareCreateBody.hostname,
        status: "pending",
        ssl: {
          status: "pending",
          validation_records: [{
            txt_name: "_cf-challenge.shop.example.com",
            txt_value: "verify-me"
          }]
        },
        ownership_verification: {
          type: "txt",
          name: "_cf-custom-hostname.shop.example.com",
          value: "ownership-token"
        }
      }
    });
  };
  try {
    const response = await worker.fetch(apiRequest("POST", { hostname: "Shop.Example.com" }), env);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.hostname, "shop.example.com");
    assert.equal(result.cname_target, "customers.rrobin.co.ke");
    assert.equal(result.validation_records[0].value, "verify-me");
    assert.deepEqual(result.validation_records.map(record => record.purpose), [
      "Certificate validation", "Domain ownership"
    ]);
    assert.equal(cloudflareCreateBody.ssl.method, "txt");

    const pending = await worker.fetch(new Request("https://shop.example.com/probe"), env);
    assert.equal(pending.status, 200);
    assert.equal(await pending.text(), "unmapped");

    env.DB.rows.get("shop.example.com").status = "active";
    env.DB.rows.get("shop.example.com").ssl_status = "active";
    const active = await worker.fetch(new Request("https://shop.example.com/probe"), env);
    assert.equal(await active.text(), SHOP_ID);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("custom-domain management rejects non-owner requests and apex hostnames", async () => {
  const env = await createEnv([], "different-user");
  const denied = await worker.fetch(apiRequest("POST", { hostname: "shop.example.com" }), env);
  assert.equal(denied.status, 403);

  const ownerEnv = await createEnv();
  const invalid = await worker.fetch(apiRequest("POST", { hostname: "example.com" }), ownerEnv);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /Root domains are not supported/);
});

test("custom-domain status polling refreshes hostname and SSL readiness", async () => {
  const env = await createEnv([{
    hostname: "shop.example.com",
    tenant_id: SHOP_ID,
    cloudflare_hostname_id: "cf-hostname-id",
    status: "pending",
    ssl_status: "pending",
    validation_records: "[]"
  }]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    assert.match(String(input), /custom_hostnames\/cf-hostname-id$/);
    assert.equal(options.headers.Authorization, "Bearer test-cloudflare-token");
    return Response.json({
      success: true,
      result: {
        id: "cf-hostname-id",
        hostname: "shop.example.com",
        status: "active",
        ssl: { status: "active", validation_records: [] }
      }
    });
  };
  try {
    const response = await worker.fetch(apiRequest("GET", null), env);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "active");
    assert.equal(result.ssl_status, "active");
    assert.equal(env.DB.rows.get("shop.example.com").ssl_status, "active");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("shop owner can disconnect a custom hostname from Cloudflare", async () => {
  const env = await createEnv([{
    hostname: "shop.example.com",
    tenant_id: SHOP_ID,
    cloudflare_hostname_id: "cf-hostname-id",
    status: "active",
    ssl_status: "active",
    validation_records: "[]"
  }]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    assert.match(String(input), /custom_hostnames\/cf-hostname-id$/);
    assert.equal(options.method, "DELETE");
    return Response.json({ success: true, result: { id: "cf-hostname-id" } });
  };
  try {
    const response = await worker.fetch(apiRequest("DELETE", null), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hostname: null });
    assert.equal(env.DB.rows.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
