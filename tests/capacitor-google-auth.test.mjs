import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readAppSource } from "./helpers/app-source.mjs";

const appHtml = await readAppSource();
const bootstrap = await readFile(new URL("../src/bootstrap.js", import.meta.url), "utf8");
const manifest = await readFile(
  new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8"
);

test("Capacitor account center starts and completes the shared Google account flow", () => {
  assert.match(appHtml, /id="app-account-google"/);
  assert.match(appHtml, /id="app-account-google-link"/);
  assert.match(appHtml, /native:\s*window\.Capacitor\?\.isNativePlatform\?\.\(\)\s*===\s*true/);
  assert.match(appHtml, /window\.EshopAuthBrowser\?\.open/);
  assert.match(appHtml, /"\/api\/auth\/google\/complete"/);
  assert.match(appHtml, /ESHOP_ACCOUNT_SESSION_V1/);
  assert.match(appHtml, /navigate\(`\/app-account\?/);
});

test("Capacitor handles Google OAuth callbacks from both resume and cold launch", () => {
  assert.match(bootstrap, /addListener\('appUrlOpen'/);
  assert.match(bootstrap, /App\.getLaunchUrl\(\)/);
  // The return link is per app id: the build sets VITE_APP_URL_SCHEME (craft.ke) and the manifest reads custom_url_scheme.
  assert.match(bootstrap, /VITE_APP_URL_SCHEME \|\| 'com\.eshop\.atelier'/);
  assert.match(bootstrap, /window\.location\.hash = `\/app-account\?/);
  assert.match(manifest, /android:scheme="@string\/custom_url_scheme"/);
  assert.match(manifest, /android:host="auth"/);
  assert.match(manifest, /android:path="\/google"/);
});
