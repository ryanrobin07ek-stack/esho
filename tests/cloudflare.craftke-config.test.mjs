import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Strip // and /* */ comments without touching "//" inside strings.
function parseJsonc(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inString) {
      out += char;
      if (char === '\\') { out += next; i += 1; } else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
    } else if (char === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 1;
    } else {
      out += char;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const read = async name => readFile(new URL(`../cloudflare/${name}`, import.meta.url), 'utf8');

test('the craft.ke wrangler config targets craft.ke resources and a distinct Worker', async () => {
  const config = parseJsonc(await read('wrangler.craftke.jsonc'));
  const production = parseJsonc(await read('wrangler.jsonc'));

  assert.equal(config.name, 'craftke-storefront');
  assert.notEqual(config.name, production.name);
  assert.equal(config.main, production.main);
  assert.equal(config.compatibility_date, production.compatibility_date);
  assert.deepEqual(config.triggers, production.triggers);
  assert.deepEqual(config.assets, production.assets);
  assert.deepEqual(config.observability, production.observability);

  assert.equal(config.vars.DOMAIN_ROOT, 'craft.ke');
  assert.equal(config.vars.EMAIL_FROM, 'Craft <noreply@craft.ke>');
  assert.equal(config.vars.VAPID_SUBJECT, 'mailto:admin@craft.ke');
  assert.equal(config.vars.CUSTOM_HOSTNAME_TARGET, 'customers.craft.ke');
  assert.equal(config.vars.CLOUDFLARE_ZONE_ID, 'REPLACE_WITH_NEW_ZONE_ID');

  assert.deepEqual(config.routes, [
    { pattern: '*.craft.ke/*', zone_name: 'craft.ke' },
    { pattern: 'craft.ke/*', zone_name: 'craft.ke' }
  ]);

  assert.equal(config.d1_databases.length, 1);
  assert.equal(config.d1_databases[0].binding, 'DB');
  assert.equal(config.d1_databases[0].database_name, 'craftke-catalog');
  assert.equal(config.d1_databases[0].database_id, 'REPLACE_WITH_NEW_D1_ID');
  assert.equal(config.d1_databases[0].migrations_dir, production.d1_databases[0].migrations_dir);

  assert.equal(config.kv_namespaces.length, 1);
  assert.equal(config.kv_namespaces[0].binding, 'TENANTS');
  assert.equal(config.kv_namespaces[0].id, 'REPLACE_WITH_NEW_KV_ID');

  assert.deepEqual(config.r2_buckets, [{ binding: 'BUSINESS_ARCHIVE', bucket_name: 'craftke-business-archive' }]);
});

test('the craft.ke wrangler config holds no id, name or domain from the production account', async () => {
  const text = await read('wrangler.craftke.jsonc');
  const config = parseJsonc(text);
  const production = parseJsonc(await read('wrangler.jsonc'));
  const oldValues = [
    production.d1_databases[0].database_id,
    production.kv_namespaces[0].id,
    production.vars.CLOUDFLARE_ZONE_ID,
    production.vars.TURNSTILE_SITE_KEY,
    production.d1_databases[0].database_name,
    production.r2_buckets[0].bucket_name
  ];
  const strings = [];
  (function walk(value) {
    if (typeof value === 'string') strings.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  })(config);
  for (const oldValue of oldValues) {
    assert.ok(oldValue, 'the production config still defines this value');
    assert.ok(!strings.includes(oldValue), `a production value was copied: ${oldValue.slice(0, 6)}...`);
    assert.ok(!text.includes(oldValue), `a production value appears in the file: ${oldValue.slice(0, 6)}...`);
  }
  assert.doesNotMatch(text, /rrobin/);
  assert.doesNotMatch(text, /eshop-/);
  // The only placeholders are the new-account ids, and every one is still unfilled.
  assert.deepEqual(
    strings.filter(value => value.startsWith('REPLACE_WITH_')).sort(),
    ['REPLACE_WITH_NEW_D1_ID', 'REPLACE_WITH_NEW_KV_ID', 'REPLACE_WITH_NEW_TURNSTILE_SITE_KEY', 'REPLACE_WITH_NEW_ZONE_ID']
  );
});

test('package.json has craft.ke scripts that always pass the craft.ke config', async () => {
  const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(scripts['cf:craftke:deploy'], 'npm run build && wrangler deploy --config cloudflare/wrangler.craftke.jsonc');
  assert.equal(scripts['cf:craftke:d1:migrate:remote'], 'wrangler d1 migrations apply craftke-catalog --remote --config cloudflare/wrangler.craftke.jsonc');
  assert.equal(scripts['cf:craftke:d1:migrate:local'], 'wrangler d1 migrations apply craftke-catalog --local --config cloudflare/wrangler.craftke.jsonc');
  // The production scripts still target the production config.
  assert.match(scripts['cf:deploy'], /--config cloudflare\/wrangler\.jsonc$/);
});
