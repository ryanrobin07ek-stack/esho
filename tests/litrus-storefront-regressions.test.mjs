import assert from "node:assert/strict";
import { readFile as readFileRaw } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
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

function mountCheckout({ cart = [variantCartLine], holds = [], products = [sneaker], handler, pay = "Cash on delivery or pickup" } = {}) {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/#/checkout", runScripts: "outside-only" });
  const { window } = dom;
  const root = window.document.getElementById("store");
  root.innerHTML = checkoutForm;
  const requests = [];
  const events = [];
  window.__ESHOP_THEME_CATALOG__ = {
    store: { name: "Main shop", currency: "KES", delivery_fee: 0 }, products, categories: []
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
    handler: () => orderResponse({ order: { discount: 270, total: 2430 }, top: { discount_cents: 27000 } })
  });
  try {
    const field = harness.form.elements.namedItem("discount_code");
    assert.ok(field, "the checkout should offer a discount code field");
    field.value = " save 10 ";
    harness.form.querySelector("[data-discount-apply]").click();
    assert.equal(field.value, "SAVE10");
    assert.match(harness.form.querySelector(".sp-discount-status").textContent, /SAVE10 added.*shop checks it/i);

    await harness.submit();
    assert.equal(harness.requests.length, 1);
    const { url, body } = harness.requests[0];
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
function mountServiceBooking({ handler, deposit = 0, shop = {} } = {}) {
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
  for (const invented of ["Amina W.", "Brian O.", "Faith K.", "Free returns", "2,000+ orders", "4.8 / 5 rating", "Verified buyer", "SHOP.email||'hello@yourshop.com'", "SHOP.phone||'+254 700 000 000'", "'Nairobi, Kenya'", "We usually reply the same day"]) {
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
