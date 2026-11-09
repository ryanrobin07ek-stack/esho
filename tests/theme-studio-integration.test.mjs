import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";
import { WEBSITE_THEME_CATALOG } from "../src/theme-catalog.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("CHESSER styling is limited to Craft app routes and excludes Theme Studio", async () => {
  const [app, pos] = await Promise.all([read("../index.html"), read("../src/pos.js")]);
  const themeSetup = app.match(/setAppShellTheme\(path\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  currentRoute/)?.[1];
  const craftStyles = app.match(/\/\* CHESSER visual system for Craft app screens only\. \*\/([\s\S]*?)<\/style>/)?.[1];

  assert.ok(themeSetup);
  assert.ok(craftStyles);
  assert.match(themeSetup, /const isCraftAppUi = isAppShell && path !== "\/account\/web\/site"/);
  assert.match(themeSetup, /classList\.toggle\("craft-app-ui", isCraftAppUi\)/);
  assert.match(craftStyles, /font-family: "Craft DM Sans"/);
  assert.match(craftStyles, /font-family: "Craft Barlow Condensed"/);
  assert.match(craftStyles, /body\.craft-app-ui #app/);
  assert.match(craftStyles, /border: 1px solid #e5e5e5 !important/);
  assert.match(craftStyles, /border-radius: 12px !important/);
  assert.match(craftStyles, /box-shadow: 0 18px 40px -28px #000 !important/);
  assert.match(app, /\.workspace-menu summary\s*\{[\s\S]*?width:\s*40px/);
  assert.match(craftStyles, /studio-module-navbar \.nav-container \{[\s\S]*?height: 56px/);
  assert.match(craftStyles, /studio-workspace-heading \{[\s\S]*?justify-content: space-between/);
  assert.match(craftStyles, /studio-workspace-tab-title \{[\s\S]*?text-align: right/);
  assert.match(craftStyles, /studio-workspace-back \{[\s\S]*?width: 24px/);
  assert.match(craftStyles, /studio-workspace-back \{[\s\S]*?border: 0/);
  assert.match(craftStyles, /web-studio-shell \{[\s\S]*?padding-top: 2px !important/);
  assert.match(app, /\.workspace-sidebar-link\.is-active,[\s\S]*?background:\s*#f5f5f7/);
  assert.match(app, /\.workspace-sidebar\s*\{[\s\S]*?background:\s*#09090b/);
  assert.match(app, /\.workspace-sidebar\s*\{[\s\S]*?padding:\s*max\(24px, calc\(env\(safe-area-inset-top, 0px\) \+ 16px\)\)/);
  assert.match(app, /\.workspace-sidebar-logout\s*\{[\s\S]*?background:\s*#211314[\s\S]*?color:\s*#ffc1c1/);
  assert.match(app, /workspace-sidebar-logout[^>]*aria-label="Log out"><svg/);
  assert.match(craftStyles, /home-store-card \{[\s\S]*?background-color: #050505 !important[\s\S]*?box-shadow: 0 18px 40px -28px #fff !important/);
  assert.match(craftStyles, /home-store-card \{[\s\S]*?border-radius: 12px !important/);
  assert.match(craftStyles, /web-studio-shell \.studio-panel \.studio-list-row \{[\s\S]*?height: 68px/);
  for (const card of [
    ".studio-card", ".category-circle-card", ".product-card", ".campaign-card", ".bag-item-card",
    ".order-summary-card", ".form-group-card", ".store-settings-card", ".modal-card",
    ".pos-product-tile", ".product-info-panel", ".website-theme-card", ".website-builder-card",
    ".studio-panel", ".studio-feature-panel", ".dashboard-card",
    ".pos-card", ".pos-overview-card", ".pos-revenue-card", ".metric-card", ".profile-page-card",
    ".settings-card", ".store-website-panel", ".store-workspace-card", ".studio-data-card",
    ".studio-department-content", ".plan-card", ".checkout-card", ".order-summary",
    ".store-workspace-form", ".home-store-card", ".bl-card"
  ]) {
    assert.ok(craftStyles.includes(`body.craft-app-ui #app ${card}`));
  }
  assert.doesNotMatch(craftStyles, /body\.craft-app-ui #app \.store-workspace-row \{[^}]*border:\s*1px solid/);
  assert.match(craftStyles, /body\.craft-app-ui #app \.pos-overview-card/);
  assert.match(pos, /class="pos-brand pos-brand-back \$\{path === '\/pos\/overview' \? 'pos-brand-overview' : ''\}"/);
  assert.match(pos, /aria-label="Back to Craft home"/);
  assert.doesNotMatch(craftStyles, /theme-packages|builder-theme-studio/);
});

test("Liquid theme choices open the shared Studio and Litrus opens its integrated builder", async () => {
  const studio = await read("../public/liquid-themes/theme-studio.html");
  const app = await read("../index.html");
  const mixer = await read("../public/litrus-mixer/index.html");
  const editor = app.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  renderWebsiteStoreEditor/)?.[1];
  const liquidThemes = WEBSITE_THEME_CATALOG.filter(theme => theme.editor_mode === "liquid-html");

  assert.ok(editor);
  for (const theme of liquidThemes) {
    assert.equal(theme.studio_url, "/liquid-themes/theme-studio.html");
    if (theme.preview_url) {
      assert.match(theme.preview_url, /^\/theme-packages\/[a-z0-9-]+\/index\.html$/);
    }
  }
  assert.match(editor, /searchParams\.set\("loadUrl", studioTheme\.preview_url\)/);
  assert.match(editor, /id="builder-theme-studio"/);
  assert.match(editor, /id="builder-theme-studio-save"/);
  assert.match(editor, /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(editor, /id="builder-theme-studio"[\s\S]*?min-width:0/);
  assert.match(app, /liquid-html-theme-draft:\$\{themeId\}/);
  assert.match(app, /type: "eshop-theme-studio-export-request"/);
  assert.match(app, /event\.data\?\.type === "eshop-theme-studio-catalog-request"/);
  assert.match(app, /type: "eshop-theme-studio-catalog"/);
  assert.match(app, /window\.addEventListener\("message", this\.themeStudioMessageHandler\)/);
  assert.doesNotMatch(editor, /builder-storefront-html|builder-preview-device|builder-tools-home/);
  assert.match(studio, /params\.get\('loadUrl'\)/);
  assert.match(studio, /theme-packages.{0,80}index\\\.html/);
  assert.match(studio, /url\.origin !== location\.origin/);
  assert.match(studio, /requestShopCatalog\(\)/);
  assert.match(studio, /window\.EshopImportedThemeRenderer\.render\(themeId, catalog/);
  assert.match(studio, /catalogFilled: true/);
  assert.match(studio, /await loadSite\(\[new File\(\[source\], 'index\.html'/);
  assert.match(studio, /type="module" src="\/theme-importer\.js"/);
  assert.match(studio, /type="module" src="\/liquid-html-theme-renderer\.js"/);
  assert.match(studio, /html\.m \.chassis \{ width:100%; min-width:0; max-width:100%; \}/);
  assert.match(studio, /html\.m \.monitor-bezel \{ width:100%; flex:1 1 auto; \}/);
  assert.match(studio, /frame\.style\.transformOrigin = 'center center'; frame\.style\.transform = 'translate\(-50%, -50%\) scale\(' \+ sc \+ '\)'/);
  assert.match(studio, /frame\.style\.left = '50%'; frame\.style\.top = '50%';/);
  assert.match(studio, /window\.EshopThemeImporter\.import/);
  assert.match(studio, /theme\/theme\.manifest\.json/);
  assert.match(studio, /type: 'eshop-theme-studio-design'/);
  assert.match(studio, /preview\.documentElement\.outerHTML/);
  assert.doesNotMatch(studio, /aviya-luxury|stepz-footwear/);
  assert.match(app, /websiteThemesForPicker\(\) \{\s*return this\.websiteThemes\(\)\.filter\(theme =>\s*theme\.validation_status === "passed" &&\s*\(theme\.editor_mode === "liquid-html" \|\| theme\.editor_mode === "litrus"\)\)/);
  assert.match(app, /href="\/account\/web\/site\?new=1&edit=1&theme=litrus-mixer" data-route="\/account\/web\/site\?new=1&edit=1&theme=litrus-mixer"/);
  assert.match(app, /id="builder-litrus-mixer"[\s\S]{0,180}litrus-mixer\/index\.html\?craft=1/);
  assert.match(app, /event\.data\?\.type === "craft-litrus-ready"/);
  assert.match(app, /await this\.saveLitrusMixerCatalog\(event\.data, isDraftEditor\)/);
  assert.match(app, /new=1&finish=1&theme=litrus-mixer/);
  assert.match(app, /renameLitrusMixerStorefront\(html, shopName\)/);
  assert.match(app, /snapshot\.shop\.name = shopName/);
  assert.match(app, /sp-logo/);
  assert.match(mixer, /function getCategoryNames\(\)/);
  assert.match(mixer, /craftIntegrated\?JSON\.stringify\(names\)/);
  assert.match(mixer, /if\(craftIntegrated\)return;/);
  assert.match(mixer, /type:'craft-litrus-publish'/);
  assert.equal(WEBSITE_THEME_CATALOG.some(theme => theme.id === "craft-main-storefront"), false);
  assert.ok(liquidThemes.every(theme => theme.editor_mode === "liquid-html"));
  assert.deepEqual(
    WEBSITE_THEME_CATALOG.filter(theme => theme.validation_status === "passed").map(theme => theme.id),
    ["litrus-mixer", "elora-linen"]
  );
});

test("Theme Studio automatically converts a future bundled HTML theme", async () => {
  const studio = await read("../public/liquid-themes/theme-studio.html");
  const fetched = [];
  const futureHtml = "<!doctype html><html><head><style>body{color:#222}</style></head><body><h1>Future theme</h1></body></html>";
  const dom = new JSDOM(studio, {
    runScripts: "dangerously",
    url: "https://app.test/liquid-themes/theme-studio.html?loadUrl=%2Ftheme-packages%2Ffuture-theme%2Findex.html",
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, addEventListener() {} });
      window.URL.createObjectURL = () => "blob:https://app.test/theme";
      window.URL.revokeObjectURL = () => {};
      window.fetch = async url => {
        fetched.push(new URL(url, window.location.href).pathname);
        return { ok: true, status: 200, text: async () => futureHtml };
      };
    }
  });

  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (dom.window.document.getElementById("msg").textContent.includes("Theme built")) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepEqual(fetched, ["/theme-packages/future-theme/index.html"]);
    assert.match(dom.window.document.getElementById("msg").textContent, /Theme built/);
  } finally {
    dom.window.close();
  }
});

test("Theme Studio returns the edited preview HTML to Craft", async () => {
  const studio = await read("../public/liquid-themes/theme-studio.html");
  const posted = [];
  const dom = new JSDOM(studio, {
    runScripts: "dangerously",
    url: "https://app.test/liquid-themes/theme-studio.html?loadUrl=%2Ftheme-packages%2Ffuture-theme%2Findex.html",
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, addEventListener() {} });
      window.URL.createObjectURL = () => "blob:https://app.test/theme";
      window.URL.revokeObjectURL = () => {};
      window.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => "<!doctype html><html><head><title>Future</title></head><body><h1>Future theme</h1></body></html>"
      });
      window.postMessage = (data, origin) => posted.push({ data, origin });
    }
  });

  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (dom.window.document.getElementById("msg").textContent.includes("Theme built")) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const preview = dom.window.document.getElementById("frame").contentDocument;
    preview.open();
    preview.write("<!doctype html><html><body><h1>Edited design</h1></body></html>");
    preview.close();
    dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
      source: dom.window.parent,
      origin: dom.window.location.origin,
      data: { type: "eshop-theme-studio-export-request" }
    }));

    assert.equal(posted.length, 1);
    assert.equal(posted[0].origin, dom.window.location.origin);
    assert.match(posted[0].data.html, /<h1>Edited design<\/h1>/);
  } finally {
    dom.window.close();
  }
});

test("Craft keeps its identity and registers Theme Studio's native file sharing", async () => {
  const [config, packageJson, capacitorSettings, pluginManifest, studio] = await Promise.all([
    read("../capacitor.config.ts"),
    read("../package.json").then(JSON.parse),
    read("../android/capacitor.settings.gradle"),
    read("../android/app/src/main/assets/capacitor.plugins.json").then(JSON.parse),
    read("../public/liquid-themes/theme-studio.html")
  ]);

  assert.match(config, /appId: 'com\.eshop\.atelier'/);
  assert.match(config, /appName: 'Craft'/);
  assert.match(packageJson.dependencies["@capacitor/share"], /^\^8\./);
  assert.match(capacitorSettings, /include ':capacitor-share'/);
  assert.ok(pluginManifest.some(plugin => plugin.pkg === "@capacitor/share"));
  assert.match(studio, /P\.Filesystem\.writeFile/);
  assert.match(studio, /P\.Share\.share/);
});
