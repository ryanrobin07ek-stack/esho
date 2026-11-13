import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const runtime = await readFile(new URL("../public/litrus-mixer/live-catalog.js", import.meta.url), "utf8");
const editor = await readFile(new URL("../public/litrus-mixer/index.html", import.meta.url), "utf8");
const adapter = await readFile(new URL("../public/theme-catalog-adapter.js", import.meta.url), "utf8");
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test("Litrus editor preview supports product details, add to bag, and wishlist hearts", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://editor.example/", runScripts: "outside-only" });
  const { window } = dom;
  const root = window.document.getElementById("store");
  const start = editor.indexOf("function SPRT(D){");
  const end = editor.indexOf("/* ===== SHOP PAGES", start);
  const interactionsStart = editor.indexOf("function soleInteractions(root){");
  const renderStart = editor.indexOf("\nfunction render(){", interactionsStart);
  assert.ok(start >= 0 && end > start && interactionsStart >= 0 && renderStart > interactionsStart);
  window.eval([
    editor.slice(interactionsStart, renderStart),
    "window.soleInteractions = soleInteractions;",
    editor.slice(start, end),
    "window.SPRT = SPRT;"
  ].join("\n"));
  const pages = {
    home: '<main><article class="sole-product" data-pid="sneaker-1"><a href="#" data-go="p/sneaker-1" class="p-title">Everyday Sneaker</a><button type="button" class="sole-favorite" aria-label="Save to wishlist">♡</button><button type="button" class="sole-product-add p-btn" data-act="legacy-add" data-add="sneaker-1">Add to bag</button><strong class="p-price">KES 2,500</strong></article></main>',
    "p/sneaker-1": '<main><h1>Everyday Sneaker details</h1></main>'
  };
  window.soleInteractions(root);
  const shop = {
    key: "amani",
    name: "Amani",
    cur: "KES",
    products: [{ id: "sneaker-1", name: "Everyday Sneaker", num: 2500 }]
  };
  const controller = window.SPRT({
    root,
    hash: false,
    preview: false,
    shop: () => shop,
    page: route => pages[route] || null,
    shell: () => ({ cls: "", style: "", head: "", foot: "", tail: "" })
  });
  controller.draw("home");

  try {
    root.querySelector(".sole-product-add").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true })
    );
    assert.deepEqual(JSON.parse(window.localStorage.getItem("sp:amani:cart")), [{
      id: "sneaker-1", q: 1, variantId: "", size: "", color: "", price: 2500
    }]);

    root.querySelector(".p-title").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true })
    );
    assert.equal(controller.route(), "p/sneaker-1");
    assert.match(root.textContent, /Everyday Sneaker details/);

    controller.go("home");
    const heart = root.querySelector(".sole-favorite");
    heart.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(window.localStorage.getItem("storefront.wishlist"), '["sneaker-1"]');
    assert.equal(heart.getAttribute("aria-pressed"), "true");
    assert.equal(controller.route(), "home", "Clicking the heart must not open the product page.");
  } finally {
    dom.window.close();
  }
});

test("published Litrus catalog preserves holds, renders product reservations, and uses compact categories", () => {
  const dom = new JSDOM("", { url: "https://shop.example/", runScripts: "outside-only" });
  const data = {
    shop: { key: "example", products: [] },
    pages: {
      home: '<main class="sp-main"><nav class="cats"><h2 class="sole-category-heading">Shop by category</h2><a class="sole-category-chip" href="#">Old</a></nav><section class="prods"><article data-pid="old"><button data-add="old">Add to bag</button></article></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button data-act="addqty">Add to cart</button></div></div></div></main>'
    },
    templates: { productCard: '<article data-pid=""><h2 class="p-title"></h2><button data-add="">Add to bag</button></article>' }
  };
  const catalog = {
    categories: [{ id: 8, name: "Shoes" }, { id: 9, name: "Bags", image: "/category.jpg" }],
    products: [{
      id: 42, name: "City Sneaker", price: 2500, description: "Everyday shoe",
      category_id: 8,
      images: ["/shoe.jpg", "/shoe-side.jpg"],
      sizes: ["7", "8"],
      colors: ["Black"],
      variants: [
        { id: "7-black", size: "7", color: "Black", price: null, stock: 2 },
        { id: "8-black", size: "8", color: "Black", price: 2700, stock: 1 }
      ],
      taxonomy_category_name: "Apparel & Accessories > Shoes > Sneakers",
      taxonomy_attributes: [{ attributeName: "Sneaker style", value: "Athletic" }],
      stock: 3, booking_enabled: true
    }],
    store: { name: "Example", currency: "KES" }
  };

  try {
    dom.window.eval(runtime);
    dom.window.litrusRefreshPublishedCatalog(data, catalog);
    assert.equal(data.shop.products[0].booking_enabled, true);
    assert.equal(data.shop.products[0].stock, 3);
    const categoryNav = new dom.window.DOMParser().parseFromString(data.pages.home, "text/html").querySelector(".cats");
    assert.equal(categoryNav.querySelectorAll(".sole-category-chip").length, 2);
    assert.equal(categoryNav.querySelectorAll("img").length, 0);
    const detail = new dom.window.DOMParser().parseFromString(data.pages["p/42"], "text/html");
    assert.equal(detail.querySelector(".sp-buy button")?.textContent, "Add to bag");
    assert.equal(detail.querySelectorAll(".sp-gallery-thumbs button").length, 2);
    assert.equal(detail.querySelectorAll("[data-variant-option]").length, 2);
    assert.ok(detail.querySelector("[data-litrus-product-hold-form]"));
    assert.equal(detail.querySelector("[data-litrus-product-hold-form] input[name='quantity']")?.max, "3");
    assert.match(editor, /booking_enabled:product\.booking_enabled===true\|\|product\.booking_enabled===1/);
    assert.match(editor, /booking_enabled:pr\[11\]===true/);
    const shop = new dom.window.DOMParser().parseFromString(data.pages.shop, "text/html");
    assert.ok(shop.querySelector('[data-catalog-filter="min-price"]'));
    assert.ok(shop.querySelector('[data-catalog-filter="size"]'));
    assert.ok(shop.querySelector('[data-catalog-filter="color"]'));
    assert.ok(shop.querySelector('[data-catalog-filter="product-type"]'));
    assert.ok(shop.querySelector('[data-catalog-filter="attribute:Sneaker style"]'));
  } finally {
    dom.window.close();
  }
});

test("live Litrus storefront filters products and checks out the selected variant", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const root = window.document.getElementById("store");
  const runtimeErrors = [];
  window.addEventListener("error", event => runtimeErrors.push(String(event.error || event.message)));
  const start = editor.indexOf("function SPRT(D){");
  const end = editor.indexOf("/* ===== SHOP PAGES", start);
  const catalog = {
    categories: [{ id: 8, name: "Shoes" }, { id: 9, name: "Bags" }],
    products: [{
      id: 42, name: "City Sneaker", price: 2500, category_id: 8,
      images: ["/shoe.jpg", "/shoe-side.jpg"], sizes: ["7", "8"], colors: ["Black"],
      variants: [
        { id: "7-black", size: "7", color: "Black", price: null, stock: 2 },
        { id: "8-black", size: "8", color: "Black", price: 2700, stock: 1 }
      ],
      taxonomy_category_name: "Shoes > Sneakers",
      taxonomy_attributes: [{ attributeName: "Style", value: "Athletic" }],
      stock: 3
    }, {
      id: 43, name: "Canvas Tote", price: 900, category_id: 9,
      images: ["/tote.jpg"], sizes: [], colors: [], variants: [],
      taxonomy_category_name: "Bags", taxonomy_attributes: [], stock: 0
    }],
    store: { name: "Example", currency: "KES", whatsapp: "" }
  };
  const data = {
    shop: { key: "example", products: [] },
    pages: {
      home: '<main class="sp-main"><nav class="cats"></nav><section class="prods"><article data-pid="old"><button data-add="old">Add</button></article></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><div class="sp-qty"><input class="sp-qtyv" value="1"></div><button data-act="addqty">Add to bag</button></div><button data-act="buynow">Buy now</button></div></div></main>'
    },
    templates: { productCard: '<article data-pid=""><h2 class="p-title"></h2><strong class="p-price"></strong><button data-add="">Add</button></article>' }
  };
  try {
    window.eval(runtime);
    window.litrusRefreshPublishedCatalog(data, catalog);
    window.eval(`${editor.slice(start, end)}\nwindow.SPRT = SPRT;`);
    const controller = window.SPRT({
      root,
      hash: false,
      preview: false,
      shop: () => data.shop,
      page: route => data.pages[route] || null,
      shell: () => ({ cls: "", style: "", head: "", foot: "", tail: "" })
    });

    controller.draw("shop");
    const filter = root.querySelector('[data-catalog-filter="category"]');
    filter.value = "8";
    filter.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(root.querySelector('[data-pid="42"]').hidden, false);
    assert.equal(root.querySelector('[data-pid="43"]').hidden, true);

    filter.value = "";
    root.querySelector('[data-catalog-filter="min-price"]').value = "2000";
    root.querySelector('[data-catalog-filter="min-price"]').dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(root.querySelector('[data-pid="42"]').hidden, false);
    assert.equal(root.querySelector('[data-pid="43"]').hidden, true);

    root.querySelector('[data-catalog-filter="min-price"]').value = "";
    const sizeFilter = root.querySelector('[data-catalog-filter="size"]');
    sizeFilter.value = "7";
    sizeFilter.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(root.querySelector('[data-pid="42"]').hidden, false);
    assert.equal(root.querySelector('[data-pid="43"]').hidden, true);

    const styleFilter = root.querySelector('[data-catalog-filter="attribute:Style"]');
    styleFilter.value = "Athletic";
    styleFilter.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(root.querySelector('[data-pid="42"]').hidden, false);
    assert.equal(root.querySelector('[data-pid="43"]').hidden, true);

    controller.go("p/42");
    const picker = root.querySelector("[data-product-variant-picker]");
    picker.querySelector('[data-variant-option="size"]').value = "8";
    picker.querySelector('[data-variant-option="color"]').value = "Black";
    picker.querySelector('[data-variant-option="color"]').dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(root.querySelector(".sp-price").textContent, "KES 2,700");
    const addButton = root.querySelector('[data-act="addqty"]');
    assert.equal(addButton.disabled, false);
    assert.equal(addButton.dataset.variantId, "8-black");
    assert.equal(addButton.dataset.pid, "42");
    addButton.click();
    assert.deepEqual(runtimeErrors, []);
    assert.deepEqual(JSON.parse(window.localStorage.getItem("sp:example:cart")), [{
      id: "42", q: 1, variantId: "8-black", size: "8", color: "Black", price: 2700
    }]);

    controller.go("checkout");
    root.querySelector('[name="name"]').value = "Sam Shop";
    root.querySelector('[name="phone"]').value = "0712345678";
    root.querySelector('[name="town"]').value = "Nairobi";
    root.querySelector("#spco").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    const order = JSON.parse(window.localStorage.getItem("sp:example:last"));
    assert.equal(order.items[0].price, 2700);
    assert.equal(order.items[0].size, "8");
    assert.equal(order.sub, 2700);
    assert.match(root.textContent, /1 \u00d7 City Sneaker \(8 \/ Black\)/);
    assert.match(root.textContent, /KES 2,700/);
  } finally {
    dom.window.close();
  }
});

test("Litrus product reservations submit one hold and persist its checkout details", async () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const requests = [];
  window.__ESHOP_THEME_CATALOG__ = {
    categories: [{ id: 8, name: "Shoes" }],
    products: [{
      id: 42, name: "City Sneaker", price: 2500, category_id: 8,
      images: [], stock: 4, booking_enabled: true
    }],
    store: { name: "Example", currency: "KES" }
  };
  window.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      async json() {
        return { hold: { id: "hold-1", product_id: "42", quantity: 2, expires_at: "2030-01-01T12:00:00.000Z" } };
      }
    };
  };
  window.SPD = {
    shop: { key: "example", products: [] },
    pages: {
      home: '<main class="sp-main"><nav class="cats"></nav><section class="prods"></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button data-act="addqty">Add to bag</button></div></div></div></main>'
    },
    templates: { productCard: '<article data-pid=""><button data-add="">Add to bag</button></article>' }
  };
  window.SPRT = options => {
    window.document.getElementById("store").innerHTML = options.page("p/42");
    return {};
  };

  try {
    window.eval(runtime);
    window.litrusStartLiveStore(window.SPD);
    const form = window.document.querySelector("[data-litrus-product-hold-form]");
    form.elements.quantity.value = "2";
    form.elements.customer_name.value = "Sam Shop";
    form.elements.contact.value = "sam@example.test";
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await pause(0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/product-holds");
    assert.equal(requests[0].body.product_id, "42");
    assert.equal(requests[0].body.quantity, 2);
    assert.equal(requests[0].body.contact, "sam@example.test");
    assert.equal(JSON.parse(window.localStorage.getItem("eshop-holds:shop.example"))[0].id, "hold-1");
    assert.match(form.querySelector(".sp-hold-status").textContent, /Held 2 City Sneaker/);
  } finally {
    window.close();
  }
});

test("Litrus product hearts save to wishlist without duplicate adapter controls", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <main>
      <nav class="sole-categories sole-category-chips cats">
        <h2 class="sole-category-heading">Shop by category</h2>
        <a class="sole-category-chip" href="#">Shoes</a>
      </nav>
      <article class="sole-card" data-pid="42">
        <button class="sole-favorite" aria-label="Save to wishlist">♡</button>
        <button class="p-btn" data-add="42">Add to bag</button>
      </article>
    </main><footer></footer>
  </body></html>`, { runScripts: "outside-only", url: "https://shop.example/" });
  const { window } = dom;
  window.fetch = async () => ({ ok: true });
  window.LITRUS_LIVE_CATALOG_VERSION = 1;
  window.__ESHOP_THEME_CATALOG__ = {
    products: [{ id: 42, name: "City Sneaker", price: 2500, stock: 4, images: [] }],
    categories: [{ id: 8, name: "Shoes" }],
    store: { currency: "KES" }
  };

  try {
    window.eval(adapter);
    await pause(120);
    const card = window.document.querySelector(".sole-card");
    assert.equal(card.querySelectorAll("[data-eshop-add-to-bag]").length, 0);
    assert.equal(card.querySelectorAll("[data-eshop-wishlist-toggle]").length, 0);
    assert.equal(window.document.querySelectorAll(".sole-category-chip").length, 1);
    const heart = card.querySelector(".sole-favorite");
    heart.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.equal(window.localStorage.getItem("storefront.wishlist"), '["42"]');
    assert.equal(heart.getAttribute("aria-pressed"), "true");
  } finally {
    window.close();
  }
});
