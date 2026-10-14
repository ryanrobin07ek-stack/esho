import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import initSqlJs from 'sql.js';
import worker from '../cloudflare/worker.js';

function createDatabase() {
  const rows = new Map();
  const accounts = new Map();
  const accountTenants = [];
  return {
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes("FROM catalog_snapshots")) return rows.get(values[0]) || null;
              if (query.includes("FROM accounts")) return accounts.get(values[0]) || null;
              if (query.includes("FROM account_tenants")) {
                return accountTenants.find(row => row.username === values[0] && row.tenant_id === values[1])
                  ? { owned: 1 }
                  : null;
              }
              throw new Error(`Unsupported first query: ${query}`);
            },
            async all() {
              if (query.includes("FROM inventory_stock")) return { results: [] };
              if (query.includes("FROM account_tenants")) {
                return { results: accountTenants.filter(row => row.username === values[0]) };
              }
              throw new Error(`Unsupported all query: ${query}`);
            },
            async run() {
              if (query.includes("INSERT OR IGNORE INTO accounts")) {
                if (accounts.has(values[0])) return { success: true, meta: { changes: 0 } };
                accounts.set(values[0], {
                  username: values[0],
                  password_salt: values[1],
                  password_hash: values[2],
                  created_at: values[3]
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("INSERT OR IGNORE INTO account_tenants")) {
                if (accountTenants.some(row => row.tenant_id === values[1])) return { success: true, meta: { changes: 0 } };
                accountTenants.push({ username: values[0], tenant_id: values[1] });
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("DELETE FROM catalog_snapshots")) {
                rows.delete(values[0]);
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("DELETE FROM account_tenants")) {
                const index = accountTenants.findIndex(row => row.tenant_id === values[0]);
                if (index >= 0) accountTenants.splice(index, 1);
                return { success: true, meta: { changes: index >= 0 ? 1 : 0 } };
              }
              if (query.includes("INSERT INTO catalog_snapshots")) {
                rows.set(values[0], { payload: values[1], admin_payload: values[2], updated_at: values[3] });
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("UPDATE catalog_snapshots SET payload")) {
                const current = rows.get(values[3]);
                assert.ok(current, 'A partial settings publish should update an existing catalog.');
                rows.set(values[3], { payload: values[0], admin_payload: values[1], updated_at: values[2] });
                return { success: true, meta: { changes: 1 } };
              }
              throw new Error(`Unsupported run query: ${query}`);
            }
          };
        },
        async run() {
          assert.match(query, /SELECT payload, updated_at/);
          return { success: true };
        }
      };
    }
  };
}

function createStorefrontOrderDatabase() {
  const orders = new Map();
  const paystackSubaccounts = new Map();
  const paystackOwnerDefaults = new Map();
  const catalog = {
    store: { currency: 'KES' },
    products: [{ id: 7, name: 'Canvas Tote', sku: 'TOTE-7', price: 12.5, stock: 8 }]
  };
  return {
    orders,
    paystackSubaccounts,
    paystackOwnerDefaults,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes('FROM catalog_snapshots')) return { payload: JSON.stringify(catalog) };
              if (query.includes('FROM paystack_owner_defaults defaults')) {
                const selected = paystackOwnerDefaults.get(values[0]);
                return selected ? paystackSubaccounts.get(selected.source_tenant_id) || null : null;
              }
              if (query.includes('FROM paystack_subaccounts')) return paystackSubaccounts.get(values[0]) || null;
              if (query.includes('WHERE tenant_id=? AND idempotency_key=?')) {
                return orders.get(`${values[0]}:${values[1]}`) || null;
              }
              if (query.includes('WHERE tenant_id=? AND payment_reference=?')) {
                return [...orders.values()].find(row => row.tenant_id === values[0] && row.payment_reference === values[1]) || null;
              }
              if (query.includes('WHERE payment_reference=?')) {
                return [...orders.values()].find(row => row.payment_reference === values[0]) || null;
              }
              if (query.includes('WHERE tenant_id=? AND order_number=?')) {
                return [...orders.values()].find(row => row.tenant_id === values[0] && row.order_number === values[1]) || null;
              }
              throw new Error(`Unsupported order first query: ${query}`);
            },
            async all() {
              if (query.includes('FROM storefront_orders')) {
                return { results: [...orders.values()].filter(row => row.tenant_id === values[0]) };
              }
              throw new Error(`Unsupported order list query: ${query}`);
            },
            async run() {
              if (query.includes('INSERT OR IGNORE INTO storefront_orders')) {
                const [tenant_id, order_number, idempotency_key, customer_name, customer_email, customer_phone,
                  shipping_address, city, postal_code, country, currency, subtotal_cents, discount_cents,
                  shipping_cents, total_cents, items_json, created_at, updated_at] = values;
                const key = `${tenant_id}:${idempotency_key}`;
                if (orders.has(key)) return { meta: { changes: 0 } };
                orders.set(key, {
                  tenant_id, order_number, idempotency_key, status: 'pending', customer_name, customer_email,
                  customer_phone, shipping_address, city, postal_code, country, currency, subtotal_cents,
                  discount_cents, shipping_cents, total_cents, items_json, created_at, updated_at,
                  payment_status: 'unpaid', payment_reference: null, payment_authorization_url: null, paid_at: null
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes('UPDATE storefront_orders SET status=')) {
                const [status, updated_at, tenant_id, order_number] = values;
                const order = [...orders.values()].find(row => row.tenant_id === tenant_id && row.order_number === order_number);
                if (!order) return { meta: { changes: 0 } };
                order.status = status;
                order.updated_at = updated_at;
                return { meta: { changes: 1 } };
              }
              if (query.includes("SET payment_reference=?")) {
                const [payment_reference, updated_at, tenant_id, order_number] = values;
                const order = [...orders.values()].find(row => row.tenant_id === tenant_id && row.order_number === order_number);
                if (!order || !['unpaid', 'failed'].includes(order.payment_status)) return { meta: { changes: 0 } };
                Object.assign(order, { payment_reference, payment_status: 'initializing', payment_authorization_url: null, paid_at: null, updated_at });
                return { meta: { changes: 1 } };
              }
              if (query.includes("SET payment_status='pending'")) {
                const [payment_authorization_url, updated_at, tenant_id, order_number, payment_reference] = values;
                const order = [...orders.values()].find(row => row.tenant_id === tenant_id
                  && row.order_number === order_number && row.payment_reference === payment_reference);
                if (!order) return { meta: { changes: 0 } };
                Object.assign(order, { payment_status: 'pending', payment_authorization_url, updated_at });
                return { meta: { changes: 1 } };
              }
              if (query.includes('SET payment_status=?,paid_at=COALESCE')) {
                const [payment_status, paid_at, updated_at, tenant_id, order_number, payment_reference] = values;
                const order = [...orders.values()].find(row => row.tenant_id === tenant_id
                  && row.order_number === order_number && row.payment_reference === payment_reference);
                if (!order || order.payment_status === 'paid') return { meta: { changes: 0 } };
                Object.assign(order, { payment_status, paid_at: paid_at || order.paid_at, updated_at });
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unsupported order update query: ${query}`);
            }
          };
        }
      };
    }
  };
}

function createPaystackDatabase() {
  const rows = new Map();
  const defaults = new Map();
  const accountTenants = new Set();
  return {
    rows,
    defaults,
    accountTenants,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes('FROM paystack_owner_defaults defaults')) {
                const selected = defaults.get(values[0]);
                return selected ? rows.get(selected.source_tenant_id) || null : null;
              }
              if (query.includes('FROM paystack_owner_defaults')) {
                return defaults.has(values[0]) ? defaults.get(values[0]) : null;
              }
              if (query.includes('FROM paystack_subaccounts')) return rows.get(values[0]) || null;
              if (query.includes('FROM account_tenants')) {
                return accountTenants.has(`${values[0]}:${values[1]}`) ? { owned: 1 } : null;
              }
              throw new Error(`Unsupported Paystack first query: ${query}`);
            },
            async run() {
              if (query.includes('INSERT INTO paystack_owner_defaults')) {
                const [owner_username, source_tenant_id, created_at, updated_at] = values;
                const previous = defaults.get(owner_username);
                defaults.set(owner_username, {
                  owner_username, source_tenant_id, created_at: previous?.created_at || created_at, updated_at
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes('INSERT OR IGNORE INTO paystack_subaccounts')) {
                if (rows.has(values[0])) return { meta: { changes: 0 } };
                rows.set(values[0], {
                  tenant_id: values[0], subaccount_code: null, status: 'setup_in_progress',
                  bank_name: '', account_last4: '', created_at: values[1], updated_at: values[2]
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes('DELETE FROM paystack_subaccounts')) {
                const row = rows.get(values[0]);
                if (row?.subaccount_code === null) rows.delete(values[0]);
                return { meta: { changes: 1 } };
              }
              if (query.includes('INSERT INTO paystack_subaccounts')) {
                const [tenant_id, subaccount_code, status, bank_name, account_last4, created_at, updated_at] = values;
                rows.set(tenant_id, { tenant_id, subaccount_code, status, bank_name, account_last4, created_at, updated_at });
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unsupported Paystack run query: ${query}`);
            }
          };
        }
      };
    }
  };
}

async function registerTestAccount(env, username = 'test-shopper', password = 'correct-horse-battery-staple') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('/turnstile/v0/siteverify')) {
      const body = new URLSearchParams(init.body);
      assert.equal(body.get('secret'), 'test-turnstile-secret');
      assert.equal(body.get('response'), 'test-turnstile-token');
      return Response.json({ success: true });
    }
    return originalFetch(input, init);
  };
  try {
    const response = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, turnstile_token: 'test-turnstile-token' })
    }), env);
    assert.equal(response.status, 200);
    return response.json();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function createTenantStore() {
  const values = new Map();
  return {
    async get(key, type) {
      const value = values.get(key);
      return value && type === 'json' ? JSON.parse(value) : value || null;
    },
    async put(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
    async list({ prefix }) {
      return {
        keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
        list_complete: true
      };
    }
  };
}

test('nearby pairing relays one answer only to the authenticated shop registers', async () => {
  const pairings = new Map();
  const DB = {
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes('FROM nearby_pairings WHERE id=?')) return pairings.get(values[0]) || null;
              throw new Error(`Unsupported nearby pairing query: ${query}`);
            },
            async run() {
              if (query.includes('DELETE FROM nearby_pairings WHERE expires_at')) {
                for (const [id, row] of pairings) if (row.expires_at <= values[0]) pairings.delete(id);
                return { meta: { changes: 1 } };
              }
              if (query.includes('INSERT INTO nearby_pairings')) {
                pairings.set(values[0], {
                  id: values[0], tenant_id: values[1], host_token_hash: values[2],
                  guest_token_hash: values[3], offer_sdp: values[4], answer_sdp: null,
                  created_at: values[5], expires_at: values[6]
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes('UPDATE nearby_pairings SET answer_sdp')) {
                const row = pairings.get(values[1]);
                if (!row || row.answer_sdp || row.expires_at <= values[2]) return { meta: { changes: 0 } };
                row.answer_sdp = values[0];
                return { meta: { changes: 1 } };
              }
              if (query.includes('DELETE FROM nearby_pairings WHERE id=?')) {
                return { meta: { changes: pairings.delete(values[0]) ? 1 : 0 } };
              }
              throw new Error(`Unsupported nearby pairing mutation: ${query}`);
            }
          };
        }
      };
    }
  };
  const TENANTS = createTenantStore();
  const ownerToken = 'nearby-shop-owner';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = { DB, TENANTS };
  const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
  const create = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/nearby/pairing?tenant=main', {
    method: 'POST', headers, body: JSON.stringify({ action: 'create', offer: { type: 'offer', sdp: 'offer-sdp' } })
  }), env);
  assert.equal(create.status, 201);
  const { pairing_id: id, host_token: hostToken, guest_token: guestToken } = await create.json();
  assert.match(id, /^[a-f0-9]{32}$/);

  const pollUrl = `https://eshop-storefront.workers.dev/api/nearby/pairing?tenant=main&id=${id}`;
  const guestOffer = await worker.fetch(new Request(pollUrl, {
    headers: { ...headers, 'X-Nearby-Session': guestToken }
  }), env);
  assert.deepEqual(await guestOffer.json(), { offer: { type: 'offer', sdp: 'offer-sdp' } });
  const noConsent = await worker.fetch(new Request(pollUrl, {
    headers: { ...headers, 'X-Nearby-Session': hostToken }
  }), env);
  assert.deepEqual(await noConsent.json(), { answer: null });
  const wrongGuest = await worker.fetch(new Request(pollUrl, {
    method: 'POST', headers: { ...headers, 'X-Nearby-Session': 'wrong-token' },
    body: JSON.stringify({ action: 'answer', answer: { type: 'answer', sdp: 'answer-sdp' } })
  }), env);
  assert.equal(wrongGuest.status, 404);
  const answer = await worker.fetch(new Request(pollUrl, {
    method: 'POST', headers: { ...headers, 'X-Nearby-Session': guestToken },
    body: JSON.stringify({ action: 'answer', answer: { type: 'answer', sdp: 'answer-sdp' } })
  }), env);
  assert.equal(answer.status, 200);
  const ready = await worker.fetch(new Request(pollUrl, {
    headers: { ...headers, 'X-Nearby-Session': hostToken }
  }), env);
  assert.deepEqual(await ready.json(), { answer: { type: 'answer', sdp: 'answer-sdp' } });
  const replay = await worker.fetch(new Request(pollUrl, {
    method: 'POST', headers: { ...headers, 'X-Nearby-Session': guestToken },
    body: JSON.stringify({ action: 'answer', answer: { type: 'answer', sdp: 'other-answer' } })
  }), env);
  assert.equal(replay.status, 409);
  const preflight = await worker.fetch(new Request(pollUrl, { method: 'OPTIONS' }), env);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /X-Nearby-Session/);
});

function createLiveBusinessDatabase() {
  const changes = [];
  const visits = [];
  const accountTenants = [];
  return {
    changes,
    visits,
    accountTenants,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async run() {
              if (query.includes('INSERT OR IGNORE INTO pos_sync_changes')) {
                if (!changes.some(item => item.tenant_id === values[0] && item.change_id === values[1])) {
                  changes.push({
                    revision: changes.length + 1, tenant_id: values[0], change_id: values[1],
                    device_id: values[2], entity: values[3], record_id: values[4], payload: values[5],
                    deleted: values[6], changed_at: values[7]
                  });
                }
                return { success: true };
              }
              if (query.includes('INSERT INTO storefront_visits')) {
                visits.push({
                  id: values[0], tenant_id: values[1], visitor_hash: values[2], path: values[3],
                  referrer: values[4], device: values[5], country: values[6], region: values[7],
                  created_at: values[8]
                });
                return { success: true };
              }
              throw new Error(`Unsupported live business query: ${query}`);
            },
            async first() {
              if (query.includes('FROM account_tenants')) {
                return accountTenants.some(row => row.username === values[0] && row.tenant_id === values[1])
                  ? { owned: 1 } : null;
              }
              if (query.includes('MAX(revision)')) {
                const own = changes.filter(item => item.tenant_id === values[0]);
                return { revision: own.length ? Math.max(...own.map(item => item.revision)) : 0 };
              }
              if (query.includes('COUNT(DISTINCT visitor_hash)')) {
                const own = visits.filter(item => item.tenant_id === values[0] && item.created_at >= values[1]);
                return { visits: own.length, unique_visitors: new Set(own.map(item => item.visitor_hash)).size };
              }
              throw new Error(`Unsupported live business first query: ${query}`);
            },
            async all() {
              if (query.includes('FROM pos_sync_changes')) {
                return {
                  results: changes.filter(item => item.tenant_id === values[0] && item.revision > values[1])
                    .sort((a, b) => a.revision - b.revision).slice(0, values[2])
                };
              }
              if (query.includes('FROM storefront_visits')) {
                const own = visits.filter(item => item.tenant_id === values[0] && item.created_at >= values[1]);
                const counts = new Map();
                for (const item of own) {
                  const key = query.includes('GROUP BY country, region') ? `${item.country}|${item.region}`
                    : query.includes('GROUP BY country') ? item.country
                      : query.includes('GROUP BY device') ? item.device : item.path;
                  if (!key || key === '|') continue;
                  const entry = counts.get(key) || { visits: 0 };
                  entry.visits += 1;
                  counts.set(key, { ...entry,
                    ...(query.includes('GROUP BY country, region') ? { country: item.country, region: item.region } : {}),
                    ...(query.includes('GROUP BY country') ? { country: item.country } : {}),
                    ...(query.includes('GROUP BY device') ? { device: item.device } : {}),
                    ...(query.includes('GROUP BY path') ? { path: item.path } : {})
                  });
                }
                return { results: [...counts.values()].sort((a, b) => b.visits - a.visits).slice(0, 30) };
              }
              throw new Error(`Unsupported live business all query: ${query}`);
            }
          };
        }
      };
    },
    async batch(statements) {
      for (const statement of statements) await statement.run();
      return { success: true };
    }
  };
}

function createInventoryDatabase(catalog) {
  const stock = new Map();
  const events = new Map();
  const catalogRow = { payload: JSON.stringify(catalog), admin_payload: JSON.stringify(catalog), updated_at: '2026-01-01T00:00:00.000Z' };
  return {
    prepare(query) {
      return {
        bind(...values) {
          return {
            query,
            values,
            async first() {
              if (query.includes('FROM catalog_snapshots')) return catalogRow;
              if (query.includes('FROM inventory_events')) return events.get(`${values[0]}:${values[1]}`) || null;
              throw new Error(`Unsupported inventory first query: ${query}`);
            },
            async all() {
              if (query.includes('FROM inventory_stock')) {
                return { results: [...stock.values()].filter(item => item.tenant_id === values[0]) };
              }
              throw new Error(`Unsupported inventory all query: ${query}`);
            },
            async run() {
              throw new Error(`Unsupported inventory run query: ${query}`);
            }
          };
        }
      };
    },
    async batch(statements) {
      const nextStock = new Map(stock);
      const nextEvents = new Map(events);
      for (const { query, values } of statements) {
        if (query.includes('INSERT INTO inventory_stock')) {
          const [tenantId, sku, quantity, updatedAt] = values;
          const key = `${tenantId}:${sku}`;
          if (query.includes('INSERT OR IGNORE')) {
            if (!nextStock.has(key)) nextStock.set(key, { tenant_id: tenantId, sku, stock: quantity, updated_at: updatedAt });
          } else {
            nextStock.set(key, { tenant_id: tenantId, sku, stock: quantity, updated_at: updatedAt });
          }
        } else if (query.includes('INSERT INTO inventory_events')) {
          const [tenantId, eventId, createdAt] = values;
          const key = `${tenantId}:${eventId}`;
          if (nextEvents.has(key)) throw new Error('UNIQUE constraint failed: inventory_events');
          nextEvents.set(key, { tenant_id: tenantId, event_id: eventId, created_at: createdAt });
        } else if (query.includes('INSERT INTO inventory_event_items')) {
          const [tenantId, , sku, quantity] = values;
          const key = `${tenantId}:${sku}`;
          const row = nextStock.get(key);
          if (!row || row.stock < quantity) throw new Error('insufficient_stock');
          nextStock.set(key, { ...row, stock: row.stock - quantity });
        } else {
          throw new Error(`Unsupported inventory batch query: ${query}`);
        }
      }
      stock.clear();
      nextStock.forEach((value, key) => stock.set(key, value));
      events.clear();
      nextEvents.forEach((value, key) => events.set(key, value));
      return statements.map(() => ({ success: true }));
    }
  };
}

test('Cloudflare Worker serves the shared HTML in storefront mode', async () => {
  let assetPath;
  const response = await worker.fetch(new Request('https://shop.example/'), {
    DB: createDatabase(),
    ASSETS: {
      async fetch(request) {
        assetPath = new URL(request.url).pathname;
        return new Response('<div id="app"></div>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  });

  assert.equal(response.status, 200);
  assert.equal(assetPath, '/builder-storefront');
  assert.match(await response.text(), /__ESHOP_CLOUDFLARE_STOREFRONT__ = true/);
});

test('Cloudflare Worker serves the published R2 theme at the shop root', async () => {
  const themeId = 'woodora-modern-furniture-luxury-home-interiors-kenya';
  let assetPath;
  const DB = {
    prepare(query) {
      assert.match(query, /SELECT payload FROM catalog_snapshots/);
      return {
        bind(tenantId) {
          assert.equal(tenantId, 'main');
          return {
            async first() {
              return {
                payload: JSON.stringify({
                  store: {
                    website_theme_id: themeId,
                    primary_color: '#7C3AED',
                    background_color: '#F4F1FF',
                    surface_color: '#FFFFFF',
                    text_color: '#17172F',
                    accent2_color: '#F06445',
                    accent3_color: '#8FD14F',
                    font_family: 'DM Sans',
                    display_font_family: 'Playfair Display',
                    card_shape: 'rounded',
                    whatsapp_enabled: 1,
                    whatsapp_url: 'https://wa.me/254700000000',
                    instagram_url: 'https://instagram.com/example',
                    location_name: 'Main shop',
                    location_address: 'Nairobi, Kenya',
                    mobile_card_layout: { columns: 3, scope: 'selected', sections: ['new-arrivals-1'] },
                    element_edits: [{
                      selector: 'body > main:nth-of-type(1) > h1:nth-of-type(1)',
                      kind: 'text',
                      text: 'Updated <script>alert(1)</script> heading',
                      offsetX: 12
                    }]
                  },
                  products: [{ id: 12, name: '</script><script>alert(1)</script>', category_id: 4, price: 35 }],
                  categories: [{ id: 4, name: 'Owner category', slug: 'owner-category' }]
                })
              };
            }
          };
        }
      };
    }
  };
  const response = await worker.fetch(new Request('https://shop.example/'), {
    DB,
    BUSINESS_ARCHIVE: {
      async get(key) {
        assetPath = key;
        return {
          body: '<!doctype html><html><head><title>Theme</title></head><body><main><h1>Woodora</h1></main></body></html>',
          httpMetadata: { contentType: 'text/html; charset=utf-8' }
        };
      }
    },
    ASSETS: {
      async fetch() {
        throw new Error('The shared storefront must not be loaded for a published theme.');
      }
    }
  });

  assert.equal(response.status, 200);
  assert.equal(assetPath, `themes/${themeId}/index.html`);
  const html = await response.text();
  assert.match(html, new RegExp(`<base href="/themes/${themeId}/">`));
  assert.match(html, /Woodora/);
  assert.match(html, /primary_color|#7C3AED/);
  assert.match(html, /Updated \\u003cscript>alert\(1\)\\u003c\/script> heading/);
  assert.match(html, /d\.querySelector\(edit\.selector\)/);
  assert.match(html, /window\.__ESHOP_THEME_CATALOG__=/);
  assert.match(html, /<script src="\/theme-catalog-adapter\.js" defer><\/script>/);
  assert.match(html, /"name":"\\u003c\/script>\\u003cscript>alert\(1\)\\u003c\/script>"/);
  assert.match(html, /"name":"Owner category"/);
  assert.match(html, /"whatsapp_enabled":1/);
  assert.match(html, /"accent2Color":"#F06445"/);
  assert.match(html, /"accent3Color":"#8FD14F"/);
  assert.match(html, /--eshop-accent-gradient:linear-gradient\(110deg,/);
  assert.match(html, /background-image:linear-gradient\(110deg,/);
  assert.match(html, /"instagram_url":"https:\/\/instagram\.com\/example"/);
  assert.match(html, /"location_name":"Main shop"/);
  assert.match(html, /displayFontFamily/);
  assert.match(html, /shape==="rounded"\?"16px"/);
  assert.match(html, /fonts\.googleapis\.com/);
  assert.doesNotMatch(html, /mobile_card_layout/);
});

test('Cloudflare Worker serves the browser POS app at /register without replacing the storefront root', async () => {
  const assetPaths = [];
  const env = {
    DB: createDatabase(),
    ASSETS: {
      async fetch(request) {
        assetPaths.push(new URL(request.url).pathname);
        return new Response('<html><body><div id="app"></div></body></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  };

  const response = await worker.fetch(new Request('https://shop.example/register'), env);
  const storefront = await worker.fetch(new Request('https://shop.example/'), env);
  const appHtml = await response.text();
  const storefrontHtml = await storefront.text();

  assert.equal(response.status, 200);
  assert.equal(assetPaths[0], '/register');
  assert.equal(assetPaths[1], '/builder-storefront');
  assert.match(appHtml, /<div id="app"><\/div>/);
  assert.doesNotMatch(appHtml, /__ESHOP_CLOUDFLARE_STOREFRONT__/);
  assert.match(storefrontHtml, /__ESHOP_CLOUDFLARE_STOREFRONT__ = true/);
});

test('shared inventory links by SKU and applies web sales once with stock checks', async () => {
  const DB = createInventoryDatabase({
    products: [{ id: 1, name: 'Runner', sku: 'RUN-1', stock: 8 }],
    categories: [],
    store: { name: 'Example' }
  });
  const TENANTS = createTenantStore();
  const ownerToken = 'test-shop-owner';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ownerToken));
  const ownerHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  await TENANTS.put('tenant:main', JSON.stringify({ id: 'main', owner_token_hash: ownerHash }));
  const env = { DB, TENANTS };

  const unauthorized = await worker.fetch(new Request('https://rrobin.co.ke/api/inventory/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'replace', items: [{ sku: 'RUN-1', stock: 8 }] })
  }), env);
  assert.equal(unauthorized.status, 401);

  const connected = await worker.fetch(new Request('https://rrobin.co.ke/api/inventory/connect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'replace', items: [{ sku: 'RUN-1', stock: 8 }] })
  }), env);
  assert.equal(connected.status, 200);

  const checkout = async (eventId, quantity) => worker.fetch(new Request('https://rrobin.co.ke/api/inventory/sale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId, items: [{ sku: 'RUN-1', quantity }] })
  }), env);
  assert.equal((await checkout('WEB-ORDER-1', 3)).status, 200);
  const retry = await checkout('WEB-ORDER-1', 3);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).duplicate, true);
  assert.equal((await checkout('WEB-ORDER-2', 6)).status, 409);

  const catalogResponse = await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.products[0].stock, 5);
  assert.equal(catalog.products[0].inventory_shared, true);
});

test('shared inventory migration deducts stock atomically and rolls back insufficient sales', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  try {
    const migration = await readFile(new URL('../cloudflare/migrations/0005_shared_inventory.sql', import.meta.url), 'utf8');
    db.exec(migration);
    db.run("INSERT INTO inventory_stock (tenant_id,sku,stock,updated_at) VALUES ('shop','A',5,'now'),('shop','B',1,'now')");
    db.run("BEGIN; INSERT INTO inventory_events (tenant_id,event_id,created_at) VALUES ('shop','SALE-1','now'); INSERT INTO inventory_event_items (tenant_id,event_id,sku,quantity) VALUES ('shop','SALE-1','A',2); COMMIT;");
    assert.equal(db.exec("SELECT stock FROM inventory_stock WHERE tenant_id='shop' AND sku='A'")[0].values[0][0], 3);

    db.run("BEGIN; INSERT INTO inventory_events (tenant_id,event_id,created_at) VALUES ('shop','SALE-2','now'); INSERT INTO inventory_event_items (tenant_id,event_id,sku,quantity) VALUES ('shop','SALE-2','A',2);");
    assert.throws(() => db.run("INSERT INTO inventory_event_items (tenant_id,event_id,sku,quantity) VALUES ('shop','SALE-2','B',2)"), /insufficient_stock/);
    db.run('ROLLBACK');
    assert.equal(db.exec("SELECT stock FROM inventory_stock WHERE tenant_id='shop' AND sku='A'")[0].values[0][0], 3);
    assert.equal(db.exec("SELECT COUNT(*) FROM inventory_events WHERE event_id='SALE-2'")[0].values[0][0], 0);
  } finally {
    db.close();
  }
});

test('business sync migration creates tenant-scoped branch and push storage', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  try {
    const migration = await readFile(new URL('../cloudflare/migrations/0006_business_sync.sql', import.meta.url), 'utf8');
    db.exec(migration);
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('business_branches','push_subscriptions')")[0].values.flat();
    assert.deepEqual(tables.sort(), ['business_branches', 'push_subscriptions']);
    assert.equal(db.exec('PRAGMA table_info(business_branches)')[0].values.length, 6);
    assert.equal(db.exec('PRAGMA table_info(push_subscriptions)')[0].values.length, 6);
  } finally {
    db.close();
  }
});

test('business snapshots are owner-authorized, tenant-scoped and archived in R2', async () => {
  const branches = new Map();
  const objects = new Map();
  const DB = {
    prepare(query) {
      return {
        bind(...values) {
          return {
            async all() {
              assert.match(query, /FROM business_branches WHERE tenant_id = \?/);
              return { results: [...branches.values()].filter(row => row.tenant_id === values[0]) };
            },
            async run() {
              assert.match(query, /INSERT INTO business_branches/);
              const [tenant_id, store_id, store_name, snapshot_id, r2_key, updated_at] = values;
              branches.set(`${tenant_id}:${store_id}`, {
                tenant_id, store_id, store_name, snapshot_id, r2_key, updated_at
              });
              return { success: true };
            }
          };
        }
      };
    }
  };
  const BUSINESS_ARCHIVE = {
    async put(key, value) { objects.set(key, value); },
    async get(key) {
      const value = objects.get(key);
      return value ? { async json() { return JSON.parse(value); } } : null;
    }
  };
  const TENANTS = createTenantStore();
  const ownerToken = 'test-main-owner';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main',
    owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = { DB, BUSINESS_ARCHIVE, TENANTS };
  const snapshot = {
    currency: 'KES',
    sales: [{ reference: 'POS-1', total: 100 }],
    expenses: [],
    products: [{ sku: 'S-1', stock: 4 }],
    visits: [],
    events: [],
    newsletter: [],
    points: [],
    bookings: [],
    instances: [],
    categories: [],
    settings: {}
  };
  const syncRequest = (tenant = 'main', token = ownerToken, data = snapshot) => new Request(
    `https://eshop-storefront.workers.dev/api/business/sync?tenant=${tenant}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: 'branch-1', store_name: 'Branch 1', snapshot: data })
    }
  );

  const denied = await worker.fetch(syncRequest('main', 'wrong-token'), env);
  assert.equal(denied.status, 401);
  const saved = await worker.fetch(syncRequest(), env);
  assert.equal(saved.status, 200);
  const savedResult = await saved.json();
  assert.match(savedResult.snapshot_id, /^[a-f0-9]{64}$/);
  assert.equal(objects.size, 1);

  const listed = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/business/branches?tenant=main',
    { headers: { Authorization: `Bearer ${ownerToken}` } }
  ), env);
  assert.equal(listed.status, 200);
  const result = await listed.json();
  assert.equal(result.branches.length, 1);
  assert.deepEqual(result.branches[0].snapshot, snapshot);

  const noArchive = await worker.fetch(syncRequest(), { DB, TENANTS });
  assert.equal(noArchive.status, 503);
  assert.equal(objects.size, 1);
});

test('live POS changes sync through tenant-authorized D1 and visit analytics retain only coarse geography', async () => {
  const DB = createLiveBusinessDatabase();
  const TENANTS = createTenantStore();
  const ownerToken = 'live-sync-owner-key';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = { DB, TENANTS };
  const url = 'https://eshop-storefront.workers.dev/api/business/records?tenant=main';
  const changes = [{
    change_id: 'change-0001', device_id: 'device-0001', entity: 'supplier',
    record_id: 'supplier-1', payload: { id: 'supplier-1', name: 'Canvas Supply' },
    deleted: false, changed_at: new Date().toISOString()
  }];
  const denied = await worker.fetch(new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes })
  }), env);
  assert.equal(denied.status, 401);
  const authorization = { Authorization: `Bearer ${ownerToken}` };
  const pushed = await worker.fetch(new Request(url, {
    method: 'POST', headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes })
  }), env);
  assert.equal(pushed.status, 200);
  assert.equal((await pushed.json()).latest_revision, 1);
  const duplicate = await worker.fetch(new Request(url, {
    method: 'POST', headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes })
  }), env);
  assert.equal(duplicate.status, 200);
  assert.equal(DB.changes.length, 1);
  const pulled = await worker.fetch(new Request(`${url}&after=0` , { headers: authorization }), env);
  const syncResult = await pulled.json();
  assert.equal(syncResult.changes.length, 1);
  assert.deepEqual(syncResult.changes[0].payload, { id: 'supplier-1', name: 'Canvas Supply' });
  assert.equal((await (await worker.fetch(new Request(`${url}&after=1`, { headers: authorization }), env)).json()).changes.length, 0);
  const accountSessionToken = 'account-session-token';
  await TENANTS.put(`session:${await sha256HexForTest(accountSessionToken)}`, JSON.stringify({ username: 'shop-owner' }));
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken), owner_username: 'shop-owner'
  }));
  const accountAuthorization = { Authorization: `Bearer ${accountSessionToken}` };
  const accountSync = await worker.fetch(new Request(`${url}&after=0`, { headers: accountAuthorization }), env);
  assert.equal(accountSync.status, 200, await accountSync.clone().text());
  await TENANTS.put('tenant:another-shop', JSON.stringify({ id: 'another-shop', owner_username: 'different-owner' }));
  const unrelatedAccountSync = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/business/records?tenant=another-shop',
    { headers: accountAuthorization }
  ), env);
  assert.equal(unrelatedAccountSync.status, 401);
  const invalid = await worker.fetch(new Request(url, {
    method: 'POST', headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [{ ...changes[0], entity: 'account' }] })
  }), env);
  assert.equal(invalid.status, 400);

  const visitRequest = new Request('https://eshop-storefront.workers.dev/api/analytics/visit?tenant=main', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Android Mobile' },
    body: JSON.stringify({ visitor_id: 'anonymous-browser-123', path: '/product/tote?email=private@example.test', referrer: 'https://search.example/results?query=secret' })
  });
  Object.defineProperty(visitRequest, 'cf', { value: { country: 'KE', regionCode: '30' } });
  const visitResponse = await worker.fetch(visitRequest, env);
  assert.equal(visitResponse.status, 202);
  assert.equal(DB.visits.length, 1);
  assert.equal(DB.visits[0].path, '/product/tote');
  assert.equal(DB.visits[0].country, 'KE');
  assert.equal(DB.visits[0].region, '30');
  assert.equal(DB.visits[0].device, 'mobile');
  assert.equal(DB.visits[0].visitor_hash.includes('anonymous-browser-123'), false);
  assert.equal('ip' in DB.visits[0], false);
  const unauthenticatedAnalytics = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/analytics/visit?tenant=main&days=30'
  ), env);
  assert.equal(unauthenticatedAnalytics.status, 401);
  const analytics = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/analytics/visit?tenant=main&days=30',
    { headers: authorization }
  ), env);
  assert.equal(analytics.status, 200);
  const report = await analytics.json();
  assert.equal(report.visits, 1);
  assert.equal(report.unique_visitors, 1);
  assert.equal(report.countries[0].country, 'KE');
  assert.match(report.location_note, /IP addresses are not stored/);
});

test('storefront orders are idempotent, priced from the published catalogue, and owner-managed', async () => {
  const DB = createStorefrontOrderDatabase();
  const TENANTS = createTenantStore();
  const ownerToken = 'storefront-order-owner-key';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = { DB, TENANTS };
  const url = 'https://eshop-storefront.workers.dev/api/orders?tenant=main';
  const order = {
    idempotency_key: '71a2b153-4af0-4c64-8b58-0e7d45005b14',
    customer_name: 'Sam Shop',
    customer_email: 'sam@example.test',
    customer_phone: '+254700000001',
    shipping_address: '12 Market Street',
    city: 'Nairobi',
    country: 'KE',
    discount_cents: 100,
    shipping_cents: 500,
    items: [{ product_id: 7, quantity: 2, unit_price: 0.01 }]
  };
  const created = await worker.fetch(new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
  }), env);
  assert.equal(created.status, 201);
  const createdResult = await created.json();
  assert.equal(createdResult.order.subtotal, 25);
  assert.equal(createdResult.order.total, 25);
  assert.equal(createdResult.order.discount, 0);
  assert.equal(createdResult.order.shipping, 0);
  assert.equal(createdResult.order.shipping_address, '');
  assert.equal(createdResult.order.city, '');
  assert.equal(createdResult.order.status, 'pending');
  assert.equal(createdResult.order.items[0].unit_price, 12.5);

  const duplicate = await worker.fetch(new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
  }), env);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(DB.orders.size, 1);

  const denied = await worker.fetch(new Request(url), env);
  assert.equal(denied.status, 401);
  const authorization = { Authorization: `Bearer ${ownerToken}` };
  const listed = await worker.fetch(new Request(url, { headers: authorization }), env);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).orders.length, 1);
  const updated = await worker.fetch(new Request(url, {
    method: 'PATCH',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: createdResult.order.order_number, status: 'processing' })
  }), env);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).order.status, 'processing');
  const oversold = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...order, idempotency_key: '81a2b153-4af0-4c64-8b58-0e7d45005b14',
      items: [{ product_id: 7, quantity: 99 }] })
  }), env);
  assert.equal(oversold.status, 409);
});

test('Paystack setup sends bank details only upstream and persists masked connection metadata', async () => {
  const DB = createPaystackDatabase();
  const TENANTS = createTenantStore();
  const ownerToken = 'paystack-owner-key';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = { DB, TENANTS, PAYSTACK_SECRET_KEY: 'test-paystack-secret' };
  const baseUrl = 'https://eshop-storefront.workers.dev/api/payments/paystack';
  const authorization = { Authorization: `Bearer ${ownerToken}` };
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-paystack-secret');
    if (url.pathname.endsWith('/bank')) {
      return Response.json({ status: true, data: [{ name: 'Example Bank', code: '001', currency: 'KES' }] });
    }
    const submitted = JSON.parse(init.body);
    assert.equal(submitted.percentage_charge, 0);
    assert.match(submitted.account_number, /^\d{5,20}$/);
    return Response.json({
      status: true,
      data: {
        subaccount_code: 'ACCT_test123',
        active: true,
        settlement_bank: 'Example Bank',
        account_number: submitted.account_number
      }
    });
  };
  try {
    const unauthorized = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      method: 'POST', body: JSON.stringify({ account_number: '0123456789' })
    }), env);
    assert.equal(unauthorized.status, 401);
    assert.equal(calls.length, 0);

    const banksResponse = await worker.fetch(new Request(`${baseUrl}/banks?tenant=main`), env);
    assert.equal(banksResponse.status, 200);
    assert.deepEqual((await banksResponse.json()).banks, [{ name: 'Example Bank', code: '001' }]);

    const details = {
      business_name: 'Example Shop',
      settlement_bank: '001',
      account_number: '0123456789',
      primary_contact_name: 'Shop Owner',
      primary_contact_email: 'owner@example.test',
      primary_contact_phone: '+254700000000'
    };
    const connected = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    }), env);
    assert.equal(connected.status, 200);
    assert.deepEqual((await connected.json()).account, {
      configured: true, connected: true, status: 'connected', bank_name: 'Example Bank', account_last4: '6789',
      updated_at: DB.rows.get('main').updated_at
    });
    assert.equal(DB.rows.size, 1);
    assert.equal(JSON.stringify([...DB.rows.values()]).includes('0123456789'), false);
    assert.equal(JSON.stringify([...DB.rows.values()]).includes('owner@example.test'), false);

    const saved = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      headers: authorization
    }), env);
    const savedResult = await saved.json();
    assert.equal(savedResult.account.connected, true);
    assert.equal(JSON.stringify(savedResult).includes('0123456789'), false);

    const updatedDetails = { ...details, account_number: '9876543210' };
    const updated = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDetails)
    }), env);
    assert.equal(updated.status, 200);
    assert.equal(calls.at(-1).init.method, 'PUT');
    assert.equal(calls.at(-1).url.pathname, '/subaccount/ACCT_test123');
    assert.equal(DB.rows.get('main').account_last4, '3210');
    assert.equal(JSON.stringify([...DB.rows.values()]).includes('9876543210'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a shop owner can reuse a connected Paystack subaccount on another owned website', async () => {
  const DB = createPaystackDatabase();
  const TENANTS = createTenantStore();
  const sessionToken = 'paystack-reuse-account-session';
  await TENANTS.put(
    `session:${await sha256HexForTest(sessionToken)}`,
    JSON.stringify({ username: 'shop-owner' })
  );
  assert.deepEqual(
    await TENANTS.get(`session:${await sha256HexForTest(sessionToken)}`, 'json'),
    { username: 'shop-owner' }
  );
  const sourceOwnerToken = 'source-shop-owner-key';
  const mainOwnerToken = 'main-shop-owner-key';
  await TENANTS.put('tenant:source-shop', JSON.stringify({
    id: 'source-shop', owner_username: 'shop-owner',
    owner_token_hash: await sha256HexForTest(sourceOwnerToken)
  }));
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(mainOwnerToken)
  }));
  await TENANTS.put('tenant:new-store', JSON.stringify({ id: 'new-store', owner_username: 'shop-owner' }));
  await TENANTS.put('tenant:new-main-store', JSON.stringify({ id: 'new-main-store', owner_username: 'shop-owner' }));
  await TENANTS.put('tenant:other-owner-store', JSON.stringify({ id: 'other-owner-store', owner_username: 'other-owner' }));
  DB.accountTenants.add('shop-owner:source-shop');
  DB.accountTenants.add('shop-owner:new-store');
  DB.rows.set('source-shop', {
    tenant_id: 'source-shop', subaccount_code: 'ACCT_shared123', status: 'connected',
    bank_name: 'Example Bank', account_last4: '6789', created_at: '2026-10-10T00:00:00.000Z',
    updated_at: '2026-10-10T00:00:00.000Z'
  });
  DB.rows.set('main', {
    tenant_id: 'main', subaccount_code: 'ACCT_main123', status: 'connected',
    bank_name: 'Main Bank', account_last4: '4321', created_at: '2026-10-10T00:00:00.000Z',
    updated_at: '2026-10-10T00:00:00.000Z'
  });
  DB.rows.set('source-shop-2', {
    tenant_id: 'source-shop-2', subaccount_code: 'ACCT_shared456', status: 'connected',
    bank_name: 'Second Bank', account_last4: '2468', created_at: '2026-10-10T00:00:00.000Z',
    updated_at: '2026-10-10T00:00:00.000Z'
  });
  await TENANTS.put('tenant:source-shop-2', JSON.stringify({
    id: 'source-shop-2', owner_username: 'shop-owner',
    owner_token_hash: await sha256HexForTest('second-source-key')
  }));
  DB.accountTenants.add('shop-owner:source-shop-2');
  const baseUrl = 'https://eshop-storefront.workers.dev/api/payments/paystack/link';
  const request = (tenantId, sessionCredential, sourceTenantId, sourceOwnerCredential) => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('Authorization', ['Bearer', sessionCredential].join(' '));
    return worker.fetch(new Request(
      `${baseUrl}?tenant=${encodeURIComponent(tenantId)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source_tenant_id: sourceTenantId,
          source_owner_token: sourceOwnerCredential
        })
      }
    ), { DB, TENANTS });
  };

  const unauthorized = await request('other-owner-store', sessionToken, 'source-shop', sourceOwnerToken);
  assert.equal(unauthorized.status, 403);
  assert.equal(DB.rows.has('other-owner-store'), false);

  const linked = await request('new-store', sessionToken, 'source-shop', sourceOwnerToken);
  assert.equal(linked.status, 200, await linked.clone().text());
  assert.deepEqual((await linked.json()).account, {
    configured: true, connected: true, status: 'connected', bank_name: 'Example Bank',
    account_last4: '6789', updated_at: DB.rows.get('new-store').updated_at
  });
  assert.equal(DB.rows.get('new-store').subaccount_code, DB.rows.get('source-shop').subaccount_code);

  const mainSource = await request('new-main-store', sessionToken, 'main', mainOwnerToken);
  assert.equal(mainSource.status, 200);
  assert.equal(DB.rows.get('new-main-store').subaccount_code, 'ACCT_main123');

  const cannotBorrow = await request('new-store', sessionToken, 'other-owner-store', 'not-their-owner-key');
  assert.equal(cannotBorrow.status, 403);

  const defaultUrl = 'https://eshop-storefront.workers.dev/api/payments/paystack/default';
  const setDefault = sourceTenantId => worker.fetch(new Request(`${defaultUrl}?tenant=new-store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      source_tenant_id: sourceTenantId,
      source_owner_token: sourceTenantId === 'source-shop' ? sourceOwnerToken : 'second-source-key'
    })
  }), { DB, TENANTS });
  const firstDefault = await setDefault('source-shop');
  assert.equal(firstDefault.status, 200, await firstDefault.clone().text());
  assert.equal(DB.defaults.get('shop-owner').source_tenant_id, 'source-shop');
  const defaultRead = await worker.fetch(new Request(`${defaultUrl}?tenant=new-store`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }), { DB, TENANTS });
  const defaultResponse = await defaultRead.json();
  assert.equal(defaultResponse.default_account.tenant_id, 'source-shop');
  assert.equal(defaultResponse.default_account.account_last4, '6789');

  const switchedDefault = await setDefault('source-shop-2');
  assert.equal(switchedDefault.status, 200, await switchedDefault.clone().text());
  assert.equal(DB.defaults.get('shop-owner').source_tenant_id, 'source-shop-2');

  const foreignDefault = await worker.fetch(new Request(`${defaultUrl}?tenant=other-owner-store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      source_tenant_id: 'source-shop-2',
      source_owner_token: 'second-source-key'
    })
  }), { DB, TENANTS });
  assert.equal(foreignDefault.status, 403);
});

test('websites under one app account use its shared default Paystack account at checkout', async () => {
  const DB = createStorefrontOrderDatabase();
  const TENANTS = createTenantStore();
  await TENANTS.put('tenant:website-two', JSON.stringify({
    id: 'website-two', owner_username: 'shop-owner'
  }));
  DB.paystackSubaccounts.set('website-two', {
    tenant_id: 'website-two', subaccount_code: 'ACCT_olderSite', status: 'connected'
  });
  DB.paystackSubaccounts.set('website-one', {
    tenant_id: 'website-one', subaccount_code: 'ACCT_appDefault', status: 'connected'
  });
  DB.paystackOwnerDefaults.set('shop-owner', { source_tenant_id: 'website-one' });
  const created = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/orders?tenant=website-two',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: '526a8092-8825-4285-854e-e96bcd958ee5',
        customer_name: 'Test Customer',
        customer_email: 'customer@example.test',
        items: [{ product_id: 7, quantity: 1 }]
      })
    }
  ), { DB, TENANTS });
  const createdOrder = (await created.json()).order;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/transaction/initialize')) {
      const body = JSON.parse(init.body);
      assert.equal(body.subaccount, 'ACCT_appDefault');
      assert.equal(body.amount, 1250);
      return Response.json({
        status: true,
        data: { reference: body.reference, authorization_url: 'https://checkout.paystack.com/default' }
      });
    }
    throw new Error(`Unexpected payment fetch: ${url.pathname}`);
  };
  try {
    const initialized = await worker.fetch(new Request(
      `https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=website-two`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: createdOrder.order_number })
      }
    ), { DB, TENANTS, PAYSTACK_SECRET_KEY: 'test-paystack-secret' });
    assert.equal(initialized.status, 200, await initialized.clone().text());
    assert.equal((await initialized.json()).authorization_url, 'https://checkout.paystack.com/default');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paystack checkout uses the shop subaccount and verifies signed payments idempotently', async () => {
  const DB = createStorefrontOrderDatabase();
  const TENANTS = createTenantStore();
  const env = { DB, TENANTS, PAYSTACK_SECRET_KEY: 'test-paystack-secret' };
  DB.paystackSubaccounts.set('main', {
    tenant_id: 'main', subaccount_code: 'ACCT_test123', status: 'connected'
  });
  const orderUrl = 'https://eshop-storefront.workers.dev/api/orders?tenant=main';
  const created = await worker.fetch(new Request(orderUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: '81a2b153-4af0-4c64-8b58-0e7d45005b14',
      customer_name: 'Sam Shop', customer_email: 'sam@example.test',
      items: [{ product_id: 7, quantity: 2 }]
    })
  }), env);
  assert.equal(created.status, 201);
  const orderNumber = (await created.json()).order.order_number;
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-paystack-secret');
    if (url.pathname.endsWith('/transaction/initialize')) {
      const body = JSON.parse(init.body);
      assert.equal(body.subaccount, 'ACCT_test123');
      assert.equal(body.transaction_charge, 0);
      assert.equal(body.bearer, 'subaccount');
      assert.equal(body.amount, 2500);
      assert.equal(body.currency, 'KES');
      assert.match(body.callback_url, /checkout\/confirmation/);
      return Response.json({
        status: true,
        data: { reference: body.reference, authorization_url: 'https://checkout.paystack.com/abc123' }
      });
    }
    if (url.pathname.includes('/transaction/verify/')) {
      return Response.json({
        status: true,
        data: {
          reference: url.pathname.split('/').at(-1), status: 'success',
          amount: 2500, currency: 'KES'
        }
      });
    }
    throw new Error(`Unexpected Paystack request: ${url}`);
  };
  try {
    const initializeUrl = 'https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=main';
    const initialize = await worker.fetch(new Request(initializeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number: orderNumber })
    }), env);
    assert.equal(initialize.status, 200);
    const initialized = await initialize.json();
    assert.equal(initialized.authorization_url, 'https://checkout.paystack.com/abc123');
    assert.equal(DB.orders.values().next().value.payment_status, 'pending');

    const retry = await worker.fetch(new Request(initializeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number: orderNumber })
    }), env);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).reference, initialized.reference);
    assert.equal(calls.filter(call => call.url.pathname.endsWith('/transaction/initialize')).length, 1);

    const verified = await worker.fetch(new Request(
      `https://eshop-storefront.workers.dev/api/payments/paystack/verify?tenant=main&reference=${initialized.reference}`
    ), env);
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).payment_status, 'paid');

    const sendWebhook = async (amount) => {
      const body = JSON.stringify({
        event: 'charge.success',
        data: { reference: initialized.reference, status: 'success', amount, currency: 'KES' }
      });
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(env.PAYSTACK_SECRET_KEY),
        { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
      );
      const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
      const signature = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      return worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
        method: 'POST',
        headers: { 'x-paystack-signature': signature, 'Content-Type': 'application/json' },
        body
      }), env);
    };
    const mismatchedWebhook = await sendWebhook(1);
    assert.equal(mismatchedWebhook.status, 409);
    const paidWebhook = await sendWebhook(2500);
    assert.equal(paidWebhook.status, 200);
    assert.equal((await paidWebhook.json()).payment_status, 'paid');
    assert.equal(DB.orders.values().next().value.payment_status, 'paid');

    const invalidSignature = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': '0'.repeat(128) },
      body: JSON.stringify({ event: 'charge.success', data: { reference: initialized.reference } })
    }), env);
    assert.equal(invalidSignature.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('storefront order migration enforces idempotency and tenant isolation', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  try {
    db.exec(await readFile(new URL('../cloudflare/migrations/0008_storefront_orders.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0010_storefront_order_payments.sql', import.meta.url), 'utf8'));
    assert.equal(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='storefront_orders'")[0].values.length, 1);
    assert.equal(db.exec('PRAGMA table_info(storefront_orders)')[0].values.length, 23);
    db.run("INSERT INTO storefront_orders (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,customer_phone,shipping_address,city,postal_code,country,currency,subtotal_cents,discount_cents,shipping_cents,total_cents,items_json,created_at,updated_at) VALUES ('shop-a','ORD-TEST-00000001','key-a','pending','Sam','sam@example.test','0700000000','12 Market','Nairobi','','KE','KES',100,0,0,100,'[]','now','now')");
    assert.throws(() => db.run("INSERT INTO storefront_orders (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,customer_phone,shipping_address,city,postal_code,country,currency,subtotal_cents,discount_cents,shipping_cents,total_cents,items_json,created_at,updated_at) VALUES ('shop-a','ORD-TEST-00000002','key-a','pending','Sam','sam@example.test','0700000000','12 Market','Nairobi','','KE','KES',100,0,0,100,'[]','now','now')"), /UNIQUE constraint failed/);
    db.run("INSERT INTO storefront_orders (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,customer_phone,shipping_address,city,postal_code,country,currency,subtotal_cents,discount_cents,shipping_cents,total_cents,items_json,created_at,updated_at) VALUES ('shop-b','ORD-TEST-00000002','key-a','pending','Sam','sam@example.test','0700000000','12 Market','Nairobi','','KE','KES',100,0,0,100,'[]','now','now')");
    assert.equal(db.exec('SELECT COUNT(*) FROM storefront_orders')[0].values[0][0], 2);
    assert.equal(db.exec("SELECT payment_status FROM storefront_orders WHERE tenant_id='shop-a'")[0].values[0][0], 'unpaid');
  } finally {
    db.close();
  }
});

test('Paystack migration stores only tenant-scoped references and masked account fields', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  try {
    db.exec(await readFile(new URL('../cloudflare/migrations/0009_paystack_subaccounts.sql', import.meta.url), 'utf8'));
    db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at) VALUES ('shop-a','ACCT_test123','connected','Example Bank','6789','now','now')");
    db.exec(await readFile(new URL('../cloudflare/migrations/0013_reusable_paystack_subaccounts.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0014_allow_pending_paystack_setup.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0015_app_default_paystack_account.sql', import.meta.url), 'utf8'));
    const columns = db.exec('PRAGMA table_info(paystack_subaccounts)')[0].values.map(row => row[1]);
    assert.deepEqual(columns, [
      'tenant_id', 'subaccount_code', 'status', 'bank_name', 'account_last4', 'created_at', 'updated_at'
    ]);
    assert.equal(db.exec("SELECT subaccount_code FROM paystack_subaccounts WHERE tenant_id='shop-a'")[0].values[0][0], 'ACCT_test123');
    db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at) VALUES ('shop-b','ACCT_test123','connected','Example Bank','6789','now','now')");
    db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at) VALUES ('shop-c',NULL,'setup_in_progress','','','now','now')");
    assert.equal(db.exec("SELECT COUNT(*) FROM paystack_subaccounts WHERE subaccount_code='ACCT_test123'")[0].values[0][0], 2);
    db.run("INSERT INTO paystack_owner_defaults (owner_username,source_tenant_id,created_at,updated_at) VALUES ('owner-a','shop-a','now','now')");
    db.run("INSERT INTO paystack_owner_defaults (owner_username,source_tenant_id,created_at,updated_at) VALUES ('owner-b','shop-b','now','now')");
    assert.equal(db.exec("SELECT COUNT(*) FROM paystack_owner_defaults")[0].values[0][0], 2);
    assert.throws(() => db.run("INSERT INTO paystack_owner_defaults (owner_username,source_tenant_id,created_at,updated_at) VALUES ('owner-a','shop-b','now','now')"));
  } finally {
    db.close();
  }
});

test('push subscriptions are opt-in and owner broadcasts use encrypted Web Push', async () => {
  const subscriptions = new Map();
  const archived = new Map();
  const DB = {
    prepare(query) {
      return {
        bind(...values) {
          return {
            async all() {
              assert.match(query, /FROM push_subscriptions/);
              return { results: [...subscriptions.values()].filter(row => row.tenant_id === values[0]) };
            },
            async run() {
              if (query.includes('INSERT INTO push_subscriptions')) {
                const [tenant_id, endpoint_hash, endpoint, p256dh, auth, created_at] = values;
                subscriptions.set(`${tenant_id}:${endpoint_hash}`, {
                  tenant_id, endpoint_hash, endpoint, p256dh, auth, created_at
                });
                return { success: true };
              }
              if (query.includes('DELETE FROM push_subscriptions')) {
                subscriptions.delete(`${values[0]}:${values[1]}`);
                return { success: true };
              }
              throw new Error(`Unsupported push query: ${query}`);
            }
          };
        }
      };
    }
  };
  const BUSINESS_ARCHIVE = {
    async put(key, value) { archived.set(key, value); }
  };
  const TENANTS = createTenantStore();
  const ownerToken = 'test-main-owner';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const vapidKeys = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
  );
  const vapidJwk = await crypto.subtle.exportKey('jwk', vapidKeys.privateKey);
  const publicKey = Buffer.from([
    4, ...Buffer.from(vapidJwk.x, 'base64url'), ...Buffer.from(vapidJwk.y, 'base64url')
  ]).toString('base64url');
  const clientKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const clientPublicKey = Buffer.from(await crypto.subtle.exportKey('raw', clientKeys.publicKey)).toString('base64url');
  const authSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
  const env = {
    DB,
    TENANTS,
    BUSINESS_ARCHIVE,
    VAPID_PUBLIC_KEY: publicKey,
    VAPID_PRIVATE_KEY: vapidJwk.d,
    VAPID_SUBJECT: 'mailto:admin@example.com'
  };
  const registered = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/push/subscriptions?tenant=main',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        keys: { p256dh: clientPublicKey, auth: authSecret }
      })
    }
  ), env);
  assert.equal(registered.status, 200);
  assert.equal(subscriptions.size, 1);

  const originalFetch = globalThis.fetch;
  let pushHeaders;
  let encryptedBody;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://fcm.googleapis.com/fcm/send/test-endpoint');
    pushHeaders = new Headers(init.headers);
    encryptedBody = new Uint8Array(init.body);
    return new Response(null, { status: 201 });
  };
  try {
    const sent = await worker.fetch(new Request(
      'https://eshop-storefront.workers.dev/api/push/broadcast?tenant=main',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New stock', body: 'Fresh arrivals are here.', url: '/' })
      }
    ), env);
    assert.equal(sent.status, 200);
    assert.equal((await sent.json()).accepted, 1);
    assert.match(pushHeaders.get('Authorization'), /^vapid t=/);
    assert.equal(pushHeaders.get('Content-Encoding'), 'aes128gcm');
    assert.ok(encryptedBody.byteLength > 100);
    const salt = encryptedBody.slice(0, 16);
    const serverPublic = encryptedBody.slice(21, 21 + encryptedBody[20]);
    const encrypted = encryptedBody.slice(21 + encryptedBody[20]);
    const importedServerKey = await crypto.subtle.importKey(
      'raw', serverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'ECDH', public: importedServerKey }, clientKeys.privateKey, 256
    ));
    const info = new Uint8Array([
      ...new TextEncoder().encode('WebPush: info\0'),
      ...Buffer.from(clientPublicKey, 'base64url'),
      ...serverPublic
    ]);
    const inputKeyMaterial = await hkdfForTest(
      sharedSecret, Buffer.from(authSecret, 'base64url'), info, 32
    );
    const cek = await hkdfForTest(
      inputKeyMaterial, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16
    );
    const nonce = await hkdfForTest(
      inputKeyMaterial, salt, new TextEncoder().encode('Content-Encoding: nonce\0'), 12
    );
    const contentKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const cleartext = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce }, contentKey, encrypted
    ));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(cleartext.slice(0, -1))), {
      title: 'New stock', body: 'Fresh arrivals are here.', url: '/'
    });
    assert.equal(archived.size, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function sha256HexForTest(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hkdfForTest(input, salt, info, length) {
  const key = await crypto.subtle.importKey('raw', input, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: 'HKDF', hash: 'SHA-256', salt, info
  }, key, length * 8));
}

test('catalog publishing is authenticated and stores only public fields and linked images', async () => {
  const DB = createDatabase();
  const env = { DB, TENANTS: createTenantStore(), PUBLISH_TOKEN: 'test-token' };
  const unauthorized = await worker.fetch(new Request('https://shop.example/api/catalog', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: [], categories: [] })
  }), env);
  assert.equal(unauthorized.status, 401);

  const catalog = {
    categories: [{
      id: 4,
      name: 'Shoes',
      slug: 'shoes',
      image: 'data:image/png;base64,private',
      description: 'Footwear'
    }],
    products: [{
      id: 9,
      name: 'Runner',
      slug: 'runner',
      category_id: 4,
      price: 25,
      stock: 3,
      cost_price: 2,
      images: ['https://images.example/runner.jpg', 'data:image/png;base64,private']
    }],
    store: {
      name: 'Example Store',
      email: 'hello@example.com',
      primary_color: '#7C3AED',
      background_color: '#FAFAF8',
      text_color: '#141413',
      website_theme_id: 'woodora-luxury-furniture',
      font_family: 'humanist',
      element_edits: [
        {
          selector: '#app > main:nth-of-type(1) > section:nth-of-type(2) > h2:nth-of-type(1)',
          kind: 'text',
          text: 'Edited heading',
          rotation: 15,
          identity: 'text:abc:def:80',
          lineage: [
            { tag: 'h2', classes: 'hero-title', id: '', productId: '', slide: '1' },
            { tag: 'section', classes: 'hero-slide active', id: '', productId: '', slide: '1' }
          ]
        },
        {
          selector: '#app > main:nth-of-type(1) > section:nth-of-type(2) > img:nth-of-type(1)',
          kind: 'image',
          src: 'data:image/png;base64,private',
          originalSrc: 'https://images.example/original.jpg',
          originalSrcHash: 'src:abcdef0123456789',
          rotation: -15,
          lineage: [{ tag: 'img', classes: 'hero-bg-img', id: '', productId: '', slide: '1' }]
        },
        {
          selector: '#app > main:nth-of-type(1) > nav:nth-of-type(1) > a:nth-of-type(1) > svg:nth-of-type(1)',
          kind: 'icon',
          rotation: 15,
          offsetX: 999,
          offsetY: -16,
          linkDeleted: true,
          href: '/collections',
          linkSelector: '#app > main:nth-of-type(1) > nav:nth-of-type(1) > a:nth-of-type(1)',
          lineage: [{ tag: 'svg', classes: '', id: '', productId: '', slide: '' }],
          linkLineage: [{ tag: 'a', classes: 'nav-link', id: '', productId: '', slide: '' }]
        },
        {
          selector: '#app > main:nth-of-type(1) > section:nth-of-type(1) > div:nth-of-type(1)',
          kind: 'group',
          offsetX: -18,
          offsetY: 32,
          lineage: [{ tag: 'div', classes: 'hero-slide', id: '', productId: '', slide: '0', href: '', text: '' }]
        },
        {
          selector: 'body > main:nth-of-type(1) > h1:nth-of-type(1)',
          kind: 'text',
          text: 'Body-based theme edit'
        }
      ]
    },
    pages: [
      { id: 1, title: 'About', slug: 'about', content: 'Our story', published: 1 },
      { id: 2, title: 'Draft', slug: 'draft', content: 'Not public yet', published: 0 }
    ]
  };
  const published = await worker.fetch(new Request('https://shop.example/api/catalog?tenant=main', {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(catalog)
  }), env);
  assert.equal(published.status, 200);
  const publishResult = await published.json();
  assert.equal(publishResult.ok, true);
  assert.equal(publishResult.product_count, 1);
  assert.equal(publishResult.category_count, 1);
  assert.match(publishResult.updated_at, /^\d{4}-\d\d-\d\dT/);

  const loaded = await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env);
  const result = await loaded.json();
  assert.deepEqual(result.products[0].images, ['https://images.example/runner.jpg']);
  assert.equal('cost_price' in result.products[0], false);
  assert.equal(result.categories[0].image, '');
  assert.equal(result.store.email, 'hello@example.com');
  assert.equal(result.store.primary_color, '#7C3AED');
  assert.equal(result.store.website_theme_id, 'woodora-luxury-furniture');
  assert.equal(result.store.font_family, 'humanist');
  assert.equal(result.store.element_edits[0].text, 'Edited heading');
  assert.equal(result.store.element_edits[0].identity, 'text:abc:def:80');
  assert.equal(result.store.element_edits[0].lineage[0].tag, 'h2');
  assert.equal(result.store.element_edits[1].src, '');
  assert.equal(result.store.element_edits[1].originalSrc, 'https://images.example/original.jpg');
  assert.equal(result.store.element_edits[1].originalSrcHash, 'src:abcdef0123456789');
  assert.equal(result.store.element_edits[1].rotation, 345);
  assert.equal(result.store.element_edits[2].kind, 'icon');
  assert.equal(result.store.element_edits[2].href, '/collections');
  assert.equal(result.store.element_edits[2].offsetX, 240);
  assert.equal(result.store.element_edits[2].offsetY, -16);
  assert.equal(result.store.element_edits[2].linkDeleted, true);
  assert.equal(result.store.element_edits[3].kind, 'group');
  assert.equal(result.store.element_edits[3].offsetX, -18);
  assert.equal(result.store.element_edits[3].lineage[0].href, '');
  assert.equal(result.store.element_edits[4].selector, 'body > main:nth-of-type(1) > h1:nth-of-type(1)');
  assert.equal(result.store.element_edits[4].text, 'Body-based theme edit');
  assert.deepEqual(result.pages.map(page => page.slug), ['about']);

  const partialPublish = await worker.fetch(new Request('https://shop.example/api/catalog?tenant=main', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ store: {
      whatsapp_enabled: 1,
      whatsapp_url: 'https://wa.me/254700000000',
      location_name: 'Nairobi shop',
      color_theme: 'chromatic-studio',
      primary_color: '#5B5CF0',
      background_color: '#F4F1FF',
      surface_color: '#FFFFFF',
      text_color: '#17172F',
      accent2_color: '#F06445',
      accent3_color: '#8FD14F',
      design_theme: 'quiet-lounge'
    } })
  }), env);
  assert.equal(partialPublish.status, 200);
  assert.equal((await partialPublish.json()).settings_only, true);
  const afterPartial = await (await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env)).json();
  assert.equal(afterPartial.products[0].name, 'Runner');
  assert.equal(afterPartial.store.email, 'hello@example.com');
  assert.equal(afterPartial.store.whatsapp_enabled, 1);
  assert.equal(afterPartial.store.whatsapp_url, 'https://wa.me/254700000000');
  assert.equal(afterPartial.store.location_name, 'Nairobi shop');
  assert.equal(afterPartial.store.color_theme, 'chromatic-studio');
  assert.equal(afterPartial.store.primary_color, '#5B5CF0');
  assert.equal(afterPartial.store.accent2_color, '#F06445');
  assert.equal(afterPartial.store.accent3_color, '#8FD14F');
  assert.equal(afterPartial.store.design_theme, 'quiet-lounge');
  assert.equal(afterPartial.products.length, 1);
  assert.equal(afterPartial.categories.length, 1);
  assert.match(result.updated_at, /^\d{4}-\d\d-\d\dT/);

  const workerDomainPublicCatalog = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/catalog'), env);
  assert.equal(workerDomainPublicCatalog.status, 200);
  const unauthenticatedPrivateRead = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/catalog?tenant=main&private=1'), env);
  assert.equal(unauthenticatedPrivateRead.status, 401);

  const privateResult = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/catalog?tenant=main&private=1', {
    headers: { Authorization: 'Bearer test-token' }
  }), env);
  const privateCatalog = await privateResult.json();
  assert.equal(privateCatalog.products[0].cost_price, 2);
  assert.deepEqual(privateCatalog.pages.map(page => page.slug), ['about', 'draft']);
});

test('catalog API provides CORS preflight and rejects oversized payloads', async () => {
  const env = { DB: createDatabase(), TENANTS: createTenantStore(), PUBLISH_TOKEN: 'test-token' };
  const options = await worker.fetch(new Request('https://shop.example/api/catalog', { method: 'OPTIONS' }), env);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(options.headers.get('Access-Control-Allow-Methods'), /DELETE/);

  const tooLarge = await worker.fetch(new Request('https://shop.example/api/catalog?tenant=main', {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ products: [], categories: [], padding: 'x'.repeat(910_000) })
  }), env);
  assert.equal(tooLarge.status, 413);
});

test('R2 media uploads require shop ownership and are publicly served from an isolated tenant prefix', async () => {
  const TENANTS = createTenantStore();
  const ownerToken = 'test-main-owner';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main',
    owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const objects = new Map();
  const env = {
    TENANTS,
    BUSINESS_ARCHIVE: {
      async put(key, value, options) { objects.set(key, { value, options }); },
      async get(key) {
        const object = objects.get(key);
        if (!object) return null;
        return {
          body: object.value,
          httpMetadata: object.options.httpMetadata
        };
      }
    }
  };
  const unauthorized = await worker.fetch(new Request('https://rrobin.co.ke/api/media?tenant=main', {
    method: 'POST',
    headers: { 'Content-Type': 'image/webp' },
    body: new Uint8Array([1, 2, 3])
  }), env);
  assert.equal(unauthorized.status, 401);

  const uploaded = await worker.fetch(new Request('https://rrobin.co.ke/api/media?tenant=main', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'image/webp'
    },
    body: new Uint8Array([1, 2, 3])
  }), env);
  assert.equal(uploaded.status, 200);
  const asset = await uploaded.json();
  assert.equal(asset.ok, true);
  assert.match(asset.url, /^https:\/\/rrobin\.co\.ke\/media\/main\/[a-f0-9-]{36}\.webp$/);
  const mediaKey = new URL(asset.url).pathname;
  const publicImage = await worker.fetch(new Request(asset.url), env);
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get('Content-Type'), 'image/webp');
  assert.equal(publicImage.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.deepEqual([...new Uint8Array(await publicImage.arrayBuffer())], [1, 2, 3]);

  const privateArchivePath = await worker.fetch(new Request('https://rrobin.co.ke/media/main/not-a-media-key.jpg'), env);
  assert.equal(privateArchivePath.status, 404);
  const unsupportedType = await worker.fetch(new Request('https://rrobin.co.ke/api/media?tenant=main', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  }), env);
  assert.equal(unsupportedType.status, 415);
  const oversized = await worker.fetch(new Request('https://rrobin.co.ke/api/media?tenant=main', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'image/webp'
    },
    body: new Uint8Array(3_000_001)
  }), env);
  assert.equal(oversized.status, 413);
  assert.match(mediaKey, /^\/media\/main\//);
});

test('R2 theme assets are publicly served from a theme-only prefix with safe cache headers', async () => {
  const objects = new Map([
    ['themes/woodora/index.html', {
      body: '<html>theme</html>',
      httpMetadata: { contentType: 'text/html; charset=utf-8' }
    }],
    ['themes/woodora/assets/hero.webp', {
      body: new Uint8Array([1, 2, 3]),
      httpMetadata: { contentType: 'image/webp' }
    }]
  ]);
  const env = { BUSINESS_ARCHIVE: { async get(key) { return objects.get(key) || null; } } };
  const page = await worker.fetch(new Request('https://shop.rrobin.co.ke/themes/woodora/index.html'), env);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(page.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(await page.text(), '<html>theme</html>');

  const image = await worker.fetch(new Request('https://shop.rrobin.co.ke/themes/woodora/assets/hero.webp'), env);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/webp');
  assert.equal(image.headers.get('Cache-Control'), 'public, max-age=86400');
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [1, 2, 3]);

  const traversal = await worker.fetch(new Request('https://shop.rrobin.co.ke/themes/woodora/%2e%2e/media/main/archive.json'), env);
  assert.equal(traversal.status, 404);
  const missing = await worker.fetch(new Request('https://shop.rrobin.co.ke/themes/woodora/missing.html'), env);
  assert.equal(missing.status, 404);
});

test('tenant records and product catalogs are isolated by wildcard subdomain', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    PUBLISH_TOKEN: 'test-token',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
  };
  const missingStore = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/api/catalog'), env);
  assert.equal(missingStore.status, 404);
  const anonymousCreate = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'anonymous-shop', name: 'Anonymous Shop' })
  }), env);
  assert.equal(anonymousCreate.status, 401);
  const account = await registerTestAccount(env);

  const created = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.session_token}` },
    body: JSON.stringify({ id: 'new-shop', name: 'New Shop' })
  }), env);
  assert.equal(created.status, 201);
  const createdShop = await created.json();
  assert.equal(createdShop.tenant.hostname, 'new-shop.rrobin.co.ke');
  assert.equal(typeof createdShop.owner_token, 'string');

  const published = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/api/catalog', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${createdShop.owner_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories: [{ id: 1, name: 'New Shop category' }],
      products: [{ id: 1, name: 'New Shop product', category_id: 1, price: 9 }],
      store: { name: 'New Shop' }
    })
  }), env);
  assert.equal(published.status, 200);

  const accountPublished = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/catalog?tenant=new-shop',
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${account.session_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: [{ id: 1, name: 'Updated category' }],
        products: [{ id: 1, name: 'Account-published product', category_id: 1, price: 12 }],
        store: { name: 'Updated Shop' }
      })
    }
  ), env);
  assert.equal(accountPublished.status, 200);
  const accountPublishedCatalog = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/api/catalog'), env);
  assert.equal((await accountPublishedCatalog.json()).products[0].name, 'Account-published product');

  const unrelatedSessionToken = 'unrelated-account-session';
  await env.TENANTS.put(
    `session:${await sha256HexForTest(unrelatedSessionToken)}`,
    JSON.stringify({ username: 'unrelated-owner' })
  );
  const unrelatedPublish = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/catalog?tenant=new-shop',
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${unrelatedSessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [], categories: [] })
    }
  ), env);
  assert.equal(unrelatedPublish.status, 404);

  const newShopCatalog = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/api/catalog'), env);
  assert.equal((await newShopCatalog.json()).products[0].name, 'Account-published product');
  const unauthorizedWrite = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/api/catalog', {
    method: 'PUT',
    headers: { Authorization: 'Bearer wrong-key', 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: [], categories: [] })
  }), env);
  assert.equal(unauthorizedWrite.status, 401);
  const privateCatalog = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/api/catalog?private=1', {
    headers: { Authorization: `Bearer ${createdShop.owner_token}` }
  }), env);
  assert.equal((await privateCatalog.json()).store.name, 'Updated Shop');
  const rootCatalog = await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env);
  assert.deepEqual(await rootCatalog.json(), { products: [], categories: [], store: {}, updated_at: null });

  const list = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    headers: { Authorization: 'Bearer test-token' }
  }), env);
  assert.deepEqual((await list.json()).tenants.map(tenant => tenant.id), ['main', 'new-shop']);

  const duplicate = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.session_token}` },
    body: JSON.stringify({ id: 'new-shop', name: 'Duplicate' })
  }), env);
  assert.equal(duplicate.status, 409);

  const unauthorizedDelete = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/new-shop', {
    method: 'DELETE'
  }), env);
  assert.equal(unauthorizedDelete.status, 401);

  const protectedMainDelete = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/main', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer test-token' }
  }), env);
  assert.equal(protectedMainDelete.status, 400);

  const deleted = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/new-shop', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${createdShop.owner_token}` }
  }), env);
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { ok: true, deleted_tenant_id: 'new-shop' });
  const deletedDomain = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/'), env);
  assert.equal(deletedDomain.status, 404);
});

test('account registration requires Turnstile once, while sign-in refreshes sessions without a challenge', async () => {
  const DB = createDatabase();
  const TENANTS = createTenantStore();
  const env = {
    DB,
    TENANTS,
    PUBLISH_TOKEN: 'test-token',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
  };
  const config = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/config'), env);
  assert.deepEqual(await config.json(), { turnstile_site_key: 'test-site-key' });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    if (String(input).includes('/turnstile/v0/siteverify')) return Response.json({ success: false });
    return originalFetch(input);
  };
  let invalidCaptcha;
  try {
    invalidCaptcha = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'new-owner',
        password: 'correct-horse-battery-staple',
        turnstile_token: 'invalid'
      })
    }), env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(invalidCaptcha.status, 403);

  const registered = await registerTestAccount(env, 'new-owner');
  assert.equal(typeof registered.session_token, 'string');
  const storedAccount = await DB.prepare('SELECT username FROM accounts WHERE username = ?').bind('new-owner').first();
  assert.equal(storedAccount.password_hash.includes('correct-horse'), false);
  assert.equal('password_hash' in registered, false);

  const created = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${registered.session_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'owner-shop', name: 'Owner Shop' })
  }), env);
  assert.equal(created.status, 201);
  const originalShop = await created.json();
  const storedTenant = await TENANTS.get('tenant:owner-shop', 'json');
  assert.equal(storedTenant.owner_username, 'new-owner');
  assert.notEqual(storedTenant.owner_token_hash, originalShop.owner_token);
  assert.ok(storedTenant.owner_token_hashes.includes(storedTenant.owner_token_hash));
  assert.equal('owner_token' in storedTenant, false);

  let loginTurnstileChecks = 0;
  globalThis.fetch = async input => {
    if (String(input).includes('/turnstile/v0/siteverify')) {
      loginTurnstileChecks += 1;
      return Response.json({ success: true });
    }
    return originalFetch(input);
  };
  try {
    const login = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'new-owner',
        password: 'correct-horse-battery-staple'
      })
    }), env);
    assert.equal(login.status, 200);
    assert.equal(loginTurnstileChecks, 0);
    const credentials = await login.json();
    assert.equal(credentials.tenants.length, 1);
    assert.equal(credentials.tenants[0].id, 'owner-shop');
    assert.notEqual(credentials.tenants[0].owner_token, originalShop.owner_token);
    const loginKeyWrite = await worker.fetch(new Request('https://owner-shop.rrobin.co.ke/api/catalog', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${credentials.tenants[0].owner_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [], categories: [] })
    }), env);
    assert.equal(loginKeyWrite.status, 200);
    const refreshedSession = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/session', {
      headers: { Authorization: `Bearer ${credentials.session_token}` }
    }), env);
    assert.deepEqual(await refreshedSession.json(), {
      ok: true, username: 'new-owner', tenants: [{ id: 'owner-shop', name: 'Owner Shop' }]
    });
    const expiredSession = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/session'), env);
    assert.equal(expiredSession.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('main shop can exchange the master key for an app-local owner key', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    PUBLISH_TOKEN: 'test-token'
  };
  const provisioned = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/main/owner-key', {
    method: 'PUT',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: '{}'
  }), env);
  assert.equal(provisioned.status, 200);
  const credentials = await provisioned.json();
  assert.equal(typeof credentials.owner_token, 'string');
  assert.equal('owner_token_hash' in credentials.tenant, false);

  const privateCatalog = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/catalog?tenant=main&private=1', {
    headers: { Authorization: `Bearer ${credentials.owner_token}` }
  }), env);
  assert.equal(privateCatalog.status, 200);

  const repeatedProvision = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/main/owner-key', {
    method: 'PUT',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: '{}'
  }), env);
  assert.equal(repeatedProvision.status, 409);
});

test('an admin can recover one shop key after a legacy signup without exposing the master key', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    PUBLISH_TOKEN: 'test-token',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
  };
  const account = await registerTestAccount(env, 'legacy-user');
  const created = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.session_token}` },
    body: JSON.stringify({ id: 'legacy-shop', name: 'Legacy Shop' })
  }), env);
  const original = await created.json();

  const unauthorized = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/legacy-shop/owner-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }), env);
  assert.equal(unauthorized.status, 401);

  const recovered = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/legacy-shop/owner-key', {
    method: 'PUT',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: '{}'
  }), env);
  const recovery = await recovered.json();
  assert.equal(recovered.status, 200);
  assert.notEqual(recovery.owner_token, original.owner_token);
  assert.equal('owner_token_hash' in recovery.tenant, false);

  const oldKey = await worker.fetch(new Request('https://legacy-shop.rrobin.co.ke/api/catalog', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${original.owner_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: [], categories: [] })
  }), env);
  assert.equal(oldKey.status, 401);

  const newKey = await worker.fetch(new Request('https://legacy-shop.rrobin.co.ke/api/catalog', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${recovery.owner_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: [], categories: [] })
  }), env);
  assert.equal(newKey.status, 200);
});
