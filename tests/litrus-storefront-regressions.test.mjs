import assert from "node:assert/strict";
import { readFile as readFileRaw } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const readFile = async (path, options) => {
  const contents = await readFileRaw(path, options);
  return typeof contents === "string" ? contents.replace(/\r\n/g, "\n") : contents;
};
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

test("existing website editors preserve the saved theme instead of forcing Litrus", async () => {
  const app = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const start = app.indexOf("renderWebsiteEditor(isNewWebsite = false) {");
  const end = app.indexOf("\n  renderWebsiteStoreEditor(", start);
  assert.ok(start >= 0 && end > start);
  assert.match(app.slice(start, end), /const selectedTheme = !isNewWebsite\s*\?\s*requestedTheme\s*:/);
});

test("published Litrus catalog renders service booking forms and uses compact categories", () => {
  const dom = new JSDOM("", { url: "https://shop.example/", runScripts: "outside-only" });
  const data = {
    shop: { key: "example", products: [] },
    pages: {
      home: '<main class="sp-main"><nav class="cats"><h2 class="sole-category-heading">Shop by category</h2><a class="sole-category-chip" href="#">Old</a></nav><section class="prods"><article data-pid="old"><button data-add="old">Add to bag</button></article></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button data-act="addqty">Add to cart</button></div></div></div></main>'
    },
    shell: {
      head: '<header><nav class="sp-nav"><a href="#">All products</a></nav><button class="sp-cartbtn">Cart</button><input type="search" placeholder="Search products"></header>',
      foot: '<a href="#">Delivery &amp; returns</a>',
      tail: '<a class="sp-float" data-go="cart">Cart</a>'
    },
    templates: { productCard: '<article data-pid=""><h2 class="p-title"></h2><button class="p-btn" data-act="addqty">Add to bag</button></article>' }
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
      stock: 3, booking_enabled: true, duration_minutes: 45
    }],
    store: { name: "Example", currency: "KES", offer_type: "services", service_deposit_percent: 25, service_timezone: "Africa/Nairobi" }
  };

  try {
    dom.window.eval(runtime);
    dom.window.litrusRefreshPublishedCatalog(data, catalog);
    assert.equal(data.shop.offerType, "services");
    assert.equal(data.shop.serviceDepositPercent, 25);
    assert.equal(data.shop.serviceTimezone, "Africa/Nairobi");
    assert.equal(data.shop.products[0].booking_enabled, true);
    assert.equal(data.shop.products[0].duration_minutes, 45);
    assert.equal(data.shop.products[0].stock, 3);
    const categoryNav = new dom.window.DOMParser().parseFromString(data.pages.home, "text/html").querySelector(".cats");
    assert.equal(categoryNav.querySelectorAll(".sole-category-chip").length, 2);
    assert.equal(categoryNav.querySelectorAll("img").length, 0);
    const home = new dom.window.DOMParser().parseFromString(data.pages.home, "text/html");
    const serviceCard = home.querySelector('[data-pid="42"]');
    assert.equal(serviceCard.querySelector("button").textContent, "Book now");
    assert.equal(serviceCard.querySelector("button").dataset.go, "p/42");
    assert.equal(serviceCard.querySelector("button").hasAttribute("data-add"), false);
    const detail = new dom.window.DOMParser().parseFromString(data.pages["p/42"], "text/html");
    assert.equal(detail.querySelector(".sp-buy"), null);
    assert.equal(detail.querySelector("[data-act='buynow']"), null);
    assert.equal(detail.querySelectorAll(".sp-gallery-thumbs button").length, 2);
    assert.equal(detail.querySelectorAll("[data-variant-option]").length, 0);
    assert.ok(detail.querySelector("[data-litrus-service-booking-form]"));
    assert.equal(detail.querySelector("[data-litrus-service-booking-form] h2").textContent, "Book this service");
    assert.equal(detail.querySelector("[data-litrus-service-booking-form] button[type='submit']").textContent, "Request booking");
    assert.equal(detail.querySelector("[data-litrus-product-hold-form]"), null);
    assert.match(editor, /duration_minutes:Number\(product\.duration_minutes\)\|\|60/);
    assert.match(editor, /service_deposit_percent:SHOP\.serviceDepositPercent/);
    assert.match(editor, /booking_enabled:product\.booking_enabled===true\|\|product\.booking_enabled===1/);
    assert.match(editor, /booking_enabled:pr\[11\]===true/);
    const shop = new dom.window.DOMParser().parseFromString(data.pages.shop, "text/html");
    assert.equal(shop.querySelector(".sp-top h1").textContent, "All services");
    assert.equal(shop.querySelector(".sp-top p").textContent, "1 service");
    assert.equal(shop.querySelector("[data-catalog-filters]"), null);
    const header = new dom.window.DOMParser().parseFromString(data.shell.head, "text/html");
    assert.equal(header.querySelector(".sp-nav").textContent.trim(), "ShoesBagsAll services");
    assert.equal(header.querySelector(".sp-cartbtn").textContent, "Book now");
    assert.equal(header.querySelector(".sp-cartbtn").dataset.go, "shop");
    assert.equal(header.querySelector('input[type="search"]').placeholder, "Search services");
    assert.match(data.shell.foot, /Booking &amp; cancellations/);
    assert.equal(new dom.window.DOMParser().parseFromString(data.shell.tail, "text/html").querySelector(".sp-float"), null);
  } finally {
    dom.window.close();
  }
});

test("published service cards route to booking details instead of adding to cart", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const data = {
    shop: { key: "service-shop", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"><article data-pid="old"><button class="p-btn" data-add="old">Add to bag</button></article></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button class="p-btn" data-act="addqty">Add to bag</button></div></div></div></main>'
    },
    templates: { productCard: '<article data-pid=""><button class="p-btn" data-act="addqty">Add to bag</button></article>' }
  };
  const catalog = {
    categories: [],
    products: [{ id: 42, name: "Consultation", price: 2500, images: [], stock: 5 }],
    store: { name: "Example", currency: "KES", offer_type: "services" }
  };
  const routes = [];
  const trackedEvents = [];
  window.__ESHOP_THEME_CATALOG__ = catalog;
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = (id, type) => trackedEvents.push({ id, type });
  window.SPRT = options => {
    window.document.getElementById("store").innerHTML = options.page("shop");
    return {
      go(route) {
        routes.push(route);
        window.document.getElementById("store").innerHTML = options.page(route);
      }
    };
  };

  try {
    window.eval(runtime);
    window.litrusStartLiveStore(data);
    window.document.querySelector(".p-btn").click();
    assert.deepEqual(routes, ["p/42"]);
    assert.deepEqual(trackedEvents, []);
  } finally {
    window.close();
  }
});

test("Litrus service booking submits an RFC 4122 key and all customer details without randomUUID", async () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const requests = [];
  const catalog = {
    categories: [],
    products: [{ id: 42, name: "Consultation", price: 2500, images: [], duration_minutes: 45 }],
    store: { name: "Example", currency: "KES", offer_type: "services", service_timezone: "Africa/Nairobi" }
  };
  window.__ESHOP_THEME_CATALOG__ = catalog;
  window.SPD = {
    shop: { key: "example", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section></main>',
      shop: '<main class="sp-main"><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"></div></div></div></main>'
    },
    shell: { head: "", foot: "", tail: "" },
    templates: { productCard: '<article data-pid=""></article>' }
  };
  window.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      async json() { return { appointment: { id: "appointment-1", status: "pending" } }; }
    };
  };
  Object.defineProperty(window.crypto, "randomUUID", { configurable: true, value: undefined });
  window.SPRT = options => {
    window.document.getElementById("store").innerHTML = options.page("p/42");
    return {};
  };

  try {
    window.eval(runtime);
    window.litrusStartLiveStore(window.SPD);
    const form = window.document.querySelector("[data-litrus-service-booking-form]");
    const time = form.elements.namedItem("starts_at");
    const option = window.document.createElement("option");
    option.value = "2030-01-02T10:00:00.000Z";
    time.append(option);
    time.value = option.value;
    form.elements.namedItem("customer_name").value = "Sam Customer";
    form.elements.namedItem("customer_email").value = "sam@example.test";
    form.elements.namedItem("customer_phone").value = "+254700000000";
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await pause(0);

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/service-appointments");
    assert.match(requests[0].body.idempotency_key, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    assert.equal(requests[0].body.service_id, "42");
    assert.equal(requests[0].body.starts_at, "2030-01-02T10:00:00.000Z");
    assert.equal(requests[0].body.customer_name, "Sam Customer");
    assert.equal(requests[0].body.customer_email, "sam@example.test");
    assert.equal(requests[0].body.customer_phone, "+254700000000");
    assert.match(form.querySelector(".sp-service-booking-status").textContent, /request was sent/i);
  } finally {
    window.close();
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

test("Litrus requires a product-or-service choice and switches shop types", () => {
  const offerSelect = editor.match(/<select id="wOfferType" required>([\s\S]*?)<\/select>/)?.[1] || "";
  const optionsStart = editor.indexOf("const OFFER_TYPE_OPTIONS=");
  const optionsEnd = editor.indexOf("\nconst DEFAULT_SERVICE_CATEGORIES", optionsStart);
  const helperStart = editor.indexOf("function applyOfferTypeUI(value){");
  const helperEnd = editor.indexOf("\nfunction read(){", helperStart);
  assert.match(offerSelect, /value="products"/);
  assert.match(offerSelect, /value="services"/);
  assert.ok(optionsStart >= 0 && optionsEnd > optionsStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);

  const dom = new JSDOM(`
    <select id="wType"><option value="">Choose products or services first</option></select>
    <span id="wTypeQuestion"></span><span id="wWhatQuestion"></span><input id="wWhat">
    <p id="wServiceModeNote" hidden></p><fieldset id="wServiceSettings" hidden></fieldset>
    <label id="editProdDurationWrap" hidden></label><ol id="wzSteps"><li data-s="2"></li></ol>
    <h2 id="wCatalogHeading"></h2><button id="wProductsTabBtn"></button>
    <span id="wProductsHeading"></span><button id="wAdd"></button><p id="wProductsHint"></p>
    <h3 id="productEditorTitle"></h3><span id="editProdNameLabelText"></span>
    <button id="editProdSave"></button><p id="wCategoriesHint"></p>
  `, { runScripts: "outside-only" });

  try {
    dom.window.eval(`
      var SHOP = {};
      var g = id => document.getElementById(id);
      ${editor.slice(optionsStart, optionsEnd)}
      ${editor.slice(helperStart, helperEnd)}
      window.applyOfferTypeUI = applyOfferTypeUI;
    `);

    dom.window.applyOfferTypeUI("services");
    const typeSelect = dom.window.document.getElementById("wType");
    assert.equal(dom.window.SHOP.offerType, "services");
    assert.deepEqual([...typeSelect.options].map(option => option.value), [
      "", "salon", "barber", "repair", "wellness", "other-service"
    ]);
    assert.equal(dom.window.document.getElementById("wServiceModeNote").hidden, false);
    assert.equal(dom.window.document.getElementById("wServiceSettings").hidden, false);
    assert.equal(dom.window.document.getElementById("editProdDurationWrap").hidden, false);
    assert.equal(dom.window.document.getElementById("wProductsHeading").textContent, "Your services");

    dom.window.applyOfferTypeUI("products");
    assert.equal(dom.window.SHOP.offerType, "products");
    assert.deepEqual([...typeSelect.options].map(option => option.value), [
      "", "shoes", "clothing", "food", "beauty", "electronics"
    ]);
    assert.equal(dom.window.document.getElementById("wServiceModeNote").hidden, true);
    assert.equal(dom.window.document.getElementById("wServiceSettings").hidden, true);
    assert.equal(dom.window.document.getElementById("editProdDurationWrap").hidden, true);
    assert.match(editor, /offer_type:SHOP\.offerType/);
  } finally {
    dom.window.close();
  }
});

test("Litrus defers full storefront redraws until its integrated preview is visible", async () => {
  const mixer = editor;

  assert.match(mixer, /tm=setTimeout\(\(\)=>\{if\(!craftIntegrated\|\|previewVisible\(\)\)render\(\);sync\(\);autosave\(\)\},120\)/);
  assert.match(mixer, /if\(mode==='preview'\)\{render\(\);sync\(\)\}/);
  assert.match(mixer, /if\(mode==='preview'\)\{layoutPreview\(\);refreshPreview\(\)\}/);
});

test("Litrus word shuffle uses the selected product or service language bank", () => {
  const types = ["food", "beauty", "electronics", "salon", "barber", "repair", "wellness", "other-service"];
  const optionsStart = editor.indexOf("const OFFER_TYPE_OPTIONS=");
  const optionsEnd = editor.indexOf("\nconst DEFAULT_SERVICE_CATEGORIES", optionsStart);
  const bankStart = editor.indexOf("const COPY_RULES=");
  const bankEnd = editor.indexOf("const wordCount=", bankStart);
  const shuffleStart = editor.indexOf("function shuffleShopWords(){");
  const shuffleEnd = editor.indexOf("\ng('wShufWords').onclick", shuffleStart);
  const optionCode = editor.slice(optionsStart, optionsEnd);
  assert.ok(bankStart >= 0 && bankEnd > bankStart);
  assert.ok(shuffleStart >= 0 && shuffleEnd > shuffleStart);
  for (const type of types) assert.match(optionCode, new RegExp(`\\['${type}',`));

  const dom = new JSDOM(`<select id="wType">${types.map(type =>
    `<option value="${type}">${type}</option>`).join("")}</select>
    ${["wWhat", "wTag", "wHead", "wSub", "wCta", "wAbout"].map(id =>
    `<input id="${id}">`).join("")}<small id="wWordsHint"></small>`, { runScripts: "outside-only" });
  const { window } = dom;

  try {
    window.eval(`${editor.slice(bankStart, bankEnd)}\nwindow.shopCopyBanks = SHOP_COPY;`);
    window.eval(`
      var SHOP = { type: "", promo: "", reviewLines: [] };
      var SHOP_COPY = window.shopCopyBanks;
      var g = id => document.getElementById(id);
      var read = function() {};
      var render = function() {};
      var sync = function() {};
      var autosave = function() {};
      ${editor.slice(shuffleStart, shuffleEnd)}
      window.shuffleShopWords = shuffleShopWords;
    `);

    for (const type of types) {
      window.document.getElementById("wType").value = type;
      for (const id of ["wWhat", "wTag", "wHead", "wSub", "wCta", "wAbout"]) {
        window.document.getElementById(id).value = "";
      }
      window.SHOP = { type, promo: "", reviewLines: [] };
      window.shuffleShopWords();
      const bank = window.shopCopyBanks[type];

      assert.equal(window.document.getElementById("wWhat").value, bank.what);
      assert.ok(bank.slogan.includes(window.document.getElementById("wTag").value));
      assert.ok(bank.heroTitle.includes(window.document.getElementById("wHead").value));
      assert.ok(bank.heroSub.includes(window.document.getElementById("wSub").value));
      assert.ok(bank.cta.includes(window.document.getElementById("wCta").value));
      assert.ok(bank.aboutText.includes(window.document.getElementById("wAbout").value));
      assert.equal(bank.reviewLine.length, 0, "the bank must not invent customer testimonials");
      assert.match(window.document.getElementById("wWordsHint").textContent, /New words picked for/);
    }
  } finally {
    window.close();
  }
});

test("Litrus new Craft drafts use deterministic Good Form defaults", () => {
  const start = editor.indexOf("window.litrusSetCraftCatalog=function(payload){");
  const end = editor.indexOf("\nwindow.litrusGetCraftPublishPayload=function", start);
  assert.ok(start >= 0 && end > start);
  const hydrate = editor.slice(start, end);
  const ids = [...new Set([...hydrate.matchAll(/\bg\('([^']+)'\)/g)].map(match => match[1]))];
  const dom = new JSDOM(
    `${ids.map(id => `<input id="${id}">`).join("")}<div id="wMoods"></div>`,
    { runScripts: "outside-only" }
  );

  try {
    dom.window.eval(`
      const g = id => document.getElementById(id);
      const MOODS = [{ n: "Good Form" }, { n: "Another style" }];
      const GOOD_FORM = MOODS[0];
      let mood = null, step = 1, designDraftId = "", generatedDefaultDesign = false;
      let SHOP = { categoriesPosition: "after-products" }, prods = [];
      const MAX_CATEGORIES = 30, MAX_PRODUCTS = 100, craftIntegrated = true;
      const R = values => values[0];
      const applyRecipe = () => false, applyOfferTypeUI = () => {};
      const setCategoryNames = () => {}, read = () => {}, drawProds = () => {};
      const render = () => {}, previewVisible = () => false, sync = () => {};
      const setSaved = () => {}, apply = () => {}, autosave = () => {};
      const mb = g("wMoods");
      ${hydrate}
      window.getSelectedMood = () => mood?.n;
      window.getCategoryPosition = () => SHOP.categoriesPosition;
    `);
    const categories = ["Shoes", "Bags", "New", "Sale"].map((name, index) => ({ id: index + 1, name }));
    const products = categories.map((category, index) => ({
      id: index + 1, name: `Draft product ${index + 1}`, price: 100 + index,
      category_names: [category.name], images: []
    }));

    const result = dom.window.litrusSetCraftCatalog({
      shop: { name: "Good Form draft", is_new_shop_draft: true, draft_id: "draft-1" },
      categories,
      products
    });

    assert.equal(result.products, 4);
    assert.equal(result.categories, 4);
    assert.equal(dom.window.getSelectedMood(), "Good Form");
    assert.equal(dom.window.getCategoryPosition(), "after-hero");
  } finally {
    dom.window.close();
  }
});

test("Litrus mood choices autosave, while the initial default does not overwrite saved designs", () => {
  const start = editor.indexOf("function apply(md,randomizeDetails=md.n!=='Good Form',persist=true){");
  const end = editor.indexOf("\nfunction banRev()", start);
  assert.ok(start >= 0 && end > start);
  const dom = new JSDOM(`
    <select id="selHero"><option></option><option></option></select>
    <select id="selCard"><option></option><option></option></select>
    <select id="selPal"><option></option><option></option></select>
    <select id="selFont"><option></option><option></option></select>
    <select id="selLay"><option></option><option></option></select>
    <select id="selCat"><option></option><option></option></select>
    <select id="selFoot"><option></option><option></option></select>
    <select id="selAnim"><option></option><option></option></select>
    <select id="selScroll"><option></option><option></option></select>
    <input id="cRad">
    <input id="cSp">
    <input id="cHeart">
    <input id="cRate">
    <input id="cSale">
    <input id="cBag">
    <input id="fixC" type="checkbox">
  `, { runScripts: "outside-only" });

  try {
    dom.window.eval(`
      const $ = id => document.getElementById(id);
      const hs = $('selHero'), ps = $('selCard'), pl = $('selPal'), fnt = $('selFont');
      const lay = $('selLay'), cs = $('selCat'), fs = $('selFoot'), ani = $('selAnim');
      const selScroll = $('selScroll'), fixC = $('fixC');
      const cRad = $('cRad'), cSp = $('cSp'), cHeart = $('cHeart');
      const cRate = $('cRate'), cSale = $('cSale'), cBag = $('cBag');
      const R = values => values[0];
      let autosaveCalls = 0;
      const autosave = () => { autosaveCalls += 1; };
      const setSel = (select, value) => { select.selectedIndex = value; };
      const clearPaletteOverrides = () => {};
      const banRev = () => {};
      const fillShopWords = () => {};
      const read = () => {};
      const drawProds = () => {};
      const render = () => {};
      const sync = () => {};
      const randomizeSecondaryControls = () => {};
      ${editor.slice(start, end)}
      window.applyMood = apply;
      window.getAutosaveCalls = () => autosaveCalls;
    `);

    const mood = {
      n: "Test", hero: [1], card: [1], pal: [1], font: [1],
      lay: [1], cat: [1], foot: [1], anim: [1], scroll: [1]
    };
    dom.window.applyMood(mood, false);
    assert.equal(dom.window.getAutosaveCalls(), 1);
    dom.window.applyMood(mood, false, false);
    assert.equal(dom.window.getAutosaveCalls(), 1);
  } finally {
    dom.window.close();
  }
});

test("Litrus style randomization preserves the automatic contrast setting", () => {
  const start = editor.indexOf("function randomizeSecondaryControls(){");
  const marker = editor.indexOf("let generatedDefaultDesign", start);
  const end = editor.lastIndexOf("}", marker) + 1;
  assert.ok(start >= 0 && end > start);
  const control = () => ({ options: { length: 3 }, selectedIndex: 0, value: "" });
  const fixC = { checked: false };
  const randomize = new Function(
    "cRad", "cSp", "cHeart", "cRate", "cSale", "cBag", "selScroll", "fixC",
    `${editor.slice(start, end)}\nreturn randomizeSecondaryControls;`
  )(control(), control(), control(), control(), control(), control(), control(), fixC);

  randomize();
  assert.equal(fixC.checked, false, "random style choices must not disable auto-fix");
  fixC.checked = true;
  randomize();
  assert.equal(fixC.checked, true, "random style choices must preserve auto-fix");
});
