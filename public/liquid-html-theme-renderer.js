import { fillThemeSkeleton } from "./theme-skeleton-engine.js";
import { importStandaloneTheme, validateFilledTheme } from "./theme-importer.js";

const importedThemeCache = new Map();
const escapeAttribute = value => String(value ?? "").replace(/[&"]/g, character =>
  character === "&" ? "&amp;" : "&quot;");

function withThemeBase(html, themeId, baseUrl) {
  const resolvedBase = /^[a-z][a-z\d+.-]*:/i.test(baseUrl)
    ? new URL(baseUrl).href
    : new URL(baseUrl, globalThis.location?.origin || "https://localhost").href;
  const markers = `<base href="${escapeAttribute(resolvedBase)}"><meta name="eshop-filled-theme" content="${escapeAttribute(themeId)}"><meta name="eshop-liquid-theme" content="standalone">`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => `${match}${markers}`);
  return `<!doctype html><html><head>${markers}</head><body>${html}</body></html>`;
}

export async function renderLiquidHtmlTheme(themeId, catalog, {
  loadFile,
  baseUrl = "/",
  mode = "live",
  DOMParser = globalThis.DOMParser
} = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(themeId)) throw new Error("The selected theme ID is invalid.");
  if (typeof loadFile !== "function") throw new Error("Theme HTML file loader is required.");
  if (!DOMParser) throw new Error("Theme filling requires DOMParser.");

  const source = await loadFile("index.html");
  let cached = importedThemeCache.get(themeId);
  if (!cached || cached.source !== source) {
    cached = {
      source,
      imported: importStandaloneTheme(source, { themeId, DOMParser })
    };
    importedThemeCache.set(themeId, cached);
  }
  const { imported } = cached;
  if (imported.manifest.status !== "passed") {
    throw new Error(imported.manifest.reason || `Theme "${themeId}" needs review before use.`);
  }
  const schema = {
    themeId,
    fieldMap: imported.manifest.fieldMap,
    repeaters: imported.manifest.repeaters
  };
  const preparedHtml = withThemeBase(imported.html, themeId, baseUrl);
  const filled = fillThemeSkeleton(preparedHtml, schema, catalog || {}, { DOMParser, mode });
  const validation = validateFilledTheme(filled, imported.manifest, catalog || {}, { DOMParser });
  if (!validation.ok) {
    throw new Error(`Theme "${themeId}" failed shop-data validation: ${validation.errors.join(" ")}`);
  }
  return filled;
}

if (typeof window !== "undefined") {
  window.EshopImportedThemeRenderer = { render: renderLiquidHtmlTheme };
}
