import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
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
  assert.match(bootstrap, /com\.eshop\.atelier:/);
  assert.match(bootstrap, /window\.location\.hash = `\/app-account\?/);
  assert.match(manifest, /android:scheme="com\.eshop\.atelier"/);
  assert.match(manifest, /android:host="auth"/);
  assert.match(manifest, /android:path="\/google"/);
});
