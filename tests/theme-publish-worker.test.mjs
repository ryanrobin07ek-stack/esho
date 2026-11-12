import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../cloudflare/worker.js";

const themeId = "cira-atelier-event-architecture-management";
const catalogUpdatedAt = "2026-10-15T07:00:00.000Z";
const publishedHtml = `<!doctype html><html><head><meta name="eshop-filled-theme" content="${themeId}"></head><body><h1>Owner Shop</h1><article>Owner Product One</article></body></html>`;

function createEnv(selectedThemeId = themeId) {
  const values = new Map();
  const objects = new Map();
  let catalogReads = 0;
  const catalog = {
    store: { website_theme_id: selectedThemeId },
    products: [{ id: 1, name: "Owner Product One" }],
    categories: [],
    pages: [{ slug: "about", title: "About", content: "About our shop." }]
  };
  return {
    values,
    objects,
    get catalogReads() { return catalogReads; },
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
          catalogReads += 1;
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
        const prefix = "/liquid-themes/my-own-theme/";
        const pathname = new URL(request.url).pathname;
        if (!pathname.startsWith(prefix)) {
          return new Response("<html>internal template</html>", {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
        try {
          const contents = await readFile(new URL(
            `../public/liquid-themes/my-own-theme/${pathname.slice(prefix.length)}`,
            import.meta.url
          ), "utf8");
          return new Response(contents);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          return new Response("Not found", { status: 404 });
        }
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
  const savedHtml = env.objects.get(pointer.key).body;
  assert.match(savedHtml, /id="eshop-published-catalog"/);
  assert.match(savedHtml, /window\.__ESHOP_THEME_CATALOG__/);
  assert.match(savedHtml, /Owner Product One/);
  assert.equal(env.catalogReads, 1);

  const storefront = await worker.fetch(new Request("https://eshop-storefront.workers.dev/"), env);
  assert.equal(storefront.status, 200);
  const html = await storefront.text();
  assert.equal(env.catalogReads, 1, "Serving an embedded catalog must not query D1.");
  assert.match(html, /Owner Product One/);
  assert.match(html, /eshop-filled-theme/);
  assert.match(html, /id="eshop-published-catalog"/);
  assert.match(html, /theme-catalog-adapter\.js\?v=commerce-3/);
  assert.match(html, /storefront-analytics\.js\?v=events-1/);
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

test("Worker accepts the Elora Liquid HTML storefront theme", async () => {
  for (const themeId of ["elora-linen"]) {
    const env = createEnv(themeId);
    const html = `<!doctype html><html><head><meta name="eshop-filled-theme" content="${themeId}"><meta name="eshop-liquid-theme" content="standalone"></head><body><script type="application/json" id="eshop-liquid-theme-catalog">{}</script><script src="/theme-packages/liquid-catalog-runtime.js" defer></script></body></html>`;
    const response = await worker.fetch(publishRequest({
      theme_id: themeId,
      catalog_updated_at: catalogUpdatedAt,
      html
    }), env);

    assert.equal(response.status, 200, `${themeId} should be publishable`);
    assert.equal((await response.json()).theme_id, themeId);
    const pointer = JSON.parse(env.values.get("published-theme:main"));
    assert.equal(pointer.themeId, themeId);
    assert.match(env.objects.get(pointer.key).body, /id="eshop-published-catalog"/);
  }
});

test("Worker accepts the Litrus Mixer storefront", async () => {
  const env = createEnv("litrus-mixer");
  const html = '<!doctype html><html><head><meta name="eshop-filled-theme" content="litrus-mixer"></head><body><h1>My Litrus shop</h1></body></html>';
  const response = await worker.fetch(publishRequest({
    theme_id: "litrus-mixer",
    catalog_updated_at: catalogUpdatedAt,
    html
  }), env);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).theme_id, "litrus-mixer");
  const pointer = JSON.parse(env.values.get("published-theme:main"));
  assert.equal(pointer.themeId, "litrus-mixer");
  assert.match(env.objects.get(pointer.key).body, /id="eshop-published-catalog"/);
  assert.match(env.objects.get(pointer.key).body, /My Litrus shop/);
});

test("storefront fails closed instead of serving an unpublished template", async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request("https://eshop-storefront.workers.dev/"), env);
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
