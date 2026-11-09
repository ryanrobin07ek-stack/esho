import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WEBSITE_THEME_CATALOG } from "../src/theme-catalog.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("Elora is the only selectable editable storefront theme", async () => {
  const app = await read("../index.html");

  assert.deepEqual(WEBSITE_THEME_CATALOG.map(theme => theme.id), [
    "elora-linen"
  ]);
  assert.ok(WEBSITE_THEME_CATALOG.every(theme =>
    theme.validation_status === "passed" && theme.editor_mode === "liquid-html"));
  assert.match(app, /websiteThemesForPicker\(\) \{\s*return this\.websiteThemes\(\)\.filter\(theme =>\s*theme\.validation_status === "passed" && theme\.editor_mode === "liquid-html"\)/);
  assert.doesNotMatch(WEBSITE_THEME_CATALOG.map(theme => theme.id).join(" "), /aviya-luxury|stepz-footwear|craft-main-storefront|my-own-theme/);
});

test("Elora loads its bundled HTML into the shared Studio", async () => {
  const app = await read("../index.html");

  for (const theme of WEBSITE_THEME_CATALOG) {
    const source = await read(`../public${theme.preview_url}`);
    assert.match(source, /<html\b/i);
    assert.match(theme.studio_url, /^\/liquid-themes\/theme-studio\.html$/);
  }
  assert.match(app, /searchParams\.set\("loadUrl", studioTheme\.preview_url\)/);
  assert.match(app, /id="builder-theme-studio"/);
  assert.match(app, /id="builder-theme-studio-save"/);
});

test("saved Studio designs are reused for new-site and storefront publishing", async () => {
  const app = await read("../index.html");
  const studio = await read("../public/liquid-themes/theme-studio.html");

  assert.match(studio, /type: 'eshop-theme-studio-design'/);
  assert.match(studio, /preview\.documentElement\.outerHTML/);
  assert.match(app, /setWorkspaceSetting\(`liquid-html-theme-draft:\$\{themeId\}`, event\.data\.html\)/);
  assert.match(app, /if \(path === "index\.html" && savedThemeDesign\) return savedThemeDesign/);
  assert.match(app, /getWorkspaceSetting\(\s*`liquid-html-theme-draft:\$\{themeId\}`/);
});
