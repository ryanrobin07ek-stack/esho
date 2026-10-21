import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WEBSITE_THEME_CATALOG } from "../src/theme-catalog.js";
import { craftStudioGoogleFonts, craftStudioThemeCss, fillEditableStorefrontTheme } from "../public/editable-storefront-theme.js";

const theme = WEBSITE_THEME_CATALOG.find(item => item.id === "craft-main-storefront");
const sourceUrl = new URL("../public/theme-packages/craft-main-storefront/index.html", import.meta.url);

const readData = html => {
  const match = html.match(/const DATA = (\{[^\r\n]*\});/);
  assert.ok(match, "The filled storefront should contain its shop catalog.");
  return JSON.parse(match[1]);
};

test("the requested HTML is Craft's only new-website theme", async () => {
  assert.ok(theme);
  assert.equal(theme.is_main, true);
  assert.equal(theme.editor_mode, "app");
  assert.equal(theme.preview_url, "/theme-packages/craft-main-storefront/index.html");
  assert.equal(theme.studio_url, "/theme-packages/craft-main-storefront/studio.html");
  assert.equal(theme.studio_mode, "embedded");
  assert.equal(WEBSITE_THEME_CATALOG.filter(item => item.is_main).length, 1);
  const packaged = await readFile(sourceUrl, "utf8");
  assert.match(packaged, /--sky:#2f9fdd;[\s\S]*?--radius:10px;/,
    "The packaged Craft storefront should preserve the selected theme's design tokens.");
  assert.match(packaged, /function renderStudioHome\(\)/,
    "The packaged theme adds a storefront renderer for saved Studio sections.");
});

test("the main theme Studio uses the extracted Library without demo storefront records", async () => {
  const studioUrl = new URL("../public/theme-packages/craft-main-storefront/studio.html", import.meta.url);
  const studio = await readFile(studioUrl, "utf8");
  const match = studio.match(/<script type="application\/json" id="embeddedData">([\s\S]*?)<\/script>/);
  assert.ok(match, "The Studio should include its Library data.");
  const embedded = JSON.parse(match[1]);

  assert.deepEqual(Object.keys(embedded), ["library"]);
  assert.equal(embedded.library.extractedThemes.length, 39);
  assert.equal(embedded.library.colorCatalog.length, 1197);
  assert.doesNotMatch(studio, /p_special_burger|Drizzle Artisan Burger/);
  assert.match(studio, /Array\.isArray\(embedded\?\.products\)/,
    "The app may inject its own store catalog without bundling demo records.");
});

test("the app maps merchant products, categories, images, and currency into the source theme", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const sourceStyle = source.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
  const catalog = {
    store: { currency: "KES" },
    categories: [
      { id: 4, name: "Tea", parent_id: null, image: "https://shop.test/tea.webp" },
      { id: 5, name: "Green tea", parent_id: 4 }
    ],
    products: [{
      id: 9,
      name: "Green tea",
      price: 125,
      description: "Shop-owned product",
      category_id: 4,
      subcategory_id: 5,
      images: ["https://shop.test/green-tea.webp"],
      sku: "TEA-9"
    }]
  };
  const filled = fillEditableStorefrontTheme(source, catalog,
    "https://app.test/theme-packages/craft-main-storefront/index.html");
  const data = readData(filled);
  const config = filled.match(/currency: \{[^\r\n]+\}/)?.[0];

  assert.deepEqual(data.categories, [
    { id: "4", name: "Tea", parentId: null, image: "https://shop.test/tea.webp" },
    { id: "5", name: "Green tea", parentId: 4, image: "" }
  ]);
  assert.deepEqual(data.products, [{
    id: "9",
    name: "Green tea",
    price: 125,
    description: "Shop-owned product",
    brand: "",
    categoryId: "4",
    subcategoryId: "5",
    images: ["https://shop.test/green-tea.webp"],
    sku: "TEA-9"
  }]);
  assert.match(config, /code: "KES"/);
  assert.match(config, /locale: "en-KE"/);
  assert.match(filled, /<meta name="eshop-filled-theme" content="craft-main-storefront">/);
  assert.match(filled, /<base href="https:\/\/app\.test\/theme-packages\/craft-main-storefront\/">/);
  assert.equal(filled.match(/<style>([\s\S]*?)<\/style>/i)?.[1], sourceStyle,
    "The source theme's design CSS must remain unchanged.");
  assert.doesNotMatch(filled, /editable-storefront-runtime\.js/);
});

test("an empty shop does not inherit demo catalog content from the source HTML", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const filled = fillEditableStorefrontTheme(source, {
    store: { currency: "USD" },
    categories: [],
    products: []
  }, "https://app.test/theme-packages/craft-main-storefront/index.html");
  const data = readData(filled);

  assert.deepEqual(data.categories, []);
  assert.deepEqual(data.products, []);
  assert.match(filled, /code: "USD"/);
  assert.match(filled, /locale: "en-US"/);
});

test("unsupported storefront currency fails explicitly", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.throws(() => fillEditableStorefrontTheme(source, {
    store: { currency: "NOT-A-CURRENCY" }
  }, "https://app.test/theme-packages/craft-main-storefront/index.html"),
  /currency .* is not supported/i);
});

test("saved Craft Studio colors, typography, and card radius are applied to the storefront", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const savedStudio = {
    published: {
      theme: {
        colors: {
          wine: "#123456",
          wineDeep: "#234567",
          sand: "#eeeeee",
          sandPale: "#fafafa",
          text: "#101010",
          muted: "#555555",
          white: "#ffffff"
        },
        radius: 18,
        fonts: {
          head: '"Bricolage Grotesque","Helvetica Neue",sans-serif',
          body: '"Inter",system-ui,sans-serif'
        }
      }
    }
  };
  const filled = fillEditableStorefrontTheme(source, {}, "https://app.test/theme-packages/craft-main-storefront/index.html", savedStudio);
  const css = craftStudioThemeCss(savedStudio);

  assert.match(filled, /<style id="eshop-craft-studio-theme">/);
  assert.match(filled, /fonts\.googleapis\.com\/css2\?/);
  assert.match(css, /--sky:#123456/);
  assert.match(css, /--sky-dark:#234567/);
  assert.match(css, /--sky-lighter:#fafafa/);
  assert.match(css, /body\{background-color:#fafafa!important\}/);
  assert.match(css, /--radius:18px/);
  assert.match(css, /\.product-card,\.product-media,\.cat-item\{border-radius:18px/);
  assert.match(css, /font-family:"Inter",system-ui,sans-serif/);
  assert.match(css, /body h1,body h2,body h3,body h4,body h5,body h6\{font-family:"Bricolage Grotesque","Helvetica Neue",sans-serif!important\}/);

  const googleFonts = craftStudioGoogleFonts({
    published: {
      theme: {
        fonts: {
          head: '"Bricolage Grotesque","Helvetica Neue",sans-serif',
          body: '"Inter",system-ui,sans-serif'
        }
      }
    }
  });
  assert.match(googleFonts, /family=Bricolage\+Grotesque/);
  assert.match(googleFonts, /family=Inter/);
  assert.equal(craftStudioGoogleFonts({
    published: { theme: { fonts: { head: '"Custom Font",sans-serif' } } }
  }), "");

  const safeCss = craftStudioThemeCss({
    published: {
      theme: {
        colors: { wine: "red; body{display:none}" },
        radius: 999,
        fonts: { body: "Arial;body{display:none}" }
      }
    }
  });
  assert.doesNotMatch(safeCss, /display:none/);
  assert.match(safeCss, /border-radius:28px/);
});

test("Studio global appearance colours reach storefront backgrounds and chrome", async () => {
  const css = craftStudioThemeCss({
    published: {
      theme: {
        colors: {
          pageBackground: "#f1e8dc",
          surfaceBackground: "#fffdf8",
          headerBackground: "#fffdf8",
          navigationBackground: "#223344",
          footerBackground: "#332211"
        }
      }
    }
  });
  const studioSource = await readFile(new URL("../public/theme-packages/craft-main-storefront/studio.html", import.meta.url), "utf8");
  const storefrontSource = await readFile(sourceUrl, "utf8");
  assert.match(css, /body\{background-color:#f1e8dc!important\}/);
  assert.match(css, /--page-bg:#f1e8dc/);
  assert.match(css, /\.bottom-nav\{background-color:#223344!important\}/);
  assert.match(css, /\.site-footer\{background-color:#332211!important\}/);
  assert.match(studioSource, /\["sections","Sections"\], \["settings","Settings"\]/);
  assert.match(studioSource, /renderSettings\(list, insp\)/);
  assert.match(studioSource, /id="stLogoFile"/);
  assert.match(studioSource, /pageBackground/);
  assert.match(studioSource, /screens\.map\(\(\[route, label\]\)/);
  assert.match(studioSource, /\["brand-logo","Brand logo"\]/);
  assert.match(storefrontSource, /case 'brand-logo'/);
  assert.match(storefrontSource, /background:var\(--nav-bg,var\(--white\)\)/);
  assert.match(storefrontSource, /background:var\(--footer-bg,transparent\)/);
});

test("Craft palettes style the store consistently and keep section/logo editing intact", async () => {
  const colors = {
    wine: "#123456",
    wineDeep: "#234567",
    sand: "#eeeeee",
    sandPale: "#fafafa",
    text: "#101010",
    muted: "#555555",
    pageBackground: "#fafafa",
    surfaceBackground: "#fffdf8",
    headerBackground: "#fffdf8",
    navigationBackground: "#223344",
    footerBackground: "#332211"
  };
  const css = craftStudioThemeCss({ published: { theme: { colors } } });
  const studio = await readFile(new URL("../public/theme-packages/craft-main-storefront/studio.html", import.meta.url), "utf8");

  assert.match(css, /--border:#1234562e/);
  assert.match(css, /--accent-wash:#1234561a/);
  assert.match(css, /\.product-card,\.product-media,\.cat-item,\.drawer\{background-color:#fffdf8!important\}/);
  assert.match(studio, /function applyPaletteToTheme\(theme, palette\)/);
  assert.match(studio, /applyPaletteToTheme\(DRAFT\.theme, pal\)/);
  assert.match(studio, /title:"Hero sections"/);
  assert.match(studio, /title:"Product sections"/);
  assert.match(studio, /picker\.querySelector\("\[data-add-section\]"\)\?\.focus\(\)/);
  assert.match(studio, /uploadImage\(f, \{ preserveTransparency:true \}\)/);
});

test("the app reads saved Craft Studio settings and keeps its CSS overrides last", async () => {
  const pageSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(pageSource, /craft\.main-storefront\.studio\.v1/);
  assert.match(pageSource, /fillEditableStorefrontTheme\(source, catalog, themeUrl\.href, savedStudio\)/);
  assert.match(pageSource, /fillEditableStorefrontTheme\(\s*await templateResponse\.text\(\), filledCatalog, themeUrl\.href, savedStudio\s*\)/);
  assert.match(pageSource, /Could not read saved Craft Studio theme settings for publishing/);
  assert.match(pageSource, /const studioStyle = previewDocument\.getElementById\("eshop-craft-studio-theme"\);[\s\S]*?previewDocument\.head\.appendChild\(studioStyle\)/);
  assert.match(pageSource, /storefrontFrame\.addEventListener\("load", \(\) => renderSectionList\(\)\)/);
});

test("saved Studio catalog and sections are rendered by the storefront preview", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const filled = fillEditableStorefrontTheme(source, {
    store: { currency: "KES" },
    products: [{ id: "sqlite-product", name: "SQLite product", price: 10 }],
    categories: [{ id: "sqlite-category", name: "SQLite category" }]
  }, "https://app.test/theme-packages/craft-main-storefront/index.html", {
    published: {
      products: [{
        id: "studio-product",
        name: "Studio product",
        price: 42,
        categoryIds: ["studio-category"]
      }],
      categories: [{ id: "studio-category", name: "Studio category", published: 1 }],
      pages: [{ id: "home-page", type: "home" }],
      sections: [{
        id: "home-products",
        pageId: "home-page",
        type: "products-grid",
        position: 0,
        visible: 1,
        props: { title: "Selected in Studio", limit: 5, columns: 4, mobileColumns: 1 }
      }]
    }
  });
  const studioJson = filled.match(/<script type="application\/json" id="eshop-studio-data">([\s\S]*?)<\/script>/);
  assert.ok(studioJson);
  assert.equal(JSON.parse(studioJson[1]).sections[0].props.title, "Selected in Studio");
  assert.equal(JSON.parse(studioJson[1]).sections[0].props.columns, 4);
  assert.equal(JSON.parse(studioJson[1]).sections[0].props.mobileColumns, 1);
  assert.match(filled, /location\.hash="#\/home"/);

  const data = readData(filled);
  assert.equal(data.products[0].id, "studio-product");
  assert.equal(data.products[0].categoryId, "studio-category");
  assert.equal(data.categories[0].name, "Studio category");
  assert.match(filled, /Array\.isArray\(STUDIO_DATA\?\.sections\).*renderStudioHome/s);
  assert.match(filled, /case 'categories-rail'[\s\S]*?case 'products-grid'[\s\S]*?case 'category-sections'/);
  assert.match(source, /productGridStyle\(props, 3, 2\)/);
  assert.match(source, /productGridStyle\(props, 2, 2\)/);
  assert.match(filled, /--product-grid-columns-mobile:\s*2/);
  assert.match(filled, /function renderStudioPage\(slug\)/);
  assert.match(filled, /Array\.isArray\(STUDIO_DATA\?\.footerGroups\)/);
});

test("Craft product cards have editable responsive columns and wrap long text", async () => {
  const storefront = await readFile(sourceUrl, "utf8");
  const studio = await readFile(new URL("../public/theme-packages/craft-main-storefront/studio.html", import.meta.url), "utf8");
  assert.match(studio, /Cards per row \(desktop\)[\s\S]*?o:\["2","3","4"\]/);
  assert.match(studio, /Cards per row \(mobile\)[\s\S]*?o:\["1","2","3","4"\]/);
  assert.match(studio, /"products-grid":\s*\{\s*title:"Products", limit:3, columns:3, mobileColumns:2/);
  assert.match(studio, /Products to show \(0 = all\)[\s\S]*?t:"number", min:0/);
  assert.match(studio, /Products per category \(0 = all\)[\s\S]*?t:"number", min:0/);
  assert.match(studio, /this\.field\(f, s\.props\[f\.k\] \?\? defaults\[f\.k\]/);
  for (const source of [storefront, studio]) {
    assert.match(source, /grid-template-columns:repeat\(var\(--product-grid-columns\),minmax\(0,1fr\)\)/);
    assert.match(source, /grid-template-columns:repeat\(var\(--product-grid-columns-mobile\),minmax\(0,1fr\)\)/);
    assert.match(source, /overflow-wrap:anywhere/);
    assert.doesNotMatch(source, /-webkit-line-clamp:2/);
  }

  const styleSource = storefront.match(/const productGridStyle = function \(props, desktop, mobile\) \{[\s\S]*?\n      \};/)?.[0];
  assert.ok(styleSource, "The storefront should define responsive grid column styles.");
  const productGridStyle = new Function(`${styleSource}; return productGridStyle;`)();
  assert.equal(productGridStyle({ columns: 4, mobileColumns: 4 }, 3, 2),
    ' style="--product-grid-columns:4;--product-grid-columns-mobile:4"');
  assert.equal(productGridStyle({}, 3, 2),
    ' style="--product-grid-columns:3;--product-grid-columns-mobile:2"');

  const limitSource = storefront.match(/const limit = function \(value, fallback, available\) \{[\s\S]*?\n      \};/)?.[0];
  assert.ok(limitSource, "The storefront should limit products only to the available catalog size.");
  const productLimit = new Function(`${limitSource}; return limit;`)();
  assert.equal(productLimit(80, 3, 100), 80);
  assert.equal(productLimit(0, 3, 100), 100);
  assert.equal(productLimit(0, 3, 7), 7);
  assert.equal(productLimit(5, 3, 7), 5);

  const renderHomeStart = storefront.indexOf("  function renderStudioHome() {");
  const renderHomeEnd = storefront.indexOf("  /* Section C */", renderHomeStart);
  assert.ok(renderHomeStart >= 0 && renderHomeEnd > renderHomeStart);
  const renderStudioHome = new Function(
    "STUDIO_DATA", "DATA", "emptyState", "productsInCategory", "productCard", "renderCategoryRail", "esc",
    `${storefront.slice(renderHomeStart, renderHomeEnd)}; return renderStudioHome;`
  );
  const products = Array.from({ length: 40 }, (_, index) => ({ id: index, name: `Product ${index}` }));
  const renderSection = (type, props) => {
    const render = renderStudioHome(
      {
        pages: [{ id: "home", type: "home" }],
        sections: [{ id: "section", pageId: "home", type, props }]
      },
      { products, categories: [{ id: "category", name: "Category", parentId: null }] },
      () => "",
      () => products,
      product => `<article>${product.name}</article>`,
      () => "",
      value => String(value)
    );
    return render();
  };
  const productGrid = renderSection("products-grid", { limit: 0, columns: 4, mobileColumns: 4 });
  assert.equal((productGrid.match(/<article>/g) || []).length, 40);
  assert.match(productGrid, /--product-grid-columns:4;--product-grid-columns-mobile:4/);
  const categoryGrid = renderSection("category-sections", { limit: 0, columns: 4, mobileColumns: 4 });
  assert.equal((categoryGrid.match(/<article>/g) || []).length, 40);
  assert.match(categoryGrid, /--product-grid-columns:4;--product-grid-columns-mobile:4/);
});

test("Craft Studio initializes its shop catalog from embedded app data", async () => {
  const studio = await readFile(new URL("../public/theme-packages/craft-main-storefront/studio.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const init = studio.match(/async function init\(\)\{([\s\S]*?)\n  \}\n\n  document\.addEventListener\("DOMContentLoaded", init\)/)?.[1];
  assert.ok(init, "The Studio initialization block should be present.");
  assert.match(init, /const seed = makeSeed\(\);[\s\S]*?if \(Array\.isArray\(embedded\?\.products\)\) seed\.products = embedded\.products;[\s\S]*?if \(Array\.isArray\(embedded\?\.categories\)\) seed\.categories = embedded\.categories;/);
  assert.match(init, /if \(\(!Array\.isArray\(PUB\.products\)[\s\S]*?PUB\.products = clone\(seed\.products\)/);
  assert.match(init, /if \(\(!Array\.isArray\(DRAFT\.products\)[\s\S]*?DRAFT\.products = clone\(seed\.products\)/);
  assert.match(studio, /PUB\.products = clone\(seed\.products\)/);
  assert.match(studio, /DRAFT\.categories = clone\(seed\.categories\)/);
  assert.match(studio, /if \(!PUB\.settings\.paystack\)[\s\S]*?persist\(\);\s*loadCart\(\)/);
  assert.match(app, /const studioStorageRead = isThemeStudioAsset \? "get\.call\(this,key\)" : "null"/);
  assert.match(app, /p\.getItem=function\(key\)\{if\(String\(key\)===siteKey\)return " \+ studioStorageRead/);
  assert.match(app, /\.st__hdr,#stTabs,\.st__tabs\{display:none!important\}/);
  assert.match(app, /#stTabs button\[data-tab\]/);
  assert.match(studio, /if \(!location\.hash\) location\.hash = "#\/home";/);
  assert.doesNotMatch(studio, /history\.replaceState\(null,\s*["']["'],\s*["']#\/home["']\)/);
});
