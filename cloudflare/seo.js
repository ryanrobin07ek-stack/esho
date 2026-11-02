// Automatic SEO for every storefront. Merchants never see or edit any of this:
// everything is derived from the catalog they already maintain. The optional
// store fields seo_title / seo_description / business_type / hide_from_search
// only exist as overrides.

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 155;
const LIST_LIMIT = 60;

// Themes whose runtime understands real paths (/products/slug). Every other
// theme routes with #/hash, which search engines ignore, so for those we only
// advertise the homepage instead of publishing URLs that would show the home page.
const PATH_ROUTED_THEMES = new Set(["classic", "craft-main-storefront"]);

// Zero-config schema.org type per theme, so merchants never pick one.
const THEME_BUSINESS_TYPE = {
  "autopro-kenya-premium-automotive-spares-parts": "AutoPartsStore",
  "aurex-electronics": "ElectronicsStore",
  "etalon-premium-fashion-apparel": "ClothingStore",
  "kicks-vault-curated-sneaker-footwear-archive": "ShoeStore",
  "cira-atelier-event-architecture-management": "ProfessionalService"
};
const BUSINESS_TYPES = new Set([
  "Store", "ClothingStore", "ShoeStore", "ElectronicsStore", "AutoPartsStore", "HardwareStore",
  "FurnitureStore", "GroceryStore", "Pharmacy", "BookStore", "JewelryStore", "Florist",
  "Restaurant", "CafeOrCoffeeShop", "Bakery", "HairSalon", "BeautySalon", "Hotel",
  "RealEstateAgent", "TravelAgency", "ProfessionalService"
]);

const NOINDEX_PATHS = /^\/(?:search|wishlist|cart|checkout|account)$/;

export function isPathRouted(themeId) {
  return PATH_ROUTED_THEMES.has(themeId || "classic");
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function plain(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value, max) {
  const text = plain(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

function decode(segment) {
  try { return decodeURIComponent(segment); } catch { return segment; }
}

function entityPath(prefix, entity) {
  return `/${prefix}/${encodeURIComponent(entity.slug || entity.id)}`;
}

function money(store, price) {
  const symbol = store.currency_symbol || store.currency || "KES";
  return `${symbol} ${Number(price).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function absolute(url, origin) {
  if (!url) return "";
  try { return new URL(url, origin).href; } catch { return ""; }
}

// Work out which page of the shop a path is, and look up its record.
export function resolvePage(catalog, pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/home") return { kind: "home", found: true };
  if (NOINDEX_PATHS.test(path)) return { kind: "private", found: true };
  if (path === "/products") return { kind: "products", found: true };
  const match = path.match(/^\/(products|product|categories|category|pages|page)\/([^/]+)$/);
  if (!match) return { kind: "unknown", found: false };
  const key = decode(match[2]);
  const same = entity => String(entity.slug) === key || String(entity.id) === key;
  if (match[1] === "products" || match[1] === "product") {
    const entity = (catalog.products || []).find(same);
    return { kind: "product", entity, found: Boolean(entity) };
  }
  if (match[1] === "categories" || match[1] === "category") {
    const entity = (catalog.categories || []).find(same);
    return { kind: "category", entity, found: Boolean(entity) };
  }
  const entity = (catalog.pages || []).find(page => String(page.slug) === key);
  return { kind: "page", entity, found: Boolean(entity) };
}

export function canonicalOrigin(url, tenantId, domainRoot) {
  const host = url.hostname.toLowerCase();
  if (host === domainRoot || host === `www.${domainRoot}`) return `https://${domainRoot}`;
  if (host.endsWith(`.${domainRoot}`) && tenantId) return `https://${host}`;
  return url.origin;
}

function businessSchema(store, themeId, origin, image) {
  const type = BUSINESS_TYPES.has(store.business_type) ? store.business_type
    : THEME_BUSINESS_TYPE[themeId] || "Store";
  const sameAs = [store.instagram_url, store.facebook_url, store.tiktok_url, store.youtube_url, store.x_url]
    .filter(Boolean);
  const address = store.location_address || store.location;
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${origin}/#business`,
    name: store.name,
    url: `${origin}/`,
    ...(image ? { image } : {}),
    ...(store.description ? { description: truncate(store.description, 300) } : {}),
    ...(store.phone ? { telephone: store.phone } : {}),
    ...(store.email ? { email: store.email } : {}),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: truncate(address, 300) } } : {}),
    ...(sameAs.length ? { sameAs } : {})
  };
}

function breadcrumbs(origin, trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], index) => ({
      "@type": "ListItem", position: index + 1, name, item: `${origin}${path}`
    }))
  };
}

function productSchema(store, product, category, origin, path, images) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: `${origin}${path}`,
    ...(images.length ? { image: images } : {}),
    ...(product.description ? { description: truncate(product.description, 500) } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(category ? { category: category.name } : {}),
    offers: {
      "@type": "Offer",
      url: `${origin}${path}`,
      price: Number(product.price).toFixed(2),
      priceCurrency: store.currency || "KES",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    },
    // Only real review data; inventing ratings gets sites penalised by Google.
    ...(product.review_count > 0 && product.rating > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(product.rating).toFixed(1), reviewCount: product.review_count } }
      : {})
  };
}

// Everything the <head> and the crawlable fallback need for one URL.
export function buildSeo({ catalog, pathname, origin, themeId }) {
  const store = catalog.store || {};
  const shop = store.name || "Online Store";
  const resolved = resolvePage(catalog, pathname);
  const pathRouted = isPathRouted(themeId);
  const hidden = Boolean(store.hide_from_search);

  const seo = {
    status: 200,
    noindex: hidden || resolved.kind === "private",
    kind: resolved.kind,
    entity: resolved.entity || null,
    title: "",
    description: "",
    path: "/",
    image: "",
    ogType: "website",
    jsonLd: []
  };

  const firstImage = (catalog.products || []).flatMap(p => p.images || [])[0] || "";
  const storeImage = absolute(firstImage, origin);
  const homeTitle = store.seo_title || [store.title || shop, !store.title && store.tagline].filter(Boolean).join(" – ");
  const homeDescription = truncate(
    store.seo_description || store.description || store.tagline ||
      `Shop online at ${shop}.${store.location ? ` Based in ${store.location}.` : ""}`,
    DESCRIPTION_MAX
  );
  seo.title = truncate(homeTitle, TITLE_MAX);
  seo.description = homeDescription;
  seo.image = storeImage;

  if (!resolved.found) {
    seo.status = 404;
    seo.noindex = true;
    seo.title = truncate(`Page not found | ${shop}`, TITLE_MAX);
    seo.description = "";
    return seo;
  }
  // A hash-routed theme renders the homepage for every path, so describe it as the homepage
  // rather than publishing duplicate pages.
  const servesHome = !pathRouted && !["home", "private"].includes(resolved.kind);

  if (resolved.kind === "home" || servesHome) {
    seo.jsonLd.push(businessSchema(store, themeId, origin, storeImage));
  } else if (resolved.kind === "product") {
    const product = resolved.entity;
    const category = (catalog.categories || []).find(c => c.id === product.category_id);
    seo.path = entityPath("products", product);
    const withShop = `${product.name} | ${shop}`;
    seo.title = withShop.length <= TITLE_MAX ? withShop : truncate(product.name, TITLE_MAX);
    seo.description = truncate(
      product.description ||
        `Buy ${product.name}${product.brand ? ` by ${product.brand}` : ""} at ${shop} for ${money(store, product.price)}.` +
        `${product.stock > 0 ? " In stock." : ""}${store.location ? ` ${store.location}.` : ""}`,
      DESCRIPTION_MAX
    );
    const images = (product.images || []).map(src => absolute(src, origin)).filter(Boolean);
    seo.image = images[0] || storeImage;
    seo.ogType = "product";
    seo.jsonLd.push(productSchema(store, product, category, origin, seo.path, images));
    seo.jsonLd.push(breadcrumbs(origin, [
      ["Home", "/"],
      ...(category ? [[category.name, entityPath("categories", category)]] : []),
      [product.name, seo.path]
    ]));
  } else if (resolved.kind === "category") {
    const category = resolved.entity;
    seo.path = entityPath("categories", category);
    const count = (catalog.products || []).filter(p => p.category_id === category.id).length;
    const withShop = `${category.name} | ${shop}`;
    seo.title = withShop.length <= TITLE_MAX ? withShop : truncate(category.name, TITLE_MAX);
    seo.description = truncate(
      category.description || `Shop ${category.name} at ${shop}${count ? ` – ${count} product${count === 1 ? "" : "s"} available` : ""}.`,
      DESCRIPTION_MAX
    );
    seo.image = absolute(category.image, origin) || storeImage;
    seo.jsonLd.push(breadcrumbs(origin, [["Home", "/"], [category.name, seo.path]]));
  } else if (resolved.kind === "page") {
    const page = resolved.entity;
    seo.path = `/pages/${encodeURIComponent(page.slug)}`;
    const withShop = `${page.title} | ${shop}`;
    seo.title = withShop.length <= TITLE_MAX ? withShop : truncate(page.title, TITLE_MAX);
    seo.description = truncate(page.content || `${page.title} – ${shop}`, DESCRIPTION_MAX);
    seo.jsonLd.push(breadcrumbs(origin, [["Home", "/"], [page.title, seo.path]]));
  } else if (resolved.kind === "products") {
    seo.path = "/products";
    seo.title = truncate(`All products | ${shop}`, TITLE_MAX);
    seo.description = truncate(`Browse everything at ${shop}.${store.description ? ` ${store.description}` : ""}`, DESCRIPTION_MAX);
  }
  return seo;
}

function link(path, label) {
  return `<li><a href="${escapeHtml(path)}">${escapeHtml(label)}</a></li>`;
}

// Plain-HTML copy of the page for crawlers and link-preview bots that do not run JS.
function noscriptBody(seo, catalog, origin) {
  const store = catalog.store || {};
  const shop = escapeHtml(store.name || "Online Store");
  const products = (catalog.products || []).slice(0, LIST_LIMIT);
  const categories = (catalog.categories || []).slice(0, LIST_LIMIT);
  const productList = items => `<ul>${items.map(p => link(entityPath("products", p), `${p.name} – ${money(store, p.price)}`)).join("")}</ul>`;
  const nav = `<nav><a href="/">${shop}</a></nav>`;
  let body = "";
  if (seo.kind === "product" && seo.entity) {
    const p = seo.entity;
    body = `<h1>${escapeHtml(p.name)}</h1>` +
      (p.images?.[0] ? `<img src="${escapeHtml(absolute(p.images[0], origin))}" alt="${escapeHtml(p.name)}" width="480">` : "") +
      `<p>${escapeHtml(money(store, p.price))}${p.stock > 0 ? " – In stock" : " – Out of stock"}</p>` +
      (p.description ? `<p>${escapeHtml(plain(p.description))}</p>` : "");
  } else if (seo.kind === "category" && seo.entity) {
    const c = seo.entity;
    body = `<h1>${escapeHtml(c.name)}</h1>${c.description ? `<p>${escapeHtml(plain(c.description))}</p>` : ""}` +
      productList(products.filter(p => p.category_id === c.id));
  } else if (seo.kind === "page" && seo.entity) {
    body = `<h1>${escapeHtml(seo.entity.title)}</h1><p>${escapeHtml(plain(seo.entity.content))}</p>`;
  } else {
    body = `<h1>${escapeHtml(seo.title)}</h1>${seo.description ? `<p>${escapeHtml(seo.description)}</p>` : ""}` +
      (categories.length ? `<h2>Categories</h2><ul>${categories.map(c => link(entityPath("categories", c), c.name)).join("")}</ul>` : "") +
      (products.length ? `<h2>Products</h2>${productList(products)}` : "");
  }
  return `<noscript>${nav}${body}</noscript>`;
}

// Classic storefront routes with #/hash. Bridge real paths to those routes so
// /products/red-shoe renders the product (and keeps the clean URL as canonical).
function hashBridge(seo, themeId) {
  if ((themeId || "classic") !== "classic" || !seo.entity || seo.status !== 200) return "";
  const target = { product: "/product/", category: "/category/", page: "/pages/" }[seo.kind];
  if (!target) return "";
  const slug = seo.kind === "page" ? seo.entity.slug : (seo.entity.slug || seo.entity.id);
  const route = `#${target}${encodeURIComponent(slug)}`;
  return `<script>if(!location.hash){history.replaceState(null,"",location.pathname+location.search+${JSON.stringify(route).replace(/</g, "\\u003c")})}</script>`;
}

export function injectSeo(html, {
  seo,
  catalog,
  origin,
  themeId,
  poweredBy = null,
  verificationToken = ""
}) {
  const headEnd = html.search(/<\/head>/i);
  let head = headEnd === -1 ? "" : html.slice(0, headEnd);
  let rest = headEnd === -1 ? html : html.slice(headEnd);
  head = head
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*\b(?:name|property)=["'](?:description|robots|google-site-verification|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, "");

  const canonical = `${origin}${seo.path}`;
  const tags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    verificationToken && `<meta name="google-site-verification" content="${escapeHtml(verificationToken)}">`,
    seo.description && `<meta name="description" content="${escapeHtml(seo.description)}">`,
    `<meta name="robots" content="${seo.noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large"}">`,
    !seo.noindex && `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="${seo.ogType}">`,
    `<meta property="og:site_name" content="${escapeHtml(catalog.store?.name || "")}">`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}">`,
    seo.description && `<meta property="og:description" content="${escapeHtml(seo.description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    seo.image && `<meta property="og:image" content="${escapeHtml(seo.image)}">`,
    `<meta name="twitter:card" content="${seo.image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}">`,
    seo.description && `<meta name="twitter:description" content="${escapeHtml(seo.description)}">`,
    seo.image && `<meta name="twitter:image" content="${escapeHtml(seo.image)}">`,
    ...(seo.noindex ? [] : seo.jsonLd.map(data =>
      `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`)),
    hashBridge(seo, themeId)
  ].filter(Boolean).join("\n");

  if (headEnd === -1) {
    const withHead = /<head\b[^>]*>/i;
    html = withHead.test(rest) ? rest.replace(withHead, m => `${m}\n${tags}\n`) : `${tags}\n${rest}`;
  } else {
    const open = head.match(/<head\b[^>]*>/i);
    html = open ? head.replace(open[0], `${open[0]}\n${tags}`) + rest : `${tags}\n${head}${rest}`;
  }
  if (seo.status === 200 && !seo.noindex) {
    const footer = poweredBy
      ? `<div style="text-align:center;padding:14px 12px 20px;font:12px/1.4 system-ui,sans-serif;opacity:.75"><a href="${escapeHtml(poweredBy.url)}" style="color:inherit">Powered by ${escapeHtml(poweredBy.name)}</a></div>`
      : "";
    const fallback = noscriptBody(seo, catalog, origin) + footer;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${fallback}</body>`) : `${html}${fallback}`;
  }
  return html;
}

function xmlUrl(loc, lastmod) {
  return `<url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : ""}</url>`;
}

export function buildSitemap(catalog, origin, themeId, extraPaths = []) {
  const urls = [xmlUrl(`${origin}/`), ...extraPaths.map(path => xmlUrl(`${origin}${path}`))];
  if (isPathRouted(themeId)) {
    for (const c of catalog.categories || []) urls.push(xmlUrl(`${origin}${entityPath("categories", c)}`));
    for (const p of catalog.products || []) urls.push(xmlUrl(`${origin}${entityPath("products", p)}`));
    for (const page of catalog.pages || []) {
      const date = /^\d{4}-\d{2}-\d{2}/.test(page.updated_at || "") ? page.updated_at.slice(0, 10) : "";
      urls.push(xmlUrl(`${origin}/pages/${encodeURIComponent(page.slug)}`, date));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.slice(0, 50000).join("\n")}\n</urlset>\n`;
}

export const PLATFORM_NAME = "E-Shop";

export function buildSitemapIndex(locations) {
  const entries = locations.slice(0, 50000)
    .map(location => `<sitemap><loc>${escapeHtml(location)}</loc></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

export function buildDirectoryPage(shops, origin) {
  const title = `Browse online shops | ${PLATFORM_NAME}`;
  const description = `Discover ${shops.length ? `${shops.length} ` : ""}online shops built on ${PLATFORM_NAME}. Browse products and order directly from local sellers.`;
  const cards = shops.map(shop =>
    `<li><a href="${escapeHtml(shop.url)}"><strong>${escapeHtml(shop.name)}</strong>` +
    (shop.description ? `<span>${escapeHtml(truncate(shop.description, 120))}</span>` : "") +
    `<em>${shop.productCount} product${shop.productCount === 1 ? "" : "s"}</em></a></li>`).join("\n");
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: shops.slice(0, 200).map((shop, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: shop.url,
      name: shop.name
    }))
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(truncate(description, DESCRIPTION_MAX))}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${escapeHtml(origin)}/shops">
<meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(truncate(description, DESCRIPTION_MAX))}"><meta property="og:url" content="${escapeHtml(origin)}/shops">
<script type="application/ld+json">${JSON.stringify(itemList).replace(/</g, "\\u003c")}</script>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1c1f23;--muted:#5d6670;--card:#f5f7f9;--line:#e3e7eb}
@media(prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#eef1f4;--muted:#9aa4ad;--card:#1e2328;--line:#2c333a}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:960px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:clamp(1.6rem,5vw,2.2rem);margin:0 0 8px}p.lead{color:var(--muted);margin:0 0 28px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
li a{display:flex;flex-direction:column;gap:4px;height:100%;box-sizing:border-box;padding:16px;background:var(--card);border:1px solid var(--line);border-radius:12px;color:inherit;text-decoration:none}
li a:hover{border-color:var(--fg)}li span{color:var(--muted);font-size:.9rem}li em{color:var(--muted);font-size:.8rem;font-style:normal;margin-top:auto}
</style></head>
<body><main>
<h1>Browse online shops</h1>
<p class="lead">${escapeHtml(description)}</p>
${shops.length ? `<ul>\n${cards}\n</ul>` : "<p>No shops are listed yet. Check back soon.</p>"}
</main></body></html>
`;
}

export function buildRobots(origin, hidden) {
  if (hidden) return "User-agent: *\nDisallow: /\n";
  // /api/catalog must stay crawlable: the storefront fetches it to render products.
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /api/catalog",
    "Disallow: /api/",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /account",
    "Disallow: /wishlist",
    "Disallow: /search",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    ""
  ].join("\n");
}
