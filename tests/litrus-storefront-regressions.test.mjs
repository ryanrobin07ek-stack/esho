import assert from "node:assert/strict";
import { readFile as readFileRaw } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";

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
      option1_name: "Size",
      option2_name: "Color",
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

test("published services shops show no bag control in the header of any baked page", () => {
  const dom = new JSDOM("", { url: "https://shop.example/", runScripts: "outside-only" });
  const header = '<header class="sole-header"><nav class="sp-nav"><a href="#" data-go="shop">All products</a></nav><a class="sole-cart-button" href="#" data-go="cart" aria-label="Shopping bag, 0 items"><span>Bag <b data-cartn>0</b></span></a></header>';
  const page = body => header + '<main class="sp-main">' + body + '</main>';
  const data = {
    shop: { key: "example", products: [] },
    pages: {
      home: page('<section class="prods"></section>'),
      shop: page('<div class="sp-top"><h1></h1><p></p></div><section class="prods"></section>'),
      "c/template": page('<section class="prods"></section>'),
      "p/template": page('<div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p></div></div>')
    },
    shell: { head: header, foot: "", tail: "" },
    templates: { productCard: '<article data-pid=""><h2 class="p-title"></h2><button class="p-btn" data-act="addqty">Add to bag</button></article>' }
  };
  const catalog = {
    categories: [{ id: 8, name: "Haircuts" }],
    products: [{ id: 5, name: "Cut", price: 500, category_id: 8, images: [], booking_enabled: true, duration_minutes: 45 }],
    store: { name: "Salon", currency: "KES", offer_type: "services" }
  };
  try {
    dom.window.eval(runtime);
    dom.window.litrusRefreshPublishedCatalog(data, catalog);
    const html = [data.shell.head, ...Object.values(data.pages)];
    assert.ok(Object.keys(data.pages).length >= 4);
    for (const markup of html) {
      const doc = new dom.window.DOMParser().parseFromString(markup, "text/html");
      assert.equal(doc.querySelector('[data-go="cart"]'), null, "no control leads to the empty cart");
      assert.equal(doc.querySelector("[data-cartn]"), null);
      assert.doesNotMatch(doc.body.textContent, /Bag/);
    }
    const button = new dom.window.DOMParser().parseFromString(data.pages.home, "text/html").querySelector(".sole-cart-button");
    assert.equal(button.textContent, "Book");
    assert.equal(button.dataset.go, "shop");
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
    assert.equal(requests[0].body.duration_minutes, 45, "the length the customer was shown is sent with the request");
    assert.deepEqual(Object.keys(requests[0].body).sort(), [
      "customer_email", "customer_name", "customer_phone", "duration_minutes", "idempotency_key", "service_id", "starts_at"
    ], "nothing beyond what the Worker's appointment endpoint reads is sent");
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
    }, {
      id: 44, name: "Honey Cereal", price: 400, category_id: 9,
      images: ["/cereal.jpg"], option1_name: "Pack size", option2_name: "Flavor",
      variants: [{
        id: "cereal-500-honey",
        option1_name: "Pack size", option1_value: "500 g",
        option2_name: "Flavor", option2_value: "Honey",
        price: 450, stock: 3
      }],
      taxonomy_category_name: "Food", taxonomy_attributes: [], stock: 3
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
    assert.equal(root.querySelector('[data-catalog-filter="size"]'), null,
      "Products with different option names should not get a misleading combined filter.");
    assert.equal(root.querySelector('[data-pid="42"]').dataset.sizes, "7|8");
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
      id: "42", q: 1, variantId: "8-black", size: "8", color: "Black",
      option1_name: "Size", option2_name: "Color", price: 2700
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
    assert.match(root.textContent, /1 \u00d7 City Sneaker \(Size: 8 \/ Color: Black\)/);
    assert.match(root.textContent, /KES 2,700/);

    controller.go("p/44");
    const cerealPicker = root.querySelector("[data-product-variant-picker]");
    assert.match(cerealPicker.textContent, /Pack size/);
    assert.match(cerealPicker.textContent, /Flavor/);
    cerealPicker.querySelector('[data-variant-option="size"]').value = "500 g";
    cerealPicker.querySelector('[data-variant-option="color"]').value = "Honey";
    cerealPicker.querySelector('[data-variant-option="color"]').dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(root.querySelector(".sp-price").textContent, "KES 450");
    root.querySelector('[data-act="addqty"]').click();
    controller.go("cart");
    assert.match(root.textContent, /Pack size: 500 g \/ Flavor: Honey/);
    assert.deepEqual(JSON.parse(window.localStorage.getItem("sp:example:cart")), [{
      id: "44", q: 1, variantId: "cereal-500-honey", size: "500 g", color: "Honey",
      option1_name: "Pack size", option2_name: "Flavor", price: 450
    }]);
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
    <button id="editProdSave"></button><p id="wCategoriesHint"></p><span id="wOfferPrompt"></span>
  `, { runScripts: "outside-only" });

  try {
    dom.window.eval(`
      var SHOP = {}, craftIntegrated = false;
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

test("Litrus new Craft drafts get different saved style defaults", () => {
  const start = editor.indexOf("window.litrusSetCraftCatalog=function(payload){");
  const end = editor.indexOf("\nwindow.litrusGetCraftPublishPayload=function", start);
  const randomMood = editor.match(/const randomDraftMood=\(\)=>R\(MOODS\.slice\(0,8\)\);/)?.[0];
  assert.ok(start >= 0 && end > start);
  assert.ok(randomMood);
  const hydrate = editor.slice(start, end);
  const ids = [...new Set([...hydrate.matchAll(/\bg\('([^']+)'\)/g)].map(match => match[1]))];
  const dom = new JSDOM(
    `${ids.map(id => `<input id="${id}">`).join("")}<div id="wMoods"></div><div id="wTweak"></div>`,
    { runScripts: "outside-only" }
  );

  try {
    dom.window.eval(`
      const g = id => document.getElementById(id);
      const MOODS = [{ n: "Style A" }, { n: "Style B" }, { n: "Style C" }];
      let mood = null, step = 1, designDraftId = "", generatedDefaultDesign = false;
      let existingSitePreviewHtml = "", existingSitePreviewDirty = false;
      let SHOP = { categoriesPosition: "after-products" }, prods = [];
      const MAX_CATEGORIES = 30, MAX_PRODUCTS = 100, craftIntegrated = true;
      const R = values => values[Math.floor(Math.random() * values.length)];
      const randomValues = [0.1, 0.9];
      Math.random = () => randomValues.shift() ?? 0;
      ${randomMood}
      const applyRecipe = () => false, applyOfferTypeUI = () => {};
      const setCategoryNames = () => {}, read = () => {}, drawProds = () => {};
      const render = () => {}, previewVisible = () => false, sync = () => {};
      const setSaved = () => {}, apply = selected => { mood = selected; }, autosave = () => {};
      const mb = g("wMoods");
      ${hydrate}
      window.getSelectedMood = () => mood?.n;
      window.getCategoryPosition = () => SHOP.categoriesPosition;
      window.getDraftId = () => designDraftId;
      window.clearSelectedMood = () => { mood = null; };
      window.getExistingPreviewHtml = () => existingSitePreviewHtml;
    `);
    const categories = ["Shoes", "Bags", "New", "Sale"].map((name, index) => ({ id: index + 1, name }));
    const products = categories.map((category, index) => ({
      id: index + 1, name: `Draft product ${index + 1}`, price: 100 + index,
      category_names: [category.name], images: []
    }));

    const first = dom.window.litrusSetCraftCatalog({
      shop: { name: "Draft one", is_new_shop_draft: true, draft_id: "draft-1" },
      categories,
      products
    });
    const firstStyle = dom.window.getSelectedMood();
    const second = dom.window.litrusSetCraftCatalog({
      shop: { name: "Draft two", is_new_shop_draft: true, draft_id: "draft-2" },
      categories,
      products
    });

    assert.equal(first.products, 4);
    assert.equal(first.categories, 4);
    assert.equal(second.products, 4);
    assert.equal(second.categories, 4);
    assert.equal(firstStyle, "Style A");
    assert.equal(dom.window.getSelectedMood(), "Style C");
    assert.notEqual(firstStyle, dom.window.getSelectedMood());
    assert.equal(dom.window.getDraftId(), "draft-2");
    assert.equal(dom.window.getCategoryPosition(), "after-hero");

    dom.window.clearSelectedMood();
    dom.window.litrusSetCraftCatalog({
      shop: { name: "Existing site", is_new_shop_draft: false },
      categories,
      products,
      existing_html: '<!doctype html><html><head><meta name="eshop-filled-theme" content="litrus-mixer"></head><body><main>Saved shop</main></body></html>'
    });
    assert.equal(dom.window.getSelectedMood(), undefined);
    assert.match(dom.window.getExistingPreviewHtml(), /<main>Saved shop<\/main>/);
  } finally {
    dom.window.close();
  }
});

test("Litrus mood choices autosave without overwriting existing recipes", () => {
  const start = editor.indexOf("function apply(md,randomizeDetails=true,persist=true){");
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

test("Litrus existing-site preview keeps saved visuals but removes executable content", () => {
  const previewSource = editor.match(/function savedSitePreviewDocument\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(previewSource);
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  try {
    const buildPreview = new Function(
      "existingSitePreviewHtml",
      "DOMParser",
      `${previewSource}\nreturn savedSitePreviewDocument;`
    )(
      '<!doctype html><html><head><style>.current-look{color: red}</style></head><body><main class="current-look">Current storefront</main><img src="/shop.png" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">Link</a><iframe src="https://example.com"></iframe></body></html>',
      dom.window.DOMParser
    );
    const preview = buildPreview();

    assert.match(preview, /class="current-look"/);
    assert.match(preview, /\.current-look\{color: red\}/);
    assert.match(preview, /src="\/shop\.png"/);
    assert.doesNotMatch(preview, /<script|<iframe|onerror=|javascript:/i);
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

// ---------------------------------------------------------------------------
// Checkout: variants, the customer's own holds, discount codes, price guard
// ---------------------------------------------------------------------------
const HOLD_ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const OTHER_HOLD_ID = "7a1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e60";
const response = (status, payload) => ({ ok: status < 400, status, async json() { return payload; } });
const checkoutForm = '<form id="spco"><input name="name" value="Sam Shop"><input name="phone" value="+254700000001">' +
  '<input name="email" value="sam@example.test"><input name="town" value="Nairobi"><textarea name="addr">12 Market Street</textarea>' +
  '<div class="sp-radios"><label><input type="radio" name="pay" value="Cash on delivery or pickup" checked></label></div>' +
  '<input type="radio" name="dm" value="delivery" checked><input name="via" value="none"><p class="sp-err"></p>' +
  '<button type="submit">Place order</button></form>' +
  '<aside class="sp-sum" id="spSum"><div class="sp-row sp-total"><span>Total</span><b>KES 2,700</b></div></aside>';
const sneaker = {
  id: 42, name: "City Sneaker", price: 2500, images: [], stock: 9,
  option1_name: "Size", option2_name: "Color",
  variants: [
    { id: "7-black", size: "7", color: "Black", price: null, stock: 2 },
    { id: "8-black", size: "8", color: "Black", price: 2700, stock: 1 }
  ]
};
const variantCartLine = {
  id: "42", q: 1, variantId: "8-black", size: "8", color: "Black",
  option1_name: "Size", option2_name: "Color", price: 2700
};

function mountCheckout({ cart = [variantCartLine], holds = [], products = [sneaker], handler, pay = "Cash on delivery or pickup", paystackConnected = true, email = "sam@example.test" } = {}) {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/#/checkout", runScripts: "outside-only" });
  const { window } = dom;
  const root = window.document.getElementById("store");
  root.innerHTML = checkoutForm.replace('name="email" value="sam@example.test"', `name="email" value="${email}"`);
  const requests = [];
  const events = [];
  window.__ESHOP_THEME_CATALOG__ = {
    store: { name: "Main shop", currency: "KES", delivery_fee: 0, ...(paystackConnected === null ? {} : { paystack_connected: paystackConnected ? 1 : 0 }) }, products, categories: []
  };
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = (id, type, count) => events.push({ id, type, count });
  window.SPD = { shop: { key: "main", name: "Main shop", products: [] }, pages: {}, shell: {}, templates: {} };
  window.localStorage.setItem("sp:main:cart", JSON.stringify(cart));
  if (holds.length) window.localStorage.setItem("eshop-holds:shop.example", JSON.stringify(holds));
  let uuid = 0;
  Object.defineProperty(window.crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`
  });
  window.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    requests.push({ url, body });
    return handler(url, body, requests);
  };
  window.SPRT = options => {
    options.after(root, "checkout");
    return {};
  };
  window.eval(runtime);
  window.litrusStartLiveStore(window.SPD);
  const form = root.querySelector("#spco");
  form.querySelector(`input[name="pay"][value="${pay}"]`).checked = true;
  form.querySelectorAll('input[name="pay"]').forEach(input => {
    if (input.value !== pay) input.checked = false;
  });
  return {
    window, root, form, requests, events,
    async submit() {
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await pause(5);
    }
  };
}

const orderResponse = (extra = {}) => response(201, {
  order: {
    order_number: "ORD-0123456789ABCDEF", currency: "KES", subtotal: 2700, discount: 0, shipping: 0, total: 2700,
    items: [{ product_id: "42", name: "City Sneaker", quantity: 1, unit_price: 2700 }],
    ...extra.order
  },
  ...(extra.top || {})
});

test("Litrus checkout sends the chosen variant, the customer's own hold and the discount code", async () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const harness = mountCheckout({
    holds: [
      { id: HOLD_ID, product_id: "42", quantity: 1, expires_at: future, customer_name: "  sam   SHOP ", contact: "Sam@Example.test" },
      { id: OTHER_HOLD_ID, product_id: "99", quantity: 1, expires_at: future, customer_name: "Sam Shop", contact: "sam@example.test" },
      { id: "8b1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e61", product_id: "42", quantity: 1, expires_at: "2020-01-01T00:00:00.000Z", customer_name: "Sam Shop", contact: "sam@example.test" },
      { id: "9c1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e62", product_id: "42", quantity: 1, expires_at: future, customer_name: "Someone Else", contact: "sam@example.test" },
      { id: "not-a-uuid", product_id: "42", quantity: 1, expires_at: future, customer_name: "Sam Shop", contact: "sam@example.test" }
    ],
    handler: url => url === "/api/discounts/validate"
      ? response(200, { valid: true, code: "SAVE10", discount_cents: 27000, discount: 270 })
      : orderResponse({ order: { discount: 270, total: 2430 }, top: { discount_cents: 27000 } })
  });
  try {
    const field = harness.form.elements.namedItem("discount_code");
    assert.ok(field, "the checkout should offer a discount code field");
    field.value = " save 10 ";
    harness.form.querySelector("[data-discount-apply]").click();
    await pause(5);
    assert.equal(field.value, "SAVE10");
    assert.deepEqual(harness.requests[0], {
      url: "/api/discounts/validate",
      body: { code: "SAVE10", items: [{ product_id: "42", quantity: 1, variant_id: "8-black" }] }
    }, "the preview check sends the cart lines and the variant, never a price");
    assert.match(harness.form.querySelector(".sp-discount-status").textContent, /Discount applied: .?KES 270/);
    assert.match(harness.root.querySelector(".sp-total").textContent, /KES 2,430/, "the total drops before the order is placed");

    await harness.submit();
    const orders = harness.requests.filter(request => request.url === "/api/orders");
    assert.equal(orders.length, 1);
    const { url, body } = orders[0];
    assert.equal(url, "/api/orders");
    assert.deepEqual(body.items, [{
      product_id: "42", quantity: 1, variant_id: "8-black",
      option1_name: "Size", option1_value: "8", option2_name: "Color", option2_value: "Black",
      variant_label: "Size: 8 / Color: Black"
    }]);
    assert.ok(!("price" in body.items[0]), "the client must never send a price");
    assert.deepEqual(body.hold_ids, [HOLD_ID], "only the customer's own live hold for a cart product is claimed");
    assert.equal(body.discount_code, "SAVE10");
    assert.match(harness.root.textContent, /Discount \(SAVE10\): -270 KES/);
    assert.match(harness.root.textContent, /1 x City Sneaker \(Size: 8 \/ Color: Black\)/);
    assert.match(harness.root.textContent, /Total: 2430 KES/);
    const remaining = JSON.parse(harness.window.localStorage.getItem("eshop-holds:shop.example")).map(hold => hold.id);
    assert.ok(!remaining.includes(HOLD_ID), "a hold used by an order is forgotten");
    assert.ok(remaining.includes(OTHER_HOLD_ID));
    assert.deepEqual(harness.events, [
      { id: "42", type: "checkout_start", count: 1 },
      { id: "42", type: "purchase", count: 1 }
    ]);
  } finally {
    harness.window.close();
  }
});

test("Litrus checkout shows the server discount before payment and counts the purchase only when paid", async () => {
  const harness = mountCheckout({
    pay: "paystack",
    handler: url => url === "/api/orders"
      ? orderResponse({ order: { discount: 270, total: 2430 }, top: { discount_cents: 27000 } })
      : response(200, { authorization_url: "https://evil.example/pay" })
  });
  try {
    harness.form.elements.namedItem("discount_code").value = "save10";
    await harness.submit();
    const summary = harness.root.querySelector("#spSum");
    assert.match(summary.querySelector("[data-litrus-discount-row]").textContent, /Discount \(SAVE10\)−KES 270/);
    assert.match(summary.querySelector(".sp-total").textContent, /KES 2,430/);
    assert.match(harness.form.querySelector(".sp-discount-status").textContent, /Discount applied: −KES 270/);
    assert.match(harness.form.querySelector(".sp-err").textContent, /unsafe checkout link/);
    assert.deepEqual(JSON.parse(harness.window.localStorage.getItem("sp:main:pending-order")).items,
      [{ product_id: "42", quantity: 1 }]);
    assert.deepEqual(harness.events.map(event => event.type), ["checkout_start"],
      "starting a payment is not a purchase");
  } finally {
    harness.window.close();
  }

  const dom = new JSDOM('<div id="store"></div>', {
    url: "https://shop.example/#/checkout/confirmation?reference=ESHOP_" + "A".repeat(32) + "&orderId=ORD-0123456789ABCDEF",
    runScripts: "outside-only"
  });
  const { window } = dom;
  const events = [];
  window.__ESHOP_THEME_CATALOG__ = { store: { name: "Main shop", currency: "KES" }, products: [sneaker], categories: [] };
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = (id, type, count) => events.push({ id, type, count });
  window.SPD = { shop: { key: "main", name: "Main shop", products: [] }, pages: {}, shell: {}, templates: {} };
  window.localStorage.setItem("sp:main:pending-order", JSON.stringify({
    order_number: "ORD-0123456789ABCDEF", items: [{ product_id: "42", quantity: 2 }], hold_ids: [HOLD_ID]
  }));
  window.localStorage.setItem("eshop-holds:shop.example", JSON.stringify([{ id: HOLD_ID }, { id: OTHER_HOLD_ID }]));
  window.fetch = async () => response(200, { payment_status: "paid", order_number: "ORD-0123456789ABCDEF" });
  window.document.getElementById("store").innerHTML = "";
  try {
    window.eval(runtime);
    window.litrusStartLiveStore(window.SPD);
    await pause(5);
    assert.deepEqual(events, [{ id: "42", type: "purchase", count: 2 }]);
    assert.equal(window.localStorage.getItem("sp:main:pending-order"), null);
    assert.deepEqual(JSON.parse(window.localStorage.getItem("eshop-holds:shop.example")), [{ id: OTHER_HOLD_ID }]);
    assert.equal(window.localStorage.getItem("sp:main:cart"), "[]");
    window.litrusStartLiveStore(window.SPD);
    await pause(5);
    assert.equal(events.length, 1, "refreshing the confirmation page must not count the purchase twice");
  } finally {
    window.close();
  }
});

test("Litrus checkout never takes payment when the shop prices the order differently from the cart", async () => {
  const harness = mountCheckout({
    pay: "paystack",
    // A Worker that ignores variant ids charges the base price (2500) instead of 2700.
    handler: () => orderResponse({ order: { subtotal: 2500, total: 2500 } })
  });
  try {
    await harness.submit();
    assert.deepEqual(harness.requests.map(request => request.url), ["/api/orders"],
      "payment must not be initialised for a mispriced order");
    assert.match(harness.form.querySelector(".sp-err").textContent, /priced your items at KES 2,500 but your cart shows KES 2,700/);
    assert.equal(harness.form.querySelector('button[type="submit"]').disabled, false);
    assert.equal(harness.window.localStorage.getItem("sp:main:pending-order"), null);
  } finally {
    harness.window.close();
  }
});

test("Litrus checkout stops when a typed discount code is not applied by the shop", async () => {
  const harness = mountCheckout({ pay: "paystack", handler: () => orderResponse() });
  try {
    harness.form.elements.namedItem("discount_code").value = "NOPE10";
    await harness.submit();
    assert.deepEqual(harness.requests.map(request => request.url), ["/api/orders"]);
    assert.match(harness.form.querySelector(".sp-err").textContent, /code NOPE10 could not be applied/);
    assert.equal(harness.form.querySelector("[data-litrus-discount-row]"), null);

    harness.form.elements.namedItem("discount_code").value = "bad code!";
    await harness.submit();
    assert.equal(harness.requests.length, 1, "a malformed code is rejected before any request");
    assert.match(harness.form.querySelector(".sp-err").textContent, /does not look right/);
  } finally {
    harness.window.close();
  }
});

test("Litrus checkout drops an expired reservation and retries instead of blocking the order", async () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const harness = mountCheckout({
    holds: [{ id: HOLD_ID, product_id: "42", quantity: 1, expires_at: future, customer_name: "Sam Shop", contact: "sam@example.test" }],
    handler: (url, body) => body.hold_ids
      ? response(409, { error: "One of these holds is expired or does not match your name and contact details." })
      : orderResponse()
  });
  try {
    await harness.submit();
    assert.equal(harness.requests.length, 2);
    assert.deepEqual(harness.requests[0].body.hold_ids, [HOLD_ID]);
    assert.ok(!("hold_ids" in harness.requests[1].body));
    assert.notEqual(harness.requests[0].body.idempotency_key, harness.requests[1].body.idempotency_key);
    assert.deepEqual(JSON.parse(harness.window.localStorage.getItem("eshop-holds:shop.example")), []);
    assert.match(harness.root.textContent, /ORD-0123456789ABCDEF/);
  } finally {
    harness.window.close();
  }
});

test("Litrus checkout keeps plain orders unchanged when no variant, hold or code is involved", async () => {
  const harness = mountCheckout({
    cart: [{ id: "42", q: 2 }],
    products: [{ id: 42, name: "City Sneaker", price: 2500, images: [], stock: 9 }],
    handler: () => orderResponse({ order: { subtotal: 5000, total: 5000, items: [{ product_id: "42", name: "City Sneaker", quantity: 2, unit_price: 2500 }] } })
  });
  try {
    await harness.submit();
    assert.deepEqual(harness.requests[0].body.items, [{ product_id: "42", quantity: 2 }]);
    assert.ok(!("hold_ids" in harness.requests[0].body));
    assert.ok(!("discount_code" in harness.requests[0].body));
  } finally {
    harness.window.close();
  }
});

test("Litrus checkout offers Paystack and requires an email only when the shop has Paystack connected", async () => {
  const connected = mountCheckout({ email: "", pay: "paystack", handler: () => orderResponse() });
  try {
    const paystack = connected.form.querySelector('input[name="pay"][value="paystack"]');
    assert.ok(paystack, "a connected shop offers Paystack");
    assert.equal(paystack.checked, true, "a connected shop preselects Paystack");
    assert.equal(connected.form.elements.namedItem("email").required, true);
    await connected.submit();
    assert.equal(connected.requests.length, 0, "Paystack needs an email for the receipt, so nothing is sent without one");
    assert.match(connected.form.querySelector(".sp-err").textContent, /email address for your Paystack receipt/);

    // Choosing another way to pay makes the email optional again.
    const cash = connected.form.querySelector('input[name="pay"][value="Cash on delivery or pickup"]');
    cash.checked = true;
    cash.dispatchEvent(new connected.window.Event("change", { bubbles: true }));
    assert.equal(connected.form.elements.namedItem("email").required, false);
    await connected.submit();
    assert.equal(connected.requests.length, 1);
    assert.ok(!("customer_email" in connected.requests[0].body), "a blank email is left out, not sent empty");
    assert.equal(connected.requests[0].body.payment_method, "manual");
    assert.doesNotMatch(connected.root.textContent, /Email:/, "the order summary has no empty email line");
  } finally {
    connected.window.close();
  }

  const notConnected = mountCheckout({ paystackConnected: false, email: "", handler: () => orderResponse() });
  try {
    assert.equal(notConnected.form.querySelector('input[name="pay"][value="paystack"]'), null,
      "a shop without Paystack never shows it");
    assert.equal(notConnected.form.querySelector('input[name="pay"]:checked').value, "Cash on delivery or pickup");
    assert.equal(notConnected.form.elements.namedItem("email").required, false);
    await notConnected.submit();
    assert.equal(notConnected.requests.length, 1);
    assert.ok(!("customer_email" in notConnected.requests[0].body));
    assert.ok(!notConnected.requests.some(request => request.url.includes("/paystack/")),
      "no payment is started for a shop without Paystack");
  } finally {
    notConnected.window.close();
  }

  // An older Worker does not publish the flag: keep the original behaviour (Paystack offered and
  // preselected, email required for every order) because that Worker rejects orders without an email.
  const unknown = mountCheckout({ paystackConnected: null, email: "", pay: "paystack", handler: () => orderResponse() });
  try {
    const paystack = unknown.form.querySelector('input[name="pay"][value="paystack"]');
    assert.ok(paystack, "an unknown connection state still offers Paystack");
    assert.equal(paystack.checked, true);
    const cash = unknown.form.querySelector('input[name="pay"][value="Cash on delivery or pickup"]');
    cash.checked = true;
    cash.dispatchEvent(new unknown.window.Event("change", { bubbles: true }));
    assert.equal(unknown.form.elements.namedItem("email").required, true, "email stays required without the flag");
    await unknown.submit();
    assert.equal(unknown.requests.length, 0, "no order is sent that the older Worker would reject");
    assert.match(unknown.form.querySelector(".sp-err").textContent, /email address so the shop can confirm/);
  } finally {
    unknown.window.close();
  }

  const badEmail = mountCheckout({ paystackConnected: false, email: "not-an-email", handler: () => orderResponse() });
  try {
    await badEmail.submit();
    assert.equal(badEmail.requests.length, 0);
    assert.match(badEmail.form.querySelector(".sp-err").textContent, /email address does not look right/);
  } finally {
    badEmail.window.close();
  }
});

test("Litrus checkout explains an email-less order the shop could not accept", async () => {
  const harness = mountCheckout({
    paystackConnected: false, email: "",
    handler: () => response(400, { error: "Order needs an idempotency key, customer details, delivery method and at least one item." })
  });
  try {
    await harness.submit();
    assert.match(harness.form.querySelector(".sp-err").textContent, /without an email address/);
    assert.equal(harness.form.querySelector('button[type="submit"]').disabled, false);
    assert.equal(harness.form.elements.namedItem("email").required, true,
      "after a refusal the email is asked for up front instead of failing again");
    await harness.submit();
    assert.equal(harness.requests.length, 1, "the second attempt is held until an email is entered");
    assert.match(harness.form.querySelector(".sp-err").textContent, /Enter your email address/);
  } finally {
    harness.window.close();
  }
});

test("Litrus checkout shows why a discount code was refused and lets the customer carry on", async () => {
  const harness = mountCheckout({
    paystackConnected: false,
    handler: (url, body) => url === "/api/discounts/validate"
      ? response(200, { valid: false, error: "That discount code has expired." })
      : body.discount_code
        ? response(409, { error: "That discount code has reached its usage limit.", error_code: "discount_invalid" })
        : orderResponse({ order: { subtotal: 2700, total: 2700 } })
  });
  try {
    const field = harness.form.elements.namedItem("discount_code");
    field.value = "old10";
    harness.form.querySelector("[data-discount-apply]").click();
    await pause(5);
    assert.match(harness.form.querySelector(".sp-discount-status").textContent, /has expired/);
    assert.equal(harness.form.querySelector("[data-litrus-discount-row]"), null);
    assert.equal(harness.root.querySelector(".sp-total b").textContent, "KES 2,700");

    await harness.submit();
    const orders = () => harness.requests.filter(request => request.url === "/api/orders");
    assert.equal(orders().length, 1);
    assert.equal(orders()[0].body.discount_code, "OLD10");
    assert.match(harness.form.querySelector(".sp-err").textContent, /usage limit.*Clear the code or try another/);
    assert.match(harness.form.querySelector(".sp-discount-status").textContent, /usage limit/);
    assert.equal(harness.form.querySelector('button[type="submit"]').disabled, false);
    assert.equal(harness.root.querySelector("[data-litrus-discount-row]"), null);

    field.value = "";
    await harness.submit();
    assert.equal(orders().length, 2);
    assert.ok(!("discount_code" in orders()[1].body));
    assert.match(harness.root.textContent, /ORD-0123456789ABCDEF/);
  } finally {
    harness.window.close();
  }
});

test("Litrus discount preview survives an older Worker, a dropped connection and later edits to the code", async () => {
  const older = mountCheckout({ paystackConnected: false, handler: () => response(404, { error: "Not found." }) });
  try {
    older.form.elements.namedItem("discount_code").value = "save10";
    older.form.querySelector("[data-discount-apply]").click();
    await pause(5);
    assert.match(older.form.querySelector(".sp-discount-status").textContent, /SAVE10 added.*shop checks it when you place your order/);
  } finally {
    older.window.close();
  }

  let offlineWindow;
  const offline = mountCheckout({
    paystackConnected: false,
    handler: () => { throw new offlineWindow.TypeError("Failed to fetch"); }
  });
  offlineWindow = offline.window;
  try {
    offline.form.elements.namedItem("discount_code").value = "SAVE10";
    offline.form.querySelector("[data-discount-apply]").click();
    await pause(5);
    assert.match(offline.form.querySelector(".sp-discount-status").textContent, /Could not reach the shop/);
    assert.equal(offline.form.querySelector("[data-discount-apply]").disabled, false);
  } finally {
    offline.window.close();
  }

  const harness = mountCheckout({
    paystackConnected: false,
    handler: () => response(200, { valid: true, code: "SAVE10", discount_cents: 27000, discount: 270 })
  });
  try {
    const field = harness.form.elements.namedItem("discount_code");
    field.value = "SAVE10";
    harness.form.querySelector("[data-discount-apply]").click();
    await pause(5);
    assert.equal(harness.root.querySelector(".sp-total b").textContent, "KES 2,430");
    field.value = "SAVE11";
    field.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(harness.root.querySelector("[data-litrus-discount-row]"), null, "editing the code drops the previewed discount");
    assert.equal(harness.root.querySelector(".sp-total b").textContent, "KES 2,700", "and restores the original total");
  } finally {
    harness.window.close();
  }
});

test("Litrus checkout tells the customer when the chosen option is no longer sold", async () => {
  const harness = mountCheckout({
    paystackConnected: false,
    handler: () => response(409, { error: "That option of City Sneaker is no longer available.", error_code: "variant_unavailable" })
  });
  try {
    await harness.submit();
    assert.match(harness.form.querySelector(".sp-err").textContent, /no longer available.*choose an option/i);
    assert.equal(harness.form.querySelector('button[type="submit"]').disabled, false);
  } finally {
    harness.window.close();
  }
});

test("Litrus analytics only reports real catalogue product ids, including renamed old ids", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const events = [];
  window.__ESHOP_THEME_CATALOG__ = {
    categories: [], store: { name: "Example", currency: "KES" },
    products: [{ id: 42, name: "City Sneaker", price: 2500, images: [] }]
  };
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = (id, type, count) => events.push({ id, type, count });
  const data = {
    shop: { key: "example", products: [{ id: "old-template-id", name: "City Sneaker", num: 2500 }] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section></main>',
      shop: '<main class="sp-main"><section class="prods"></section></main>'
    },
    shell: { head: "", foot: "", tail: "" },
    templates: { productCard: '<article data-pid=""><button data-add="">Add</button></article>' }
  };
  let afterRoute;
  window.SPRT = options => {
    afterRoute = route => options.after(window.document.getElementById("store"), route);
    return {};
  };
  try {
    window.eval(runtime);
    window.litrusStartLiveStore(data);
    assert.equal(data.shop.productAliases["old-template-id"], "42");
    afterRoute("p/42");
    afterRoute("p/old-template-id");
    afterRoute("p/not-in-the-catalogue");
    assert.deepEqual(events, [{ id: "42", type: "view", count: 1 }, { id: "42", type: "view", count: 1 }]);
  } finally {
    window.close();
  }
});

test("storefront analytics sends funnel events separately and drops batches the Worker rejects", async () => {
  const analytics = await readFile(new URL("../public/storefront-analytics.js", import.meta.url), "utf8");
  const dom = new JSDOM("", { url: "https://shop.example/#/home", runScripts: "outside-only" });
  const { window } = dom;
  const calls = [];
  let funnelStatus = 400;
  Object.defineProperty(window.document, "visibilityState", { get: () => "hidden" });
  window.fetch = async (url, options) => {
    const items = JSON.parse(options.body).items;
    calls.push(items);
    const funnel = items.some(item => ["checkout_start", "purchase", "booking_submitted"].includes(item.type));
    return { ok: !funnel || funnelStatus < 400, status: funnel ? funnelStatus : 202, async json() { return {}; } };
  };
  try {
    window.eval(analytics);
    window.__ESHOP_TRACK_STOREFRONT_EVENT__("42", "view");
    window.__ESHOP_TRACK_STOREFRONT_EVENT__("42", "purchase", 2);
    window.__ESHOP_TRACK_STOREFRONT_EVENT__("42", "checkout_start");
    window.__ESHOP_TRACK_STOREFRONT_EVENT__("42", "booking_submitted");
    window.__ESHOP_TRACK_STOREFRONT_EVENT__("42", "made_up_event");
    window.dispatchEvent(new window.Event("pagehide"));
    await pause(20);
    assert.equal(calls.length, 2, "legacy and funnel events travel in separate batches");
    assert.deepEqual(calls[0], [{ product_id: "42", type: "view", n: 1 }]);
    assert.deepEqual(calls[1].map(item => item.type).sort(), ["booking_submitted", "checkout_start", "purchase"]);
    assert.deepEqual(JSON.parse(window.localStorage.getItem("eshop:storefront-events:v1:shop.example")), [],
      "a 400 for funnel events must not leave the queue blocked");

    funnelStatus = 503;
    window.__ESHOP_TRACK_STOREFRONT_EVENT__("42", "purchase");
    window.dispatchEvent(new window.Event("pagehide"));
    await pause(20);
    assert.deepEqual(JSON.parse(window.localStorage.getItem("eshop:storefront-events:v1:shop.example")),
      [{ product_id: "42", type: "purchase", n: 1 }], "a temporary failure keeps the event for retry");
  } finally {
    window.close();
  }
});

// ---------------------------------------------------------------------------
// Service booking customer path
// ---------------------------------------------------------------------------
function mountServiceBooking({ handler, deposit = 0, shop = {}, beforeStart = null } = {}) {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const requests = [];
  const events = [];
  window.__ESHOP_THEME_CATALOG__ = {
    categories: [],
    products: [{ id: 42, name: "Deep tissue massage", price: 2500, images: [], duration_minutes: 45 }],
    store: {
      name: "Calm Studio", currency: "KES", offer_type: "services", service_timezone: "Africa/Nairobi",
      service_deposit_percent: deposit, ...shop
    }
  };
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = (id, type, count) => events.push({ id, type, count });
  window.SPD = {
    shop: { key: "calm", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section></main>',
      shop: '<main class="sp-main"><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"></div></div></div></main>'
    },
    shell: { head: "", foot: "", tail: "" },
    templates: { productCard: '<article data-pid=""></article>' }
  };
  window.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options?.method || "GET", body: options?.body ? JSON.parse(options.body) : null });
    return handler(String(url), options, requests);
  };
  window.SPRT = options => {
    window.document.getElementById("store").innerHTML = options.page("p/42");
    options.after(window.document.getElementById("store"), "p/42");
    return {};
  };
  if (beforeStart) beforeStart(window);
  window.eval(runtime);
  window.litrusStartLiveStore(window.SPD);
  events.length = 0; // the page view from rendering the service page is not part of these checks
  const form = window.document.querySelector("[data-litrus-service-booking-form]");
  const fill = () => {
    form.elements.namedItem("customer_name").value = "Sam Customer";
    form.elements.namedItem("customer_email").value = "sam@example.test";
    form.elements.namedItem("customer_phone").value = "+254 700 000000";
  };
  const chooseDate = async date => {
    form.elements.namedItem("date").value = date;
    form.elements.namedItem("date").dispatchEvent(new window.Event("change", { bubbles: true }));
    await pause(5);
  };
  const submit = async () => {
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await pause(5);
  };
  return { window, form, requests, events, fill, chooseDate, submit, status: () => form.querySelector(".sp-service-booking-status") };
}
const futureDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
const slotTime = new Date(Date.now() + 3 * 86_400_000).toISOString().replace(/T.*/, "T07:00:00.000Z");

test("Litrus service booking loads slots when a date is chosen and explains empty, closed and failed days", async () => {
  const answers = [
    response(200, { slots: [] }),
    response(500, {}),
    response(200, { slots: [{ starts_at: slotTime, label: "10:00 AM" }] })
  ];
  const booking = mountServiceBooking({ handler: () => answers.shift() });
  try {
    assert.ok(booking.form.elements.namedItem("date").min, "past dates are not offered");
    await booking.chooseDate(futureDate);
    assert.equal(booking.requests[0].url.split("?")[0], "/api/service-appointments/availability");
    assert.match(booking.requests[0].url, /service_id=42/);
    assert.match(booking.status().textContent, /closed that day or fully booked/i);
    assert.equal(booking.form.elements.namedItem("starts_at").disabled, true);

    await booking.chooseDate(futureDate.replace(/\d\d$/, "28"));
    assert.match(booking.status().textContent, /Request failed \(500\)/);
    assert.equal(booking.form.elements.namedItem("starts_at").selectedOptions[0].textContent, "Could not load times");
    assert.equal(booking.form.querySelector("[data-service-load-slots]").disabled, false);

    await booking.chooseDate(futureDate);
    const select = booking.form.elements.namedItem("starts_at");
    assert.equal(select.disabled, false);
    assert.deepEqual([...select.options].map(option => option.textContent), ["Choose a time", "10:00 AM"]);

    booking.form.elements.namedItem("date").value = "2001-01-01";
    booking.form.querySelector("[data-service-load-slots]").click();
    await pause(5);
    assert.match(booking.status().textContent, /today or a later date/i);
    assert.equal(booking.requests.length, 3, "a past date never reaches the Worker");
  } finally {
    booking.window.close();
  }
});

test("Litrus service booking never offers or sends a time that has already passed", async () => {
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const booking = mountServiceBooking({
    handler: () => response(200, { slots: [{ starts_at: past, label: "Earlier" }, { starts_at: slotTime, label: "10:00 AM" }] })
  });
  try {
    await booking.chooseDate(futureDate);
    const options = [...booking.form.elements.namedItem("starts_at").options].map(option => option.value).filter(Boolean);
    assert.deepEqual(options, [slotTime], "a slot in the past is dropped from the list");

    // A past date is refused before any request goes out.
    booking.requests.length = 0;
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await booking.chooseDate(yesterday);
    assert.equal(booking.requests.length, 0);
    assert.match(booking.status().textContent, /today or a later date/i);

    // A time that slipped into the past while the form was open is not submitted.
    const slots = booking.form.elements.namedItem("starts_at");
    const stale = booking.window.document.createElement("option");
    stale.value = past;
    slots.append(stale);
    slots.value = past;
    booking.form.elements.namedItem("date").value = futureDate;
    booking.fill();
    booking.requests.length = 0;
    await booking.submit();
    assert.ok(!booking.requests.some(request => request.url === "/api/service-appointments"), "no request is sent for a past time");
    assert.match(booking.status().textContent, /already passed/i);
  } finally {
    booking.window.close();
  }
});

test("Litrus service booking refuses to send a request without a chosen time or valid contact details", async () => {
  const booking = mountServiceBooking({ handler: () => response(201, {}) });
  try {
    booking.fill();
    await booking.submit();
    assert.equal(booking.requests.length, 0);
    assert.match(booking.status().textContent, /Choose a date, then pick one of the available times/);

    const time = booking.form.elements.namedItem("starts_at");
    const option = booking.window.document.createElement("option");
    option.value = slotTime;
    time.append(option);
    time.value = slotTime;
    booking.form.elements.namedItem("customer_phone").value = "call me";
    await booking.submit();
    assert.equal(booking.requests.length, 0);
    assert.match(booking.status().textContent, /phone number the shop can call/);
  } finally {
    booking.window.close();
  }
});

test("Litrus service booking recovers from a taken slot with a refreshed list and a clear message", async () => {
  const booking = mountServiceBooking({
    handler: (url, options) => options?.method === "POST"
      ? response(409, { error: "That time was just booked. Choose another available slot." })
      : response(200, { slots: [{ starts_at: "2030-01-02T09:00:00.000Z", label: "12:00 PM" }] })
  });
  try {
    booking.fill();
    booking.form.elements.namedItem("date").value = futureDate;
    const time = booking.form.elements.namedItem("starts_at");
    const option = booking.window.document.createElement("option");
    option.value = slotTime;
    time.append(option);
    time.value = slotTime;
    time.disabled = false;
    await booking.submit();
    await pause(5);
    assert.deepEqual(booking.requests.map(request => request.method), ["POST", "GET"],
      "a 409 reloads the day's available times");
    assert.match(booking.status().textContent, /That time was just booked/);
    assert.deepEqual([...time.options].map(item => item.textContent), ["Choose a time", "12:00 PM"]);
    assert.equal(time.value, "", "the taken slot is no longer selected");
    assert.equal(booking.form.querySelector(".sp-service-booking-confirmation"), null);
    assert.deepEqual(booking.events, []);
    assert.equal(booking.form.querySelector('button[type="submit"]').disabled, false);
  } finally {
    booking.window.close();
  }
});

test("Litrus service booking shows a request-received state with reference, deposit and contact options", async () => {
  const booking = mountServiceBooking({
    deposit: 20,
    shop: { whatsapp: "+254 711 222333", phone: "+254 700 111222", email: "hello@calm.example" },
    handler: () => response(201, { appointment: { id: "ab12cd34-0000-4000-8000-000000000001", service_name: "Deep tissue massage", starts_at: slotTime, status: "pending" } })
  });
  try {
    assert.match(booking.form.textContent, /20% deposit \(KES 500\) after the shop approves your time/);
    assert.match(booking.form.textContent, /The shop will confirm your request/);
    booking.fill();
    booking.form.elements.namedItem("date").value = futureDate;
    const time = booking.form.elements.namedItem("starts_at");
    const option = booking.window.document.createElement("option");
    option.value = slotTime;
    time.append(option);
    time.value = slotTime;
    await booking.submit();

    const panel = booking.form.querySelector(".sp-service-booking-confirmation");
    assert.ok(panel, "a confirmation panel replaces the form fields");
    assert.match(panel.textContent, /Request received/);
    assert.match(panel.textContent, /Nothing is booked until you hear back/);
    assert.match(panel.textContent, /Reference: AB12CD34/);
    assert.match(panel.textContent, /Requested time: .*2\d{3}/);
    assert.match(panel.textContent, /20% deposit \(KES 500\).*payment link once they approve/);
    assert.ok(panel.querySelector('a[href^="https://wa.me/254711222333"]'));
    assert.ok(panel.querySelector('a[href="tel:+254700111222"]'));
    assert.ok(panel.querySelector('a[href="mailto:hello@calm.example"]'));
    assert.equal(panel.querySelector('a[href*="checkout.paystack.com"]'), null, "no deposit link is invented");
    assert.match(booking.status().textContent, /request was sent to/i);
    assert.equal(booking.form.querySelector('[name="customer_name"]').closest("label").hidden, true);
    assert.deepEqual(booking.events, [{ id: "42", type: "booking_submitted", count: 1 }]);

    const saved = JSON.parse(booking.window.localStorage.getItem("eshop-appointments:shop.example"));
    assert.equal(saved[0].reference, "AB12CD34");
    assert.match(booking.form.parentNode.querySelector("[data-litrus-service-requests]").textContent,
      /Deep tissue massage.*Reference AB12CD34.*Waiting for the shop to confirm/);

    panel.querySelector("[data-service-new-request]").click();
    assert.equal(booking.form.querySelector(".sp-service-booking-confirmation"), null);
    assert.equal(booking.form.querySelector('[name="customer_name"]').closest("label").hidden, false);
    assert.equal(booking.status().textContent, "");
  } finally {
    booking.window.close();
  }
});

test("Litrus service booking links to a deposit only when the Worker returns a Paystack checkout link", async () => {
  const links = ["https://checkout.paystack.com/abc123", "https://evil.example/pay"];
  for (const link of links) {
    const booking = mountServiceBooking({
      deposit: 10,
      handler: () => response(200, { duplicate: true, appointment: { id: "cd34ef56-0000-4000-8000-000000000002", status: "confirmed", payment_authorization_url: link } })
    });
    try {
      booking.fill();
      const time = booking.form.elements.namedItem("starts_at");
      const option = booking.window.document.createElement("option");
      option.value = slotTime;
      time.append(option);
      time.value = slotTime;
      await booking.submit();
      const pay = booking.form.querySelector(".sp-service-booking-confirmation a.sp-btn");
      if (link.includes("checkout.paystack.com")) assert.equal(pay.href, link);
      else assert.equal(pay, null);
      assert.deepEqual(booking.events, [], "a replayed request is not counted as a new booking");
    } finally {
      booking.window.close();
    }
  }
});

test("Litrus service booking keeps one request key per request and issues a new one when the details change", async () => {
  const keys = [];
  const booking = mountServiceBooking({
    handler: (url, options) => {
      if (options?.method === "POST") {
        keys.push(JSON.parse(options.body).idempotency_key);
        return response(502, {});
      }
      return response(200, { slots: [] });
    }
  });
  try {
    booking.fill();
    const time = booking.form.elements.namedItem("starts_at");
    const option = booking.window.document.createElement("option");
    option.value = slotTime;
    time.append(option);
    time.value = slotTime;
    await booking.submit();
    await booking.submit();
    assert.equal(keys[0], keys[1], "retrying the same request replays the same key");
    assert.match(booking.status().textContent, /Booking request failed \(502\)/);
    booking.form.elements.namedItem("customer_phone").value = "+254 700 999999";
    await booking.submit();
    assert.notEqual(keys[2], keys[0], "changed details never reuse an older request's key");
  } finally {
    booking.window.close();
  }
});

test("Litrus service deposit return explains paid, failed and unconfirmed payments and links back to the shop", async () => {
  for (const [paymentStatus, expected] of [
    ["paid", /Payment received/],
    ["failed", /did not go through/],
    ["pending", /not confirmed yet/]
  ]) {
    const dom = new JSDOM('<div id="store"></div>', {
      url: "https://shop.example/#/service-payment?reference=ESHOP_" + "B".repeat(32), runScripts: "outside-only"
    });
    const { window } = dom;
    window.__ESHOP_THEME_CATALOG__ = { categories: [], products: [], store: { name: "Calm Studio", currency: "KES", offer_type: "services" } };
    window.SPD = { shop: { key: "calm", products: [] }, pages: {}, shell: {}, templates: {} };
    window.fetch = async () => response(200, { appointment: { id: "x", payment_status: paymentStatus } });
    try {
      window.eval(runtime);
      window.litrusStartLiveStore(window.SPD);
      await pause(5);
      assert.match(window.document.querySelector('[role="status"]').textContent, expected);
      assert.ok(window.document.querySelector('a[href="/#/"]'), "the page offers a way back to the shop");
    } finally {
      window.close();
    }
  }
});

// ---------------------------------------------------------------------------
// Service booking: manage link, capacity-aware slots, friendly errors
// ---------------------------------------------------------------------------
const MANAGE_TOKEN = "Tk3_-".repeat(8) + "Tk3";
const manageFixture = (overrides = {}) => ({
  reference: "AB12CD34", service_id: "42", service_name: "Deep tissue massage", starts_at: slotTime,
  ends_at: slotTime, timezone: "Africa/Nairobi", duration_minutes: 45, status: "pending", expired: false,
  payment_status: "not_required", currency: "KES", price_cents: 250000, deposit_cents: 0,
  payment_authorization_url: null, cancelled_by: null, cancel_reason: null, deposit_refund_due: false,
  deposit_refunded: false, can_cancel: true, can_reschedule: true, cancel_cutoff_at: slotTime,
  cancel_cutoff_hours: 2, reschedules_used: 0, reschedules_remaining: 2, max_reschedules: 2, ...overrides
});

function mountManagePage({ handler, token = MANAGE_TOKEN, shop = {}, seed = null, virtualConsole }) {
  const dom = new JSDOM('<div id="store"></div>', { url: `https://shop.example/#/booking/${token}`, runScripts: "outside-only", virtualConsole });
  const { window } = dom;
  const requests = [];
  window.__ESHOP_THEME_CATALOG__ = {
    categories: [], products: [{ id: 42, name: "Deep tissue massage", price: 2500, images: [], duration_minutes: 45 }],
    store: { name: "Calm Studio", currency: "KES", offer_type: "services", service_timezone: "Africa/Nairobi", ...shop }
  };
  window.SPD = { shop: { key: "calm", products: [] }, pages: {}, shell: {}, templates: {} };
  if (seed) window.localStorage.setItem("eshop-appointments:shop.example", JSON.stringify(seed));
  window.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method: options?.method || "GET", body });
    return handler(body, String(url));
  };
  window.eval(runtime);
  window.litrusStartLiveStore(window.SPD);
  return { window, requests, root: window.document.getElementById("store"), text: () => window.document.getElementById("store").textContent };
}

test("Litrus booking confirmation links to the manage page and saves the token for this device", async () => {
  const booking = mountServiceBooking({
    handler: () => response(201, {
      appointment: { id: "ab12cd34-0000-4000-8000-000000000001", service_name: "Deep tissue massage", starts_at: slotTime, status: "pending" },
      manage_token: MANAGE_TOKEN
    })
  });
  try {
    assert.match(booking.form.textContent, /cancel or move your booking online until 2 hours before/);
    booking.fill();
    const time = booking.form.elements.namedItem("starts_at");
    const option = booking.window.document.createElement("option");
    option.value = slotTime;
    time.append(option);
    time.value = slotTime;
    await booking.submit();
    const link = booking.form.querySelector(".sp-service-booking-confirmation a[data-service-manage-link]");
    assert.ok(link, "the confirmation offers a manage link");
    assert.equal(link.getAttribute("href"), `#/booking/${MANAGE_TOKEN}`);
    const saved = JSON.parse(booking.window.localStorage.getItem("eshop-appointments:shop.example"));
    assert.equal(saved[0].manage_token, MANAGE_TOKEN);
    const listed = booking.form.parentNode.querySelector("[data-litrus-service-requests]");
    assert.equal(listed.querySelector("a[data-service-manage-link]").getAttribute("href"), `#/booking/${MANAGE_TOKEN}`);
    assert.doesNotMatch(listed.textContent, /Waiting for the shop to confirm/, "a saved link replaces the guess about status");
    assert.equal(booking.form.querySelector(".sp-buy, [data-act='addqty']"), null, "service sites never offer Add to bag");
  } finally {
    booking.window.close();
  }
});

test("Litrus booking ignores a malformed manage token instead of building a broken link", async () => {
  const booking = mountServiceBooking({
    handler: () => response(201, { appointment: { id: "ab12cd34-0000-4000-8000-000000000001", service_name: "Massage", starts_at: slotTime, status: "pending" }, manage_token: "short" })
  });
  try {
    booking.fill();
    const time = booking.form.elements.namedItem("starts_at");
    const option = booking.window.document.createElement("option");
    option.value = slotTime;
    time.append(option);
    time.value = slotTime;
    await booking.submit();
    assert.equal(booking.form.querySelector("a[data-service-manage-link]"), null);
    assert.equal(JSON.parse(booking.window.localStorage.getItem("eshop-appointments:shop.example"))[0].manage_token, undefined);
  } finally {
    booking.window.close();
  }
});

test("Litrus booking slot list shows spots left only for shops with more than one seat", async () => {
  for (const [capacity, expected] of [[3, ["10:00 AM · 2 spots left", "10:15 AM · 1 spot left"]], [1, ["10:00 AM", "10:15 AM"]]]) {
    const booking = mountServiceBooking({
      handler: () => response(200, { capacity, slots: [
        { starts_at: slotTime, label: "10:00 AM", remaining: capacity === 3 ? 2 : 1 },
        { starts_at: slotTime.replace("T07:00", "T07:15"), label: "10:15 AM", remaining: 1 }
      ] })
    });
    try {
      await booking.chooseDate(futureDate);
      const labels = [...booking.form.elements.namedItem("starts_at").options].map(item => item.textContent).slice(1);
      assert.deepEqual(labels, expected);
    } finally {
      booking.window.close();
    }
  }
});

test("Litrus booking turns every error_code into a plain sentence and never shows a raw code", async () => {
  const codes = [
    [409, "slot_unavailable", /no longer available/], [409, "service_changed", /updated/], [429, "rate_limited", /Too many/],
    [400, "invalid_request", /Check the details/], [409, "service_unavailable", /cannot be booked/], [503, "storage_unavailable", /temporarily unavailable/]
  ];
  for (const [status, code, expected] of codes) {
    const booking = mountServiceBooking({
      handler: (url, options) => options?.method === "POST"
        ? response(status, { error: "RAW SERVER TEXT", error_code: code })
        : response(200, { slots: [] })
    });
    try {
      booking.fill();
      booking.form.elements.namedItem("date").value = futureDate;
      const time = booking.form.elements.namedItem("starts_at");
      const option = booking.window.document.createElement("option");
      option.value = slotTime;
      time.append(option);
      time.value = slotTime;
      await booking.submit();
      await pause(5);
      assert.match(booking.status().textContent, expected, code);
      assert.doesNotMatch(booking.status().textContent, /RAW SERVER TEXT|_/, code);
    } finally {
      booking.window.close();
    }
  }
});

test("Litrus manage page shows the booking, lets the customer move it and then cancel it", async () => {
  let current = manageFixture();
  const booking = mountManagePage({
    seed: [{ id: "x", manage_token: MANAGE_TOKEN, starts_at: slotTime, service_name: "Deep tissue massage" }],
    handler: body => {
      if (body.action === "view") return response(200, { appointment: current });
      if (body.action === "slots") return response(200, { date: body.date, capacity: 2, slots: [
        { starts_at: current.starts_at, label: "10:00 AM", remaining: 2 },
        { starts_at: "2030-02-02T08:00:00.000Z", label: "11:00 AM", remaining: 2 }
      ] });
      if (body.action === "reschedule") {
        current = manageFixture({ starts_at: body.starts_at, reschedules_used: 1, reschedules_remaining: 1 });
        return response(200, { appointment: current });
      }
      if (body.action === "cancel") {
        current = manageFixture({ status: "cancelled", cancelled_by: "you", can_cancel: false, can_reschedule: false });
        return response(200, { appointment: current });
      }
      return response(400, {});
    }
  });
  try {
    await pause(10);
    assert.equal(booking.requests[0].url, "/api/service-appointments/manage");
    assert.deepEqual(booking.requests[0].body, { token: MANAGE_TOKEN, action: "view" });
    assert.match(booking.text(), /Your booking/);
    assert.match(booking.text(), /Deep tissue massage/);
    assert.match(booking.text(), /Waiting for the shop to confirm/);
    assert.match(booking.text(), /move this booking 2 more times/);
    assert.doesNotMatch(booking.text(), /Add to bag/);

    const date = booking.root.querySelector('input[type="date"]');
    date.value = "2030-02-02";
    date.dispatchEvent(new booking.window.Event("change", { bubbles: true }));
    await pause(10);
    assert.deepEqual(booking.requests.at(-1).body, { token: MANAGE_TOKEN, action: "slots", date: "2030-02-02" });
    const select = booking.root.querySelector("select");
    const options = [...select.options].map(item => item.textContent);
    assert.deepEqual(options, ["Choose a time", "11:00 AM · 2 spots left"], "the current time is not offered as a move target");
    select.value = "2030-02-02T08:00:00.000Z";
    booking.root.querySelector("form").dispatchEvent(new booking.window.Event("submit", { bubbles: true, cancelable: true }));
    await pause(10);
    assert.deepEqual(booking.requests.at(-1).body, { token: MANAGE_TOKEN, action: "reschedule", starts_at: "2030-02-02T08:00:00.000Z" });
    assert.match(booking.text(), /Your booking was moved/);
    assert.match(booking.text(), /move this booking 1 more time\./);

    const cancel = [...booking.root.querySelectorAll("button")].find(item => /Cancel this booking/.test(item.textContent));
    cancel.click();
    assert.equal(booking.requests.at(-1).body.action, "reschedule", "the first tap only asks for confirmation");
    assert.match(cancel.textContent, /Tap again/);
    cancel.click();
    await pause(10);
    assert.equal(booking.requests.at(-1).body.action, "cancel");
    assert.match(booking.text(), /Cancelled/);
    assert.match(booking.text(), /Your booking was cancelled/);
    assert.equal([...booking.root.querySelectorAll("button")].some(item => /Cancel this booking/.test(item.textContent)), false);
    assert.equal(JSON.parse(booking.window.localStorage.getItem("eshop-appointments:shop.example")).length, 0, "a cancelled booking leaves the device list");
  } finally {
    booking.window.close();
  }
});

test("Litrus manage page explains the cutoff, refunds and unknown links without inventing anything", async () => {
  const closed = mountManagePage({
    shop: { phone: "+254 700 111222" },
    handler: () => response(200, { appointment: manageFixture({ status: "confirmed", can_cancel: false, can_reschedule: false, cancel_cutoff_hours: 2 }) })
  });
  try {
    await pause(10);
    assert.match(closed.text(), /Changes online close 2 hours before the start/);
    assert.match(closed.text(), /Confirmed by the shop/);
    assert.equal([...closed.root.querySelectorAll("button")].length, 0, "no cancel button inside the cutoff");
    assert.ok(closed.root.querySelector('a[href="tel:+254700111222"]'), "the shop's contact details are offered instead");
  } finally {
    closed.window.close();
  }
  const refund = mountManagePage({
    handler: () => response(200, { appointment: manageFixture({
      status: "cancelled", cancelled_by: "shop", cancel_reason: "Stylist is ill", can_cancel: false, can_reschedule: false,
      payment_status: "paid", deposit_cents: 50000, deposit_refund_due: true
    }) })
  });
  try {
    await pause(10);
    assert.match(refund.text(), /Cancelled by the shop/);
    assert.match(refund.text(), /Reason: Stylist is ill/);
    assert.match(refund.text(), /KES 500 paid; the shop has been asked to refund it/);
  } finally {
    refund.window.close();
  }
  const pay = mountManagePage({
    handler: () => response(200, { appointment: manageFixture({
      status: "confirmed", payment_status: "pending", deposit_cents: 50000, payment_authorization_url: "https://checkout.paystack.com/abc"
    }) })
  });
  try {
    await pause(10);
    assert.equal(pay.root.querySelector('a[href="https://checkout.paystack.com/abc"]').textContent, "Pay deposit");
  } finally {
    pay.window.close();
  }
  const unknown = mountManagePage({
    seed: [{ id: "x", manage_token: MANAGE_TOKEN, starts_at: slotTime }],
    handler: () => response(404, { error: "x", error_code: "appointment_not_found" })
  });
  try {
    await pause(10);
    assert.match(unknown.text(), /booking link is not valid/);
    assert.equal(JSON.parse(unknown.window.localStorage.getItem("eshop-appointments:shop.example")).length, 0);
  } finally {
    unknown.window.close();
  }
});

test("Litrus manage page surfaces a rejected move with the Worker's reason and refreshes the times", async () => {
  const booking = mountManagePage({
    handler: body => {
      if (body.action === "view") return response(200, { appointment: manageFixture() });
      if (body.action === "slots") return response(200, { capacity: 1, slots: [{ starts_at: "2030-02-02T08:00:00.000Z", label: "11:00 AM", remaining: 1 }] });
      return response(409, { error: "x", error_code: "slot_unavailable" });
    }
  });
  try {
    await pause(10);
    const date = booking.root.querySelector('input[type="date"]');
    date.value = "2030-02-02";
    date.dispatchEvent(new booking.window.Event("change", { bubbles: true }));
    await pause(10);
    booking.root.querySelector("select").value = "2030-02-02T08:00:00.000Z";
    booking.root.querySelector("form").dispatchEvent(new booking.window.Event("submit", { bubbles: true, cancelable: true }));
    await pause(20);
    assert.match(booking.text(), /no longer available/);
    assert.deepEqual(booking.requests.map(request => request.body.action), ["view", "slots", "reschedule", "slots"]);
  } finally {
    booking.window.close();
  }
});

test("Litrus builder validates the capacity, cutoff and reschedule settings before publishing", () => {
  const start = editor.indexOf("function serviceMinutes(value){");
  const end = editor.indexOf("function showServiceProblems(){");
  assert.ok(start >= 0 && end > start);
  const body = editor.slice(start, end);
  const base = { offerType: "services", serviceDays: [1], serviceOpenTime: "09:00", serviceCloseTime: "17:00", serviceTimezone: "Africa/Nairobi",
    serviceBufferMinutes: 0, serviceDepositPercent: 0, cur: "KES", serviceCapacity: 2, serviceCancelCutoffHours: 2, serviceMaxReschedules: 2 };
  const problemsFor = (overrides, fields = {}) => Array.from(runInNewContext(`${body}\nserviceSettingsProblems()`, {
    SHOP: { ...base, ...overrides }, prods: [{ name: "Cut", price: "100", duration_minutes: 60 }],
    g: id => ({ value: fields[id] ?? "" }), Intl, Number, String, Array, Math
  }));
  assert.deepEqual(problemsFor({}), []);
  assert.match(problemsFor({ serviceCapacity: 0 }).join(" "), /Bookings at the same time/);
  assert.match(problemsFor({ serviceCapacity: 21 }).join(" "), /Bookings at the same time/);
  assert.match(problemsFor({ serviceCapacity: 1.5 }).join(" "), /Bookings at the same time/);
  assert.match(problemsFor({ serviceCancelCutoffHours: -1 }).join(" "), /cutoff/);
  assert.match(problemsFor({ serviceCancelCutoffHours: 169 }).join(" "), /cutoff/);
  assert.deepEqual(problemsFor({ serviceCancelCutoffHours: 0 }), [], "zero hours (until it starts) is valid");
  assert.match(problemsFor({ serviceMaxReschedules: 11 }).join(" "), /move a booking/);
  assert.deepEqual(problemsFor({ serviceMaxReschedules: 0 }), [], "zero moves is valid");
  const parse = (raw, fallback) => runInNewContext(`${body}\nserviceIntegerField("f", ${fallback})`, { g: () => ({ value: raw }), String, Number });
  assert.equal(parse("", 2), 2, "a blank field takes its default");
  assert.equal(parse("0", 2), 0, "zero is kept, not replaced by the default");
  assert.equal(parse("3", 1), 3);
});

// ---------------------------------------------------------------------------
// No invented social proof, accessibility quick wins
// ---------------------------------------------------------------------------
function loadReviewBuilder(testimonials) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const xpSource = editor.match(/^const XP=\[.*\];?$/m)?.[0];
  const start = editor.indexOf("function xpart(kind,id,name){");
  const end = editor.indexOf("const bs=$('selBan')", start);
  assert.ok(xpSource && start >= 0 && end > start);
  const { xpart } = runInNewContext(`${xpSource}\n${editor.slice(start, end)}\n({ xpart })`, {
    document: dom.window.document,
    SHOP: { promo: "", tagline: "Made for everyday", testimonials },
    art: () => "https://images.test/art.webp"
  });
  return { xpart, dom };
}

test("Litrus generated sites show no reviews, ratings or trust claims unless the owner entered testimonials", () => {
  for (const style of ["akta-testimonials", "marlin-testimonial"]) {
    for (const empty of [undefined, [], [{ quote: "   ", name: "Nobody" }]]) {
      const { xpart, dom } = loadReviewBuilder(empty);
      try {
        assert.equal(xpart("rev", style, "Kiko"), null, `${style} must be hidden when the owner has not added testimonials`);
      } finally {
        dom.window.close();
      }
    }
  }
  const owner = [
    { quote: "Fast and friendly service.", name: "Wanjiru M.", detail: "Nakuru" },
    { quote: "Fits perfectly.", name: "", detail: "" }
  ];
  let { xpart, dom } = loadReviewBuilder(owner);
  try {
    const akta = xpart("rev", "akta-testimonials", "Kiko");
    assert.equal(akta.querySelectorAll(".akta-test-card").length, 2);
    assert.match(akta.textContent, /“Fast and friendly service\.”/);
    assert.match(akta.textContent, /Wanjiru M\./);
    assert.match(akta.textContent, /Nakuru/);
    assert.equal(akta.querySelectorAll(".akta-test-card")[1].querySelector(".author"), null, "no author line without a name");
    assert.equal(akta.hasAttribute("data-litrus-owner-testimonials"), true);
    assert.doesNotMatch(akta.textContent, /★|Real reviews|Verified|Sarah Johnson|Michael Chen|Emma/);
    assert.equal(akta.querySelector(".stars"), null);
  } finally {
    dom.window.close();
  }
  ({ xpart, dom } = loadReviewBuilder(owner));
  try {
    const marlin = xpart("rev", "marlin-testimonial", "Kiko");
    assert.match(marlin.textContent, /Fast and friendly service/);
    assert.equal(marlin.querySelector("img"), null, "no stock-photo reviewer");
    assert.doesNotMatch(marlin.textContent, /testimonial|rating|orders|returns|Emma Stone|Verified/i);
  } finally {
    dom.window.close();
  }
  for (const invented of ["(142 reviews)", "<div>Fast delivery</div>", "<div>Easy returns</div>", "<div>Secure payment</div>", "<small>Best seller</small>", "<small>New arrival</small>", "Amina W.", "Brian O.", "Faith K.", "Free returns", "2,000+ orders", "4.8 / 5 rating", "Verified buyer", "SHOP.email||'hello@yourshop.com'", "SHOP.phone||'+254 700 000 000'", "'Nairobi, Kenya'", "We usually reply the same day"]) {
    assert.ok(!editor.includes(invented), `the builder must not publish "${invented}"`);
  }
  assert.doesNotMatch(editor, /className='lpk-mixer-stars'/, "a star rating is never injected into product cards");
});

test("Litrus drops invented reviews already saved in an older published homepage", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const data = {
    shop: { key: "old", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section>' +
        '<div class="akta-testimonials sec"><div class="stars">★★★★★</div><p>Invented</p><b>Sarah Johnson</b></div>' +
        '<div class="marlin-testimonial sec"><p>Invented too</p><span>testimonial</span></div>' +
        '<div class="akta-testimonials sec" data-litrus-owner-testimonials><p>Real words</p></div></main>',
      shop: '<main class="sp-main"><section class="prods"></section></main>'
    },
    shell: { head: "", foot: "", tail: "" },
    templates: { productCard: '<article data-pid=""></article>' }
  };
  try {
    window.eval(runtime);
    window.litrusRefreshPublishedCatalog(data, {
      categories: [], products: [{ id: 1, name: "Item", price: 100, images: [] }], store: { name: "Old", currency: "KES" }
    });
    assert.doesNotMatch(data.pages.home, /Sarah Johnson|Invented|★/);
    assert.match(data.pages.home, /Real words/);
  } finally {
    window.close();
  }
});

test("Litrus cart keeps tap targets, labels and keyboard focus usable", () => {
  assert.match(editor, /\.sp-qty button\{width:44px;height:44px/);
  assert.match(editor, /\.sp-x\{[^}]*min-width:44px;min-height:44px/);
  assert.match(editor, /\.sp-line\{display:grid;grid-template-columns:76px 1fr auto auto 44px/);
  assert.match(editor, /\.sp-line\{grid-template-columns:64px 1fr auto 44px/);

  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const root = window.document.getElementById("store");
  const start = editor.indexOf("function SPRT(D){");
  const end = editor.indexOf("/* ===== SHOP PAGES", start);
  const shop = { key: "focus", name: "Focus", cur: "KES", fee: 0, free: 0, products: [{ id: "a", name: "Tote bag", num: 900, img: "/tote.jpg", stock: 9 }] };
  try {
    window.eval(`${editor.slice(start, end)}\nwindow.SPRT = SPRT;`);
    window.localStorage.setItem("sp:focus:cart", JSON.stringify([{ id: "a", q: 2, price: 900 }]));
    const controller = window.SPRT({
      root, hash: false, preview: false, shop: () => shop,
      page: route => route === "home" ? '<main class="sp-main"><h1>Home</h1></main>' : null,
      shell: () => ({ cls: "", style: "", head: "", foot: "", tail: "" })
    });
    controller.draw("home");
    assert.notEqual(window.document.activeElement.tagName, "H1", "the first paint never steals focus");
    controller.go("cart");
    assert.equal(window.document.activeElement.tagName, "H1", "route changes move focus to the page heading");
    const image = root.querySelector(".sp-line img");
    assert.equal(image.getAttribute("width"), "76");
    assert.equal(image.getAttribute("loading"), "lazy");
    assert.equal(root.querySelector('[data-act="dec"]').getAttribute("aria-label"), "Decrease quantity of Tote bag");
    assert.equal(root.querySelector('[data-act="inc"]').getAttribute("aria-label"), "Increase quantity of Tote bag");
    assert.equal(root.querySelector('[data-act="rm"]').getAttribute("aria-label"), "Remove Tote bag from cart");
    root.querySelector('[data-act="inc"]').click();
    assert.equal(window.document.activeElement, root.querySelector('[data-act="inc"]'),
      "changing a quantity keeps the keyboard on the same control");
    assert.match(root.querySelector(".sp-qty span").textContent, /3/);
    root.querySelector('[data-act="rm"]').click();
    assert.equal(window.document.activeElement.tagName, "H1");
  } finally {
    window.close();
  }
});

test("Litrus published product cards lazy-load images and name their add buttons", () => {
  const dom = new JSDOM("", { url: "https://shop.example/", runScripts: "outside-only" });
  const card = '<article data-pid=""><div class="p-img-wrapper"><img></div><h3 class="p-title"></h3><button class="p-btn" data-add="">Add to bag</button></article>';
  const data = {
    shop: { key: "k", products: [] },
    pages: { home: `<main class="sp-main"><section class="prods">${card}</section></main>`, shop: '<main class="sp-main"><section class="prods"></section></main>' },
    shell: { head: "", foot: "", tail: "" }, templates: { productCard: card }
  };
  try {
    dom.window.eval(runtime);
    dom.window.litrusRefreshPublishedCatalog(data, {
      categories: [], store: { name: "K", currency: "KES" },
      products: [{ id: 1, name: "Canvas Tote", price: 900, images: ["/tote.jpg"] }]
    });
    const page = new dom.window.DOMParser().parseFromString(data.pages.home, "text/html");
    const image = page.querySelector("img");
    assert.equal(image.getAttribute("loading"), "lazy");
    assert.equal(image.getAttribute("decoding"), "async");
    assert.equal(page.querySelector("button").getAttribute("aria-label"), "Add to bag: Canvas Tote");
  } finally {
    dom.window.close();
  }
});

// ---------------------------------------------------------------------------
// Request keys, duplicate-order guards and honest generated copy
// ---------------------------------------------------------------------------
const UUID_V4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const plainSneaker = { id: 42, name: "City Sneaker", price: 2500, images: [], stock: 9 };

test("Litrus checkout builds a valid order key in browsers without crypto.randomUUID", async () => {
  const harness = mountCheckout({
    cart: [{ id: "42", q: 1 }],
    products: [plainSneaker],
    handler: () => orderResponse({ order: { subtotal: 2500, total: 2500 } })
  });
  try {
    Object.defineProperty(harness.window.crypto, "randomUUID", { configurable: true, value: undefined });
    await harness.submit();
    assert.equal(harness.requests.length, 1, "the order must still be sent");
    assert.match(harness.requests[0].body.idempotency_key, UUID_V4);
    assert.match(harness.root.textContent, /ORD-0123456789ABCDEF/);
  } finally {
    harness.window.close();
  }

  // Without any secure random source the customer is told, rather than the page failing silently.
  const unsupported = mountCheckout({ cart: [{ id: "42", q: 1 }], products: [plainSneaker], handler: () => orderResponse() });
  try {
    Object.defineProperty(unsupported.window, "crypto", { configurable: true, value: {} });
    await unsupported.submit();
    assert.equal(unsupported.requests.length, 0);
    assert.match(unsupported.form.querySelector(".sp-err").textContent, /Secure requests are not supported/);
  } finally {
    unsupported.window.close();
  }
});

test("Litrus checkout retries a code the shop did not apply without creating a second order", async () => {
  const harness = mountCheckout({
    cart: [{ id: "42", q: 1 }],
    products: [plainSneaker],
    handler: () => orderResponse({ order: { subtotal: 2500, total: 2500 } })
  });
  try {
    const field = harness.form.elements.namedItem("discount_code");
    field.value = "NOPE10";
    await harness.submit();
    assert.equal(harness.requests.length, 1);
    assert.match(harness.form.querySelector(".sp-err").textContent, /could not be applied/);

    field.value = "";
    await harness.submit();
    assert.equal(harness.requests.length, 2);
    assert.equal(harness.requests[1].body.idempotency_key, harness.requests[0].body.idempotency_key,
      "the same key lets the Worker return the order it already saved");
    assert.ok(!("discount_code" in harness.requests[1].body));
    assert.match(harness.root.textContent, /ORD-0123456789ABCDEF/);
  } finally {
    harness.window.close();
  }

  // A different code is a different request and must get a new key.
  const changed = mountCheckout({
    cart: [{ id: "42", q: 1 }],
    products: [plainSneaker],
    handler: () => orderResponse({ order: { subtotal: 2500, total: 2500 } })
  });
  try {
    const field = changed.form.elements.namedItem("discount_code");
    field.value = "FIRST10";
    await changed.submit();
    field.value = "SECOND10";
    await changed.submit();
    assert.notEqual(changed.requests[1].body.idempotency_key, changed.requests[0].body.idempotency_key);
    assert.equal(changed.requests[1].body.discount_code, "SECOND10");
  } finally {
    changed.window.close();
  }
});

test("Litrus product reservations reuse one key until the shop confirms them, without crypto.randomUUID", async () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const requests = [];
  let failNext = true;
  window.__ESHOP_THEME_CATALOG__ = {
    categories: [], store: { name: "Example", currency: "KES" },
    products: [{ id: 42, name: "City Sneaker", price: 2500, images: [], stock: 4, booking_enabled: true }]
  };
  window.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    if (failNext) {
      failNext = false;
      throw new TypeError("Failed to fetch");
    }
    return response(201, { hold: { id: HOLD_ID, product_id: "42", quantity: 1, expires_at: "2030-01-01T12:00:00.000Z" } });
  };
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
  window.SPRT = options => {
    window.document.getElementById("store").innerHTML = options.page("p/42");
    return {};
  };
  Object.defineProperty(window.crypto, "randomUUID", { configurable: true, value: undefined });
  try {
    window.eval(runtime);
    window.litrusStartLiveStore(window.SPD);
    const form = window.document.querySelector("[data-litrus-product-hold-form]");
    const submit = async () => {
      form.elements.quantity.value = "1";
      form.elements.customer_name.value = "Sam Shop";
      form.elements.contact.value = "sam@example.test";
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await pause(5);
    };
    await submit();
    assert.match(form.querySelector(".sp-hold-status").textContent, /Failed to fetch|Could not/);
    await submit();
    assert.equal(requests.length, 2);
    assert.match(requests[0].idempotency_key, UUID_V4);
    assert.equal(requests[1].idempotency_key, requests[0].idempotency_key,
      "a retry after a dropped connection must not reserve the stock twice");
    assert.match(form.querySelector(".sp-hold-status").textContent, /Held 1 City Sneaker/);
    await submit();
    assert.notEqual(requests[2].idempotency_key, requests[0].idempotency_key,
      "a new reservation after a confirmed one gets its own key");
  } finally {
    window.close();
  }
});

test("Litrus service booking list stops promising a confirmation once a request is a day old", () => {
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
  const booking = mountServiceBooking({
    handler: () => response(200, {}),
    beforeStart: window => window.localStorage.setItem("eshop-appointments:shop.example", JSON.stringify([
      { id: "fresh-1", reference: "FRESH001", service_name: "Massage", starts_at: future, timezone: "Africa/Nairobi", requested_at: new Date(Date.now() - 3_600_000).toISOString() },
      { id: "old-1", reference: "OLD00002", service_name: "Facial", starts_at: future, timezone: "Africa/Nairobi", requested_at: new Date(Date.now() - 30 * 3_600_000).toISOString() }
    ]))
  });
  try {
    const items = [...booking.form.parentNode.querySelectorAll("[data-litrus-service-requests] li")].map(item => item.textContent);
    assert.equal(items.length, 2);
    const fresh = items.find(text => /FRESH001/.test(text));
    const old = items.find(text => /OLD00002/.test(text));
    assert.match(fresh, /Waiting for the shop to confirm/);
    assert.match(old, /Requested over a day ago: contact the shop if you have not heard back/);
    assert.doesNotMatch(old, /Waiting for the shop to confirm/);
  } finally {
    booking.window.close();
  }
});

test("Litrus generated pages never invent delivery, returns, payment or item-count claims", () => {
  for (const invented of [
    "Delivery is free.",
    "We deliver to your door and you can also pick up your order.",
    "we will put it right",
    "You can pay with mobile money, cash on delivery or pickup, or by a payment link we send you.",
    "e.textContent='24 items'"
  ]) {
    assert.ok(!editor.includes(invented), `the builder must not publish "${invented}"`);
  }
  // Category tiles that show a count use the real number of products in that category.
  assert.match(editor, /total=shopProds\(\)\.filter\(x=>\(x\[5\]\|\|\[\]\)\.includes\(categoryName\)\)\.length/);
  // Coarse pointers (phones) get 44px targets for the header navigation and the bag button.
  assert.match(editor, /@media\(pointer:coarse\)\{\.sp-nav a,\.sp-cartbtn\{min-height:44px/);
});

test("Litrus product page loads its main photo first and keeps thumbnails lazy and sized", () => {
  const dom = new JSDOM("", { url: "https://shop.example/", runScripts: "outside-only" });
  const data = {
    shop: { key: "example", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section></main>',
      shop: '<main class="sp-main"><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button data-act="addqty">Add to bag</button></div></div></div></main>'
    },
    shell: { head: "", foot: "", tail: "" },
    templates: { productCard: '<article data-pid=""></article>' }
  };
  try {
    dom.window.eval(runtime);
    dom.window.litrusRefreshPublishedCatalog(data, {
      categories: [], store: { name: "Example", currency: "KES" },
      products: [{ id: 7, name: "Canvas Tote", price: 900, images: ["/tote.jpg", "/tote-side.jpg"] }]
    });
    const detail = new dom.window.DOMParser().parseFromString(data.pages["p/7"], "text/html");
    const main = detail.querySelector(".sp-gallery > img");
    assert.equal(main.getAttribute("fetchpriority"), "high");
    assert.notEqual(main.getAttribute("loading"), "lazy", "the main photo is never lazy-loaded");
    const thumbnails = [...detail.querySelectorAll(".sp-gallery-thumbs img")];
    assert.equal(thumbnails.length, 2);
    for (const thumbnail of thumbnails) {
      assert.equal(thumbnail.getAttribute("loading"), "lazy");
      assert.equal(thumbnail.getAttribute("width"), "64");
      assert.equal(thumbnail.getAttribute("height"), "64");
      assert.equal(thumbnail.hasAttribute("fetchpriority"), false);
    }
  } finally {
    dom.window.close();
  }
});

const plain = value => JSON.parse(JSON.stringify(value));

function mountCraftPayloadBuilder() {
  const start = editor.indexOf("window.litrusSetCraftCatalog=function(payload){");
  const end = editor.indexOf("\nif(!(craftIntegrated&&window.parent!==window)){const pb=", start);
  const serviceStart = editor.indexOf("function nearestServiceDuration(value){");
  const serviceEnd = editor.indexOf("\nfunction showProductEditor(index){", serviceStart);
  const keyStart = editor.indexOf("let hiddenCraftProducts=[];");
  const keyEnd = editor.indexOf("\nfunction getCategoryNames(){", keyStart);
  assert.ok(start >= 0 && end > start && serviceStart >= 0 && serviceEnd > serviceStart && keyStart >= 0 && keyEnd > keyStart);
  const code = editor.slice(start, end);
  const ids = [...new Set([...code.matchAll(/\bg\('([^']+)'\)/g)].map(match => match[1]))];
  const dom = new JSDOM(
    `${ids.map(id => `<input id="${id}">`).join("")}<p id="wServiceError" hidden></p><div id="wMoods"></div><div id="wTweak"></div>` +
    '<input type="checkbox" data-service-day="1"><input type="checkbox" data-service-day="2">',
    { runScripts: "outside-only" }
  );
  dom.window.eval(`
    const g = id => document.getElementById(id);
    const MOODS = [{ n: "Style A" }];
    let mood = null, step = 1, designDraftId = "", generatedDefaultDesign = false;
    let existingSitePreviewHtml = "", existingSitePreviewDirty = false;
    let SHOP = { categoriesPosition: "after-products", cats: [], products: [], serviceDays: [1, 2] }, prods = [];
    const MAX_CATEGORIES = 30, MAX_PRODUCTS = 100, craftIntegrated = true;
    const mb = g("wMoods");
    const applyRecipe = () => false, applyOfferTypeUI = () => {};
    const setCategoryNames = () => {}, drawProds = () => {}, render = () => {}, previewVisible = () => false;
    const sync = () => {}, setSaved = () => {}, apply = () => {}, autosave = () => {};
    const randomDraftMood = () => null, imgSrc = value => value || "";
    const getCraftDesignRecipe = () => ({ litrus: "mixer-recipe", v: 1 });
    const exportShop = () => '<!doctype html><html><head></head><body>shop</body></html>';
    const litrusFitPublishedHtml = html => html;
    const read = () => {};
    ${editor.slice(keyStart, keyEnd)}
    ${editor.slice(serviceStart, serviceEnd)}
    ${code}
    window.probe = {
      get prods() { return prods; },
      get hidden() { return hiddenCraftProducts; },
      shop: SHOP,
      problems: serviceSettingsProblems
    };
  `);
  return dom;
}

test("Litrus builder returns archived products untouched and never turns absence into a deletion", () => {
  const dom = mountCraftPayloadBuilder();
  try {
    const archived = {
      id: 900, name: "Retired lamp", price: 12, status: "archived", sku: "LAMP-1", stock: 3,
      variants: [{ id: "v1", size: "S", stock: 1 }], images: []
    };
    const original = JSON.parse(JSON.stringify(archived));
    const catalog = {
      shop: { name: "Shop", currency: "KES" },
      categories: [{ id: 1, name: "Home" }],
      products: [
        { id: 7, name: "Kept lamp", price: 20, status: "active", category_names: ["Home"], images: [] },
        { id: 8, name: "Plain lamp", price: 30, category_names: ["Home"], images: [] },
        archived
      ]
    };
    const loaded = dom.window.litrusSetCraftCatalog(catalog);
    assert.equal(loaded.products, 2, "archived products are not shown or edited in the builder");
    assert.equal(loaded.categories, 1);
    assert.equal(dom.window.probe.prods.length, 2);
    assert.equal(dom.window.probe.hidden.length, 1);

    const payload = dom.window.litrusGetCraftPublishPayload();
    assert.deepEqual(plain(payload.catalog.products.map(product => String(product.id))), ["7", "8", "900"],
      "every id the host sent comes back, in the same order, archived ones last");
    assert.equal(payload.catalog.products[0].status, "active", "a status the host sent is passed through");
    assert.ok(!("status" in payload.catalog.products[1]), "no status is invented for a product that had none");
    assert.deepEqual(JSON.parse(JSON.stringify(payload.catalog.products[2])), original,
      "an archived product comes back exactly as received");
    assert.notStrictEqual(payload.catalog.products[2], archived, "and is a copy, so later edits cannot alias it");

    // Autosave is repeatable: the same archived product is returned every time.
    const again = dom.window.litrusGetCraftPublishPayload();
    assert.deepEqual(plain(again.catalog.products.map(product => String(product.id))), ["7", "8", "900"]);

    // When the host sends a fresh catalogue with no archived products, none are invented.
    dom.window.litrusSetCraftCatalog({ ...catalog, products: catalog.products.slice(0, 2) });
    assert.deepEqual(plain(dom.window.litrusGetCraftPublishPayload().catalog.products.map(product => String(product.id))), ["7", "8"]);
  } finally {
    dom.window.close();
  }
});

test("Litrus builder gives a new product one stable key and never a made-up host id", () => {
  const dom = mountCraftPayloadBuilder();
  try {
    dom.window.litrusSetCraftCatalog({
      shop: { name: "Shop" }, categories: [{ id: 1, name: "Home" }],
      products: [{ id: 7, name: "Existing", price: 20, category_names: ["Home"], images: [] }]
    });
    dom.window.probe.prods.push({ name: "Brand new", price: "15", desc: "", img: "", ci: [0] });
    const first = dom.window.litrusGetCraftPublishPayload().catalog.products;
    const second = dom.window.litrusGetCraftPublishPayload().catalog.products;
    assert.equal(String(first[0].id), "7");
    assert.ok(!("client_key" in first[0]), "an existing product is identified by its own id only");
    assert.equal(first[1].id, "", "a new product has no id until the host assigns one");
    assert.match(first[1].client_key, /^new-/);
    assert.equal(second[1].client_key, first[1].client_key, "the key stays the same across autosaves");
  } finally {
    dom.window.close();
  }
});

test("Litrus builder checks the appointment schedule the way the Worker will before publishing", () => {
  const dom = mountCraftPayloadBuilder();
  try {
    const set = (shopFields, services = [{ id: 5, name: "Cut", price: 500, duration_minutes: 45, category_names: ["Hair"], images: [] }]) =>
      dom.window.litrusSetCraftCatalog({
        shop: { name: "Salon", currency: "KES", offer_type: "services", ...shopFields },
        categories: [{ id: 1, name: "Hair" }], products: services
      });
    const problems = () => dom.window.probe.problems();

    set({});
    assert.deepEqual(plain(problems()), [], "sensible defaults are valid");

    set({ service_open_time: "17:00", service_close_time: "09:00" });
    assert.match(problems().join(" "), /Closing time must be later than opening time/);
    set({ service_open_time: "09:00", service_close_time: "09:00" });
    assert.match(problems().join(" "), /Closing time must be later/);
    set({ service_days: [] });
    assert.match(problems().join(" "), /at least one open day/);
    set({ service_timezone: "Mars/Olympus" });
    assert.match(problems().join(" "), /Timezone must be a valid name/);
    set({ service_buffer_minutes: 20 });
    assert.match(problems().join(" "), /Buffer between appointments/);
    set({ service_deposit_percent: 150 });
    assert.match(problems().join(" "), /whole percentage from 0 to 100/);
    set({ service_deposit_percent: 30, currency: "USD" });
    assert.match(problems().join(" "), /only available when prices are in KES/);
    set({ service_deposit_percent: 30 }, [{ id: 5, name: "Free chat", price: 0, category_names: ["Hair"], images: [] }]);
    assert.match(problems().join(" "), /every service a price above zero/);
    set({ service_open_time: "09:00", service_close_time: "10:00", service_buffer_minutes: 30 });
    assert.match(problems().join(" "), /Cut \(45 min\) does not fit between your opening and closing times/);
    set({}, [{ id: 5, name: "Odd", price: 5, duration_minutes: 50, category_names: ["Hair"], images: [] }]);
    assert.match(problems().join(" "), /Odd: duration must be 15 to 240 minutes in 15-minute steps/);
    set({}, [{ id: 5, name: "Long", price: 5, duration_minutes: 480, category_names: ["Hair"], images: [] }]);
    assert.match(problems().join(" "), /Long: duration must be/);

    // Products shops are never held to the appointment rules.
    dom.window.litrusSetCraftCatalog({
      shop: { name: "Shop", offer_type: "products", service_open_time: "18:00", service_close_time: "08:00" },
      categories: [{ id: 1, name: "Hair" }], products: [{ id: 5, name: "Comb", price: 5, category_names: ["Hair"], images: [] }]
    });
    assert.deepEqual(plain(problems()), []);

    // A bad schedule blocks publishing but never blocks the autosave of the owner's other work.
    set({ service_open_time: "17:00", service_close_time: "09:00" });
    assert.throws(() => dom.window.litrusGetCraftPublishPayload({ strict: true }), /Fix the appointment settings before publishing: .*Closing time/);
    assert.ok(dom.window.litrusGetCraftPublishPayload().catalog.products.length === 1);
    dom.window.eval("showServiceProblems()");
    assert.equal(dom.window.document.getElementById("wServiceError").hidden, false, "the owner sees what to fix");
    assert.match(dom.window.document.getElementById("wServiceError").textContent, /Closing time must be later/);
  } finally {
    dom.window.close();
  }
});

test("Litrus builder offers service durations in 15-minute steps from 15 to 240 minutes", () => {
  assert.match(editor, /<select id="editProdDuration">/);
  const select = new JSDOM(editor.match(/<label id="editProdDurationWrap"[^>]*>.*?<\/label>/)[0]).window.document.querySelectorAll("option");
  assert.deepEqual([...select].map(option => Number(option.value)), Array.from({ length: 16 }, (_, index) => (index + 1) * 15));
  assert.equal([...select].find(option => option.selected).value, "60", "an hour is the default");
  const helper = editor.slice(editor.indexOf("function nearestServiceDuration(value){"), editor.indexOf("\nfunction serviceMinutes"));
  const nearest = runInNewContext(`${helper}; nearestServiceDuration`);
  assert.deepEqual([undefined, 0, "abc", 7, 52, 100, 999].map(value => nearest(value)), [60, 60, 60, 15, 45, 105, 240]);
});

test("Litrus builder preview describes booking without pretending to take one", () => {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
  try {
    const helpersStart = editor.indexOf("function fmtDur(m){");
    const helpersEnd = editor.indexOf("\nfunction goTo(route){", helpersStart);
    const previewStart = editor.indexOf("function buildPreview(id,name,price,dur){");
    const previewEnd = editor.indexOf("\nfunction convertPDP(root){", previewStart);
    assert.ok(helpersStart >= 0 && helpersEnd > helpersStart && previewStart >= 0 && previewEnd > previewStart);
    dom.window.eval(`
      var SHOP = { serviceDays: [1, 3], serviceOpenTime: "08:30", serviceCloseTime: "16:00", serviceDepositPercent: 20, serviceTimezone: "Africa/Nairobi" };
      ${editor.slice(helpersStart, helpersEnd)}
      ${editor.slice(previewStart, previewEnd)}
      window.preview = buildPreview("5", "Cut", "500", 90);
    `);
    const preview = dom.window.preview;
    assert.equal(preview.querySelectorAll("form,input,select,textarea,button").length, 0, "nothing in the preview can be filled in or submitted");
    assert.match(preview.textContent, /1 hr 30 min/);
    assert.match(preview.textContent, /Mon, Wed/);
    assert.match(preview.textContent, /08:30 to 16:00/);
    assert.match(preview.textContent, /20% deposit/);
    assert.match(preview.textContent, /This preview cannot take bookings/);
  } finally {
    dom.window.close();
  }
  for (const gone of ["litrus:appointment-request", "Request sent", "svc-done", "wireForm", "Request booking</button>"]) {
    assert.ok(!editor.includes(gone), `the builder must not keep the fake booking form (${gone})`);
  }
  const exportSource = editor.slice(editor.indexOf("function exportShop(){"), editor.indexOf("\nfunction litrusRefreshPublishedCatalog"));
  assert.match(exportSource, /\.sp-toast,\.svc-book/, "the preview-only block is stripped from published pages");
});

test("Litrus published storefront bakes one product page, not one per product", () => {
  const start = editor.indexOf("function staticRoutes(compact){");
  const end = editor.indexOf("\nfunction routeFor(t){", start);
  assert.ok(start >= 0 && end > start);
  const build = compact => runInNewContext(`
    const shopProds = () => Array.from({ length: 120 }, (_, index) => ["P" + index, "1", "", "", "", [], "", "id-" + index]);
    const catList = () => [{ slug: "shoes" }, { slug: "bags" }];
    ${editor.slice(start, end)}
    staticRoutes(${compact})
  `);
  const full = build(false);
  const compact = build(true);
  assert.equal(full.filter(route => route.startsWith("p/")).length, 120, "the zip export keeps every product page");
  assert.deepEqual([...compact].filter(route => route.startsWith("p/")), ["p/id-0"], "one product page is the layout template");
  assert.equal(compact.filter(route => route.startsWith("c/")).length, 0, "category pages are rebuilt from the live catalogue");
  for (const route of ["home", "shop", "page/about", "404"]) assert.ok(compact.includes(route));
  assert.match(editor, /staticRoutes\(true\)\.forEach\(r=>\{/, "the published export uses the compact list");
  assert.match(editor, /staticRoutes\(\)\.filter\(r=>r!=='404'\)/, "the page-by-page zip export still bakes everything");
});

test("Litrus keeps published HTML under the host limit when product photos are stored on the phone", () => {
  const start = editor.indexOf("function litrusFitPublishedHtml(html){");
  const end = editor.indexOf("\nfunction exportShop(){", start);
  assert.ok(start >= 0 && end > start);
  const photo = index => "data:image/jpeg;base64," + String(index).padStart(4, "0").repeat(1) + "A".repeat(50_000);
  const fit = (count, html) => runInNewContext(`
    const CTX = { data: { products: Array.from({ length: ${count} }, (_, index) => ({ img: (${photo.toString()})(index), spin_frames: [] })) } };
    ${editor.slice(start, end)}
    litrusFitPublishedHtml(${JSON.stringify(html)})
  `);
  const heroPhoto = "data:image/png;base64," + "H".repeat(10_000);
  // Every product photo appears twice in the page, like the baked cards and the product list do.
  const page = count => `<img src="${heroPhoto}">` + Array.from({ length: count }, (_, index) => `<i src="${photo(index)}"></i><b src="${photo(index)}"></b>`).join("");
  const small = page(5);
  assert.equal(fit(5, small), small, "a page under the budget is left exactly as built");
  const big = page(40);
  assert.ok(big.length > 3_000_000);
  const fitted = fit(40, big);
  assert.ok(fitted.length <= 2_400_000, `fitted page is ${fitted.length} characters`);
  assert.ok(fitted.includes(heroPhoto), "photos that are not product photos are never replaced");
  assert.ok(fitted.includes(photo(0)), "the first products keep their photos while there is room");
  assert.ok(!fitted.includes(photo(39)), "the last product photo is dropped first");
  assert.match(fitted, /data:image\/gif;base64,/);
  assert.match(editor, /litrusFitPublishedHtml\(exportShop\(\)\)\.replace\(/, "the published payload goes through the size fit");
});

test("Litrus manage page 'Back to the shop' really leaves the page instead of only changing the address bar", async () => {
  // This route renders once and nothing listens for hashchange, so the link must reload (jsdom reports a reload as a navigation it does not implement).
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => {
    if (/navigation/i.test(String(error?.message))) navigations.push(error.message);
  });
  const booking = mountManagePage({ virtualConsole, handler: () => response(200, { appointment: manageFixture() }) });
  try {
    await pause(10);
    const back = [...booking.root.querySelectorAll("a")].find(item => /Back to the shop/.test(item.textContent));
    assert.ok(back, "the manage page offers a way back");
    const click = new booking.window.MouseEvent("click", { bubbles: true, cancelable: true });
    back.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true, "the plain fragment navigation is replaced");
    assert.equal(booking.window.location.hash, "#/", "the shop route is set");
    assert.ok(navigations.length >= 1, "the page reloads so the shop actually renders");
  } finally {
    booking.window.close();
  }
});

// ---------------------------------------------------------------------------
// Rich media on cards, photo editing, owner pictures, gallery/video sections
// ---------------------------------------------------------------------------
test("Litrus listing cards show video, 360 and cutout products without loading their media", () => {
  const dom = new JSDOM("", { url: "https://shop.example/", runScripts: "outside-only" });
  const card = '<article data-pid=""><div class="p-img-wrapper"><img></div><h3 class="p-title"></h3><button class="p-btn" data-add="">Add</button></article>';
  const data = {
    shop: { key: "k", products: [] },
    pages: { home: `<main class="sp-main"><section class="prods">${card}</section></main>`, shop: '<main class="sp-main"><section class="prods"></section></main>' },
    shell: { head: "", foot: "", tail: "" }, templates: { productCard: card }
  };
  const frames = Array.from({ length: 36 }, (_, index) => `/f${index}.jpg`);
  try {
    dom.window.eval(runtime);
    dom.window.litrusRefreshPublishedCatalog(data, {
      categories: [], store: { name: "K", currency: "KES" },
      products: [
        { id: 1, name: "Plain", price: 1, images: ["/a.jpg"] },
        { id: 2, name: "Clip", price: 1, images: ["/b.jpg"], media_type: "video", video_url: "https://cdn.example/c.mp4" },
        { id: 3, name: "Turn", price: 1, images: ["/c.jpg"], media_type: "spin", spin_frames: frames },
        { id: 4, name: "Cut", price: 1, images: ["/d.png"], media_type: "cutout" },
        { id: 5, name: "Broken video", price: 1, images: ["/e.jpg"], media_type: "video", video_url: "" }
      ]
    });
    const page = new dom.window.DOMParser().parseFromString(data.pages.home, "text/html");
    const byId = id => page.querySelector(`[data-pid="${id}"]`);
    assert.equal(byId(1).dataset.media, undefined);
    assert.equal(byId(1).querySelector(".litrus-media-badge"), null);
    assert.match(byId(2).querySelector(".litrus-media-badge").textContent, /Video/);
    assert.equal(byId(2).querySelector("video"), null, "no video element is autoplayed or even created in the list");
    assert.match(byId(3).querySelector(".litrus-media-badge").textContent, /360/);
    const sampled = JSON.parse(byId(3).dataset.cardSpin);
    assert.ok(sampled.length >= 2 && sampled.length <= 12, `only ${sampled.length} spin frames are offered per card`);
    assert.equal(byId(3).querySelectorAll("img").length, 1, "frames are not loaded until hover");
    assert.ok(byId(4).querySelector("img").classList.contains("litrus-cutout"));
    assert.equal(byId(5).dataset.media, undefined, "a video product without a video link is a plain card");
  } finally {
    dom.window.close();
  }
});

test("Litrus card hover previews play one muted video and scrub spin frames, then restore the photo", () => {
  const dom = new JSDOM('<div id="s"><article data-pid="2" data-media="video" data-video-url="https://cdn.example/c.mp4"><div><img src="/b.jpg"></div></article>' +
    '<article data-pid="3" data-media="spin" data-card-spin=\'["/f0.jpg","/f1.jpg","/f2.jpg","/f3.jpg"]\'><div><img src="/c.jpg"></div></article></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  try {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    window.HTMLMediaElement.prototype.pause = () => {};
    window.HTMLMediaElement.prototype.load = () => {};
    window.eval(runtime);
    window.litrusInitCardPreview(window.document);
    const over = (element, type, extra = {}) => element.dispatchEvent(new window.MouseEvent(type, { bubbles: true, ...extra }));
    const videoCard = window.document.querySelector('[data-pid="2"]');
    over(videoCard.querySelector("img"), "pointerover");
    const preview = videoCard.querySelector("video");
    assert.ok(preview && preview.muted && preview.loop, "hovering a video card previews it muted");
    over(videoCard.querySelector("img"), "pointerout", { relatedTarget: window.document.body });
    assert.equal(videoCard.querySelector("video"), null, "leaving removes the preview");
    const spinCard = window.document.querySelector('[data-pid="3"]');
    const image = spinCard.querySelector("img");
    image.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 100 });
    over(image, "pointerover");
    over(image, "pointermove", { clientX: 90 });
    assert.match(image.getAttribute("src"), /f3\.jpg$/);
    over(image, "pointerout", { relatedTarget: window.document.body });
    assert.match(image.getAttribute("src"), /c\.jpg$/);
  } finally {
    window.close();
  }
});

test("Litrus product editor removes and replaces the photo in images[] and clears a cutout", () => {
  const start = editor.indexOf("function litrusEditedPhotoFields(");
  const end = editor.indexOf("\ng('wAdd').onclick", start);
  assert.ok(start >= 0 && end > start);
  const fields = (previous, original, edited) => plain(runInNewContext(`${editor.slice(start, end)}\nlitrusEditedPhotoFields(${JSON.stringify(previous)},${JSON.stringify(original)},${JSON.stringify(edited)})`));
  const cut = { images: ["a", "b"], media_type: "cutout" };
  assert.deepEqual(fields(cut, "a", ""), { img: "b", images: ["b"], media_type: "image" }, "removing the main photo drops it from images[]");
  assert.deepEqual(fields({ images: ["a"] }, "a", ""), { img: "", images: [], media_type: "image" });
  assert.deepEqual(fields(cut, "a", "n"), { img: "n", images: ["n", "b"], media_type: "image" }, "replacing swaps the photo and clears the cutout");
  assert.deepEqual(fields({ images: ["a"], media_type: "video" }, "a", "n"), { img: "n", images: ["n"], media_type: "video" });
  assert.deepEqual(fields(cut, "a", "a"), { img: "a" }, "an untouched photo leaves images and media_type alone");
  assert.deepEqual(fields(null, "", "n"), { img: "n", images: ["n"], media_type: "image" });
});

test("Litrus keeps a full-size product photo for the shop and a small copy for the page", () => {
  assert.match(editor, /PRODUCT_PHOTO_MAX=1600/);
  assert.match(editor, /shrinkImage\(file,PRODUCT_PHOTO_MAX,PRODUCT_PHOTO_QUALITY\)/);
  assert.match(editor, /IMGS\['t'\+id\]=thumb/);
  assert.match(editor, /imgThumbSrc\(x\.img\)/, "the baked page uses the small copy");
  assert.match(editor, /image:imgSrc\(product\.img\)/, "the catalogue payload keeps the full photo");
  assert.match(editor, /used\.add\('t'\+key\)/, "the on-device sweep keeps small copies");
});

test("Litrus video links become a safe player or are refused", () => {
  const start = editor.indexOf("function litrusVideoEmbed(");
  const end = editor.indexOf("\nfunction shopProds(", start);
  assert.ok(start >= 0 && end > start);
  const embed = value => plain(runInNewContext(`${editor.slice(start, end)}\nlitrusVideoEmbed(${JSON.stringify(value)})`, { URL }));
  assert.equal(embed("https://www.youtube.com/watch?v=dQw4w9WgXcQ").src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(embed("https://youtu.be/dQw4w9WgXcQ").src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(embed("https://vimeo.com/123456789").src, "https://player.vimeo.com/video/123456789");
  assert.deepEqual(embed("https://cdn.example/clip.mp4"), { kind: "file", src: "https://cdn.example/clip.mp4", label: "Video" });
  for (const bad of ["javascript:alert(1)", "http://cdn.example/clip.mp4", "https://evil.example/page", "", "data:video/mp4;base64,AAAA"]) {
    assert.equal(embed(bad), null, bad);
  }
});

test("Litrus offers owner uploads for banner and card pictures and gallery and video sections", () => {
  assert.match(editor, /id="wOwnPhotoFile"/);
  assert.match(editor, /\['hero-1','Top banner \(hero\) picture'/);
  assert.match(editor, /imgSrc\(SHOP\.userImages\[slot\]\)/, "uploaded pictures resolve when the page is drawn");
  assert.match(editor, /\['gallery','Photo gallery'\],\['video','Video'\]/);
  assert.match(editor, /content-gallery|'sole-content-block sec content-'\+block\.type/);
  assert.match(editor, /OWN_PHOTO_BUDGET=1500000/, "owner pictures are capped so the page stays under the host limit");
});

test("a published product shows its details, its sold-out sizes and a browse price that reflects them", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const data = {
    shop: { key: "attr-shop", cur: "KES", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button data-act="addqty">Add to cart</button></div></div></div></main>'
    },
    templates: { productCard: '<article data-pid=""><h3 class="p-title"></h3><div class="p-price"></div><button class="p-btn" data-act="addqty">Add to bag</button></article>' }
  };
  const catalog = {
    categories: [{ id: 1, name: "Shirts", slug: "shirts" }],
    store: { name: "Attr Shop", currency: "KES", offer_type: "products" },
    products: [{
      id: 1, name: "Poplin Shirt", slug: "poplin-shirt", price: 1000, stock: 7, category_id: 1,
      images: [], description: "A shirt.",
      option1_name: "Size", option2_name: "Colour",
      sizes: ["S", "M", "L"], colors: ["Red"],
      variants: [
        { id: "vS", option1_value: "S", option2_value: "Red", size: "S", color: "Red", price: 1000, stock: 4 },
        { id: "vM", option1_value: "M", option2_value: "Red", size: "M", color: "Red", price: 1200, stock: 3 },
        { id: "vL", option1_value: "L", option2_value: "Red", size: "L", color: "Red", price: 1500, stock: 0 }
      ],
      taxonomy_attributes: [
        { attributeName: "Fabric", value: "Cotton poplin" },
        { attributeName: "Neckline", value: "Classic collar" }
      ]
    }]
  };
  window.__ESHOP_THEME_CATALOG__ = catalog;
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = () => {};
  let pageFor = () => "";
  window.SPRT = options => {
    pageFor = options.page;
    window.document.getElementById("store").innerHTML = options.page("shop");
    return { go(route) { window.document.getElementById("store").innerHTML = options.page(route); } };
  };
  try {
    window.eval(runtime);
    window.litrusStartLiveStore(data);

    // Browsing shows what the shirt can actually be bought for, not only its base price.
    const card = window.document.querySelector(".prods .p-price");
    assert.equal(card.textContent, "from KES 1,000");

    const parser = new window.DOMParser();
    const productPage = parser.parseFromString(pageFor("p/1"), "text/html");

    // The owner's own details reach the customer instead of only feeding filter dropdowns.
    const specs = productPage.querySelector(".sp-specs");
    assert.ok(specs, "the product page carries a details block");
    assert.match(specs.textContent, /Fabric/);
    assert.match(specs.textContent, /Cotton poplin/);
    assert.match(specs.textContent, /Classic collar/);

    // A size with nothing left says so before it is chosen.
    const sizes = [...productPage.querySelectorAll('[data-variant-option="size"] option')];
    const large = sizes.find(option => option.value === "L");
    assert.match(large.textContent, /sold out/);
    assert.equal(large.disabled, true);
    const medium = sizes.find(option => option.value === "M");
    assert.equal(medium.textContent, "M");
    assert.equal(medium.disabled, false);
  } finally {
    window.close();
  }
});

test("a published product page reprices itself as the shopper picks each option", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const data = {
    shop: { key: "repricing-shop", cur: "KES", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button data-act="addqty">Add to cart</button></div></div></div></main>'
    },
    templates: { productCard: '<article data-pid=""><h3 class="p-title"></h3><div class="p-price"></div></article>' }
  };
  window.__ESHOP_THEME_CATALOG__ = {
    categories: [{ id: 1, name: "Shirts", slug: "shirts" }],
    store: { name: "Repricing Shop", currency: "KES", offer_type: "products" },
    products: [{
      id: 1, name: "Poplin Shirt", slug: "poplin-shirt", price: 1000, stock: 7, category_id: 1,
      images: [], description: "A shirt.",
      option1_name: "Size", option2_name: "Colour",
      sizes: ["S", "M", "L"], colors: ["Red"],
      variants: [
        { id: "vS", option1_value: "S", option2_value: "Red", size: "S", color: "Red", price: 1000, stock: 4 },
        { id: "vM", option1_value: "M", option2_value: "Red", size: "M", color: "Red", price: 1200, stock: 3 },
        { id: "vL", option1_value: "L", option2_value: "Red", size: "L", color: "Red", price: 1500, stock: 0 }
      ]
    }]
  };
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = () => {};
  let pageFor = () => "";
  window.SPRT = options => {
    pageFor = options.page;
    window.document.getElementById("store").innerHTML = options.page("shop");
    return { go(route) { window.document.getElementById("store").innerHTML = options.page(route); } };
  };
  try {
    window.eval(runtime);
    window.litrusStartLiveStore(data);
    // A published page is rebuilt from HTML, so the picker is driven by delegation on #store.
    const store = window.document.getElementById("store");
    store.innerHTML = pageFor("p/1");
    const price = () => store.querySelector(".sp-price").textContent;
    const button = () => store.querySelector("[data-variant-required]");
    assert.equal(price(), "KES 1,000", "the base price shows before anything is picked");
    assert.equal(button().disabled, true, "nothing can be bought before the options are picked");

    const choose = (option, value) => {
      const select = store.querySelector(`[data-variant-option="${option}"]`);
      select.value = value;
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    };
    choose("color", "Red");
    choose("size", "M");
    assert.equal(price(), "KES 1,200", "the medium shirt costs more, and the page says so");
    assert.equal(button().dataset.variantId, "vM");
    assert.equal(button().disabled, false);

    choose("size", "S");
    assert.equal(price(), "KES 1,000");
    assert.equal(button().dataset.variantId, "vS");

    // The sold-out size still shows its price, and still cannot be bought.
    choose("size", "L");
    assert.equal(price(), "KES 1,500");
    assert.equal(button().disabled, true);

    // Clearing an option goes back to the base price rather than keeping a stale one.
    choose("size", "");
    assert.equal(price(), "KES 1,000");
    assert.equal(button().dataset.variantId, undefined);
    assert.equal(button().disabled, true);
  } finally {
    window.close();
  }
});

test("a published page reprices as priced attributes are chosen, and a mixed shop still books its services", () => {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  const data = {
    shop: { key: "mixed-shop", cur: "KES", products: [] },
    pages: {
      home: '<main class="sp-main"><section class="prods"></section></main>',
      shop: '<main class="sp-main"><div class="sp-top"><h1></h1><p></p></div><section class="prods"></section></main>',
      "p/template": '<main class="sp-main"><div class="sp-top"><h1></h1></div><div class="sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button data-act="addqty">Add to cart</button></div></div></div></main>'
    },
    templates: { productCard: '<article data-pid=""><h3 class="p-title"></h3><div class="p-price"></div><button class="p-btn" data-act="addqty">Add to bag</button></article>' }
  };
  window.__ESHOP_THEME_CATALOG__ = {
    categories: [{ id: 1, name: "Shoes", slug: "shoes" }],
    // A shop that sells goods and time side by side.
    store: { name: "Mixed", currency: "KES", offer_type: "both" },
    products: [
      {
        id: 1, name: "Poplin Shirt", slug: "shirt", price: 1000, stock: 7, category_id: 1,
        images: [], description: "A shirt.",
        priced_attributes: [{
          attributeId: "a9", attributeName: "Footwear material",
          values: [{ value: "Canvas", priceDelta: 0 }, { value: "Leather", priceDelta: 500 }]
        }]
      },
      {
        id: 2, name: "Haircut", slug: "haircut", price: 500, stock: 0, category_id: 1,
        images: [], description: "A cut.", duration_minutes: 45
      }
    ]
  };
  window.__ESHOP_TRACK_STOREFRONT_EVENT__ = () => {};
  let pageFor = () => "";
  window.SPRT = options => {
    pageFor = options.page;
    window.document.getElementById("store").innerHTML = options.page("shop");
    return { go(route) { window.document.getElementById("store").innerHTML = options.page(route); } };
  };
  try {
    window.eval(runtime);
    window.litrusStartLiveStore(data);
    const store = window.document.getElementById("store");
    store.innerHTML = pageFor("p/1");
    const price = () => store.querySelector(".sp-price").textContent;
    assert.equal(price(), "KES 1,000");

    const select = store.querySelector('[data-priced-attribute="Footwear material"]');
    assert.ok(select, "a priced attribute is something the shopper can choose");
    const offered = [...select.options].map(option => option.textContent);
    assert.ok(offered.some(text => text.includes("Leather (+KES 500)")),
      `the price of a choice is shown before it is made: ${offered.join(", ")}`);

    select.value = "Leather";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(price(), "KES 1,500", "clicking through attributes changes the price");
    select.value = "Canvas";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(price(), "KES 1,000");
    select.value = "";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(price(), "KES 1,000", "clearing the choice returns to the base price");

    // The haircut in the same shop is booked, not bagged.
    store.innerHTML = pageFor("p/2");
    const buyArea = store.querySelector(".sp-buy");
    assert.ok(!buyArea || buyArea.hidden || buyArea.style.display === "none",
      "a service does not offer Add to bag, even in a shop that also sells goods");
    assert.ok(store.querySelector("[data-litrus-service-booking-form]"),
      "a service in a mixed shop still offers its booking form");

    // And the shirt in that same shop keeps its buy area.
    store.innerHTML = pageFor("p/1");
    const shirtBuy = store.querySelector(".sp-buy");
    assert.ok(shirtBuy && !shirtBuy.hidden, "the shirt is still bought, not booked");
  } finally {
    window.close();
  }
});
