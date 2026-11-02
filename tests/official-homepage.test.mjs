import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homepage = await readFile(new URL("../public/official-site/index.html", import.meta.url), "utf8");
const manifest = await readFile(new URL("../public/official-site/site.webmanifest", import.meta.url), "utf8");

test("official Craft homepage uses the root domain and its own assets", () => {
  assert.match(homepage, /<link rel="canonical" href="https:\/\/rrobin\.co\.ke\/">/);
  assert.match(homepage, /<base href="\/">/);
  assert.match(homepage, /\/official-site\/craft-icon\.png/);
  assert.doesNotMatch(homepage, /craft\.rrobin\.co\.ke|social\/craft-preview\.png/);
  assert.match(manifest, /\/official-site\/favicon-192\.png/);
});

test("official Craft account button uses server-verified Google OAuth", () => {
  assert.match(homepage, /fetch\('\/api\/auth\/google\/start'/);
  assert.match(homepage, /fetch\('\/api\/auth\/google\/complete'/);
  assert.match(homepage, /completion_secret/);
  assert.doesNotMatch(homepage, /Google Identity Services|YOUR_GOOGLE_CLIENT_ID|hashPassword|craft\.users\.v1/);
});
