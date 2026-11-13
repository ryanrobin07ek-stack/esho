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
              if (query.includes("FROM main_store_inventory")) return null;
              if (query.includes("FROM accounts WHERE email")) {
                return [...accounts.values()].find(account => account.email === values[0]
                  && (!query.includes("username !=") || account.username !== values[1])) || null;
              }
              if (query.includes("FROM accounts")) return accounts.get(values[0]) || null;
              if (query.includes("FROM account_tenants")) {
                if (query.includes("WHERE tenant_id = ?")) {
                  return accountTenants.find(row => row.tenant_id === values[0]) || null;
                }
                return accountTenants.find(row => row.username === values[0] && row.tenant_id === values[1])
                  ? { owned: 1 }
                  : null;
              }
              throw new Error(`Unsupported first query: ${query}`);
            },
            async all() {
              if (query.includes("FROM inventory_stock")) return { results: [] };
              if (query.includes("FROM main_store_inventory")) return { results: [] };
              if (query.includes("FROM account_tenants")) {
                return { results: accountTenants.filter(row => row.username === values[0]) };
              }
              throw new Error(`Unsupported all query: ${query}`);
            },
            async run() {
              if (query.includes("INSERT OR IGNORE INTO accounts")) {
                if (accounts.has(values[0])) return { success: true, meta: { changes: 0 } };
                if ([...accounts.values()].some(account => account.email === values[3])) {
                  return { success: true, meta: { changes: 0 } };
                }
                accounts.set(values[0], {
                  username: values[0],
                  password_salt: values[1],
                  password_hash: values[2],
                  email: values[3],
                  created_at: values[4]
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("UPDATE accounts SET password_salt")) {
                const account = accounts.get(values[2]);
                if (!account) return { success: true, meta: { changes: 0 } };
                account.password_salt = values[0];
                account.password_hash = values[1];
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("UPDATE accounts SET email")) {
                const account = accounts.get(values[1]);
                if (!account) return { success: true, meta: { changes: 0 } };
                account.email = values[0];
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
  const holds = new Map();
  const interests = new Map();
  const dailyEvents = new Map();
  const paystackSubaccounts = new Map();
  const paystackOwnerDefaults = new Map();
  const catalogUpdatedAt = '2026-01-02T03:04:05.000Z';
  const catalog = {
    store: { currency: 'KES', hold_duration_hours: 36 },
    products: [{ id: 7, name: 'Canvas Tote', sku: 'TOTE-7', price: 12.5, stock: 8, booking_enabled: true }]
  };
  return {
    orders,
    holds,
    interests,
    dailyEvents,
    catalog,
    catalogUpdatedAt,
    paystackSubaccounts,
    paystackOwnerDefaults,
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes('FROM storefront_hold_requests') && query.includes('SUM(quantity)')) {
                const reserved = [...holds.values()].filter(row => row.tenant_id === values[0]
                  && row.product_id === values[1] && row.status === 'approved' && row.expires_at > values[2])
                  .reduce((sum, row) => sum + row.quantity, 0);
                return { quantity: reserved };
              }
              if (query.includes('FROM catalog_snapshots')) {
                return { payload: JSON.stringify(catalog), updated_at: catalogUpdatedAt };
              }
              if (query.includes('FROM main_store_inventory')) return null;
              if (query.includes('FROM storefront_hold_requests') && query.includes('idempotency_key=?')) {
                return [...holds.values()].find(row => row.tenant_id === values[0] && row.idempotency_key === values[1]) || null;
              }
              if (query.includes('FROM storefront_hold_requests') && query.includes('id=?')) {
                return holds.get(values[1])?.tenant_id === values[0] ? holds.get(values[1]) : null;
              }
              if (query.includes('FROM paystack_owner_defaults defaults')) {
                const selected = paystackOwnerDefaults.get(values[0]);
                return selected ? paystackSubaccounts.get(selected.source_tenant_id) || null : null;
              }
              if (query.includes('FROM paystack_subaccounts')) return paystackSubaccounts.get(values[0]) || null;
              if (query.includes('FROM storefront_orders') && query.includes('WHERE tenant_id=? AND idempotency_key=?')) {
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
              if (query.includes('FROM main_store_inventory')) return { results: [] };
              if (query.includes('FROM storefront_hold_requests')) {
                return { results: [...holds.values()].filter(row => row.tenant_id === values[0]) };
              }
              if (query.includes('FROM storefront_product_interest')) {
                const since = values[0];
                const tenantId = values[2];
                const own = [...interests.values()].filter(row => row.tenant_id === tenantId);
                const grouped = new Map();
                for (const item of own) {
                  const current = grouped.get(item.product_id) || { product_id: item.product_id, cart_quantity: 0, wishlist_count: 0 };
                  if (item.cart_updated_at >= since) current.cart_quantity += item.cart_quantity;
                  if (item.wishlist_updated_at >= values[1] && item.wishlist_active) current.wishlist_count += 1;
                  grouped.set(item.product_id, current);
                }
                return { results: [...grouped.values()] };
              }
              if (query.includes('FROM storefront_orders')) {
                return { results: [...orders.values()].filter(row => row.tenant_id === values[0]) };
              }
              throw new Error(`Unsupported order list query: ${query}`);
            },
            async run() {
              if (query.includes('INSERT INTO storefront_event_daily')) {
                const [tenant_id, day, product_id, requestedTenant, holdId] = values;
                const hold = holds.get(holdId);
                if (hold?.tenant_id === requestedTenant && tenant_id === requestedTenant) {
                  const key = `${tenant_id}:${day}:${product_id}:booking`;
                  const row = dailyEvents.get(key) || {
                    tenant_id, day, product_id, event_type: 'booking', n: 0
                  };
                  row.n += 1;
                  dailyEvents.set(key, row);
                }
                return { meta: { changes: hold ? 1 : 0 } };
              }
              if (query.includes('INSERT INTO storefront_product_interest')) {
                const key = `${values[0]}:${values[1]}:${values[2]}`;
                const row = interests.get(key) || {
                  tenant_id: values[0], visitor_hash: values[1], product_id: values[2],
                  cart_quantity: 0, cart_updated_at: '', wishlist_active: 0,
                  wishlist_updated_at: '', created_at: values.at(-2)
                };
                if (query.includes('cart_quantity=excluded.cart_quantity')) {
                  row.cart_quantity = values[3];
                  row.cart_updated_at = values[4];
                  row.updated_at = values[6];
                } else {
                  row.wishlist_active = values[3];
                  row.wishlist_updated_at = values[4];
                  row.updated_at = values[6];
                }
                interests.set(key, row);
                return { meta: { changes: 1 } };
              }
              if (query.includes('INSERT OR IGNORE INTO storefront_hold_requests')) {
                const [id, tenant_id, idempotency_key, product_id, product_name, quantity, customer_name,
                  contact, created_at, updated_at, approved_at, expires_at, requestedQuantity,
                  reservedTenant, reservedProduct, now, stock] = values;
                if ([...holds.values()].some(row => row.tenant_id === tenant_id && row.idempotency_key === idempotency_key)) {
                  return { meta: { changes: 0 } };
                }
                const reserved = [...holds.values()].filter(row => row.tenant_id === reservedTenant
                  && row.product_id === reservedProduct && row.status === 'approved' && row.expires_at > now)
                  .reduce((sum, row) => sum + row.quantity, 0);
                if (requestedQuantity + reserved > stock) return { meta: { changes: 0 } };
                holds.set(id, {
                  id, tenant_id, idempotency_key, product_id, product_name, quantity, customer_name, contact,
                  status: 'approved', created_at, updated_at, approved_at, expires_at, released_at: ''
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes("UPDATE storefront_hold_requests SET status='released'")) {
                const [released_at, updated_at, tenant_id, id] = values;
                const hold = holds.get(id);
                if (!hold || hold.tenant_id !== tenant_id || hold.status !== 'approved') return { meta: { changes: 0 } };
                Object.assign(hold, { status: 'released', released_at, updated_at });
                return { meta: { changes: 1 } };
              }
              if (query.includes("UPDATE storefront_hold_requests SET status='approved'")) {
                const [approved_at, expires_at, updated_at, tenant_id, id, requestedQuantity,
                  reservedTenant, product_id, now, stock] = values;
                const hold = holds.get(id);
                const reserved = [...holds.values()].filter(item => item.tenant_id === reservedTenant
                  && item.product_id === product_id && item.status === 'approved' && item.expires_at > now)
                  .reduce((sum, item) => sum + item.quantity, 0);
                if (!hold || hold.tenant_id !== tenant_id || hold.status !== 'pending' || requestedQuantity + reserved > stock) {
                  return { meta: { changes: 0 } };
                }
                Object.assign(hold, { status: 'approved', approved_at, expires_at, updated_at });
                return { meta: { changes: 1 } };
              }
              if (query.includes('UPDATE storefront_hold_requests SET status=?,released_at=')) {
                const [status, released_at, updated_at, tenant_id, id, previousStatus] = values;
                const hold = holds.get(id);
                if (!hold || hold.tenant_id !== tenant_id || hold.status !== previousStatus) return { meta: { changes: 0 } };
                Object.assign(hold, { status, released_at, updated_at });
                return { meta: { changes: 1 } };
              }
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
      body: JSON.stringify({ username, password, email: `${username}@example.com`, turnstile_token: 'test-turnstile-token' })
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
  const interests = new Map();
  const dailyEvents = new Map();
  const accountTenants = [];
  return {
    changes,
    visits,
    interests,
    dailyEvents,
    accountTenants,
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
    prepare(query) {
      return {
        bind(...values) {
          return {
            async run() {
              if (query.includes('INSERT INTO storefront_event_daily')) {
                const [tenant_id, day, product_id, event_type, n] = values;
                const key = `${tenant_id}:${day}:${product_id}:${event_type}`;
                const row = dailyEvents.get(key) || { tenant_id, day, product_id, event_type, n: 0 };
                row.n += n;
                dailyEvents.set(key, row);
                return { meta: { changes: 1 } };
              }
              if (query.includes('INSERT INTO storefront_product_interest')) {
                const key = `${values[0]}:${values[1]}:${values[2]}`;
                const row = interests.get(key) || {
                  tenant_id: values[0], visitor_hash: values[1], product_id: values[2],
                  cart_quantity: 0, cart_updated_at: '', wishlist_active: 0,
                  wishlist_updated_at: '', created_at: values[5]
                };
                if (query.includes('cart_quantity=excluded.cart_quantity')) {
                  Object.assign(row, { cart_quantity: values[3], cart_updated_at: values[4], updated_at: values[6] });
                } else {
                  Object.assign(row, { wishlist_active: values[3], wishlist_updated_at: values[4], updated_at: values[6] });
                }
                interests.set(key, row);
                return { success: true };
              }
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
              if (query.includes('FROM catalog_snapshots')) {
                return {
                  payload: JSON.stringify({ products: [{ id: 7, slug: 'tote', name: 'Canvas Tote', price: 25, stock: 8 }] }),
                  updated_at: '2025-01-02T03:04:05.000Z'
                };
              }
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
              if (query.includes('FROM storefront_event_daily')) {
                const grouped = new Map();
                for (const item of dailyEvents.values()) {
                  if (item.tenant_id !== values[0] || item.day < values[1]) continue;
                  const row = grouped.get(item.product_id) || {
                    product_id: item.product_id, views: 0, wishlist_adds: 0, cart_adds: 0, bookings: 0
                  };
                  if (item.event_type === 'view') row.views += item.n;
                  if (item.event_type === 'wishlist_add') row.wishlist_adds += item.n;
                  if (item.event_type === 'cart_add') row.cart_adds += item.n;
                  if (item.event_type === 'booking') row.bookings += item.n;
                  grouped.set(item.product_id, row);
                }
                return { results: [...grouped.values()] };
              }
              if (query.includes('SELECT path, device, created_at FROM storefront_visits')) {
                return {
                  results: visits
                    .filter(item => item.tenant_id === values[0] && item.created_at >= values[1])
                    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
                    .slice(0, 50)
                    .map(({ path, device, created_at }) => ({ path, device, created_at }))
                };
              }
              if (query.includes('FROM storefront_product_interest')) {
                const since = values[0];
                const tenantId = values[2];
                const grouped = new Map();
                for (const item of interests.values()) {
                  if (item.tenant_id !== tenantId) continue;
                  const current = grouped.get(item.product_id) || { product_id: item.product_id, cart_quantity: 0, wishlist_count: 0 };
                  if (item.cart_updated_at >= since) current.cart_quantity += item.cart_quantity;
                  if (item.wishlist_updated_at >= values[1] && item.wishlist_active) current.wishlist_count += 1;
                  grouped.set(item.product_id, current);
                }
                return { results: [...grouped.values()] };
              }
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
              if (query.includes('FROM main_store_inventory')) return { results: [] };
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

test('unpublished tenant storefronts never fall back to the shared seeded catalog', async () => {
  const updatedAt = '2026-10-23T00:00:00.000Z';
  let fetchedSharedAsset = false;
  const response = await worker.fetch(new Request('https://fogo.rrobin.co.ke/'), {
    TENANTS: {
      async get(key) {
        return key === 'tenant:fogo'
          ? { id: 'fogo', name: 'Fogo', catalog_updated_at: updatedAt }
          : null;
      }
    },
    DB: {
      prepare(query) {
        assert.match(query, /SELECT payload, updated_at FROM catalog_snapshots/);
        return {
          bind(tenantId) {
            assert.equal(tenantId, 'fogo');
            return {
              async first() {
                return {
                  payload: JSON.stringify({
                    products: [],
                    categories: [],
                    store: { name: 'Fogo' }
                  }),
                  updated_at: updatedAt
                };
              }
            };
          }
        };
      }
    },
    ASSETS: {
      async fetch() {
        fetchedSharedAsset = true;
        return new Response('<h1>Chapa demo catalog</h1>');
      }
    }
  });

  assert.equal(response.status, 503);
  assert.match(await response.text(), /This website has not been published yet/);
  assert.equal(fetchedSharedAsset, false);
});

test('Cloudflare Worker serves the official Craft homepage on the main domain', async () => {
  let assetPath;
  const response = await worker.fetch(new Request('https://rrobin.co.ke/'), {
    ASSETS: {
      async fetch(request) {
        assetPath = new URL(request.url).pathname;
        return new Response('<title>Craft official home</title>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  });

  assert.equal(response.status, 200);
  assert.equal(assetPath, '/official-site/index.html');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
  const html = await response.text();
  assert.match(html, /Craft official home/);
  assert.doesNotMatch(html, /storefront-analytics\.js/);
});

test('Cloudflare Worker retires old main storefront URLs without changing shop subdomains', async () => {
  const response = await worker.fetch(new Request('https://rrobin.co.ke/product/old-product'), {
    ASSETS: {
      async fetch() {
        throw new Error('A retired main storefront URL must not fall through to old assets.');
      }
    }
  });

  assert.equal(response.status, 404);
  assert.match(await response.text(), /old main storefront has been retired/i);
});

test('Cloudflare Worker serves only the filled published theme at the shop root', async () => {
  const themeId = 'cira-atelier-event-architecture-management';
  const updatedAt = '2026-10-15T07:00:00.000Z';
  const key = `published-sites/main/${themeId}/20261015070000000.html`;
  const publishedHtml = `<!doctype html><html><head><meta name="eshop-filled-theme" content="${themeId}"></head><body><main><h1>Filled shop theme</h1></main></body></html>`;
  let assetPath;
  const DB = {
    prepare(query) {
      assert.match(query, /SELECT payload, updated_at FROM catalog_snapshots/);
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
                  products: [{ id: 12, slug: 'green-tea', name: '</script><script>alert(1)</script>', category_id: 4, price: 35 }],
                  categories: [{ id: 4, name: 'Owner category', slug: 'owner-category' }],
                  pages: [{ slug: 'about', title: 'About', content: 'About this shop.' }]
                }),
                updated_at: updatedAt
              };
            }
          };
        }
      };
    }
  };
  const env = {
    TENANTS: {
      async get(name) {
        if (name === 'tenant:main') return { id: 'main', name: 'Main shop', catalog_updated_at: updatedAt };
        if (name === 'published-theme:main') {
          return { key, themeId, catalogUpdatedAt: updatedAt };
        }
        return null;
      },
      async put() {}
    },
    DB,
    BUSINESS_ARCHIVE: {
      async put() {},
      async get(key) {
        assetPath = key;
        return {
          body: publishedHtml,
          httpMetadata: { contentType: 'text/html; charset=utf-8' },
          customMetadata: { themeId, catalogUpdatedAt: updatedAt }
        };
      }
    },
    ASSETS: {
      async fetch() {
        throw new Error('The shared storefront must not be loaded for a published theme.');
      }
    }
  };
  const response = await worker.fetch(new Request('https://shop.example/products/green-tea'), env);

  assert.equal(response.status, 200);
  assert.equal(assetPath, key);
  const html = await response.text();
  assert.match(html, /Filled shop theme/);
  assert.match(html, /window\.__ESHOP_CLOUDFLARE_STOREFRONT__=true/);
  assert.match(html, /craft-storefront-cloudflare\.js/);
  assert.match(html, /storefront-analytics\.js\?v=events-1/);
  assert.match(html, /#7C3AED/);
  assert.match(html, /Updated \\u003cscript>alert\(1\)\\u003c\/script> heading/);
  assert.match(html, /d\.querySelector\(edit\.selector\)/);
  assert.match(html, /window\.__ESHOP_THEME_CATALOG__=/);
  assert.doesNotMatch(html, /fetch\("\/api\/catalog/);
  assert.match(html, /script\.src="\/theme-catalog-adapter\.js\?v=commerce-3"/);
  assert.match(html, /storefront-analytics\.js\?v=events-1/);
  assert.doesNotMatch(html, /name":"<\/script><script>alert\(1\)<\/script>/);
  assert.match(html, /"accent2Color":"#F06445"/);
  assert.match(html, /"accent3Color":"#8FD14F"/);
  assert.match(html, /--eshop-accent-gradient:linear-gradient\(110deg,/);
  assert.match(html, /background-image:linear-gradient\(110deg,/);
  assert.match(html, /displayFontFamily/);
  assert.match(html, /shape==="rounded"\?"16px"/);
  assert.match(html, /fonts\.googleapis\.com/);
  assert.doesNotMatch(html, /mobile_card_layout/);
  for (const path of ['/categories/owner-category', '/pages/about', '/search?q=tea', '/cart', '/checkout', '/account']) {
    const page = await worker.fetch(new Request(`https://shop.example${path}`), env);
    assert.equal(page.status, 200, `The published storefront should load directly at ${path}.`);
  }
});

test('Cloudflare Worker upgrades existing Litrus exports to refresh their live catalog', async () => {
  const updatedAt = '2026-11-11T09:00:00.000Z';
  const themeId = 'litrus-mixer';
  const key = `published-sites/main/${themeId}/current.html`;
  const catalog = {
    store: { name: 'Main shop', website_theme_id: themeId },
    products: [{ id: 8, name: 'Canvas bag', price: 2500, images: ['https://cdn.test/bag.webp'] }],
    categories: [{ id: 4, name: 'Bags' }]
  };
  const legacyHtml = '<!doctype html><html><head><title>Old Litrus</title></head><body><div id="store"></div><script>var SPD={"shop":{"key":"main","products":[]},"pages":{},"shell":{}};function SPRT(){};(function(){var R=document.getElementById("store");SPRT({root:R,hash:true,shop:function(){return SPD.shop},page:function(r){return SPD.pages[r]==null?null:SPD.pages[r]},shell:function(){return SPD.shell},scrollTop:function(){scrollTo(0,0)}})})();</script></body></html>';
  const DB = {
    prepare(query) {
      assert.match(query, /SELECT payload, updated_at FROM catalog_snapshots/);
      return { bind() { return { async first() { return { payload: JSON.stringify(catalog), updated_at: updatedAt }; } }; } };
    }
  };
  const TENANTS = createTenantStore();
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', name: 'Main shop', catalog_updated_at: updatedAt
  }));
  await TENANTS.put(`published-theme:main`, JSON.stringify({
    key, themeId, catalogUpdatedAt: updatedAt
  }));
  const env = {
    DB,
    TENANTS,
    BUSINESS_ARCHIVE: {
      async put() {},
      async get(requestedKey) {
        assert.equal(requestedKey, key);
        return {
          body: legacyHtml,
          httpMetadata: { contentType: 'text/html; charset=utf-8' },
          customMetadata: { themeId, catalogUpdatedAt: updatedAt }
        };
      }
    },
    ASSETS: { async fetch() { throw new Error('A published Litrus store must be served from R2.'); } }
  };

  const response = await worker.fetch(new Request('https://shop.example/'), env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /src="\/litrus-mixer\/live-catalog\.js"/);
  assert.match(html, /litrusStartLiveStore\(SPD\);/);
  assert.doesNotMatch(html, /SPRT\(\{root:R/);
});

test('published storefront HTML is cached by host and catalog version without repeat D1 or R2 reads', async () => {
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  const cacheEntries = new Map();
  const cacheKeys = [];
  let cacheMatchCount = 0;
  globalThis.caches = {
    default: {
      async match(request) {
        cacheMatchCount += 1;
        return cacheEntries.get(request.url)?.clone() || undefined;
      },
      async put(request, response) {
        cacheKeys.push(request.url);
        cacheEntries.set(request.url, response.clone());
      }
    }
  };
  let catalogUpdatedAt = '2026-10-14T09:29:36.380Z';
  let catalogReads = 0;
  let themeReads = 0;
  const themeId = 'cira-atelier-event-architecture-management';
  const tenant = { id: 'rayoo', name: 'Rayoo', catalog_updated_at: catalogUpdatedAt };
  const env = {
    TENANTS: {
      async get(key, type) {
        assert.equal(type, 'json');
        if (key === 'tenant:rayoo') return { ...tenant, catalog_updated_at: catalogUpdatedAt };
        if (key === 'published-theme:rayoo') return {
          key: `published-sites/rayoo/${themeId}/${catalogUpdatedAt.replace(/[^a-zA-Z0-9-]/g, '')}.html`,
          themeId,
          catalogUpdatedAt
        };
        return null;
      },
      async put(key, value) {
        assert.equal(key, 'tenant:rayoo');
        Object.assign(tenant, JSON.parse(value));
      }
    },
    DB: {
      prepare(query) {
        assert.match(query, /SELECT payload, updated_at FROM catalog_snapshots/);
        return {
          bind(id) {
            assert.equal(id, 'rayoo');
            return {
              async first() {
                catalogReads += 1;
                return {
                  payload: JSON.stringify({
                    store: { website_theme_id: themeId },
                    products: [{ id: 1, name: `version-${catalogReads}` }],
                    categories: []
                  }),
                  updated_at: catalogUpdatedAt
                };
              }
            };
          }
        };
      }
    },
    BUSINESS_ARCHIVE: {
      async put() {},
      async get(key) {
        themeReads += 1;
        assert.equal(key, `published-sites/rayoo/${themeId}/${catalogUpdatedAt.replace(/[^a-zA-Z0-9-]/g, '')}.html`);
        return {
          body: `<!doctype html><html><head><meta name="eshop-filled-theme" content="${themeId}"></head><body>version-${catalogReads}</body></html>`,
          customMetadata: { themeId, catalogUpdatedAt }
        };
      }
    },
    ASSETS: { async fetch() { throw new Error('A published theme must come from R2.'); } }
  };
  try {
    const request = () => new Request('https://rayoo.rrobin.co.ke/');
    const first = await worker.fetch(request(), env);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('Cache-Control'), 'public, max-age=60');
    assert.match(await first.text(), /version-1/);
    const second = await worker.fetch(request(), env);
    assert.equal(second.status, 200);
    assert.match(await second.text(), /version-1/);
    assert.equal(catalogReads, 1);
    assert.equal(themeReads, 1);
    assert.equal(cacheMatchCount, 2);
    assert.match(cacheKeys[0], /rayoo\.rrobin\.co\.ke/);
    assert.match(cacheKeys[0], /2026-10-14T09%3A29%3A36\.380Z/);
    assert.equal(cacheEntries.get(cacheKeys[0]).headers.get('Cache-Control'), 'public, max-age=3600');

    catalogUpdatedAt = '2026-10-14T10:29:36.380Z';
    const afterPublish = await worker.fetch(request(), env);
    assert.match(await afterPublish.text(), /version-2/);
    assert.equal(catalogReads, 2);
    assert.equal(themeReads, 2);
    assert.equal(cacheKeys.length, 2);
  } finally {
    if (originalCaches) Object.defineProperty(globalThis, 'caches', originalCaches);
    else delete globalThis.caches;
  }
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

test('Main Store allocations require owner authorization and exact channel totals', async () => {
  const saved = new Map();
  const DB = {
    prepare(query) {
      return {
        bind(...values) {
          return {
            query, values,
            async all() { return { results: [...saved.values()] }; }
          };
        }
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        if (!statement.query.includes('INSERT INTO main_store_inventory')) continue;
        const values = statement.values;
        saved.set(values[1], {
          sku: values[1], product_id: values[2], product_name: values[3],
          source_channel: values[4], pos_enabled: values[5], web_enabled: values[6],
          master_stock: values[7], pos_stock: values[8], web_stock: values[9],
          reserved_stock: values[10], updated_at: values[11]
        });
      }
    }
  };
  const TENANTS = createTenantStore();
  const ownerToken = 'allocation-owner';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ownerToken));
  const ownerHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  await TENANTS.put('tenant:main', JSON.stringify({ id: 'main', owner_token_hash: ownerHash }));
  const env = { DB, TENANTS };
  const request = (method, body, authorized = true) => worker.fetch(new Request(
    'https://rrobin.co.ke/api/inventory/allocations?tenant=main',
    {
      method,
      headers: {
        ...(authorized ? { Authorization: `Bearer ${ownerToken}` } : {}),
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    }
  ), env);
  assert.equal((await request('PUT', { allocations: [{
    sku: 'SKU-1', product_name: 'Product', source_channel: 'both',
    pos_enabled: true, web_enabled: true, master_stock: 10,
    pos_stock: 4, web_stock: 4, reserved_stock: 1
  }] }, false)).status, 401);
  assert.equal((await request('PUT', { allocations: [{
    sku: 'SKU-1', product_name: 'Product', source_channel: 'both',
    pos_enabled: true, web_enabled: true, master_stock: 10,
    pos_stock: 4, web_stock: 4, reserved_stock: 1
  }] })).status, 400);
  const savedResponse = await request('PUT', { allocations: [{
    sku: 'SKU-1', product_name: 'Product', source_channel: 'both',
    pos_enabled: true, web_enabled: true, master_stock: 10,
    pos_stock: 4, web_stock: 4, reserved_stock: 2
  }] });
  assert.equal(savedResponse.status, 200);
  assert.equal((await request('GET')).status, 200);
  assert.equal(saved.get('SKU-1').master_stock, 10);
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

test('Main Store allocation migration keeps POS, Web and reserved stock exact across sales', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  try {
    db.exec(await readFile(new URL('../cloudflare/migrations/0005_shared_inventory.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0018_storefront_interest_holds.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0020_main_store_allocations.sql', import.meta.url), 'utf8'));
    db.run("INSERT INTO main_store_inventory (tenant_id,sku,source_channel,pos_enabled,web_enabled,master_stock,pos_stock,web_stock,reserved_stock,updated_at) VALUES ('shop','SKU-1','both',1,1,10,3,5,2,'now')");
    db.run("INSERT INTO inventory_stock (tenant_id,sku,stock,updated_at) VALUES ('shop','SKU-1',3,'now')");
    db.run("INSERT INTO inventory_events (tenant_id,event_id,created_at) VALUES ('shop','POS-1','now')");
    db.run("INSERT INTO inventory_event_items (tenant_id,event_id,sku,quantity) VALUES ('shop','POS-1','SKU-1',2)");
    let allocation = db.exec("SELECT master_stock,pos_stock,web_stock,reserved_stock FROM main_store_inventory WHERE tenant_id='shop'")[0].values[0];
    assert.deepEqual(allocation, [8, 1, 5, 2]);
    assert.equal(db.exec("SELECT stock FROM inventory_stock WHERE tenant_id='shop' AND sku='SKU-1'")[0].values[0][0], 1);
    db.run("UPDATE inventory_stock SET stock=2,updated_at='restock' WHERE tenant_id='shop' AND sku='SKU-1'");
    allocation = db.exec("SELECT master_stock,pos_stock,web_stock,reserved_stock FROM main_store_inventory WHERE tenant_id='shop'")[0].values[0];
    assert.deepEqual(allocation, [9, 2, 5, 2]);
    db.run("UPDATE inventory_stock SET stock=1,updated_at='count' WHERE tenant_id='shop' AND sku='SKU-1'");
    db.run("INSERT INTO storefront_inventory_deductions (tenant_id,order_number,product_id,sku,quantity,created_at) VALUES ('shop','ORD-1','7','SKU-1',2,'now')");
    allocation = db.exec("SELECT master_stock,pos_stock,web_stock,reserved_stock FROM main_store_inventory WHERE tenant_id='shop'")[0].values[0];
    assert.deepEqual(allocation, [6, 1, 3, 2]);
    db.run("INSERT OR IGNORE INTO storefront_inventory_deductions (tenant_id,order_number,product_id,sku,quantity,created_at) VALUES ('shop','ORD-1','7','SKU-1',2,'now')");
    assert.equal(db.exec("SELECT master_stock FROM main_store_inventory WHERE tenant_id='shop'")[0].values[0][0], 6);
    db.run("INSERT INTO storefront_hold_requests (id,tenant_id,idempotency_key,product_id,product_name,quantity,customer_name,contact,status,created_at,updated_at,expires_at) VALUES ('hold-1','shop','hold-key','7','Product',2,'Sam','sam@example.test','approved','now','now','9999-01-01T00:00:00.000Z')");
    assert.throws(() => db.run("INSERT INTO storefront_inventory_deductions (tenant_id,order_number,product_id,sku,quantity,created_at) VALUES ('shop','ORD-2','7','SKU-1',2,'2026-01-01T00:00:00.000Z')"), /insufficient_web_allocation/);
    assert.equal(db.exec("SELECT master_stock FROM main_store_inventory WHERE tenant_id='shop'")[0].values[0][0], 6);
    db.run("INSERT INTO main_store_inventory (tenant_id,sku,source_channel,pos_enabled,web_enabled,master_stock,pos_stock,web_stock,reserved_stock,updated_at) VALUES ('other','SKU-1','web',0,1,9,0,9,0,'now')");
    assert.equal(db.exec("SELECT master_stock FROM main_store_inventory WHERE tenant_id='other'")[0].values[0][0], 9);
    db.run("INSERT INTO inventory_stock (tenant_id,sku,stock,updated_at) VALUES ('other','SKU-1',0,'now')");
    assert.throws(() => db.run("UPDATE inventory_stock SET stock=1 WHERE tenant_id='other' AND sku='SKU-1'"), /pos_channel_not_allocated/);
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
  const catalogUpdatedAt = '2025-01-02T03:04:05.000Z';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  await TENANTS.put('published-theme:main', JSON.stringify({
    key: 'published-sites/main/litrus-main/current.html',
    themeId: 'litrus-main',
    catalogUpdatedAt
  }));
  const env = {
    DB,
    TENANTS,
    BUSINESS_ARCHIVE: {
      async get() {
        return {
          body: '<script>var SPD = {"shop":{"key":"litrus-main","products":[{"id":"tote-1","name":"Canvas Tote","price":25}]}};</script>'
        };
      }
    }
  };
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
    body: JSON.stringify({ visitor_id: 'anonymous-browser-123', path: '/p/tote-1?email=private@example.test', referrer: 'https://search.example/results?query=secret' })
  });
  Object.defineProperty(visitRequest, 'cf', { value: { country: 'KE', regionCode: '30' } });
  const visitResponse = await worker.fetch(visitRequest, env);
  assert.equal(visitResponse.status, 202);
  assert.equal(DB.visits.length, 1);
  assert.equal(DB.visits[0].path, '/p/tote-1');
  assert.equal(DB.visits[0].country, 'KE');
  assert.equal(DB.visits[0].region, '30');
  assert.equal(DB.visits[0].device, 'mobile');
  assert.equal(DB.visits[0].visitor_hash.includes('anonymous-browser-123'), false);
  assert.equal('ip' in DB.visits[0], false);
  const productInterestBase = 'https://eshop-storefront.workers.dev/api/product-interest?tenant=main';
  const cartActivity = await worker.fetch(new Request(productInterestBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor_id: 'anonymous-browser-123', product_id: 'tote-1', action: 'cart', quantity: 2 })
  }), env);
  assert.equal(cartActivity.status, 202);
  const wishlistActivity = await worker.fetch(new Request(productInterestBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor_id: 'anonymous-browser-123', product_id: 7, action: 'wishlist', saved: true })
  }), env);
  assert.equal(wishlistActivity.status, 202);
  assert.equal(DB.interests.size, 1);
  assert.equal([...DB.interests.values()][0].visitor_hash.includes('anonymous-browser-123'), false);
  const eventAnalyticsUrl = 'https://eshop-storefront.workers.dev/api/analytics/events?tenant=main';
  const eventBatch = await worker.fetch(new Request(eventAnalyticsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [
      { product_id: 'tote-1', type: 'view', n: 2 },
      { product_id: 'tote-1', type: 'view', n: 1 },
      { product_id: 7, type: 'cart_add', n: 3 },
      { product_id: 7, type: 'wishlist_add', n: 2 }
    ] })
  }), env);
  assert.equal(eventBatch.status, 202);
  assert.equal((await eventBatch.json()).accepted, 3);
  const otherTenantBatch = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/analytics/events?tenant=another-shop',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ product_id: 7, type: 'view', n: 9 }] })
    }
  ), env);
  assert.equal(otherTenantBatch.status, 202);
  const invalidEventBatch = await worker.fetch(new Request(eventAnalyticsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ product_id: 7, type: 'booking', n: 1 }] })
  }), env);
  assert.equal(invalidEventBatch.status, 400);
  const unauthenticatedEventAnalytics = await worker.fetch(new Request(eventAnalyticsUrl), env);
  assert.equal(unauthenticatedEventAnalytics.status, 401);
  const crossTenantAnalytics = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/analytics/events?tenant=another-shop',
    { headers: authorization }
  ), env);
  assert.equal(crossTenantAnalytics.status, 401);
  const eventAnalytics = await worker.fetch(new Request(eventAnalyticsUrl, {
    headers: authorization
  }), env);
  assert.equal(eventAnalytics.status, 200);
  const eventReport = await eventAnalytics.json();
  assert.deepEqual(eventReport.product_activity, [
    { product_id: 'tote-1', views: 3, wishlist_adds: 0, cart_adds: 0, bookings: 0 },
    { product_id: '7', views: 0, wishlist_adds: 2, cart_adds: 3, bookings: 0 }
  ]);
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
  assert.deepEqual(report.product_views, [{ product_id: '7', views: 1 }]);
  assert.deepEqual(report.recent_visits, [{
    path: '/p/tote-1',
    device: 'mobile',
    created_at: DB.visits[0].created_at
  }]);
  assert.equal('visitor_hash' in report.recent_visits[0], false);
  assert.deepEqual(report.product_interest, [{ product_id: '7', cart_quantity: 2, wishlist_count: 1 }]);
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
  assert.equal(createdResult.order.shipping_address, '12 Market Street');
  assert.equal(createdResult.order.city, 'Nairobi');
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
  DB.catalog.store.delivery_fee = 4.5;
  DB.catalog.store.free_delivery_over = 30;
  const deliveryOrder = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...order,
      idempotency_key: '91a2b153-4af0-4c64-8b58-0e7d45005b14',
      delivery_method: 'delivery'
    })
  }), env);
  assert.equal((await deliveryOrder.json()).order.shipping, 4.5);
  const pickupOrder = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...order,
      idempotency_key: 'a1a2b153-4af0-4c64-8b58-0e7d45005b14',
      delivery_method: 'pickup'
    })
  }), env);
  assert.equal((await pickupOrder.json()).order.shipping, 0);
  const freeDeliveryOrder = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...order,
      idempotency_key: 'b1a2b153-4af0-4c64-8b58-0e7d45005b14',
      delivery_method: 'delivery',
      items: [{ product_id: 7, quantity: 3 }]
    })
  }), env);
  assert.equal((await freeDeliveryOrder.json()).order.shipping, 0);
  const oversold = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...order, idempotency_key: '81a2b153-4af0-4c64-8b58-0e7d45005b14',
      items: [{ product_id: 7, quantity: 99 }] })
  }), env);
  assert.equal(oversold.status, 409);
});

test('storefront holds require product opt-in, reserve configured stock, and are honored by checkout', async () => {
  const DB = createStorefrontOrderDatabase();
  const TENANTS = createTenantStore();
  const ownerToken = 'storefront-hold-owner-key';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = { DB, TENANTS };
  const url = 'https://eshop-storefront.workers.dev/api/product-holds?tenant=main';
  const request = {
    idempotency_key: '74203ec3-7d63-465f-b411-0611b46ba04b',
    product_id: 7,
    quantity: 4,
    customer_name: 'Jamie Customer',
    contact: 'jamie@example.test'
  };
  DB.catalog.products[0].booking_enabled = false;
  const disabled = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  }), env);
  assert.equal(disabled.status, 409);
  assert.equal(DB.holds.size, 0);
  DB.catalog.products[0].booking_enabled = true;

  const invalid = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, contact: 'not a contact' })
  }), env);
  assert.equal(invalid.status, 400);

  const created = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  }), env);
  assert.equal(created.status, 201);
  const hold = (await created.json()).hold;
  assert.equal(hold.status, 'approved');
  assert.equal(hold.product_name, 'Canvas Tote');
  assert.equal(hold.customer_name, 'Jamie Customer');
  assert.ok(Math.abs(Date.parse(hold.expires_at) - Date.now() - 36 * 60 * 60 * 1000) < 5000);
  const duplicate = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  }), env);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(DB.holds.size, 1);
  assert.equal([...DB.dailyEvents.values()].reduce((total, event) => total + event.n, 0), 1);

  const denied = await worker.fetch(new Request(url), env);
  assert.equal(denied.status, 401);
  const authorization = { Authorization: `Bearer ${ownerToken}` };
  const listed = await worker.fetch(new Request(url, { headers: authorization }), env);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).holds.length, 1);
  const orderWhileHeld = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=main', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: '74203ec3-7d63-465f-b411-0611b46ba04c',
      customer_name: 'Other Customer',
      customer_email: 'other@example.test',
      items: [{ product_id: 7, quantity: 5 }]
    })
  }), env);
  assert.equal(orderWhileHeld.status, 409);
  const orderUsingHold = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=main', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: '74203ec3-7d63-465f-b411-0611b46ba04c',
      customer_name: 'Jamie Customer',
      customer_email: 'jamie@example.test',
      hold_ids: [hold.id],
      items: [{ product_id: 7, quantity: 4 }]
    })
  }), env);
  assert.equal(orderUsingHold.status, 201);
  const heldOrder = (await orderUsingHold.json()).order;
  assert.equal(heldOrder.items[0].hold_ids, undefined);

  const secondRequest = {
    ...request,
    idempotency_key: '84203ec3-7d63-465f-b411-0611b46ba04b',
    quantity: 5
  };
  const second = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(secondRequest)
  }), env);
  assert.equal(second.status, 409);
  const cancelled = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=main', {
    method: 'PATCH',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: heldOrder.order_number, status: 'cancelled' })
  }), env);
  assert.equal(cancelled.status, 200);
  assert.equal(DB.holds.get(hold.id).status, 'released');
  const availableAgain = await worker.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(secondRequest)
  }), env);
  assert.equal(availableAgain.status, 201);
  const secondHold = (await availableAgain.json()).hold;
  const released = await worker.fetch(new Request(url, {
    method: 'PATCH',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: secondHold.id, action: 'release' })
  }), env);
  assert.equal(released.status, 200);
  assert.equal((await released.json()).hold.status, 'released');
  await TENANTS.put('tenant:other-shop', JSON.stringify({ id: 'other-shop' }));
  const crossTenant = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/product-holds?tenant=other-shop',
    { headers: authorization }
  ), env);
  assert.equal(crossTenant.status, 401);
});

test('storefront holds and orders resolve published theme product IDs to canonical catalogue IDs', async () => {
  const DB = createStorefrontOrderDatabase();
  const TENANTS = createTenantStore();
  const aliasId = 'eshop-product-1792397431769';
  await TENANTS.put('published-theme:main', JSON.stringify({
    key: 'published-sites/main/craft-main-storefront/current.html',
    themeId: 'craft-main-storefront',
    catalogUpdatedAt: DB.catalogUpdatedAt
  }));
  const archivedTheme = `<!doctype html><html><body><script>
    const DATA = ${JSON.stringify({
      categories: [],
      products: [{ id: aliasId, name: 'Canvas Tote', price: 12.5 }]
    })};
  </script></body></html>`;
  const env = {
    DB,
    TENANTS,
    BUSINESS_ARCHIVE: {
      async get(key) {
        assert.equal(key, 'published-sites/main/craft-main-storefront/current.html');
        return { body: archivedTheme };
      }
    }
  };
  const holdResponse = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/product-holds?tenant=main',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: '94203ec3-7d63-465f-b411-0611b46ba04b',
        product_id: aliasId,
        quantity: 2,
        customer_name: 'Jamie Customer',
        contact: 'jamie@example.test'
      })
    }
  ), env);
  assert.equal(holdResponse.status, 201);
  assert.equal((await holdResponse.json()).hold.product_id, '7');

  const orderResponse = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/orders?tenant=main',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: '94203ec3-7d63-465f-b411-0611b46ba04c',
        customer_name: 'Sam Shop',
        customer_email: 'sam@example.test',
        items: [{ product_id: aliasId, quantity: 1 }]
      })
    }
  ), env);
  assert.equal(orderResponse.status, 201);
  const order = (await orderResponse.json()).order;
  assert.equal(order.items[0].product_id, 7);
  assert.equal(order.items[0].unit_price, 12.5);
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
  const holdResponse = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/product-holds?tenant=main',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: '81a2b153-4af0-4c64-8b58-0e7d45005b15',
        product_id: 7,
        quantity: 2,
        customer_name: 'Sam Shop',
        contact: 'sam@example.test'
      })
    }
  ), env);
  assert.equal(holdResponse.status, 201);
  const hold = (await holdResponse.json()).hold;
  const orderUrl = 'https://eshop-storefront.workers.dev/api/orders?tenant=main';
  const created = await worker.fetch(new Request(orderUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: '81a2b153-4af0-4c64-8b58-0e7d45005b14',
      customer_name: 'Sam Shop', customer_email: 'sam@example.test',
      hold_ids: [hold.id],
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
    assert.equal(DB.holds.get(hold.id).status, 'released');

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

test('storefront commerce migrations enforce tenant isolation and valid activity and hold states', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  try {
    db.exec(await readFile(new URL('../cloudflare/migrations/0008_storefront_orders.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0010_storefront_order_payments.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0018_storefront_interest_holds.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0022_storefront_event_daily.sql', import.meta.url), 'utf8'));
    assert.equal(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='storefront_orders'")[0].values.length, 1);
    assert.equal(db.exec('PRAGMA table_info(storefront_orders)')[0].values.length, 23);
    db.run("INSERT INTO storefront_orders (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,customer_phone,shipping_address,city,postal_code,country,currency,subtotal_cents,discount_cents,shipping_cents,total_cents,items_json,created_at,updated_at) VALUES ('shop-a','ORD-TEST-00000001','key-a','pending','Sam','sam@example.test','0700000000','12 Market','Nairobi','','KE','KES',100,0,0,100,'[]','now','now')");
    assert.throws(() => db.run("INSERT INTO storefront_orders (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,customer_phone,shipping_address,city,postal_code,country,currency,subtotal_cents,discount_cents,shipping_cents,total_cents,items_json,created_at,updated_at) VALUES ('shop-a','ORD-TEST-00000002','key-a','pending','Sam','sam@example.test','0700000000','12 Market','Nairobi','','KE','KES',100,0,0,100,'[]','now','now')"), /UNIQUE constraint failed/);
    db.run("INSERT INTO storefront_orders (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,customer_phone,shipping_address,city,postal_code,country,currency,subtotal_cents,discount_cents,shipping_cents,total_cents,items_json,created_at,updated_at) VALUES ('shop-b','ORD-TEST-00000002','key-a','pending','Sam','sam@example.test','0700000000','12 Market','Nairobi','','KE','KES',100,0,0,100,'[]','now','now')");
    assert.equal(db.exec('SELECT COUNT(*) FROM storefront_orders')[0].values[0][0], 2);
    assert.equal(db.exec("SELECT payment_status FROM storefront_orders WHERE tenant_id='shop-a'")[0].values[0][0], 'unpaid');
    db.run("INSERT INTO storefront_product_interest (tenant_id,visitor_hash,product_id,cart_quantity,cart_updated_at,wishlist_active,wishlist_updated_at,created_at,updated_at) VALUES ('shop-a','hash-a','7',2,'now',1,'now','now','now')");
    assert.throws(() => db.run("INSERT INTO storefront_product_interest (tenant_id,visitor_hash,product_id,cart_quantity,created_at,updated_at) VALUES ('shop-a','hash-a','7',100,'now','now')"), /CHECK constraint failed/);
    db.run("INSERT INTO storefront_hold_requests (id,tenant_id,idempotency_key,product_id,product_name,quantity,customer_name,contact,status,created_at,updated_at) VALUES ('hold-a','shop-a','key-a','7','Canvas Tote',1,'Sam','sam@example.test','pending','now','now')");
    assert.throws(() => db.run("INSERT INTO storefront_hold_requests (id,tenant_id,idempotency_key,product_id,product_name,quantity,customer_name,contact,status,created_at,updated_at) VALUES ('hold-b','shop-a','key-a','7','Canvas Tote',1,'Sam','sam@example.test','pending','now','now')"), /UNIQUE constraint failed/);
    assert.throws(() => db.run("INSERT INTO storefront_hold_requests (id,tenant_id,idempotency_key,product_id,product_name,quantity,customer_name,contact,status,created_at,updated_at) VALUES ('hold-c','shop-a','key-c','7','Canvas Tote',1,'Sam','sam@example.test','reserved','now','now')"), /CHECK constraint failed/);
    db.run("INSERT INTO storefront_hold_requests (id,tenant_id,idempotency_key,product_id,product_name,quantity,customer_name,contact,status,created_at,updated_at) VALUES ('hold-d','shop-b','key-a','7','Canvas Tote',1,'Sam','sam@example.test','pending','now','now')");
    assert.equal(db.exec('SELECT COUNT(*) FROM storefront_hold_requests')[0].values[0][0], 2);
    db.run(
      `INSERT INTO storefront_event_daily (tenant_id,day,product_id,event_type,n)
       VALUES (?,?,?,?,?)
       ON CONFLICT(tenant_id,day,product_id,event_type) DO UPDATE SET n=n+excluded.n`,
      ['shop-a', '2026-01-01', '7', 'view', 3]
    );
    db.run(
      `INSERT INTO storefront_event_daily (tenant_id,day,product_id,event_type,n)
       VALUES (?,?,?,?,?)
       ON CONFLICT(tenant_id,day,product_id,event_type) DO UPDATE SET n=n+excluded.n`,
      ['shop-a', '2026-01-01', '7', 'view', 2]
    );
    db.run(
      `INSERT INTO storefront_event_daily (tenant_id,day,product_id,event_type,n)
       SELECT ?,?,?, 'booking',1
       WHERE EXISTS (SELECT 1 FROM storefront_hold_requests WHERE tenant_id=? AND id=?)
       ON CONFLICT(tenant_id,day,product_id,event_type) DO UPDATE SET n=n+excluded.n`,
      ['shop-a', '2026-01-01', '7', 'shop-a', 'hold-a']
    );
    assert.deepEqual(db.exec(
      "SELECT event_type,n FROM storefront_event_daily WHERE tenant_id='shop-a' AND product_id='7' ORDER BY event_type"
    )[0].values, [['booking', 1], ['view', 5]]);
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
  await env.TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', name: 'Main shop', owner_token_hash: 'preserved-owner-hash',
    owner_token_hashes: ['preserved-owner-hash']
  }));
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
      taxonomy_category_id: 456,
      taxonomy_category_name: 'Apparel & Accessories > Shoes > Sneakers',
      taxonomy_attributes: [{ attributeId: 'color', attributeName: 'Color', valueId: 'black', value: 'Black' }],
      variants: [
        { id: '7-black', size: '7', color: 'Black', price: null, stock: 2 },
        { id: '8-black', size: '8', color: 'Black', price: 30, stock: 1 }
      ],
      booking_enabled: true,
      cost_price: 2,
      images: ['https://images.example/runner.jpg', 'data:image/png;base64,private'],
      media_type: 'spin',
      spin_frames: [
        'https://shop.example/media/main/frame.webp',
        'https://shop.example/media/main/frame-2.webp',
        'data:image/webp;base64,private'
      ]
    }, {
      id: 10,
      name: 'Product film',
      slug: 'product-film',
      category_id: 4,
      price: 35,
      stock: 2,
      media_type: 'video',
      video_url: 'https://shop.example/media/main/product.mp4'
    }],
    store: {
      name: 'Example Store',
      email: 'hello@example.com',
      primary_color: '#7C3AED',
      background_color: '#FAFAF8',
      text_color: '#141413',
      website_theme_id: 'woodora-luxury-furniture',
      hold_duration_hours: 48,
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
  assert.equal(publishResult.product_count, 2);
  assert.equal(publishResult.category_count, 1);
  assert.match(publishResult.updated_at, /^\d{4}-\d\d-\d\dT/);
  const mainTenant = await env.TENANTS.get('tenant:main', 'json');
  assert.equal(mainTenant.catalog_updated_at, publishResult.updated_at);
  assert.equal(mainTenant.owner_token_hash, 'preserved-owner-hash');

  const loaded = await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env);
  const result = await loaded.json();
  assert.deepEqual(result.products[0].images, ['https://images.example/runner.jpg']);
  assert.equal(result.products[0].media_type, 'spin');
  assert.equal(result.products[0].stock, 3);
  assert.equal(result.products[0].taxonomy_category_name, 'Apparel & Accessories > Shoes > Sneakers');
  assert.deepEqual(result.products[0].taxonomy_attributes, [
    { attributeId: 'color', attributeName: 'Color', valueId: 'black', value: 'Black' }
  ]);
  assert.deepEqual(result.products[0].variants, [
    { id: '7-black', size: '7', color: 'Black', price: null, stock: 2 },
    { id: '8-black', size: '8', color: 'Black', price: 30, stock: 1 }
  ]);
  assert.deepEqual(result.products[0].sizes, ['7', '8']);
  assert.deepEqual(result.products[0].colors, ['Black']);
  assert.equal(result.products[0].booking_enabled, true);
  assert.equal(result.products[1].booking_enabled, false);
  assert.deepEqual(result.products[0].spin_frames, [
    'https://shop.example/media/main/frame.webp',
    'https://shop.example/media/main/frame-2.webp'
  ]);
  assert.equal(result.products[1].media_type, 'video');
  assert.equal(result.products[1].video_url, 'https://shop.example/media/main/product.mp4');
  assert.equal('cost_price' in result.products[0], false);
  assert.equal(result.categories[0].image, '');
  assert.equal(result.store.email, 'hello@example.com');
  assert.equal(result.store.primary_color, '#7C3AED');
  assert.equal(result.store.website_theme_id, 'woodora-luxury-furniture');
  assert.equal(result.store.hold_duration_hours, 48);
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
  assert.equal(afterPartial.products.length, 2);
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
      async head(key) {
        const object = objects.get(key);
        return object ? { customMetadata: object.options.customMetadata } : null;
      },
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
  assert.equal(asset.reused, false);
  assert.match(asset.url, /^https:\/\/rrobin\.co\.ke\/media\/main\/[a-f0-9]{64}\.webp$/);
  const duplicateUpload = await worker.fetch(new Request('https://rrobin.co.ke/api/media?tenant=main', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'image/webp'
    },
    body: new Uint8Array([1, 2, 3])
  }), env);
  assert.equal(duplicateUpload.status, 200);
  assert.deepEqual(await duplicateUpload.json(), { ok: true, url: asset.url, reused: true });
  const mediaKey = new URL(asset.url).pathname;
  const publicImage = await worker.fetch(new Request(asset.url), env);
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get('Content-Type'), 'image/webp');
  assert.equal(publicImage.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.deepEqual([...new Uint8Array(await publicImage.arrayBuffer())], [1, 2, 3]);

  const uploadedVideo = await worker.fetch(new Request('https://rrobin.co.ke/api/media?tenant=main', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'video/mp4'
    },
    body: new Uint8Array([4, 5, 6])
  }), env);
  assert.equal(uploadedVideo.status, 200);
  const videoAsset = await uploadedVideo.json();
  assert.match(videoAsset.url, /^https:\/\/rrobin\.co\.ke\/media\/main\/[a-f0-9]{64}\.mp4$/);
  const publicVideo = await worker.fetch(new Request(videoAsset.url), env);
  assert.equal(publicVideo.status, 200);
  assert.equal(publicVideo.headers.get('Content-Type'), 'video/mp4');
  assert.deepEqual([...new Uint8Array(await publicVideo.arrayBuffer())], [4, 5, 6]);

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

test('Craft image search stores Pixabay results in tenant R2 and caches provider searches', async () => {
  const TENANTS = createTenantStore();
  const ownerToken = 'test-main-owner';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main',
    owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const objects = new Map();
  const env = {
    TENANTS,
    PIXABAY_API_KEY: 'test-pixabay-key',
    BUSINESS_ARCHIVE: {
      async put(key, value, options) { objects.set(key, { value, options }); },
      async get(key) {
        const object = objects.get(key);
        return object ? { body: object.value, httpMetadata: object.options.httpMetadata } : null;
      }
    }
  };
  const request = (images, ip = '192.0.2.10') => new Request('https://rrobin.co.ke/api/images/search?tenant=main', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip
    },
    body: JSON.stringify({ images })
  });
  const unauthorized = await worker.fetch(new Request('https://rrobin.co.ke/api/images/search?tenant=main', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ slot: 'hero-1', query: 'running shoes' }] })
  }), env);
  assert.equal(unauthorized.status, 401);
  const noKey = await worker.fetch(request([{ slot: 'hero-1', query: 'running shoes' }]), {
    ...env,
    PIXABAY_API_KEY: ''
  });
  assert.equal(noKey.status, 503);
  const tooMany = await worker.fetch(request(Array.from({ length: 21 }, (_, index) => ({
    slot: `image-${index}`,
    query: 'running shoes'
  }))), env);
  assert.equal(tooMany.status, 400);

  const originalFetch = globalThis.fetch;
  let searchCalls = 0;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.hostname === 'pixabay.com') {
      searchCalls++;
      assert.equal(url.searchParams.get('key'), 'test-pixabay-key');
      if (url.searchParams.get('q') === 'unsafe source') {
        return Response.json({
          hits: [{
            webformatURL: 'https://attacker.example/image.jpg',
            pageURL: 'https://pixabay.com/photos/test-123/',
            user: 'Untrusted'
          }]
        });
      }
      assert.equal(url.searchParams.get('q'), 'running shoes');
      return Response.json({
        hits: [{
          webformatURL: 'https://cdn.pixabay.com/photo/test.jpg',
          pageURL: 'https://pixabay.com/photos/test-123/',
          user: 'Test Photographer'
        }]
      });
    }
    assert.equal(url.hostname, 'cdn.pixabay.com');
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'Content-Type': 'image/jpeg' }
    });
  };
  try {
    const first = await worker.fetch(request([{ slot: 'hero-1', query: 'running shoes' }]), env);
    assert.equal(first.status, 200, await first.clone().text());
    const firstImage = (await first.json()).images[0];
    assert.match(firstImage.url, /^https:\/\/rrobin\.co\.ke\/media\/main\/[a-f0-9-]{36}\.jpg$/);
    assert.deepEqual(firstImage.credit, {
      user: 'Test Photographer',
      url: 'https://pixabay.com/photos/test-123/'
    });
    const second = await worker.fetch(request([{ slot: 'product-2', query: 'running shoes' }]), env);
    assert.equal(second.status, 200, await second.clone().text());
    assert.equal(searchCalls, 1);
    const unsafe = await worker.fetch(request([{ slot: 'hero-2', query: 'unsafe source' }]), env);
    assert.equal(unsafe.status, 502);
    assert.equal(objects.size, 2);
    const stored = [...objects.values()][0];
    assert.equal(stored.options.customMetadata.source, 'pixabay');
    assert.equal(stored.options.customMetadata.pixabayUser, 'Test Photographer');
    assert.equal(stored.options.httpMetadata.contentType, 'image/jpeg');
    assert.deepEqual([...stored.value], [1, 2, 3]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Craft image search prefers Unsplash, falls back to Pixabay, and supports Pexels secrets', async () => {
  const TENANTS = createTenantStore();
  const ownerToken = 'test-main-owner';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main',
    owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const objects = new Map();
  const env = {
    TENANTS,
    UNSPLASH_ACCESS_KEY: 'test-unsplash-key',
    PIXABAY_API_KEY: 'test-pixabay-key',
    PEXELS_API_KEY: 'test-pexels-key',
    BUSINESS_ARCHIVE: {
      async put(key, value, options) { objects.set(key, { value, options }); }
    }
  };
  const request = (query, ip) => new Request('https://rrobin.co.ke/api/images/search?tenant=main', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip
    },
    body: JSON.stringify({ images: [{ slot: 'hero-image', query }] })
  });
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(options.headers || {});
    if (url.hostname === 'api.unsplash.com' && url.pathname === '/search/photos') {
      calls.push('unsplash-search');
      assert.equal(headers.get('Authorization'), 'Client-ID test-unsplash-key');
      if (url.searchParams.get('query') === 'fallback query') return Response.json({ results: [] });
      return Response.json({
        results: [{
          urls: { regular: 'https://images.unsplash.com/photo-unsplash.jpg' },
          links: {
            html: 'https://unsplash.com/photos/photo-unsplash',
            download_location: 'https://api.unsplash.com/photos/photo-unsplash/download'
          },
          user: { name: 'Unsplash Artist' }
        }]
      });
    }
    if (url.hostname === 'api.unsplash.com' && url.pathname.endsWith('/download')) {
      calls.push('unsplash-download');
      assert.equal(headers.get('Authorization'), 'Client-ID test-unsplash-key');
      return Response.json({ url: 'https://images.unsplash.com/photo-unsplash.jpg' });
    }
    if (url.hostname === 'pixabay.com') {
      calls.push('pixabay-search');
      assert.equal(url.searchParams.get('key'), 'test-pixabay-key');
      return Response.json({
        hits: [{
          webformatURL: 'https://cdn.pixabay.com/photo/fallback.jpg',
          pageURL: 'https://pixabay.com/photos/fallback-123/',
          user: 'Pixabay Artist'
        }]
      });
    }
    if (url.hostname === 'api.pexels.com') {
      calls.push('pexels-search');
      assert.equal(headers.get('Authorization'), 'test-pexels-key');
      return Response.json({
        photos: [{
          src: { large: 'https://images.pexels.com/photos/pexels.jpg' },
          url: 'https://www.pexels.com/photo/pexels-123/',
          photographer: 'Pexels Artist'
        }]
      });
    }
    if (['images.unsplash.com', 'cdn.pixabay.com', 'images.pexels.com'].includes(url.hostname)) {
      calls.push(`${url.hostname}-download`);
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/jpeg' }
      });
    }
    throw new Error(`Unexpected image provider request: ${url.hostname}${url.pathname}`);
  };
  try {
    const unsplashResponse = await worker.fetch(request('unsplash query', '192.0.2.11'), env);
    assert.equal(unsplashResponse.status, 200, await unsplashResponse.clone().text());
    const unsplash = (await unsplashResponse.json()).images[0];
    assert.deepEqual(unsplash.credit, {
      user: 'Unsplash Artist',
      url: 'https://unsplash.com/photos/photo-unsplash?utm_source=litrus&utm_medium=referral'
    });
    assert.equal(unsplash.source, 'unsplash');
    assert.deepEqual(unsplash.attemptedProviders, ['unsplash']);
    assert.equal(calls[0], 'unsplash-search');
    assert.equal(calls[1], 'unsplash-download');
    const unsplashObject = [...objects.values()][0];
    assert.equal(unsplashObject.options.customMetadata.source, 'unsplash');
    assert.equal(unsplashObject.options.customMetadata.sourceUser, 'Unsplash Artist');
    assert.doesNotMatch(JSON.stringify(unsplash), /test-unsplash-key|test-pixabay-key/);

    const fallbackResponse = await worker.fetch(request('fallback query', '192.0.2.12'), env);
    assert.equal(fallbackResponse.status, 200, await fallbackResponse.clone().text());
    const fallbackImage = (await fallbackResponse.json()).images[0];
    assert.deepEqual(fallbackImage.credit, {
      user: 'Pixabay Artist',
      url: 'https://pixabay.com/photos/fallback-123/'
    });
    assert.equal(fallbackImage.source, 'pixabay');
    assert.deepEqual(fallbackImage.attemptedProviders, ['unsplash', 'pixabay']);
    assert.equal(calls.includes('pixabay-search'), true);
    assert.equal([...objects.values()][1].options.customMetadata.source, 'pixabay');

    const pexelsOnlyEnv = {
      ...env,
      UNSPLASH_ACCESS_KEY: '',
      PIXABAY_API_KEY: ''
    };
    const pexelsResponse = await worker.fetch(request('pexels query', '192.0.2.13'), pexelsOnlyEnv);
    assert.equal(pexelsResponse.status, 200, await pexelsResponse.clone().text());
    const pexelsImage = (await pexelsResponse.json()).images[0];
    assert.deepEqual(pexelsImage.credit, {
      user: 'Pexels Artist',
      url: 'https://www.pexels.com/photo/pexels-123/'
    });
    assert.equal(pexelsImage.source, 'pexels');
    assert.deepEqual(pexelsImage.attemptedProviders, ['pexels']);
    assert.equal(calls.includes('pexels-search'), true);
    assert.equal([...objects.values()][2].options.customMetadata.source, 'pexels');
    assert.doesNotMatch(JSON.stringify(pexelsImage), /test-pexels-key/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('raw theme HTML is private while theme media remains publicly served', async () => {
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
  assert.equal(page.status, 404);

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
    headers: { Authorization: `Bearer ${account.session_token}` }
  }), env);
  assert.deepEqual((await list.json()).tenants.map(tenant => tenant.id), ['new-shop']);

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

test('shop creation limit stays at five per hour unless local dev vars enable the bypass', async () => {
  const wranglerConfig = JSON.parse(await readFile(
    new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8'
  ));
  assert.equal(wranglerConfig.vars?.DEV_SKIP_SHOP_CREATE_LIMIT, undefined);
  assert.deepEqual(wranglerConfig.assets?.run_worker_first, ['/', '/robots.txt', '/sitemap.xml', '/sitemap-main.xml', '/shops', '/shops/', '/api/*', '/media/*', '/themes/*', '/theme-skeletons/*']);

  const makeEnvironment = () => ({
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
  });
  const createShop = (env, token, id) => worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/tenants',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'CF-Connecting-IP': '192.0.2.90'
      },
      body: JSON.stringify({ id, name: `Shop ${id}` })
    }
  ), env);

  const productionEnv = makeEnvironment();
  const productionAccount = await registerTestAccount(productionEnv, 'production-limit-user');
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await createShop(productionEnv, productionAccount.session_token, `prod-${index}`)).status, 201);
  }
  assert.equal((await createShop(productionEnv, productionAccount.session_token, 'prod-over-limit')).status, 429);

  const devEnv = { ...makeEnvironment(), DEV_SKIP_SHOP_CREATE_LIMIT: 'true' };
  const devAccount = await registerTestAccount(devEnv, 'dev-bypass-user');
  for (let index = 0; index < 6; index += 1) {
    assert.equal((await createShop(devEnv, devAccount.session_token, `dev-${index}`)).status, 201);
  }
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
        email: 'new-owner@example.com',
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
      ok: true, username: 'new-owner', email: 'new-owner@example.com',
      tenants: [{ id: 'owner-shop', name: 'Owner Shop' }]
    });
    const expiredSession = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/session'), env);
    assert.equal(expiredSession.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('account recovery emails a short-lived code and allows one password reset', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    PUBLISH_TOKEN: 'test-token',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    RESEND_API_KEY: 'test-resend-key',
    EMAIL_FROM: 'Craft <noreply@example.com>'
  };
  const registered = await registerTestAccount(env, 'recovery-user');
  const originalFetch = globalThis.fetch;
  let sentCode = '';
  let sentEmail = '';
  globalThis.fetch = async (input, init) => {
    if (String(input) === 'https://api.resend.com/emails') {
      const body = JSON.parse(init.body);
      assert.equal(init.headers.Authorization, 'Bearer test-resend-key');
      assert.equal(body.from, env.EMAIL_FROM);
      sentEmail = body.to[0];
      sentCode = body.text.match(/\b\d{6}\b/)?.[0] || '';
      return Response.json({ id: 'test-email-id' });
    }
    return originalFetch(input, init);
  };
  const postAuth = (action, body) => worker.fetch(new Request(
    `https://eshop-storefront.workers.dev/api/auth/${action}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  ), env);
  try {
    const unknownEmail = await postAuth('request-reset-code', { email: 'unknown@example.com' });
    const unknownResult = await unknownEmail.json();
    assert.equal(unknownEmail.status, 200);
    assert.match(unknownResult.message, /If an account uses that email/);
    assert.equal(sentEmail, '');

    const requested = await postAuth('request-reset-code', { email: 'RECOVERY-USER@example.com' });
    assert.equal(requested.status, 200);
    assert.equal(sentEmail, 'recovery-user@example.com');
    assert.match(sentCode, /^\d{6}$/);

    const invalidCode = await postAuth('verify-reset-code', {
      email: sentEmail,
      code: sentCode === '999999' ? '000000' : '999999'
    });
    assert.equal(invalidCode.status, 400);

    const verified = await postAuth('verify-reset-code', { email: sentEmail, code: sentCode });
    assert.equal(verified.status, 200);
    const { reset_token: resetToken } = await verified.json();
    assert.ok(resetToken);
    const reset = await postAuth('reset-password', {
      reset_token: resetToken,
      password: 'new-correct-horse-battery-staple'
    });
    assert.equal(reset.status, 200);
    assert.equal((await postAuth('reset-password', {
      reset_token: resetToken,
      password: 'another-correct-horse-battery-staple'
    })).status, 400);
    assert.equal((await postAuth('login', {
      username: 'recovery-user',
      password: 'new-correct-horse-battery-staple'
    })).status, 200);
    assert.equal((await postAuth('login', {
      username: 'recovery-user',
      password: 'correct-horse-battery-staple'
    })).status, 401);
    const updatedEmail = await worker.fetch(new Request(
      'https://eshop-storefront.workers.dev/api/auth/set-recovery-email',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${registered.session_token}`
        },
        body: JSON.stringify({
          email: 'new-recovery@example.com',
          password: 'new-correct-horse-battery-staple'
        })
      }
    ), env);
    assert.equal(updatedEmail.status, 401, 'Password reset revokes earlier account sessions.');
    const expiredSession = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/session', {
      headers: { Authorization: `Bearer ${registered.session_token}` }
    }), env);
    assert.equal(expiredSession.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('signed-in accounts can update their recovery email after confirming the password', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    PUBLISH_TOKEN: 'test-token',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
  };
  const registered = await registerTestAccount(env, 'email-update-user');
  const updated = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/auth/set-recovery-email',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${registered.session_token}`
      },
      body: JSON.stringify({
        email: '  RECOVERY@example.com ',
        password: 'correct-horse-battery-staple'
      })
    }
  ), env);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).email, 'recovery@example.com');
  const refreshed = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/auth/session',
    { headers: { Authorization: `Bearer ${registered.session_token}` } }
  ), env);
  assert.equal((await refreshed.json()).email, 'recovery@example.com');
});

test('account recovery migration adds nullable, unique email addresses without breaking existing accounts', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    db.exec(await readFile(new URL('../cloudflare/migrations/0004_accounts.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0016_account_recovery_email.sql', import.meta.url), 'utf8'));
    const columns = db.exec('PRAGMA table_info(accounts)')[0].values.map(row => row[1]);
    assert.ok(columns.includes('email'));
    db.run("INSERT INTO accounts (username, password_salt, password_hash, created_at) VALUES ('legacy', 'salt', 'hash', 'now')");
    db.run("INSERT INTO accounts (username, password_salt, password_hash, email, created_at) VALUES ('new-owner', 'salt', 'hash', 'owner@example.com', 'now')");
    assert.throws(() => db.run("INSERT INTO accounts (username, password_salt, password_hash, email, created_at) VALUES ('other-owner', 'salt', 'hash', 'owner@example.com', 'now')"));
  } finally {
    db.close();
  }
});

test('main shop can exchange the master key for an app-local owner key', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    PUBLISH_TOKEN: 'test-token',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
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

test('main shop access can be privately linked to one signed-in Craft account', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    PUBLISH_TOKEN: 'test-token',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
  };
  const owner = await registerTestAccount(env, 'main-owner');
  const other = await registerTestAccount(env, 'other-owner');
  const endpoint = 'https://eshop-storefront.workers.dev/api/admin/main-shop-owner';
  const linkRequest = (username, token = 'test-token') => worker.fetch(new Request(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username })
  }), env);

  const unauthorized = await worker.fetch(new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'main-owner' })
  }), env);
  assert.equal(unauthorized.status, 401);
  assert.equal((await linkRequest('missing-account')).status, 404);

  const linked = await linkRequest('main-owner');
  assert.equal(linked.status, 200);
  const response = await linked.json();
  assert.deepEqual(response, {
    ok: true,
    username: 'main-owner',
    tenant: { id: 'main', name: 'Main shop' }
  });
  assert.equal((await linkRequest('main-owner')).status, 200);
  assert.equal((await linkRequest('other-owner')).status, 409);

  const publish = (sessionToken, name) => worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/catalog?tenant=main',
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ products: [], categories: [], store: { name } })
    }
  ), env);
  assert.equal((await publish(owner.session_token, 'Main owner')).status, 200);
  assert.equal((await publish(other.session_token, 'Unauthorized')).status, 401);

  const ownerShops = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/tenants',
    { headers: { Authorization: `Bearer ${owner.session_token}` } }
  ), env);
  assert.deepEqual((await ownerShops.json()).tenants.map(tenant => tenant.id), ['main']);
  const masterTokenList = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/tenants',
    { headers: { Authorization: 'Bearer test-token' } }
  ), env);
  assert.equal(masterTokenList.status, 401);
  const otherShops = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/tenants',
    { headers: { Authorization: `Bearer ${other.session_token}` } }
  ), env);
  assert.deepEqual((await otherShops.json()).tenants, []);
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

test('newsletter requires consent, confirms subscribers, sends only to confirmed users, and honors one-click unsubscribe', async () => {
  const subscribers = new Map();
  const DB = {
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (query.includes('WHERE tenant_id=? AND email=?')) {
                return [...subscribers.values()].find(row => row.tenant_id === values[0] && row.email === values[1]) || null;
              }
              if (query.includes('confirmation_token_hash=?')) {
                return [...subscribers.values()].find(row => row.tenant_id === values[0] &&
                  row.confirmation_token_hash === values[1] && row.status === 'pending') || null;
              }
              if (query.includes('unsubscribe_token=?')) {
                return [...subscribers.values()].find(row => row.tenant_id === values[0] &&
                  row.unsubscribe_token === values[1] && row.status === 'subscribed') || null;
              }
              throw new Error(`Unsupported newsletter first query: ${query}`);
            },
            async all() {
              const tenantId = values[0];
              const rows = [...subscribers.values()].filter(row => row.tenant_id === tenantId);
              if (query.includes("status='subscribed'")) {
                return { results: rows.filter(row => row.status === 'subscribed') };
              }
              return { results: rows };
            },
            async run() {
              if (query.includes('INSERT INTO newsletter_subscribers')) {
                const [id, tenant_id, email, name, confirmation_token_hash, unsubscribe_token,
                  consented_at, created_at, updated_at] = values;
                subscribers.set(`${tenant_id}:${email}`, {
                  id, tenant_id, email, name, status: 'pending', confirmation_token_hash,
                  unsubscribe_token, consented_at, confirmed_at: null, unsubscribed_at: null,
                  created_at, updated_at
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("SET status='subscribed'")) {
                const [confirmed_at, updated_at, tenantId, tokenHash] = values;
                const row = [...subscribers.values()].find(item => item.tenant_id === tenantId &&
                  item.confirmation_token_hash === tokenHash && item.status === 'pending');
                if (!row) return { success: true, meta: { changes: 0 } };
                Object.assign(row, { status: 'subscribed', confirmed_at, updated_at, confirmation_token_hash: '' });
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes("SET status='unsubscribed'")) {
                const [unsubscribed_at, updated_at, tenantId, token] = values;
                const row = [...subscribers.values()].find(item => item.tenant_id === tenantId &&
                  item.unsubscribe_token === token && item.status === 'subscribed');
                if (!row) return { success: true, meta: { changes: 0 } };
                Object.assign(row, { status: 'unsubscribed', unsubscribed_at, updated_at });
                return { success: true, meta: { changes: 1 } };
              }
              if (query.includes('DELETE FROM newsletter_subscribers')) {
                return { success: true, meta: { changes: subscribers.delete(`${values[0]}:${values[1]}`) ? 1 : 0 } };
              }
              throw new Error(`Unsupported newsletter run query: ${query}`);
            }
          };
        }
      };
    }
  };
  const TENANTS = createTenantStore();
  const ownerToken = 'newsletter-owner-token';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = {
    DB, TENANTS, RESEND_API_KEY: 'test-resend-key', EMAIL_FROM: 'Craft <noreply@example.com>'
  };
  const originalFetch = globalThis.fetch;
  let confirmationUrl = '';
  let campaignMessages = [];
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === 'https://api.resend.com/emails') {
      confirmationUrl = JSON.parse(init.body).text.match(/https:\/\/\S+/)?.[0] || '';
      return Response.json({ id: 'confirmation-email' });
    }
    if (String(input) === 'https://api.resend.com/emails/batch') {
      campaignMessages = JSON.parse(init.body);
      return Response.json({ data: campaignMessages.map((_, index) => ({ id: `campaign-${index}` })) });
    }
    return originalFetch(input, init);
  };
  const baseUrl = 'https://eshop-storefront.workers.dev/api/newsletter';
  const post = (action, body, headers = {}) => worker.fetch(new Request(`${baseUrl}/${action}?tenant=main`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }), env);
  try {
    const withoutConsent = await post('subscribe', { email: 'customer@example.test' });
    assert.equal(withoutConsent.status, 400);

    const subscribed = await post('subscribe', {
      email: ' Customer@Example.Test ', name: 'Customer', consent: true
    });
    assert.equal(subscribed.status, 200);
    assert.equal((await subscribed.json()).confirmation_required, true);
    assert.equal(subscribers.size, 1);
    assert.equal([...subscribers.values()][0].status, 'pending');
    assert.match(confirmationUrl, /^https:\/\/rrobin\.co\.ke\/api\/newsletter\/confirm\?token=/);

    const confirmation = await worker.fetch(new Request(confirmationUrl), env);
    assert.equal(confirmation.status, 200);
    const token = new URL(confirmationUrl).searchParams.get('token');
    const confirmed = await worker.fetch(new Request(confirmationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token })
    }), env);
    assert.equal(confirmed.status, 200);
    assert.equal([...subscribers.values()][0].status, 'subscribed');

    const unauthorizedList = await worker.fetch(new Request(`${baseUrl}/subscribers?tenant=main`), env);
    assert.equal(unauthorizedList.status, 401);
    const authorization = { Authorization: `Bearer ${ownerToken}` };
    const listed = await worker.fetch(new Request(`${baseUrl}/subscribers?tenant=main`, {
      headers: authorization
    }), env);
    assert.equal((await listed.json()).subscribers[0].email, 'customer@example.test');

    const sent = await post('send', { subject: 'Shop updates', message: 'New products this week.' }, authorization);
    assert.equal(sent.status, 200);
    assert.deepEqual(await sent.json(), { ok: true, attempted: 1, accepted: 1, failed: 0 });
    assert.equal(campaignMessages.length, 1);
    assert.match(campaignMessages[0].headers['List-Unsubscribe'], /\/api\/newsletter\/unsubscribe\?token=/);
    assert.equal(campaignMessages[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

    const unsubscribeUrl = campaignMessages[0].headers['List-Unsubscribe'].slice(1, -1);
    const unsubscribed = await worker.fetch(new Request(unsubscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click'
    }), env);
    assert.equal(unsubscribed.status, 200);
    assert.equal([...subscribers.values()][0].status, 'unsubscribed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('newsletter migration enforces tenant-scoped subscriber and token uniqueness', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    db.exec(await readFile(new URL('../cloudflare/migrations/0019_newsletter_campaigns.sql', import.meta.url), 'utf8'));
    const columns = db.exec('PRAGMA table_info(newsletter_subscribers)')[0].values.map(row => row[1]);
    assert.ok(columns.includes('tenant_id'));
    assert.ok(columns.includes('consented_at'));
    assert.ok(columns.includes('confirmation_token_hash'));
    db.run(`INSERT INTO newsletter_subscribers
      (id, tenant_id, email, status, unsubscribe_token, consented_at, created_at, updated_at)
      VALUES ('one', 'shop-a', 'buyer@example.test', 'pending', 'unsubscribe-a', 'now', 'now', 'now')`);
    assert.throws(() => db.run(`INSERT INTO newsletter_subscribers
      (id, tenant_id, email, status, unsubscribe_token, consented_at, created_at, updated_at)
      VALUES ('two', 'shop-a', 'buyer@example.test', 'pending', 'unsubscribe-b', 'now', 'now', 'now')`));
    db.run(`INSERT INTO newsletter_subscribers
      (id, tenant_id, email, status, unsubscribe_token, consented_at, created_at, updated_at)
      VALUES ('three', 'shop-b', 'buyer@example.test', 'subscribed', 'unsubscribe-c', 'now', 'now', 'now')`);
    assert.throws(() => db.run(`INSERT INTO newsletter_subscribers
      (id, tenant_id, email, status, unsubscribe_token, consented_at, created_at, updated_at)
      VALUES ('four', 'shop-c', 'other@example.test', 'invalid', 'unsubscribe-d', 'now', 'now', 'now')`));
  } finally {
    db.close();
  }
});
