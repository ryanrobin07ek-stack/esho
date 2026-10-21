import assert from "node:assert/strict";
import test from "node:test";
import worker from "../cloudflare/worker.js";

const themeId = "cira-atelier-event-architecture-management";
const catalogUpdatedAt = "2026-10-15T07:00:00.000Z";
const publishedHtml = `<!doctype html><html><head><meta name="eshop-filled-theme" content="${themeId}"></head><body><h1>Owner Shop</h1><article>Owner Product One</article></body></html>`;

function createEnv(selectedThemeId = themeId) {
  const values = new Map();
  const objects = new Map();
  const catalog = {
    store: { website_theme_id: selectedThemeId },
    products: [{ id: 1, name: "Owner Product One" }],
    categories: []
  };
  return {
    values,
    objects,
    PUBLISH_TOKEN: "worker-test-token",
    TENANTS: {
      async get(key, type) {
        if (key === "tenant:main") return { id: "main", name: "Main shop" };
        const value = values.get(key);
        if (type === "json" && typeof value === "string") return JSON.parse(value);
        return value ?? null;
      },
      async put(key, value) { values.set(key, value); }
    },
    DB: {
      prepare(query) {
        assert.match(query, /SELECT payload, updated_at FROM catalog_snapshots/);
        return { bind() { return { async first() {
          return { payload: JSON.stringify(catalog), updated_at: catalogUpdatedAt };
        } }; } };
      }
    },
    BUSINESS_ARCHIVE: {
      async put(key, body, options) {
        objects.set(key, {
          body,
          httpMetadata: options.httpMetadata,
          customMetadata: options.customMetadata
        });
      },
      async get(key) { return objects.get(key) || null; }
    },
    ASSETS: {
      async fetch(request) {
        return new Response("<html>internal template</html>", {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }
  };
}

const publishRequest = (body, token = "worker-test-token") => new Request(
  "https://rrobin.co.ke/api/theme-publish?tenant=main",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }
);

test("Worker persists only a complete supported fill and serves that same published HTML", async () => {
  const env = createEnv();
  const response = await worker.fetch(publishRequest({
    theme_id: themeId,
    catalog_updated_at: catalogUpdatedAt,
    html: publishedHtml
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    theme_id: themeId,
    catalog_updated_at: catalogUpdatedAt
  });
  const pointer = JSON.parse(env.values.get("published-theme:main"));
  assert.equal(pointer.themeId, themeId);
  assert.equal(pointer.catalogUpdatedAt, catalogUpdatedAt);
  assert.match(pointer.key, /^published-sites\/main\/cira-atelier-event-architecture-management\//);
  assert.equal(env.objects.get(pointer.key).body, publishedHtml);

  const storefront = await worker.fetch(new Request("https://rrobin.co.ke/"), env);
  assert.equal(storefront.status, 200);
  const html = await storefront.text();
  assert.match(html, /Owner Product One/);
  assert.match(html, /eshop-filled-theme/);
  assert.doesNotMatch(html, /__ESHOP_THEME_CATALOG__|theme-catalog-adapter\.js/);
});

test("Worker rejects unsupported, incomplete, stale, and unauthenticated theme publishes", async () => {
  const env = createEnv();
  const unsupported = await worker.fetch(publishRequest({
    theme_id: "harvest-lane-market-fresh-groceries-delivered-or-ready-to-collec",
    catalog_updated_at: catalogUpdatedAt,
    html: publishedHtml
  }), env);
  assert.equal(unsupported.status, 422);

  const incomplete = await worker.fetch(publishRequest({
    theme_id: themeId,
    catalog_updated_at: catalogUpdatedAt,
    html: publishedHtml.replace("</body>", "<template data-repeat=\"products\"></template></body>")
  }), env);
  assert.equal(incomplete.status, 400);

  const stale = await worker.fetch(publishRequest({
    theme_id: themeId,
    catalog_updated_at: "2026-10-14T07:00:00.000Z",
    html: publishedHtml
  }), env);
  assert.equal(stale.status, 409);

  const unauthorized = await worker.fetch(publishRequest({
    theme_id: themeId,
    catalog_updated_at: catalogUpdatedAt,
    html: publishedHtml
  }, "wrong-token"), env);
  assert.equal(unauthorized.status, 401);
  assert.equal(env.objects.size, 0);
});

test("Worker accepts the Craft main storefront as a filled published theme", async () => {
  const craftThemeId = "craft-main-storefront";
  const env = createEnv(craftThemeId);
  const html = publishedHtml
    .replaceAll(themeId, craftThemeId)
    .replace("<h1>Owner Shop</h1>", "<h1>Craft storefront</h1>");
  const response = await worker.fetch(publishRequest({
    theme_id: craftThemeId,
    catalog_updated_at: catalogUpdatedAt,
    html
  }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.theme_id, craftThemeId);
  const pointer = JSON.parse(env.values.get("published-theme:main"));
  assert.match(pointer.key, /^published-sites\/main\/craft-main-storefront\//);
});

test("storefront fails closed instead of serving an unpublished template", async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request("https://rrobin.co.ke/"), env);
  assert.equal(response.status, 503);
  assert.match(await response.text(), /not been filled and published/);
});

test("skeleton templates are preview-fetch-only and raw theme HTML is not public", async () => {
  const env = createEnv();
  const direct = await worker.fetch(new Request(
    `https://rrobin.co.ke/theme-skeletons/${themeId}/index.html`
  ), env);
  assert.equal(direct.status, 404);

  const spoofedEditorFetch = await worker.fetch(new Request(
    `https://rrobin.co.ke/theme-skeletons/${themeId}/index.html`,
    { headers: { "X-Eshop-Theme-Internal": "preview" } }
  ), env);
  assert.equal(spoofedEditorFetch.status, 200);
  assert.match(spoofedEditorFetch.headers.get("Cache-Control"), /private, no-store/);

  const documentNavigation = await worker.fetch(new Request(
    `https://rrobin.co.ke/theme-skeletons/${themeId}/index.html`,
    {
      headers: {
        "Sec-Fetch-Dest": "document",
        "X-Eshop-Theme-Internal": "preview"
      }
    }
  ), env);
  assert.equal(documentNavigation.status, 404);

  const editorFetch = await worker.fetch(new Request(
    `https://rrobin.co.ke/theme-skeletons/${themeId}/index.html?tenant=main`,
    {
      headers: {
        Authorization: "Bearer worker-test-token",
        "X-Eshop-Theme-Internal": "preview"
      }
    }
  ), env);
  assert.equal(editorFetch.status, 200);
  assert.match(editorFetch.headers.get("Cache-Control"), /no-store/);

  env.objects.set(`themes/${themeId}/index.html`, {
    body: "<html>unfilled theme template</html>",
    httpMetadata: { contentType: "text/html; charset=utf-8" }
  });
  const rawTheme = await worker.fetch(new Request(
    `https://rrobin.co.ke/themes/${themeId}/index.html`
  ), env);
  assert.equal(rawTheme.status, 404);
});
