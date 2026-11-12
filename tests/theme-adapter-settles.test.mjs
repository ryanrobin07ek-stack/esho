import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const adapter = await readFile(new URL("../public/theme-catalog-adapter.js", import.meta.url), "utf8");

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

test("theme catalog adapter settles after applying products and observing theme mutations", async () => {
  const dom = new JSDOM(`<!doctype html>
    <html><head></head><body>
      <main>
        <section aria-label="Featured products">
          <div class="product-grid">
            <article class="product-card">
              <a href="#"><img src="/old.jpg" alt="Old product"><h3>Old product</h3></a>
              <strong class="price-current">KES 1</strong>
            </article>
          </div>
        </section>
      </main>
      <footer></footer>
    </body></html>`, {
    runScripts: "outside-only",
    url: "https://theme.example/"
  });
  const { window } = dom;
  window.fetch = async () => ({ ok: true });
  window.__ESHOP_THEME_CATALOG__ = {
    products: [
      { id: 1, name: "First product", price: 100, stock: 2, category_id: 7, images: ["/first.jpg"], booking_enabled: true },
      { id: 2, name: "Second product", price: 200, stock: 3, category_id: 7, images: ["/second.jpg"] }
    ],
    categories: [{ id: 7, name: "Products" }],
    store: { currency: "KES", hold_duration_hours: 12 }
  };
  const observedMutations = [];
  const mutationObserver = new window.MutationObserver(records => observedMutations.push(...records));
  mutationObserver.observe(window.document.body, { childList: true, subtree: true });

  window.eval(adapter);
  await pause(120);
  const grid = window.document.querySelector(".product-grid");
  assert.equal(grid.querySelectorAll("[data-eshop-product-id]").length, 2);
  assert.deepEqual(
    [...grid.querySelectorAll("[data-eshop-product-id] h3")].map(node => node.textContent),
    ["First product", "Second product"]
  );
  assert.equal(grid.querySelectorAll("[data-eshop-add-to-bag]").length, 2);
  assert.equal(grid.querySelectorAll("[data-eshop-wishlist-toggle]").length, 2);
  grid.querySelector("[data-eshop-wishlist-toggle]").dispatchEvent(
    new window.MouseEvent("click", { bubbles: true, cancelable: true })
  );
  await pause(30);
  assert.equal(window.localStorage.getItem("storefront.wishlist"), '["1"]');
  assert.equal(grid.querySelector("[data-eshop-wishlist-toggle]").getAttribute("aria-pressed"), "true");
  for (const image of grid.querySelectorAll("[data-eshop-product-id] img")) {
    assert.equal(image.loading, "lazy");
    assert.equal(image.width, 800);
    assert.equal(image.height, 920);
  }

  const themeUpdate = window.document.createElement("p");
  themeUpdate.textContent = "Theme added content";
  window.document.querySelector("main").append(themeUpdate);
  await pause(180);
  const settledMutationCount = observedMutations.length;
  await pause(240);
  assert.equal(observedMutations.length, settledMutationCount,
    "Adapter DOM writes must not cause a follow-up MutationObserver loop.");
  assert.equal(grid.querySelectorAll("[data-eshop-product-id]").length, 2);
  grid.querySelector("[data-eshop-product-open]")?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await pause(40);
  assert.ok(window.document.querySelector("[data-eshop-product-hold-form]"));
  assert.match(window.document.querySelector("[data-eshop-product-hold-form]").textContent, /12 hours/);

  mutationObserver.disconnect();
  dom.window.close();
});
