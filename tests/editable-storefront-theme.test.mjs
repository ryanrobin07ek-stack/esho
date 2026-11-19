import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WEBSITE_THEME_CATALOG } from "../src/theme-catalog.js";
import { readAppSource } from "./helpers/app-source.mjs";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("Litrus Mixer is the only selectable storefront builder", async () => {
  const app = await readAppSource();

  assert.deepEqual(WEBSITE_THEME_CATALOG.map(theme => theme.id), ["litrus-mixer"]);
  assert.ok(WEBSITE_THEME_CATALOG.every(theme => theme.validation_status === "passed"));
  assert.equal(WEBSITE_THEME_CATALOG.find(theme => theme.id === "litrus-mixer")?.editor_mode, "litrus");
  assert.match(app, /websiteThemesForPicker\(\) \{\s*return this\.websiteThemes\(\)\.filter\(theme =>\s*theme\.validation_status === "passed" &&\s*\(theme\.editor_mode === "liquid-html" \|\| theme\.editor_mode === "litrus"\)\)/);
  assert.doesNotMatch(WEBSITE_THEME_CATALOG.map(theme => theme.id).join(" "), /aviya-luxury|stepz-footwear|craft-main-storefront|my-own-theme/);
});

