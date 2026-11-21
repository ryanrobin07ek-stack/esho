// Big shops on a phone: the shop and category pages show 24 products at a time, many products never
// become a one-per-row list, and the home page never stacks more than 8 categories in one column.
// The first group reads the page source and pins the constants and markup; the second runs the real
// storefront runtime (SPRT, the same function the published pages embed) in jsdom.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const editor = (await readFile(new URL("../public/litrus-mixer/index.html", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const start = editor.indexOf("function SPRT(D){");
const end = editor.indexOf("/* ===== SHOP PAGES", start);
assert.ok(start >= 0 && end > start, "SPRT source must be found");
const runtimeSource = editor.slice(start, end);
const bigShopsCss = editor.slice(editor.indexOf('<style id="big-shops">'), editor.indexOf("</style>", editor.indexOf('<style id="big-shops">')));

test("paging constants and markup are pinned", () => {
  assert.match(runtimeSource, /const PAGE_SIZE=24,MANY_PRODUCTS=8,CAT_CAP=8,/);
  assert.match(runtimeSource, /class="sp-pager"|className='sp-pager'/);
  assert.match(runtimeSource, /<button type="button" class="sp-more" data-more>Show more<\/button>/);
  assert.match(runtimeSource, /'Showing '\+limit\+' of '\+total/);
  assert.match(runtimeSource, /c\.hidden=true;c\.setAttribute\('data-pg-out',''\)/, "cards past the page are kept in the page but hidden");
  assert.match(runtimeSource, /bigShops\(w,cur\);\n {2}if\(D\.after\)D\.after\(w,cur\)/, "paging runs on every draw, before the page hooks");
  assert.match(runtimeSource, /t\.closest\('\[data-more\]'\)/);
  assert.match(runtimeSource, /More categories \('\+/);
  assert.match(runtimeSource, /data-cats-more/);
  assert.match(runtimeSource, /sec\.querySelector\('\.cat-marquee-wrap'\)\)return/, "the marquee style is left alone");
});

test("the paging runtime is self-contained so the published page can embed SPRT.toString()", () => {
  // Everything the paging code uses must be declared inside SPRT (or be a browser global).
  const block = runtimeSource.slice(runtimeSource.indexOf("const PAGE_SIZE"), runtimeSource.indexOf("const syncVariantPicker"));
  assert.ok(block.length > 500);
  for (const outside of ["CTX", "SHOP", "catList", "escH", "shopProds", "cs.value", "ps.value"]) {
    assert.ok(!new RegExp(`\\b${outside.replace(".", "\\.")}\\b`).test(block), `paging code must not use ${outside}`);
  }
});

test("styles: 44px buttons, two columns for many products on phones, hidden cards stay hidden", () => {
  assert.ok(bigShopsCss.length > 500, "big-shops style block exists");
  assert.match(bigShopsCss, /\.sp-more,\.sp-cats-toggle\{[^}]*min-height:48px/);
  assert.match(bigShopsCss, /\[data-pg-out\]\[data-pg-out\]\{display:none!important\}/);
  assert.match(bigShopsCss, /@media\(max-width:600px\)/);
  assert.match(bigShopsCss, /sp-many\.sp-many:is\(\.lay6,\.lay8,\.lay10,\.lay11,\.lay12,\.lay13,\.lay14,\.lay15,\.lay16,\.lay17\)\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(bigShopsCss, /sp-many\.sp-many\.lay7 .*84px/);
  assert.match(bigShopsCss, /sp-many\.sp-many\.lay19/);
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(bigShopsCss.replace(/#store/g, "")), "no new colours");
});

test("preview iframe forwards the new buttons to the live storefront", () => {
  assert.match(editor, /closest\('\[data-more\],\[data-cats-more\]'\)/);
  assert.match(editor, /previewSource\.querySelectorAll\(sel\)\[\[\.\.\.doc\.querySelectorAll\(sel\)\]\.indexOf\(pagingButton\)\]/);
});

test("the footer lists the first 12 categories and the shop page link", () => {
  assert.match(editor, /const footerCategories=categories\.slice\(0,12\)\.map\(/);
  assert.match(editor, /All categories/);
});

// ---- jsdom: the real runtime ----
const card = (id, cats = "A") => `<div class="p-card sole-product" data-pid="p${id}" data-cats="${cats}"><a class="p-title" href="#" data-go="p/p${id}">Product ${id}</a><button type="button" class="sole-product-add" data-add="p${id}">Add</button></div>`;
const gridPage = (count, extra = "") => `<main class="sp sp-main"><div class="sp-top"><h1>All products</h1></div><div class="prods sole-product-grid lay1">${Array.from({ length: count }, (_, i) => card(i + 1)).join("")}</div>${extra}</main>`;
const catSection = (count, style = "cat-circles") => `<section class="cgw"><div class="${style}">${Array.from({ length: count }, (_, i) => `<a class="litrus-category-link cat-circle" href="#" data-go="c/cat-${i + 1}" data-litrus-category="cat-${i + 1}"><span>Category ${i + 1}</span></a>`).join("")}</div></section>`;

function boot(pages, { preview = false } = {}) {
  const dom = new JSDOM('<div id="store"></div>', { url: "https://shop.example/", runScripts: "outside-only" });
  const { window } = dom;
  window.eval(`${runtimeSource}\nwindow.SPRT = SPRT;`);
  const root = window.document.getElementById("store");
  const products = Array.from({ length: 120 }, (_, i) => ({ id: `p${i + 1}`, name: `Product ${i + 1}`, num: 100 }));
  const controller = window.SPRT({
    root, hash: false, preview,
    shop: () => ({ key: "big", name: "Big", cur: "KES", products }),
    page: route => (typeof pages[route] === "function" ? pages[route]() : pages[route] || (route.startsWith("p/") ? '<main class="sp sp-main"><h1>Details</h1></main>' : null)),
    shell: () => ({ cls: "sole-store", style: "", head: "", foot: "", tail: "" })
  });
  const click = element => element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const visibleCards = () => [...root.querySelectorAll(".sole-product")].filter(c => !c.hidden);
  const pager = () => root.querySelector(".sp-pager");
  return { dom, window, root, controller, click, visibleCards, pager };
}

test("shop page: 100 products show 24 first, then Show more reveals 24 at a time with a counter", () => {
  const t = boot({ shop: gridPage(100) });
  try {
    t.controller.draw("shop");
    assert.equal(t.root.querySelectorAll(".sole-product").length, 100, "all products stay in the page");
    assert.equal(t.visibleCards().length, 24);
    assert.equal(t.root.querySelectorAll(".sole-product[hidden][data-pg-out]").length, 76, "the rest carry the hidden attribute");
    assert.match(t.pager().textContent, /Showing 24 of 100/);
    const more = t.pager().querySelector("button[data-more]");
    assert.equal(more.textContent, "Show more");
    assert.equal(more.type, "button");
    assert.equal(more.disabled, false);
    assert.equal(t.root.querySelector(".prods").nextElementSibling, t.pager(), "the button follows the grid");
    t.click(more);
    assert.equal(t.visibleCards().length, 48);
    assert.match(t.pager().textContent, /Showing 48 of 100/);
    for (let i = 0; i < 3; i++) t.click(t.pager().querySelector("[data-more]"));
    assert.equal(t.visibleCards().length, 100);
    assert.match(t.pager().textContent, /Showing 100 of 100/);
    assert.equal(t.pager().querySelector("[data-more]").hidden, true, "no button once everything is showing");
    assert.equal(t.controller.route(), "shop", "paging does not navigate");
  } finally { t.dom.window.close(); }
});

test("paging keeps card clicks, the cart and hash routing working", () => {
  const t = boot({ shop: gridPage(60) });
  try {
    t.controller.draw("shop");
    t.click(t.pager().querySelector("[data-more]"));
    assert.equal(t.visibleCards().length, 48);
    t.click(t.root.querySelector('.sole-product[data-pid="p30"] .sole-product-add'));
    assert.deepEqual(JSON.parse(t.window.localStorage.getItem("sp:big:cart")).map(i => i.id), ["p30"]);
    assert.equal(t.controller.route(), "shop");
    t.click(t.root.querySelector('.sole-product[data-pid="p5"]'));
    assert.equal(t.controller.route(), "p/p5", "tapping a card opens the product");
    t.controller.go("shop");
    assert.equal(t.controller.route(), "shop");
    assert.match(t.pager().textContent, /Showing 48 of 60/, "coming back from a product keeps what was already shown");
  } finally { t.dom.window.close(); }
});

test("category pages are paged too, small lists are not, and 9 products only switch the grid to two columns", () => {
  const t = boot({ "c/shoes": gridPage(30), shop: gridPage(24), "c/hats": gridPage(9), "c/few": gridPage(8) });
  try {
    t.controller.draw("c/shoes");
    assert.equal(t.visibleCards().length, 24);
    assert.match(t.pager().textContent, /Showing 24 of 30/);
    assert.ok(t.root.querySelector(".prods").classList.contains("sp-many"));
    t.controller.draw("shop");
    assert.equal(t.pager(), null, "24 or fewer: no button");
    assert.equal(t.visibleCards().length, 24);
    t.controller.draw("c/hats");
    assert.equal(t.pager(), null);
    assert.ok(t.root.querySelector(".prods").classList.contains("sp-many"), "more than 8 products");
    t.controller.draw("c/few");
    assert.ok(!t.root.querySelector(".prods").classList.contains("sp-many"), "8 products or fewer");
  } finally { t.dom.window.close(); }
});

test("a baked page (already paged) is repaged cleanly when the catalogue changes underneath it", () => {
  const t = boot({ shop: gridPage(100) });
  try {
    t.controller.draw("shop");
    const baked = t.root.firstElementChild.innerHTML;
    const again = boot({ shop: baked.replace(/<main/, "<main") });
    again.controller.draw("shop");
    assert.equal(again.root.querySelectorAll(".sp-pager").length, 1, "one button, not two");
    assert.equal(again.visibleCards().length, 24);
    again.dom.window.close();
  } finally { t.dom.window.close(); }
});

test("the builder preview does not move focus and starts from 24 on each draw", () => {
  const t = boot({ shop: gridPage(60) }, { preview: true });
  try {
    t.controller.draw("shop");
    t.click(t.pager().querySelector("[data-more]"));
    assert.equal(t.visibleCards().length, 48);
    t.controller.draw("shop");
    assert.equal(t.visibleCards().length, 24, "a redraw (any control change) starts again from 24");
  } finally { t.dom.window.close(); }
});

test("home page: 25 categories show 8, then a More categories button reveals the rest", () => {
  const t = boot({ home: `<main class="sp sp-main">${catSection(25)}</main>` });
  try {
    t.controller.draw("home");
    const shown = () => [...t.root.querySelectorAll("[data-litrus-category]")].filter(a => !a.hidden);
    assert.equal(t.root.querySelectorAll("[data-litrus-category]").length, 25, "every category stays in the page");
    assert.equal(shown().length, 8);
    const toggle = t.root.querySelector("button[data-cats-more]");
    assert.equal(toggle.textContent, "More categories (17)");
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    t.controller.draw("home");
    assert.equal(t.root.querySelectorAll("button[data-cats-more]").length, 1, "drawing again does not add a second button");
    t.click(t.root.querySelector("button[data-cats-more]"));
    assert.equal(shown().length, 25);
    assert.equal(t.root.querySelector("button[data-cats-more]").getAttribute("aria-expanded"), "true");
    t.click(t.root.querySelector("button[data-cats-more]"));
    assert.equal(shown().length, 8);
    assert.equal(t.controller.route(), "home");
  } finally { t.dom.window.close(); }
});

test("home page: 8 categories get no button, and the Infinite marquee is left alone", () => {
  const t = boot({ home: `<main class="sp sp-main">${catSection(8)}</main>` });
  try {
    t.controller.draw("home");
    assert.equal(t.root.querySelector("button[data-cats-more]"), null);
  } finally { t.dom.window.close(); }
  const marquee = boot({ home: `<main class="sp sp-main"><section class="cgw"><div class="cat-marquee-wrap"><div class="cat-marquee">${catSection(25).replace(/<\/?section[^>]*>/g, "")}</div></div></section></main>` });
  try {
    marquee.controller.draw("home");
    assert.equal(marquee.root.querySelector("button[data-cats-more]"), null);
    assert.equal(marquee.root.querySelectorAll("[hidden]").length, 0);
  } finally { marquee.dom.window.close(); }
});
