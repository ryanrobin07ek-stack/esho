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

test('default config: rrobin.co.ke is the main site, shop.rrobin.co.ke is a shop, craft.ke is foreign', async () => {
  const { env } = await createEnv({ CUSTOM_HOSTNAME_TARGET: 'customers.rrobin.co.ke' });
  const shop = await catalogProducts(env, 'shop-a.rrobin.co.ke');
  assert.equal(shop.status, 200);
  assert.equal(shop.body.products[0].name, 'Canvas Tote');
  const apex = await catalogProducts(env, 'rrobin.co.ke');
  assert.equal(apex.status, 200);
  assert.deepEqual(apex.body.products, []);
  const www = await catalogProducts(env, 'www.rrobin.co.ke');
  assert.deepEqual(www.body.products, []);
  assert.equal((await catalogProducts(env, 'missing.rrobin.co.ke')).status, 404);

  // The other domain is an unknown host, not a shop and not the main site.
  const foreign = await get(env, 'shop-a.craft.ke', '/api/catalog');
  assert.equal(foreign.status, 404);
  assert.match(await foreign.text(), /not connected to a shop/);
  assert.equal((await catalogProducts(env, 'craft.ke')).status, 404);
});

test('default config: hostnames, sitemaps, canonical origin and Google redirect use rrobin.co.ke', async () => {
  const { env } = await createEnv();
  const sitemap = await (await get(env, 'shop-a.rrobin.co.ke', '/sitemap.xml')).text();
  assert.match(sitemap, /<loc>https:\/\/shop-a\.rrobin\.co\.ke\/<\/loc>/);
  const robots = await (await get(env, 'shop-a.rrobin.co.ke', '/robots.txt')).text();
  assert.match(robots, /Sitemap: https:\/\/shop-a\.rrobin\.co\.ke\/sitemap\.xml/);
  const index = await (await get(env, 'rrobin.co.ke', '/sitemap.xml')).text();
  assert.match(index, /<loc>https:\/\/rrobin\.co\.ke\/sitemap-main\.xml<\/loc>/);
  assert.equal(await googleRedirectUri(env), 'https://rrobin.co.ke/api/auth/google/callback');

  const account = await registerAccount(env);
  const created = await createShop(env, account.session_token, 'new-shop');
  assert.equal(created.tenant.hostname, 'new-shop.rrobin.co.ke');
  const list = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    headers: { Authorization: `Bearer ${account.session_token}` }
  }), env);
  assert.deepEqual((await list.json()).tenants.map(tenant => tenant.hostname), ['new-shop.rrobin.co.ke']);
});

test('default config: the official homepage is served byte-for-byte unchanged', async () => {
  const source = '<link rel="canonical" href="https://rrobin.co.ke/"><title>Craft</title>';
  const response = await worker.fetch(new Request('https://rrobin.co.ke/'), {
    ASSETS: { async fetch() { return new Response(source, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); } }
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), source);
});

test('DOMAIN_ROOT=craft.ke: shop.craft.ke is a shop, craft.ke and www.craft.ke are the main site', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', CUSTOM_HOSTNAME_TARGET: 'customers.craft.ke' });
  const shop = await catalogProducts(env, 'shop-a.craft.ke');
  assert.equal(shop.status, 200);
  assert.equal(shop.body.products[0].name, 'Canvas Tote');
  assert.deepEqual((await catalogProducts(env, 'craft.ke')).body.products, []);
  assert.deepEqual((await catalogProducts(env, 'www.craft.ke')).body.products, []);
  assert.equal((await catalogProducts(env, 'missing.craft.ke')).status, 404);
  // A two-level name under the root is not a shop id (the same rejection the default domain gives).
  const nested = (await catalogProducts(env, 'a.shop-a.craft.ke')).status;
  assert.notEqual(nested, 200);
  assert.equal(nested, (await catalogProducts({ ...env, DOMAIN_ROOT: undefined }, 'a.shop-a.rrobin.co.ke')).status);

  // The production domain is just another foreign host here: it is not the main site and not a shop.
  for (const host of ['shop-a.rrobin.co.ke', 'rrobin.co.ke', 'www.rrobin.co.ke']) {
    const foreign = await get(env, host, '/api/catalog');
    assert.equal(foreign.status, 404, host);
    assert.match(await foreign.text(), /not connected to a shop/, host);
  }
  const foreignHome = await get(env, 'rrobin.co.ke', '/');
  assert.equal(foreignHome.status, 404);
});

test('DOMAIN_ROOT=craft.ke: API hostnames, sitemap, robots, canonical origin and Google redirect use craft.ke', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke' });
  const sitemap = await (await get(env, 'shop-a.craft.ke', '/sitemap.xml')).text();
  assert.match(sitemap, /<loc>https:\/\/shop-a\.craft\.ke\/<\/loc>/);
  assert.doesNotMatch(sitemap, /rrobin/);
  const robots = await (await get(env, 'shop-a.craft.ke', '/robots.txt')).text();
  assert.match(robots, /Sitemap: https:\/\/shop-a\.craft\.ke\/sitemap\.xml/);
  assert.doesNotMatch(robots, /rrobin/);
  const index = await (await get(env, 'craft.ke', '/sitemap.xml')).text();
  assert.match(index, /<loc>https:\/\/craft\.ke\/sitemap-main\.xml<\/loc>/);
  const mainSitemap = await (await get(env, 'www.craft.ke', '/sitemap-main.xml')).text();
  assert.doesNotMatch(mainSitemap, /rrobin/);
  assert.equal(await googleRedirectUri(env), 'https://craft.ke/api/auth/google/callback');

  const account = await registerAccount(env);
  const created = await createShop(env, account.session_token, 'new-shop');
  assert.equal(created.tenant.hostname, 'new-shop.craft.ke');
  const list = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    headers: { Authorization: `Bearer ${account.session_token}` }
  }), env);
  assert.deepEqual((await list.json()).tenants.map(tenant => tenant.hostname), ['new-shop.craft.ke']);
  assert.equal((await catalogProducts(env, 'new-shop.craft.ke')).status, 200);
});

test('DOMAIN_ROOT=craft.ke: the official homepage points its origin at craft.ke', async () => {
  const source = [
    '<link rel="canonical" href="https://rrobin.co.ke/">',
    '<meta property="og:image" content="https://rrobin.co.ke/official-site/craft-icon.png">',
    '<title>Craft</title>'
  ].join('\n');
  const response = await worker.fetch(new Request('https://craft.ke/'), {
    DOMAIN_ROOT: 'craft.ke',
    ASSETS: {
      async fetch() {
        return new Response(source, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': String(source.length) }
        });
      }
    }
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), source.replaceAll('https://rrobin.co.ke/', 'https://craft.ke/'));
});

test('an invalid DOMAIN_ROOT falls back to rrobin.co.ke and never throws', async () => {
  const bad = [
    'https://craft.ke', 'craft.ke/', 'craft.ke/path', 'craft.ke:8080', 'localhost', '', '   ', 'craft.ke.',
    '.craft.ke', 'craft..ke', '-craft.ke', 'cra_ft.ke', 'craft.k3', 'cra ft.ke', '*.craft.ke', 42, null, {}, ['craft.ke']
  ];
  for (const value of bad) {
    const { env } = await createEnv({ DOMAIN_ROOT: value });
    const label = JSON.stringify(value);
    const shop = await get(env, 'shop-a.rrobin.co.ke', '/api/catalog');
    assert.equal(shop.status, 200, label);
    assert.equal((await shop.json()).products[0].name, 'Canvas Tote', label);
    assert.equal((await get(env, 'shop-a.craft.ke', '/api/catalog')).status, 404, label);
    assert.equal(await googleRedirectUri(env), 'https://rrobin.co.ke/api/auth/google/callback', label);
    assert.match(await (await get(env, 'shop-a.rrobin.co.ke', '/sitemap.xml')).text(), /shop-a\.rrobin\.co\.ke/, label);
  }
});

test('DOMAIN_ROOT is read on every request, so switching or clearing it never leaks a previous value', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke' });
  assert.equal((await get(env, 'shop-a.craft.ke', '/api/catalog')).status, 200);
  const plain = { ...env };
  delete plain.DOMAIN_ROOT;
  assert.equal((await get(plain, 'shop-a.craft.ke', '/api/catalog')).status, 404);
  assert.equal((await get(plain, 'shop-a.rrobin.co.ke', '/api/catalog')).status, 200);
  // Uppercase and surrounding spaces are tolerated and normalised.
  assert.equal((await get({ ...env, DOMAIN_ROOT: ' Craft.KE ' }, 'shop-a.craft.ke', '/api/catalog')).status, 200);
});

test('scheduled jobs configure the domain without throwing, even for a bad value', async () => {
  for (const value of ['craft.ke', 'not a domain', undefined]) {
    const { env } = await createEnv(value === undefined ? {} : { DOMAIN_ROOT: value });
    const tasks = [];
    await worker.scheduled({}, env, { waitUntil: task => tasks.push(task) });
    await Promise.all(tasks);
  }
});

// ---- RESERVED_SUBDOMAINS: names that other sites already use under the root domain ----

async function withOriginStub(run) {
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async request => {
    seen.push(String(request.url ?? request));
    return new Response('the origin answered', { status: 203, headers: { 'X-Origin': 'yes' } });
  };
  try { return await run(seen); } finally { globalThis.fetch = original; }
}

test('RESERVED_SUBDOMAINS: those hosts are handed on untouched, every other host is handled as before', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', RESERVED_SUBDOMAINS: 'pos, Matter ,bad_label,openschool' });
  await withOriginStub(async seen => {
    for (const host of ['pos.craft.ke', 'matter.craft.ke', 'openschool.craft.ke']) {
      const response = await get(env, host, '/some/path?x=1');
      assert.equal(response.status, 203, host);
      assert.equal(await response.text(), 'the origin answered');
      assert.equal(response.headers.get('X-Origin'), 'yes');
    }
    assert.deepEqual(seen, ['https://pos.craft.ke/some/path?x=1', 'https://matter.craft.ke/some/path?x=1', 'https://openschool.craft.ke/some/path?x=1']);
    // A shop, the apex and a malformed label are not handed on.
    const before = seen.length;
    assert.equal((await catalogProducts(env, 'shop-a.craft.ke')).status, 200);
    assert.equal((await catalogProducts(env, 'craft.ke')).status, 200);
    assert.equal((await get(env, 'bad_label.craft.ke', '/api/catalog')).status === 203, false);
    assert.equal(seen.length, before, 'no other host reached the origin');
  });
});

test('RESERVED_SUBDOMAINS: nothing is handed on without the variable, and it never leaks between requests', async () => {
  const withIt = (await createEnv({ DOMAIN_ROOT: 'craft.ke', RESERVED_SUBDOMAINS: 'pos' })).env;
  const without = (await createEnv({ DOMAIN_ROOT: 'craft.ke' })).env;
  await withOriginStub(async seen => {
    assert.equal((await get(withIt, 'pos.craft.ke')).status, 203);
    // The very next request is for a deployment without the variable: pos is an ordinary (unknown) shop name again.
    const plain = await get(without, 'pos.craft.ke', '/api/catalog');
    assert.notEqual(plain.status, 203);
    assert.equal(seen.length, 1);
  });
  // The root domain still applies: pos.rrobin.co.ke is only handed on when rrobin.co.ke is the root.
  const defaultRoot = (await createEnv({ RESERVED_SUBDOMAINS: 'pos' })).env;
  await withOriginStub(async seen => {
    assert.equal((await get(defaultRoot, 'pos.rrobin.co.ke')).status, 203);
    assert.notEqual((await get(defaultRoot, 'pos.craft.ke', '/api/catalog')).status, 203);
    assert.equal(seen.length, 1);
  });
});

test('RESERVED_SUBDOMAINS: those names can never become shops, other names still can', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', RESERVED_SUBDOMAINS: 'pos,matter' });
  const account = await registerAccount(env, 'reserved-owner');
  const create = id => worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.session_token}` },
    body: JSON.stringify({ id, name: 'Some Shop' })
  }), env);
  for (const id of ['pos', 'matter', 'www', 'api']) assert.notEqual((await create(id)).status, 201, `${id} is reserved`);
  assert.equal((await create('fresh-shop')).status, 201);

  // Without the variable the same name is allowed (the default deployment is unchanged).
  const plain = (await createEnv({ DOMAIN_ROOT: 'craft.ke' })).env;
  const plainAccount = await registerAccount(plain, 'plain-owner');
  const plainCreate = await worker.fetch(new Request('https://eshop-storefront.workers.dev/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${plainAccount.session_token}` },
    body: JSON.stringify({ id: 'matter', name: 'Matter Shop' })
  }), plain);
  assert.equal(plainCreate.status, 201);
});

// ---- MAIN_HOST: the main store lives on one label under the root (app.craft.ke) while the bare domain hosts another site ----

test('MAIN_HOST=app.craft.ke: app.craft.ke is the main store, shops stay at <id>.craft.ke', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', MAIN_HOST: 'app.craft.ke' });
  const main = await catalogProducts(env, 'app.craft.ke');
  assert.equal(main.status, 200);
  assert.deepEqual(main.body.products, [], 'app.craft.ke answers as the main store, not as a shop called "app"');
  const shop = await catalogProducts(env, 'shop-a.craft.ke');
  assert.equal(shop.status, 200);
  assert.equal(shop.body.products[0].name, 'Canvas Tote');
  assert.equal((await catalogProducts(env, 'missing.craft.ke')).status, 404);
  assert.equal(await googleRedirectUri(env), 'https://app.craft.ke/api/auth/google/callback');
});

test('MAIN_HOST=app.craft.ke: the app host honours ?tenant= on API paths, and still needs the shop owner key to change it', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', MAIN_HOST: 'app.craft.ke' });
  const shop = await get(env, 'app.craft.ke', '/api/catalog?tenant=shop-a');
  assert.equal(shop.status, 200);
  assert.equal((await shop.json()).products[0].name, 'Canvas Tote', '?tenant=shop-a reaches shop-a, not the main store');
  assert.equal((await get(env, 'app.craft.ke', '/api/catalog?tenant=missing')).status, 404, 'an unknown shop is not silently the main store');
  const main = await get(env, 'app.craft.ke', '/api/catalog');
  assert.deepEqual((await main.json()).products, [], 'no ?tenant= is still the main store');
  const write = await worker.fetch(new Request('https://app.craft.ke/api/catalog?tenant=shop-a', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: [], categories: [], store: {} })
  }), env);
  assert.equal(write.status, 401, 'changing a shop without its owner key is refused');
});

test('default config: ?tenant= is still ignored on the main host (rrobin.co.ke)', async () => {
  const { env } = await createEnv();
  const response = await get(env, 'rrobin.co.ke', '/api/catalog?tenant=shop-a');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).products, [], 'the main store, not shop-a');
});

test('MAIN_HOST=app.craft.ke: nobody can open a shop called "app", and shop hostnames are unchanged', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', MAIN_HOST: 'app.craft.ke' });
  const account = await registerAccount(env);
  const refused = await worker.fetch(new Request('https://app.craft.ke/api/tenants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.session_token}` },
    body: JSON.stringify({ id: 'app', name: 'Sneaky' })
  }), env);
  assert.notEqual(refused.status, 201);
  const created = await createShop(env, account.session_token, 'new-shop');
  assert.equal(created.tenant.hostname, 'new-shop.craft.ke');
});

test('MAIN_HOST=app.craft.ke: the main store address is used in the sitemap index and robots', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', MAIN_HOST: 'app.craft.ke' });
  const index = await (await get(env, 'app.craft.ke', '/sitemap.xml')).text();
  assert.match(index, /<loc>https:\/\/app\.craft\.ke\/sitemap-main\.xml<\/loc>/);
  const robots = await (await get(env, 'app.craft.ke', '/robots.txt')).text();
  assert.match(robots, /Sitemap: https:\/\/app\.craft\.ke\/sitemap\.xml/);
});

test('an invalid MAIN_HOST is ignored: the main store stays on the root domain', async () => {
  for (const value of ['', '   ', 'evil.com', 'app.evil.com', 'a.b.craft.ke', 'bad_label.craft.ke', '.craft.ke', 'craft.ke', 'craft.ke.evil.com', 42, null]) {
    const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', MAIN_HOST: value });
    assert.equal(await googleRedirectUri(env), 'https://craft.ke/api/auth/google/callback', String(value));
    assert.deepEqual((await catalogProducts(env, 'craft.ke')).body.products, [], String(value));
  }
});

test('MAIN_HOST is read on every request, so it never leaks into a later request', async () => {
  const { env } = await createEnv({ DOMAIN_ROOT: 'craft.ke', MAIN_HOST: 'app.craft.ke' });
  assert.equal(await googleRedirectUri(env), 'https://app.craft.ke/api/auth/google/callback');
  const plain = { ...env };
  delete plain.MAIN_HOST;
  assert.equal(await googleRedirectUri(plain), 'https://craft.ke/api/auth/google/callback');
  assert.equal(await googleRedirectUri(env), 'https://app.craft.ke/api/auth/google/callback');
});

test('without MAIN_HOST nothing changes: the default domain is still its own main store', async () => {
  const { env } = await createEnv();
  assert.equal(await googleRedirectUri(env), 'https://rrobin.co.ke/api/auth/google/callback');
  assert.deepEqual((await catalogProducts(env, 'rrobin.co.ke')).body.products, []);
  const app = await catalogProducts(env, 'app.rrobin.co.ke');
  assert.equal(app.status, 404, 'with no MAIN_HOST, "app" is just an unknown shop name');
});
