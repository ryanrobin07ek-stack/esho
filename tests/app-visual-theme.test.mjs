import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const bootstrap = await readFile(new URL("../src/bootstrap.js", import.meta.url), "utf8");
const visualTheme = await readFile(new URL("../src/app-visual-theme.css", import.meta.url), "utf8");
const appHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const posSource = await readFile(new URL("../src/pos.js", import.meta.url), "utf8");

test("native app screens share the homepage visual foundation", () => {
  assert.match(bootstrap, /import '\.\/app-visual-theme\.css'/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme/);
  assert.match(appHtml, /classList\.toggle\("app-interior-theme", path !== "\/"\)/);
  assert.match(appHtml, /class="app-screen-fade" aria-hidden="true"/);
  assert.match(appHtml, /\.app-screen-fade\s*\{[^}]*linear-gradient\(/);
  assert.match(appHtml, /rgb\(245 245 245 \/ 45%\)/);
  assert.match(appHtml, /\.app-screen-fade\s*\{[^}]*backdrop-filter:\s*blur\(3px\)/);
  assert.match(appHtml, /\.app-screen-background-image\.is-active\s*\{[^}]*opacity:\s*\.32/);
  assert.match(appHtml, /classList\.toggle\("app-screen-fade-active", showScreenFade\)/);
  assert.match(appHtml, /const isAppScreen = isAppShell \|\| path === "\/web" \|\| path === "\/categories" \|\|\s*path === "\/store" \|\| path\.startsWith\("\/store\/"\)/);
  assert.match(appHtml, /const showScreenFade = isAppScreen && path !== "\/" &&\s*!isNewLitrusEditor && !isExistingLitrusEditor/);
  assert.match(appHtml, /body\.app-screen-fade-active #app\s*\{[^}]*background:\s*transparent !important/);
  assert.match(visualTheme, /Inter, "Segoe UI", Roboto, Arial, sans-serif/);
  assert.match(visualTheme, /--app-ink:\s*#111111/);
  assert.match(visualTheme, /--app-silver:\s*#bfc4ca/);
  assert.match(visualTheme, /--app-white:\s*#ffffff/);
  assert.match(visualTheme, /--app-card-radius:\s*12px/);
  assert.match(visualTheme, /--app-card-surface:\s*linear-gradient/);
  assert.match(visualTheme, /backdrop-filter:\s*blur\(14px\) saturate\(160%\)/);
  assert.match(visualTheme, /background:\s*var\(--app-card-surface\) !important/);
  assert.match(visualTheme, /body\.app-screen-fade-active #app :is\(\.pos-bottom-nav, \.studio-workspace-bottom-nav, \.store-bottom-nav\)/);
  assert.match(visualTheme, /body\.app-screen-fade-active #app :is\([\s\S]*?store-bottom-nav \.store-bottom-link\[aria-current="page"\]/);
  assert.match(visualTheme, /business-lens-shell \.business-lens-content :is\(\.bl-kpi, \.bl-card, \.bl-insight, \.studio-data-card, \.studio-panel\)\s*\{[^}]*background:\s*var\(--app-card-surface\) !important/);
  assert.match(visualTheme, /border-radius:\s*var\(--app-card-radius\)/);
  assert.match(appHtml, /\.home-pos-card\s*\{[^}]*border-radius:\s*12px/);
  assert.match(appHtml, /\.home-workspace-card\s*\{[^}]*border-radius:\s*12px/);
  assert.match(appHtml, /\.home-launcher-group\s*\{[^}]*border-radius:\s*12px/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-metric strong\s*\{[^}]*color:\s*#111 !important/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-metric\s*\{[^}]*background:\s*var\(--app-card-surface\) !important/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-metric\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-card\s*\{[^}]*width:\s*100vw[^}]*margin-left:\s*calc\(50% - 50vw\)[^}]*border-radius:\s*var\(--app-card-radius\) !important/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-main \.pos-content \.pos-overview-card\s*\{\s*border-radius:\s*var\(--app-card-radius\) !important/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-metric\s*\{[^}]*width:\s*calc\(100% \+ 48px\)[^}]*margin-right:\s*-24px[^}]*margin-left:\s*-24px[^}]*border-radius:\s*var\(--app-card-radius\) !important/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-main \.pos-content \.pos-overview-card \.pos-overview-metric\s*\{\s*border-radius:\s*var\(--app-card-radius\) !important/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-metric strong\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-period-comparison-card \.pos-insight-row span\s*\{[^}]*font-size:\s*0\.72rem/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-content \.pos-overview-refresh\s*\{[^}]*border:\s*0 !important/);
  assert.doesNotMatch(appHtml, /circle cx="5" cy="12" r="1\.8"/);
  assert.doesNotMatch(posSource, /circle cx="5" cy="12" r="1\.[58]"|•••/);
  assert.match(posSource, /circle cx="12" cy="5" r="1\.8"\/><circle cx="12" cy="12" r="1\.8"\/><circle cx="12" cy="19"/);
});

test("non-Litrus app screens shuffle the supplied backgrounds beneath the homepage fade", async () => {
  const backgrounds = await readdir(new URL("../public/app-backgrounds/", import.meta.url));
  const setupStart = appHtml.indexOf("  setupAppScreenBackground() {");
  const setupEnd = appHtml.indexOf("  async loadHomeDashboard() {", setupStart);
  const setup = setupStart >= 0 && setupEnd > setupStart
    ? appHtml.slice(setupStart, setupEnd)
    : null;

  assert.equal(backgrounds.filter(file => file.endsWith(".webp")).length, 7);
  assert.match(appHtml, /class="app-screen-background" aria-hidden="true"/);
  assert.match(appHtml, /data-app-screen-background-current/);
  assert.match(appHtml, /data-app-screen-background-next/);
  assert.match(appHtml, /this\.setupAppScreenBackground\(\)/);
  assert.ok(setup, "The app background rotator should have a bounded method scope.");
  assert.match(setup, /Math\.random\(\)/);
  assert.match(setup, /window\.setInterval[\s\S]*?8500/);
});
