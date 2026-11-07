import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bootstrap = await readFile(new URL("../src/bootstrap.js", import.meta.url), "utf8");
const visualTheme = await readFile(new URL("../src/app-visual-theme.css", import.meta.url), "utf8");
const appHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const posSource = await readFile(new URL("../src/pos.js", import.meta.url), "utf8");

test("native app screens share the homepage visual foundation", () => {
  assert.match(bootstrap, /import '\.\/app-visual-theme\.css'/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme/);
  assert.match(appHtml, /classList\.toggle\("app-interior-theme", path !== "\/"\)/);
  assert.match(visualTheme, /Inter, "Segoe UI", Roboto, Arial, sans-serif/);
  assert.match(visualTheme, /--app-ink:\s*#111111/);
  assert.match(visualTheme, /--app-silver:\s*#e1e3e5/);
  assert.match(visualTheme, /--app-white:\s*#ffffff/);
  assert.match(visualTheme, /--app-card-radius:\s*12px/);
  assert.match(visualTheme, /--app-card-surface:\s*linear-gradient/);
  assert.match(visualTheme, /background:\s*var\(--app-card-surface\) !important/);
  assert.match(visualTheme, /business-lens-shell \.business-lens-content :is\(\.bl-kpi, \.bl-card, \.bl-insight, \.studio-data-card, \.studio-panel\)\s*\{[^}]*background:\s*var\(--app-card-surface\) !important/);
  assert.match(visualTheme, /border-radius:\s*var\(--app-card-radius\)/);
  assert.match(appHtml, /\.home-pos-card\s*\{[^}]*border-radius:\s*12px/);
  assert.match(appHtml, /\.home-workspace-card\s*\{[^}]*border-radius:\s*12px/);
  assert.match(appHtml, /\.home-launcher-group\s*\{[^}]*border-radius:\s*12px/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-metric strong\s*\{[^}]*color:\s*#111 !important/);
  assert.match(visualTheme, /body\.app-shell\.app-interior-theme #app \.pos-overview-metric\s*\{[^}]*background:\s*linear-gradient\(145deg, #e6e8ea, #cbd0d5\) !important/);
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
