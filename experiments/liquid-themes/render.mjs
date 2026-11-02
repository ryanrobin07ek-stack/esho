import { Liquid } from "liquidjs";
import { fileURLToPath } from "node:url";

const engine = new Liquid({
  root: fileURLToPath(new URL("./themes/", import.meta.url)),
  extname: ".liquid",
  strictFilters: true,
  strictVariables: true
});

const themes = new Set(["editorial", "market"]);

export async function renderTheme(themeId, catalog) {
  if (!themes.has(themeId)) {
    throw new Error(`Unknown Liquid theme: ${themeId}`);
  }
  if (!catalog || !catalog.store || !Array.isArray(catalog.categories) ||
      !Array.isArray(catalog.products)) {
    throw new TypeError("A shop catalog with store, categories, and products is required.");
  }

  return engine.renderFile(themeId, {
    store: catalog.store,
    categories: catalog.categories,
    products: catalog.products.map(product => ({ ...product, image: product.image || "" }))
  });
}
