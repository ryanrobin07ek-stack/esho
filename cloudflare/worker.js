const MAX_CATALOG_BYTES = 900_000;
const MAX_RECORDS = 1000;
const TENANT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{2,31}$/;
const RESERVED_TENANT_IDS = new Set(["www", "api", "admin", "assets", "main"]);
const DOMAIN_ROOT = "rrobin.co.ke";
const PASSWORD_ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_BUSINESS_SNAPSHOT_BYTES = 8_000_000;
const BUSINESS_STORE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const SNAPSHOT_ID_PATTERN = /^[a-f0-9]{64}$/;
const POS_SYNC_ENTITIES = new Set([
  "supplier", "purchase", "ticket", "sale", "product", "category", "expense", "setting"
]);
const MAX_POS_SYNC_BODY_BYTES = 1_000_000;
const MAX_POS_SYNC_CHANGES = 100;
const NEARBY_PAIRING_TTL_SECONDS = 180;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Nearby-Session",
  "Access-Control-Max-Age": "86400"
};

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...headers, "Content-Type": "application/json; charset=utf-8" }
  });
}

async function provisionMainOwnerKey(request, env) {
  if (!await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "Main shop owner authorization is required for initial key setup." }, 401);
  }
  let input = {};
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const current = await env.TENANTS.get("tenant:main", "json");
  if (current?.owner_token_hash && input.rotate !== true) {
    return jsonResponse({ error: "A main shop key already exists. Use the owner-key rotation flow." }, 409);
  }
  const ownerToken = generateTenantSecret();
  const tenant = {
    id: "main",
    name: "Main shop",
    owner_token_hash: await sha256Hex(ownerToken),
    owner_token_hashes: [],
    created_at: current?.created_at || new Date().toISOString()
  };
  await env.TENANTS.put("tenant:main", JSON.stringify(tenant));
  return jsonResponse({
    ok: true,
    tenant: { id: tenant.id, name: tenant.name, created_at: tenant.created_at },
    owner_token: ownerToken
  });
}

async function provisionTenantOwnerKey(request, env, tenantId) {
  if (!await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "The Cloudflare admin key is required to recover this shop once." }, 401);
  }
  if (!TENANT_ID_PATTERN.test(tenantId) || RESERVED_TENANT_IDS.has(tenantId)) {
    return jsonResponse({ error: "Invalid shop address." }, 400);
  }
  const tenant = await env.TENANTS.get(`tenant:${tenantId}`, "json");
  if (!tenant) return jsonResponse({ error: "Shop not found." }, 404);
  const ownerToken = generateTenantSecret();
  tenant.owner_token_hash = await sha256Hex(ownerToken);
  tenant.owner_token_hashes = [tenant.owner_token_hash];
  await env.TENANTS.put(`tenant:${tenantId}`, JSON.stringify(tenant));
  return jsonResponse({
    ok: true,
    owner_token: ownerToken,
    tenant: { id: tenant.id, name: tenant.name, hostname: `${tenant.id}.${DOMAIN_ROOT}` }
  });
}

function tenantIdFromRequest(request, env) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  if (hostname === DOMAIN_ROOT || hostname === `www.${DOMAIN_ROOT}`) return "main";
  if (hostname.endsWith(`.${DOMAIN_ROOT}`)) {
    const tenantId = hostname.slice(0, -(DOMAIN_ROOT.length + 1));
    return tenantId.includes(".") ? null : tenantId;
  }
  const requestedTenant = url.searchParams.get("tenant");
  return requestedTenant && TENANT_ID_PATTERN.test(requestedTenant) ? requestedTenant : "main";
}

async function authorizeAdmin(request, env) {
  return authorized(request, env.PUBLISH_TOKEN);
}

async function requireTenant(request, env, tenantId) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  if (hostname === DOMAIN_ROOT || hostname === `www.${DOMAIN_ROOT}` ||
      hostname.endsWith(`.${DOMAIN_ROOT}`)) {
    if (tenantId === "main") return { id: "main", name: "E-Shop" };
    if (!TENANT_ID_PATTERN.test(tenantId) || RESERVED_TENANT_IDS.has(tenantId)) return null;
    return await env.TENANTS.get(`tenant:${tenantId}`, "json");
  }
  if (tenantId === "main") {
    if (request.method === "GET" && url.searchParams.get("private") !== "1") {
      return { id: "main", name: "E-Shop" };
    }
    if (await authorizeAdmin(request, env) || await authorizeMainOwner(request, env)) {
      return { id: "main", name: "E-Shop" };
    }
    return null;
  }
  if (!TENANT_ID_PATTERN.test(tenantId) || RESERVED_TENANT_IDS.has(tenantId)) return null;
  return await env.TENANTS.get(`tenant:${tenantId}`, "json");
}

function cleanText(value, limit = 5000) {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function cleanImageUrl(value) {
  if (typeof value !== "string" || value.startsWith("data:")) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function cleanElementLink(value) {
  if (typeof value !== "string") return "";
  const link = value.trim().slice(0, 2000);
  if (!link || link.startsWith("//") || /[\u0000-\u001f\\]/.test(link)) return "";
  if (link.startsWith("/") || link.startsWith("#") || !/^[a-z][a-z0-9+.-]*:/i.test(link)) return link;
  try {
    const url = new URL(link);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? link : "";
  } catch {
    return "";
  }
}

function cleanCatalog(input) {
  if (!input || typeof input !== "object" ||
      !Array.isArray(input.products) || !Array.isArray(input.categories) ||
      input.products.length > MAX_RECORDS || input.categories.length > MAX_RECORDS ||
      (input.pages !== undefined && (!Array.isArray(input.pages) || input.pages.length > MAX_RECORDS))) {
    throw new TypeError("Catalog must contain product, category, and page arrays within the record limit.");
  }

  const categories = input.categories.map(category => ({
    id: Number(category.id),
    name: cleanText(category.name, 200),
    slug: cleanText(category.slug, 240),
    description: cleanText(category.description),
    image: cleanImageUrl(category.image),
    featured: category.featured ? 1 : 0
  }));
  if (categories.some(category => !Number.isSafeInteger(category.id) || category.id < 1 || !category.name)) {
    throw new TypeError("Every category needs a positive ID and a name.");
  }
  const pages = (input.pages || []).map(page => ({
    id: Number(page.id),
    title: cleanText(page.title, 80),
    slug: cleanText(page.slug, 80).toLowerCase(),
    content: cleanText(page.content, 12000),
    published: page.published ? 1 : 0,
    updated_at: cleanText(page.updated_at, 40)
  }));
  if (pages.some(page => !Number.isSafeInteger(page.id) || page.id < 1 || !page.title ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug))) {
    throw new TypeError("Every page needs a positive ID, title, and valid URL slug.");
  }

  const activeProducts = input.products.filter(product => product && product.status !== "archived");
  const products = activeProducts.map(product => ({
      id: Number(product.id),
      slug: cleanText(product.slug, 240),
      name: cleanText(product.name, 240),
      brand: cleanText(product.brand, 200),
      sku: cleanText(product.sku, 120),
      category_id: Number.isSafeInteger(Number(product.category_id)) ? Number(product.category_id) : null,
      price: Number(product.price),
      original_price: Number(product.original_price ?? product.price),
      discount: Number(product.discount || 0),
      stock: Math.max(0, Number(product.stock || 0)),
      rating: Number(product.rating || 0),
      review_count: Math.max(0, Number(product.review_count || 0)),
      description: cleanText(product.description),
      is_flagship: product.is_flagship ? 1 : 0,
      is_new: product.is_new ? 1 : 0,
      is_featured: product.is_featured ? 1 : 0,
      is_bestseller: product.is_bestseller ? 1 : 0,
      images: Array.isArray(product.images)
        ? product.images.map(cleanImageUrl).filter(Boolean).slice(0, 8)
        : [],
      sizes: Array.isArray(product.sizes) ? product.sizes.map(value => cleanText(value, 80)).slice(0, 50) : [],
      colors: Array.isArray(product.colors) ? product.colors.map(value => cleanText(value, 80)).slice(0, 50) : [],
      tags: Array.isArray(product.tags) ? product.tags.map(value => cleanText(value, 80)).slice(0, 50) : [],
      status: "active"
    }));
  if (products.some(product => !Number.isSafeInteger(product.id) || product.id < 1 ||
      !product.name || !Number.isFinite(product.price) || product.price < 0)) {
    throw new TypeError("Every product needs a positive ID, a name, and a valid price.");
  }

  const storeInput = input.store && typeof input.store === "object" ? input.store : {};
  const elementEdits = Array.isArray(storeInput.element_edits)
    ? storeInput.element_edits.slice(0, 250).flatMap(edit => {
      if (!edit || typeof edit !== "object" ||
          !/^#app > [a-z0-9-]+:nth-of-type\([1-9]\d*\)(?: > [a-z0-9-]+:nth-of-type\([1-9]\d*\))*$/i.test(edit.selector || "") ||
          !["text", "image", "icon", "link"].includes(edit.kind)) return [];
      const rotation = Number(edit.rotation);
      const cleanLineage = lineage => Array.isArray(lineage)
        ? lineage.slice(0, 16).filter(step => step && /^[a-z][a-z0-9-]*$/i.test(step.tag || "")).map(step => ({
          tag: step.tag.toLowerCase(),
          id: cleanText(step.id, 160),
          classes: cleanText(step.classes, 400),
          productId: cleanText(step.productId, 80),
          slide: cleanText(step.slide, 40),
          action: cleanText(step.action, 80),
          label: cleanText(step.label, 200)
        }))
        : [];
      return [{
        identity: cleanText(edit.identity, 100),
        selector: edit.selector,
        kind: edit.kind,
        text: edit.kind === "text" ? cleanText(edit.text, 5000) : "",
        src: edit.kind === "image" ? cleanImageUrl(edit.src) : "",
        originalText: edit.kind === "text" ? cleanText(edit.originalText, 5000) : "",
        originalSrc: edit.kind === "image" ? cleanImageUrl(edit.originalSrc) : "",
        originalSrcHash: /^[a-z0-9:]+$/i.test(edit.originalSrcHash || "")
          ? cleanText(edit.originalSrcHash, 100)
          : "",
        lineage: cleanLineage(edit.lineage),
        linkLineage: cleanLineage(edit.linkLineage),
        linkSelector: typeof edit.linkSelector === "string" &&
          /^#app > [a-z0-9-]+:nth-of-type\([1-9]\d*\)(?: > [a-z0-9-]+:nth-of-type\([1-9]\d*\))*$/i.test(edit.linkSelector)
          ? edit.linkSelector
          : "",
        href: cleanElementLink(edit.href),
        rotation: Number.isFinite(rotation) ? ((Math.trunc(rotation) % 360) + 360) % 360 : 0,
        deleted: edit.deleted ? 1 : 0
      }];
    })
    : [];
  const store = {
    name: cleanText(storeInput.name, 200),
    title: cleanText(storeInput.title, 240),
    tagline: cleanText(storeInput.tagline, 500),
    description: cleanText(storeInput.description),
    location: cleanText(storeInput.location, 240),
    email: cleanText(storeInput.email, 240),
    phone: cleanText(storeInput.phone, 80),
    currency: cleanText(storeInput.currency, 8),
    currency_symbol: cleanText(storeInput.currency_symbol, 8),
    announcement: cleanText(storeInput.announcement, 500),
    announcement_active: storeInput.announcement_active ? 1 : 0,
    primary_color: /^#[0-9a-f]{6}$/i.test(storeInput.primary_color || "") ? storeInput.primary_color : "",
    background_color: /^#[0-9a-f]{6}$/i.test(storeInput.background_color || "") ? storeInput.background_color : "",
    text_color: /^#[0-9a-f]{6}$/i.test(storeInput.text_color || "") ? storeInput.text_color : "",
    card_radius: cleanText(storeInput.card_radius, 30),
    font_family: ["sans", "serif", "humanist", "geometric", "classic", "mono"].includes(storeInput.font_family)
      ? storeInput.font_family
      : "sans",
    element_edits: elementEdits
  };

  const privateProducts = products.map((product, index) => ({
    ...product,
    cost_price: Math.max(0, Number(activeProducts[index]?.cost_price || 0))
  }));
  return {
    publicCatalog: { products, categories, store, pages: pages.filter(page => page.published) },
    privateCatalog: { products: privateProducts, categories, store, pages }
  };
}

async function authorized(request, expectedToken) {
  const authorization = request.headers.get("Authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expectedToken || !supplied) return false;
  const encoder = new TextEncoder();
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied))
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const suppliedBytes = new Uint8Array(suppliedHash);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index++) {
    difference |= expectedBytes[index] ^ suppliedBytes[index];
  }
  return difference === 0;
}

async function authorizeMainOwner(request, env) {
  return authorizeTenantOwner(request, env, "main");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function concatBytes(...parts) {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function hkdf(input, salt, info, length) {
  const key = await crypto.subtle.importKey("raw", input, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: "HKDF", hash: "SHA-256", salt, info
  }, key, length * 8));
}

async function createWebPushRequest(subscription, message, env) {
  const endpoint = new URL(subscription.endpoint);
  const allowedPushHosts = [
    "fcm.googleapis.com", "updates.push.services.mozilla.com",
    "push.services.mozilla.com", "web.push.apple.com", "wns.windows.com"
  ];
  if (endpoint.protocol !== "https:" ||
      !allowedPushHosts.some(host => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`))) {
    throw new Error("Unsupported push endpoint host.");
  }
  const publicBytes = decodeBase64Url(env.VAPID_PUBLIC_KEY);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error("Invalid VAPID public key.");
  const privateBytes = decodeBase64Url(env.VAPID_PRIVATE_KEY);
  if (privateBytes.length !== 32) throw new Error("Invalid VAPID private key.");
  const x = encodeBase64Url(publicBytes.slice(1, 33));
  const y = encodeBase64Url(publicBytes.slice(33));
  const signingKey = await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256", x, y, d: encodeBase64Url(privateBytes),
    ext: true, key_ops: ["sign"]
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const jwtHeader = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const jwtPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    aud: endpoint.origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT
  })));
  const unsignedJwt = `${jwtHeader}.${jwtPayload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, signingKey, new TextEncoder().encode(unsignedJwt)
  ));
  const jwt = `${unsignedJwt}.${encodeBase64Url(signature)}`;

  const clientPublicBytes = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (clientPublicBytes.length !== 65 || clientPublicBytes[0] !== 4 || authSecret.length < 16) {
    throw new Error("Invalid push subscription keys.");
  }
  const clientPublicKey = await crypto.subtle.importKey(
    "raw", clientPublicBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const serverPublicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey }, serverKeys.privateKey, 256
  ));
  const info = concatBytes(new TextEncoder().encode("WebPush: info\0"), clientPublicBytes, serverPublicBytes);
  const inputKeyMaterial = await hkdf(sharedSecret, authSecret, info, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(inputKeyMaterial, salt, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(inputKeyMaterial, salt, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const contentKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cleartext = concatBytes(new TextEncoder().encode(JSON.stringify(message)), new Uint8Array([2]));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce }, contentKey, cleartext
  ));
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = serverPublicBytes.length;
  const body = concatBytes(header, serverPublicBytes, encrypted);
  return fetch(endpoint.href, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      TTL: "86400",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream"
    },
    body
  });
}

function generateTenantSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64Url(bytes);
}

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function passwordHash(password, salt) {
  const padding = "=".repeat((4 - salt.length % 4) % 4);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: Uint8Array.from(atob(salt.replace(/-/g, "+").replace(/_/g, "/") + padding), character => character.charCodeAt(0)),
    iterations: PASSWORD_ITERATIONS
  }, key, 256);
  return encodeBase64Url(new Uint8Array(bits));
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyTurnstile(request, env, token) {
  if (typeof token !== "string" || !token) return { ok: false, codes: ["missing-input-response"] };
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token
  });
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) return { ok: false, codes: [`siteverify-http-${response.status}`] };
  const result = await response.json();
  return {
    ok: result.success === true,
    codes: Array.isArray(result["error-codes"]) ? result["error-codes"] : []
  };
}

async function limitAuthRequests(request, env, action, limit, expirationTtl) {
  if (!env.TENANTS) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `auth-limit:${action}:${await sha256Hex(ip)}`;
  const current = Number(await env.TENANTS.get(key) || 0);
  if (current >= limit) return false;
  await env.TENANTS.put(key, String(current + 1), { expirationTtl });
  return true;
}

async function accountSession(request, env) {
  if (!env.TENANTS) return null;
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  const record = await env.TENANTS.get(`session:${await sha256Hex(token)}`, "json");
  return record && typeof record.username === "string" ? record : null;
}

async function refreshAccountSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const session = await accountSession(request, env);
  if (!token || !session) return jsonResponse({ error: "Your account session expired. Sign in again." }, 401);
  await env.TENANTS.put(
    `session:${await sha256Hex(token)}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
  const result = await env.DB.prepare(
    "SELECT tenant_id FROM account_tenants WHERE username = ? ORDER BY tenant_id"
  ).bind(session.username).all();
  const tenants = [];
  for (const row of result.results || []) {
    const tenant = await env.TENANTS.get(`tenant:${row.tenant_id}`, "json");
    if (tenant) tenants.push({ id: tenant.id, name: tenant.name || tenant.id });
  }
  return jsonResponse({ ok: true, username: session.username, tenants });
}

async function authenticateAccount(request, env, input, isRegistration) {
  if (!env.DB || !env.TENANTS) return jsonResponse({ error: "Account service is not configured." }, 503);
  const username = normalizeUsername(input.username);
  const password = typeof input.password === "string" ? input.password : "";
  if (!USERNAME_PATTERN.test(username)) {
    return jsonResponse({ error: "Username must be 3â€“32 characters using letters, numbers, dots, underscores, or hyphens." }, 400);
  }
  if (password.length < 12 || password.length > 128) {
    return jsonResponse({ error: "Password must be at least 12 characters and no more than 128." }, 400);
  }
  if (isRegistration && !env.TURNSTILE_SECRET_KEY) {
    // Server misconfiguration, not the user's fault: don't burn their rate limit or blame the widget.
    return jsonResponse({ error: "Sign-up is unavailable: TURNSTILE_SECRET_KEY is not set on the Worker." }, 503);
  }
  if (!await limitAuthRequests(request, env, isRegistration ? "register" : "login", isRegistration ? 5 : 10, isRegistration ? 3600 : 900)) {
    return jsonResponse({ error: "Too many attempts. Please try again later." }, 429);
  }
  if (isRegistration) {
    const verification = await verifyTurnstile(request, env, input.turnstile_token);
    if (!verification.ok) {
      return jsonResponse({
        error: "Cloudflare human verification was rejected by the server.",
        error_codes: verification.codes
      }, 403);
    }
  }

  let user;
  if (isRegistration) {
    const salt = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await passwordHash(password, salt);
    const result = await env.DB.prepare(
      "INSERT OR IGNORE INTO accounts (username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?)"
    ).bind(username, salt, hash, new Date().toISOString()).run();
    if (!result.meta?.changes) {
      return jsonResponse({ error: "That username is already registered. Sign in instead." }, 409);
    }
    user = { username };
  } else {
    user = await env.DB.prepare(
      "SELECT username, password_salt, password_hash FROM accounts WHERE username = ?"
    ).bind(username).first();
    const salt = user?.password_salt || encodeBase64Url(new Uint8Array(16));
    const candidateHash = await passwordHash(password, salt);
    if (!user || !constantTimeEqual(candidateHash, user.password_hash)) {
      return jsonResponse({ error: "Username or password is incorrect." }, 401);
    }
  }

  const sessionToken = generateTenantSecret();
  await env.TENANTS.put(
    `session:${await sha256Hex(sessionToken)}`,
    JSON.stringify({ username: user.username }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
  const tenants = await env.DB.prepare(
    "SELECT tenant_id FROM account_tenants WHERE username = ? ORDER BY tenant_id"
  ).bind(username).all();
  const ownedTenants = [];
  for (const row of tenants.results || []) {
    const tenant = await env.TENANTS.get(`tenant:${row.tenant_id}`, "json");
    if (!tenant) continue;
    const ownerToken = generateTenantSecret();
    const tokenHash = await sha256Hex(ownerToken);
    tenant.owner_token_hashes = [...new Set([...(tenant.owner_token_hashes || []), tenant.owner_token_hash, tokenHash].filter(Boolean))];
    await env.TENANTS.put(`tenant:${tenant.id}`, JSON.stringify(tenant));
    ownedTenants.push({
      id: tenant.id,
      name: tenant.name,
      hostname: `${tenant.id}.${DOMAIN_ROOT}`,
      owner_token: ownerToken
    });
  }
  return jsonResponse({
    ok: true,
    session_token: sessionToken,
    username,
    tenants: ownedTenants
  });
}

async function handleAccountAuth(request, env, action) {
  if (request.method === "GET" && action === "config") {
    return jsonResponse({ turnstile_site_key: env.TURNSTILE_SITE_KEY || "" });
  }
  if (request.method === "GET" && action === "session") {
    return refreshAccountSession(request, env);
  }
  if (request.method !== "POST" || !["register", "login"].includes(action)) {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, POST, OPTIONS" });
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 16_384) {
    return jsonResponse({ error: "Account request exceeds the 16 KB limit." }, 413);
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  return authenticateAccount(request, env, input, action === "register");
}

async function limitTenantSignups(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `signup:${await sha256Hex(ip)}`;
  const current = Number(await env.TENANTS.get(key) || 0);
  if (current >= 5) return false;
  await env.TENANTS.put(key, String(current + 1), { expirationTtl: 3600 });
  return true;
}

async function authorizeTenantOwner(request, env, tenantId) {
  const tenant = await env.TENANTS.get(`tenant:${tenantId}`, "json");
  if (!tenant || typeof tenant.owner_token_hash !== "string") return false;
  const authorization = request.headers.get("Authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supplied) return false;
  const suppliedHash = await sha256Hex(supplied);
  return [tenant.owner_token_hash, ...(Array.isArray(tenant.owner_token_hashes) ? tenant.owner_token_hashes : [])]
    .filter(Boolean)
    .some(expected => constantTimeEqual(suppliedHash, expected));
}

async function authorizeTenantAccount(request, env, tenantId) {
  if (!env.DB) return false;
  const session = await accountSession(request, env);
  if (!session) return false;
  const association = await env.DB.prepare(
    "SELECT 1 AS owned FROM account_tenants WHERE username = ? AND tenant_id = ?"
  ).bind(session.username, tenantId).first();
  if (association) return true;
  const tenant = await env.TENANTS.get(`tenant:${tenantId}`, "json");
  return tenant?.owner_username === session.username;
}

async function handleCatalog(request, env, tenantId) {
  const isTenantDomain = new URL(request.url).hostname.toLowerCase().endsWith(`.${DOMAIN_ROOT}`);
  const isPrivateRead = request.method === "GET" && new URL(request.url).searchParams.get("private") === "1";
  if (tenantId !== "main" && !isTenantDomain && !await authorizeTenantOwner(request, env, tenantId)) {
    return jsonResponse({ error: "Shop not found or owner key is invalid." }, 404);
  }
  const tenant = await requireTenant(request, env, tenantId);
  if (!tenant && tenantId === "main" && request.method !== "GET") {
    return jsonResponse({ error: "Main shop owner authorization required." }, 401);
  }
  if (!tenant && tenantId === "main" && isPrivateRead) {
    return jsonResponse({ error: "Main shop owner authorization required." }, 401);
  }
  if (!tenant) return jsonResponse({ error: "Shop not found or owner key is invalid." }, 404);
  if (request.method === "GET") {
    if (isPrivateRead) {
      const isOwner = tenantId === "main"
        ? await authorizeMainOwner(request, env)
        : await authorizeTenantOwner(request, env, tenantId);
      if (!isOwner && !await authorizeAdmin(request, env)) {
        return jsonResponse({ error: "Shop owner authorization required." }, 401);
      }
    }
    const row = await env.DB.prepare(
      "SELECT payload, admin_payload, updated_at FROM catalog_snapshots WHERE tenant_id = ?"
    ).bind(tenantId).first();
    if (!row) return jsonResponse({ products: [], categories: [], store: {}, updated_at: null });
    const payload = isPrivateRead && row.admin_payload && row.admin_payload !== "{}"
      ? row.admin_payload
      : row.payload;
    const catalog = JSON.parse(payload);
    const sharedRows = await env.DB.prepare(
      "SELECT sku, stock FROM inventory_stock WHERE tenant_id = ?"
    ).bind(tenantId).all();
    const sharedStock = new Map((sharedRows.results || []).map(item => [item.sku, Number(item.stock)]));
    for (const product of catalog.products || []) {
      if (product.sku && sharedStock.has(product.sku)) {
        product.stock = sharedStock.get(product.sku);
        product.inventory_shared = true;
      }
    }
    return jsonResponse({ ...catalog, updated_at: row.updated_at });
  }

  if (request.method !== "PUT") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, PUT, OPTIONS" });
  }
  const isOwner = tenantId === "main"
    ? await authorizeMainOwner(request, env)
    : await authorizeTenantOwner(request, env, tenantId);
  if (!isOwner && !await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "Shop owner authorization required." }, 401);
  }

  let input;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_CATALOG_BYTES) {
      return jsonResponse({ error: "Catalog is too large. Move uploaded photos to R2 before publishing." }, 413);
    }
    input = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  let catalog;
  try {
    catalog = cleanCatalog(input);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const payload = JSON.stringify(catalog.publicCatalog);
  const privatePayload = JSON.stringify(catalog.privateCatalog);
  if (new TextEncoder().encode(payload).byteLength > MAX_CATALOG_BYTES) {
    return jsonResponse({ error: "Catalog is too large. Move uploaded photos to R2 before publishing." }, 413);
  }
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO catalog_snapshots (tenant_id, payload, admin_payload, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, admin_payload = excluded.admin_payload,
     updated_at = excluded.updated_at`
  ).bind(tenantId, payload, privatePayload, updatedAt).run();
  return jsonResponse({
    ok: true,
    updated_at: updatedAt,
    product_count: catalog.publicCatalog.products.length,
    category_count: catalog.publicCatalog.categories.length
  });
}

function storefrontOrderResponse(row) {
  return {
    order_number: row.order_number,
    status: row.status,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    shipping_address: row.shipping_address,
    city: row.city,
    postal_code: row.postal_code,
    country: row.country,
    currency: row.currency,
    subtotal: Number(row.subtotal_cents) / 100,
    discount: Number(row.discount_cents) / 100,
    shipping: Number(row.shipping_cents) / 100,
    total: Number(row.total_cents) / 100,
    payment_status: row.payment_status || "unpaid",
    items: JSON.parse(row.items_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function handleStorefrontOrders(request, env, tenantId) {
  if (!env.DB) return jsonResponse({ error: "Order storage is not configured." }, 503);
  const isOwner = tenantId === "main"
    ? await authorizeMainOwner(request, env)
    : await authorizeTenantOwner(request, env, tenantId);
  if (request.method === "GET") {
    if (!isOwner && !await authorizeAdmin(request, env)) {
      return jsonResponse({ error: "Shop owner authorization required." }, 401);
    }
    const listed = await env.DB.prepare(
      "SELECT * FROM storefront_orders WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200"
    ).bind(tenantId).all();
    return jsonResponse({ orders: (listed.results || []).map(storefrontOrderResponse) });
  }
  if (request.method === "PATCH") {
    if (!isOwner && !await authorizeAdmin(request, env)) {
      return jsonResponse({ error: "Shop owner authorization required." }, 401);
    }
    let input;
    try {
      input = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    const orderNumber = typeof input?.order_number === "string" ? input.order_number.trim() : "";
    const status = typeof input?.status === "string" ? input.status : "";
    if (!/^ORD-[A-Z0-9-]{8,80}$/.test(orderNumber)
      || !["pending", "confirmed", "processing", "ready", "fulfilled", "cancelled"].includes(status)) {
      return jsonResponse({ error: "Choose a valid order and fulfillment status." }, 400);
    }
    const updatedAt = new Date().toISOString();
    const result = await env.DB.prepare(
      "UPDATE storefront_orders SET status=?,updated_at=? WHERE tenant_id=? AND order_number=?"
    ).bind(status, updatedAt, tenantId, orderNumber).run();
    if (!Number(result.meta?.changes || 0)) return jsonResponse({ error: "Order not found." }, 404);
    const order = await env.DB.prepare(
      "SELECT * FROM storefront_orders WHERE tenant_id=? AND order_number=?"
    ).bind(tenantId, orderNumber).first();
    return jsonResponse({ order: storefrontOrderResponse(order) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, POST, PATCH, OPTIONS" });
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 65_536) {
    return jsonResponse({ error: "Order request exceeds the 64 KB limit." }, 413);
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const idempotencyKey = typeof input?.idempotency_key === "string" ? input.idempotency_key : "";
  const customerName = cleanText(input?.customer_name, 160).trim();
  const customerEmail = cleanText(input?.customer_email, 240).trim().toLowerCase();
  const customerPhone = cleanText(input?.customer_phone, 40).trim();
  const address = "";
  const city = "";
  const postalCode = "";
  const country = "";
  if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey) || !customerName
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    || !Array.isArray(input?.items) || !input.items.length || input.items.length > 50) {
    return jsonResponse({ error: "Order needs an idempotency key, customer name, valid email and at least one item." }, 400);
  }
  const existing = await env.DB.prepare(
    "SELECT * FROM storefront_orders WHERE tenant_id=? AND idempotency_key=?"
  ).bind(tenantId, idempotencyKey).first();
  if (existing) return jsonResponse({ order: storefrontOrderResponse(existing), duplicate: true }, 200);

  const catalogRow = await env.DB.prepare(
    "SELECT payload FROM catalog_snapshots WHERE tenant_id=?"
  ).bind(tenantId).first();
  if (!catalogRow) return jsonResponse({ error: "This shop has not published a catalogue yet." }, 409);
  const catalog = JSON.parse(catalogRow.payload);
  const products = new Map((catalog.products || []).map(product => [String(product.id), product]));
  const normalizedItems = [];
  let subtotalCents = 0;
  for (const requested of input.items) {
    const product = products.get(String(requested?.product_id));
    const quantity = Number(requested?.quantity);
    if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      return jsonResponse({ error: "An item is unavailable or has an invalid quantity." }, 409);
    }
    if (product.stock <= 0 || quantity > product.stock) {
      return jsonResponse({ error: `${product.name} does not have enough stock for this order.` }, 409);
    }
    const priceCents = Math.round(Number(product.price) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
      return jsonResponse({ error: "A catalogue price is invalid. Please contact the shop." }, 409);
    }
    subtotalCents += priceCents * quantity;
    normalizedItems.push({
      product_id: product.id, name: cleanText(product.name, 240),
      sku: cleanText(product.sku, 120), quantity, unit_price: priceCents / 100
    });
  }
  const discountCents = 0;
  const shippingCents = 0;
  const totalCents = subtotalCents - discountCents + shippingCents;
  const currency = /^[A-Z]{3}$/.test(catalog.store?.currency || "") ? catalog.store.currency : "KES";
  const createdAt = new Date().toISOString();
  const orderNumber = `ORD-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const statement = env.DB.prepare(
    `INSERT OR IGNORE INTO storefront_orders
     (tenant_id,order_number,idempotency_key,status,customer_name,customer_email,customer_phone,
      shipping_address,city,postal_code,country,currency,subtotal_cents,discount_cents,shipping_cents,
      total_cents,items_json,created_at,updated_at)
     VALUES (?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(tenantId, orderNumber, idempotencyKey, customerName, customerEmail, customerPhone,
    address, city, postalCode, country, currency, subtotalCents, discountCents, shippingCents,
    totalCents, JSON.stringify(normalizedItems), createdAt, createdAt);
  await statement.run();
  const saved = await env.DB.prepare(
    "SELECT * FROM storefront_orders WHERE tenant_id=? AND idempotency_key=?"
  ).bind(tenantId, idempotencyKey).first();
  return jsonResponse({ order: storefrontOrderResponse(saved) }, 201);
}

function paystackAuthorization(secret) {
  return { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
}

function paystackSetupResponse(row) {
  if (!row || !row.subaccount_code) return { connected: false };
  return {
    configured: true,
    connected: row.status === "connected",
    status: row.status,
    bank_name: row.bank_name,
    account_last4: row.account_last4,
    updated_at: row.updated_at
  };
}

async function handlePaystackSetup(request, env, tenantId, resource) {
  if (!["GET", "POST"].includes(request.method) || (resource === "banks" && request.method !== "GET")) {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: resource === "banks" ? "GET, OPTIONS" : "GET, POST, OPTIONS" });
  }
  if (resource === "banks") {
    let response;
    try {
      response = await fetch("https://api.paystack.co/bank?country=kenya&currency=KES&use_cursor=false&perPage=100", {
        headers: env.PAYSTACK_SECRET_KEY ? paystackAuthorization(env.PAYSTACK_SECRET_KEY) : {},
        cf: { cacheEverything: true, cacheTtl: 3600 }
      });
    } catch {
      return jsonResponse({ error: "Could not reach Paystack to load supported banks." }, 502);
    }
    if (!response.ok) return jsonResponse({ error: "Paystack could not provide the supported bank list." }, 502);
    let result;
    try {
      result = await response.json();
    } catch {
      return jsonResponse({ error: "Paystack returned an unreadable bank list." }, 502);
    }
    const banks = Array.isArray(result.data) ? result.data
      .filter(bank => typeof bank?.name === "string" && typeof bank?.code === "string")
      .map(bank => ({ name: bank.name.slice(0, 120), code: bank.code.slice(0, 32) })) : [];
    return jsonResponse({ banks }, 200, { "Cache-Control": "public, max-age=3600" });
  }
  const isOwner = tenantId === "main"
    ? await authorizeMainOwner(request, env)
    : await authorizeTenantOwner(request, env, tenantId);
  if (!isOwner) return jsonResponse({ error: "Shop owner authorization required." }, 401);
  if (!env.DB) return jsonResponse({ error: "Payment setup storage is not configured." }, 503);
  if (!env.PAYSTACK_SECRET_KEY) return jsonResponse({ error: "Paystack is not configured on this server." }, 503);

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT subaccount_code,status,bank_name,account_last4,updated_at FROM paystack_subaccounts WHERE tenant_id=?"
    ).bind(tenantId).first();
    return jsonResponse({ account: paystackSetupResponse(row) });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 16_384) {
    return jsonResponse({ error: "Paystack setup request exceeds the 16 KB limit." }, 413);
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const businessName = cleanText(input?.business_name, 120).trim();
  const contactName = cleanText(input?.primary_contact_name, 120).trim();
  const contactEmail = cleanText(input?.primary_contact_email, 240).trim().toLowerCase();
  const contactPhone = cleanText(input?.primary_contact_phone, 40).trim();
  const bankCode = typeof input?.settlement_bank === "string" ? input.settlement_bank.trim() : "";
  const accountNumber = typeof input?.account_number === "string" ? input.account_number.trim() : "";
  if (!businessName || !contactName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    || !contactPhone || !/^[a-zA-Z0-9_-]{1,32}$/.test(bankCode) || !/^\d{5,20}$/.test(accountNumber)) {
    return jsonResponse({ error: "Enter a business name, contact details, supported bank and valid account number." }, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT subaccount_code,status,bank_name,account_last4,updated_at FROM paystack_subaccounts WHERE tenant_id=?"
  ).bind(tenantId).first();
  if (existing?.status === "setup_in_progress") {
    return jsonResponse({ error: "Paystack setup is already in progress for this shop." }, 409);
  }
  const lockTime = new Date().toISOString();
  if (!existing) {
    const lock = await env.DB.prepare(
      "INSERT OR IGNORE INTO paystack_subaccounts (tenant_id,status,created_at,updated_at) VALUES (?,'setup_in_progress',?,?)"
    ).bind(tenantId, lockTime, lockTime).run();
    if (!Number(lock.meta?.changes || 0)) {
      return jsonResponse({ error: "Paystack setup is already in progress for this shop." }, 409);
    }
  }

  const payload = {
    business_name: businessName,
    settlement_bank: bankCode,
    account_number: accountNumber,
    percentage_charge: 0,
    primary_contact_name: contactName,
    primary_contact_email: contactEmail,
    primary_contact_phone: contactPhone
  };
  let response;
  try {
    response = await fetch(existing?.subaccount_code
      ? `https://api.paystack.co/subaccount/${encodeURIComponent(existing.subaccount_code)}`
      : "https://api.paystack.co/subaccount", {
      method: existing?.subaccount_code ? "PUT" : "POST",
      headers: paystackAuthorization(env.PAYSTACK_SECRET_KEY),
      body: JSON.stringify(payload)
    });
  } catch {
    if (!existing) {
      await env.DB.prepare("DELETE FROM paystack_subaccounts WHERE tenant_id=? AND subaccount_code IS NULL")
        .bind(tenantId).run();
    }
    return jsonResponse({ error: "Could not reach Paystack. No account details were saved by this shop." }, 502);
  }
  if (!response.ok) {
    if (!existing) {
      await env.DB.prepare("DELETE FROM paystack_subaccounts WHERE tenant_id=? AND subaccount_code IS NULL")
        .bind(tenantId).run();
    }
    return jsonResponse({ error: "Paystack could not verify or connect this bank account. Check the details and try again." }, 502);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    if (!existing) {
      await env.DB.prepare("DELETE FROM paystack_subaccounts WHERE tenant_id=? AND subaccount_code IS NULL")
        .bind(tenantId).run();
    }
    return jsonResponse({ error: "Paystack returned an unreadable account setup response." }, 502);
  }
  const data = result?.data;
  const subaccountCode = typeof data?.subaccount_code === "string" ? data.subaccount_code : "";
  if (!subaccountCode || !/^ACCT_[A-Za-z0-9]+$/.test(subaccountCode)) {
    if (!existing) {
      await env.DB.prepare("DELETE FROM paystack_subaccounts WHERE tenant_id=? AND subaccount_code IS NULL")
        .bind(tenantId).run();
    }
    return jsonResponse({ error: "Paystack returned an incomplete account setup response." }, 502);
  }
  const bankName = cleanText(data.settlement_bank || bankCode, 120);
  const returnedAccountNumber = typeof data.account_number === "string" ? data.account_number : accountNumber;
  const accountLast4 = returnedAccountNumber.replace(/\D/g, "").slice(-4);
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO paystack_subaccounts
      (tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at)
     VALUES (?,?,?, ?,?,?,?)
     ON CONFLICT(tenant_id) DO UPDATE SET
       subaccount_code=excluded.subaccount_code,status=excluded.status,bank_name=excluded.bank_name,
       account_last4=excluded.account_last4,updated_at=excluded.updated_at`
  ).bind(tenantId, subaccountCode, data.active === false ? "inactive" : "connected",
    bankName, accountLast4, existing?.created_at || updatedAt, updatedAt).run();
  const saved = await env.DB.prepare(
    "SELECT subaccount_code,status,bank_name,account_last4,updated_at FROM paystack_subaccounts WHERE tenant_id=?"
  ).bind(tenantId).first();
  return jsonResponse({ account: paystackSetupResponse(saved) });
}

function paystackReference() {
  return `ESHOP_${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function paystackCallbackUrl(tenantId, orderNumber, reference) {
  const host = tenantId === "main" ? DOMAIN_ROOT : `${tenantId}.${DOMAIN_ROOT}`;
  const callback = new URL(`https://${host}/`);
  callback.hash = `/checkout/confirmation?${new URLSearchParams({
    orderId: orderNumber,
    reference,
    tenant: tenantId
  })}`;
  return callback.toString();
}

async function updateOrderPayment(env, order, paymentStatus, paidAt = null) {
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE storefront_orders
     SET payment_status=?,paid_at=COALESCE(?,paid_at),updated_at=?
     WHERE tenant_id=? AND order_number=? AND payment_reference=? AND payment_status!='paid'`
  ).bind(paymentStatus, paidAt, updatedAt, order.tenant_id, order.order_number, order.payment_reference).run();
}

function transactionMatchesOrder(transaction, order) {
  return transaction?.reference === order.payment_reference
    && Number(transaction.amount) === Number(order.total_cents)
    && transaction.currency === order.currency;
}

async function handlePaystackPayment(request, env, tenantId, action) {
  if (!env.DB) return jsonResponse({ error: "Payment storage is not configured." }, 503);
  if (!env.PAYSTACK_SECRET_KEY) return jsonResponse({ error: "Paystack is not configured on this server." }, 503);

  if (action === "initialize") {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_192) {
      return jsonResponse({ error: "Payment request exceeds the 8 KB limit." }, 413);
    }
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    const orderNumber = typeof input?.order_number === "string" ? input.order_number.trim() : "";
    if (!/^ORD-[A-Z0-9-]{8,80}$/.test(orderNumber)) {
      return jsonResponse({ error: "A valid order number is required." }, 400);
    }
    const order = await env.DB.prepare(
      "SELECT * FROM storefront_orders WHERE tenant_id=? AND order_number=?"
    ).bind(tenantId, orderNumber).first();
    if (!order) return jsonResponse({ error: "Order not found." }, 404);
    if (order.status === "cancelled") return jsonResponse({ error: "This order has been cancelled." }, 409);
    if (order.payment_status === "paid") return jsonResponse({ error: "This order is already paid." }, 409);
    if (Number(order.total_cents) < 1 || order.currency !== "KES") {
      return jsonResponse({ error: "Paystack checkout currently requires a positive KES order total." }, 409);
    }
    if (order.payment_authorization_url && order.payment_status === "pending") {
      return jsonResponse({
        order_number: order.order_number,
        reference: order.payment_reference,
        authorization_url: order.payment_authorization_url
      });
    }
    if (order.payment_status === "initializing") {
      return jsonResponse({ error: "Payment setup is already in progress for this order." }, 409);
    }
    const subaccount = await env.DB.prepare(
      "SELECT subaccount_code,status FROM paystack_subaccounts WHERE tenant_id=?"
    ).bind(tenantId).first();
    if (!subaccount?.subaccount_code || subaccount.status !== "connected") {
      return jsonResponse({ error: "This shop has not connected an active Paystack settlement account." }, 409);
    }

    const reference = paystackReference();
    const reserved = await env.DB.prepare(
      `UPDATE storefront_orders SET payment_reference=?,payment_status='initializing',
         payment_authorization_url=NULL,paid_at=NULL,updated_at=?
       WHERE tenant_id=? AND order_number=? AND payment_status IN ('unpaid','failed')`
    ).bind(reference, new Date().toISOString(), tenantId, orderNumber).run();
    if (!Number(reserved.meta?.changes || 0)) {
      return jsonResponse({ error: "Could not reserve payment setup for this order. Retry once." }, 409);
    }

    let response;
    try {
      response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: paystackAuthorization(env.PAYSTACK_SECRET_KEY),
        body: JSON.stringify({
          email: order.customer_email,
          amount: Number(order.total_cents),
          currency: order.currency,
          subaccount: subaccount.subaccount_code,
          transaction_charge: 0,
          bearer: "subaccount",
          reference,
          callback_url: paystackCallbackUrl(tenantId, orderNumber, reference),
          metadata: { tenant_id: tenantId, order_number: orderNumber }
        })
      });
    } catch {
      await updateOrderPayment(env, { ...order, payment_reference: reference }, "failed");
      return jsonResponse({ error: "Could not reach Paystack to start checkout." }, 502);
    }
    if (!response.ok) {
      await updateOrderPayment(env, { ...order, payment_reference: reference }, "failed");
      return jsonResponse({ error: "Paystack could not start checkout for this order." }, 502);
    }
    let result;
    try {
      result = await response.json();
    } catch {
      await updateOrderPayment(env, { ...order, payment_reference: reference }, "failed");
      return jsonResponse({ error: "Paystack returned an unreadable checkout response." }, 502);
    }
    const data = result?.data;
    let authorizationUrl;
    try {
      authorizationUrl = new URL(data?.authorization_url);
    } catch {
      await updateOrderPayment(env, { ...order, payment_reference: reference }, "failed");
      return jsonResponse({ error: "Paystack returned an invalid checkout link." }, 502);
    }
    if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "checkout.paystack.com"
      || data?.reference !== reference) {
      await updateOrderPayment(env, { ...order, payment_reference: reference }, "failed");
      return jsonResponse({ error: "Paystack returned an invalid checkout response." }, 502);
    }
    await env.DB.prepare(
      `UPDATE storefront_orders SET payment_status='pending',payment_authorization_url=?,updated_at=?
       WHERE tenant_id=? AND order_number=? AND payment_reference=?`
    ).bind(authorizationUrl.toString(), new Date().toISOString(), tenantId, orderNumber, reference).run();
    return jsonResponse({ order_number: orderNumber, reference, authorization_url: authorizationUrl.toString() });
  }

  if (action === "verify") {
    if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, OPTIONS" });
    const reference = new URL(request.url).searchParams.get("reference") || "";
    if (!/^ESHOP_[A-F0-9]{32}$/.test(reference)) {
      return jsonResponse({ error: "A valid payment reference is required." }, 400);
    }
    const order = await env.DB.prepare(
      "SELECT * FROM storefront_orders WHERE tenant_id=? AND payment_reference=?"
    ).bind(tenantId, reference).first();
    if (!order) return jsonResponse({ error: "Payment reference not found." }, 404);
    if (order.payment_status === "paid") {
      return jsonResponse({
        tenant_id: tenantId,
        order: storefrontOrderResponse(order),
        order_number: order.order_number,
        payment_status: "paid",
        paid_at: order.paid_at
      });
    }
    let response;
    try {
      response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: paystackAuthorization(env.PAYSTACK_SECRET_KEY)
      });
    } catch {
      return jsonResponse({ error: "Could not reach Paystack to verify this payment." }, 502);
    }
    if (!response.ok) return jsonResponse({ error: "Paystack could not verify this payment." }, 502);
    let result;
    try {
      result = await response.json();
    } catch {
      return jsonResponse({ error: "Paystack returned an unreadable verification response." }, 502);
    }
    const transaction = result?.data;
    if (!transactionMatchesOrder(transaction, order)) {
      return jsonResponse({ error: "Payment details do not match this order." }, 409);
    }
    const paymentStatus = transaction.status === "success" ? "paid"
      : ["failed", "abandoned"].includes(transaction.status) ? "failed" : "pending";
    const paidAt = paymentStatus === "paid" ? new Date().toISOString() : null;
    await updateOrderPayment(env, order, paymentStatus, paidAt);
    return jsonResponse({
      tenant_id: tenantId,
      order: storefrontOrderResponse({ ...order, payment_status: paymentStatus, paid_at: paidAt }),
      order_number: order.order_number,
      payment_status: paymentStatus,
      paid_at: paidAt
    });
  }
  return jsonResponse({ error: "Unsupported payment action." }, 404);
}

async function handlePaystackWebhook(request, env) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
  if (!env.DB || !env.PAYSTACK_SECRET_KEY) return jsonResponse({ error: "Paystack webhook is not configured." }, 503);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 65_536) {
    return jsonResponse({ error: "Webhook request exceeds the 64 KB limit." }, 413);
  }
  const signature = request.headers.get("x-paystack-signature") || "";
  if (!/^[a-f0-9]{128}$/i.test(signature)) return jsonResponse({ error: "Invalid Paystack signature." }, 401);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.PAYSTACK_SECRET_KEY), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (!constantTimeEqual(signature.toLowerCase(), expected)) {
    return jsonResponse({ error: "Invalid Paystack signature." }, 401);
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Webhook body must be valid JSON." }, 400);
  }
  if (event?.event !== "charge.success") return jsonResponse({ ok: true, ignored: true });
  const reference = typeof event.data?.reference === "string" ? event.data.reference : "";
  if (!/^ESHOP_[A-F0-9]{32}$/.test(reference)) return jsonResponse({ error: "Invalid payment reference." }, 400);
  const order = await env.DB.prepare(
    "SELECT * FROM storefront_orders WHERE payment_reference=?"
  ).bind(reference).first();
  if (!order) return jsonResponse({ error: "Payment reference not found." }, 404);
  if (!transactionMatchesOrder(event.data, order) || event.data.status !== "success") {
    return jsonResponse({ error: "Payment does not match the expected order amount and currency." }, 409);
  }
  if (order.payment_status !== "paid") {
    await updateOrderPayment(env, order, "paid", new Date().toISOString());
  }
  return jsonResponse({ ok: true, payment_status: "paid", order_number: order.order_number });
}

async function handleInventory(request, env, tenantId, action) {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, POST, OPTIONS" });
  }
  const tenant = action === "sale" && request.method === "POST"
    ? (tenantId === "main" ? { id: "main" } : await env.TENANTS.get(`tenant:${tenantId}`, "json"))
    : await requireTenant(request, env, tenantId);
  if (!tenant) return jsonResponse({ error: "Shop not found." }, 404);

  if (action === "connect") {
    const isOwner = tenantId === "main"
      ? await authorizeMainOwner(request, env)
      : await authorizeTenantOwner(request, env, tenantId);
    if (!isOwner && !await authorizeAdmin(request, env)) {
      return jsonResponse({ error: "Shop owner authorization required." }, 401);
    }
    if (request.method !== "POST") {
      const rows = await env.DB.prepare(
        "SELECT sku, stock, updated_at FROM inventory_stock WHERE tenant_id = ? ORDER BY sku"
      ).bind(tenantId).all();
      return jsonResponse({ items: rows.results || [] });
    }
    let input;
    try {
      input = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    if (!input || !["initialize", "replace"].includes(input.mode) ||
        !Array.isArray(input.items) || input.items.length < 1 || input.items.length > MAX_RECORDS) {
      return jsonResponse({ error: "Choose an initial stock source and provide 1â€“1000 products." }, 400);
    }
    const normalized = [];
    const seen = new Set();
    for (const item of input.items) {
      const sku = typeof item?.sku === "string" ? item.sku.trim() : "";
      const stock = Number(item?.stock);
      if (!sku || sku.length > 120 || !Number.isSafeInteger(stock) || stock < 0 || seen.has(sku)) {
        return jsonResponse({ error: "Each product needs a unique SKU and a whole-number stock quantity." }, 400);
      }
      seen.add(sku);
      normalized.push({ sku, stock });
    }
    const snapshot = await env.DB.prepare(
      "SELECT payload FROM catalog_snapshots WHERE tenant_id = ?"
    ).bind(tenantId).first();
    if (!snapshot) return jsonResponse({ error: "Publish the website catalog before connecting inventory." }, 409);
    const catalog = JSON.parse(snapshot.payload);
    const catalogSkus = new Set((catalog.products || []).map(product => product.sku).filter(Boolean));
    const unmatched = normalized.filter(item => !catalogSkus.has(item.sku));
    if (unmatched.length) {
      return jsonResponse({
        error: `These POS SKUs are not in the website catalog: ${unmatched.map(item => item.sku).join(", ")}.`
      }, 409);
    }
    const updatedAt = new Date().toISOString();
    const statements = normalized.map(item => input.mode === "replace"
      ? env.DB.prepare(
        `INSERT INTO inventory_stock (tenant_id, sku, stock, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(tenant_id, sku) DO UPDATE SET stock = excluded.stock, updated_at = excluded.updated_at`
      ).bind(tenantId, item.sku, item.stock, updatedAt)
      : env.DB.prepare(
        "INSERT OR IGNORE INTO inventory_stock (tenant_id, sku, stock, updated_at) VALUES (?, ?, ?, ?)"
      ).bind(tenantId, item.sku, item.stock, updatedAt));
    await env.DB.batch(statements);
    return jsonResponse({ ok: true, mode: input.mode, item_count: normalized.length });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
  }
  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const eventId = typeof input?.event_id === "string" ? input.event_id.trim() : "";
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(eventId) ||
      !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) {
    return jsonResponse({ error: "A valid event ID and 1â€“100 sale items are required." }, 400);
  }
  const quantities = new Map();
  for (const item of input.items) {
    const sku = typeof item?.sku === "string" ? item.sku.trim() : "";
    const quantity = Number(item?.quantity);
    if (!sku || sku.length > 120 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999) {
      return jsonResponse({ error: "Each sale item needs a SKU and a positive whole-number quantity." }, 400);
    }
    quantities.set(sku, (quantities.get(sku) || 0) + quantity);
  }
  const existing = await env.DB.prepare(
    "SELECT event_id FROM inventory_events WHERE tenant_id = ? AND event_id = ?"
  ).bind(tenantId, eventId).first();
  if (existing) return jsonResponse({ ok: true, duplicate: true });

  const createdAt = new Date().toISOString();
  const statements = [
    env.DB.prepare("INSERT INTO inventory_events (tenant_id, event_id, created_at) VALUES (?, ?, ?)")
      .bind(tenantId, eventId, createdAt),
    ...[...quantities].map(([sku, quantity]) =>
      env.DB.prepare(
        "INSERT INTO inventory_event_items (tenant_id, event_id, sku, quantity) VALUES (?, ?, ?, ?)"
      ).bind(tenantId, eventId, sku, quantity))
  ];
  try {
    await env.DB.batch(statements);
  } catch (error) {
    const duplicate = await env.DB.prepare(
      "SELECT event_id FROM inventory_events WHERE tenant_id = ? AND event_id = ?"
    ).bind(tenantId, eventId).first();
    if (duplicate) return jsonResponse({ ok: true, duplicate: true });
    if (String(error?.message || "").includes("insufficient_stock")) {
      return jsonResponse({ error: "Not enough shared stock to complete this sale." }, 409);
    }
    throw error;
  }
  return jsonResponse({ ok: true, duplicate: false });
}

async function handleTenants(request, env) {
  if (!env.TENANTS) return jsonResponse({ error: "Tenant storage is not configured." }, 503);
  if (request.method === "GET") {
    if (!await authorizeAdmin(request, env)) {
      return jsonResponse({ error: "Tenant administrator authorization required." }, 401);
    }

    const tenants = [{ id: "main", name: "E-Shop", hostname: DOMAIN_ROOT }];
    let cursor;
    do {
      const page = await env.TENANTS.list({ prefix: "tenant:", limit: 1000, cursor });
      for (const key of page.keys) {
        const tenant = await env.TENANTS.get(key.name, "json");
        if (tenant && TENANT_ID_PATTERN.test(tenant.id) && !RESERVED_TENANT_IDS.has(tenant.id)) {
          tenants.push({
            id: tenant.id,
            name: cleanText(tenant.name, 120),
            hostname: `${tenant.id}.${DOMAIN_ROOT}`
          });
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    tenants.sort((a, b) => a.id === "main" ? -1 : b.id === "main" ? 1 : a.id.localeCompare(b.id));
    return jsonResponse({ tenants });
  }
  if (request.method !== "PUT") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, PUT, OPTIONS" });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const id = typeof input.id === "string" ? input.id.trim().toLowerCase() : "";
  const name = cleanText(input.name, 120).trim();
  if (!TENANT_ID_PATTERN.test(id) || RESERVED_TENANT_IDS.has(id)) {
    return jsonResponse({ error: "Choose an available shop address using lowercase letters, numbers, and hyphens." }, 400);
  }
  if (!name) return jsonResponse({ error: "Enter a name for the shop." }, 400);
  const account = await accountSession(request, env);
  if (!account) return jsonResponse({ error: "Sign in to an account to create a shop." }, 401);
  if (await env.TENANTS.get(`tenant:${id}`)) {
    return jsonResponse({ error: "That shop address is already in use." }, 409);
  }
  if (!await limitAuthRequests(request, env, "shop-create", 5, 3600)) {
    return jsonResponse({ error: "Shop creation limit reached. Try again in an hour." }, 429);
  }
  const ownerToken = generateTenantSecret();
  const ownerTokenHash = await sha256Hex(ownerToken);
  const tenant = {
    id,
    name,
    owner_username: account.username,
    created_at: new Date().toISOString(),
    owner_token_hash: ownerTokenHash,
    owner_token_hashes: [ownerTokenHash]
  };
  const emptyCatalog = JSON.stringify({ products: [], categories: [], store: { name } });
  await env.DB.prepare(
    `INSERT INTO catalog_snapshots (tenant_id, payload, admin_payload, updated_at)
     VALUES (?, ?, ?, ?)`
  ).bind(id, emptyCatalog, emptyCatalog, tenant.created_at).run();
  try {
    await env.TENANTS.put(`tenant:${id}`, JSON.stringify(tenant));
    const association = await env.DB.prepare(
      "INSERT OR IGNORE INTO account_tenants (username, tenant_id) VALUES (?, ?)"
    ).bind(account.username, id).run();
    if (!association.meta?.changes) throw new Error("Could not associate this shop with the signed-in account.");
  } catch (error) {
    await env.TENANTS.delete(`tenant:${id}`);
    await env.DB.prepare("DELETE FROM catalog_snapshots WHERE tenant_id = ?").bind(id).run();
    throw error;
  }
  return jsonResponse({
    ok: true,
    tenant: { id, name, created_at: tenant.created_at, hostname: `${id}.${DOMAIN_ROOT}` },
    owner_token: ownerToken,
    warning: "Save this shop key in the Studio SQLite database. It cannot be recovered."
  }, 201);
}

async function handleBusinessSync(request, env, tenantId, action) {
  const isOwner = tenantId === "main"
    ? await authorizeMainOwner(request, env)
    : await authorizeTenantOwner(request, env, tenantId);
  if (!isOwner && !await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "Shop owner authorization required." }, 401);
  }
  if (action === "branches" && request.method === "GET") {
    if (!env.DB || !env.BUSINESS_ARCHIVE) {
      return jsonResponse({ error: "Business sync storage is not configured." }, 503);
    }
    const result = await env.DB.prepare(
      "SELECT store_id, store_name, snapshot_id, r2_key, updated_at FROM business_branches WHERE tenant_id = ? ORDER BY store_name"
    ).bind(tenantId).all();
    const branches = [];
    for (const branch of result.results || []) {
      const object = await env.BUSINESS_ARCHIVE.get(branch.r2_key);
      if (!object) return jsonResponse({ error: "A branch archive is missing from R2; no partial report was returned." }, 502);
      branches.push({ ...branch, snapshot: await object.json() });
    }
    return jsonResponse({ branches });
  }
  if (action !== "sync" || request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, {
      Allow: action === "branches" ? "GET, OPTIONS" : "POST, OPTIONS"
    });
  }
  if (!env.DB || !env.BUSINESS_ARCHIVE) {
    return jsonResponse({ error: "Business sync storage is not configured." }, 503);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BUSINESS_SNAPSHOT_BYTES) {
    return jsonResponse({ error: "Business snapshot exceeds the 8 MB limit." }, 413);
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const storeId = typeof input?.store_id === "string" ? input.store_id.trim() : "";
  const storeName = cleanText(input?.store_name, 120).trim();
  const snapshot = input?.snapshot;
  if (!BUSINESS_STORE_ID_PATTERN.test(storeId) || !storeName || !snapshot ||
      typeof snapshot !== "object" || Array.isArray(snapshot) ||
      !Array.isArray(snapshot.sales) || !Array.isArray(snapshot.expenses) ||
      !Array.isArray(snapshot.products) || !Array.isArray(snapshot.visits) ||
      !Array.isArray(snapshot.events) || !Array.isArray(snapshot.newsletter) ||
      !Array.isArray(snapshot.points) || !Array.isArray(snapshot.bookings) ||
      !Array.isArray(snapshot.instances) || !Array.isArray(snapshot.categories) ||
      !snapshot.settings || typeof snapshot.settings !== "object") {
    return jsonResponse({ error: "The register snapshot is missing one or more required business data collections." }, 400);
  }
  const canonicalSnapshot = JSON.stringify(snapshot);
  if (new TextEncoder().encode(canonicalSnapshot).byteLength > MAX_BUSINESS_SNAPSHOT_BYTES) {
    return jsonResponse({ error: "Business snapshot exceeds the 8 MB limit." }, 413);
  }
  const snapshotId = await sha256Hex(canonicalSnapshot);
  const key = `business/${tenantId}/${storeId}/${snapshotId}.json`;
  const updatedAt = new Date().toISOString();
  await env.BUSINESS_ARCHIVE.put(key, canonicalSnapshot, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { tenantId, storeId, snapshotId, updatedAt }
  });
  await env.DB.prepare(
    `INSERT INTO business_branches (tenant_id, store_id, store_name, snapshot_id, r2_key, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, store_id) DO UPDATE SET
       store_name = excluded.store_name, snapshot_id = excluded.snapshot_id,
       r2_key = excluded.r2_key, updated_at = excluded.updated_at`
  ).bind(tenantId, storeId, storeName, snapshotId, key, updatedAt).run();
  return jsonResponse({ ok: true, store_id: storeId, snapshot_id: snapshotId, updated_at: updatedAt });
}

async function handleNearbyPairing(request, env, tenantId) {
  const isOwner = tenantId === "main"
    ? await authorizeMainOwner(request, env)
    : await authorizeTenantOwner(request, env, tenantId);
  const isAccountOwner = isOwner ? false : await authorizeTenantAccount(request, env, tenantId);
  if (!isOwner && !isAccountOwner && !await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "Shop owner authorization required." }, 401);
  }
  if (!env.DB) return jsonResponse({ error: "Nearby pairing is not configured." }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (request.method === "POST") {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 128_000) {
      return jsonResponse({ error: "Nearby pairing request exceeds the 128 KB limit." }, 413);
    }
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    if (input?.action === "create") {
      if (!input.offer || input.offer.type !== "offer" || typeof input.offer.sdp !== "string"
        || input.offer.sdp.length > 100_000) {
        return jsonResponse({ error: "A valid nearby connection offer is required." }, 400);
      }
      const pairingId = crypto.randomUUID().replace(/-/g, "");
      const hostToken = generateTenantSecret();
      const guestToken = generateTenantSecret();
      const createdAt = Date.now();
      const expiresAt = createdAt + NEARBY_PAIRING_TTL_SECONDS * 1000;
      await env.DB.prepare(
        "DELETE FROM nearby_pairings WHERE expires_at <= ?"
      ).bind(createdAt).run();
      await env.DB.prepare(
        "INSERT INTO nearby_pairings (id,tenant_id,host_token_hash,guest_token_hash,offer_sdp,answer_sdp,created_at,expires_at) VALUES (?,?,?,?,?,NULL,?,?)"
      ).bind(pairingId, tenantId, await sha256Hex(hostToken), await sha256Hex(guestToken), input.offer.sdp, createdAt, expiresAt).run();
      return jsonResponse({ pairing_id: pairingId, host_token: hostToken, guest_token: guestToken, expires_at: expiresAt }, 201);
    }
    if (input?.action === "answer") {
      if (!/^[a-f0-9]{32}$/.test(id) || !input.answer || input.answer.type !== "answer"
        || typeof input.answer.sdp !== "string" || input.answer.sdp.length > 100_000) {
        return jsonResponse({ error: "A valid nearby connection answer is required." }, 400);
      }
      const pairing = await env.DB.prepare(
        "SELECT tenant_id,guest_token_hash,answer_sdp,expires_at FROM nearby_pairings WHERE id=?"
      ).bind(id).first();
      const suppliedToken = request.headers.get("X-Nearby-Session") || "";
      if (!pairing || pairing.tenant_id !== tenantId || pairing.expires_at <= Date.now()
        || !constantTimeEqual(await sha256Hex(suppliedToken), pairing.guest_token_hash)) {
        return jsonResponse({ error: "This pairing code has expired or is invalid. Create a new QR and try again." }, 404);
      }
      if (pairing.answer_sdp) return jsonResponse({ error: "A register has already answered this pairing code." }, 409);
      const updated = await env.DB.prepare(
        "UPDATE nearby_pairings SET answer_sdp=? WHERE id=? AND answer_sdp IS NULL AND expires_at>?"
      ).bind(input.answer.sdp, id, Date.now()).run();
      if (!updated.meta?.changes) return jsonResponse({ error: "This pairing code was already used or expired." }, 409);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: "Unsupported nearby pairing action." }, 400);
  }

  if (!/^[a-f0-9]{32}$/.test(id)) return jsonResponse({ error: "A valid pairing ID is required." }, 400);
  const suppliedToken = request.headers.get("X-Nearby-Session") || "";
  if (request.method === "GET") {
    const pairing = await env.DB.prepare(
      "SELECT tenant_id,host_token_hash,guest_token_hash,offer_sdp,answer_sdp,expires_at FROM nearby_pairings WHERE id=?"
    ).bind(id).first();
    const suppliedHash = await sha256Hex(suppliedToken);
    if (!pairing || pairing.tenant_id !== tenantId || pairing.expires_at <= Date.now()) {
      return jsonResponse({ error: "This pairing request has expired. Create a new QR and try again." }, 404);
    }
    if (constantTimeEqual(suppliedHash, pairing.guest_token_hash)) {
      return jsonResponse({ offer: pairing.offer_sdp ? { type: "offer", sdp: pairing.offer_sdp } : null });
    }
    if (!constantTimeEqual(suppliedHash, pairing.host_token_hash)) {
      return jsonResponse({ error: "This pairing request has expired. Create a new QR and try again." }, 404);
    }
    return jsonResponse({ answer: pairing.answer_sdp ? { type: "answer", sdp: pairing.answer_sdp } : null });
  }
  if (request.method === "DELETE") {
    const pairing = await env.DB.prepare(
      "SELECT tenant_id,host_token_hash FROM nearby_pairings WHERE id=?"
    ).bind(id).first();
    if (!pairing || pairing.tenant_id !== tenantId
      || !constantTimeEqual(await sha256Hex(suppliedToken), pairing.host_token_hash)) {
      return jsonResponse({ error: "This pairing request is invalid." }, 404);
    }
    await env.DB.prepare("DELETE FROM nearby_pairings WHERE id=?").bind(id).run();
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, POST, DELETE, OPTIONS" });
}

async function handlePosSync(request, env, tenantId) {
  const isOwner = tenantId === "main"
    ? await authorizeMainOwner(request, env)
    : await authorizeTenantOwner(request, env, tenantId);
  const isAccountOwner = isOwner ? false : await authorizeTenantAccount(request, env, tenantId);
  if (!isOwner && !isAccountOwner && !await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "Shop owner authorization required." }, 401);
  }
  if (!env.DB) return jsonResponse({ error: "POS sync storage is not configured." }, 503);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const after = Number(url.searchParams.get("after") || 0);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit)) {
      return jsonResponse({ error: "Invalid POS sync cursor or limit." }, 400);
    }
    const [changes, latest] = await Promise.all([
      env.DB.prepare(
        "SELECT revision, change_id, device_id, entity, record_id, payload, deleted, changed_at FROM pos_sync_changes WHERE tenant_id = ? AND revision > ? ORDER BY revision LIMIT ?"
      ).bind(tenantId, after, limit).all(),
      env.DB.prepare("SELECT COALESCE(MAX(revision), 0) AS revision FROM pos_sync_changes WHERE tenant_id = ?")
        .bind(tenantId).first()
    ]);
    return jsonResponse({
      changes: (changes.results || []).map(change => ({
        revision: Number(change.revision),
        change_id: change.change_id,
        device_id: change.device_id,
        entity: change.entity,
        record_id: change.record_id,
        payload: JSON.parse(change.payload),
        deleted: change.deleted === 1,
        changed_at: change.changed_at
      })),
      latest_revision: Number(latest?.revision || 0)
    });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, POST, OPTIONS" });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_POS_SYNC_BODY_BYTES) {
    return jsonResponse({ error: "POS sync request exceeds the 1 MB limit." }, 413);
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (!Array.isArray(input?.changes) || input.changes.length > MAX_POS_SYNC_CHANGES) {
    return jsonResponse({ error: `Send no more than ${MAX_POS_SYNC_CHANGES} POS changes at a time.` }, 400);
  }
  const statements = [];
  for (const change of input.changes) {
    const changeId = typeof change?.change_id === "string" ? change.change_id : "";
    const deviceId = typeof change?.device_id === "string" ? change.device_id : "";
    const entity = typeof change?.entity === "string" ? change.entity : "";
    const recordId = typeof change?.record_id === "string" ? change.record_id : "";
    const changedAt = typeof change?.changed_at === "string" ? change.changed_at : "";
    const deleted = change?.deleted === true;
    if (!/^[A-Za-z0-9_-]{8,120}$/.test(changeId)
      || !/^[A-Za-z0-9_-]{8,120}$/.test(deviceId)
      || !POS_SYNC_ENTITIES.has(entity)
      || !/^[A-Za-z0-9_-]{1,120}$/.test(recordId)
      || !Number.isFinite(Date.parse(changedAt))
      || !change?.payload || typeof change.payload !== "object" || Array.isArray(change.payload)) {
      return jsonResponse({ error: "A POS sync change has invalid identity, type, date, or payload." }, 400);
    }
    const payload = JSON.stringify(change.payload);
    if (new TextEncoder().encode(payload).byteLength > 200_000) {
      return jsonResponse({ error: "A POS sync record exceeds the 200 KB limit." }, 413);
    }
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO pos_sync_changes
       (tenant_id, change_id, device_id, entity, record_id, payload, deleted, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(tenantId, changeId, deviceId, entity, recordId, payload, deleted ? 1 : 0, new Date(changedAt).toISOString()));
  }
  if (statements.length) await env.DB.batch(statements);
  const latest = await env.DB.prepare(
    "SELECT COALESCE(MAX(revision), 0) AS revision FROM pos_sync_changes WHERE tenant_id = ?"
  ).bind(tenantId).first();
  return jsonResponse({ ok: true, accepted: statements.length, latest_revision: Number(latest?.revision || 0) });
}

async function handleAnalyticsVisit(request, env, tenantId) {
  if (!env.DB) return jsonResponse({ error: "Storefront analytics storage is not configured." }, 503);
  if (tenantId !== "main" && !await env.TENANTS.get(`tenant:${tenantId}`, "json")) {
    return jsonResponse({ error: "Shop not found." }, 404);
  }
  if (request.method === "POST") {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) return jsonResponse({ error: "Visit payload is too large." }, 413);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    const visitorId = typeof input?.visitor_id === "string" ? input.visitor_id.trim().slice(0, 100) : "";
    const rawPath = typeof input?.path === "string" ? input.path.trim().slice(0, 500) : "";
    if (!visitorId || !/^\/(?!\/)/.test(rawPath) || /[\u0000-\u001f]/.test(rawPath)) {
      return jsonResponse({ error: "Visit needs an anonymous visitor ID and a same-site path." }, 400);
    }
    const path = rawPath.split(/[?#]/, 1)[0].slice(0, 180) || "/";
    let referrer = "";
    try {
      const parsed = new URL(typeof input.referrer === "string" ? input.referrer : "");
      if (parsed.protocol === "https:" || parsed.protocol === "http:") referrer = parsed.origin.slice(0, 240);
    } catch {
      referrer = "";
    }
    const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
    const device = /tablet|ipad/.test(userAgent) ? "tablet"
      : /mobile|android|iphone/.test(userAgent) ? "mobile" : userAgent ? "desktop" : "unknown";
    const cf = request.cf || {};
    const country = cleanText(cf.country, 2).toUpperCase();
    const region = cleanText(cf.regionCode || cf.region, 8);
    const visitorHash = await sha256Hex(`${tenantId}:${visitorId}`);
    await env.DB.prepare(
      "INSERT INTO storefront_visits (id, tenant_id, visitor_hash, path, referrer, device, country, region, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), tenantId, visitorHash, path, referrer, device, country, region, new Date().toISOString()).run();
    return jsonResponse({ ok: true }, 202);
  }
  if (request.method === "GET") {
    const isOwner = tenantId === "main"
      ? await authorizeMainOwner(request, env)
      : await authorizeTenantOwner(request, env, tenantId);
    if (!isOwner && !await authorizeAdmin(request, env)) {
      return jsonResponse({ error: "Shop owner authorization required." }, 401);
    }
    const days = Number(new URL(request.url).searchParams.get("days") || 30);
    if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
      return jsonResponse({ error: "Days must be from 1 to 365." }, 400);
    }
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const [totals, byCountry, byRegion, byDevice, topPages] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_hash) AS unique_visitors FROM storefront_visits WHERE tenant_id = ? AND created_at >= ?")
        .bind(tenantId, since).first(),
      env.DB.prepare("SELECT country, COUNT(*) AS visits FROM storefront_visits WHERE tenant_id = ? AND created_at >= ? AND country != '' GROUP BY country ORDER BY visits DESC LIMIT 20")
        .bind(tenantId, since).all(),
      env.DB.prepare("SELECT country, region, COUNT(*) AS visits FROM storefront_visits WHERE tenant_id = ? AND created_at >= ? AND region != '' GROUP BY country, region ORDER BY visits DESC LIMIT 30")
        .bind(tenantId, since).all(),
      env.DB.prepare("SELECT device, COUNT(*) AS visits FROM storefront_visits WHERE tenant_id = ? AND created_at >= ? GROUP BY device ORDER BY visits DESC")
        .bind(tenantId, since).all(),
      env.DB.prepare("SELECT path, COUNT(*) AS visits FROM storefront_visits WHERE tenant_id = ? AND created_at >= ? GROUP BY path ORDER BY visits DESC LIMIT 20")
        .bind(tenantId, since).all()
    ]);
    return jsonResponse({
      days,
      visits: Number(totals?.visits || 0),
      unique_visitors: Number(totals?.unique_visitors || 0),
      countries: byCountry.results || [],
      regions: byRegion.results || [],
      devices: byDevice.results || [],
      pages: topPages.results || [],
      location_note: "Country and region are derived from Cloudflare request metadata. Visitor IP addresses are not stored."
    });
  }
  return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, POST, OPTIONS" });
}

async function handlePush(request, env, tenantId, action) {
  if (action === "config" && request.method === "GET") {
    if (!env.VAPID_PUBLIC_KEY) return jsonResponse({ error: "Push notifications are not configured on this Worker." }, 503);
    return jsonResponse({ public_key: env.VAPID_PUBLIC_KEY });
  }
  if (action === "subscriptions") {
    if (request.method !== "POST" && request.method !== "DELETE") {
      return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST, DELETE, OPTIONS" });
    }
    if (!env.DB || !env.TENANTS) return jsonResponse({ error: "Push subscription storage is not configured." }, 503);
    const tenant = tenantId === "main"
      ? { id: "main" }
      : await env.TENANTS.get(`tenant:${tenantId}`, "json");
    if (!tenant) return jsonResponse({ error: "Shop not found." }, 404);
    if (!await limitAuthRequests(request, env, "push-subscribe", 30, 3600)) {
      return jsonResponse({ error: "Too many subscription changes. Try again later." }, 429);
    }
    let input;
    try {
      input = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    const endpoint = typeof input?.endpoint === "string" ? input.endpoint.trim() : "";
    if (endpoint.length > 2048) return jsonResponse({ error: "Invalid push subscription endpoint." }, 400);
    const endpointHash = await sha256Hex(endpoint);
    if (request.method === "DELETE") {
      await env.DB.prepare(
        "DELETE FROM push_subscriptions WHERE tenant_id = ? AND endpoint_hash = ?"
      ).bind(tenantId, endpointHash).run();
      return jsonResponse({ ok: true });
    }
    const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh : "";
    const auth = typeof input?.keys?.auth === "string" ? input.keys.auth : "";
    try {
      const url = new URL(endpoint);
      const allowedHosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com",
        "push.services.mozilla.com", "web.push.apple.com", "wns.windows.com"];
      if (url.protocol !== "https:" ||
          !allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
          decodeBase64Url(p256dh).length !== 65 || decodeBase64Url(auth).length < 16) {
        return jsonResponse({ error: "This browser's push subscription is invalid or unsupported." }, 400);
      }
    } catch {
      return jsonResponse({ error: "This browser's push subscription is invalid or unsupported." }, 400);
    }
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (tenant_id, endpoint_hash, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, endpoint_hash) DO UPDATE SET
         endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth`
    ).bind(tenantId, endpointHash, endpoint, p256dh, auth, createdAt).run();
    return jsonResponse({ ok: true });
  }
  if (action !== "broadcast" || request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
  }
  const isOwner = tenantId === "main"
    ? await authorizeMainOwner(request, env)
    : await authorizeTenantOwner(request, env, tenantId);
  if (!isOwner && !await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "Shop owner authorization required." }, 401);
  }
  if (!await limitAuthRequests(request, env, `push-broadcast:${tenantId}`, 5, 3600)) {
    return jsonResponse({ error: "Push broadcast limit reached. Try again in an hour." }, 429);
  }
  if (!env.DB || !env.BUSINESS_ARCHIVE) return jsonResponse({ error: "Push delivery or R2 archive is not configured." }, 503);
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !/^mailto:.+@.+$/.test(env.VAPID_SUBJECT || "")) {
    return jsonResponse({ error: "Set the VAPID public key, private secret, and mailto subject before sending." }, 503);
  }
  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const title = cleanText(input?.title, 80).trim();
  const body = cleanText(input?.body, 240).trim();
  const target = typeof input?.url === "string" ? input.url.trim().slice(0, 300) : "/";
  if (!title || !body || !target.startsWith("/") || target.startsWith("//") ||
      target.startsWith("/\\") || /[\u0000-\u001f\\]/.test(target)) {
    return jsonResponse({ error: "Enter a title, message, and a same-site path for the notification." }, 400);
  }
  const result = await env.DB.prepare(
    "SELECT endpoint_hash, endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = ? LIMIT 500"
  ).bind(tenantId).all();
  const subscriptions = result.results || [];
  let accepted = 0;
  let expired = 0;
  let failed = 0;
  const attempts = await Promise.all(subscriptions.map(async subscription => {
    try {
      const response = await createWebPushRequest(subscription, { title, body, url: target }, env);
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare(
          "DELETE FROM push_subscriptions WHERE tenant_id = ? AND endpoint_hash = ?"
        ).bind(tenantId, subscription.endpoint_hash).run();
        return "expired";
      }
      if (!response.ok) return "failed";
      return "delivered";
    } catch (error) {
      console.error("Web Push delivery failed.", error);
      return "failed";
    }
  }));
  for (const outcome of attempts) {
    if (outcome === "delivered") accepted++;
    else if (outcome === "expired") expired++;
    else failed++;
  }
  const sentAt = new Date().toISOString();
  const archiveKey = `push/${tenantId}/${Date.now()}-${crypto.randomUUID()}.json`;
  await env.BUSINESS_ARCHIVE.put(archiveKey, JSON.stringify({
    title, body, url: target, sent_at: sentAt, attempted: subscriptions.length,
    accepted, expired, failed
  }), { httpMetadata: { contentType: "application/json" } });
  return jsonResponse({
    ok: true, attempted: subscriptions.length, accepted, expired, failed,
    sent_at: sentAt, archive_key: archiveKey
  });
}

async function deleteTenant(request, env, tenantId) {
  if (!env.TENANTS || !env.DB) return jsonResponse({ error: "Tenant storage is not configured." }, 503);
  if (!TENANT_ID_PATTERN.test(tenantId) || RESERVED_TENANT_IDS.has(tenantId)) {
    return jsonResponse({ error: "The main shop or an invalid shop address cannot be deleted here." }, 400);
  }
  const tenantKey = `tenant:${tenantId}`;
  const tenant = await env.TENANTS.get(tenantKey, "json");
  if (!tenant) return jsonResponse({ error: "Shop not found." }, 404);
  if (!await authorizeTenantOwner(request, env, tenantId) && !await authorizeAdmin(request, env)) {
    return jsonResponse({ error: "Shop owner authorization required to delete this website." }, 401);
  }
  await env.DB.prepare("DELETE FROM catalog_snapshots WHERE tenant_id = ?").bind(tenantId).run();
  await env.DB.prepare("DELETE FROM account_tenants WHERE tenant_id = ?").bind(tenantId).run();
  await env.TENANTS.delete(tenantKey);
  return jsonResponse({ ok: true, deleted_tenant_id: tenantId });
}

function addCloudflareMode(html) {
  return html.replace(
    '<div id="app"></div>',
    '<div id="app"></div><script>window.__ESHOP_CLOUDFLARE_STOREFRONT__ = true;</script>'
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
      try {
        const authMatch = url.pathname.match(/^\/api\/auth\/(config|session|register|login)$/);
        if (authMatch) return await handleAccountAuth(request, env, authMatch[1]);
        if (url.pathname === "/api/auth/logout" && request.method === "POST") {
          const authorization = request.headers.get("Authorization") || "";
          const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
          if (token && env.TENANTS) await env.TENANTS.delete(`session:${await sha256Hex(token)}`);
          return jsonResponse({ ok: true });
        }
        if (url.pathname === "/api/catalog") {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handleCatalog(request, env, tenantId);
        }
        if (url.pathname === "/api/orders") {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handleStorefrontOrders(request, env, tenantId);
        }
        if (url.pathname === "/api/payments/paystack/webhook") {
          return await handlePaystackWebhook(request, env);
        }
        const paystackMatch = url.pathname.match(/^\/api\/payments\/paystack\/(banks|subaccount|initialize|verify)$/);
        if (paystackMatch) {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return ["banks", "subaccount"].includes(paystackMatch[1])
            ? await handlePaystackSetup(request, env, tenantId, paystackMatch[1])
            : await handlePaystackPayment(request, env, tenantId, paystackMatch[1]);
        }
        const businessSyncMatch = url.pathname.match(/^\/api\/business\/(sync|branches)$/);
        if (businessSyncMatch) {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handleBusinessSync(
            request,
            env,
            tenantId,
            businessSyncMatch[1]
          );
        }
        if (url.pathname === "/api/business/records") {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handlePosSync(request, env, tenantId);
        }
        if (url.pathname === "/api/nearby/pairing") {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handleNearbyPairing(request, env, tenantId);
        }
        if (url.pathname === "/api/analytics/visit") {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handleAnalyticsVisit(request, env, tenantId);
        }
        const pushMatch = url.pathname.match(/^\/api\/push\/(config|subscriptions|broadcast)$/);
        if (pushMatch) {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handlePush(request, env, tenantId, pushMatch[1]);
        }
        const inventoryMatch = url.pathname.match(/^\/api\/inventory\/(connect|sale)$/);
        if (inventoryMatch) {
          const tenantId = tenantIdFromRequest(request, env);
          if (!tenantId) return jsonResponse({ error: "Invalid shop hostname." }, 400);
          return await handleInventory(request, env, tenantId, inventoryMatch[1]);
        }
        if (url.pathname === "/api/tenants") {
          if (request.method === "PUT" || request.method === "GET") return await handleTenants(request, env);
          return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET, PUT, OPTIONS" });
        }
        const tenantDeleteMatch = url.pathname.match(/^\/api\/tenants\/([a-z0-9-]+)$/);
        if (tenantDeleteMatch && request.method === "DELETE") {
          return await deleteTenant(request, env, tenantDeleteMatch[1]);
        }
        if (url.pathname === "/api/tenants/main/owner-key" && request.method === "PUT") {
          return await provisionMainOwnerKey(request, env);
        }
        const ownerKeyMatch = url.pathname.match(/^\/api\/tenants\/([a-z0-9-]+)\/owner-key$/);
        if (ownerKeyMatch && request.method === "PUT") {
          return await provisionTenantOwnerKey(request, env, ownerKeyMatch[1]);
        }
        return jsonResponse({ error: "Not found." }, 404);
      } catch (error) {
        console.error("Cloudflare tenant or catalog request failed.", error);
        return jsonResponse({ error: "Shop service unavailable." }, 500);
      }
    }

    const hostTenantId = tenantIdFromRequest(request, env);
    if (hostTenantId !== "main" && !await requireTenant(request, env, hostTenantId)) {
      return new Response("Shop not found.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    const isStorefrontPath = ["/", "/builder-storefront.html", "/builder-storefront"].includes(url.pathname);
    const isBrowserRegisterPath = url.pathname === "/register" || url.pathname === "/register/";
    const assetPath = isStorefrontPath ? "/builder-storefront"
      : isBrowserRegisterPath ? "/register" : url.pathname;
    const assetUrl = new URL(assetPath + url.search, url.origin);
    const assetRequest = new Request(assetUrl, request);
    const response = await env.ASSETS.fetch(assetRequest);
    if (!isStorefrontPath) return response;
    const html = await response.text();
    if (!response.ok) {
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    return new Response(addCloudflareMode(html), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
};
