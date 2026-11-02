# Craft Theme Engine: Current State and Product-Transfer Assessment

**Prepared:** 2026-10-28  
**Scope:** The existing Aviya Jewellery and Stepz Footwear themes and their current HTML/Liquid-theme integration. This is a status and handoff document; it does not change or deploy either theme.

## Bottom line

The two storefronts the app currently bundles as themes are **Aviya Jewellery** and **Stepz Footwear**. The intended flow is sensible: take each shop's own catalog, render the selected storefront with that data, and publish the resulting HTML. The current mapping does preserve product IDs and transfers names, prices, descriptions, categories, and images into each theme's product data.

However, **the current integration is not complete enough to trust for a live publish**. The theme renderer adds a reference to a catalog-runtime script that is missing from the current workspace. That script is also read by a test, so the existing product-card replacement/filtering path cannot be considered verified. The theme catalog additionally presents a `craft-main-storefront` entry as the main theme even though its old storefront package is deleted locally. That entry and its publishing paths do not match the two bundled HTML themes.

**Assessment:** Product transfer is feasible and partly implemented, but the live preview/publish flow needs to be made internally consistent and tested before relying on it.

## The actual bundled themes and engine files

| Purpose | Current path | What it does |
|---|---|---|
| Aviya theme source | `public\theme-packages\aviya-luxury\index.html` | Standalone jewellery storefront HTML that the Liquid HTML renderer adapts. |
| Stepz theme source | `public\theme-packages\stepz-footwear\index.html` | Standalone shoe storefront HTML that the renderer adapts. |
| Shared Liquid Theme Studio | `public\liquid-themes\theme-studio.html` | Opens the HTML-to-editable-theme Studio and can auto-load a bundled theme using its `loadUrl` parameter. |
| Theme registration | `src\theme-catalog.js` | Lists `craft-main-storefront`, Aviya, and Stepz. Currently all three have `is_main: true`. |
| Aviya/Stepz catalog adapter | `src\liquid-html-theme-renderer.js` | Converts Craft catalog fields into each HTML theme's `CATALOGUE` format and adjusts known sample-data behaviors. |
| Catalog runtime expected by renderer | `/theme-packages/liquid-catalog-runtime.js` | Expected to replace/render storefront product/category UI from the real catalog. **This file is missing in the current workspace.** |
| Theme selection/editor/publish wiring | `index.html` | Chooses themes, loads previews, prepares catalog images, and publishes filled HTML. |
| Worker publish/serve validation | `cloudflare\worker.js` | Allows the three theme IDs and verifies the catalog version and R2/KV publication pointer. |
| Renderer tests | `tests\liquid-html-theme-renderer.test.mjs` | Checks data mapping and expects the catalog runtime to render products and filter by category. |

The machine path mentioned in the earlier conversation, `C:\Users\ADMIN\Downloads\ur gane\my-own-theme`, is a separate folder and is **not** either of the two bundled themes described here.

## How product and category transfer is supposed to work

### 1. Preview

1. The app reads products, categories, and store settings from the active shop's Craft catalog.
2. `index.html` fetches the selected theme HTML from `/theme-packages/aviya-luxury/index.html` or `/theme-packages/stepz-footwear/index.html`.
3. `renderLiquidHtmlTheme()` in `src\liquid-html-theme-renderer.js` normalizes Craft's fields and replaces the theme's sample `CATALOGUE` initializer.
4. It preserves product IDs, maps product names/prices/descriptions/images and category IDs/names, and adds a JSON catalog payload plus a script reference to the expected catalog runtime.
5. The shared Theme Studio opens the bundled HTML for editing.

### 2. Publish

1. The app uploads data-URL images and copies eligible external product images to R2.
2. It sends the shop catalog, preserving product IDs, to the Worker.
3. It renders the selected theme with the same catalog and sends the filled HTML to `/api/theme-publish`.
4. The Worker stores the HTML in R2 and records the publication pointer in KV. The public route checks that the pointer and catalog version match before serving the site.

That design keeps the shop catalog as the source of truth. A theme should affect presentation, not create or rename products in Craft. Product IDs must remain unchanged because orders, holds, and analytics use them to identify catalog products.

## What the current adapter maps

`normalizeLiquidHtmlThemeCatalog()` filters archived/unpublished entries and maps:

- Product ID, name, description, price, category ID/name, brand, images, sizes, colors, stock, and SKU.
- Category ID, name, description, and image.
- Store currency into the rendered theme's runtime configuration.

The renderer adapts theme-specific structures:

- **Aviya:** maps products into an object keyed by product ID and removes hard-coded first-demo-product fallbacks for product details and cart actions.
- **Stepz:** maps products into an array, clears sample cart/wishlist/compare/recent-history/orders state, removes simulated payment success, and changes hard-coded product selection to use the merchant catalog.

This is a good starting direction, but it does not by itself prove every customer-facing card, category link, product detail, cart, checkout, or editor panel uses the mapped catalog.

## Confirmed gaps and risks

### 1. Missing catalog runtime

`src\liquid-html-theme-renderer.js` injects this script:

```html
<script src="/theme-packages/liquid-catalog-runtime.js" defer></script>
```

But `public\theme-packages\liquid-catalog-runtime.js` is absent. The test `catalog runtime renders real products and filters cards by shop category` also tries to read that missing file. Until the runtime exists and the test passes, do not claim that the actual page's product cards and category filters have been fully replaced with Craft data.

### 2. Main theme registration does not match local theme files

`src\theme-catalog.js` currently lists:

- `craft-main-storefront` — named “My Own Theme,” marked `is_main`, set to `liquid-html`, with an empty `preview_url`.
- `aviya-luxury` — Aviya HTML package.
- `stepz-footwear` — Stepz HTML package.

The old local `public\theme-packages\craft-main-storefront\index.html` and `studio.html` are deleted. Yet editor preview logic still has a special `craft-main-storefront` path referring to `/liquid-themes/my-own-theme/studio.html`, and the regular `liquid-html` publishing path expects `/theme-packages/<theme-id>/...`. Neither is a coherent path for the two actual bundled storefronts.

The `craft-main-storefront` ID is also present in Worker allowlists and serving logic. Do not remove or repoint its production behavior casually: existing D1 catalog theme IDs, KV pointers, and R2 publications may depend on it. First distinguish the user-facing theme choices from IDs already published in production.

### 3. New-site picker offers three `is_main` themes

The picker filters for `is_main === true` or `editor_mode === "liquid-html"`. Since the catalog marks Craft, Aviya, and Stepz as main themes, the current picker can offer the stale `craft-main-storefront` item in addition to the two real bundled HTML themes. If the intended theme choices are Aviya and Stepz, the catalog and default selection should say that explicitly while preserving any IDs still needed by existing shops.

### 4. The renderer is not a general Liquid theme runtime

The adapter uses LiquidJS to render a small JSON template, but the storefront integration primarily replaces known JavaScript `CATALOGUE` blocks using theme-specific regular expressions and then relies on DOM/runtime behavior. It is not a generic interpreter for arbitrary Liquid theme files. Aviya and Stepz work only as far as their current markup and known script patterns match those adapters.

That is acceptable for two specifically supported HTML themes if it is deliberate and covered by tests. It should not be described as automatic support for every future HTML theme.

### 5. Some theme sections still assume product data exists

The renderer adds guards around some hard-coded product selections, but a complete empty-catalog check needs to exercise the actual home, category, product, cart, and search screens for both themes. Test that an empty shop does not show theme demo products, sample orders, broken product actions, or a fake “successful” payment.

### 6. Product price and image normalization need field-level verification

The adapter accepts several price and image field spellings, but each real Craft record shape should be checked. In particular:

- Confirm whether `price_cents` is already in currency minor units before treating it as a display price.
- Confirm nested image objects and R2 URLs resolve under the published shop hostname.
- Keep category ID relationships intact; name matching is only a fallback and may be ambiguous when category names repeat.
- Do not add a fallback that silently substitutes the first merchant product for a missing ID.

### 7. A successful D1 catalog write alone is not a successful publish

Catalog upload happens before theme rendering and theme publication. If the latter step fails, the catalog may have been updated while the theme pointer still refers to an older or missing version. Publish success should only be reported after both steps succeed, and the live hostname should be checked against the exact catalog version.

## Recommended completion sequence

1. **Keep the scope to Aviya and Stepz.** Treat them as the bundled storefront themes; do not bring in another theme directory.
2. **Resolve the stale main-theme entry.** Decide whether it remains only as a compatibility ID or should be removed from new-shop choices. Preserve any production compatibility required by existing catalogs/publications.
3. **Implement or restore the shared catalog runtime** at the exact URL the renderer injects. It must create product/category cards from the normalized payload, retain original product IDs in every action/link, and show no sample catalog entries.
4. **Wire editor preview to the actual selected package.** Verify that selecting Aviya loads Aviya and selecting Stepz loads Stepz automatically, with the active shop's own catalog and tenant-scoped settings.
5. **Use one verified render path for preview and publish** so the page being published matches what the editor preview shows.
6. **Test both themes with real-shaped data and an empty catalog.** Cover products, category filtering, product details, cart IDs, no-image products, all screens, and no demo checkout/order behavior.
7. **Verify Worker compatibility and publication freshness.** Keep IDs stable, publish catalog first, publish matching filled HTML second, then check the live hostname and product endpoints.
8. **Only then build/install/deploy** if requested. Do not delete production theme assets or migrate shop data as part of merely fixing the renderer.

## Suggested acceptance checks

- Aviya preview shows only the active shop's product/category names and images.
- Stepz preview shows only the active shop's product/category names and images.
- Clicking a theme product keeps the original Craft product ID through detail/cart/order calls.
- Category filtering uses category IDs from Craft rather than sample theme IDs.
- An empty catalog yields no demo product cards or sample customer orders.
- Missing product images remain empty/neutral rather than becoming CSS/SVG sample artwork.
- Different shops do not share editor settings or saved theme content.
- Preview and published HTML are generated from the same renderer and catalog version.
- Worker reports the published theme pointer matches the D1 catalog version.
- Both actual shop hostnames load the expected theme after publication.

## Files not changed by this handoff

This document records the current state only. It does not edit the renderer, create the missing runtime, change theme metadata, migrate shop catalogs, publish HTML, deploy the Worker, purge Cloudflare cache, or install an Android build.
