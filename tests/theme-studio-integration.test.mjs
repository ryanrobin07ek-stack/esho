import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";
import { WEBSITE_THEME_CATALOG } from "../src/theme-catalog.js";

const read = async path => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("customer shop screens never collect or persist the Cloudflare master key", async () => {
  const app = await read("../index.html");
  const shopsScreen = app.match(/renderTenantsManager\(\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  renderInventory/)?.[1];
  const publishModal = app.match(/openCloudflarePublishModal\([^)]*\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  [A-Za-z]/)?.[1];

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

test("nested Web Studio routes dispatch through the workspace renderer", async () => {
  const app = await read("../index.html");
  assert.match(app, /path === "\/account\/web" \|\| path\.startsWith\("\/account\/web\/studio\/"\)\)\s*\{\s*html = StudioRenderers\.renderMainShopWorkspace\(path\);/);
  assert.match(app, /title: "Websites",\s*route: "\/account\/web\/studio\/websites\/list"/);
  assert.match(app, /const initialPath = path === "\/account\/web"\s*\?\s*"\/account\/web\/studio\/dashboard\/overview"/);
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
  assert.match(mixer, /settingsButton\.id='shopSettingsToggle'/);
  assert.match(mixer, /#wz \.wz-head>#shopSettingsToggle\{display:inline-flex!important/);
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

test("Litrus product cards keep a local image when catalog photos are missing or fail", async () => {
  const liveCatalog = await read("../public/litrus-mixer/live-catalog.js");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  try {
    dom.window.eval(liveCatalog);
    const card = '<article data-pid=""><div class="p-img-wrapper"><img></div><h3 class="p-title"></h3></article>';
    const data = {
      shop: { name: "Example", cur: "KES", products: [] },
      pages: {
        home: `<main class="sp-main"><section class="prods">${card}</section></main>`,
        shop: `<main class="sp-main"><section class="prods"></section></main>`
      },
      templates: { productCard: card }
    };
    dom.window.litrusRefreshPublishedCatalog(data, {
      store: { name: "Example" },
      categories: [],
      products: [{ id: 1, name: "No photo", images: [] }]
    });

    const image = new dom.window.DOMParser().parseFromString(data.pages.home, "text/html").querySelector("img");
    assert.match(image.getAttribute("src"), /^data:image\/svg\+xml;charset=utf-8,/);
    image.setAttribute("src", "https://broken.example/image.webp");
    new Function(image.getAttribute("onerror")).call(image);
    assert.match(image.getAttribute("src"), /^data:image\/svg\+xml;charset=utf-8,/);
  } finally {
    dom.window.close();
  }
});

test("Litrus category styles render every category as a working category link", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const categoryBuilder = mixer.match(/function cgSec\(PV\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(categoryBuilder);
  assert.match(mixer, /categories\.length\?cgSec\(PV\):null/);
  assert.match(mixer, /SHOP\.categoriesPosition==='after-products'/);
  assert.match(mixer, /Categories placement/);

  const categories = ["Shoes", "Bags", "<b>Hats</b>", "Belts", "More"];
  const build = style => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    try {
      return runInNewContext(`${categoryBuilder}\ncgSec(true)`, {
        document: dom.window.document,
        SHOP: { custom: true, cats: categories },
        catList: () => categories.map(name => ({
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        })),
        shopProds: () => [],
        cs: { value: style },
        art: () => "https://images.test/category.webp",
        escH: value => String(value).replace(/[&<>"']/g, character => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]),
        slugify: value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-")
      });
    } finally {
      dom.window.close();
    }
  };

  const circles = build("cg0");
  assert.equal(circles.querySelectorAll("[data-litrus-category]").length, categories.length);
  assert.equal(circles.querySelector('[data-go="c/shoes"] [data-litrus-category-name]').textContent, "Shoes");
  assert.equal(circles.querySelector('[data-litrus-category-name]').textContent, "Shoes");
  assert.equal(circles.querySelector('[data-litrus-category="b-hats-b"] [data-litrus-category-name]').textContent, "<b>Hats</b>");
  assert.ok(build("cg4").querySelector(".cat-arches"), "The selected category style should change the generated layout.");
});

test("Litrus category pills keep readable text on white backgrounds", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const pillStyle = mixer.match(/\.cgw \.cat-pill\{[^}]*\}/)?.[0];
  const hoverStyle = mixer.match(/\.cgw \.cat-pill:hover\{[^}]*\}/)?.[0];
  assert.ok(pillStyle);
  assert.ok(hoverStyle);
  assert.match(pillStyle, /background:\s*#fff/);
  assert.match(pillStyle, /color:\s*#111/);
  assert.match(hoverStyle, /color:\s*var\(--btn-text,\s*#fff\)/);
});

test("Litrus published catalog updates category names without flattening the selected layout", async () => {
  const liveCatalog = await read("../public/litrus-mixer/live-catalog.js");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
  try {
    dom.window.eval(liveCatalog);
    const card = '<article data-pid="old"><div class="p-img-wrapper"><img></div><h3 class="p-title">Old product</h3><span class="p-price">1</span><p class="p-desc"></p><button class="p-btn" data-add="old"></button></article>';
    const categorySection = '<section class="litrus-categories cgw"><h2 class="sole-category-heading">Shop by category</h2><div class="cat-bento"><a class="litrus-category-link cat-bento-item" data-litrus-category="old" data-go="c/old" href="#"><img src="https://images.test/old.webp"><div class="cat-bento-overlay"><span data-litrus-category-name="">Old</span></div></a></div></section>';
    const home = `<main class="sp-main">${categorySection}<section class="prods">${card}</section></main>`;
    const data = {
      shop: { name: "Old shop", cur: "KES", offerType: "products", products: [] },
      pages: {
        home,
        shop: `<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods">${card}</section></main>`
      },
      shell: { head: '<header><nav class="sp-nav"></nav></header>' },
      templates: { productCard: card }
    };

    dom.window.litrusRefreshPublishedCatalog(data, {
      store: { name: "Live shop", currency: "KES" },
      categories: [{ id: 1, name: "Bracelets & Rings" }, { id: 2, name: "New Arrivals" }],
      products: [{
        id: 101, name: "Gold ring", price: 1800, category_id: 1,
        images: ["https://images.test/ring.webp"]
      }]
    });

    const page = new JSDOM(data.pages.home).window.document;
    const layout = page.querySelector(".cat-bento");
    assert.ok(layout);
    assert.deepEqual(
      [...layout.querySelectorAll("[data-litrus-category-name]")].map(label => label.textContent),
      ["Bracelets & Rings", "New Arrivals"]
    );
    assert.equal(layout.querySelector('[data-go="c/bracelets-and-rings"]').dataset.litrusCategory, "bracelets-and-rings");
    assert.equal(page.querySelector(".sole-category-heading").textContent, "Shop by category");
  } finally {
    dom.window.close();
  }
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

test("Litrus catalog round-trips service settings and booking details", async () => {
  const app = await read("../index.html");
  const mixer = await read("../public/litrus-mixer/index.html");
  const method = app.match(/async saveLitrusMixerCatalog\(input, isDraftEditor\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  openCloudflarePublishModal/)?.[1];
  const sendCatalog = app.match(/const sendCatalog = \(\) => \{([\s\S]*?)\r?\n        \};/)?.[1];
  const hydrateCatalog = mixer.match(/window\.litrusSetCraftCatalog=function\(payload\)\{([\s\S]*?)\r?\n\};/)?.[1];
  const payloadBuilder = mixer.match(/window\.litrusGetCraftPublishPayload=function\(\)\{([\s\S]*?)\r?\n\};/)?.[1];
  assert.ok(method);
  assert.ok(sendCatalog);
  assert.ok(hydrateCatalog);
  assert.ok(payloadBuilder);
  assert.match(sendCatalog, /offer_type:\s*store\.offer_type/);
  assert.match(sendCatalog, /duration_minutes:\s*Number\(product\.duration_minutes\)/);
  assert.match(hydrateCatalog, /duration_minutes:Number\(product\.duration_minutes\)\|\|60/);
  assert.match(hydrateCatalog, /if\(isNewShopDraft&&\(!hasRecipe\|\|replaceGeneratedRecipe\)\)\{[\s\S]*?autosave\(\)/);
  assert.equal((hydrateCatalog.match(/\bautosave\(\)/g) || []).length, 1);
  assert.match(payloadBuilder, /offer_type:SHOP\.offerType/);

  let savedCatalog;
  const save = new Function("SQLiteEngine", "window", `return async function (input, isDraftEditor) {${method}\n};`)(
    {},
    { ShopSQLite: { async flush() {} } }
  );
  const tenant = { id: "service-shop", name: "Repair studio" };
  const current = {
    tenant_id: tenant.id,
    categories: [{ id: 21, name: "Repairs" }],
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
      shop: {
        name: tenant.name,
        offer_type: "services",
        service_days: [1, 2, 3, 4, 5],
        service_open_time: "08:30",
        service_close_time: "17:30",
        service_timezone: "Africa/Nairobi",
        service_buffer_minutes: 15,
        service_deposit_percent: 20
      },
      categories: [{ name: "Repairs" }],
      products: [{
        id: "service-1",
        name: "Device repair",
        price: 2500,
        category_names: ["Repairs"],
        booking_enabled: true,
        duration_minutes: 45
      }]
    }
  }, false);

  assert.equal(savedCatalog.store.offer_type, "services");
  assert.deepEqual(savedCatalog.store.service_days, [1, 2, 3, 4, 5]);
  assert.equal(savedCatalog.store.service_open_time, "08:30");
  assert.equal(savedCatalog.store.service_close_time, "17:30");
  assert.equal(savedCatalog.store.service_timezone, "Africa/Nairobi");
  assert.equal(savedCatalog.store.service_buffer_minutes, 15);
  assert.equal(savedCatalog.store.service_deposit_percent, 20);
  assert.equal(savedCatalog.products[0].booking_enabled, true);
  assert.equal(savedCatalog.products[0].duration_minutes, 45);
});

test("Craft Litrus reload restores saved design without overwriting it on hydration", async () => {
  const app = await read("../index.html");
  const mixer = await read("../public/litrus-mixer/index.html");
  const designSave = app.match(/const saveLitrusDesign = payload => \{([\s\S]*?)\r?\n        \};/)?.[1];
  const sendCatalog = app.match(/const sendCatalog = \(\) => \{([\s\S]*?)\r?\n        \};/)?.[1];
  const hydrateCatalog = mixer.match(/window\.litrusSetCraftCatalog=function\(payload\)\{([\s\S]*?)\r?\n\};/)?.[1];
  const recipeBuilder = mixer.match(/function getCraftDesignRecipe\(\)\{([\s\S]*?)\r?\n\}/)?.[1];
  const payloadBuilder = mixer.match(/window\.litrusGetCraftPublishPayload=function\(\)\{([\s\S]*?)\r?\n\};/)?.[1];
  assert.ok(designSave);
  assert.ok(sendCatalog);
  assert.ok(hydrateCatalog);
  assert.ok(recipeBuilder);
  assert.ok(payloadBuilder);
  assert.match(designSave, /setWorkspaceSetting\(litrusRecipeKey, payload\.recipe\)/);
  assert.match(app, /const litrusScope = isDraftEditor \? `draft:\$\{draftId \|\| "new"\}` : `tenant:\$\{this\.getActiveTenant\(\)\.id\}`/);
  assert.match(app, /getWorkspaceSetting\(litrusRecipeKey, null\)/);
  assert.match(app, /liquid-html-theme-draft:litrus-mixer:tenant:\$\{tenant\.id\}/);
  assert.match(app, /litrus-mixer-recipe:tenant:\$\{result\.tenant\.id\}/);
  assert.match(app, /const savedLitrusHtml = isDraftEditor \? "" : StudioRenderers\.getWorkspaceSetting\(litrusDesignKey, ""\)/);
  assert.match(sendCatalog, /recipe:\s*savedLitrusRecipe/);
  assert.match(sendCatalog, /existing_html:\s*validLitrusHtml\(savedLitrusHtml\)\s*\?\s*savedLitrusHtml\s*:\s*""/);
  assert.match(hydrateCatalog, /isNewShopDraft=shop\.is_new_shop_draft===true/);
  assert.match(hydrateCatalog, /existingSitePreviewHtml=!isNewShopDraft/);
  assert.match(hydrateCatalog, /generatedDefault===true&&payload\.recipe\.draftId!==draftId/);
  assert.match(hydrateCatalog, /if\(isNewShopDraft&&\(!hasRecipe\|\|replaceGeneratedRecipe\)\)/);
  assert.match(sendCatalog, /is_new_shop_draft:\s*isDraftEditor/);
  assert.match(sendCatalog, /draft_id:\s*draft\?\.draft_id/);
  assert.match(app, /draft_id:\s*draftId/);
  assert.match(payloadBuilder, /recipe=getCraftDesignRecipe\(\)/);
  assert.match(payloadBuilder, /return \{html,catalog,recipe\}/);
  assert.match(recipeBuilder, /recipe\.generatedDefault=generatedDefaultDesign/);

  const compactRecipe = new Function("getRecipe", "generatedDefaultDesign", "designDraftId", `return function () {${recipeBuilder}\n};`)(
    () => ({
      litrus: "mixer-recipe",
      details: { products: [{ name: "product" }], cats: ["category"], headline: "Saved headline" }
    }),
    true,
    "draft-abc123"
  )();
  assert.equal(compactRecipe.details.headline, "Saved headline");
  assert.equal("products" in compactRecipe.details, false);
  assert.equal("cats" in compactRecipe.details, false);
  assert.equal(compactRecipe.generatedDefault, true);
  assert.equal(compactRecipe.draftId, "draft-abc123");
});

test("Litrus defers hidden mobile preview work and avoids identical iframe reloads", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const refreshPreview = mixer.match(/function refreshPreview\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(refreshPreview);
  assert.match(mixer, /id="storePreviewFrame"[^>]*loading="lazy"/);
  assert.match(mixer, /if\(mode==='preview'\)\{layoutPreview\(\);refreshPreview\(\)\}/);
  assert.match(mixer, /function syncPreviewStyles\(doc\)/);
  assert.match(refreshPreview, /currentStore\.replaceWith\(updated\)/);

  let visible = false;
  const writes = [];
  const sandboxChanges = [];
  let savedPreviewDirty = false;
  const refresh = new Function(
    "previewVisible",
    "previewDocument",
    "previewFrame",
    "existingSitePreviewHtml",
    "existingSitePreviewDirty",
    "savedSitePreviewDocument",
    "setTimeout",
    "clearTimeout",
    "setPreviewUpdating",
    "setPreviewReady",
    `let previewTimer;let lastPreviewDocument='',lastPreviewMode='';${refreshPreview}\nreturn refreshPreview;`
  )(
    () => visible,
    () => "<main>shop</main>",
    {
      set srcdoc(value) { writes.push(value); },
      setAttribute(name, value) { sandboxChanges.push([name, value]); },
      removeAttribute(name) { sandboxChanges.push([name, null]); }
    },
    "<main>saved site</main>",
    savedPreviewDirty,
    () => "<main>saved site</main>",
    setTimeout,
    clearTimeout,
    () => {},
    () => {}
  );

  refresh();
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.deepEqual(writes, [], "The hidden mobile preview should not render during builder startup.");

  visible = true;
  refresh();
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.deepEqual(writes, ["<main>saved site</main>"]);
  assert.deepEqual(sandboxChanges, [["sandbox", "allow-same-origin"]]);

  savedPreviewDirty = true;
  const generatedRefresh = new Function(
    "previewVisible",
    "previewDocument",
    "previewFrame",
    "existingSitePreviewHtml",
    "existingSitePreviewDirty",
    "savedSitePreviewDocument",
    "setTimeout",
    "clearTimeout",
    "setPreviewUpdating",
    "setPreviewReady",
    `let previewTimer;let lastPreviewDocument='',lastPreviewMode='saved';${refreshPreview}\nreturn refreshPreview;`
  )(
    () => visible,
    () => "<main>shop</main>",
    {
      set srcdoc(value) { writes.push(value); },
      setAttribute(name, value) { sandboxChanges.push([name, value]); },
      removeAttribute(name) { sandboxChanges.push([name, null]); }
    },
    "<main>saved site</main>",
    savedPreviewDirty,
    () => "<main>saved site</main>",
    setTimeout,
    clearTimeout,
    () => {},
    () => {}
  );
  generatedRefresh();
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.deepEqual(writes, ["<main>saved site</main>", "<main>shop</main>"]);
  assert.deepEqual(sandboxChanges, [["sandbox", "allow-same-origin"], ["sandbox", null]]);

  generatedRefresh();
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.deepEqual(writes, ["<main>saved site</main>", "<main>shop</main>"], "An unchanged preview should not reload its iframe.");
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

test("Litrus product grid and animation selections reach the rendered storefront", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  const layoutSource = mixer.match(/function layout\(sec,nodes\)\{[\s\S]*?\n\}/)?.[0];
  const postFxSource = mixer.match(/function postFx\(w\)\{[\s\S]*?\n\}/)?.[0];
  const animationSource = mixer.match(/ANI=(\[[^\]]+\]);\s*ani\.add/)?.[1];

  assert.ok(layoutSource);
  assert.ok(postFxSource);
  assert.ok(animationSource);
  assert.match(mixer, /\.sole-store \.sole-product-grid\{display:grid;grid-template-columns:repeat\(var\(--shop-cols,4\),minmax\(0,1fr\)\)\}/);
  assert.match(mixer, /\.prods\.shop-settings-grid\{display:grid!important;grid-template-columns:repeat\(var\(--shop-cols,3\),minmax\(0,1fr\)\)!important\}/);
  assert.match(mixer, /shop-settings-grid:has\(\>:nth-child\(3\):last-child\)\{grid-template-columns:repeat\(var\(--shop-cols,3\)/);
  assert.match(layoutSource, /Math\.min\(4,Number\(SHOP\.productsPerRow\)\|\|4,nodes\.length\|\|4\)/);
  assert.doesNotMatch(mixer, /sole-product-grid>\*,[^{}]*\{[^}]*animation:none!important/);
  assert.doesNotMatch(mixer, /\.sole-product-grid \[data-pid\],[^{}]*\.p-card\.sole-product\{[^}]*animation:none!important/);
  assert.doesNotMatch(mixer, /\.prods\.lay16>\*\{transform:none!important\}/);
  assert.match(mixer, /\.sole-product-grid\.lay19\{display:flex;flex-direction:column/);
  assert.match(mixer, /\.sole-product-grid\.lay20\{grid-template-columns:repeat\(3/);
  assert.match(mixer, /layout:\+lay\.value[\s\S]*?animation:ani\.value/);
  assert.match(mixer, /setSel\(lay,r\.layout[\s\S]*?setSel\(ani,r\.animation/);

  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  try {
    const layoutControl = { value: "0" };
    const shopConfig = { productsPerRow: 3, cats: ["Shoes", "Bags"] };
    const makeLayout = new Function(
      "SHOP", "document", "escH", "lay",
      `${layoutSource}; return layout;`
    )(shopConfig, dom.window.document, value => String(value), layoutControl);

    for (let index = 0; index <= 20; index++) {
      layoutControl.value = String(index);
      const section = dom.window.document.createElement("section");
      const nodes = [1, 2, 3].map(() => dom.window.document.createElement("article"));
      nodes.forEach(node => { node.className = "p-card"; node.dataset.cats = "Shoes|Bags"; });
      makeLayout(section, nodes);
      if (index) assert.ok(section.classList.contains(`lay${index}`), `Layout ${index} should be applied`);
      if ([0, 1, 2, 4, 9].includes(index)) assert.ok(section.classList.contains("shop-settings-grid"));
      if (index === 5) assert.ok(section.querySelector(".split-right"));
      if (index === 11) assert.ok(section.querySelector(".tabs-bar"));
      if (index === 18) assert.ok(nodes[0].classList.contains("lpk-editorial-feature"));
      if (index === 19) assert.ok(nodes[0].classList.contains("lpk-quick-order-card"));
      if (index === 20) assert.ok(nodes[0].classList.contains("lpk-lookbook-card"));
    }

    layoutControl.value = "1";
    shopConfig.productsPerRow = 2;
    const selectedTwoColumns = dom.window.document.createElement("section");
    makeLayout(selectedTwoColumns, [1, 2, 3].map(() => dom.window.document.createElement("article")));
    assert.equal(selectedTwoColumns.style.getPropertyValue("--shop-cols"), "2");
    shopConfig.productsPerRow = 4;
    const cappedToCatalogSize = dom.window.document.createElement("section");
    makeLayout(cappedToCatalogSize, [1, 2].map(() => dom.window.document.createElement("article")));
    assert.equal(cappedToCatalogSize.style.getPropertyValue("--shop-cols"), "2");

    const animations = JSON.parse(animationSource);
    for (const animation of ["rev-up", "cont-float", "hov-lift"]) {
      const root = dom.window.document.createElement("div");
      root.innerHTML = '<div class="prods"><article class="p-card"></article></div>';
      const postFx = new Function(
        "state", "lay", "ani", "io", "lpkBindMotion", "fitText", "fnt", "$", "window", "document",
        `${postFxSource}; return postFx;`
      )(
        { loopSkip: false },
        { value: "0" },
        { value: animation },
        null,
        () => {},
        () => {},
        { value: "" },
        () => null,
        dom.window,
        dom.window.document
      );
      postFx(root);
      assert.ok(root.querySelector(".p-card").classList.contains(animation), `${animation} should reach product cards`);
      assert.ok(animations.includes(animation));
    }
  } finally {
    dom.window.close();
  }
});

test("Roles5 removes Good Form as a preset and randomizes new site styles", async () => {
  const mixer = await read("../public/litrus-mixer/index.html");
  assert.doesNotMatch(mixer, /\{n:'Good Form',tags:/);
  assert.doesNotMatch(mixer, /configureStyleKit\('Good Form'/);
  assert.match(mixer, /const randomDraftMood=\(\)=>R\(MOODS\.slice\(0,8\)\)/);
  assert.match(mixer, /mood=randomDraftMood\(\)/);
  assert.match(mixer, /PALS\.push\(\["Good Form","#f7f6f3","#dedbd5","#222321","#252725","#b47a57"\]\)/);
  assert.doesNotMatch(mixer, /GOOD_FORM/);
  assert.doesNotMatch(mixer, /mood=MOODS\[0\];[\s\S]*?apply\(mood,false/);
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
