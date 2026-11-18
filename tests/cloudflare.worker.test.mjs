import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
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
                const [payment_reference, payment_subaccount_code, updated_at, tenant_id, order_number] = values;
                const order = [...orders.values()].find(row => row.tenant_id === tenant_id && row.order_number === order_number);
                if (!order || !['unpaid', 'failed'].includes(order.payment_status)) return { meta: { changes: 0 } };
                Object.assign(order, {
                  payment_reference, payment_subaccount_code, payment_status: 'initializing',
                  payment_authorization_url: null, paid_at: null, updated_at
                });
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
              if (query.includes("SET payment_status='paid',paid_at=COALESCE")) {
                const [paid_at, updated_at, tenant_id, order_number, payment_reference] = values;
                const order = [...orders.values()].find(row => row.tenant_id === tenant_id
                  && row.order_number === order_number && row.payment_reference === payment_reference);
                if (!order || order.payment_status === 'paid') return { meta: { changes: 0 } };
                Object.assign(order, { payment_status: 'paid', paid_at: paid_at || order.paid_at, updated_at });
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
                const [tenant_id, subaccount_code, status, bank_name, account_last4, account_mode, is_verified, created_at, updated_at] = values;
                rows.set(tenant_id, {
                  tenant_id, subaccount_code, status, bank_name, account_last4,
                  account_mode, is_verified, created_at, updated_at
                });
                return { meta: { changes: 1 } };
              }
              if (query.includes('UPDATE paystack_subaccounts SET status=?')) {
                const [status, is_verified, updated_at, tenant_id, subaccount_code] = values;
                const row = rows.get(tenant_id);
                if (!row || row.subaccount_code !== subaccount_code) return { meta: { changes: 0 } };
                Object.assign(row, { status, is_verified, updated_at });
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

test('Cloudflare Worker no longer serves the retired builder storefront and says so plainly', async () => {
  let assetFetched = false;
  const response = await worker.fetch(new Request('https://shop.example/'), {
    DB: createDatabase(),
    ASSETS: {
      async fetch() {
        assetFetched = true;
        return new Response('<div id="app"></div>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  });

  assert.equal(response.status, 404);
  assert.equal(assetFetched, false);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  const body = await response.text();
  assert.match(body, /This website is not available/);
  assert.doesNotMatch(body, /__ESHOP_CLOUDFLARE_STOREFRONT__/);
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
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
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

test('storefront manifest uses the shop name and theme colors', async () => {
  const env = {
    TENANTS: {
      async get(name) {
        return name === 'tenant:amani' ? { id: 'amani', name: 'Amani' } : null;
      }
    },
    DB: {
      prepare(query) {
        assert.match(query, /SELECT payload FROM catalog_snapshots/);
        return {
          bind(tenantId) {
            assert.equal(tenantId, 'amani');
            return {
              async first() {
                return {
                  payload: JSON.stringify({
                    store: { name: 'Amani Home', primary_color: '#7C3AED', background_color: '#F4F1FF' }
                  })
                };
              }
            };
          }
        };
      }
    },
    ASSETS: { async fetch() { throw new Error('A published shop should have a catalog manifest.'); } }
  };
  const response = await worker.fetch(new Request('https://amani.rrobin.co.ke/manifest.webmanifest'), env);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
  assert.deepEqual(await response.json(), {
    name: 'Amani Home',
    short_name: 'Amani Home',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F1FF',
    theme_color: '#7C3AED',
    icons: [
      { src: '/favicon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  });
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

test('published storefront HTML cache changes on theme-only republish', async () => {
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
  let pointerCatalogUpdatedAt = catalogUpdatedAt;
  let publishedThemeVersion = 'design-v1';
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
          key: `published-sites/rayoo/${themeId}/${publishedThemeVersion}.html`,
          themeId,
          catalogUpdatedAt: pointerCatalogUpdatedAt
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
        assert.equal(key, `published-sites/rayoo/${themeId}/${publishedThemeVersion}.html`);
        return {
          body: `<!doctype html><html><head><meta name="eshop-filled-theme" content="${themeId}"></head><body>${publishedThemeVersion}</body></html>`,
          customMetadata: { themeId, catalogUpdatedAt: pointerCatalogUpdatedAt }
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
    assert.match(await first.text(), /design-v1/);
    const second = await worker.fetch(request(), env);
    assert.equal(second.status, 200);
    assert.match(await second.text(), /design-v1/);
    assert.equal(catalogReads, 1);
    assert.equal(themeReads, 1);
    assert.equal(cacheMatchCount, 2);
    assert.match(cacheKeys[0], /rayoo\.rrobin\.co\.ke/);
    assert.match(cacheKeys[0], /2026-10-14T09%3A29%3A36\.380Z/);
    assert.match(cacheKeys[0], /design-v1/);
    assert.equal(cacheEntries.get(cacheKeys[0]).headers.get('Cache-Control'), 'public, max-age=3600');

    publishedThemeVersion = 'design-v2';
    const afterDesignPublish = await worker.fetch(request(), env);
    assert.match(await afterDesignPublish.text(), /design-v2/);
    assert.equal(catalogReads, 2);
    assert.equal(themeReads, 2);

    catalogUpdatedAt = '2026-10-14T10:29:36.380Z';
    pointerCatalogUpdatedAt = catalogUpdatedAt;
    publishedThemeVersion = 'design-v3';
    const afterPublish = await worker.fetch(request(), env);
    assert.match(await afterPublish.text(), /design-v3/);
    assert.equal(catalogReads, 3);
    assert.equal(themeReads, 3);
    assert.equal(cacheKeys.length, 3);
  } finally {
    if (originalCaches) Object.defineProperty(globalThis, 'caches', originalCaches);
    else delete globalThis.caches;
  }
});

test('Cloudflare Worker serves the browser POS app at /register and no longer maps storefront paths to builder-storefront', async () => {
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
  assert.deepEqual(assetPaths, ['/register']);
  assert.match(appHtml, /<div id="app"><\/div>/);
  assert.doesNotMatch(appHtml, /__ESHOP_CLOUDFLARE_STOREFRONT__/);
  assert.equal(storefront.status, 404);
  assert.match(storefrontHtml, /This website is not available/);
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

  const checkout = async (eventId, quantity, authorization = `Bearer ${ownerToken}`) => worker.fetch(new Request('https://rrobin.co.ke/api/inventory/sale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify({ event_id: eventId, items: [{ sku: 'RUN-1', quantity }] })
  }), env);
  // Anonymous callers must never be able to deduct (or zero) a shop's shared stock.
  assert.equal((await checkout('ANON-ZERO-1', 8, '')).status, 401);
  assert.equal((await checkout('ANON-ZERO-2', 8, 'Bearer not-the-owner-key')).status, 401);
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

test('website usage is owner-authorized and reports tenant-scoped D1 rows and R2 bytes', async () => {
  const ownerToken = 'website-usage-owner';
  const TENANTS = createTenantStore();
  await TENANTS.put('tenant:shop', JSON.stringify({
    id: 'shop',
    owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const DB = {
    prepare(query) {
      const all = async () => {
        if (query.includes('sqlite_master')) {
          return { results: [{ name: 'catalog_snapshots' }, { name: 'global_settings' }] };
        }
        if (query.startsWith('PRAGMA table_info')) {
          return {
            results: query.includes('catalog_snapshots')
              ? [{ name: 'tenant_id' }, { name: 'payload' }]
              : [{ name: 'value' }]
          };
        }
        throw new Error(`Unsupported usage query: ${query}`);
      };
      return {
        all,
        bind(...values) {
          return {
            all,
            async first() {
              assert.match(query, /COUNT\(\*\)/);
              return { count: values[0] === 'shop' ? 2 : 0 };
            }
          };
        }
      };
    }
  };
  const env = {
    TENANTS,
    DB,
    BUSINESS_ARCHIVE: {
      async list({ prefix }) {
        return { objects: prefix === 'media/shop/' ? [{ size: 12 }, { size: 8 }] : [], truncated: false };
      }
    }
  };
  const url = 'https://eshop-storefront.workers.dev/api/tenants/shop/usage';
  const denied = await worker.fetch(new Request(url), env);
  assert.equal(denied.status, 401);
  const response = await worker.fetch(new Request(url, {
    headers: { Authorization: `Bearer ${ownerToken}` }
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tenant_id: 'shop',
    r2: { objects: 2, bytes: 20, complete: true },
    d1: { total_records: 2, tables: [{ name: 'catalog_snapshots', count: 2 }] }
  });
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
  // 'tote-1' is a theme alias of catalogue product 7: events are stored under the canonical id.
  assert.deepEqual(await eventBatch.json(), { ok: true, accepted: 3, ignored: 0 });
  const unknownProductBatch = await worker.fetch(new Request(eventAnalyticsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [
      { product_id: 'does-not-exist-1', type: 'view', n: 5 },
      { product_id: 'a'.repeat(80), type: 'cart_add', n: 1 }
    ] })
  }), env);
  assert.equal(unknownProductBatch.status, 202);
  assert.deepEqual(await unknownProductBatch.json(), { ok: true, accepted: 0, ignored: 2 });
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
    { product_id: '7', views: 3, wishlist_adds: 2, cart_adds: 3, bookings: 0, checkout_starts: 0, purchases: 0, booking_submissions: 0 }
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
  const env = { DB, TENANTS, PAYSTACK_SECRET_KEY: 'sk_live_paystack-secret' };
  const baseUrl = 'https://eshop-storefront.workers.dev/api/payments/paystack';
  const authorization = { Authorization: `Bearer ${ownerToken}` };
  const calls = [];
  let remoteVerified = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer sk_live_paystack-secret');
    if (url.pathname.endsWith('/bank')) {
      return Response.json({ status: true, data: [{ name: 'Example Bank', code: '001', currency: 'KES' }] });
    }
    if (url.pathname.endsWith('/bank/resolve')) {
      assert.equal(init.method, undefined);
      if (url.searchParams.get('account_number') === '0000000000') {
        return Response.json({ status: false, message: 'Account could not be resolved' }, { status: 422 });
      }
      return Response.json({
        status: true,
        data: {
          account_number: url.searchParams.get('account_number'),
          account_name: 'Example Account Holder'
        }
      });
    }
    if (url.pathname === '/subaccount/ACCT_test123') {
      return Response.json({
        status: true,
        data: {
          subaccount_code: 'ACCT_test123', active: true, domain: 'live',
          is_verified: remoteVerified
        }
      });
    }
    const submitted = JSON.parse(init.body);
    assert.equal(submitted.percentage_charge, 0);
    assert.match(submitted.account_number, /^\d{5,20}$/);
    return Response.json({
      status: true,
      data: {
        subaccount_code: 'ACCT_test123',
        active: true,
        domain: 'live',
        is_verified: true,
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
    const invalid = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...details, account_number: '0000000000' })
    }), env);
    assert.equal(invalid.status, 422);
    assert.match((await invalid.json()).error, /could not verify/i);
    assert.equal(DB.rows.size, 0);
    assert.equal(calls.some(call => call.url.pathname === '/subaccount'), false);

    const malformed = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...details, account_number: '123' })
    }), env);
    assert.equal(malformed.status, 400);

    const connected = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    }), env);
    assert.equal(connected.status, 200);
    assert.deepEqual((await connected.json()).account, {
      configured: true, connected: true, status: 'connected', bank_name: 'Example Bank', account_last4: '6789',
      account_mode: 'live', is_verified: true,
      updated_at: DB.rows.get('main').updated_at
    });
    assert.equal(DB.rows.size, 1);
    assert.equal(JSON.stringify([...DB.rows.values()]).includes('0123456789'), false);
    assert.equal(JSON.stringify([...DB.rows.values()]).includes('owner@example.test'), false);

    DB.rows.get('main').is_verified = 0;
    const saved = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      headers: authorization
    }), env);
    const savedResult = await saved.json();
    assert.equal(savedResult.account.connected, true);
    assert.equal(savedResult.account.is_verified, true);
    assert.equal(DB.rows.get('main').is_verified, 1);
    assert.equal(JSON.stringify(savedResult).includes('0123456789'), false);

    const updatedDetails = { ...details, account_number: '9876543210' };
    const updated = await worker.fetch(new Request(`${baseUrl}/subaccount?tenant=main`, {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDetails)
    }), env);
    assert.equal(updated.status, 200);
    const updateCall = calls.filter(call => call.url.pathname === '/subaccount/ACCT_test123').at(-1);
    assert.equal(updateCall.init.method, 'PUT');
    assert.equal(DB.rows.get('main').account_last4, '3210');
    assert.equal(JSON.stringify([...DB.rows.values()]).includes('9876543210'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paystack test mode can set up a subaccount without live bank resolution', async () => {
  const DB = createPaystackDatabase();
  const TENANTS = createTenantStore();
  const ownerToken = 'paystack-test-owner-key';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  const env = { DB, TENANTS, PAYSTACK_SECRET_KEY: 'sk_test_paystack-secret' };
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer sk_test_paystack-secret');
    assert.equal(url.pathname, '/subaccount');
    const submitted = JSON.parse(init.body);
    return Response.json({
      status: true,
      data: {
        subaccount_code: 'ACCT_testmode123',
        active: true,
        domain: 'test',
        is_verified: false,
        settlement_bank: 'Absa',
        account_number: submitted.account_number
      }
    });
  };
  try {
    const response = await worker.fetch(new Request(
      'https://eshop-storefront.workers.dev/api/payments/paystack/subaccount?tenant=main',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Example Shop',
          settlement_bank: '001',
          account_number: '0123456789',
          primary_contact_name: 'Shop Owner',
          primary_contact_email: 'owner@example.test',
          primary_contact_phone: '+254700000000'
        })
      }
    ), env);
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['/subaccount']);
    assert.equal(DB.rows.get('main').account_last4, '6789');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('switching from test to live creates a new subaccount and records its verification state', async () => {
  const DB = createPaystackDatabase();
  const TENANTS = createTenantStore();
  const ownerToken = 'paystack-mode-switch-owner';
  await TENANTS.put('tenant:main', JSON.stringify({
    id: 'main', owner_token_hash: await sha256HexForTest(ownerToken)
  }));
  DB.rows.set('main', {
    tenant_id: 'main', subaccount_code: 'ACCT_test_only', status: 'connected',
    account_mode: 'test', is_verified: 0, bank_name: 'Absa', account_last4: '6789',
    created_at: '2026-10-10T00:00:00.000Z', updated_at: '2026-10-10T00:00:00.000Z'
  });
  const env = { DB, TENANTS, PAYSTACK_SECRET_KEY: 'sk_live_paystack-secret' };
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, method: init.method || 'GET' });
    if (url.pathname.endsWith('/bank/resolve')) {
      return Response.json({
        status: true,
        data: { account_number: url.searchParams.get('account_number'), account_name: 'Example Account Holder' }
      });
    }
    if (url.pathname === '/subaccount') {
      return Response.json({
        status: true,
        data: {
          subaccount_code: 'ACCT_newlive', active: true, domain: 'live', is_verified: false,
          settlement_bank: 'Absa', account_number: '0123456789'
        }
      });
    }
    throw new Error(`Unexpected Paystack request: ${url.pathname}`);
  };
  try {
    const response = await worker.fetch(new Request(
      'https://eshop-storefront.workers.dev/api/payments/paystack/subaccount?tenant=main',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_name: 'Example Shop', settlement_bank: '001', account_number: '0123456789',
          primary_contact_name: 'Shop Owner', primary_contact_email: 'owner@example.test',
          primary_contact_phone: '+254700000000'
        })
      }
    ), env);
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.account.account_mode, 'live');
    assert.equal(result.account.is_verified, false);
    assert.equal(DB.rows.get('main').subaccount_code, 'ACCT_newlive');
    assert.deepEqual(calls, [
      { path: '/bank/resolve', method: 'GET' },
      { path: '/subaccount', method: 'POST' }
    ]);
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
    account_mode: 'test', is_verified: 0,
    bank_name: 'Example Bank', account_last4: '6789', created_at: '2026-10-10T00:00:00.000Z',
    updated_at: '2026-10-10T00:00:00.000Z'
  });
  DB.rows.set('main', {
    tenant_id: 'main', subaccount_code: 'ACCT_main123', status: 'connected',
    account_mode: 'test', is_verified: 0,
    bank_name: 'Main Bank', account_last4: '4321', created_at: '2026-10-10T00:00:00.000Z',
    updated_at: '2026-10-10T00:00:00.000Z'
  });
  DB.rows.set('source-shop-2', {
    tenant_id: 'source-shop-2', subaccount_code: 'ACCT_shared456', status: 'connected',
    account_mode: 'test', is_verified: 0,
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
    account_mode: 'test', is_verified: false, account_last4: '6789',
    updated_at: DB.rows.get('new-store').updated_at
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
    tenant_id: 'website-two', subaccount_code: 'ACCT_olderSite', status: 'connected',
    account_mode: 'test', is_verified: 0
  });
  DB.paystackSubaccounts.set('website-one', {
    tenant_id: 'website-one', subaccount_code: 'ACCT_appDefault', status: 'connected',
    account_mode: 'test', is_verified: 0
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
    ), { DB, TENANTS, PAYSTACK_SECRET_KEY: 'sk_test_paystack-secret' });
    assert.equal(initialized.status, 200, await initialized.clone().text());
    assert.equal((await initialized.json()).authorization_url, 'https://checkout.paystack.com/default');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Paystack checkout uses the shop subaccount and verifies signed payments idempotently', async () => {
  const DB = createStorefrontOrderDatabase();
  const TENANTS = createTenantStore();
  const env = { DB, TENANTS, PAYSTACK_SECRET_KEY: 'sk_live_paystack-secret' };
  DB.paystackSubaccounts.set('main', {
    tenant_id: 'main', subaccount_code: 'ACCT_test123', status: 'connected',
    account_mode: 'live', is_verified: 1
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
  DB.paystackSubaccounts.get('main').is_verified = 0;
  const blocked = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=main',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number: orderNumber })
    }
  ), env);
  assert.equal(blocked.status, 409);
  assert.match((await blocked.json()).error, /verified live/i);
  assert.equal(DB.orders.values().next().value.payment_status, 'unpaid');
  DB.paystackSubaccounts.get('main').is_verified = 1;
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer sk_live_paystack-secret');
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
          amount: 2500, currency: 'KES', domain: 'live',
          subaccount: { subaccount_code: 'ACCT_test123' }
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
    assert.equal(DB.orders.values().next().value.payment_subaccount_code, 'ACCT_test123');

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

    const sendWebhook = async (amount, subaccountCode = 'ACCT_test123') => {
      const body = JSON.stringify({
        event: 'charge.success',
        data: {
          reference: initialized.reference, status: 'success', amount, currency: 'KES',
          domain: 'live', subaccount: { subaccount_code: subaccountCode }
        }
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
    const mismatchedSubaccountWebhook = await sendWebhook(2500, 'ACCT_wrong_recipient');
    assert.equal(mismatchedSubaccountWebhook.status, 409);
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
    db.exec(await readFile(new URL('../cloudflare/migrations/0009_paystack_subaccounts.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0010_storefront_order_payments.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0018_storefront_interest_holds.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0022_storefront_event_daily.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0023_storefront_service_appointments.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0024_paystack_live_account_audit.sql', import.meta.url), 'utf8'));
    assert.equal(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='storefront_orders'")[0].values.length, 1);
    assert.equal(db.exec('PRAGMA table_info(storefront_orders)')[0].values.length, 24);
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
    assert.ok(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='storefront_service_appointments'")[0].values.length);
    assert.ok(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='storefront_appointment_slots'")[0].values.length);
    assert.throws(() => db.run(
      `INSERT INTO storefront_service_appointments
       (id,tenant_id,idempotency_key,service_id,service_name,service_price_cents,currency,duration_minutes,
        starts_at,ends_at,slot_reserved_until,timezone,customer_name,customer_email,customer_phone,status,
        request_expires_at,deposit_percent,deposit_cents,payment_status,created_at,updated_at)
       VALUES ('appt','shop-a','key-a','8','Haircut',2500,'KES',20,'now','later','later','Africa/Nairobi',
        'Sam','sam@example.test','0700000000','pending','later',20,500,'not_required','now','now')`
    ), /CHECK constraint failed/);
    db.run(
      `INSERT INTO storefront_service_appointments
       (id,tenant_id,idempotency_key,service_id,service_name,service_price_cents,currency,duration_minutes,
        starts_at,ends_at,slot_reserved_until,timezone,customer_name,customer_email,customer_phone,status,
        request_expires_at,deposit_percent,deposit_cents,payment_status,created_at,updated_at)
       VALUES ('appt-a','shop-a','appointment-key','8','Haircut',2500,'KES',45,'start','end','reserved',
        'Africa/Nairobi','Sam','sam@example.test','0700000000','pending','later',20,500,'not_required','now','now')`
    );
    assert.throws(() => db.run(
      `INSERT INTO storefront_service_appointments
       (id,tenant_id,idempotency_key,service_id,service_name,service_price_cents,currency,duration_minutes,
        starts_at,ends_at,slot_reserved_until,timezone,customer_name,customer_email,customer_phone,status,
        request_expires_at,deposit_percent,deposit_cents,payment_status,created_at,updated_at)
       VALUES ('appt-b','shop-a','appointment-key','8','Haircut',2500,'KES',45,'start','end','reserved',
        'Africa/Nairobi','Sam','sam@example.test','0700000000','pending','later',20,500,'not_required','now','now')`
    ), /UNIQUE constraint failed/);
    db.run("INSERT INTO storefront_appointment_slots (tenant_id,slot_start,appointment_id,expires_at) VALUES ('shop-a','start','appt-a','later')");
    assert.throws(() => db.run(
      "INSERT INTO storefront_appointment_slots (tenant_id,slot_start,appointment_id,expires_at) VALUES ('shop-a','start','appt-b','later')"
    ), /UNIQUE constraint failed/);
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
    db.exec(await readFile(new URL('../cloudflare/migrations/0008_storefront_orders.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0010_storefront_order_payments.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0023_storefront_service_appointments.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0009_paystack_subaccounts.sql', import.meta.url), 'utf8'));
    db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at) VALUES ('shop-a','ACCT_test123','connected','Example Bank','6789','now','now')");
    db.exec(await readFile(new URL('../cloudflare/migrations/0013_reusable_paystack_subaccounts.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0014_allow_pending_paystack_setup.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0015_app_default_paystack_account.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../cloudflare/migrations/0024_paystack_live_account_audit.sql', import.meta.url), 'utf8'));
    const columns = db.exec('PRAGMA table_info(paystack_subaccounts)')[0].values.map(row => row[1]);
    assert.deepEqual(columns, [
      'tenant_id', 'subaccount_code', 'status', 'bank_name', 'account_last4', 'created_at', 'updated_at',
      'account_mode', 'is_verified'
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
    {
      id: '7-black', option1_name: 'Size', option1_value: '7',
      option2_name: 'Color', option2_value: 'Black',
      size: '7', color: 'Black', price: null, stock: 2
    },
    {
      id: '8-black', option1_name: 'Size', option1_value: '8',
      option2_name: 'Color', option2_value: 'Black',
      size: '8', color: 'Black', price: 30, stock: 1
    }
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

test('catalog publishing preserves service schedules and rejects invalid service durations', async () => {
  const env = { DB: createDatabase(), TENANTS: createTenantStore(), PUBLISH_TOKEN: 'test-token' };
  const request = catalog => worker.fetch(new Request('https://rrobin.co.ke/api/catalog', {
    method: 'PUT',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(catalog)
  }), env);
  const catalog = {
    categories: [],
    products: [{ id: 8, name: 'Haircut', price: 2500, duration_minutes: 45 }],
    store: {
      name: 'Studio', currency: 'KES', offer_type: 'services',
      service_days: [1, 2, 3, 4, 5], service_open_time: '09:00', service_close_time: '17:00',
      service_timezone: 'Africa/Nairobi', service_buffer_minutes: 15, service_deposit_percent: 20
    }
  };
  const published = await request(catalog);
  assert.equal(published.status, 200);
  const saved = await (await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env)).json();
  assert.equal(saved.store.offer_type, 'services');
  assert.deepEqual(saved.store.service_days, [1, 2, 3, 4, 5]);
  assert.equal(saved.store.service_timezone, 'Africa/Nairobi');
  assert.equal(saved.store.service_deposit_percent, 20);
  assert.equal(saved.products[0].duration_minutes, 45);

  const invalid = await request({
    ...catalog,
    products: [{ ...catalog.products[0], duration_minutes: 20 }]
  });
  assert.equal(invalid.status, 400);
});

test('catalog publishing persists merchant-defined options and normalizes legacy variants', async () => {
  const env = { DB: createDatabase(), TENANTS: createTenantStore(), PUBLISH_TOKEN: 'test-token' };
  const response = await worker.fetch(new Request('https://rrobin.co.ke/api/catalog', {
    method: 'PUT',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categories: [],
      products: [
        {
          id: 21,
          name: 'Cereal',
          price: 8,
          option1_name: 'Pack size',
          option2_name: 'Flavor',
          sizes: ['250 g', '500 g'],
          colors: ['Plain', 'Vanilla'],
          variants: [
            { option1_name: 'Pack size', option1_value: '250 g', option2_name: 'Flavor', option2_value: 'Plain', price: 5, stock: 4 },
            { option1_name: 'Pack size', option1_value: '250 g', option2_name: 'Flavor', option2_value: 'Vanilla', price: 5.5, stock: 3 },
            { option1_name: 'Pack size', option1_value: '500 g', option2_name: 'Flavor', option2_value: 'Plain', price: 8, stock: 2 },
            { option1_name: 'Pack size', option1_value: '500 g', option2_name: 'Flavor', option2_value: 'Vanilla', price: 8.5, stock: 1 }
          ]
        },
        {
          id: 22,
          name: 'Legacy shirt',
          price: 20,
          sizes: ['S'],
          colors: ['Blue'],
          variants: [{ size: 'S', color: 'Blue', price: null, stock: 6 }]
        }
      ],
      store: { name: 'Test shop', currency: 'KES' }
    })
  }), env);

  assert.equal(response.status, 200);
  const saved = await (await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env)).json();
  assert.equal(saved.products[0].option1_name, 'Pack size');
  assert.equal(saved.products[0].option2_name, 'Flavor');
  assert.equal(saved.products[0].variants[3].option1_value, '500 g');
  assert.equal(saved.products[0].variants[3].option2_value, 'Vanilla');
  assert.equal(saved.products[0].stock, 10);
  assert.equal(saved.products[1].option1_name, 'Size');
  assert.equal(saved.products[1].option2_name, 'Color');
  assert.equal(saved.products[1].variants[0].option1_value, 'S');
  assert.equal(saved.products[1].variants[0].option2_value, 'Blue');
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

test('new-shop draft image search needs no owner key and does not store image bytes remotely', async () => {
  const TENANTS = createTenantStore();
  const env = { TENANTS, PIXABAY_API_KEY: 'test-pixabay-key' };
  const originalFetch = globalThis.fetch;
  const providerCalls = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    providerCalls.push(url.hostname);
    assert.equal(url.hostname, 'pixabay.com');
    return Response.json({
      hits: [{
        webformatURL: 'https://cdn.pixabay.com/photo/draft.jpg',
        pageURL: 'https://pixabay.com/photos/draft-123/',
        user: 'Draft Artist'
      }]
    });
  };
  try {
    const response = await worker.fetch(new Request('https://rrobin.co.ke/api/images/draft-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.0.2.77'
      },
      body: JSON.stringify({ images: [{ slot: 'hero-image', query: 'linen shop' }] })
    }), env);
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.images[0].url, 'https://cdn.pixabay.com/photo/draft.jpg');
    assert.deepEqual(result.images[0].credit, {
      user: 'Draft Artist',
      url: 'https://pixabay.com/photos/draft-123/'
    });
    assert.deepEqual(providerCalls, ['pixabay.com'], 'Draft search must not download or store image bytes in R2.');
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
  const deletedBody = await deleted.json();
  assert.equal(deletedBody.ok, true);
  assert.equal(deletedBody.deleted_tenant_id, 'new-shop');
  const deletedDomain = await worker.fetch(new Request('https://new-shop.rrobin.co.ke/'), env);
  assert.equal(deletedDomain.status, 404);
});

test('shop creation limit stays at five per hour unless local dev vars enable the bypass', async () => {
  const wranglerConfig = JSON.parse(await readFile(
    new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8'
  ));
  assert.equal(wranglerConfig.vars?.DEV_SKIP_SHOP_CREATE_LIMIT, undefined);
  assert.deepEqual(wranglerConfig.assets?.run_worker_first, ['/', '/robots.txt', '/sitemap.xml', '/sitemap-main.xml', '/manifest.webmanifest', '/shops', '/shops/', '/api/*', '/media/*', '/themes/*', '/theme-skeletons/*']);

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

// ---------------------------------------------------------------------------
// Worker hardening: real SQLite (sql.js) with every migration applied, behind a D1-shaped adapter.
// ---------------------------------------------------------------------------
async function createMigratedD1() {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON');
  const directory = new URL('../cloudflare/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(await readFile(new URL(file, directory), 'utf8'));
  }
  const statement = (sql, values = []) => ({
    sql,
    values,
    async first() {
      const prepared = db.prepare(sql);
      try {
        prepared.bind(values);
        return prepared.step() ? prepared.getAsObject() : null;
      } finally {
        prepared.free();
      }
    },
    async all() {
      const prepared = db.prepare(sql);
      try {
        prepared.bind(values);
        const results = [];
        while (prepared.step()) results.push(prepared.getAsObject());
        return { results };
      } finally {
        prepared.free();
      }
    },
    runSync() {
      db.run(sql, values);
      return { success: true, meta: { changes: db.getRowsModified() } };
    },
    async run() {
      return this.runSync();
    }
  });
  const DB = {
    prepare(sql) {
      return { ...statement(sql), bind: (...values) => statement(sql, values) };
    },
    // Like D1, a batch is one transaction that nothing can interleave with: every statement runs
    // synchronously, and any failure rolls the whole batch back.
    async batch(statements) {
      db.run('BEGIN');
      try {
        const results = statements.map(item => item.runSync());
        db.run('COMMIT');
        return results;
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    }
  };
  const rows = (sql, values = []) => {
    const result = db.exec(sql, values);
    if (!result.length) return [];
    const [{ columns, values: data }] = result;
    return data.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
  };
  return { db, DB, rows };
}

const HARDENING_STORE = {
  currency: 'KES', hold_duration_hours: 24, name: 'Hardening Shop', delivery_fee: 0
};

async function createHardeningEnv(options = {}) {
  const { db, DB, rows } = await createMigratedD1();
  const TENANTS = createTenantStore();
  const tokens = {};
  const catalog = options.catalog || {
    products: [
      { id: 7, name: 'Canvas Tote', sku: 'TOTE-7', price: 12.5, stock: 100, booking_enabled: true },
      { id: 8, name: 'Enamel Mug', sku: 'MUG-8', price: 5, stock: 3 },
      { id: 9, name: 'Poster', sku: 'POSTER-9', price: 20, stock: 10, booking_enabled: true }
    ],
    categories: [],
    store: HARDENING_STORE
  };
  for (const tenantId of options.tenants || ['shop-a', 'shop-b']) {
    tokens[tenantId] = `owner-key-for-${tenantId}`;
    const ownerUsername = `owner-${tenantId}`;
    await TENANTS.put(`tenant:${tenantId}`, JSON.stringify({
      id: tenantId, name: tenantId, owner_username: ownerUsername,
      owner_token_hash: await sha256HexForTest(tokens[tenantId]),
      owner_token_hashes: [await sha256HexForTest(tokens[tenantId])]
    }));
    db.run(
      'INSERT INTO catalog_snapshots (tenant_id,payload,admin_payload,updated_at) VALUES (?,?,?,?)',
      [tenantId, JSON.stringify(catalog), JSON.stringify(catalog), '2026-01-01T00:00:00.000Z']
    );
    db.run('INSERT INTO accounts (username,password_salt,password_hash,email,created_at) VALUES (?,?,?,?,?)',
      [ownerUsername, 'salt', 'hash', `${ownerUsername}@owner.example`, 'now']);
    db.run('INSERT INTO account_tenants (username,tenant_id) VALUES (?,?)', [ownerUsername, tenantId]);
  }
  return { db, DB, rows, TENANTS, tokens, env: { DB, TENANTS, ...(options.extraEnv || {}) } };
}

function hardeningCtx() {
  const tasks = [];
  return { tasks, waitUntil(task) { tasks.push(task); }, async settle() { await Promise.all(tasks); } };
}

function orderRequest(tenantId, items, extra = {}, { ip = '203.0.113.5', key = crypto.randomUUID() } = {}) {
  return new Request(`https://eshop-storefront.workers.dev/api/orders?tenant=${tenantId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({
      idempotency_key: key,
      customer_name: 'Jamie Customer',
      customer_email: 'jamie@customer.example',
      customer_phone: '0712345678',
      shipping_address: '1 Private Road',
      delivery_method: 'delivery',
      items,
      ...extra
    })
  });
}

const ownerHeaders = token => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

test('hardening harness: every migration applies and the atomic rate limiter is race-safe', async () => {
  const { env, rows } = await createHardeningEnv();
  const tables = rows("SELECT name FROM sqlite_master WHERE type='table'").map(row => row.name);
  for (const name of ['rate_limit_counters', 'owner_notifications', 'discount_codes', 'storefront_orders']) {
    assert.ok(tables.includes(name), `${name} should exist`);
  }
  const orderColumns = rows('PRAGMA table_info(storefront_orders)').map(row => row.name);
  for (const name of ['payment_method', 'manual_payment_reference', 'needs_attention', 'attention_reason', 'discount_code']) {
    assert.ok(orderColumns.includes(name), `${name} column should exist`);
  }
  // 25 concurrent orders from one IP: exactly the per-IP limit succeeds, the rest are throttled.
  const responses = await Promise.all(Array.from({ length: 25 }, () =>
    worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }]), env)));
  const statuses = responses.map(response => response.status);
  assert.equal(statuses.filter(status => status === 201).length, 20);
  assert.equal(statuses.filter(status => status === 429).length, 5);
  assert.ok(responses.find(response => response.status === 429).headers.get('Retry-After'));
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_orders')[0].n, 20);
  // A different connection is unaffected, and so is a different shop from the same IP.
  assert.equal((await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '198.51.100.9' }), env)).status, 201);
  assert.equal((await worker.fetch(orderRequest('shop-b', [{ product_id: 7, quantity: 1 }]), env)).status, 201);
  // The window really expires: age the counter and the same IP can order again.
  env.DB.prepare('UPDATE rate_limit_counters SET window_start = window_start - 3600').run();
  assert.equal((await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }]), env)).status, 201);
});

test('rate limits fall back to KV when the D1 counter table is unavailable and fail open without storage', async () => {
  const kvOnly = {
    DB: createStorefrontOrderDatabase(),
    TENANTS: createTenantStore()
  };
  const ok = [];
  for (let index = 0; index < 22; index += 1) {
    ok.push((await worker.fetch(orderRequest('main', [{ product_id: 7, quantity: 1 }]), kvOnly)).status);
  }
  assert.equal(ok.filter(status => status === 201).length, 20);
  assert.deepEqual(ok.slice(20), [429, 429]);

  const noCounters = { DB: createStorefrontOrderDatabase() };
  for (let index = 0; index < 25; index += 1) {
    assert.equal((await worker.fetch(orderRequest('main', [{ product_id: 7, quantity: 1 }]), noCounters)).status, 201);
  }
});

test('anonymous holds are capped per request, per connection and per product share of stock', async () => {
  const catalog = {
    products: [{ id: 7, name: 'Canvas Tote', sku: 'TOTE-7', price: 12.5, stock: 10, booking_enabled: true }],
    categories: [],
    store: HARDENING_STORE
  };
  const { env, rows } = await createHardeningEnv({ catalog });
  const hold = (quantity, ip, key = crypto.randomUUID()) => worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/product-holds?tenant=shop-a',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({
        idempotency_key: key, product_id: 7, quantity, customer_name: 'Hold Visitor', contact: 'visitor@example.test'
      })
    }
  ), env);
  // One request cannot take more than the per-hold maximum.
  const tooMany = await hold(6, '203.0.113.1');
  assert.equal(tooMany.status, 409);
  assert.match((await tooMany.json()).error, /limited to 5 items/);
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_hold_requests')[0].n, 0);
  // One connection can only keep three active holds.
  assert.equal((await hold(1, '203.0.113.1')).status, 201);
  assert.equal((await hold(1, '203.0.113.1')).status, 201);
  assert.equal((await hold(1, '203.0.113.1')).status, 201);
  const fourth = await hold(1, '203.0.113.1');
  assert.equal(fourth.status, 429);
  assert.match((await fourth.json()).error, /maximum number of holds/);
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_hold_requests')[0].n, 3);
  // Many visitors together still cannot hold more than 75% of the stock (7 of 10): 3 held so far.
  assert.equal((await hold(4, '198.51.100.1')).status, 201);
  const overShare = await hold(1, '198.51.100.2');
  assert.equal(overShare.status, 409);
  assert.equal(rows("SELECT COALESCE(SUM(quantity),0) AS n FROM storefront_hold_requests WHERE status='approved'")[0].n, 7);
});

test('payment initialization is rate limited per connection before any Paystack work', async () => {
  const { env } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_rate_limit' } });
  const initialize = ip => worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=shop-a',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ order_number: 'ORD-DOESNOTEXIST01' })
    }
  ), env);
  for (let index = 0; index < 10; index += 1) assert.equal((await initialize('203.0.113.77')).status, 404);
  const throttled = await initialize('203.0.113.77');
  assert.equal(throttled.status, 429);
  assert.equal((await initialize('203.0.113.78')).status, 404);
});

test('inventory sales need the shop owner; keys, sessions and shops stay isolated', async () => {
  const DB = createInventoryDatabase({ products: [{ id: 1, name: 'Runner', sku: 'RUN-1', stock: 8 }], categories: [], store: {} });
  const TENANTS = createTenantStore();
  for (const tenantId of ['shop-a', 'shop-b']) {
    await TENANTS.put(`tenant:${tenantId}`, JSON.stringify({
      id: tenantId, owner_token_hash: await sha256HexForTest(`key-${tenantId}`)
    }));
  }
  const env = { DB, TENANTS, PUBLISH_TOKEN: 'admin-token' };
  const sale = (tenantId, authorization) => worker.fetch(new Request(
    `https://eshop-storefront.workers.dev/api/inventory/sale?tenant=${tenantId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify({ event_id: `evt-${Math.random().toString(16).slice(2)}`, items: [{ sku: 'RUN-1', quantity: 1 }] })
    }
  ), env);
  assert.equal((await sale('shop-a', '')).status, 401);
  assert.equal((await sale('shop-a', 'Bearer key-shop-b')).status, 401, "another shop's key is not accepted");
  assert.equal((await sale('shop-a', 'Bearer made-up')).status, 401);
  // Seed stock through the owner-only connect route, then sell with the owner key.
  const connected = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/inventory/connect?tenant=shop-a', {
    method: 'POST', headers: ownerHeaders('key-shop-a'),
    body: JSON.stringify({ mode: 'replace', items: [{ sku: 'RUN-1', stock: 8 }] })
  }), env);
  assert.equal(connected.status, 200);
  assert.equal((await sale('shop-a', 'Bearer key-shop-a')).status, 200);
  assert.equal((await sale('shop-a', 'Bearer admin-token')).status, 200, 'the admin key may also write sales');
});

function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const handled = await handler(url, init);
    return handled === undefined ? original(input, init) : handled;
  };
  return { calls, restore() { globalThis.fetch = original; } };
}

test('owner is notified of new orders and holds with minimal PII, and delivery never blocks the customer', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({
    extraEnv: { RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Craft <noreply@example.com>' }
  });
  let resendStatus = 200;
  const stub = stubFetch(async url => {
    if (url === 'https://api.resend.com/emails') return resendStatus === 'throw'
      ? Promise.reject(new Error('network down'))
      : new Response('{}', { status: resendStatus, headers: { 'Content-Type': 'application/json' } });
    return undefined;
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    // A customer push subscription must never receive owner alerts.
    db.run(
      'INSERT INTO push_subscriptions (tenant_id,endpoint_hash,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)',
      ['shop-a', 'hash', 'https://fcm.googleapis.com/fcm/send/customer', 'p', 'a', 'now']
    );
    const ctx = hardeningCtx();
    const placed = await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 2 }]), env, ctx);
    assert.equal(placed.status, 201);
    const order = (await placed.json()).order;
    await ctx.settle();
    const notes = rows("SELECT * FROM owner_notifications WHERE tenant_id='shop-a'");
    assert.equal(notes.length, 1);
    assert.equal(notes[0].kind, 'order');
    assert.equal(notes[0].ref, order.order_number);
    assert.match(notes[0].body, /Jamie placed order ORD-[A-Z0-9]+: 2 items, KES 25\.00/);
    const serialized = JSON.stringify(notes);
    for (const pii of ['jamie@customer.example', '0712345678', '1 Private Road', 'Customer']) {
      assert.equal(serialized.includes(pii), false, `${pii} must not be stored in the outbox`);
    }
    const emails = stub.calls.filter(call => call.url === 'https://api.resend.com/emails');
    assert.equal(emails.length, 1);
    const email = JSON.parse(emails[0].init.body);
    assert.deepEqual(email.to, ['owner-shop-a@owner.example']);
    assert.equal(email.from, 'Craft <noreply@example.com>');
    for (const pii of ['jamie@customer.example', '0712345678', '1 Private Road']) {
      assert.equal(`${email.subject} ${email.text}`.includes(pii), false);
    }
    assert.equal(stub.calls.some(call => call.url.includes('fcm.googleapis.com')), false);
    assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE tenant_id='shop-b'")[0].n, 0);

    // Duplicate (idempotent) submissions do not notify twice.
    const key = crypto.randomUUID();
    const dupCtx = hardeningCtx();
    await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { key }), env, dupCtx);
    await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { key }), env, dupCtx);
    await dupCtx.settle();
    assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE kind='order'")[0].n, 2);

    const holdCtx = hardeningCtx();
    const hold = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/product-holds?tenant=shop-a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(), product_id: 9, quantity: 2,
        customer_name: 'Pat Visitor', contact: 'pat@visitor.example'
      })
    }), env, holdCtx);
    assert.equal(hold.status, 201);
    await holdCtx.settle();
    const holdNote = rows("SELECT * FROM owner_notifications WHERE kind='hold'")[0];
    assert.match(holdNote.body, /Pat reserved 2 x Poster/);
    assert.equal(JSON.stringify(holdNote).includes('pat@visitor.example'), false);

    // Failures never reach the customer: Resend 500, network error, unmigrated outbox, no ctx at all.
    resendStatus = 500;
    assert.equal((await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '198.51.100.1' }), env, hardeningCtx())).status, 201);
    resendStatus = 'throw';
    assert.equal((await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '198.51.100.2' }), env, hardeningCtx())).status, 201);
    assert.equal((await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '198.51.100.3' }), env)).status, 201);
    db.run('DROP TABLE owner_notifications');
    const noTableCtx = hardeningCtx();
    assert.equal((await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '198.51.100.4' }), env, noTableCtx)).status, 201);
    await noTableCtx.settle();
  } finally {
    console.error = originalError;
    stub.restore();
  }

  // Without any notification bindings the order flow is a quiet no-op.
  const bare = await createHardeningEnv();
  const bareStub = stubFetch(async () => undefined);
  try {
    const bareCtx = hardeningCtx();
    assert.equal((await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }]), bare.env, bareCtx)).status, 201);
    await bareCtx.settle();
    assert.equal(bareStub.calls.some(call => call.url.includes('resend.com')), false);
    assert.equal(bare.rows("SELECT COUNT(*) AS n FROM owner_notifications")[0].n, 1, 'the outbox still records it for the app');
  } finally {
    bareStub.restore();
  }
  assert.ok(tokens['shop-a']);
});

test('owner notification feed is owner-only, tenant scoped and supports marking items read', async () => {
  const { env, tokens } = await createHardeningEnv();
  const ctx = hardeningCtx();
  await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }]), env, ctx);
  await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '198.51.100.9' }), env, ctx);
  await ctx.settle();
  const url = tenant => `https://eshop-storefront.workers.dev/api/store/notifications?tenant=${tenant}`;
  assert.equal((await worker.fetch(new Request(url('shop-a')), env)).status, 401);
  assert.equal((await worker.fetch(new Request(url('shop-a'), { headers: ownerHeaders(tokens['shop-b']) }), env)).status, 401);
  const listed = await worker.fetch(new Request(url('shop-a'), { headers: ownerHeaders(tokens['shop-a']) }), env);
  assert.equal(listed.status, 200);
  const feed = await listed.json();
  assert.equal(feed.notifications.length, 2);
  assert.equal(feed.unread_count, 2);
  assert.deepEqual(Object.keys(feed.notifications[0]).sort(), ['body', 'created_at', 'id', 'kind', 'read_at', 'ref', 'title']);
  const otherFeed = await (await worker.fetch(new Request(url('shop-b'), { headers: ownerHeaders(tokens['shop-b']) }), env)).json();
  assert.equal(otherFeed.notifications.length, 0);
  const markOne = await worker.fetch(new Request(`${url('shop-a').replace('notifications', 'notifications/read')}`, {
    method: 'POST', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ ids: [feed.notifications[0].id] })
  }), env);
  assert.equal(markOne.status, 200);
  assert.equal((await (await worker.fetch(new Request(url('shop-a'), { headers: ownerHeaders(tokens['shop-a']) }), env)).json()).unread_count, 1);
  const crossTenantRead = await worker.fetch(new Request(`${url('shop-b').replace('notifications', 'notifications/read')}`, {
    method: 'POST', headers: ownerHeaders(tokens['shop-b']), body: JSON.stringify({ all: true })
  }), env);
  assert.equal(crossTenantRead.status, 200);
  assert.equal((await (await worker.fetch(new Request(url('shop-a'), { headers: ownerHeaders(tokens['shop-a']) }), env)).json()).unread_count, 1);
  await worker.fetch(new Request(`${url('shop-a').replace('notifications', 'notifications/read')}`, {
    method: 'POST', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ all: true })
  }), env);
  assert.equal((await (await worker.fetch(new Request(url('shop-a'), { headers: ownerHeaders(tokens['shop-a']) }), env)).json()).unread_count, 0);
});

const SERVICE_CATALOG = {
  products: [{ id: 8, name: 'Haircut', price: 2500, duration_minutes: 60 }],
  categories: [],
  store: {
    name: 'Studio', currency: 'KES', offer_type: 'services', service_timezone: 'Africa/Nairobi',
    service_open_time: '09:00', service_close_time: '17:00', service_days: [0, 1, 2, 3, 4, 5, 6],
    service_buffer_minutes: 15, service_deposit_percent: 20
  }
};

test('booking requests notify the owner and a stuck confirmation can be recovered and declined', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ catalog: SERVICE_CATALOG, extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_services' } });
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(Date.now() + 48 * 60 * 60 * 1000)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const availability = await worker.fetch(new Request(
    `https://eshop-storefront.workers.dev/api/service-appointments/availability?tenant=shop-a&service_id=8&date=${parts.year}-${parts.month}-${parts.day}`
  ), env);
  const slot = (await availability.json()).slots[0];
  const ctx = hardeningCtx();
  const created = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/service-appointments?tenant=shop-a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.60' },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(), service_id: 8, starts_at: slot.starts_at,
      customer_name: 'Wanjiru Client', customer_email: 'wanjiru@client.example', customer_phone: '0722000111'
    })
  }), env, ctx);
  assert.equal(created.status, 201);
  const appointmentId = (await created.json()).appointment.id;
  await ctx.settle();
  const note = rows("SELECT * FROM owner_notifications WHERE kind='booking'")[0];
  assert.equal(note.ref, appointmentId);
  assert.match(note.body, /Wanjiru asked to book Haircut/);
  for (const pii of ['wanjiru@client.example', '0722000111']) assert.equal(JSON.stringify(note).includes(pii), false);

  // A confirmation that died after reserving the deposit would otherwise leave it stuck forever.
  const decline = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/service-appointments?tenant=shop-a', {
    method: 'PATCH', headers: ownerHeaders(tokens['shop-a']),
    body: JSON.stringify({ id: appointmentId, action: 'reject' })
  }), env);
  db.run("UPDATE storefront_service_appointments SET status='confirming',payment_status='initializing',payment_reference='ESHOP_STUCK',updated_at=? WHERE id=?",
    [new Date().toISOString(), appointmentId]);
  assert.equal((await decline()).status, 409, 'a confirmation that just started is still in flight');
  db.run("UPDATE storefront_service_appointments SET updated_at=? WHERE id=?",
    [new Date(Date.now() - 30 * 60 * 1000).toISOString(), appointmentId]);
  const recovered = await decline();
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).appointment.status, 'rejected');
  assert.equal(rows('SELECT payment_reference FROM storefront_service_appointments WHERE id=?', [appointmentId])[0].payment_reference, null);
});

async function placeHardeningOrder(env, tenantId, items, extra = {}, options = {}) {
  const response = await worker.fetch(orderRequest(tenantId, items, extra, { ip: `10.0.0.${Math.floor(Math.random() * 250) + 1}`, ...options }), env);
  assert.equal(response.status, 201, await response.clone().text());
  return (await response.json()).order;
}

const allocateMug = (db, tenantId, webStock) => db.run(
  `INSERT INTO main_store_inventory
   (tenant_id,sku,product_id,product_name,source_channel,pos_enabled,web_enabled,master_stock,pos_stock,web_stock,reserved_stock,updated_at)
   VALUES (?,?,?,?,?,0,1,?,0,?,0,'now')`,
  [tenantId, 'MUG-8', '8', 'Enamel Mug', 'web', webStock, webStock]
);

test('owners can record cash, M-Pesa and bank payments: idempotent, tenant scoped, stock deducted once', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv();
  allocateMug(db, 'shop-a', 3);
  allocateMug(db, 'shop-b', 3);
  const order = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  assert.equal(order.total, 10);
  const pay = (tenantId, orderNumber, body, token, ctx) => worker.fetch(new Request(
    `https://eshop-storefront.workers.dev/api/store/orders/${orderNumber}/payment?tenant=${tenantId}`,
    { method: 'POST', headers: token ? ownerHeaders(token) : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  ), env, ctx);
  const webStock = tenantId => rows("SELECT web_stock FROM main_store_inventory WHERE tenant_id=? AND sku='MUG-8'", [tenantId])[0].web_stock;

  assert.equal((await pay('shop-a', order.order_number, { method: 'cash' })).status, 401);
  assert.equal((await pay('shop-a', order.order_number, { method: 'cash' }, tokens['shop-b'])).status, 401, "another shop's key");
  assert.equal((await pay('shop-b', order.order_number, { method: 'cash' }, tokens['shop-b'])).status, 404, "another shop's order number");
  assert.equal((await pay('shop-a', order.order_number, { method: 'barter' }, tokens['shop-a'])).status, 400);
  assert.equal((await pay('shop-a', 'ORD-MISSING0001', { method: 'cash' }, tokens['shop-a'])).status, 404);
  const partial = await pay('shop-a', order.order_number, { method: 'cash', amount_cents: 500 }, tokens['shop-a']);
  assert.equal(partial.status, 400);
  assert.equal((await partial.json()).expected_amount_cents, 1000);
  assert.equal(webStock('shop-a'), 3);

  const paid = await pay('shop-a', order.order_number, { method: 'mobile_money', reference: 'QJK12345XY', amount_cents: 1000 }, tokens['shop-a']);
  assert.equal(paid.status, 200);
  const paidBody = await paid.json();
  assert.equal(paidBody.duplicate, false);
  assert.equal(paidBody.needs_attention, false);
  assert.equal(paidBody.order.payment_status, 'paid');
  assert.equal(paidBody.order.payment_method, 'mobile_money');
  const row = rows('SELECT * FROM storefront_orders WHERE order_number=?', [order.order_number])[0];
  assert.equal(row.payment_status, 'paid');
  assert.equal(row.manual_payment_reference, 'QJK12345XY');
  assert.ok(row.paid_at);
  assert.equal(webStock('shop-a'), 1, 'stock is deducted through the same deduction path');
  assert.equal(webStock('shop-b'), 3, 'other shops are untouched');
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_inventory_deductions')[0].n, 1);

  const again = await pay('shop-a', order.order_number, { method: 'cash' }, tokens['shop-a']);
  assert.equal(again.status, 200);
  const againBody = await again.json();
  assert.equal(againBody.duplicate, true);
  assert.equal(againBody.order.payment_method, 'mobile_money', 'the first recorded method wins');
  assert.equal(webStock('shop-a'), 1, 'a repeat never deducts again');

  // A double-tap on a fresh order deducts exactly once even when both requests race.
  const racing = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 1 }]);
  const racers = await Promise.all([
    pay('shop-a', racing.order_number, { method: 'cash' }, tokens['shop-a']),
    pay('shop-a', racing.order_number, { method: 'cash' }, tokens['shop-a'])
  ]);
  assert.deepEqual(racers.map(response => response.status), [200, 200]);
  assert.equal(webStock('shop-a'), 0);

  const cancelled = await placeHardeningOrder(env, 'shop-a', [{ product_id: 7, quantity: 1 }]);
  await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    method: 'PATCH', headers: ownerHeaders(tokens['shop-a']),
    body: JSON.stringify({ order_number: cancelled.order_number, status: 'cancelled' })
  }), env);
  assert.equal((await pay('shop-a', cancelled.order_number, { method: 'cash' }, tokens['shop-a'])).status, 409);
});

test('settlement never loses money when stock ran out: paid orders are flagged needs_attention', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({
    extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_settlement', RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Craft <noreply@example.com>' }
  });
  allocateMug(db, 'shop-a', 3);
  const first = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  const second = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  const third = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  const stub = stubFetch(async url => (url === 'https://api.resend.com/emails' ? Response.json({ id: 'e' }) : undefined));
  try {
    const manual = (orderNumber, ctx) => worker.fetch(new Request(
      `https://eshop-storefront.workers.dev/api/store/orders/${orderNumber}/payment?tenant=shop-a`,
      { method: 'POST', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ method: 'cash' }) }
    ), env, ctx);
    assert.equal((await manual(first.order_number)).status, 200);
    // Only one mug is left, so the second order cannot be deducted in full.
    const ctx = hardeningCtx();
    const short = await manual(second.order_number, ctx);
    assert.equal(short.status, 200);
    const shortBody = await short.json();
    assert.equal(shortBody.needs_attention, true);
    assert.equal(shortBody.order.payment_status, 'paid');
    assert.equal(shortBody.order.needs_attention, true);
    assert.equal(shortBody.order.attention_reason, 'insufficient_stock:MUG-8');
    await ctx.settle();
    assert.equal(rows('SELECT web_stock FROM main_store_inventory')[0].web_stock, 1, 'stock was not driven negative');
    assert.equal(rows("SELECT COUNT(*) AS n FROM storefront_inventory_deductions WHERE order_number=?", [second.order_number])[0].n, 0);
    assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE kind='attention'")[0].n, 1);
    assert.equal(rows("SELECT needs_attention FROM storefront_orders WHERE order_number=?", [first.order_number])[0].needs_attention, 0);

    // The same protection applies to a Paystack webhook, which previously aborted and retried forever.
    db.run("UPDATE storefront_orders SET payment_reference='ESHOP_00000000000000000000000000000001',payment_subaccount_code='ACCT_test1',payment_status='pending' WHERE order_number=?",
      [third.order_number]);
    const body = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'ESHOP_00000000000000000000000000000001', amount: 1000, currency: 'KES', status: 'success',
        domain: 'test', subaccount: { subaccount_code: 'ACCT_test1' }
      }
    });
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('sk_test_settlement'),
      { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    const webhook = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
      method: 'POST', headers: { 'x-paystack-signature': signature }, body
    }), env, hardeningCtx());
    const delivered = await webhook();
    assert.equal(delivered.status, 200);
    assert.equal((await delivered.json()).payment_status, 'paid');
    const settled = rows('SELECT * FROM storefront_orders WHERE order_number=?', [third.order_number])[0];
    assert.equal(settled.payment_status, 'paid');
    assert.equal(settled.needs_attention, 1);
    assert.equal(settled.attention_reason, 'insufficient_stock:MUG-8');
    assert.equal((await webhook()).status, 200, 'webhook retries are harmless');
    assert.equal(rows('SELECT web_stock FROM main_store_inventory')[0].web_stock, 1);
  } finally {
    stub.restore();
  }
});

test('stale in-flight payment and setup states recover instead of blocking forever', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_stale' } });
  db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,account_mode,is_verified,created_at,updated_at) VALUES ('shop-a','ACCT_stale1','connected','Bank','1234','test',0,'now','now')");
  const order = await placeHardeningOrder(env, 'shop-a', [{ product_id: 7, quantity: 1 }]);
  const stub = stubFetch(async (url, init) => {
    if (url === 'https://api.paystack.co/transaction/initialize') {
      const payload = JSON.parse(init.body);
      return Response.json({ data: { authorization_url: 'https://checkout.paystack.com/stale-ok', reference: payload.reference } });
    }
    if (url === 'https://api.paystack.co/subaccount') {
      return Response.json({ status: true, data: { subaccount_code: 'ACCT_fresh1', domain: 'test', settlement_bank: '001', account_number: '0123456789', active: true } });
    }
    return undefined;
  });
  try {
    const initialize = ip => worker.fetch(new Request(
      'https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=shop-a',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ order_number: order.order_number }) }
    ), env);
    db.run("UPDATE storefront_orders SET payment_status='initializing',payment_reference='ESHOP_OLD',updated_at=? WHERE order_number=?",
      [new Date().toISOString(), order.order_number]);
    const inFlight = await initialize('203.0.113.1');
    assert.equal(inFlight.status, 409);
    db.run('UPDATE storefront_orders SET updated_at=? WHERE order_number=?',
      [new Date(Date.now() - 20 * 60 * 1000).toISOString(), order.order_number]);
    const recovered = await initialize('203.0.113.1');
    assert.equal(recovered.status, 200);
    const result = await recovered.json();
    assert.equal(result.authorization_url, 'https://checkout.paystack.com/stale-ok');
    const saved = rows('SELECT payment_status,payment_reference FROM storefront_orders WHERE order_number=?', [order.order_number])[0];
    assert.equal(saved.payment_status, 'pending');
    assert.notEqual(saved.payment_reference, 'ESHOP_OLD');

    // A Paystack setup lock left behind by a crashed request.
    db.run("DELETE FROM paystack_subaccounts WHERE tenant_id='shop-a'");
    db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at) VALUES ('shop-a',NULL,'setup_in_progress','','',?,?)",
      [new Date().toISOString(), new Date().toISOString()]);
    const setup = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/subaccount?tenant=shop-a', {
      method: 'POST', headers: ownerHeaders(tokens['shop-a']),
      body: JSON.stringify({
        business_name: 'Shop A', primary_contact_name: 'Owner', primary_contact_email: 'owner@example.test',
        primary_contact_phone: '0711000000', settlement_bank: '001', account_number: '0123456789'
      })
    }), env);
    assert.equal((await setup()).status, 409, 'a fresh lock is respected');
    db.run("UPDATE paystack_subaccounts SET updated_at=? WHERE tenant_id='shop-a'", [new Date(Date.now() - 30 * 60 * 1000).toISOString()]);
    const retried = await setup();
    assert.equal(retried.status, 200, await retried.clone().text());
    assert.equal(rows("SELECT subaccount_code FROM paystack_subaccounts WHERE tenant_id='shop-a'")[0].subaccount_code, 'ACCT_fresh1');
  } finally {
    stub.restore();
  }
});

test('owner tokens from sign-in are capped, revoked on logout and on password reset, never the shop key', async () => {
  const env = {
    DB: createDatabase(),
    TENANTS: createTenantStore(),
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    RESEND_API_KEY: 'test-resend-key',
    EMAIL_FROM: 'Craft <noreply@example.com>'
  };
  const password = 'correct-horse-battery-staple';
  const registered = await registerTestAccount(env, 'token-owner', password);
  const created = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT', headers: ownerHeaders(registered.session_token),
    body: JSON.stringify({ id: 'token-shop', name: 'Token Shop' })
  }), env);
  assert.equal(created.status, 201);
  const shopKey = (await created.json()).owner_token;

  let loginCount = 0;
  const login = async (pass = password) => {
    loginCount += 1;
    const response = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${loginCount}` },
      body: JSON.stringify({ username: 'token-owner', password: pass })
    }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    return { session: body.session_token, owner: body.tenants[0].owner_token };
  };
  const ownerStatus = token => worker.fetch(new Request('https://token-shop.rrobin.co.ke/api/catalog?private=1', {
    headers: { Authorization: `Bearer ${token}` }
  }), env).then(response => response.status);
  const tenantRecord = async () => JSON.parse((await env.TENANTS.get('tenant:token-shop')) || '{}');

  // Logout revokes only that session's owner token.
  const phone = await login();
  const tablet = await login();
  assert.equal(await ownerStatus(phone.owner), 200);
  assert.equal(await ownerStatus(tablet.owner), 200);
  const loggedOut = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/logout', {
    method: 'POST', headers: { Authorization: `Bearer ${phone.session}` }
  }), env);
  assert.equal(loggedOut.status, 200);
  assert.equal(await ownerStatus(phone.owner), 401, 'logout revokes the owner token it minted');
  assert.equal(await ownerStatus(tablet.owner), 200, 'other signed-in devices keep working');
  assert.equal(await ownerStatus(shopKey), 200, 'the shop key itself is never revoked by logout');

  // The per-shop cap drops the oldest tokens only once it is exceeded.
  const minted = [tablet.owner];
  for (let index = 0; index < 22; index += 1) minted.push((await login()).owner);
  assert.equal(await ownerStatus(minted[0]), 401, 'oldest token rotated out past the cap');
  assert.equal(await ownerStatus(minted[2]), 401);
  assert.equal(await ownerStatus(minted.at(-1)), 200);
  assert.equal(await ownerStatus(minted.at(-20)), 200);
  assert.equal((await tenantRecord()).owner_login_tokens.length, 20);

  // Legacy tenants that accumulated unbounded hashes are trimmed on the next sign-in.
  const record = await tenantRecord();
  record.owner_token_hashes = [record.owner_token_hash, ...Array.from({ length: 150 }, (_, index) => `legacy-hash-${index}`)];
  await env.TENANTS.put('tenant:token-shop', JSON.stringify(record));
  const afterTrim = await login();
  const trimmed = await tenantRecord();
  assert.ok(trimmed.owner_token_hashes.length <= 21);
  assert.equal(trimmed.owner_token_hashes[0], record.owner_token_hash);
  assert.equal(await ownerStatus(afterTrim.owner), 200);
  assert.equal(await ownerStatus(shopKey), 200);

  // Password reset revokes every sign-in token (and any unattributable legacy ones), not the shop key.
  const stub = stubFetch(async (url, init) => {
    if (url === 'https://api.resend.com/emails') {
      stub.code = JSON.parse(init.body).text.match(/\b\d{6}\b/)?.[0] || '';
      return Response.json({ id: 'mail' });
    }
    return undefined;
  });
  try {
    const postAuth = (action, body) => worker.fetch(new Request(`https://eshop-storefront.workers.dev/api/auth/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }), env);
    assert.equal((await postAuth('request-reset-code', { email: 'token-owner@example.com' })).status, 200);
    const verified = await postAuth('verify-reset-code', { email: 'token-owner@example.com', code: stub.code });
    const { reset_token: resetToken } = await verified.json();
    const newPassword = 'a-brand-new-correct-horse-staple';
    assert.equal((await postAuth('reset-password', { reset_token: resetToken, password: newPassword })).status, 200);
    assert.equal(await ownerStatus(afterTrim.owner), 401);
    assert.equal(await ownerStatus(minted.at(-1)), 401);
    assert.equal(await ownerStatus(shopKey), 200, 'the original shop key survives a password reset');
    const afterReset = (await tenantRecord());
    assert.deepEqual(afterReset.owner_login_tokens, []);
    assert.deepEqual(afterReset.owner_token_hashes, [afterReset.owner_token_hash]);
    const fresh = await login(newPassword);
    assert.equal(await ownerStatus(fresh.owner), 200);
  } finally {
    stub.restore();
  }
});

function createArchiveBucket(initial = {}) {
  const objects = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? { body: value } : value]));
  return {
    objects,
    async get(key) {
      const object = objects.get(key);
      return object ? {
        body: new Response(object.body).body,
        customMetadata: object.customMetadata || {},
        httpMetadata: object.httpMetadata || {}
      } : null;
    },
    async head(key) {
      const object = objects.get(key);
      return object ? { customMetadata: object.customMetadata || {} } : null;
    },
    async put(key, body, options = {}) {
      objects.set(key, { body: typeof body === 'string' ? body : body, customMetadata: options.customMetadata, httpMetadata: options.httpMetadata });
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...objects.keys()].filter(key => key.startsWith(prefix)).sort();
      const page = keys.slice(0, limit);
      return {
        objects: page.map(key => ({ key, size: String(objects.get(key).body).length })),
        truncated: keys.length > page.length
      };
    }
  };
}

test('deleting a shop erases its data, releases its hostname and reserves the address', async () => {
  const BUSINESS_ARCHIVE = createArchiveBucket({
    'media/shop-a/logo': 'a', 'media/shop-b/logo': 'b',
    'published-sites/shop-a/litrus-mixer/v1.html': '<html></html>', 'published-sites/shop-b/litrus-mixer/v1.html': '<html></html>',
    'business/shop-a/main/snapshot.json': '{}', 'business/shop-b/main/snapshot.json': '{}',
    'push/shop-a/1.json': '{}', 'push/shop-b/1.json': '{}'
  });
  const { env, db, rows, TENANTS, tokens } = await createHardeningEnv({
    tenants: ['shop-a', 'shop-b'],
    extraEnv: { BUSINESS_ARCHIVE, CLOUDFLARE_ZONE_ID: 'zone-1', CLOUDFLARE_API_TOKEN: 'cf-token', CUSTOM_HOSTNAME_TARGET: 'customers.example.test' }
  });
  for (const tenantId of ['shop-a', 'shop-b']) {
    await placeHardeningOrder(env, tenantId, [{ product_id: 7, quantity: 1 }]);
    db.run("INSERT INTO storefront_hold_requests (id,tenant_id,idempotency_key,product_id,product_name,quantity,customer_name,contact,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [crypto.randomUUID(), tenantId, crypto.randomUUID(), '7', 'Tote', 1, 'Visitor', 'v@example.test', 'pending', 'now', 'now']);
    db.run("INSERT INTO storefront_visits (id,tenant_id,visitor_hash,path,device,created_at) VALUES (?,?,?,?,?,?)", [crypto.randomUUID(), tenantId, 'h', '/', 'mobile', 'now']);
    db.run("INSERT INTO storefront_event_daily (tenant_id,day,product_id,event_type,n) VALUES (?,?,?,?,?)", [tenantId, '2026-01-01', '7', 'view', 3]);
    db.run("INSERT INTO newsletter_subscribers (id,tenant_id,email,status,unsubscribe_token,consented_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
      [crypto.randomUUID(), tenantId, 'reader@example.test', 'subscribed', `tok-${tenantId}`, 'now', 'now', 'now']);
    db.run("INSERT INTO push_subscriptions (tenant_id,endpoint_hash,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?)", [tenantId, 'h', 'https://fcm.googleapis.com/x', 'p', 'a', 'now']);
    db.run("INSERT INTO inventory_stock (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)", [tenantId, 'TOTE-7', 5, 'now']);
    db.run("INSERT INTO discount_codes (tenant_id,code,type,value,created_at,updated_at) VALUES (?,?,?,?,?,?)", [tenantId, 'SAVE', 'percent', 10, 'now', 'now']);
    db.run("INSERT INTO owner_notifications (id,tenant_id,kind,title,body,created_at) VALUES (?,?,?,?,?,?)", [crypto.randomUUID(), tenantId, 'order', 't', 'b', 'now']);
    db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,account_mode,is_verified,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [tenantId, `ACCT_${tenantId.replace('-', '')}`, 'connected', 'KCB Bank', '6789', 'test', 0, 'now', 'now']);
    db.run("INSERT INTO paystack_owner_defaults (owner_username,source_tenant_id,created_at,updated_at) VALUES (?,?,?,?)", [`owner-${tenantId}`, tenantId, 'now', 'now']);
    await TENANTS.put(`published-theme:${tenantId}`, '{}');
    await TENANTS.put(`google-site-verification:${tenantId}`, '{}');
  }
  db.run("INSERT INTO custom_hostnames (hostname,tenant_id,cloudflare_hostname_id,status,ssl_status,created_at,updated_at) VALUES ('shop.example.org','shop-a','cfh-1','active','active','now','now')");
  const stub = stubFetch(async (url, init) => {
    if (url.startsWith('https://api.cloudflare.com/client/v4/zones/zone-1/custom_hostnames/')) {
      return Response.json({ success: true, result: { id: 'cfh-1' } });
    }
    return undefined;
  });
  try {
    const anonymous = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/shop-a', { method: 'DELETE' }), env);
    assert.equal(anonymous.status, 401);
    const wrongKey = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/shop-a', {
      method: 'DELETE', headers: ownerHeaders(tokens['shop-b'])
    }), env);
    assert.equal(wrongKey.status, 401);

    const deleted = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/shop-a', {
      method: 'DELETE', headers: ownerHeaders(tokens['shop-a'])
    }), env);
    assert.equal(deleted.status, 200);
    const report = await deleted.json();
    assert.equal(report.ok, true);
    assert.equal(report.custom_hostname_released, true);
    assert.deepEqual(report.failed_tables, []);
    assert.equal(report.paystack_subaccount, 'removed');
    assert.equal(report.r2_objects_deleted, 4);
    const releases = stub.calls.filter(call => call.init.method === 'DELETE');
    assert.equal(releases.length, 1);
    assert.match(releases[0].url, /custom_hostnames\/cfh-1$/);
    assert.equal(new Headers(releases[0].init.headers).get('Authorization'), 'Bearer cf-token');
  } finally {
    stub.restore();
  }

  for (const table of [
    'storefront_orders', 'storefront_hold_requests', 'storefront_visits', 'storefront_event_daily',
    'newsletter_subscribers', 'push_subscriptions', 'inventory_stock', 'discount_codes', 'owner_notifications',
    'paystack_subaccounts', 'paystack_owner_defaults', 'catalog_snapshots', 'account_tenants', 'custom_hostnames'
  ]) {
    const column = table === 'paystack_owner_defaults' ? 'source_tenant_id' : 'tenant_id';
    assert.equal(rows(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}='shop-a'`)[0].n, 0, `${table} for the deleted shop is gone`);
  }
  for (const table of ['storefront_orders', 'storefront_hold_requests', 'newsletter_subscribers', 'paystack_subaccounts', 'catalog_snapshots']) {
    assert.equal(rows(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id='shop-b'`)[0].n, 1, `${table} for other shops is untouched`);
  }
  assert.deepEqual([...BUSINESS_ARCHIVE.objects.keys()].sort(), [
    'business/shop-b/main/snapshot.json', 'media/shop-b/logo',
    'published-sites/shop-b/litrus-mixer/v1.html', 'push/shop-b/1.json'
  ]);
  assert.equal(await TENANTS.get('tenant:shop-a'), null);
  assert.equal(await TENANTS.get('published-theme:shop-a'), null);
  assert.equal(await TENANTS.get('google-site-verification:shop-a'), null);
  assert.ok(await TENANTS.get('tenant:shop-b'));
  assert.ok(await TENANTS.get('published-theme:shop-b'));

  // The freed address is reserved: only the previous owner may claim it again.
  const sessionFor = async username => {
    const token = `session-${username}`;
    await TENANTS.put(`session:${await sha256HexForTest(token)}`, JSON.stringify({ username }));
    return token;
  };
  const claim = async username => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT', headers: ownerHeaders(await sessionFor(username)),
    body: JSON.stringify({ id: 'shop-a', name: 'Shop A again' })
  }), env);
  const stranger = await claim('owner-shop-b');
  assert.equal(stranger.status, 409);
  assert.match((await stranger.json()).error, /reserved/);
  assert.equal(await TENANTS.get('tenant:shop-a'), null);
  assert.equal((await claim('owner-shop-a')).status, 201);
});

test('deleting a shop moves a Paystack account that is still the owner default to another of their shops, and survives hostname failures', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({
    tenants: ['multi-1', 'multi-2'],
    extraEnv: { CLOUDFLARE_ZONE_ID: 'zone-1', CLOUDFLARE_API_TOKEN: 'cf-token', CUSTOM_HOSTNAME_TARGET: 'customers.example.test' }
  });
  db.run("UPDATE account_tenants SET username='owner-multi-1' WHERE tenant_id='multi-2'");
  db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,account_mode,is_verified,created_at,updated_at) VALUES ('multi-1','ACCT_multi1','connected','KCB Bank','6789','test',0,'now','now')");
  db.run("INSERT INTO paystack_owner_defaults (owner_username,source_tenant_id,created_at,updated_at) VALUES ('owner-multi-1','multi-1','now','now')");
  db.run("INSERT INTO custom_hostnames (hostname,tenant_id,cloudflare_hostname_id,status,ssl_status,created_at,updated_at) VALUES ('multi.example.org','multi-1','cfh-9','active','active','now','now')");
  const stub = stubFetch(async url => url.includes('api.cloudflare.com') ? new Response('{}', { status: 500 }) : undefined);
  const originalError = console.error;
  console.error = () => {};
  try {
    const deleted = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/multi-1', {
      method: 'DELETE', headers: ownerHeaders(tokens['multi-1'])
    }), env);
    assert.equal(deleted.status, 200);
    const report = await deleted.json();
    assert.equal(report.custom_hostname_released, false, 'a Cloudflare failure is reported, not hidden');
    assert.equal(report.paystack_subaccount, 'moved_to_owner_default_shop');
  } finally {
    console.error = originalError;
    stub.restore();
  }
  // No row keyed by the deleted shop survives; the owner's default now lives on the shop they still have.
  assert.equal(rows("SELECT COUNT(*) AS n FROM paystack_subaccounts WHERE tenant_id='multi-1'")[0].n, 0);
  assert.equal(rows("SELECT subaccount_code FROM paystack_subaccounts WHERE tenant_id='multi-2'")[0].subaccount_code, 'ACCT_multi1');
  assert.equal(rows("SELECT source_tenant_id FROM paystack_owner_defaults WHERE owner_username='owner-multi-1'")[0].source_tenant_id, 'multi-2');
  assert.equal(rows("SELECT COUNT(*) AS n FROM paystack_owner_defaults WHERE source_tenant_id='multi-1'")[0].n, 0);
  assert.equal(rows("SELECT COUNT(*) AS n FROM custom_hostnames WHERE tenant_id='multi-1'")[0].n, 0, 'the local route is dropped even if Cloudflare release failed');
});

const LITRUS_HTML = '<!doctype html><html><head><title>Litrus</title></head><body><div id="store"></div><script>window.LITRUS_LIVE_CATALOG_VERSION=1;</script></body></html>';
const LITRUS_CATALOG = {
  products: [
    { id: 7, slug: 'canvas-tote', name: 'Canvas Tote', price: 12.5, stock: 5, description: 'A sturdy everyday tote.', images: ['/media/shop-a/tote.jpg'], category_id: 1 },
    { id: 8, slug: 'enamel-mug', name: 'Enamel Mug', price: 5, stock: 0, category_id: 1 }
  ],
  categories: [{ id: 1, slug: 'bags', name: 'Bags' }],
  pages: [{ slug: 'about', title: 'About us', content: 'We make things.', published: true }],
  store: { name: 'Litrus Shop', currency: 'KES', website_theme_id: 'litrus-mixer', description: 'Handmade goods in Nairobi.' }
};
const PUBLISHED_VERSION = '2026-01-01T00:00:00.000Z';

async function createStorefrontHardeningEnv({ catalog = LITRUS_CATALOG, publish = { themeId: 'litrus-mixer' } } = {}) {
  const BUSINESS_ARCHIVE = createArchiveBucket();
  const harness = await createHardeningEnv({ catalog, tenants: ['shop-a'], extraEnv: { BUSINESS_ARCHIVE } });
  const publishTheme = async (themeId, html = LITRUS_HTML, version = PUBLISHED_VERSION) => {
    const key = `published-sites/shop-a/${themeId}/v-${version.replace(/\D/g, '')}.html`;
    BUSINESS_ARCHIVE.objects.set(key, {
      body: html, customMetadata: { themeId, catalogUpdatedAt: version }, httpMetadata: { contentType: 'text/html; charset=utf-8' }
    });
    await harness.TENANTS.put('published-theme:shop-a', JSON.stringify({ key, themeId, catalogUpdatedAt: version }));
    const tenant = JSON.parse(await harness.TENANTS.get('tenant:shop-a'));
    await harness.TENANTS.put('tenant:shop-a', JSON.stringify({ ...tenant, catalog_updated_at: version }));
    return key;
  };
  if (publish) await publishTheme(publish.themeId);
  return { ...harness, BUSINESS_ARCHIVE, publishTheme };
}

const storefrontGet = (env, path) => worker.fetch(new Request(`https://shop-a.rrobin.co.ke${path}`), env);

test('Litrus product pages are crawlable: real URLs, Product JSON-LD, sitemap entries and a hash bridge', async () => {
  const { env } = await createStorefrontHardeningEnv();
  const product = await storefrontGet(env, '/products/canvas-tote');
  assert.equal(product.status, 200);
  const html = await product.text();
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  const productSchema = jsonLd.find(entry => entry['@type'] === 'Product');
  assert.equal(productSchema.name, 'Canvas Tote');
  assert.equal(productSchema.offers.price, '12.50');
  assert.equal(productSchema.offers.priceCurrency, 'KES');
  assert.equal(productSchema.offers.availability, 'https://schema.org/InStock');
  assert.equal(productSchema.offers.url, 'https://shop-a.rrobin.co.ke/products/canvas-tote');
  assert.match(html, /<link rel="canonical" href="https:\/\/shop-a\.rrobin\.co\.ke\/products\/canvas-tote">/);
  assert.match(html, /<meta name="robots" content="index,follow/);
  // The Litrus runtime is hash routed (#/p/<id>); the page opens the right product for visitors.
  assert.match(html, /history\.replaceState\(null,"",location\.pathname\+location\.search\+"#\/p\/7"\)/);
  assert.match(html, /<noscript>[\s\S]*Canvas Tote[\s\S]*<\/noscript>/);

  const outOfStock = await (await storefrontGet(env, '/products/enamel-mug')).text();
  assert.match(outOfStock, /schema\.org\/OutOfStock/);
  assert.equal((await storefrontGet(env, '/products/does-not-exist')).status, 404);

  // Categories and pages have no Litrus route, so they are not advertised and never claim their own URL.
  const category = await storefrontGet(env, '/categories/bags');
  assert.equal(category.status, 200);
  const categoryHtml = await category.text();
  assert.doesNotMatch(categoryHtml, /"@type":"Product"/);
  assert.match(categoryHtml, /<link rel="canonical" href="https:\/\/shop-a\.rrobin\.co\.ke\/">/);

  const sitemap = await (await storefrontGet(env, '/sitemap.xml')).text();
  assert.match(sitemap, /<loc>https:\/\/shop-a\.rrobin\.co\.ke\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/shop-a\.rrobin\.co\.ke\/products\/canvas-tote<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/shop-a\.rrobin\.co\.ke\/products\/enamel-mug<\/loc>/);
  assert.doesNotMatch(sitemap, /\/categories\/|\/pages\//);
});

test('seo helpers route Litrus by product only while other themes keep their behaviour', async () => {
  const { buildSitemap, buildSeo, isPathRouted } = await import('../cloudflare/seo.js');
  assert.equal(isPathRouted('litrus-mixer'), true);
  assert.equal(isPathRouted('litrus-mixer', 'product'), true);
  assert.equal(isPathRouted('litrus-mixer', 'category'), false);
  assert.equal(isPathRouted('classic', 'category'), true);
  assert.equal(isPathRouted('elora-linen'), false);
  const origin = 'https://shop.example.test';
  const classic = buildSitemap(LITRUS_CATALOG, origin, 'classic');
  assert.match(classic, /\/categories\/bags/);
  assert.match(classic, /\/pages\/about/);
  assert.doesNotMatch(buildSitemap(LITRUS_CATALOG, origin, 'elora-linen'), /\/products\//);
  const seo = buildSeo({ catalog: LITRUS_CATALOG, pathname: '/products/canvas-tote', origin, themeId: 'litrus-mixer' });
  assert.equal(seo.kind, 'product');
  assert.equal(seo.path, '/products/canvas-tote');
  assert.equal(seo.jsonLd[0]['@type'], 'Product');
  const asCategory = buildSeo({ catalog: LITRUS_CATALOG, pathname: '/categories/bags', origin, themeId: 'litrus-mixer' });
  assert.equal(asCategory.path, '/');
  assert.equal(asCategory.jsonLd[0]['@type'], 'Store');
});

test('a shop keeps serving its last published storefront while the catalogue is ahead of it', async () => {
  const { env, db, BUSINESS_ARCHIVE, TENANTS } = await createStorefrontHardeningEnv();
  const fresh = await storefrontGet(env, '/');
  assert.equal(fresh.status, 200);
  const [key] = [...BUSINESS_ARCHIVE.objects.keys()];
  const publishedMetadata = BUSINESS_ARCHIVE.objects.get(key).customMetadata.catalogUpdatedAt;

  // The owner saves a new catalogue (price change) but has not republished the theme yet.
  const updated = { ...LITRUS_CATALOG, products: [{ ...LITRUS_CATALOG.products[0], price: 15 }, LITRUS_CATALOG.products[1]] };
  db.run('UPDATE catalog_snapshots SET payload=?,admin_payload=?,updated_at=? WHERE tenant_id=?',
    [JSON.stringify(updated), JSON.stringify(updated), '2026-02-01T00:00:00.000Z', 'shop-a']);
  // handleCatalog records the new version on the tenant record when it saves the catalogue.
  const tenantRecord = JSON.parse(await TENANTS.get('tenant:shop-a'));
  await TENANTS.put('tenant:shop-a', JSON.stringify({ ...tenantRecord, catalog_updated_at: '2026-02-01T00:00:00.000Z' }));
  const during = await storefrontGet(env, '/');
  assert.equal(during.status, 200, 'previously a 503 until the republish finished');
  const body = await during.text();
  assert.match(body, /"price":15/, 'the live catalogue data is injected into the last published storefront');
  assert.match(body, /LITRUS_LIVE_CATALOG_VERSION/);
  assert.equal(BUSINESS_ARCHIVE.objects.get(key).customMetadata.catalogUpdatedAt, publishedMetadata,
    'the stored published version is not overwritten while stale');
  assert.equal((await storefrontGet(env, '/products/canvas-tote')).status, 200);
});

test('retired and unknown themes keep serving stored HTML, never publish anew, and otherwise show a clear 404', async () => {
  // Legacy shops published before the hosted themes were removed keep working.
  const legacyCatalog = { ...LITRUS_CATALOG, store: { ...LITRUS_CATALOG.store, website_theme_id: 'elora-linen' } };
  const legacy = await createStorefrontHardeningEnv({ catalog: legacyCatalog, publish: null });
  await legacy.publishTheme('elora-linen', '<!doctype html><html><head><title>Elora</title></head><body><main id="legacy-elora">Legacy</main></body></html>');
  const legacyPage = await storefrontGet(legacy.env, '/');
  assert.equal(legacyPage.status, 200);
  assert.match(await legacyPage.text(), /legacy-elora/);

  // The catalogue names a theme that no longer exists: serve the last published storefront instead of an error.
  const unknownCatalog = { ...LITRUS_CATALOG, store: { ...LITRUS_CATALOG.store, website_theme_id: 'deleted-theme-xyz' } };
  const unknownWithPointer = await createStorefrontHardeningEnv({ catalog: unknownCatalog });
  const unknownPage = await storefrontGet(unknownWithPointer.env, '/');
  assert.equal(unknownPage.status, 200);
  assert.match(await unknownPage.text(), /LITRUS_LIVE_CATALOG_VERSION/);

  // Nothing published at all: a clear HTML 404 rather than a bare 404/503.
  const unpublished = await createStorefrontHardeningEnv({ catalog: unknownCatalog, publish: null });
  const missing = await storefrontGet(unpublished.env, '/');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.match(await missing.text(), /This website is not available/);

  // New publishes are limited to the active themes; theme skeleton routes are gone.
  const { env, tokens } = unpublished;
  const publish = themeId => worker.fetch(new Request('https://shop-a.rrobin.co.ke/api/theme-publish', {
    method: 'POST', headers: ownerHeaders(tokens['shop-a']),
    body: JSON.stringify({ theme_id: themeId, html: '<!doctype html>', catalog_updated_at: PUBLISHED_VERSION })
  }), env);
  assert.equal((await publish('elora-linen')).status, 422);
  assert.equal((await publish('aurex-electronics')).status, 422);
  assert.notEqual((await publish('litrus-mixer')).status, 422, 'Litrus Mixer can still publish');
  const skeleton = await worker.fetch(new Request('https://shop-a.rrobin.co.ke/theme-skeletons/litrus-mixer/index.html', {
    headers: { 'X-Eshop-Theme-Internal': 'preview' }
  }), env);
  assert.equal(skeleton.status, 404);
  const builder = await worker.fetch(new Request('https://shop-a.rrobin.co.ke/builder-storefront.html'), {
    ...env, ASSETS: { async fetch() { return new Response('retired', { status: 404 }); } }
  });
  assert.equal(builder.status, 404);
});

test('scheduled retention prunes old analytics, notifications and counters but keeps recent rows', async () => {
  const wranglerConfig = JSON.parse(await readFile(new URL('../cloudflare/wrangler.jsonc', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(wranglerConfig.triggers?.crons) && wranglerConfig.triggers.crons.length === 1);
  const { env, db, rows } = await createHardeningEnv();
  const today = new Date().toISOString();
  const old = new Date(Date.now() - 500 * 86_400_000).toISOString();
  db.run("INSERT INTO storefront_event_daily (tenant_id,day,product_id,event_type,n) VALUES ('shop-a',?,'7','view',1),('shop-a',?,'7','view',1)", [old.slice(0, 10), today.slice(0, 10)]);
  db.run("INSERT INTO storefront_visits (id,tenant_id,visitor_hash,path,device,created_at) VALUES ('old','shop-a','h','/','mobile',?),('new','shop-a','h','/','mobile',?)", [old, today]);
  db.run("INSERT INTO owner_notifications (id,tenant_id,kind,title,body,created_at) VALUES ('old','shop-a','order','t','b',?),('new','shop-a','order','t','b',?)",
    [new Date(Date.now() - 120 * 86_400_000).toISOString(), today]);
  db.run("INSERT INTO rate_limit_counters (key,window_start,count) VALUES ('stale',1000,5),('live',?,1)", [Math.floor(Date.now() / 1000)]);
  const ctx = hardeningCtx();
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    await worker.scheduled({ cron: '17 3 * * *' }, env, ctx);
    await ctx.settle();
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(rows('SELECT day FROM storefront_event_daily').map(row => row.day), [today.slice(0, 10)]);
  assert.deepEqual(rows('SELECT id FROM storefront_visits').map(row => row.id), ['new']);
  assert.deepEqual(rows('SELECT id FROM owner_notifications').map(row => row.id), ['new']);
  assert.deepEqual(rows('SELECT key FROM rate_limit_counters').map(row => row.key), ['live']);
  assert.ok(logs.some(line => line.includes('Retention cleanup finished')));
  // A missing table (unmigrated environment) is reported, not thrown.
  db.run('DROP TABLE owner_notifications');
  await worker.scheduled({}, env, hardeningCtx());
});

const DISCOUNT_CATALOG = {
  products: [
    { id: 7, name: 'Canvas Tote', sku: 'TOTE-7', price: 12.5, stock: 100 },
    { id: 8, name: 'Enamel Mug', sku: 'MUG-8', price: 5, stock: 100 }
  ],
  categories: [],
  store: { currency: 'KES', name: 'Discount Shop', delivery_fee: 100, free_delivery_over: 0 }
};

test('owners manage discount codes: validation, tenant scoping and CRUD', async () => {
  const { env, rows, tokens } = await createHardeningEnv({ catalog: DISCOUNT_CATALOG });
  const call = (tenantId, method, body, token = tokens[tenantId], search = '') => worker.fetch(new Request(
    `https://eshop-storefront.workers.dev/api/store/discounts?tenant=${tenantId}${search}`,
    { method, headers: token ? ownerHeaders(token) : { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }
  ), env);
  assert.equal((await call('shop-a', 'GET', null, '')).status, 401);
  assert.equal((await call('shop-a', 'GET', null, tokens['shop-b'])).status, 401);
  assert.equal((await call('shop-a', 'POST', { code: 'SAVE10', type: 'percent', value: 10 }, '')).status, 401);

  for (const [bad, message] of [
    [{ code: 'a', type: 'percent', value: 10 }, 'valid code'],
    [{ code: 'bad code!', type: 'percent', value: 10 }, 'valid code'],
    [{ code: 'BIG', type: 'percent', value: 101 }, 'percent'],
    [{ code: 'ZERO', type: 'percent', value: 0 }, 'percent'],
    [{ code: 'FIXED', type: 'fixed', value: 0 }, 'fixed'],
    [{ code: 'FRAC', type: 'fixed', value: 12.5 }, 'fixed'],
    [{ code: 'KIND', type: 'bogus', value: 10 }, 'type'],
    [{ code: 'MIN', type: 'percent', value: 10, min_order_cents: -1 }, 'min_order'],
    [{ code: 'LIMIT', type: 'percent', value: 10, usage_limit: 0 }, 'usage_limit'],
    [{ code: 'DATES', type: 'percent', value: 10, starts_at: '2030-01-02T00:00:00Z', ends_at: '2030-01-01T00:00:00Z' }, 'ends_at'],
    [{ code: 'WHEN', type: 'percent', value: 10, starts_at: 'tomorrow-ish' }, 'ISO']
  ]) {
    const response = await call('shop-a', 'POST', bad);
    assert.equal(response.status, 400, JSON.stringify(bad));
    if (message !== 'valid code') assert.ok((await response.json()).error);
  }
  const created = await call('shop-a', 'POST', {
    code: 'save10', type: 'percent', value: 10, min_order_cents: 1000, usage_limit: 5,
    starts_at: '2020-01-01T00:00:00Z', ends_at: '2099-01-01T00:00:00Z'
  });
  assert.equal(created.status, 201);
  const discount = (await created.json()).discount;
  assert.deepEqual(discount, {
    code: 'SAVE10', type: 'percent', value: 10, min_order_cents: 1000,
    starts_at: '2020-01-01T00:00:00.000Z', ends_at: '2099-01-01T00:00:00.000Z',
    usage_limit: 5, used_count: 0, active: true, created_at: discount.created_at, updated_at: discount.updated_at
  });
  assert.equal((await call('shop-a', 'POST', { code: 'SAVE10', type: 'fixed', value: 100 })).status, 409);
  assert.equal((await call('shop-b', 'POST', { code: 'SAVE10', type: 'fixed', value: 100 })).status, 201, 'codes are per shop');

  assert.deepEqual((await (await call('shop-a', 'GET')).json()).discounts.map(item => [item.code, item.type]), [['SAVE10', 'percent']]);
  const patched = await call('shop-a', 'PATCH', { code: 'SAVE10', active: false, usage_limit: null, value: 15 });
  assert.equal(patched.status, 200);
  const patchedBody = (await patched.json()).discount;
  assert.equal(patchedBody.active, false);
  assert.equal(patchedBody.usage_limit, null);
  assert.equal(patchedBody.value, 15);
  assert.equal(patchedBody.min_order_cents, 1000, 'unspecified fields are preserved');
  assert.equal((await call('shop-a', 'PATCH', { code: 'NOPE', active: true })).status, 404);
  assert.equal((await call('shop-b', 'PATCH', { code: 'SAVE10', value: 99 })).status, 200);
  assert.equal(rows("SELECT value FROM discount_codes WHERE tenant_id='shop-a'")[0].value, 15, "shop B cannot change shop A's code");
  assert.equal((await call('shop-a', 'DELETE', null, tokens['shop-a'], '&code=save10')).status, 200);
  assert.equal((await call('shop-a', 'DELETE', null, tokens['shop-a'], '&code=SAVE10')).status, 404);
  assert.equal(rows("SELECT COUNT(*) AS n FROM discount_codes WHERE tenant_id='shop-b'")[0].n, 1);
});

test('discount codes are validated and re-priced on the server when an order is placed', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ catalog: DISCOUNT_CATALOG });
  const addCode = (tenantId, fields) => {
    const row = { type: 'percent', value: 10, min_order_cents: 0, starts_at: null, ends_at: null, usage_limit: null, active: 1, ...fields };
    db.run('INSERT INTO discount_codes (tenant_id,code,type,value,min_order_cents,starts_at,ends_at,usage_limit,used_count,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,?,?)',
      [tenantId, row.code, row.type, row.value, row.min_order_cents, row.starts_at, row.ends_at, row.usage_limit, row.active, 'now', 'now']);
  };
  addCode('shop-a', { code: 'SAVE10', value: 10 });
  addCode('shop-a', { code: 'THIRD', value: 33 });
  addCode('shop-a', { code: 'FIVEBOB', type: 'fixed', value: 500 });
  addCode('shop-a', { code: 'HUGE', type: 'fixed', value: 100_000 });
  addCode('shop-a', { code: 'BIGSPEND', value: 50, min_order_cents: 100_000 });
  addCode('shop-a', { code: 'EXPIRED', value: 50, ends_at: '2020-01-01T00:00:00.000Z' });
  addCode('shop-a', { code: 'SOON', value: 50, starts_at: '2099-01-01T00:00:00.000Z' });
  addCode('shop-a', { code: 'OFF', value: 50, active: 0 });
  addCode('shop-a', { code: 'ONCE', value: 10, usage_limit: 1 });
  addCode('shop-b', { code: 'OTHERSHOP', value: 90 });
  const tote = [{ product_id: 7, quantity: 2 }]; // 2500 cents + 10000 cents delivery
  const place = (items, extra, options) => worker.fetch(orderRequest('shop-a', items, extra, { ip: `10.1.0.${Math.floor(Math.random() * 250) + 1}`, ...options }), env);

  const plain = await (await place(tote, {})).json();
  assert.equal(plain.order.discount, 0);
  assert.equal(plain.order.discount_code, null);
  assert.equal(plain.order.total, 125);
  // Client-supplied totals and discounts are never trusted.
  const tampered = await (await place(tote, { discount: 999, discount_cents: 99_900, total: 1, subtotal: 1 })).json();
  assert.equal(tampered.order.discount, 0);
  assert.equal(tampered.order.total, 125);

  const percent = await place(tote, { discount_code: ' save10 ' });
  assert.equal(percent.status, 201);
  const percentOrder = (await percent.json()).order;
  assert.equal(percentOrder.discount_code, 'SAVE10');
  assert.equal(percentOrder.discount, 2.5);
  assert.equal(percentOrder.total, 122.5, 'shipping is not discounted');
  const stored = rows('SELECT discount_cents,total_cents,discount_code FROM storefront_orders WHERE order_number=?', [percentOrder.order_number])[0];
  assert.deepEqual(stored, { discount_cents: 250, total_cents: 12250, discount_code: 'SAVE10' });
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE tenant_id='shop-a' AND code='SAVE10'")[0].used_count, 1);

  // Money stays in whole cents: 33% of 2500 rounds down to 825.
  assert.equal((await (await place(tote, { discount_code: 'THIRD' })).json()).order.discount, 8.25);
  assert.equal((await (await place(tote, { discount_code: 'FIVEBOB' })).json()).order.discount, 5);
  const huge = (await (await place([{ product_id: 8, quantity: 1 }], { discount_code: 'HUGE' })).json()).order;
  assert.equal(huge.discount, 5, 'a fixed discount never exceeds the item subtotal');
  assert.equal(huge.total, 100, 'only shipping remains');

  for (const code of ['BIGSPEND', 'EXPIRED', 'SOON', 'OFF', 'OTHERSHOP', 'MISSING', 'bad code!']) {
    const rejected = await place(tote, { discount_code: code });
    assert.equal(rejected.status, 409, code);
    const body = await rejected.json();
    assert.equal(body.error_code, 'discount_invalid');
  }
  assert.equal(rows("SELECT COUNT(*) AS n FROM storefront_orders WHERE discount_code IS NOT NULL AND discount_code NOT IN ('SAVE10','THIRD','FIVEBOB','HUGE')")[0].n, 0);

  // Usage limits: replays of the same order do not redeem twice, and cancelling gives the use back.
  const key = crypto.randomUUID();
  const onceFirst = await place(tote, { discount_code: 'ONCE' }, { key });
  assert.equal(onceFirst.status, 201);
  const onceReplay = await place(tote, { discount_code: 'ONCE' }, { key });
  assert.equal(onceReplay.status, 200);
  assert.equal((await onceReplay.json()).duplicate, true);
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE tenant_id='shop-a' AND code='ONCE'")[0].used_count, 1);
  const exhausted = await place(tote, { discount_code: 'ONCE' });
  assert.equal(exhausted.status, 409);
  assert.match((await exhausted.json()).error, /usage limit/);
  const onceOrder = (await onceFirst.json()).order;
  const cancel = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    method: 'PATCH', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ order_number: onceOrder.order_number, status: 'cancelled' })
  }), env);
  assert.equal((await cancel()).status, 200);
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE tenant_id='shop-a' AND code='ONCE'")[0].used_count, 0);
  assert.equal((await cancel()).status, 200);
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE tenant_id='shop-a' AND code='ONCE'")[0].used_count, 0, 'cancelling twice gives it back once');
  assert.equal((await place(tote, { discount_code: 'ONCE' })).status, 201);

  // Concurrent checkouts cannot exceed the limit.
  addCode('shop-a', { code: 'THREE', usage_limit: 3 });
  const raced = await Promise.all(Array.from({ length: 8 }, () => place(tote, { discount_code: 'THREE' })));
  assert.equal(raced.filter(response => response.status === 201).length, 3);
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE tenant_id='shop-a' AND code='THREE'")[0].used_count, 3);
});

test('discount validation previews a cart without redeeming and is rate limited', async () => {
  const { env, db, rows } = await createHardeningEnv({ catalog: DISCOUNT_CATALOG });
  db.run("INSERT INTO discount_codes (tenant_id,code,type,value,min_order_cents,used_count,active,created_at,updated_at) VALUES ('shop-a','SAVE10','percent',10,1000,0,1,'now','now')");
  const validate = (body, ip = '203.0.113.9', tenant = 'shop-a') => worker.fetch(new Request(
    `https://eshop-storefront.workers.dev/api/discounts/validate?tenant=${tenant}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) }
  ), env);
  const ok = await (await validate({ code: 'save10', items: [{ product_id: 7, quantity: 2 }] })).json();
  assert.deepEqual(ok, { valid: true, code: 'SAVE10', type: 'percent', subtotal_cents: 2500, discount_cents: 250, discount: 2.5 });
  const belowMinimum = await (await validate({ code: 'SAVE10', items: [{ product_id: 8, quantity: 1 }] })).json();
  assert.equal(belowMinimum.valid, false);
  assert.equal((await (await validate({ code: 'SAVE10', items: [{ product_id: 7, quantity: 2 }] }, '203.0.113.9', 'shop-b')).json()).valid, false);
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE code='SAVE10'")[0].used_count, 0, 'validation never redeems');
  for (let index = 0; index < 28; index += 1) await validate({ code: 'NOPE', items: [{ product_id: 7, quantity: 1 }] });
  const throttled = await validate({ code: 'NOPE', items: [{ product_id: 7, quantity: 1 }] });
  assert.equal(throttled.status, 429);
});

// ---------------------------------------------------------------------------
// Worker review pass: variants, settlement edge cases, directory/serving, give-backs.
// ---------------------------------------------------------------------------
const VARIANT_CATALOG = {
  products: [
    {
      id: 20, name: 'Sneaker', sku: 'SNK-20', price: 25, stock: 7, option1_name: 'Size',
      variants: [
        { id: 'v42', option1_name: 'Size', option1_value: '42', size: '42', color: '', price: 30, stock: 2 },
        { id: 'v43', option1_name: 'Size', option1_value: '43', size: '43', color: '', price: null, stock: 5 }
      ]
    },
    {
      id: 21, name: 'Cap', sku: 'CAP-21', price: 10, stock: 50, option1_name: 'Color',
      variants: [
        { id: 'c-red', option1_name: 'Color', option1_value: 'Red', price: null, stock: 25 },
        { id: 'c-blue', option1_name: 'Color', option1_value: 'Blue', price: 10, stock: 25 }
      ]
    },
    { id: 22, name: 'Plain Mug', sku: 'MUG-22', price: 5, stock: 10 }
  ],
  categories: [],
  store: HARDENING_STORE
};

test('orders price, stock-check and label option variants from the catalogue, never from the client', async () => {
  const { env, rows } = await createHardeningEnv({ catalog: VARIANT_CATALOG });
  const place = (items, extra = {}) => worker.fetch(orderRequest('shop-a', items, extra, { ip: `10.2.0.${Math.floor(Math.random() * 250) + 1}` }), env);
  const reject = async (items, code) => {
    const response = await place(items);
    assert.equal(response.status, 409, JSON.stringify(items));
    assert.equal((await response.json()).error_code, code);
  };
  // A variant that changes the price must be chosen: otherwise the customer would pay the base price.
  await reject([{ product_id: 20, quantity: 1 }], 'variant_required');
  await reject([{ product_id: 20, quantity: 1, variant_id: 'v99' }], 'variant_unavailable');
  await reject([{ product_id: 22, quantity: 1, variant_id: 'v42' }], 'variant_unavailable');
  await reject([{ product_id: 20, quantity: 3, variant_id: 'v42' }], 'variant_out_of_stock');
  await reject([{ product_id: 20, quantity: 1, variant_id: 'v42' }, { product_id: 20, quantity: 2, variant_id: 'v42' }], 'variant_out_of_stock');
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_orders')[0].n, 0);

  const created = await place([
    // Client-supplied prices and labels are ignored.
    { product_id: 20, quantity: 2, variant_id: 'v42', unit_price: 1, variant_label: 'Size: hacked', price: 1 },
    { product_id: 20, quantity: 1, variant_id: 'v43' },
    { product_id: 22, quantity: 1 }
  ]);
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.order.subtotal_cents, 2 * 3000 + 2500 + 500);
  assert.equal(body.order.total_cents, 9000);
  assert.equal(body.order.discount_cents, 0);
  assert.equal(body.discount_cents, 0);
  assert.equal('needs_attention' in body.order, false, 'customers never see owner-only fields');
  const lines = body.order.items.map(({ variant_id, variant_label, unit_price, quantity, option1_name, option1_value }) =>
    ({ variant_id, variant_label, unit_price, quantity, option1_name, option1_value }));
  assert.deepEqual(lines, [
    { variant_id: 'v42', variant_label: 'Size: 42', unit_price: 30, quantity: 2, option1_name: 'Size', option1_value: '42' },
    { variant_id: 'v43', variant_label: 'Size: 43', unit_price: 25, quantity: 1, option1_name: 'Size', option1_value: '43' },
    { variant_id: undefined, variant_label: undefined, unit_price: 5, quantity: 1, option1_name: undefined, option1_value: undefined }
  ]);

  // Older storefronts that cannot send a variant keep working when no option changes the price.
  const legacy = await place([{ product_id: 21, quantity: 2 }]);
  assert.equal(legacy.status, 201);
  assert.equal((await legacy.json()).order.subtotal_cents, 2000);

  // The public discount preview prices variants the same way.
  rows;
  const priced = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/discounts/validate?tenant=shop-a', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' },
    body: JSON.stringify({ code: 'NOPE', items: [{ product_id: 20, quantity: 1, variant_id: 'v42' }] })
  }), env);
  assert.equal((await priced.json()).valid, false);
});

test('rate-limit counters store only a salted hash, and a hold that is not created gives its slot back', async () => {
  const catalog = {
    products: [{ id: 7, name: 'Canvas Tote', sku: 'TOTE-7', price: 12.5, stock: 2, booking_enabled: true }],
    categories: [], store: HARDENING_STORE
  };
  const { env, rows } = await createHardeningEnv({ catalog, extraEnv: { RATE_LIMIT_SALT: 'pepper' } });
  const ip = '203.0.113.77';
  const hold = (key = crypto.randomUUID()) => worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/product-holds?tenant=shop-a', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ idempotency_key: key, product_id: 7, quantity: 1, customer_name: 'Visitor', contact: 'v@example.test' })
    }), env);
  assert.equal((await hold()).status, 201);
  // Stock for holds is 75% of 2 = 1: the second hold is refused and must not burn one of the 3 slots.
  for (let index = 0; index < 5; index += 1) assert.equal((await hold()).status, 409);
  const slots = rows("SELECT count FROM rate_limit_counters WHERE key LIKE 'hold-active:shop-a:%'");
  assert.deepEqual(slots.map(row => row.count), [1]);
  const keys = rows('SELECT key FROM rate_limit_counters').map(row => row.key).join('\n');
  assert.equal(keys.includes(ip), false, 'no raw IP address is stored');
  const unsalted = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  assert.equal(keys.includes(unsalted), false, 'the stored hash cannot be reversed by hashing candidate IPs');
});

test('visit and product-interest beacons are rate limited per connection', async () => {
  const { env } = await createHardeningEnv();
  const visit = ip => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/analytics/visit?tenant=shop-a', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ visitor_id: crypto.randomUUID(), path: '/' })
  }), env);
  for (let index = 0; index < 120; index += 1) assert.equal((await visit('198.51.100.20')).status, 202);
  assert.equal((await visit('198.51.100.20')).status, 429);
  assert.equal((await visit('198.51.100.21')).status, 202);
});

function signedPaystackWebhook(secret, reference, amount) {
  const body = JSON.stringify({
    event: 'charge.success',
    data: { reference, amount, currency: 'KES', status: 'success', domain: 'test', subaccount: { subaccount_code: 'ACCT_test1' } }
  });
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
    .then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
    .then(digest => ({
      body,
      signature: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    }));
}

test('a payment for an order cancelled meanwhile is recorded and flagged, never deducted or lost', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_cancelled' } });
  allocateMug(db, 'shop-a', 3);
  const order = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  const reference = 'ESHOP_00000000000000000000000000000002';
  db.run("UPDATE storefront_orders SET payment_reference=?,payment_subaccount_code='ACCT_test1',payment_status='pending' WHERE order_number=?", [reference, order.order_number]);
  const cancelled = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    method: 'PATCH', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ order_number: order.order_number, status: 'cancelled' })
  }), env);
  assert.equal(cancelled.status, 200);
  const { body, signature } = await signedPaystackWebhook('sk_test_cancelled', reference, 1000);
  const deliver = ctx => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
    method: 'POST', headers: { 'x-paystack-signature': signature }, body
  }), env, ctx);
  const ctx = hardeningCtx();
  assert.equal((await deliver(ctx)).status, 200);
  assert.equal((await deliver(ctx)).status, 200, 'a webhook retry is harmless');
  await ctx.settle();
  const row = rows('SELECT * FROM storefront_orders WHERE order_number=?', [order.order_number])[0];
  assert.equal(row.payment_status, 'paid');
  assert.equal(row.status, 'cancelled');
  assert.equal(row.needs_attention, 1);
  assert.equal(row.attention_reason, 'paid_after_cancel');
  assert.equal(rows('SELECT web_stock FROM main_store_inventory')[0].web_stock, 3, 'a cancelled order does not take stock');
  const notes = rows("SELECT title FROM owner_notifications WHERE kind='attention'");
  assert.equal(notes.length, 1, 'the owner is told once');
  assert.match(notes[0].title, /cancelled order/);
});

test('an order paid by hand that the customer also pays online is flagged as paid twice', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_double' } });
  const order = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  const reference = 'ESHOP_00000000000000000000000000000003';
  db.run("UPDATE storefront_orders SET payment_reference=?,payment_subaccount_code='ACCT_test1',payment_status='pending' WHERE order_number=?", [reference, order.order_number]);
  const manual = await worker.fetch(new Request(`https://eshop-storefront.workers.dev/api/store/orders/${order.order_number}/payment?tenant=shop-a`, {
    method: 'POST', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ method: 'cash' })
  }), env, hardeningCtx());
  assert.equal(manual.status, 200);
  const { body, signature } = await signedPaystackWebhook('sk_test_double', reference, 1000);
  const ctx = hardeningCtx();
  const deliver = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
    method: 'POST', headers: { 'x-paystack-signature': signature }, body
  }), env, ctx);
  assert.equal((await deliver()).status, 200);
  assert.equal((await deliver()).status, 200);
  await ctx.settle();
  const row = rows('SELECT * FROM storefront_orders WHERE order_number=?', [order.order_number])[0];
  assert.equal(row.payment_method, 'cash', 'the recorded method is not overwritten');
  assert.equal(row.needs_attention, 1);
  assert.equal(row.attention_reason, 'duplicate_payment');
  assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE kind='attention'")[0].n, 1);
});

test('webhook, verify-style retries and a manual record racing each other settle once and notify once', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_race' } });
  allocateMug(db, 'shop-a', 3);
  const first = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  const second = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  db.run("UPDATE storefront_orders SET payment_reference='ESHOP_00000000000000000000000000000004',payment_subaccount_code='ACCT_test1',payment_status='pending' WHERE order_number=?", [first.order_number]);
  db.run("UPDATE storefront_orders SET payment_reference='ESHOP_00000000000000000000000000000005',payment_subaccount_code='ACCT_test1',payment_status='pending' WHERE order_number=?", [second.order_number]);
  const hook = async (reference, ctx) => {
    const { body, signature } = await signedPaystackWebhook('sk_test_race', reference, 1000);
    return worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
      method: 'POST', headers: { 'x-paystack-signature': signature }, body
    }), env, ctx);
  };
  const manual = (orderNumber, ctx) => worker.fetch(new Request(`https://eshop-storefront.workers.dev/api/store/orders/${orderNumber}/payment?tenant=shop-a`, {
    method: 'POST', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ method: 'bank' })
  }), env, ctx);
  const ctx = hardeningCtx();
  // The first order takes 2 of 3 mugs. The second then needs 2 with 1 left: short, so it is flagged.
  assert.equal((await hook('ESHOP_00000000000000000000000000000004', ctx)).status, 200);
  const results = await Promise.all([
    hook('ESHOP_00000000000000000000000000000005', ctx), hook('ESHOP_00000000000000000000000000000005', ctx),
    manual(second.order_number, ctx), hook('ESHOP_00000000000000000000000000000005', ctx)
  ]);
  assert.deepEqual(results.map(response => response.status), [200, 200, 200, 200]);
  await ctx.settle();
  assert.equal(rows('SELECT web_stock FROM main_store_inventory')[0].web_stock, 1);
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_inventory_deductions')[0].n, 1);
  assert.equal(rows("SELECT payment_status FROM storefront_orders WHERE order_number=?", [second.order_number])[0].payment_status, 'paid');
  // Racing identical settlements raise the stock problem once. If the hand-recorded payment won the race,
  // the online payment that followed really is a second payment and is reported once as such.
  assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE kind='attention' AND title LIKE 'Payment received, stock short%'")[0].n, 1, 'one alert for one problem');
  const paidTwice = rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE kind='attention' AND title LIKE 'Paid twice%'")[0].n;
  const method = rows('SELECT payment_method FROM storefront_orders WHERE order_number=?', [second.order_number])[0].payment_method;
  assert.equal(paidTwice, method ? 1 : 0, 'a double-payment alert appears only when the manual record was the first payment, and only once');
});

test('cancelling an order in parallel gives a discount redemption back exactly once', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ catalog: DISCOUNT_CATALOG });
  db.run("INSERT INTO discount_codes (tenant_id,code,type,value,used_count,active,created_at,updated_at) VALUES ('shop-a','TEN','percent',10,0,1,'now','now')");
  const one = await placeHardeningOrder(env, 'shop-a', [{ product_id: 7, quantity: 1 }], { discount_code: 'TEN' });
  await placeHardeningOrder(env, 'shop-a', [{ product_id: 7, quantity: 1 }], { discount_code: 'TEN' });
  assert.equal(one.discount_code, 'TEN');
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE code='TEN'")[0].used_count, 2);
  const cancel = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    method: 'PATCH', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ order_number: one.order_number, status: 'cancelled' })
  }), env);
  const results = await Promise.all([cancel(), cancel(), cancel()]);
  assert.deepEqual(results.map(response => response.status), [200, 200, 200]);
  assert.equal(rows("SELECT used_count FROM discount_codes WHERE code='TEN'")[0].used_count, 1);
});

test('retention keeps long-lived hold counters but prunes everything else that expired', async () => {
  const { env, rows } = await createHardeningEnv();
  const nowSeconds = Math.floor(Date.now() / 1000);
  env.DB.prepare('INSERT INTO rate_limit_counters (key,window_start,count) VALUES (?,?,1)').bind('hold-active:shop-a:recent', nowSeconds - 5 * 86_400).run();
  env.DB.prepare('INSERT INTO rate_limit_counters (key,window_start,count) VALUES (?,?,1)').bind('hold-active:shop-a:ancient', nowSeconds - 40 * 86_400).run();
  env.DB.prepare('INSERT INTO rate_limit_counters (key,window_start,count) VALUES (?,?,1)').bind('order-ip:shop-a:old', nowSeconds - 5 * 86_400).run();
  await worker.scheduled({ cron: '17 3 * * *' }, env, hardeningCtx());
  assert.deepEqual(rows('SELECT key FROM rate_limit_counters ORDER BY key').map(row => row.key), ['hold-active:shop-a:recent']);
});

test('a shop that names no hosted theme still serves its last published storefront, and the directory lists only served shops', async () => {
  const classicCatalog = { ...LITRUS_CATALOG, store: { ...LITRUS_CATALOG.store, website_theme_id: 'classic' } };
  // Published before the catalogue stopped naming a hosted theme: still served.
  const published = await createStorefrontHardeningEnv({ catalog: classicCatalog });
  const page = await storefrontGet(published.env, '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /LITRUS_LIVE_CATALOG_VERSION/);
  // Never published: a plain "not available" page, not a 503 and not an empty shell.
  const never = await createStorefrontHardeningEnv({ catalog: classicCatalog, publish: null });
  const missing = await storefrontGet(never.env, '/');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /not available/);

  // The directory (and so sitemap.xml and /shops) lists the shop that serves a page, not the one that does not.
  const { env, db, TENANTS } = await createStorefrontHardeningEnv({ catalog: classicCatalog });
  const catalogJson = JSON.stringify(classicCatalog);
  db.run('INSERT INTO catalog_snapshots (tenant_id,payload,admin_payload,updated_at) VALUES (?,?,?,?)', ['shop-unpublished', catalogJson, catalogJson, PUBLISHED_VERSION]);
  await TENANTS.put('tenant:shop-unpublished', JSON.stringify({ id: 'shop-unpublished', name: 'Unpublished' }));
  await TENANTS.put('tenant:main', JSON.stringify({ id: 'main', name: 'Main' }));
  const directory = await worker.fetch(new Request('https://rrobin.co.ke/shops'), env);
  assert.equal(directory.status, 200);
  const html = await directory.text();
  assert.match(html, /shop-a\.rrobin\.co\.ke/);
  assert.doesNotMatch(html, /shop-unpublished/);

  // The catalogue moves ahead of the publish: the shop is still served, so it stays listed.
  db.run("UPDATE catalog_snapshots SET updated_at='2026-03-01T00:00:00.000Z' WHERE tenant_id='shop-a'");
  await TENANTS.delete('directory:v1');
  assert.match(await (await worker.fetch(new Request('https://rrobin.co.ke/shops'), env)).text(), /shop-a\.rrobin\.co\.ke/);
});

test('deleting a shop also drops it from the cached shop directory', async () => {
  const { env, TENANTS, tokens } = await createHardeningEnv({ tenants: ['shop-a'] });
  await TENANTS.put('directory:v1', JSON.stringify({ built_at: Date.now(), shops: [{ id: 'shop-a', name: 'A', url: 'https://shop-a.rrobin.co.ke/' }] }));
  const deleted = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/shop-a', {
    method: 'DELETE', headers: ownerHeaders(tokens['shop-a'])
  }), env);
  assert.equal(deleted.status, 200);
  assert.equal(await TENANTS.get('directory:v1'), null);
});

test('recovering a shop key by admin also revokes the owner tokens minted at sign-in', async () => {
  const { env, TENANTS } = await createHardeningEnv({ tenants: ['shop-a'], extraEnv: { PUBLISH_TOKEN: 'admin-recovery' } });
  const tenant = JSON.parse(await TENANTS.get('tenant:shop-a'));
  await TENANTS.put('tenant:shop-a', JSON.stringify({
    ...tenant, owner_login_tokens: [{ hash: await sha256HexForTest('login-token'), username: 'owner-shop-a', session: 's', created_at: 'now' }]
  }));
  const asLoginToken = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/store/notifications?tenant=shop-a', {
    headers: ownerHeaders('login-token')
  }), env);
  assert.equal((await asLoginToken()).status, 200);
  const recovered = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/shop-a/owner-key', {
    method: 'PUT', headers: ownerHeaders('admin-recovery')
  }), env);
  assert.equal(recovered.status, 200);
  assert.equal((await asLoginToken()).status, 401);
});

test('every literal SQL statement in worker.js compiles against the fully migrated schema', async () => {
  const { db } = await createMigratedD1();
  const source = (await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const failures = [];
  let compiled = 0;
  for (const match of source.matchAll(/\.prepare\(\s*(["`])/g)) {
    const quote = match[1];
    let index = match.index + match[0].length;
    let text = '';
    while (index < source.length && source[index] !== quote) {
      if (source[index] === '\\') { text += source[index + 1]; index += 2; continue; }
      text += source[index++];
    }
    // Statements built from expressions (table names, joined strings) are skipped; they have their own tests.
    if (text.includes('${') || !/^\s*[,)]/.test(source.slice(index + 1))) continue;
    const line = source.slice(0, match.index).split('\n').length;
    try {
      db.prepare(text).free();
      compiled += 1;
    } catch (error) {
      failures.push(`worker.js:${line} ${error.message}`);
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(compiled > 150, `expected to compile 150+ statements, compiled ${compiled}`);
});

test('a deleted shop never passes its Paystack payout account to whoever later claims the same address', async () => {
  const { env, db, rows, tokens, TENANTS } = await createHardeningEnv({
    tenants: ['shop-old', 'shop-keep'],
    extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_hijack' }
  });
  db.run("UPDATE account_tenants SET username='owner-shop-old' WHERE tenant_id='shop-keep'");
  db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,account_mode,is_verified,created_at,updated_at) VALUES ('shop-old','ACCT_previous_owner','connected','KCB Bank','6789','test',0,'now','now')");
  db.run("INSERT INTO paystack_owner_defaults (owner_username,source_tenant_id,created_at,updated_at) VALUES ('owner-shop-old','shop-old','now','now')");
  const deleted = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants/shop-old', {
    method: 'DELETE', headers: ownerHeaders(tokens['shop-old'])
  }), env);
  assert.equal(deleted.status, 200);
  assert.equal(rows("SELECT COUNT(*) AS n FROM paystack_subaccounts WHERE tenant_id='shop-old'")[0].n, 0);
  // The tombstone expires; a different account takes the address.
  await TENANTS.delete('tenant-tombstone:shop-old');
  await TENANTS.put('session:' + await sha256HexForTest('stranger-session'), JSON.stringify({ username: 'stranger' }));
  db.run("INSERT INTO accounts (username,password_salt,password_hash,email,created_at) VALUES ('stranger','s','h','stranger@example.test','now')");
  const claimed = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT', headers: ownerHeaders('stranger-session'), body: JSON.stringify({ id: 'shop-old', name: 'Fresh Shop' })
  }), env);
  assert.equal(claimed.status, 201);
  db.run("INSERT INTO storefront_orders (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,shipping_address,currency,subtotal_cents,discount_cents,shipping_cents,total_cents,items_json,created_at,updated_at,payment_status) VALUES ('shop-old','ORD-HIJACKTEST0001',?,'pending','Pat','pat@customer.example','1 Road','KES',1000,0,0,1000,'[]','now','now','unpaid')", [crypto.randomUUID()]);
  const stub = stubFetch(async () => new Response('{}', { status: 500 }));
  try {
    const initialize = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=shop-old', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.99' },
      body: JSON.stringify({ order_number: 'ORD-HIJACKTEST0001' })
    }), env);
    assert.equal(initialize.status, 409, 'the new shop has no payout account of its own');
    assert.equal(stub.calls.filter(call => call.url.includes('paystack')).length, 0, 'Paystack is never called with the old account');
  } finally {
    stub.restore();
  }
});

test('an owner default that survives on a shop whose address is later reused is cleared when the address is claimed again', async () => {
  const { env, db, rows, TENANTS } = await createHardeningEnv({ tenants: ['shop-x'] });
  // Simulates rows left behind by an older worker version (before deletion moved the default).
  db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,account_mode,is_verified,created_at,updated_at) VALUES ('shop-reused','ACCT_leftover','connected','','','test',0,'now','now')");
  db.run("INSERT INTO paystack_owner_defaults (owner_username,source_tenant_id,created_at,updated_at) VALUES ('someone-else','shop-reused','now','now')");
  await TENANTS.put('session:' + await sha256HexForTest('newcomer-session'), JSON.stringify({ username: 'newcomer' }));
  db.run("INSERT INTO accounts (username,password_salt,password_hash,email,created_at) VALUES ('newcomer','s','h','newcomer@example.test','now')");
  const claimed = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT', headers: ownerHeaders('newcomer-session'), body: JSON.stringify({ id: 'shop-reused', name: 'Reused' })
  }), env);
  assert.equal(claimed.status, 201);
  assert.equal(rows("SELECT COUNT(*) AS n FROM paystack_subaccounts WHERE tenant_id='shop-reused'")[0].n, 0);
  assert.equal(rows("SELECT COUNT(*) AS n FROM paystack_owner_defaults WHERE source_tenant_id='shop-reused'")[0].n, 0);
});

test('public write endpoints reject made-up shops before taking a rate-limit slot or writing any row', async () => {
  const { env, rows } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_ghost' } });
  const post = (path, body) => worker.fetch(new Request(`https://eshop-storefront.workers.dev${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' }, body: JSON.stringify(body)
  }), env);
  for (let index = 0; index < 40; index += 1) {
    const ghost = `ghost-${index}`;
    assert.equal((await post(`/api/orders?tenant=${ghost}`, { items: [] })).status, 404);
    assert.equal((await post(`/api/product-holds?tenant=${ghost}`, { items: [] })).status, 404);
    assert.equal((await post(`/api/discounts/validate?tenant=${ghost}`, { code: 'X', items: [] })).status, 404);
    assert.equal((await post(`/api/payments/paystack/initialize?tenant=${ghost}`, { order_number: 'ORD-DOESNOTEXIST01' })).status, 404);
    assert.equal((await post(`/api/service-appointments?tenant=${ghost}`, {})).status, 404);
  }
  assert.equal(rows('SELECT COUNT(*) AS n FROM rate_limit_counters')[0].n, 0, 'no counter row for shops that do not exist');
  // A real shop still gets limited as before.
  assert.equal((await post('/api/product-holds?tenant=shop-a', { items: [] })).status, 400);
  assert.equal(rows('SELECT COUNT(*) AS n FROM rate_limit_counters')[0].n, 1);
});

test('a second payment for an order that is already flagged still alerts the owner once', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_flagged' } });
  const order = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 2 }]);
  const reference = 'ESHOP_00000000000000000000000000000006';
  db.run("UPDATE storefront_orders SET payment_reference=?,payment_subaccount_code='ACCT_test1',payment_status='pending' WHERE order_number=?", [reference, order.order_number]);
  const manual = await worker.fetch(new Request(`https://eshop-storefront.workers.dev/api/store/orders/${order.order_number}/payment?tenant=shop-a`, {
    method: 'POST', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ method: 'cash' })
  }), env, hardeningCtx());
  assert.equal(manual.status, 200);
  // Stock ran short at manual settlement: the order is already flagged for something else.
  db.run("UPDATE storefront_orders SET needs_attention=1,attention_reason='insufficient_stock:TOTE-7' WHERE order_number=?", [order.order_number]);
  const { body, signature } = await signedPaystackWebhook('sk_test_flagged', reference, 1000);
  const ctx = hardeningCtx();
  const deliver = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
    method: 'POST', headers: { 'x-paystack-signature': signature }, body
  }), env, ctx);
  assert.equal((await deliver()).status, 200);
  assert.equal((await deliver()).status, 200);
  await ctx.settle();
  const row = rows('SELECT * FROM storefront_orders WHERE order_number=?', [order.order_number])[0];
  assert.equal(row.attention_reason, 'insufficient_stock:TOTE-7;duplicate_payment', 'the earlier reason is kept and the duplicate added');
  const notes = rows("SELECT title FROM owner_notifications WHERE kind='attention'");
  assert.equal(notes.length, 1);
  assert.match(notes[0].title, /Paid twice/);
});

test('reopening a cancelled order re-reserves its discount, so cancel-reopen-cancel never over-releases', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ catalog: DISCOUNT_CATALOG });
  db.run("INSERT INTO discount_codes (tenant_id,code,type,value,usage_limit,used_count,active,created_at,updated_at) VALUES ('shop-a','ONCE','percent',10,1,0,1,'now','now')");
  const patch = (orderNumber, status) => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    method: 'PATCH', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ order_number: orderNumber, status })
  }), env);
  const used = () => rows("SELECT used_count FROM discount_codes WHERE code='ONCE'")[0].used_count;
  const orderA = await placeHardeningOrder(env, 'shop-a', [{ product_id: 7, quantity: 1 }], { discount_code: 'ONCE' });
  assert.equal(used(), 1);
  assert.equal((await patch(orderA.order_number, 'cancelled')).status, 200);
  assert.equal(used(), 0);
  assert.equal((await patch(orderA.order_number, 'cancelled')).status, 200, 'cancelling twice is harmless');
  assert.equal(used(), 0);
  // Reopening takes the redemption back; the code cannot then be used by a new order.
  assert.equal((await patch(orderA.order_number, 'confirmed')).status, 200);
  assert.equal(used(), 1);
  const refused = await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], { discount_code: 'ONCE' }, { ip: '198.51.100.40' }), env);
  assert.equal(refused.status, 409);
  // Cancelling again gives it back once, and a new order may use it.
  assert.equal((await patch(orderA.order_number, 'cancelled')).status, 200);
  assert.equal(used(), 0);
  const orderB = await placeHardeningOrder(env, 'shop-a', [{ product_id: 7, quantity: 1 }], { discount_code: 'ONCE' });
  assert.equal(used(), 1);
  // A's code is now used by B: A cannot be reopened and stays cancelled; the count is not touched.
  const blocked = await patch(orderA.order_number, 'pending');
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error_code, 'discount_limit_reached');
  assert.equal(rows('SELECT status FROM storefront_orders WHERE order_number=?', [orderA.order_number])[0].status, 'cancelled');
  assert.equal(used(), 1);
  assert.equal((await patch(orderA.order_number, 'cancelled')).status, 200, 'still cancelled, so no second release');
  assert.equal(used(), 1);
  assert.equal(orderB.discount_code, 'ONCE');
  // Plain status changes on an open order keep working.
  assert.equal((await patch(orderB.order_number, 'processing')).status, 200);
  assert.equal(rows('SELECT status FROM storefront_orders WHERE order_number=?', [orderB.order_number])[0].status, 'processing');
});

test('paying an older checkout link after the order was re-initialised still settles the order', async () => {
  const { env, rows, db } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_attempts' } });
  db.run("INSERT INTO paystack_subaccounts (tenant_id,subaccount_code,status,bank_name,account_last4,account_mode,is_verified,created_at,updated_at) VALUES ('shop-a','ACCT_test1','connected','KCB','1234','test',0,'now','now')");
  const order = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 1 }]);
  let verifyStatus = 'abandoned';
  const stub = stubFetch(async (url, init) => {
    if (url.includes('transaction/initialize')) {
      const reference = JSON.parse(init.body).reference;
      return new Response(JSON.stringify({ data: { authorization_url: `https://checkout.paystack.com/${reference}`, reference } }));
    }
    if (url.includes('transaction/verify/')) {
      const reference = decodeURIComponent(url.split('/verify/')[1]);
      return new Response(JSON.stringify({ data: {
        reference, amount: 500, currency: 'KES', status: verifyStatus, domain: 'test', subaccount: { subaccount_code: 'ACCT_test1' }
      } }));
    }
    return undefined;
  });
  const initialize = () => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=shop-a', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.61' },
    body: JSON.stringify({ order_number: order.order_number })
  }), env);
  const verify = reference => worker.fetch(new Request(`https://eshop-storefront.workers.dev/api/payments/paystack/verify?tenant=shop-a&reference=${reference}`), env, hardeningCtx());
  const sign = async raw => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('sk_test_attempts'), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const hook = async (reference, ctx, metadata) => {
    const body = JSON.stringify({ event: 'charge.success', data: {
      reference, amount: 500, currency: 'KES', status: 'success', domain: 'test',
      subaccount: { subaccount_code: 'ACCT_test1' }, ...(metadata ? { metadata } : {})
    } });
    return worker.fetch(new Request('https://eshop-storefront.workers.dev/api/payments/paystack/webhook', {
      method: 'POST', headers: { 'x-paystack-signature': await sign(body) }, body
    }), env, ctx);
  };
  try {
    const first = (await (await initialize()).json()).reference;
    assert.equal((await (await verify(first)).json()).payment_status, 'failed');
    const second = (await (await initialize()).json()).reference;
    assert.notEqual(first, second);
    assert.equal(rows('SELECT payment_reference FROM storefront_orders WHERE order_number=?', [order.order_number])[0].payment_reference, second);
    assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_payment_attempts')[0].n, 2);
    // Verifying the superseded reference as abandoned again must not disturb the current attempt.
    assert.equal((await (await verify(first)).json()).payment_status, 'pending');
    assert.equal(rows('SELECT payment_status FROM storefront_orders WHERE order_number=?', [order.order_number])[0].payment_status, 'pending');
    // The customer finally pays the FIRST link.
    const ctx = hardeningCtx();
    assert.equal((await hook(first, ctx)).status, 200);
    const row = rows('SELECT payment_status,payment_reference,needs_attention FROM storefront_orders WHERE order_number=?', [order.order_number])[0];
    assert.equal(row.payment_status, 'paid');
    assert.equal(row.payment_reference, first, 'the reference that was actually paid is adopted');
    assert.equal(row.needs_attention, 0);
    // A retry of the same webhook is harmless and silent; paying the second link too is a duplicate.
    assert.equal((await hook(first, ctx)).status, 200);
    await ctx.settle();
    assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE kind='attention'")[0].n, 0);
    assert.equal((await hook(second, ctx)).status, 200);
    assert.equal((await hook(second, ctx)).status, 200);
    await ctx.settle();
    assert.equal(rows('SELECT attention_reason FROM storefront_orders WHERE order_number=?', [order.order_number])[0].attention_reason, 'duplicate_payment');
    assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE kind='attention'")[0].n, 1);
    // A reference nobody knows still gets a 404 (Paystack retries), but the owner hears about it once.
    const other = await placeHardeningOrder(env, 'shop-a', [{ product_id: 8, quantity: 1 }]);
    const unmatchedCtx = hardeningCtx();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await hook('ESHOP_FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', unmatchedCtx,
        { tenant_id: 'shop-a', order_number: other.order_number });
      assert.equal(response.status, 404);
      await unmatchedCtx.settle();
    }
    assert.equal(rows("SELECT COUNT(*) AS n FROM owner_notifications WHERE title LIKE 'Unmatched payment%'")[0].n, 1);
    assert.equal(rows('SELECT attention_reason FROM storefront_orders WHERE order_number=?', [other.order_number])[0].attention_reason, 'unmatched_payment');
  } finally {
    stub.restore();
  }
});

// ---------------------------------------------------------------------------
// Contract gaps: optional email, funnel events, public/owner order shapes, orders auth.
// ---------------------------------------------------------------------------
test('email is optional only for orders the shop settles itself, and Paystack still needs one', async () => {
  const { env, rows } = await createHardeningEnv({ extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_optional_email' } });
  const place = (extra, ip) => worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], extra, { ip }), env);
  const noEmail = { customer_email: '' };
  assert.equal((await place({ ...noEmail, payment_method: 'manual' }, '10.9.0.1')).status, 201);
  assert.equal((await place({ ...noEmail, payment_method: 'paystack' }, '10.9.0.2')).status, 400);
  assert.equal((await place({ ...noEmail }, '10.9.0.3')).status, 400, 'older storefronts send no payment_method and keep needing an email');
  assert.equal((await place({ customer_email: 'not-an-email', payment_method: 'manual' }, '10.9.0.4')).status, 400);
  assert.equal(rows('SELECT customer_email FROM storefront_orders')[0].customer_email, '');
  const emailless = rows('SELECT order_number FROM storefront_orders')[0].order_number;
  const initialize = await worker.fetch(new Request(
    'https://eshop-storefront.workers.dev/api/payments/paystack/initialize?tenant=shop-a',
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.9.0.9' }, body: JSON.stringify({ order_number: emailless }) }
  ), env);
  assert.equal(initialize.status, 409);
  assert.equal((await initialize.json()).error_code, 'email_required');
});

test('funnel events are stored and summed next to views and cart adds', async () => {
  const { env } = await createHardeningEnv();
  const post = items => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/analytics/events?tenant=shop-a', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.9.1.1' }, body: JSON.stringify({ items })
  }), env);
  assert.equal((await post([
    { product_id: 7, type: 'checkout_start', n: 2 },
    { product_id: 7, type: 'purchase', n: 1 },
    { product_id: 9, type: 'booking_submitted', n: 1 },
    { product_id: 7, type: 'view', n: 4 }
  ])).status, 202);
  assert.equal((await post([{ product_id: 7, type: 'refund', n: 1 }])).status, 400);
  const summary = await (await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/analytics/events?tenant=shop-a&days=7', {
    headers: ownerHeaders('owner-key-for-shop-a')
  }), env)).json();
  const byId = Object.fromEntries(summary.product_activity.map(item => [item.product_id, item]));
  assert.equal(byId['7'].checkout_starts, 2);
  assert.equal(byId['7'].purchases, 1);
  assert.equal(byId['7'].views, 4);
  assert.equal(byId['9'].booking_submissions, 1);
  assert.equal(byId['7'].booking_submissions, 0);
});

test('customers never see owner-only order fields; owners see the payment reference', async () => {
  const { env, tokens } = await createHardeningEnv();
  const created = await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], { payment_method: 'manual' }, { ip: '10.9.2.1' }), env);
  const { order } = await created.json();
  for (const field of ['needs_attention', 'attention_reason', 'payment_method', 'payment_reference', 'manual_payment_reference']) {
    assert.equal(field in order, false, `${field} must not be in the customer response`);
  }
  const paid = await worker.fetch(new Request(`https://eshop-storefront.workers.dev/api/store/orders/${order.order_number}/payment?tenant=shop-a`, {
    method: 'POST', headers: ownerHeaders(tokens['shop-a']), body: JSON.stringify({ method: 'mobile_money', reference: 'QWE123XYZ' })
  }), env);
  assert.equal(paid.status, 200);
  const owner = (await paid.json()).order;
  assert.equal(owner.payment_method, 'mobile_money');
  assert.equal(owner.payment_reference, 'QWE123XYZ');
  assert.equal(owner.needs_attention, false);
  const listed = await (await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    headers: ownerHeaders(tokens['shop-a'])
  }), env)).json();
  assert.equal(listed.orders[0].payment_reference, 'QWE123XYZ');
  // A replayed create (same idempotency key) is still the customer shape.
  const key = crypto.randomUUID();
  await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '10.9.2.2', key }), env);
  const replay = await (await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '10.9.2.3', key }), env)).json();
  assert.equal(replay.duplicate, true);
  assert.equal('needs_attention' in replay.order, false);
});

test('order list and status changes accept the shop owner key or that shop account session, never another shop', async () => {
  const { env, tokens, TENANTS } = await createHardeningEnv();
  const sessionFor = async username => {
    const token = `session-for-${username}`;
    await TENANTS.put(`session:${await sha256HexForTest(token)}`, JSON.stringify({ username }));
    return token;
  };
  const list = token => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    headers: token ? ownerHeaders(token) : {}
  }), env);
  assert.equal((await list(tokens['shop-a'])).status, 200);
  assert.equal((await list(await sessionFor('owner-shop-a'))).status, 200, 'the shop own account session works');
  assert.equal((await list(await sessionFor('owner-shop-b'))).status, 401, 'another shop account session is refused');
  assert.equal((await list(tokens['shop-b'])).status, 401);
  assert.equal((await list(null)).status, 401);
  const created = await worker.fetch(orderRequest('shop-a', [{ product_id: 7, quantity: 1 }], {}, { ip: '10.9.3.1' }), env);
  const { order } = await created.json();
  const patch = token => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/orders?tenant=shop-a', {
    method: 'PATCH', headers: ownerHeaders(token), body: JSON.stringify({ order_number: order.order_number, status: 'confirmed' })
  }), env);
  assert.equal((await patch(await sessionFor('owner-shop-b'))).status, 401);
  assert.equal((await patch(await sessionFor('owner-shop-a'))).status, 200);
});

// ---------------------------------------------------------------------------
// Service bookings: capacity, customer cancel/reschedule by token, owner actions, reminders.
// Real SQLite (sql.js) with every migration applied; D1 batches are atomic like the real thing.
// ---------------------------------------------------------------------------
const SVC_HOST = 'https://eshop-storefront.workers.dev';
const SVC_BASE_STORE = {
  name: 'Studio', currency: 'KES', offer_type: 'services', service_timezone: 'Africa/Nairobi',
  service_open_time: '09:00', service_close_time: '17:00', service_days: [0, 1, 2, 3, 4, 5, 6],
  service_buffer_minutes: 15, service_deposit_percent: 0
};
const svcCatalog = (store = {}) => ({
  products: [{ id: 8, name: 'Haircut', price: 2500, duration_minutes: 60 }, { id: 9, name: 'Trim', price: 1000, duration_minutes: 30 }],
  categories: [],
  store: { ...SVC_BASE_STORE, ...store }
});
const svcLocalDate = (daysAhead) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(Date.now() + daysAhead * 86_400_000)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
let svcIp = 0;
const svcFresh = () => `10.9.${Math.floor(svcIp / 250)}.${(svcIp++ % 250) + 1}`;
const svcSlots = async (env, date, { tenant = 'shop-a', service = 8 } = {}) => {
  const response = await worker.fetch(new Request(`${SVC_HOST}/api/service-appointments/availability?tenant=${tenant}&service_id=${service}&date=${date}`), env);
  assert.equal(response.status, 200);
  return response.json();
};
const svcBook = (env, startsAt, { tenant = 'shop-a', service = 8, ctx, email = 'sam@customer.example', name = 'Sam Customer', ip, extra = {} } = {}) =>
  worker.fetch(new Request(`${SVC_HOST}/api/service-appointments?tenant=${tenant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip || svcFresh() },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(), service_id: service, starts_at: startsAt,
      customer_name: name, customer_email: email, customer_phone: '+254700000111', ...extra
    })
  }), env, ctx);
const svcManage = (env, token, body = {}, { tenant = 'shop-a', ip, ctx } = {}) =>
  worker.fetch(new Request(`${SVC_HOST}/api/service-appointments/manage?tenant=${tenant}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip || svcFresh() },
    body: JSON.stringify({ token, ...body })
  }), env, ctx);
const svcOwner = (env, key, body, { tenant = 'shop-a', ctx } = {}) =>
  worker.fetch(new Request(`${SVC_HOST}/api/service-appointments?tenant=${tenant}`, {
    method: 'PATCH', headers: ownerHeaders(key), body: JSON.stringify(body)
  }), env, ctx);
const svcList = (env, key, query = '', tenant = 'shop-a') =>
  worker.fetch(new Request(`${SVC_HOST}/api/service-appointments?tenant=${tenant}${query.replace('?', '&')}`, { headers: key ? ownerHeaders(key) : {} }), env);
const svcCreate = async (env, startsAt, options) => {
  const response = await svcBook(env, startsAt, options);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
};

test('capacity: a shop with two staff takes two bookings per slot, never three, even in parallel', async () => {
  const { env, rows } = await createHardeningEnv({ catalog: svcCatalog({ service_capacity: 2 }) });
  const date = svcLocalDate(2);
  const first = await svcSlots(env, date);
  assert.equal(first.capacity, 2);
  assert.ok(first.slots.length > 0 && first.slots.every(slot => slot.remaining === 2));
  const target = first.slots[2].starts_at; // 09:30 local

  // Five customers race for the same slot: exactly two win.
  const results = await Promise.all(Array.from({ length: 5 }, (_, index) => svcBook(env, target, { name: `Racer ${index}` })));
  assert.deepEqual(results.map(response => response.status).sort(), [201, 201, 409, 409, 409]);
  for (const response of results.filter(r => r.status === 409)) {
    assert.equal((await response.json()).error_code, 'slot_unavailable');
  }
  const perBlock = rows('SELECT slot_start, COUNT(*) AS n, MAX(seat) AS top FROM storefront_appointment_slots GROUP BY slot_start');
  assert.ok(perBlock.length > 0 && perBlock.every(block => block.n <= 2 && block.top <= 2));

  // Availability reflects the full slot; a slot that ends before the full blocks is untouched.
  const after = await svcSlots(env, date);
  assert.equal(after.slots.some(slot => slot.starts_at === target), false);
  assert.equal(after.slots.find(slot => slot.starts_at === first.slots[8].starts_at).remaining, 2);
  // A booking overlapping a full block is refused as a whole, and leaves nothing behind.
  const heldBefore = rows('SELECT COUNT(*) AS n FROM storefront_appointment_slots')[0].n;
  assert.equal((await svcBook(env, first.slots[3].starts_at)).status, 409);
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_appointment_slots')[0].n, heldBefore);
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_service_appointments')[0].n, 2);
});

test('capacity defaults to one, and a lowered capacity never lets a block exceed it', async () => {
  const { env, db, rows } = await createHardeningEnv({ catalog: svcCatalog({ service_capacity: 3 }) });
  const date = svcLocalDate(2);
  const slots = (await svcSlots(env, date)).slots;
  for (let index = 0; index < 3; index++) await svcCreate(env, slots[0].starts_at);
  // The owner lowers capacity to 2 and republishes while three bookings already exist.
  db.run('UPDATE catalog_snapshots SET payload=? WHERE tenant_id=?', [JSON.stringify(svcCatalog({ service_capacity: 2 })), 'shop-a']);
  assert.equal((await svcBook(env, slots[0].starts_at)).status, 409);
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_appointment_slots WHERE slot_start=?', [slots[0].starts_at])[0].n, 3);
  // Out-of-range or non-integer settings fall back to a single seat.
  for (const bad of [0, -1, 21, 1.5, 'many', null]) {
    db.run('UPDATE catalog_snapshots SET payload=? WHERE tenant_id=?', [JSON.stringify(svcCatalog({ service_capacity: bad })), 'shop-a']);
    assert.equal((await svcSlots(env, date)).capacity, 1, `capacity ${String(bad)}`);
  }
});

test('customer cancel by token: unguessable, frees the slot, notifies the owner once', async () => {
  const { env, rows } = await createHardeningEnv({ catalog: svcCatalog(), tenants: ['shop-a', 'shop-b'] });
  const date = svcLocalDate(2);
  const slot = (await svcSlots(env, date)).slots[0].starts_at;
  const ctx = hardeningCtx();
  const created = await svcCreate(env, slot, { ctx });
  await ctx.settle();
  const token = created.manage_token;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(JSON.stringify(created).includes('sam@customer.example'), false, 'create response has no contact details');
  const stored = rows('SELECT cancel_token_hash FROM storefront_service_appointments')[0].cancel_token_hash;
  assert.equal(stored, await sha256HexForTest(token), 'only a hash of the token is stored');

  // Wrong, malformed, cross-shop tokens and the appointment id are all the same 404.
  for (const bad of ['nope', `${token.slice(0, -1)}x`, 'a'.repeat(43), created.appointment.id]) {
    const response = await svcManage(env, bad, { action: 'cancel' });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error_code, 'appointment_not_found');
  }
  assert.equal((await svcManage(env, token, { action: 'view' }, { tenant: 'shop-b' })).status, 404);
  assert.equal(rows('SELECT status FROM storefront_service_appointments')[0].status, 'pending');

  const view = await (await svcManage(env, token, { action: 'view' })).json();
  assert.equal(view.appointment.status, 'pending');
  assert.equal(view.appointment.can_cancel, true);
  assert.equal(view.appointment.reschedules_remaining, 2);
  const keys = Object.keys(view.appointment);
  for (const forbidden of ['customer_email', 'customer_phone', 'customer_name', 'cancel_token_hash', 'payment_subaccount_code', 'payment_reference', 'tenant_id', 'idempotency_key', 'id']) {
    assert.equal(keys.includes(forbidden), false, `${forbidden} is not customer-visible`);
  }

  // The slot is taken until the customer cancels.
  assert.equal((await svcSlots(env, date)).slots.some(item => item.starts_at === slot), false);
  const cancelCtx = hardeningCtx();
  const cancelled = await svcManage(env, token, { action: 'cancel', reason: 'Plans changed' }, { ctx: cancelCtx });
  assert.equal(cancelled.status, 200);
  const body = await cancelled.json();
  assert.equal(body.appointment.status, 'cancelled');
  assert.equal(body.appointment.cancelled_by, 'you');
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_appointment_slots')[0].n, 0, 'every seat was released');
  assert.equal((await svcSlots(env, date)).slots.some(item => item.starts_at === slot), true, 'capacity is free again');
  const repeat = await svcManage(env, token, { action: 'cancel' }, { ctx: cancelCtx });
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).already_cancelled, true);
  const moveCancelled = await svcManage(env, token, { action: 'reschedule', starts_at: slot });
  assert.equal(moveCancelled.status, 409);
  assert.equal((await moveCancelled.json()).error_code, 'not_changeable');

  // The owner heard about it exactly once, with a first name only.
  await cancelCtx.settle();
  const notes = rows("SELECT * FROM owner_notifications WHERE kind='booking_cancelled'");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].ref, created.appointment.id);
  assert.match(notes[0].body, /^Sam cancelled Haircut/);
  assert.equal(JSON.stringify(notes[0]).includes('customer.example'), false);
});

test('customer cancel and reschedule are refused inside the cutoff window; the owner may still cancel', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({ catalog: svcCatalog({ service_cancel_cutoff_hours: 4 }) });
  const slot = (await svcSlots(env, svcLocalDate(2))).slots[0].starts_at;
  const { manage_token: token, appointment } = await svcCreate(env, slot);
  const soon = new Date(Date.now() + 3 * 3_600_000).toISOString();
  db.run('UPDATE storefront_service_appointments SET starts_at=? WHERE id=?', [soon, appointment.id]);
  const view = (await (await svcManage(env, token, { action: 'view' })).json()).appointment;
  assert.equal(view.can_cancel, false);
  assert.equal(view.can_reschedule, false);
  assert.equal(view.cancel_cutoff_hours, 4);
  for (const action of [{ action: 'cancel' }, { action: 'reschedule', starts_at: slot }]) {
    const response = await svcManage(env, token, action);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error_code, 'cutoff_passed');
    assert.ok(body.cancel_cutoff_at);
  }
  assert.equal(rows('SELECT status FROM storefront_service_appointments')[0].status, 'pending');
  // Three hours out is fine under the default two-hour window.
  db.run('UPDATE catalog_snapshots SET payload=? WHERE tenant_id=?', [JSON.stringify(svcCatalog()), 'shop-a']);
  assert.equal((await (await svcManage(env, token, { action: 'view' })).json()).appointment.can_cancel, true);
  db.run('UPDATE catalog_snapshots SET payload=? WHERE tenant_id=?', [JSON.stringify(svcCatalog({ service_cancel_cutoff_hours: 4 })), 'shop-a']);
  // The owner can cancel anyway, and the reason is shown to the customer.
  const ownerCancel = await svcOwner(env, tokens['shop-a'], { id: appointment.id, action: 'cancel', reason: 'Stylist is ill' });
  assert.equal(ownerCancel.status, 200);
  const cancelled = (await ownerCancel.json()).appointment;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelled_by, 'owner');
  const afterwards = (await (await svcManage(env, token, { action: 'view' })).json()).appointment;
  assert.equal(afterwards.cancelled_by, 'shop');
  assert.equal(afterwards.cancel_reason, 'Stylist is ill');
});

test('a paid deposit is flagged for refund (never refunded by the Worker) and a late payment is flagged too', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({
    catalog: svcCatalog({ service_deposit_percent: 20 }), extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_refund' }
  });
  const slot = (await svcSlots(env, svcLocalDate(2))).slots[0].starts_at;
  const { manage_token: token, appointment } = await svcCreate(env, slot);
  db.run("UPDATE storefront_service_appointments SET status='confirmed',payment_status='paid',payment_reference='ESHOP_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' WHERE id=?", [appointment.id]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('the Worker must not call Paystack to refund'); };
  try {
    const ctx = hardeningCtx();
    const cancelled = await svcManage(env, token, { action: 'cancel' }, { ctx });
    assert.equal(cancelled.status, 200);
    const view = (await cancelled.json()).appointment;
    assert.equal(view.deposit_refund_due, true);
    assert.equal(view.deposit_refunded, false);
    await ctx.settle();
  } finally {
    globalThis.fetch = originalFetch;
  }
  const flagged = rows('SELECT deposit_refund_due, payment_status FROM storefront_service_appointments')[0];
  assert.equal(flagged.deposit_refund_due, 1);
  assert.equal(flagged.payment_status, 'paid', 'the payment record is untouched');
  assert.match(rows("SELECT body FROM owner_notifications WHERE kind='booking_cancelled'")[0].body, /refund it in Paystack/);
  assert.equal((await (await svcList(env, tokens['shop-a'])).json()).counts.refunds_due, 1);
  // The owner records the refund once they made it in Paystack.
  const refunded = await svcOwner(env, tokens['shop-a'], { id: appointment.id, action: 'deposit_refunded' });
  assert.equal(refunded.status, 200);
  const done = (await refunded.json()).appointment;
  assert.equal(done.deposit_refund_due, false);
  assert.ok(done.deposit_refunded_at);
  assert.equal((await svcOwner(env, tokens['shop-a'], { id: appointment.id, action: 'deposit_refunded' })).status, 200, 'repeat is idempotent');

  // A deposit link paid after the booking was cancelled is flagged for refund and the owner is told.
  const second = await svcCreate(env, (await svcSlots(env, svcLocalDate(3))).slots[0].starts_at);
  const reference = `ESHOP_${'B'.repeat(32)}`;
  db.run("UPDATE storefront_service_appointments SET status='cancelled',cancelled_by='customer',payment_status='pending',payment_reference=?,payment_subaccount_code='ACCT_x' WHERE id=?", [reference, second.appointment.id]);
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { reference, amount: 50000, currency: 'KES', status: 'success', domain: 'test', subaccount: { subaccount_code: 'ACCT_x' } }
  }), { status: 200 });
  try {
    const ctx = hardeningCtx();
    const verified = await worker.fetch(new Request(`${SVC_HOST}/api/service-appointments/payment?tenant=shop-a&reference=${reference}`), env, ctx);
    assert.equal(verified.status, 200);
    await ctx.settle();
  } finally {
    globalThis.fetch = originalFetch;
  }
  const late = rows('SELECT deposit_refund_due, payment_status FROM storefront_service_appointments WHERE id=?', [second.appointment.id])[0];
  assert.deepEqual({ ...late }, { deposit_refund_due: 1, payment_status: 'paid' });
  assert.equal(rows("SELECT * FROM owner_notifications WHERE kind='booking_refund'").length, 1);
});

test('reschedule by token is atomic: validates the slot, capacity, hours and the limit, and notifies the owner', async () => {
  const { env, rows, tokens } = await createHardeningEnv({ catalog: svcCatalog() });
  const dayOne = (await svcSlots(env, svcLocalDate(2))).slots;
  const dayTwo = (await svcSlots(env, svcLocalDate(3))).slots;
  const mine = await svcCreate(env, dayOne[0].starts_at);
  await svcCreate(env, dayTwo[0].starts_at, { name: 'Other Person' });
  const token = mine.manage_token;
  const heldBefore = rows('SELECT slot_start FROM storefront_appointment_slots WHERE appointment_id=? ORDER BY slot_start', [mine.appointment.id]);
  assert.ok(heldBefore.length >= 4);

  // A slot another customer holds is refused and my booking is exactly as it was.
  const clash = await svcManage(env, token, { action: 'reschedule', starts_at: dayTwo[0].starts_at });
  assert.equal(clash.status, 409);
  assert.equal((await clash.json()).error_code, 'slot_unavailable');
  const unchanged = rows('SELECT starts_at, reschedule_count FROM storefront_service_appointments WHERE id=?', [mine.appointment.id])[0];
  assert.deepEqual({ ...unchanged }, { starts_at: dayOne[0].starts_at, reschedule_count: 0 });
  assert.deepEqual(rows('SELECT slot_start FROM storefront_appointment_slots WHERE appointment_id=? ORDER BY slot_start', [mine.appointment.id]), heldBefore);

  // Outside opening hours, off the grid, the same time, and a past time are all refused.
  for (const [startsAt, status, code] of [
    [`${svcLocalDate(3)}T00:00:00.000Z`, 409, 'slot_unavailable'],
    [dayTwo[2].starts_at.replace(/:00\.000Z$/, ':07.000Z'), 409, 'slot_unavailable'],
    ['soon', 400, 'invalid_request'],
    [dayOne[0].starts_at, 409, 'slot_unchanged'],
    [new Date(Date.now() - 86_400_000).toISOString(), 409, 'slot_unavailable']
  ]) {
    const response = await svcManage(env, token, { action: 'reschedule', starts_at: startsAt });
    assert.equal(response.status, status, startsAt);
    assert.equal((await response.json()).error_code, code, startsAt);
  }

  // A move that overlaps my own current time works: my own seats do not block me.
  const mySlots = await (await svcManage(env, token, { action: 'slots', date: svcLocalDate(2) })).json();
  assert.ok(mySlots.slots.some(slot => slot.starts_at === dayOne[1].starts_at));
  assert.equal((await svcSlots(env, svcLocalDate(2))).slots.some(slot => slot.starts_at === dayOne[1].starts_at), false, 'but the public list still shows it taken');
  const ctx = hardeningCtx();
  const moved = await svcManage(env, token, { action: 'reschedule', starts_at: dayOne[1].starts_at }, { ctx });
  assert.equal(moved.status, 200);
  const movedView = (await moved.json()).appointment;
  assert.equal(movedView.starts_at, dayOne[1].starts_at);
  assert.equal(movedView.reschedules_remaining, 1);
  await ctx.settle();
  const taken = rows('SELECT slot_start FROM storefront_appointment_slots WHERE appointment_id=? ORDER BY slot_start', [mine.appointment.id]);
  assert.equal(taken[0].slot_start, dayOne[1].starts_at);
  assert.equal(taken.length, heldBefore.length);
  assert.match(rows("SELECT body FROM owner_notifications WHERE kind='booking_rescheduled'")[0].body, /^Sam moved Haircut to /);

  // The second move uses the last allowed one; the third is refused, but the owner can still move it.
  assert.equal((await svcManage(env, token, { action: 'reschedule', starts_at: dayOne[8].starts_at })).status, 200);
  const limited = await svcManage(env, token, { action: 'reschedule', starts_at: dayOne[16].starts_at });
  assert.equal(limited.status, 409);
  assert.equal((await limited.json()).error_code, 'reschedule_limit');
  assert.equal((await (await svcManage(env, token, { action: 'view' })).json()).appointment.can_reschedule, false);
  const ownerMove = await svcOwner(env, tokens['shop-a'], { id: mine.appointment.id, action: 'reschedule', starts_at: dayOne[16].starts_at });
  assert.equal(ownerMove.status, 200);
  const ownerView = (await ownerMove.json()).appointment;
  assert.equal(ownerView.starts_at, dayOne[16].starts_at);
  assert.equal(ownerView.reschedule_count, 2, 'an owner move does not use up the customer limit');
});

test('parallel reschedules into the last seat cannot double-book it', async () => {
  const { env, rows } = await createHardeningEnv({ catalog: svcCatalog() });
  const slots = (await svcSlots(env, svcLocalDate(2))).slots;
  const a = await svcCreate(env, slots[0].starts_at, { name: 'Alice' });
  const b = await svcCreate(env, slots[8].starts_at, { name: 'Bella' });
  const target = slots[16].starts_at;
  const results = await Promise.all([a, b].map(item => svcManage(env, item.manage_token, { action: 'reschedule', starts_at: target })));
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  assert.equal((await results.find(response => response.status === 409).json()).error_code, 'slot_unavailable');
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_appointment_slots WHERE slot_start=?', [target])[0].n, 1);
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_appointment_slots')[0].n, 5 * 2, 'two bookings of five blocks each; the loser kept its original time');
});

test('owner endpoints: authentication, filters, and every state transition with its error code', async () => {
  const { env, db, rows, tokens } = await createHardeningEnv({
    catalog: svcCatalog(), tenants: ['shop-a', 'shop-b'], extraEnv: { PUBLISH_TOKEN: 'admin-key' }
  });
  const slots = (await svcSlots(env, svcLocalDate(2))).slots;
  const one = await svcCreate(env, slots[0].starts_at, { name: 'One Customer' });
  const two = await svcCreate(env, slots[8].starts_at, { name: 'Two Customer', service: 9 });
  const three = await svcCreate(env, slots[16].starts_at, { name: 'Three Customer' });

  assert.equal((await svcList(env, '')).status, 401);
  assert.equal((await svcList(env, tokens['shop-b'])).status, 401, 'another shop key is refused');
  assert.equal((await svcOwner(env, 'wrong', { id: one.appointment.id, action: 'confirm' })).status, 401);
  assert.equal((await svcList(env, 'admin-key')).status, 200, 'admin is allowed');
  const listed = await (await svcList(env, tokens['shop-a'])).json();
  assert.equal(listed.appointments.length, 3);
  assert.equal(listed.counts.pending, 3);
  assert.equal((await (await svcList(env, tokens['shop-b'], '', 'shop-b')).json()).appointments.length, 0, 'other shops see nothing');
  const first = listed.appointments.find(item => item.id === one.appointment.id);
  assert.equal(first.customer_name, 'One Customer');
  assert.equal(first.customer_email, 'sam@customer.example');
  assert.equal('cancel_token_hash' in first, false);
  assert.equal('payment_subaccount_code' in first, false);
  assert.equal(first.reference, one.appointment.reference);

  // Filters.
  const upcoming = await (await svcList(env, tokens['shop-a'], '?view=upcoming&status=pending')).json();
  assert.deepEqual(upcoming.appointments.map(item => item.starts_at), [slots[0].starts_at, slots[8].starts_at, slots[16].starts_at], 'upcoming is soonest first');
  assert.equal((await (await svcList(env, tokens['shop-a'], '?view=past')).json()).appointments.length, 0);
  assert.equal((await (await svcList(env, tokens['shop-a'], '?service_id=9')).json()).appointments.length, 1);
  const paged = await (await svcList(env, tokens['shop-a'], '?limit=2&view=upcoming')).json();
  assert.equal(paged.appointments.length, 2);
  assert.equal(paged.has_more, true);
  for (const bad of ['?view=sideways', '?status=sleeping', '?limit=0', '?limit=500', '?from=yesterday']) {
    assert.equal((await svcList(env, tokens['shop-a'], bad)).status, 400, bad);
  }

  // Transitions.
  const act = (id, action, extra = {}) => svcOwner(env, tokens['shop-a'], { id, action, ...extra });
  assert.equal((await act('not-a-uuid', 'confirm')).status, 400);
  assert.equal((await act(crypto.randomUUID(), 'confirm')).status, 404);
  assert.equal((await act(one.appointment.id, 'explode')).status, 400);
  const confirmed = await act(one.appointment.id, 'confirm');
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).appointment.status, 'confirmed');
  const again = await act(one.appointment.id, 'confirm');
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error_code, 'invalid_state');
  const early = await act(one.appointment.id, 'complete');
  assert.equal(early.status, 409);
  assert.equal((await early.json()).error_code, 'not_started');
  assert.equal((await act(two.appointment.id, 'complete')).status, 409, 'a pending booking cannot be completed');
  const declined = await act(two.appointment.id, 'decline');
  assert.equal(declined.status, 200);
  assert.equal((await declined.json()).appointment.status, 'rejected');
  assert.equal(rows('SELECT COUNT(*) AS n FROM storefront_appointment_slots WHERE appointment_id=?', [two.appointment.id])[0].n, 0, 'declining frees the seats');
  assert.equal((await act(two.appointment.id, 'cancel')).status, 409, 'a declined booking cannot be cancelled');

  // Past confirmed bookings can be marked completed or no-show; an outcome is final.
  const past = new Date(Date.now() - 3 * 3_600_000).toISOString();
  db.run('UPDATE storefront_service_appointments SET starts_at=? WHERE id=?', [past, one.appointment.id]);
  const completed = await act(one.appointment.id, 'complete');
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).appointment.status, 'completed');
  assert.equal((await act(one.appointment.id, 'no_show')).status, 409);
  assert.equal((await act(one.appointment.id, 'cancel')).status, 409);
  await act(three.appointment.id, 'confirm');
  db.run('UPDATE storefront_service_appointments SET starts_at=? WHERE id=?', [past, three.appointment.id]);
  const noShow = await act(three.appointment.id, 'no_show');
  assert.equal(noShow.status, 200);
  assert.equal((await noShow.json()).appointment.status, 'no_show');
  const history = await (await svcList(env, tokens['shop-a'], '?view=past&status=completed,no_show')).json();
  assert.equal(history.appointments.length, 2);
  assert.equal((await (await svcList(env, tokens['shop-a'])).json()).counts.pending, 0);
});

test('owner reschedule and cancel keep capacity consistent and refuse bad times', async () => {
  const { env, rows, tokens } = await createHardeningEnv({ catalog: svcCatalog() });
  const slots = (await svcSlots(env, svcLocalDate(2))).slots;
  const a = await svcCreate(env, slots[0].starts_at);
  const b = await svcCreate(env, slots[8].starts_at);
  const move = (id, startsAt) => svcOwner(env, tokens['shop-a'], { id, action: 'reschedule', starts_at: startsAt });
  const blocked = await move(a.appointment.id, slots[9].starts_at);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error_code, 'slot_unavailable');
  assert.equal((await move(a.appointment.id, 'soon')).status, 400);
  assert.equal((await move(a.appointment.id, `${svcLocalDate(2)}T20:00:00.000Z`)).status, 409, 'after closing time');
  assert.equal(rows('SELECT starts_at FROM storefront_service_appointments WHERE id=?', [a.appointment.id])[0].starts_at, slots[0].starts_at);
  assert.equal((await move(a.appointment.id, slots[24].starts_at)).status, 200);
  assert.equal((await svcOwner(env, tokens['shop-a'], { id: b.appointment.id, action: 'cancel' })).status, 200);
  assert.equal((await svcSlots(env, svcLocalDate(2))).slots.some(slot => slot.starts_at === slots[8].starts_at), true);
});

test('booking emails: the customer gets a manage link, reminders go out once, and a missing email key never blocks anything', async () => {
  const { env, db, rows } = await createHardeningEnv({
    catalog: svcCatalog(), extraEnv: { RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Shop <no-reply@shop.example>' }
  });
  const originalFetch = globalThis.fetch;
  const sent = [];
  let failing = false;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    sent.push(JSON.parse(init.body));
    return failing ? new Response('{}', { status: 500 }) : new Response('{"id":"x"}', { status: 200 });
  };
  try {
    const slots = (await svcSlots(env, svcLocalDate(2))).slots;
    const ctx = hardeningCtx();
    const booked = await svcCreate(env, slots[0].starts_at, { ctx, email: 'Sam@Customer.Example' });
    await ctx.settle();
    const receipt = sent.find(item => /Booking request received/.test(item.subject));
    assert.deepEqual(receipt.to, ['sam@customer.example']);
    assert.ok(receipt.text.includes(`/#/booking/${booked.manage_token}`), 'the email carries the manage link');

    // Reminders: only confirmed bookings starting inside the window, once.
    const confirmedSoon = await svcCreate(env, slots[8].starts_at, { name: 'Soon Client', email: 'soon@customer.example' });
    const pendingSoon = await svcCreate(env, slots[16].starts_at, { name: 'Pending Client', email: 'pending@customer.example' });
    const farAway = await svcCreate(env, (await svcSlots(env, svcLocalDate(6))).slots[0].starts_at, { name: 'Far Client', email: 'far@customer.example' });
    db.run("UPDATE storefront_service_appointments SET status='confirmed' WHERE id IN (?,?)", [confirmedSoon.appointment.id, farAway.appointment.id]);
    db.run('UPDATE storefront_service_appointments SET starts_at=? WHERE id=?', [new Date(Date.now() + 10 * 3_600_000).toISOString(), confirmedSoon.appointment.id]);
    sent.length = 0;
    const scheduleCtx = hardeningCtx();
    await worker.scheduled({ cron: '17 3 * * *' }, env, scheduleCtx);
    await scheduleCtx.settle();
    const reminders = sent.filter(item => /^Reminder:/.test(item.subject));
    assert.equal(reminders.length, 1);
    assert.deepEqual(reminders[0].to, ['soon@customer.example']);
    assert.ok(rows('SELECT reminded_at FROM storefront_service_appointments WHERE id=?', [confirmedSoon.appointment.id])[0].reminded_at);
    assert.equal(rows('SELECT reminded_at FROM storefront_service_appointments WHERE id=?', [pendingSoon.appointment.id])[0].reminded_at, null);
    assert.equal(rows('SELECT reminded_at FROM storefront_service_appointments WHERE id=?', [farAway.appointment.id])[0].reminded_at, null);

    // Idempotent: a second run (or two overlapping runs) sends nothing more.
    sent.length = 0;
    await Promise.all([worker.scheduled({}, env, hardeningCtx()), worker.scheduled({}, env, hardeningCtx())]);
    assert.equal(sent.filter(item => /^Reminder:/.test(item.subject)).length, 0);

    // A provider failure releases the claim for a later run, up to three attempts.
    db.run('UPDATE storefront_service_appointments SET reminded_at=NULL,reminder_attempts=0 WHERE id=?', [confirmedSoon.appointment.id]);
    failing = true;
    for (let attempt = 1; attempt <= 4; attempt++) await worker.scheduled({}, env, hardeningCtx());
    const row = rows('SELECT reminded_at, reminder_attempts FROM storefront_service_appointments WHERE id=?', [confirmedSoon.appointment.id])[0];
    assert.equal(row.reminded_at, null);
    assert.equal(row.reminder_attempts, 3, 'gives up after three tries');
    failing = false;

    // Moving a reminded booking re-arms its reminder.
    db.run('UPDATE storefront_service_appointments SET reminded_at=?,reminder_attempts=1 WHERE id=?', [new Date().toISOString(), confirmedSoon.appointment.id]);
    const tokenRow = rows('SELECT id FROM storefront_service_appointments WHERE id=?', [confirmedSoon.appointment.id])[0];
    assert.ok(tokenRow);
    const moved = await svcManage(env, confirmedSoon.manage_token, { action: 'reschedule', starts_at: (await svcSlots(env, svcLocalDate(4))).slots[10].starts_at });
    assert.equal(moved.status, 200);
    const rearmed = rows('SELECT reminded_at, reminder_attempts FROM storefront_service_appointments WHERE id=?', [confirmedSoon.appointment.id])[0];
    assert.deepEqual({ ...rearmed }, { reminded_at: null, reminder_attempts: 0 });
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Without a Resend key nothing is sent, nothing is marked, and booking and the cron still work.
  const bare = await createHardeningEnv({ catalog: svcCatalog() });
  globalThis.fetch = async () => { throw new Error('no email may be attempted without a key'); };
  try {
    const slots = (await svcSlots(bare.env, svcLocalDate(2))).slots;
    const booked = await svcCreate(bare.env, slots[0].starts_at);
    bare.db.run("UPDATE storefront_service_appointments SET status='confirmed',starts_at=? WHERE id=?", [new Date(Date.now() + 5 * 3_600_000).toISOString(), booked.appointment.id]);
    await worker.scheduled({}, bare.env, hardeningCtx());
    assert.equal(bare.rows('SELECT reminded_at FROM storefront_service_appointments')[0].reminded_at, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('booking validation: idempotent replay carries no token, stale service length is refused, and errors carry codes', async () => {
  const { env } = await createHardeningEnv({ catalog: svcCatalog() });
  const slots = (await svcSlots(env, svcLocalDate(2))).slots;
  const key = crypto.randomUUID();
  const send = (extra = {}) => worker.fetch(new Request(`${SVC_HOST}/api/service-appointments?tenant=shop-a`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': svcFresh() },
    body: JSON.stringify({
      idempotency_key: key, service_id: 8, starts_at: slots[0].starts_at, customer_name: 'Sam',
      customer_email: 'sam@customer.example', customer_phone: '+254700000111', ...extra
    })
  }), env);
  const stale = await send({ duration_minutes: 45 });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error_code, 'service_changed');
  assert.equal((await send({ duration_minutes: 60 })).status, 201);
  const replay = await send();
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.duplicate, true);
  assert.equal('manage_token' in replayBody, false);
  const invalid = await send({ customer_email: 'nope', idempotency_key: crypto.randomUUID() });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error_code, 'invalid_request');
  const taken = await svcBook(env, slots[0].starts_at, { service: 9 });
  assert.equal(taken.status, 409, 'a different service cannot take the only seat');
  assert.equal((await taken.json()).error_code, 'slot_unavailable');
});

test('migration 0030 keeps existing appointments and slots (existing slots become seat 1)', async () => {
  const SQL = await initSqlJs({ locateFile: file => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url)) });
  const db = new SQL.Database();
  const directory = new URL('../cloudflare/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  assert.ok(files.includes('0030_service_booking_management.sql'));
  for (const file of files.filter(name => name < '0030')) db.exec(await readFile(new URL(file, directory), 'utf8'));
  db.run(
    `INSERT INTO storefront_service_appointments
     (id,tenant_id,idempotency_key,service_id,service_name,service_price_cents,currency,duration_minutes,starts_at,ends_at,
      slot_reserved_until,timezone,customer_name,customer_email,customer_phone,status,request_expires_at,deposit_percent,
      deposit_cents,payment_status,payment_reference,created_at,updated_at,payment_subaccount_code)
     VALUES ('a-1','shop-a','k-1','8','Haircut',2500,'KES',60,'2030-01-01T09:00:00.000Z','2030-01-01T10:00:00.000Z',
      '2030-01-01T10:15:00.000Z','Africa/Nairobi','Sam','sam@x.example','+254700000000','confirmed','2030-01-02T00:00:00.000Z',20,
      500,'paid','ESHOP_KEEP','now','now','ACCT_keep')`
  );
  db.run("INSERT INTO storefront_appointment_slots (tenant_id,slot_start,appointment_id,expires_at) VALUES ('shop-a','2030-01-01T09:00:00.000Z','a-1','2030-01-01T10:15:00.000Z')");
  for (const file of files.filter(name => name >= '0030')) db.exec(await readFile(new URL(file, directory), 'utf8'));
  const appointment = db.exec("SELECT status,payment_reference,payment_subaccount_code,reschedule_count,deposit_refund_due,cancel_token_hash FROM storefront_service_appointments WHERE id='a-1'")[0].values[0];
  assert.deepEqual(appointment, ['confirmed', 'ESHOP_KEEP', 'ACCT_keep', 0, 0, null]);
  assert.deepEqual(db.exec('SELECT seat,appointment_id FROM storefront_appointment_slots')[0].values, [[1, 'a-1']]);
  // The new statuses are accepted; unknown ones still are not.
  db.run("UPDATE storefront_service_appointments SET status='no_show' WHERE id='a-1'");
  assert.throws(() => db.run("UPDATE storefront_service_appointments SET status='bogus' WHERE id='a-1'"), /CHECK/);
  // Seats are unique per block: a second row for the same seat is refused, another seat is fine.
  assert.throws(() => db.run("INSERT INTO storefront_appointment_slots (tenant_id,slot_start,seat,appointment_id,expires_at) VALUES ('shop-a','2030-01-01T09:00:00.000Z',1,'a-2','later')"), /UNIQUE/);
  db.run("INSERT INTO storefront_appointment_slots (tenant_id,slot_start,seat,appointment_id,expires_at) VALUES ('shop-a','2030-01-01T09:00:00.000Z',2,'a-2','later')");
  db.close();
});

test('publishing a catalogue keeps the booking rules and falls back to safe defaults', async () => {
  const env = { DB: createDatabase(), TENANTS: createTenantStore(), PUBLISH_TOKEN: 'test-token' };
  const put = store => worker.fetch(new Request('https://rrobin.co.ke/api/catalog', {
    method: 'PUT', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: [], products: [{ id: 8, name: 'Haircut', price: 2500, duration_minutes: 45 }], store: { name: 'Studio', currency: 'KES', offer_type: 'services', ...store } })
  }), env);
  const read = async () => (await (await worker.fetch(new Request('https://rrobin.co.ke/api/catalog'), env)).json()).store;
  assert.equal((await put({ service_capacity: 3, service_cancel_cutoff_hours: 6, service_max_reschedules: 1 })).status, 200);
  const saved = await read();
  assert.deepEqual([saved.service_capacity, saved.service_cancel_cutoff_hours, saved.service_max_reschedules], [3, 6, 1]);
  assert.equal((await put({ service_capacity: 99, service_cancel_cutoff_hours: -1, service_max_reschedules: 'x' })).status, 200);
  const defaults = await read();
  assert.deepEqual([defaults.service_capacity, defaults.service_cancel_cutoff_hours, defaults.service_max_reschedules], [1, 2, 2]);
  assert.equal((await put({ service_cancel_cutoff_hours: 0 })).status, 200);
  assert.equal((await read()).service_cancel_cutoff_hours, 0, 'zero hours is a valid cutoff');
});

test('the manage endpoint is throttled per connection and rejects bad input without touching bookings', async () => {
  const { env, rows } = await createHardeningEnv({ catalog: svcCatalog() });
  const slot = (await svcSlots(env, svcLocalDate(2))).slots[0].starts_at;
  const created = await svcCreate(env, slot);
  const ip = '198.51.100.77';
  const statuses = [];
  for (let attempt = 0; attempt < 121; attempt++) {
    statuses.push((await svcManage(env, 'x'.repeat(43), { action: 'cancel' }, { ip })).status);
  }
  assert.equal(statuses.filter(status => status === 404).length, 120);
  assert.equal(statuses.at(-1), 429);
  // Even the legitimate token is throttled from the same connection, and works from another one.
  assert.equal((await svcManage(env, created.manage_token, { action: 'view' }, { ip })).status, 429);
  assert.equal((await svcManage(env, created.manage_token, { action: 'view' })).status, 200);
  const odd = await svcManage(env, created.manage_token, { action: 'explode' });
  assert.equal(odd.status, 400);
  assert.equal((await odd.json()).error_code, 'invalid_request');
  const huge = await worker.fetch(new Request(`${SVC_HOST}/api/service-appointments/manage?tenant=shop-a`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': svcFresh() }, body: JSON.stringify({ token: 'x', pad: 'y'.repeat(4000) })
  }), env);
  assert.equal(huge.status, 413);
  assert.equal((await worker.fetch(new Request(`${SVC_HOST}/api/service-appointments/manage?tenant=shop-a`), env)).status, 405);
  assert.equal(rows('SELECT status FROM storefront_service_appointments')[0].status, 'pending');
});

// Wraps the database so `before` runs once, right before the first statement or batch whose first SQL matches.
// It lets a test land a competing request in the gap between a handler's read and its write.
function svcRaceEnv(env, pattern, before) {
  let fired = false;
  const fire = async sql => {
    if (fired || !pattern.test(sql)) return;
    fired = true;
    await before();
  };
  const DB = {
    prepare(sql) {
      const prepared = env.DB.prepare(sql);
      return {
        bind: (...values) => {
          const bound = prepared.bind(...values);
          return Object.assign(Object.create(bound), {
            sql, runSync: () => bound.runSync(), first: () => bound.first(), all: () => bound.all(),
            run: async () => { await fire(sql); return bound.run(); }
          });
        }
      };
    },
    async batch(statements) {
      await fire(statements[0]?.sql || '');
      return env.DB.batch(statements);
    }
  };
  return { ...env, DB };
}

test('owner confirm that races with a reschedule never leaves seats expiring before the appointment', async () => {
  const { env, rows, tokens } = await createHardeningEnv({ catalog: svcCatalog() });
  const slots = (await svcSlots(env, svcLocalDate(2))).slots;
  const early = slots[0].starts_at;
  const late = slots[16].starts_at;
  const { appointment, manage_token: token } = await svcCreate(env, early);
  const racing = svcRaceEnv(env, /SET status='confirmed'/, async () => {
    const moved = await svcManage(env, token, { action: 'reschedule', starts_at: late });
    assert.equal(moved.status, 200);
  });
  const confirm = await svcOwner(racing, tokens['shop-a'], { id: appointment.id, action: 'confirm' });
  assert.equal(confirm.status, 409, 'the confirm saw a different booking than the one it read');
  assert.equal((await confirm.json()).error_code, 'appointment_changed');
  const row = rows('SELECT status, starts_at, request_expires_at FROM storefront_service_appointments')[0];
  assert.equal(row.status, 'pending');
  assert.equal(row.starts_at, late);
  for (const seat of rows('SELECT expires_at FROM storefront_appointment_slots')) {
    assert.ok(seat.expires_at >= row.request_expires_at, 'seats of the moved booking still cover the pending hold');
  }
  // A fresh confirm now succeeds and every seat lasts until the (moved) appointment is over.
  assert.equal((await svcOwner(env, tokens['shop-a'], { id: appointment.id, action: 'confirm' })).status, 200);
  const confirmed = rows('SELECT slot_reserved_until FROM storefront_service_appointments')[0];
  const seats = rows('SELECT expires_at FROM storefront_appointment_slots');
  assert.ok(seats.length >= 4);
  assert.ok(seats.every(seat => seat.expires_at === confirmed.slot_reserved_until), 'seat expiry comes from the booking row');
  // The old early slot is free and the moved slot cannot be double-booked.
  assert.equal((await svcBook(env, late)).status, 409);
  assert.equal((await svcBook(env, early)).status, 201);
});

test('a deposit paid while the customer cancels is still flagged for refund (verify and webhook)', async () => {
  const { env, db, rows } = await createHardeningEnv({
    catalog: svcCatalog({ service_deposit_percent: 20 }), extraEnv: { PAYSTACK_SECRET_KEY: 'sk_test_racing' }
  });
  const dayOne = (await svcSlots(env, svcLocalDate(2))).slots;
  const confirmedPending = async (slot, reference) => {
    const created = await svcCreate(env, slot);
    db.run("UPDATE storefront_service_appointments SET status='confirmed',payment_status='pending',payment_reference=?,payment_subaccount_code='ACCT_test1' WHERE id=?",
      [reference, created.appointment.id]);
    return created;
  };
  const state = id => ({ ...rows('SELECT status, payment_status, deposit_refund_due FROM storefront_service_appointments WHERE id=?', [id])[0] });
  const originalFetch = globalThis.fetch;

  // Verify path: the customer cancels after the verify handler read the booking, before it records the payment.
  const referenceA = `ESHOP_${'C'.repeat(32)}`;
  const a = await confirmedPending(dayOne[0].starts_at, referenceA);
  const racingA = svcRaceEnv(env, /SET payment_status=\?,updated_at=\?/, async () => {
    assert.equal((await svcManage(env, a.manage_token, { action: 'cancel' })).status, 200);
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { reference: referenceA, amount: 50000, currency: 'KES', status: 'success', domain: 'test', subaccount: { subaccount_code: 'ACCT_test1' } }
  }), { status: 200 });
  try {
    const ctx = hardeningCtx();
    const verified = await worker.fetch(new Request(`${SVC_HOST}/api/service-appointments/payment?tenant=shop-a&reference=${referenceA}`), racingA, ctx);
    assert.equal(verified.status, 200);
    await ctx.settle();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(state(a.appointment.id), { status: 'cancelled', payment_status: 'paid', deposit_refund_due: 1 });
  assert.equal(rows("SELECT * FROM owner_notifications WHERE kind='booking_refund' AND ref=?", [a.appointment.id]).length, 1);

  // Webhook path: same race.
  const referenceB = `ESHOP_${'D'.repeat(32)}`;
  const b = await confirmedPending(dayOne[8].starts_at, referenceB);
  const racingB = svcRaceEnv(env, /SET payment_status='paid'/, async () => {
    assert.equal((await svcManage(env, b.manage_token, { action: 'cancel' })).status, 200);
  });
  const { body, signature } = await signedPaystackWebhook('sk_test_racing', referenceB, 50000);
  const ctx = hardeningCtx();
  const delivered = await worker.fetch(new Request(`${SVC_HOST}/api/payments/paystack/webhook`, {
    method: 'POST', headers: { 'x-paystack-signature': signature }, body
  }), racingB, ctx);
  assert.equal(delivered.status, 200);
  await ctx.settle();
  assert.deepEqual(state(b.appointment.id), { status: 'cancelled', payment_status: 'paid', deposit_refund_due: 1 });
  assert.equal(rows("SELECT * FROM owner_notifications WHERE kind='booking_refund' AND ref=?", [b.appointment.id]).length, 1);
});
