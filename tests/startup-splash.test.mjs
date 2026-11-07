import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const appHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const bootstrap = await readFile(new URL("../src/bootstrap.js", import.meta.url), "utf8");
const styles = await readFile(
  new URL("../android/app/src/main/res/values/styles.xml", import.meta.url),
  "utf8"
);
const nativeSplash = await readFile(
  new URL("../android/app/src/main/res/drawable/craft_splash_background.xml", import.meta.url),
  "utf8"
);

test("native startup splash plays the supplied video until it ends and the app is ready", async () => {
  const video = await stat(new URL("../public/craft-splash.mp4", import.meta.url));

  assert.ok(video.size > 0);
  assert.match(appHtml, /id="craft-video-splash" hidden/);
  assert.match(appHtml, /dispatchEvent\(new Event\("craft:app-ready"\)\)/);
  assert.match(bootstrap, /Capacitor\.isNativePlatform\(\)/);
  assert.match(bootstrap, /video\.src = '\/craft-splash\.mp4'/);
  assert.match(bootstrap, /addEventListener\('ended', finishVideo/);
  assert.match(bootstrap, /addEventListener\('craft:app-ready'/);
  assert.match(bootstrap, /16000/);
  assert.match(styles, /@drawable\/craft_splash_background/);
  assert.match(nativeSplash, /#000000/);
});
