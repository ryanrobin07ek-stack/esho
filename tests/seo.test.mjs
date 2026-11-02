import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../cloudflare/worker.js';
import {
  buildSeo,
  injectSeo,
  buildSitemap,
  buildSitemapIndex,
  buildDirectoryPage,
  buildRobots,
  resolvePage
} from '../cloudflare/seo.js';

const ORIGIN = 'https://mama.rrobin.co.ke';

function makeCatalog(storeOverrides = {}) {
  return {
    store: {
      name: 'Mama Shoes', tagline: 'Shoes for every step', description: 'Handmade leather shoes in Nairobi.',
      location: 'Nairobi', location_address: 'Moi Avenue 12, Nairobi', phone: '+254700000000',
      currency: 'KES', currency_symbol: 'KSh', website_theme_id: 'classic',
      instagram_url: 'https://instagram.com/mamashoes', ...storeOverrides
    },
    categories: [{ id: 1, name: 'Sandals', slug: 'sandals', description: '', image: '' }],
    products: [
      { id: 10, slug: 'red-shoe', name: 'Red Shoe', brand: 'Mama', sku: 'RS-1', category_id: 1, price: 2500,
        stock: 4, rating: 0, review_count: 0, description: '<p>Soft red leather.</p>',
        images: ['https://img.example/red.jpg'] },
      { id: 11, slug: 'blue-shoe', name: 'Blue "Shoe" </script><b>', brand: '', sku: '', category_id: 1, price: 1800,
        stock: 0, rating: 4.5, review_count: 12, description: '', images: [] }
    ],
    pages: [{ id: 1, title: 'About us', slug: 'about-us', content: 'We make shoes.', published: 1, updated_at: '2026-09-01T10:00:00Z' }]
  };
}

const SHELL = '<!doctype html><html><head><meta charset="utf-8"><title>Shop</title>' +
  '<meta name="description" content="old"><meta property="og:title" content="old"></head>' +
  '<body><div id="app"></div></body></html>';

const render = (catalog, pathname, themeId = 'classic') => {
  const seo = buildSeo({ catalog, pathname, origin: ORIGIN, themeId });
  return { seo, html: injectSeo(SHELL, { seo, catalog, origin: ORIGIN, themeId }) };
};

const count = (text, pattern) => (text.match(pattern) || []).length;
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(match => JSON.parse(match[1]));

test('product page gets its own title, description, canonical and Product schema', () => {
  const { seo, html } = render(makeCatalog(), '/products/red-shoe');
  assert.equal(seo.status, 200);
  assert.match(html, /<title>Red Shoe \| Mama Shoes<\/title>/);
  assert.match(html, /<meta name="description" content="Soft red leather\.">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/mama\.rrobin\.co\.ke\/products\/red-shoe">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/img\.example\/red\.jpg">/);
  const product = jsonLd(html).find(item => item['@type'] === 'Product');
  assert.equal(product.name, 'Red Shoe');
  assert.equal(product.offers.price, '2500.00');
  assert.equal(product.offers.priceCurrency, 'KES');
  assert.equal(product.offers.availability, 'https://schema.org/InStock');
  assert.equal(product.aggregateRating, undefined, 'no invented ratings when there are no reviews');
  assert.ok(jsonLd(html).some(item => item['@type'] === 'BreadcrumbList'));
});

test('the theme placeholder title and stale meta tags are replaced, never duplicated', () => {
  const { html } = render(makeCatalog(), '/products/red-shoe');
  assert.equal(count(html, /<title\b/g), 1);
  assert.equal(count(html, /name="description"/g), 1);
  assert.equal(count(html, /property="og:title"/g), 1);
  assert.doesNotMatch(html, /content="old"/);
});

test('real reviews become aggregateRating and out-of-stock is reported', () => {
  const { html } = render(makeCatalog(), '/products/blue-shoe');
  const product = jsonLd(html).find(item => item['@type'] === 'Product');
  assert.deepEqual(product.aggregateRating, { '@type': 'AggregateRating', ratingValue: '4.5', reviewCount: 12 });
  assert.equal(product.offers.availability, 'https://schema.org/OutOfStock');
});

test('merchant-controlled text cannot break out of the head, JSON-LD or noscript block', () => {
  const { html } = render(makeCatalog(), '/products/blue-shoe');
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /<title>Blue &quot;Shoe&quot;/);
  assert.equal(count(html, /<\/noscript>/g), 1);
});

test('homepage describes the business with LocalBusiness-style schema', () => {
  const { html } = render(makeCatalog(), '/');
  assert.match(html, /<title>Mama Shoes – Shoes for every step<\/title>/);
  const business = jsonLd(html).find(item => item['@type'] === 'Store');
  assert.equal(business.telephone, '+254700000000');
  assert.equal(business.address.streetAddress, 'Moi Avenue 12, Nairobi');
  assert.deepEqual(business.sameAs, ['https://instagram.com/mamashoes']);
});

test('theme implies the schema.org business type and the merchant can override it', () => {
  const kicks = 'kicks-vault-curated-sneaker-footwear-archive';
  assert.equal(jsonLd(render(makeCatalog({ website_theme_id: kicks }), '/', kicks).html)[0]['@type'], 'ShoeStore');
  assert.equal(jsonLd(render(makeCatalog({ business_type: 'Bakery' }), '/', kicks).html)[0]['@type'], 'Bakery');
  assert.equal(jsonLd(render(makeCatalog({ business_type: 'NotARealType' }), '/').html)[0]['@type'], 'Store');
});

test('missing products and pages are real 404s that stay out of the index', () => {
  const { seo, html } = render(makeCatalog(), '/products/does-not-exist');
  assert.equal(seo.status, 404);
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.equal(buildSeo({ catalog: makeCatalog(), pathname: '/pages/nope', origin: ORIGIN, themeId: 'classic' }).status, 404);
});

test('cart, checkout and account pages are noindex', () => {
  for (const path of ['/cart', '/checkout', '/account', '/wishlist', '/search']) {
    assert.match(render(makeCatalog(), path).html, /noindex,nofollow/, path);
  }
});

test('product pages can be found by numeric id as well as slug', () => {
  assert.equal(resolvePage(makeCatalog(), '/products/10').entity.name, 'Red Shoe');
  assert.equal(resolvePage(makeCatalog(), '/product/red-shoe').entity.id, 10);
});

test('hide_from_search blocks indexing, robots and the sitemap', () => {
  const catalog = makeCatalog({ hide_from_search: 1 });
  assert.match(render(catalog, '/').html, /noindex,nofollow/);
  assert.equal(buildRobots(ORIGIN, true), 'User-agent: *\nDisallow: /\n');
});

test('master sitemap index XML escapes and limits sitemap locations', () => {
  const xml = buildSitemapIndex(['https://mama.rrobin.co.ke/sitemap.xml?x=1&y=2']);
  assert.match(xml, /<sitemapindex/);
  assert.match(xml, /https:\/\/mama\.rrobin\.co\.ke\/sitemap\.xml\?x=1&amp;y=2/);
  assert.equal((buildSitemapIndex(Array.from({ length: 2 }, (_, index) => `https://shop${index}.example/sitemap.xml`))
    .match(/<sitemap>/g) || []).length, 2);
});

test('shop directory page escapes merchant content and emits crawlable shop links', () => {
  const html = buildDirectoryPage([{
    id: 'mama',
    name: 'Mama <b>Shoes</b>',
    description: '<script>bad</script>',
    productCount: 2,
    url: 'https://mama.rrobin.co.ke/'
  }], 'https://rrobin.co.ke');
  assert.match(html, /<title>Browse online shops \| E-Shop<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/rrobin\.co\.ke\/shops">/);
  assert.match(html, /<a href="https:\/\/mama\.rrobin\.co\.ke\/">/);
  assert.match(html, /Mama &lt;b&gt;Shoes&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Shoes|<script>bad/);
});

test('robots.txt keeps /api/catalog crawlable so Googlebot can render the storefront', () => {
  const robots = buildRobots(ORIGIN, false);
  assert.match(robots, /^Allow: \/api\/catalog$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Disallow: \/checkout$/m);
  assert.match(robots, /^Sitemap: https:\/\/mama\.rrobin\.co\.ke\/sitemap\.xml$/m);
});

test('sitemap lists products, categories and pages for path-routed themes, with escaped URLs', () => {
  const xml = buildSitemap(makeCatalog(), ORIGIN, 'classic');
  for (const path of ['/', '/products/red-shoe', '/products/blue-shoe', '/categories/sandals', '/pages/about-us']) {
    assert.ok(xml.includes(`<loc>${ORIGIN}${path}</loc>`), path);
  }
  assert.match(xml, /<lastmod>2026-09-01<\/lastmod>/);
});

test('hash-routed themes only advertise the homepage and never claim duplicate pages', () => {
  const themeId = 'aurex-electronics';
  const xml = buildSitemap(makeCatalog(), ORIGIN, themeId);
  assert.equal(count(xml, /<url>/g), 1);
  const { html } = render(makeCatalog(), '/products/red-shoe', themeId);
  assert.match(html, /<link rel="canonical" href="https:\/\/mama\.rrobin\.co\.ke\/">/);
});

test('classic storefront gets a hash bridge so clean product URLs actually render', () => {
  const { html } = render(makeCatalog(), '/products/red-shoe', 'classic');
  assert.match(html, /history\.replaceState\(null,"",location\.pathname\+location\.search\+"#\/product\/red-shoe"\)/);
  assert.doesNotMatch(render(makeCatalog(), '/products/red-shoe', 'craft-main-storefront').html, /replaceState/);
});

test('crawlers without JavaScript still get a plain-HTML copy of the page', () => {
  const home = render(makeCatalog(), '/').html;
  assert.match(home, /<noscript>[\s\S]*<a href="\/products\/red-shoe">Red Shoe – KSh 2,500<\/a>/);
  const product = render(makeCatalog(), '/products/red-shoe').html;
  assert.match(product, /<noscript>[\s\S]*<h1>Red Shoe<\/h1>[\s\S]*Soft red leather\./);
});

test('long descriptions are cut at a word boundary within 155 characters', () => {
  const catalog = makeCatalog();
  catalog.products[0].description = 'word '.repeat(80);
  const { seo } = render(catalog, '/products/red-shoe');
  assert.ok(seo.description.length <= 155);
  assert.ok(seo.description.endsWith('…'));
});

// ---- End to end through the real worker ----

function makeEnv(catalog) {
  const tenants = new Map([['tenant:mama', JSON.stringify({ id: 'mama', name: 'Mama Shoes', catalog_updated_at: 'v1' })]]);
  return {
    TENANTS: {
      async get(key, type) { const value = tenants.get(key); return value == null ? null : (type === 'json' ? JSON.parse(value) : value); },
      async put(key, value) { tenants.set(key, value); },
      async delete(key) { tenants.delete(key); },
      async list({ prefix }) {
        return { keys: [...tenants.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true };
      }
    },
    DB: {
      prepare(query) {
        return { bind: () => ({
          async first() {
            if (query.includes('FROM catalog_snapshots')) return { payload: JSON.stringify(catalog), updated_at: 'v1' };
            return null;
          }
        }) };
      }
    },
    BUSINESS_ARCHIVE: {},
    ASSETS: { async fetch() { return new Response(SHELL, { headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"x"' } }); } }
  };
}

const get = (env, path) => worker.fetch(new Request(`https://mama.rrobin.co.ke${path}`), env);
const getRoot = (env, path) => worker.fetch(new Request(`https://rrobin.co.ke${path}`), env);

function makePlatformEnv() {
  const catalogFor = (name, overrides = {}) => ({
    ...makeCatalog({ name, ...overrides }),
    products: overrides.empty ? [] : makeCatalog().products
  });
  const tenants = new Map([
    ['tenant:main', { id: 'main', name: 'E-Shop' }],
    ['tenant:mama', { id: 'mama', name: 'Mama Shoes' }],
    ['tenant:kamau', { id: 'kamau', name: 'Kamau Hardware' }],
    ['tenant:hidden', { id: 'hidden', name: 'Hidden Shop' }],
    ['tenant:empty', { id: 'empty', name: 'Empty Shop' }],
    ['tenant:draft', { id: 'draft', name: 'Draft Shop' }]
  ]);
  const catalogs = new Map([
    ['main', makeCatalog({ name: 'E-Shop' })],
    ['mama', catalogFor('Mama Shoes')],
    ['kamau', catalogFor('Kamau Hardware', { website_theme_id: 'craft-main-storefront' })],
    ['hidden', catalogFor('Hidden Shop', { hide_from_search: 1 })],
    ['empty', catalogFor('Empty Shop', { empty: true })],
    ['draft', catalogFor('Draft Shop', { website_theme_id: 'craft-main-storefront' })]
  ]);
  const kv = new Map([
    ['published-theme:kamau', {
      themeId: 'craft-main-storefront',
      catalogUpdatedAt: 'v1'
    }]
  ]);
  return {
    kv,
    tenants,
    catalogs,
    TENANTS: {
      async get(key, type) {
        const value = kv.has(key) ? kv.get(key) : tenants.get(key);
        if (value == null) return null;
        return type === 'json' && typeof value === 'string' ? JSON.parse(value) : value;
      },
      async put(key, value) { kv.set(key, value); },
      async list({ prefix }) {
        return {
          keys: [...tenants.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
          list_complete: true
        };
      }
    },
    DB: {
      prepare() {
        return {
          bind: tenantId => ({ async first() {
            const catalog = catalogs.get(tenantId);
            return catalog ? { payload: JSON.stringify(catalog), updated_at: 'v1' } : null;
          } }),
          async first() {
            const catalog = catalogs.get('main');
            return catalog ? { payload: JSON.stringify(catalog), updated_at: 'v1' } : null;
          },
          async all() {
            return {
              results: [...catalogs.entries()].map(([tenantId, catalog]) => ({
                tenant_id: tenantId,
                updated_at: 'v1',
                name: catalog.store.name,
                tagline: catalog.store.tagline,
                description: catalog.store.description,
                theme_id: catalog.store.website_theme_id,
                product_count: catalog.products.length
              })).filter(row => row.product_count > 0 && !catalogs.get(row.tenant_id).store.hide_from_search)
            };
          }
        };
      }
    },
    BUSINESS_ARCHIVE: {},
    ASSETS: { async fetch() { return new Response(SHELL, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); } }
  };
}

test('worker serves a per-shop robots.txt and sitemap.xml on the shop subdomain', async () => {
  const env = makeEnv(makeCatalog());
  const robots = await get(env, '/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('Content-Type'), /text\/plain/);
  assert.match(await robots.text(), /Sitemap: https:\/\/mama\.rrobin\.co\.ke\/sitemap\.xml/);
  const sitemap = await get(env, '/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('Content-Type'), /application\/xml/);
  assert.match(await sitemap.text(), /<loc>https:\/\/mama\.rrobin\.co\.ke\/products\/red-shoe<\/loc>/);
});

test('worker returns different SEO for different URLs of the same shop', async () => {
  const env = makeEnv(makeCatalog());
  const product = await (await get(env, '/products/red-shoe')).text();
  const home = await (await get(env, '/')).text();
  assert.match(product, /<title>Red Shoe \| Mama Shoes<\/title>/);
  assert.match(home, /<title>Mama Shoes – Shoes for every step<\/title>/);
  assert.match(product, /window\.__ESHOP_CLOUDFLARE_STOREFRONT__/, 'existing storefront bootstrap is preserved');
  assert.match(product, /href="https:\/\/rrobin\.co\.ke\/shops"[^>]*>Powered by E-Shop/);
  const cart = await (await get(env, '/cart')).text();
  assert.doesNotMatch(cart, /Powered by E-Shop/);
});

test('worker answers unknown product URLs with a real 404 and hidden shops with a closed sitemap', async () => {
  const missing = await get(makeEnv(makeCatalog()), '/products/nope');
  assert.equal(missing.status, 404);
  const hiddenEnv = makeEnv(makeCatalog({ hide_from_search: 1 }));
  assert.equal((await get(hiddenEnv, '/sitemap.xml')).status, 404);
  assert.match(await (await get(hiddenEnv, '/robots.txt')).text(), /Disallow: \/\n/);
});

test('main sitemap indexes eligible shops and their independent sitemaps', async () => {
  const response = await getRoot(makePlatformEnv(), '/sitemap.xml');
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /<sitemapindex/);
  assert.ok(xml.includes('<loc>https://mama.rrobin.co.ke/sitemap.xml</loc>'));
  assert.ok(xml.includes('<loc>https://kamau.rrobin.co.ke/sitemap.xml</loc>'));
  assert.ok(xml.includes('<loc>https://rrobin.co.ke/sitemap-main.xml</loc>'));
  assert.ok(!xml.includes('hidden.rrobin'), 'shops hidden from search are excluded');
  assert.ok(!xml.includes('empty.rrobin'), 'shops without products are excluded');
  assert.ok(!xml.includes('draft.rrobin'), 'unpublished custom themes are excluded');
});

test('shop directory lists eligible shops and main sitemap includes its crawlable URL', async () => {
  const env = makePlatformEnv();
  const directory = await getRoot(env, '/shops');
  assert.equal(directory.status, 200);
  const html = await directory.text();
  assert.match(html, /<title>Browse online shops \| E-Shop<\/title>/);
  assert.match(html, /<a href="https:\/\/mama\.rrobin\.co\.ke\/">/);
  assert.match(html, /<a href="https:\/\/kamau\.rrobin\.co\.ke\/">/);
  assert.doesNotMatch(html, /Hidden Shop|Empty Shop|Draft Shop/);

  const sitemap = await (await getRoot(env, '/sitemap-main.xml')).text();
  assert.match(sitemap, /<loc>https:\/\/rrobin\.co\.ke\/shops<\/loc>/);
  assert.doesNotMatch(sitemap, /\/products\/|\/categories\/|\/pages\//);
});

test('the main hostname remains crawlable regardless of retired storefront visibility settings', async () => {
  const env = makePlatformEnv();
  env.catalogs.set('main', makeCatalog({ name: 'Retired E-Shop', hide_from_search: 1 }));

  const robots = await getRoot(env, '/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Allow: \//);
  const sitemap = await (await getRoot(env, '/sitemap-main.xml')).text();
  assert.match(sitemap, /<loc>https:\/\/rrobin\.co\.ke\/<\/loc>/);
  assert.doesNotMatch(sitemap, /Retired|\/products\//);
});

test('shop directory refreshes after its cache expires to include newly published shops', async () => {
  const env = makePlatformEnv();
  await getRoot(env, '/sitemap.xml');
  env.tenants.set('tenant:newshop', { id: 'newshop', name: 'New Shop' });
  const cached = JSON.parse(env.kv.get('directory:v1'));
  env.kv.set('directory:v1', JSON.stringify({ ...cached, built_at: Date.now() - 2 * 60 * 60 * 1000 }));
  env.catalogs.set('newshop', makeCatalog({ name: 'New Shop' }));

  const xml = await (await getRoot(env, '/sitemap.xml')).text();
  assert.ok(xml.includes('https://newshop.rrobin.co.ke/sitemap.xml'));
});

test('root robots file points crawlers at the master sitemap', async () => {
  const robots = await (await getRoot(makePlatformEnv(), '/robots.txt')).text();
  assert.match(robots, /Sitemap: https:\/\/rrobin\.co\.ke\/sitemap\.xml/);
});
