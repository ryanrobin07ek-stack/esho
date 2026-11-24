import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import initSqlJs from 'sql.js';
import worker from '../cloudflare/worker.js';

// The Worker's root domain is the DOMAIN_ROOT variable (default rrobin.co.ke). These tests prove the default is
// unchanged, that craft.ke can be configured, and that a bad value falls back to the default without throwing.

function createTenantStore() {
  const values = new Map();
  return {
    async get(key, type) {
      const value = values.get(key);
      return value && type === 'json' ? JSON.parse(value) : value || null;
    },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async list({ prefix }) {
      return {
        keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
        list_complete: true
      };
    }
  };
}

async function createMigratedD1() {
  const SQL = await initSqlJs({
    locateFile: file => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON');
  const directory = new URL('../cloudflare/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(await readFile(new URL(file, directory), 'utf8'));
  }
  const statement = (sql, values = []) => ({
    async first() {
      const prepared = db.prepare(sql);
      try {
        prepared.bind(values);
        return prepared.step() ? prepared.getAsObject() : null;
      } finally { prepared.free(); }
    },
    async all() {
      const prepared = db.prepare(sql);
      try {
        prepared.bind(values);
        const results = [];
        while (prepared.step()) results.push(prepared.getAsObject());
        return { results };
      } finally { prepared.free(); }
    },
    runSync() {
      db.run(sql, values);
      return { success: true, meta: { changes: db.getRowsModified() } };
    },
    async run() { return this.runSync(); }
  });
  const DB = {
    prepare(sql) { return { ...statement(sql), bind: (...values) => statement(sql, values) }; },
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
  return { db, DB };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const CATALOG = {
  products: [{ id: 7, name: 'Canvas Tote', sku: 'TOTE-7', price: 12.5, stock: 100 }],
  categories: [],
  store: { currency: 'KES', name: 'Shop A' }
};

async function createEnv(extra = {}) {
  const { db, DB } = await createMigratedD1();
  const TENANTS = createTenantStore();
  await TENANTS.put('tenant:shop-a', JSON.stringify({
    id: 'shop-a', name: 'Shop A', owner_username: 'owner-a',
    owner_token_hash: await sha256Hex('owner-key-a'),
    owner_token_hashes: [await sha256Hex('owner-key-a')]
  }));
  db.run(
    'INSERT INTO catalog_snapshots (tenant_id,payload,admin_payload,updated_at) VALUES (?,?,?,?)',
    ['shop-a', JSON.stringify(CATALOG), JSON.stringify(CATALOG), '2026-01-01T00:00:00.000Z']
  );
  return {
    db,
    env: {
      DB, TENANTS,
      TURNSTILE_SITE_KEY: 'test-site-key',
      TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
      GOOGLE_OAUTH_CLIENT_ID: 'test-google-client',
      GOOGLE_OAUTH_CLIENT_SECRET: 'test-google-secret',
      ...extra
    }
  };
}

const get = (env, host, path = '/') => worker.fetch(new Request(`https://${host}${path}`), env);

async function catalogProducts(env, host) {
  const response = await get(env, host, '/api/catalog');
  return { status: response.status, body: response.status === 200 ? await response.json() : await response.text() };
}

async function googleRedirectUri(env) {
  const response = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/google/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'login' })
  }), env);
  assert.equal(response.status, 200);
  const { authorization_url: authorizationUrl } = await response.json();
  return new URL(authorizationUrl).searchParams.get('redirect_uri');
}

async function registerAccount(env, username = 'domain-owner') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('/turnstile/v0/siteverify')) return Response.json({ success: true });
    return originalFetch(input, init);
  };
  try {
    const response = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username, password: 'correct-horse-battery-staple', email: `${username}@example.com`,
        turnstile_token: 'test-turnstile-token'
      })
    }), env);
    assert.equal(response.status, 200);
    return response.json();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function createShop(env, session, id) {
  const response = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
    body: JSON.stringify({ id, name: 'New Shop' })
  }), env);
  assert.equal(response.status, 201);
  return response.json();
}


import { readFileSync } from 'node:fs';

const API = 'https://eshop-storefront.workers.dev';
const post = (path, payload, headers = {}) => new Request(API + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload)
});

test('password reset: parallel guesses are cut off after five and burn the code', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke' });
  const email = 'victim@example.com';
  const emailHash = await sha256Hex(email);
  await env.TENANTS.put('password-reset-code:' + emailHash, JSON.stringify({
    username: 'victim', code_hash: await sha256Hex(email + ':123456'), attempts: 0, expires_at: Date.now() + 600000
  }));
  const guesses = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    worker.fetch(post('/api/auth/verify-reset-code', { email, code: String(100000 + i) }), env)));
  const messages = await Promise.all(guesses.map(async response => (await response.json()).error || ''));
  const checked = messages.filter(message => message.includes('incorrect')).length;
  assert.ok(checked <= 5, 'only five guesses may ever be compared, saw ' + checked + ': ' + JSON.stringify(messages));
  assert.ok(guesses.some(response => response.status === 429), 'the rest are refused');
  const right = await worker.fetch(post('/api/auth/verify-reset-code', { email, code: '123456' }), env);
  assert.notEqual(right.status, 200, 'after the burst the code is burned, so even the right code no longer works');
});

test('a sign-in owner token works only while the session that minted it is alive', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke' });
  const tenant = JSON.parse(await env.TENANTS.get('tenant:shop-a'));
  await env.TENANTS.put('tenant:shop-a', JSON.stringify({
    ...tenant,
    owner_login_tokens: [{ hash: await sha256Hex('login-token'), username: 'owner-a', session: 'sess1', created_at: new Date().toISOString() }]
  }));
  const as = token => worker.fetch(new Request(API + '/api/store/notifications?tenant=shop-a', { headers: { Authorization: 'Bearer ' + token } }), env);
  assert.equal((await as('login-token')).status, 401, 'no session behind the token');
  await env.TENANTS.put('session:sess1', JSON.stringify({ username: 'owner-a' }));
  assert.equal((await as('login-token')).status, 200, 'works while the session lives');
  await env.TENANTS.delete('session:sess1');
  assert.equal((await as('login-token')).status, 401, 'stops when the session ends');
  assert.equal((await as('owner-key-a')).status, 200, "the shop's own key is unaffected");
});

test('platform-looking shop addresses are refused and one account cannot own unlimited shops', async () => {
  const { env, db } = await createEnv({ DOMAIN_ROOT: 'craft.ke', CUSTOM_HOSTNAME_TARGET: 'customers.craft.ke' });
  const account = await registerAccount(env, 'cap-owner');
  const create = id => worker.fetch(new Request(API + '/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.session_token },
    body: JSON.stringify({ id, name: 'Some Shop' })
  }), env);
  for (const id of ['login', 'support', 'paystack', 'customers', 'pay']) {
    assert.equal((await create(id)).status, 400, id + ' is refused');
  }
  assert.equal((await create('real-shop')).status, 201);
  for (let i = 0; i < 9; i += 1) db.run('INSERT INTO account_tenants (username, tenant_id) VALUES (?, ?)', ['cap-owner', 'filler-' + i]);
  assert.equal((await create('one-too-many')).status, 429, 'ten shops is the most one account may own');
});

test('every response carries the protective headers and the app host cannot be framed by other sites', async () => {
  const assets = { fetch: async () => new Response('<!doctype html><title>app</title>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) };
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', MAIN_HOST: 'app.craft.ke', ASSETS: assets });
  const api = await worker.fetch(new Request('https://app.craft.ke/api/catalog'), env);
  assert.equal(api.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(api.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.match(api.headers.get('Strict-Transport-Security') || '', /max-age=/);
  const page = await worker.fetch(new Request('https://app.craft.ke/register'), env);
  const csp = page.headers.get('Content-Security-Policy') || '';
  assert.ok(csp.includes("frame-ancestors 'self'"), 'the app page may only be framed by itself, saw: ' + csp);
  assert.ok(csp.includes("object-src 'none'"));
  const shop = await worker.fetch(new Request('https://shop-a.craft.ke/'), env);
  assert.equal(shop.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.ok(!(shop.headers.get('Content-Security-Policy') || '').includes('frame-ancestors'), 'a shop page stays framable for the owner preview');
});

test('media uploads must start with the file signature of the type they claim', async () => {
  const objects = new Map();
  const archive = {
    async put(key, value, options) { objects.set(key, { value, options }); },
    async head(key) { const o = objects.get(key); return o ? { customMetadata: o.options.customMetadata } : null; },
    async get() { return null; }
  };
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', BUSINESS_ARCHIVE: archive });
  const upload = (type, bytes) => worker.fetch(new Request(API + '/api/media?tenant=shop-a', {
    method: 'POST', headers: { Authorization: 'Bearer owner-key-a', 'Content-Type': type }, body: new Uint8Array(bytes)
  }), env);
  const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];
  const html = [...new TextEncoder().encode('<html><script>alert(1)</script>')];
  assert.equal((await upload('image/png', png)).status, 200, 'a real PNG is accepted');
  assert.equal((await upload('image/png', html)).status, 415, 'HTML sent as a PNG is refused');
  assert.equal((await upload('video/mp4', png)).status, 415, 'a PNG sent as a video is refused');
});

test('newsletter sign-up does not reveal who is subscribed and cannot mail-bomb one address', async () => {
  const { env, db } = await createEnv({ DOMAIN_ROOT: 'craft.ke', RESEND_API_KEY: 'test-key', EMAIL_FROM: 'Craft <noreply@craft.ke>' });
  let sent = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('api.resend.com')) { sent += 1; return Response.json({ id: 'email-1' }); }
    return originalFetch(input, init);
  };
  try {
    const subscribe = email => worker.fetch(post('/api/newsletter/subscribe?tenant=shop-a', { email, consent: true }), env);
    const now = new Date().toISOString();
    db.run(
      "INSERT INTO newsletter_subscribers (id,tenant_id,email,name,status,confirmation_token_hash,unsubscribe_token,consented_at,created_at,updated_at) VALUES (?,?,?,?,'subscribed',?,?,?,?,?)",
      ['id-1', 'shop-a', 'already@example.com', '', 'h', 'u', now, now, now]
    );
    const known = await (await subscribe('already@example.com')).json();
    assert.equal(known.subscribed, undefined, 'an existing subscriber looks the same as anyone else');
    assert.equal(known.confirmation_required, true);
    assert.equal(sent, 0, 'no email is sent to an address that is already on the list');
    for (let i = 0; i < 4; i += 1) assert.equal((await subscribe('target@example.com')).status, 200);
    assert.ok(sent <= 2, 'one address gets at most two confirmation emails a day, saw ' + sent);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('linking a Google account is attached only when the browser that started the flow completes it', () => {
  const source = readFileSync(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
  const callback = source.slice(source.indexOf('async function googleAuthCallback'), source.indexOf('async function completeGoogleAccountAuth'));
  const linkStart = callback.indexOf('if (saved.mode === "link")');
  const linkBranch = callback.slice(linkStart, callback.indexOf('} else {', linkStart));
  assert.ok(!linkBranch.includes('INSERT INTO account_google_identities'), 'the callback must not attach the identity itself');
  assert.ok(callback.includes('pendingLink'), 'the callback hands the pending link to the completion step');
  const complete = source.slice(source.indexOf('async function completeGoogleAccountAuth'));
  const afterSecretCheck = complete.slice(complete.indexOf('constantTimeEqual(await sha256Hex(completionSecret)'));
  assert.ok(afterSecretCheck.includes('INSERT INTO account_google_identities'), 'the identity is attached only after the completion secret is proven');
});

test('a new Google account gets a readable username, and a number is added only on a clash', () => {
  const source = readFileSync(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
  const callback = source.slice(source.indexOf('async function googleAuthCallback'), source.indexOf('async function completeGoogleAccountAuth'));
  assert.ok(!callback.includes('g-${'), 'no more "g-" prefix with random letters');
  assert.ok(!callback.includes('sha256Hex(identity.sub)).slice(0, 8)'), 'no random suffix from the Google id');
  assert.ok(callback.includes('`${usernameBase}${attempt + 1}`'), 'a clash adds a plain number');
});
