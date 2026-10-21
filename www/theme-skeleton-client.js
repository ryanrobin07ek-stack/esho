import { fillThemeSkeleton } from "./theme-skeleton-engine.js";

export const SUPPORTED_THEME_IDS = Object.freeze([
  "cira-atelier-event-architecture-management",
  "aura-luxe-fine-botanical-cosmetics-luxury-beauty",
  "kicks-vault-curated-sneaker-footwear-archive",
  "elura-botanicals-luxury-cosmetics-skincare",
  "autopro-kenya-premium-automotive-spares-parts",
  "etalon-premium-fashion-apparel",
  "aurex-electronics"
]);

export function isSupportedThemeId(themeId) {
  return SUPPORTED_THEME_IDS.includes(themeId);
}

function addThemeBase(html, themeId, baseHref) {
  const parsedBase = new URL(baseHref);
  if (parsedBase.protocol !== "https:" || parsedBase.pathname !== `/themes/${themeId}/index.html`) {
    throw new Error("The selected theme asset URL is invalid.");
  }
  const directory = new URL(".", parsedBase).href;
  const safeDirectory = directory.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const markers = `<base href="${safeDirectory}"><meta name="eshop-filled-theme" content="${themeId}">`;
  return /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, match => `${match}${markers}`)
    : `${markers}${html}`;
}

async function readAsset(fetchImpl, url, authorization, signal) {
  const headers = { "X-Eshop-Theme-Internal": "preview" };
  if (authorization) headers.Authorization = `Bearer ${authorization}`;
  const response = await fetchImpl(url, {
    headers,
    cache: "no-store",
    ...(signal ? { signal } : {})
  });
  if (!response.ok) throw new Error(`Could not load the selected theme template (${response.status}).`);
  return response;
}

async function readAssetFromCandidates(fetchImpl, urls, authorization, cacheStorage) {
  let lastError;
  let cache = null;
  try {
    cache = await cacheStorage?.open("eshop-theme-templates-v1");
  } catch (error) {
    console.warn("Theme template cache is unavailable.", error);
  }
  for (const url of urls) {
    let timeout;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    try {
      const response = await Promise.race([
        readAsset(fetchImpl, url, authorization, controller?.signal),
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller?.abort();
            reject(new Error("Theme template request timed out."));
          }, 8000);
        })
      ]);
      if (cache) {
        try {
          await cache.put(url, response.clone());
        } catch (error) {
          console.warn("Theme template could not be saved for offline use.", error);
        }
      }
      return response;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (cache) {
    for (const url of urls) {
      try {
        const cached = await cache.match(url);
        if (cached) return cached;
      } catch (error) {
        console.warn("Cached theme template could not be read.", error);
      }
    }
  }
  throw lastError || new Error("Could not load the selected theme template.");
}

export async function fillThemeForShop(themeId, shopData, {
  fetchImpl = globalThis.fetch,
  DOMParser = globalThis.DOMParser,
  baseHref,
  cacheStorage = globalThis.caches,
  authorization,
  tenantId = "main"
} = {}) {
  if (!isSupportedThemeId(themeId)) {
    throw new Error(`Theme "${themeId}" is not available for shop-data filling yet. Supported themes: ${SUPPORTED_THEME_IDS.join(", ")}.`);
  }
  if (typeof fetchImpl !== "function") throw new Error("Theme templates cannot be loaded in this environment.");
  if (!DOMParser) throw new Error("Theme filling requires DOMParser.");

  const templateOrigin = baseHref ? new URL(baseHref).origin : globalThis.location?.origin;
  if (!templateOrigin) throw new Error("The theme template service URL is unavailable.");
  const roots = [new URL(`/theme-skeletons/${themeId}/`, templateOrigin)];
  const assetUrls = file => roots.map(root => {
    const url = new URL(file, root);
    url.searchParams.set("tenant", tenantId);
    return url.href;
  });
  const [htmlResponse, schemaResponse] = await Promise.all([
    readAssetFromCandidates(fetchImpl, assetUrls("index.html"), authorization, cacheStorage),
    readAssetFromCandidates(fetchImpl, assetUrls("schema-v2.json"), authorization, cacheStorage)
  ]);
  const [sourceHtml, schema] = await Promise.all([
    htmlResponse.text(),
    schemaResponse.json()
  ]);
  if (schema.version !== 2 || schema.themeId !== themeId) {
    throw new Error(`Theme "${themeId}" has an invalid or mismatched fill schema.`);
  }
  const source = addThemeBase(sourceHtml, themeId, baseHref || `https://eshop-storefront.ryanrobin07-ek.workers.dev/themes/${themeId}/index.html`);
  const filledHtml = fillThemeSkeleton(source, schema, shopData, { DOMParser, mode: "live" });
  if (filledHtml.includes("__ESHOP_DATA_") ||
      /<template\b[^>]*data-repeat|data-eshop-skeleton-preview/i.test(filledHtml)) {
    throw new Error(`Theme "${themeId}" could not be fully filled from this shop's catalog.`);
  }
  return filledHtml;
}
