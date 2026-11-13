import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";
import { WEBSITE_THEME_CATALOG } from "../src/theme-catalog.js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("customer shop screens never collect or persist the Cloudflare master key", async () => {
  const app = await read("../index.html");
  const shopsScreen = app.match(/renderTenantsManager\(\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  renderInventory/)?.[1];
  const publishModal = app.match(/openCloudflarePublishModal\(\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  [A-Za-z]/)?.[1];

  assert.ok(shopsScreen);
  assert.ok(publishModal);
  assert.doesNotMatch(shopsScreen, /PUBLISH_TOKEN|Cloudflare admin key|type="password"/);
  assert.doesNotMatch(publishModal, /PUBLISH_TOKEN|Cloudflare admin key|type="password"|rememberToken/);
  assert.doesNotMatch(app, /cloudflareAdminToken|localStorage\.setItem\("ESHOP_CLOUDFLARE_PUBLISH_TOKEN_V1"/);
  assert.match(app, /localStorage\.removeItem\("ESHOP_CLOUDFLARE_PUBLISH_TOKEN_V1"\)/);
});

test("storefront newsletter and owner push broadcasts use Cloudflare", async () => {
  const app = await read("../index.html");
  const signupForm = app.match(/<form id="web-newsletter-signup">([\s\S]*?)<\/form>/)?.[1];
  const notificationsPage = app.match(/if \(page\.route === "\/account\/web\/studio\/crm\/notifications"\) \{([\s\S]*?)\n      \}/)?.[1];

  assert.ok(signupForm);
  assert.match(signupForm, /name="consent" type="checkbox" required/);
  assert.match(app, /\/api\/newsletter\/subscribe\?tenant=/);
  assert.match(app, /JSON\.stringify\(\{ email, consent: true \}\)/);
  assert.doesNotMatch(app, /Signup saved on this device/);
  assert.ok(notificationsPage);
  assert.match(notificationsPage, /form[^>]+data-business-broadcast/);
  assert.match(notificationsPage, /name="title"/);
  assert.match(notificationsPage, /name="body"/);
  assert.match(notificationsPage, /name="url"/);
  assert.match(app, /\/api\/push\/broadcast\?tenant=/);
  assert.match(app, /window\.confirm\("Send this notification now/);
  assert.match(app, /this\.bindBusinessCloudActions\(currentContent, path, renderSnapshot, activeTenant\.id\);/);
});

test("CHESSER styling is limited to Craft app routes and excludes Theme Studio", async () => {
  const [app, pos] = await Promise.all([read("../index.html"), read("../src/pos.js")]);
  const themeSetup = app.match(/setAppShellTheme\(path(?:,\s*params\s*=\s*new URLSearchParams\(\))?\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  currentRoute/)?.[1];
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
  assert.match(app, /id="builder-litrus-build"/);
  assert.match(app, /id="builder-litrus-publish"/);
  assert.match(app, /data-litrus-preview-device="phone"/);
  assert.match(app, /craft-litrus-image-request/);
  assert.match(app, /\/api\/images\/search\?tenant=/);
  assert.match(app, /errors: result\.errors \|\| \[\], error: result\.error \|\| ""/);
  assert.match(app, /event\.data\?\.type === "craft-litrus-ready"/);
  assert.match(app, /event\.data\?\.type === "craft-litrus-draft"/);
  assert.match(app, /await saveLitrusDesign\(event\.data\)/);
  assert.match(app, /await this\.saveLitrusMixerCatalog\(payload, isDraftEditor\)/);
  assert.match(app, /new=1&finish=1&theme=litrus-mixer/);
  assert.match(app, /renameLitrusMixerStorefront\(html, shopName\)/);
  assert.match(app, /snapshot\.shop\.name = shopName/);
  assert.match(app, /sp-logo/);
  assert.match(mixer, /function getCategoryNames\(\)/);
  assert.match(mixer, /craftIntegrated\?JSON\.stringify\(names\)/);
  assert.match(mixer, /if\(craftIntegrated\)\{\s*if\(window\.parent===window\|\|!document\.documentElement\.classList\.contains\('craft-ready'\)\)return/);
  assert.match(mixer, /type:'craft-litrus-publish'/);
  assert.match(mixer, /type:'craft-litrus-draft'/);
  assert.match(mixer, /type==='craft-litrus-draft-saved'/);
  assert.match(mixer, /if\(craftIntegrated\)\{/);
  assert.match(mixer, /@media\(max-width:820px\)\{#wz #shopSettingsPanel\{[^}]*min-height:0;overflow-y:auto;overscroll-behavior:contain/);
  assert.match(mixer, /id="wCraftImages"/);
  assert.match(mixer, /textContent='Loading images\.\.\.'/);
  assert.match(mixer, /type:'craft-litrus-image-request'/);
  assert.match(mixer, /if\(typeof event\.data\.error==='string'&&event\.data\.error\)request\.reject/);
  assert.match(mixer, /Cloudflare-backed image search is available through the Craft builder\./);
  assert.doesNotMatch(mixer, /litrus\.(?:pixabay|unsplash|pexels)Key|Paste your (?:Pixabay|Pexels|Unsplash)/);
  assert.doesNotMatch(mixer, /wPixabayKey|LITRUS_PIXABAY_KEY|https:\/\/pixabay\.com\/api/);
  assert.equal(WEBSITE_THEME_CATALOG.some(theme => theme.id === "craft-main-storefront"), false);
  assert.ok(liquidThemes.every(theme => theme.editor_mode === "liquid-html"));
  assert.deepEqual(
    WEBSITE_THEME_CATALOG.filter(theme => theme.validation_status === "passed").map(theme => theme.id),
    ["litrus-mixer", "elora-linen"]
  );
});

test("Litrus Add photos fills section slots without reusing product photos", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const photoFiller = mixer.match(/async function fillEmptyShopImages\(\)\{([\s\S]*?)\r?\n\s*\}\r?\nwindow\.wizFill/)?.[1];

  assert.ok(photoFiller);
  assert.match(photoFiller, /root\.querySelectorAll\('img\[data-lpk-image-slot\]'\)/);
  assert.match(photoFiller, /if\(img\.closest\('\.prods'\)\)return/);
  assert.match(photoFiller, /SHOP\.autoImages\[request\.slot\]=image\.url/);
  assert.doesNotMatch(photoFiller, /productSlots|slot:'product-|prods\.map/);
  assert.match(mixer, /const isProductHeroImage=shopProds\(\)\.some\(function\(product\)\{return product&&product\[6\]===src\}\)/);
  assert.match(mixer, /role!=='hero'&&shopProds\(\)\.some\(function\(p\)\{return p&&p\[6\]===src\}\)/);
  assert.match(mixer, /photo\(null,0,true\)/);
});

test("Litrus image request IDs work in WebViews without crypto.randomUUID", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const helper = mixer.match(/let craftImageRequestSequence=0;\r?\nfunction createCraftImageRequestId\(\)\{[\s\S]*?\r?\n\}/)?.[0];

  assert.ok(helper);
  const cryptoId = runInNewContext(`${helper}; createCraftImageRequestId()`, {
    window: { crypto: { getRandomValues(bytes) { bytes.fill(7); return bytes; } } },
    Uint8Array
  });
  assert.equal(cryptoId, "07070707070707070707070707070707");

  const fallbackIds = runInNewContext(`${helper}; [createCraftImageRequestId(), createCraftImageRequestId()]`, {
    window: { crypto: {} },
    Date: { now: () => 12345 }
  });
  assert.notEqual(fallbackIds[0], fallbackIds[1]);
});

test("Litrus mobile build and settings panels have bounded touch-scroll areas", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  assert.match(mixer, /#wz\{[^}]*height:calc\(100dvh - 58px[^}]*min-height:0;max-height:calc\([^}]*\);overflow:hidden/);
  assert.match(mixer, /#wz \.wz-sec\{[^}]*overflow-y:auto;[^}]*touch-action:pan-y/);
  assert.match(mixer, /#wz #shopSettingsPanel\{[^}]*min-height:0;overflow-y:auto;[^}]*touch-action:pan-y/);
  assert.match(mixer, /#mobileAdvancedScreen\{[^}]*overflow-y:auto;[^}]*touch-action:pan-y/);
});

test("Litrus refreshes published pages and preserves spin and video product media", async () => {
  const [mixer, liveCatalog, app] = await Promise.all([
    read("../public/litrus-mixer/index.html"),
    read("../public/litrus-mixer/live-catalog.js"),
    read("../index.html")
  ]);
  const exportStart = mixer.indexOf("function exportShop(){");
  const exportEnd = mixer.indexOf("\nfunction litrusRefreshPublishedCatalog", exportStart);
  assert.ok(exportStart >= 0 && exportEnd > exportStart);
  assert.doesNotMatch(mixer.slice(exportStart, exportEnd), /<\/script>/i);
  assert.match(liveCatalog, /function litrusRefreshPublishedCatalog/);
  assert.match(mixer, /litrusStartLiveStore\(SPD\)/);
  assert.match(app, /media_type: product\.media_type \|\| "image"/);
  assert.match(app, /spin_frames: Array\.isArray\(product\.spin_frames\)/);
  assert.match(app, /video_url: product\.video_url \|\| ""/);
  assert.match(mixer, /images:Array\.isArray\(product\.images\)\?product\.images\.slice\(0,8\):\[\]/);
  assert.match(mixer, /media_type:\['image','cutout','spin','video'\]\.includes\(product\.media_type\)/);
  assert.match(mixer, /spin_frames:\(Array\.isArray\(product\.spin_frames\)\?product\.spin_frames:\[\]\)\.map\(imgSrc\)/);
  assert.match(mixer, /video_url:String\(product\.video_url\|\|''\)/);

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  try {
    dom.window.eval(liveCatalog);
    const card = '<article data-pid="old"><div class="p-img-wrapper"><img></div><h3 class="p-title">Old product</h3><span class="p-price">1</span><p class="p-desc"></p><button class="p-btn" data-add="old"></button></article>';
    const page = `<main class="sp sp-main"><div class="sp-top"><h1>Old product</h1></div><div class="sp-wrap sp-pdp"><div class="sp-gallery"><img></div><div class="sp-info"><div class="sp-price">1</div><p class="sp-desc"></p><button data-act="addqty" data-pid="old"></button></div></div><section class="prods">${card}</section></main>`;
    const data = {
      shop: { name: "Old shop", cur: "KES", products: [{ id: "old", name: "Old product", num: 1, price: 1 }] },
      pages: { home: `<main class="sp sp-main"><section class="prods">${card}</section></main>`, shop: page, "p/old": page, "c/old": page },
      shell: { head: '<header><nav class="sp-nav"><a data-go="shop"></a></nav></header>' },
      templates: { productCard: card }
    };
    dom.window.litrusRefreshPublishedCatalog(data, {
      store: { name: "Live shop", currency: "KES" },
      categories: [{ id: 7, name: "Shoes" }],
      products: [
        {
          id: 101, name: "Spin shoe", price: 2500, category_id: 7,
          media_type: "spin", images: ["https://cdn.test/poster.webp"],
          spin_frames: ["https://cdn.test/1.webp", "https://cdn.test/2.webp"]
        },
        {
          id: 102, name: "Video bag", price: 4000, category_id: 7,
          media_type: "video", images: ["https://cdn.test/bag.webp"],
          video_url: "https://cdn.test/bag.mp4"
        }
      ]
    });

    assert.equal(data.shop.name, "Live shop");
    assert.deepEqual(data.shop.products.map(product => product.id), ["101", "102"]);
    assert.match(data.pages.shop, /Spin shoe/);
    assert.match(data.pages["c/shoes"], /Video bag/);
    const spinPage = new JSDOM(data.pages["p/101"]).window.document;
    assert.deepEqual(
      JSON.parse(spinPage.querySelector("[data-spin-frames]").getAttribute("data-spin-frames")),
      ["https://cdn.test/1.webp", "https://cdn.test/2.webp"]
    );
    const videoPage = new JSDOM(data.pages["p/102"]).window.document;
    assert.equal(videoPage.querySelector(".sp-gallery video").getAttribute("src"), "https://cdn.test/bag.mp4");
  } finally {
    dom.window.close();
  }
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

test("Litrus shop rename accepts indented Roles5 storefront exports", async () => {
  const app = await read("../index.html");
  const method = app.match(/renameLitrusMixerStorefront\(html, shopName\) \{([\s\S]*?)\r?\n  \},/)?.[1];
  assert.ok(method);
  const rename = new Function("AppUtils", `return function (html, shopName) {${method}\n};`)({
    escapeHTML(value) {
      return String(value).replace(/[&<>"]/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      })[character]);
    }
  });
  const exported = [
    '<meta name="eshop-filled-theme" content="litrus-mixer">',
    "<title>Old shop</title>",
    "<script>",
    'var SPD={"shop":{"name":"Old shop"},"pages":{},"shell":{}};',
    "  function SPRT(data) { return data; }",
    "</script>"
  ].join("\n");

  const renamed = rename(exported, "New & Shop");
  const snapshot = renamed.match(/var SPD=(\{[^\r\n]*\});\r?\n\s*function SPRT/);
  assert.ok(snapshot);
  assert.equal(JSON.parse(snapshot[1]).shop.name, "New & Shop");
  assert.match(renamed, /<title>New &amp; Shop<\/title>/);
});

test("Litrus catalog saves and restores every product category", async () => {
  const app = await read("../index.html");
  const method = app.match(/async saveLitrusMixerCatalog\(input, isDraftEditor\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  openCloudflarePublishModal/)?.[1];
  const designSave = app.match(/const saveLitrusDesign = payload => \{([\s\S]*?)\r?\n        \};/)?.[1];
  assert.ok(method);
  assert.ok(designSave);
  assert.match(designSave, /await this\.saveLitrusMixerCatalog[\s\S]*?await window\.ShopSQLite\.flush\(\)/);
  let savedCatalog;
  let flushCount = 0;
  const save = new Function("SQLiteEngine", "window", `return async function (input, isDraftEditor) {${method}\n};`)(
    {},
    { ShopSQLite: { async flush() { flushCount += 1; } } }
  );
  const tenant = { id: "shop", name: "Test shop" };
  const current = {
    tenant_id: "shop",
    categories: [{ id: 11, name: "Shoes" }, { id: 12, name: "Bags" }],
    products: [],
    inventory: [],
    store: {}
  };
  const controller = {
    getActiveTenant: () => tenant,
    tenantCatalogs: () => [current],
    setActiveTenantCatalog(_tenant, catalog) {
      savedCatalog = catalog;
    }
  };

  await save.call(controller, {
    catalog: {
      shop: { name: "Test shop" },
      categories: [{ name: "Shoes" }, { name: "Bags" }],
      products: [
        { id: "p1", name: "Everyday shoe", price: 2500, category_names: ["Shoes", "Bags"] },
        { id: "p2", name: "Gift card", price: 500, category_names: [] }
      ]
    }
  }, false);

  assert.deepEqual(savedCatalog.products[0].category_ids, [11, 12]);
  assert.equal(savedCatalog.products[0].category_id, 11);
  assert.deepEqual(savedCatalog.products[1].category_ids, []);
  assert.equal(savedCatalog.products[1].category_id, null);
  assert.equal(flushCount, 0, "The caller persists the combined catalog and design changes with one flush.");
});

test("Roles5 experimental footers remain usable when the catalog has no categories", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const footerSource = mixer.match(/function expFoot\(id,name\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(footerSource);

  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  try {
    const renderFooter = new Function(
      "catList",
      "escH",
      "SHOP",
      "document",
      `return (${footerSource});`
    )(
      () => [],
      value => String(value),
      { tagline: "Welcome to the shop", what: "useful things" },
      dom.window.document
    );
    for (const id of [
      "xf-mega", "xf-bento", "xf-neon", "xf-stair", "xf-accordion",
      "xf-glass", "xf-massive", "xf-brutal", "xf-clock", "xf-marquee"
    ]) {
      const footer = renderFooter(id, "Test shop");
      assert.doesNotMatch(footer.innerHTML, /undefined/);
      assert.ok(footer.querySelector('a[data-go="shop"]'), `${id} should link to the shop without categories`);
    }
  } finally {
    dom.window.close();
  }
});

test("Roles5 product text follows the light card palette without changing lookbook overlays", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const rule = mixer.match(/#store \.sole-store\.sole-store\.sole-store\.pal \.sole-product-grid \.p-card\.sole-product:not\(\.lpk-lookbook-card\)[^{]*\{[^}]+\}/)?.[0];

  assert.ok(rule);
  assert.match(rule, /\.p-price/);
  assert.match(rule, /color:var\(--r-deep,var\(--text,#222\)\)!important/);
  assert.match(rule, /-webkit-text-fill-color:currentColor!important/);
});

test("Roles5 product cards keep Good Form hierarchy and preserve editorial add buttons", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const start = mixer.indexOf(" const mkProds=list=>{");
  const end = mixer.indexOf("\n const footer=", start);
  assert.ok(start >= 0 && end > start);

  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  try {
    const template = dom.window.document.createElement("article");
    template.className = "p-card card-basic";
    template.innerHTML = '<div class="p-img-wrap"><img></div><div class="p-content"><h3 class="p-title"></h3><span class="p-badge"></span><strong class="p-price"></strong><p class="p-desc"></p><button class="p-btn" type="button"></button></div>';
    const cards = [{ node: template }];
    const ps = { value: "0" };
    const lay = { value: "1" };
    const makeProducts = new Function(
      "cards", "ps", "lay", "SHOP", "photo", "pdesc", "layout", "document",
      `${mixer.slice(start, end)}; return mkProds;`
    )(
      cards,
      ps,
      lay,
      { cur: "KES" },
      () => "/shoe.webp",
      product => product[4],
      (section, nodes) => nodes.forEach(node => section.append(node)),
      dom.window.document
    );
    const product = ["Trail shoe", "2,500", "", "", "Light everyday runner", ["Running"], "/shoe.webp", "shoe-1"];
    const standardCard = makeProducts([product]).querySelector(".sole-product");

    assert.ok(standardCard.querySelector(".sole-product-info.sole-product-content"));
    assert.ok(standardCard.querySelector(".sole-product-info > .sole-product-details .p-title"));
    assert.equal(standardCard.querySelector(".sole-product-info > .p-price").textContent, "KES 2,500");
    assert.equal(standardCard.querySelector(".sole-product-photo .sole-product-tag").textContent, "Running");
    assert.equal(standardCard.querySelector(".sole-product-photo .sole-product-add span").textContent, "Add to bag");
    assert.equal(standardCard.querySelector(".sole-product-photo .sole-product-add").getAttribute("aria-label"), "Add Trail shoe to bag");

    lay.value = "20";
    const editorialCard = makeProducts([product]).querySelector(".sole-product");
    assert.ok(editorialCard.querySelector(".sole-product-content .sole-product-add"));
    assert.equal(editorialCard.querySelector(".sole-product-photo .sole-product-add"), null);
    assert.match(mixer, /productsPerRow:4/);
  } finally {
    dom.window.close();
  }
});

test("Roles5 starts from a fixed Good Form storefront preset", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  assert.match(mixer, /configureStyleKit\('Good Form','layout-overlay','card-swiss','tiles','cols','Good Form','Barlow Condensed','Classic grid'\)/);
  assert.match(mixer, /PALS\.push\(\["Good Form","#f7f6f3","#dedbd5","#222321","#252725","#b47a57"\]\)/);
  assert.match(mixer, /mood=GOOD_FORM\|\|MOODS\[0\];[\s\S]*?apply\(mood,false\);show\(1\)/);
  assert.doesNotMatch(mixer, /apply\(MOODS\[0\]\);pl\.value='0';render\(\);sync\(\);show\(1\)/);
});

test("Roles5 keeps mobile category navigation compact and includes the newsletter section", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  assert.match(mixer, /#store \.cats,[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(mixer, /const newsletter=document\.createElement\('section'\);newsletter\.className='sole-newsletter/);
  assert.match(mixer, /wrap\.append\(newsletter\)/);
  assert.match(mixer, /\.sole-newsletter-shell\.nl-split \.sole-newsletter-copy,[\s\S]*?grid-column:1!important;grid-row:auto!important/);
  assert.match(mixer, /\.sole-newsletter-shell\.nl-split \.sole-newsletter-art\{height:180px!important;min-height:0!important\}/);
  assert.match(mixer, /\.sole-product-grid \.p-card\.card-swiss \.sole-product-info \.p-title\{[^}]*font-size:13px!important/);
  assert.match(mixer, /\.sole-product-grid \.p-card\.card-swiss \.sole-product-photo \.sole-product-add\{[^}]*min-height:0!important/);
  assert.match(mixer, /\.sole-product-grid \.p-card\.card-swiss \.sole-product-info \.p-title\{font-size:12px!important/);
});
