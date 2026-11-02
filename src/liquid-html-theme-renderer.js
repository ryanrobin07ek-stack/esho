export async function renderLiquidHtmlTheme(...args) {
  const renderer = globalThis.EshopImportedThemeRenderer?.render;
  if (typeof renderer !== "function") {
    throw new Error("The shared standalone-theme renderer is not ready.");
  }
  return renderer(...args);
}
