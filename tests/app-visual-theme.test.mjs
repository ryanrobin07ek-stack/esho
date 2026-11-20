import { readTillSource } from './helpers/till-source.mjs';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readAppSource } from "./helpers/app-source.mjs";

const bootstrap = await readFile(new URL("../src/bootstrap.js", import.meta.url), "utf8");
const visualTheme = await readFile(new URL("../src/app-visual-theme.css", import.meta.url), "utf8");
const appHtml = await readAppSource();
const posSource = await readTillSource();

test("native app screens share the homepage visual foundation", () => {
  assert.match(bootstrap, /import '\.\/app-visual-theme\.css'/);
  assert.match(visualTheme, /body\.app-shell,\s*body\.app-screen-fade-active/);
  assert.match(appHtml, /classList\.toggle\("app-interior-theme", path !== "\/"\)/);
  // Full-screen app: one flat background, not a card floating over a wallpaper gradient.
  assert.match(visualTheme, /--app-shell-background:\s*#eceff2;/);
  assert.match(visualTheme, /background:\s*var\(--app-shell-background\);/);
  assert.doesNotMatch(visualTheme, /#5B8DB8|#050505|linear-gradient/i);
  assert.doesNotMatch(appHtml, /home-background|app-screen-background|app-background-emblem|home-backgrounds\/|app-backgrounds\//);
  assert.doesNotMatch(appHtml, /setupHomeBackground|setupAppScreenBackground/);
  assert.match(appHtml, /classList\.toggle\("app-screen-fade-active", showScreenFade\)/);
  assert.match(appHtml, /const isAppScreen = isAppShell \|\| path === "\/categories" \|\|\s*path === "\/store" \|\| path\.startsWith\("\/store\/"\)/);
  assert.match(appHtml, /const showScreenFade = isAppScreen && path !== "\/" &&\s*!isNewLitrusEditor && !isExistingLitrusEditor/);
  assert.match(visualTheme, /body\.app-shell #app,\s*body\.app-screen-fade-active #app\s*\{[^}]*background:\s*transparent !important/);
  assert.match(visualTheme, /Inter, "Segoe UI", Roboto, Arial, sans-serif/);
  assert.match(visualTheme, /--app-ink:\s*#111111/);
  assert.match(visualTheme, /--app-silver:\s*#c7ccd2/);
  assert.match(visualTheme, /--app-white:\s*#ffffff/);
  assert.match(visualTheme, /--app-card-radius:\s*10px/);
  // Flat white sections: nothing frosted, nothing lifted off the page by a shadow.
  assert.match(visualTheme, /--app-card-surface:\s*#ffffff/);
  assert.doesNotMatch(visualTheme, /blur\(/);
  assert.match(visualTheme, /body\.app-shell #app \*,\s*body\.app-screen-fade-active #app \*\s*\{\s*box-shadow:\s*none !important;/);
  // The bottom bar is docked to the screen edge and the header spans the full width.
  assert.match(visualTheme, /\.studio-workspace-bottom-nav, \.store-bottom-nav\)[^{]*\{[^}]*left:\s*0 !important;[^}]*bottom:\s*0 !important;[^}]*border-radius:\s*0 !important;/);
  assert.match(visualTheme, /\.studio-workspace-heading\s*\{[^}]*position:\s*sticky;[^}]*width:\s*100vw;/);
  assert.match(visualTheme, /background:\s*var\(--app-card-surface\) !important/);
  assert.match(visualTheme, /body\.app-screen-fade-active #app :is\(\.pos-bottom-nav, \.studio-workspace-bottom-nav, \.store-bottom-nav\)/);
  assert.match(visualTheme, /body\.app-screen-fade-active #app :is\([\s\S]*?store-bottom-nav \.store-bottom-link\[aria-current="page"\]/);
  assert.match(visualTheme, /business-lens-shell \.business-lens-content :is\(\.bl-kpi, \.bl-card, \.bl-insight, \.studio-data-card, \.studio-panel\)\s*\{[^}]*background:\s*var\(--app-card-surface\) !important/);
  assert.match(visualTheme, /border-radius:\s*var\(--app-card-radius\)/);
  assert.match(visualTheme, /body\.app-shell #app \.home-screen :is\(\.home-launcher-group, \.home-shortcut-link, \.home-quick-link\)/);
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

test("app backgrounds are flat, without gradients or rotating imagery", () => {
  assert.doesNotMatch(appHtml, /data-home-background|data-app-screen-background|home-backgrounds\/|app-backgrounds\//);
  assert.doesNotMatch(appHtml, /app-background-emblem|setupHomeBackground|setupAppScreenBackground/);
  assert.match(visualTheme, /--app-shell-background:\s*#eceff2;/);
  assert.match(visualTheme, /--app-card-surface:\s*#ffffff;/);
});
