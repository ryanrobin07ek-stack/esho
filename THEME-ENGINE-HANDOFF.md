# Theme engine: retired

**Status (2026-11-18):** the hosted theme engine is retired. Nothing in the earlier version of this document (Aviya and Stepz themes, the Liquid catalog runtime, the `craft-main-storefront` "My Own Theme" picker entry, the "finish the theme fill" plan) describes the app any more, so it was removed. Do not restore any of it.

## Where the website editor lives now

**Litrus Mixer** is the only website editor.

- Editor: `public/litrus-mixer/index.html` (hosted in an iframe by `index.html`; routes `/account/web/site?...`).
- Published storefront runtime: `public/litrus-mixer/live-catalog.js`.
- Picker list: `src/theme-catalog.js` (one entry, `litrus-mixer`).
- Publishing: Craft saves the editor's baked HTML, writes the catalog to D1 (`PUT /api/catalog`) and sends the HTML to `POST /api/theme-publish`. The Worker stores it in R2 (`published-sites/<shop>/litrus-mixer/...`) and a KV pointer (`published-theme:<shop>`). See `README.md` and `APP_ARCHITECTURE.md` section 7.

## What was removed and why

Removed on purpose by the owner: the old website themes, Theme Studio, `public/builder-storefront.html`, `register.html` (the standalone browser register) and the `live-websites` flow.

The earlier handoff documented that the old HTML/Liquid theme path was never made coherent: its catalog runtime script was missing, the picker offered a stale main-theme entry whose files were deleted, only a few themes had verified shop-data mappings, and a catalog write could succeed while the theme publish failed. The owner chose to keep a single editor rather than finish that engine.

## What still exists, and what it means

- `cloudflare/worker.js` keeps `LEGACY_THEME_IDS`. Shops that published a retired theme before it was removed keep serving their stored HTML, and catalog edits keep advancing it. Nothing can publish a retired theme any more (`POST /api/theme-publish` returns `422`). `craft-main-storefront` (the Craft platform's own main-shop storefront) is still an accepted theme ID.
- The Worker still serves `/themes/<id>/<asset>` from R2 for non-HTML assets of retired themes, and answers `/theme-skeletons/*` with 404.
- Unused leftover code may remain in the tree: `public/theme-packages/`, `public/theme-skeleton-*.js`, `public/theme-importer.js`, `public/theme-catalog-adapter.js`, `public/liquid-html-theme-renderer.js`, `src/liquid-*.js`, `experiments/liquid-themes/`, `docs/engine/`, `scripts/sync-storefront-engine.mjs`, `src/browser-register.*`, and non-Litrus branches in `index.html`. None of it is reachable from the picker or the publish path. Deleting it is cleanup work for later, done with care: `src/bootstrap.js` and `index.html` still import or reference some of it, and the Worker's handling of already-published legacy shops must stay. Check `git ls-files` first.
- A few older tests still read this retired code; they should be rewritten or removed together with it, not used as a reason to bring the themes back.
