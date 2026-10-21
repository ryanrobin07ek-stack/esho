# Copilot handoff: finish the theme fill for all themes

Read this whole file before doing anything. Work in the steps below. STOP at the end of each step and wait for approval.

## 0. Working rules (these exist because earlier sessions burned a lot of tokens for little result)

1. NO background agents or sub-agents. Do the work yourself in this session.
2. NEVER print full test output. Write output to a file and show only failing test names with a one-line reason.
3. Do not re-read files you already read this session. Do not re-run the whole test suite after every small edit; run only the affected theme.
4. Maximum 3 attempts per theme. If it is still failing, stop, record the reason in the report, and move to the next theme.
5. Do not touch the three themes that already work (cira-atelier, aura-luxe, kicks-vault) except to keep their tests passing.
6. Do not touch: `src/pos.js`, `src/business-lens.js`, migrations, `www/`. In `cloudflare/worker.js` change ONLY the list of supported theme IDs (around lines 8-11) and only for themes that pass all tests.
7. No new dependencies without asking.
8. Mark every finding Verified (with file:line or command output), Reported, or Unverified. End every step with "What I did NOT verify".
9. Keep changes small and committable. One commit per step.

## 1. Background (what is proven, and the root cause found in the skeletons)

Prototype files delivered with this handoff, to be placed in `docs/theme-engine/prototype/`:
`fill.mjs`, `run.mjs` (tests ORIGINAL themes), `skel-run.mjs` (tests your generated SKELETONS), `skel-leak.py` (scans skeletons for leftover demo content), `field-maps.json`, `RESULTS.md`.
Harness: replaces a theme's product data with 3 fake shop products, renders in headless Chromium (CDN libs stubbed), checks products visible, JS errors, demo names left.

### 1.1 Proven on the ORIGINAL theme HTML
17 themes render the shop's products with 0 JS errors when only their data arrays are replaced (table in 2.4). 6 fail, 4 not attempted (`RESULTS.md`).

### 1.2 ROOT CAUSE: the skeleton converter destroys the data placeholders in JS templates
Evidence (Verified by running the harness on the generated skeletons, `public/theme-skeletons/*`):
- Filling the generated skeletons with the same 3 test products shows products only for aura-luxe and kicks-vault (the two that were fixed by hand). Every other skeleton shows 0 of 3.
- Cause: for JS-built themes the converter also strips the HTML inside JavaScript template literals. Example, elura-botanicals `renderProductCard`:
  - original: `<img src="${product.image}" alt="${product.name}" class="...">`
  - skeleton: `<img class="... eshop-placeholder-media" />`
  The `${...}` expressions that insert name, price, image and category are removed or replaced by static skeleton bars. Data cannot render no matter what array is injected.
- Measured: count of `${` inside `<script>` blocks, skeleton vs original: aura-luxe 100%, kicks-vault 100%, all others 8% to 66% (elura 21%, autopro 22%, etalon 20%, kinetic 13%, veluna 18%, woodora 22%, aurex 20%, shamba 11%, olkeri 8%, arcadia 10%, maison-elysee 10%, kifaru 27%, nairobi 41%, aurus 34%, elysian 34%, atelier-vera 37%, mikaa 59%, aurelia 66%). Overall 29% (1286 of 4451).
- This is why `dataBindings` and `repeaters` are empty for 23 themes: there is nothing left to bind.

Other skeleton findings (Verified, `skel-leak.py`):
- aurex-electronics: all 104 demo products (names, prices) are still embedded in `window.AUREX_PRODUCTS`. The scrubber only handled `APP_STATE`. Anyone fetching `public/theme-skeletons/aurex-electronics/index.html` sees them.
- aura-luxe: placeholder contacts left (`+254 700 000 000`, `+254 712 345 678`, `client@example.com`, `lilian.wangari@example.co` which is a demo person's name).
- cira-atelier: `enquiries@cira-atelier.example`.
- Demo names left in page text: kifaru-build 3, maison-alchemie 4, shamba-bora 2, veluna 1.
- Skeletons carry `data-eshop-skeleton-preview` on `<html>`; a built-in script then turns all visible text into bars. The fill step MUST remove this attribute (the test harness does).
- `kinetic` contains `jack@greensock.com`: an animation library licence comment, not demo content. Ignore.
- Skeleton files under `public/` are fetchable by anyone. Decide whether that is acceptable.

### 1.3 Limits of the prototype
Only 3 products tested (0, 1, exact-fit, too-many NOT tested). Hardcoded copy (hero, reviews, phone, socials, meta) not handled. The theme's own photo picker and category lists not handled. "Shown" means the 3 test names appear on the default page; other routes not visited. Template mode uses Node `vm` (build time only, see 2.2).

Paths: delivered zip `themes-html-css/<folder>/index.html` = repo `live-websites/<folder>/index.html`. Generated skeletons = `public/theme-skeletons/<theme>/`. Adjust harness constants.

## 2. How the fill works (design decisions already made)

Hybrid approach, already approved: data injection for repeated content, explicit slots for static copy.

### 2.1 One fill function
The existing shared function `fillThemeForShop` (public/theme-skeleton-client.js, public/theme-skeleton-engine.js) must remain the ONLY fill function, used by preview, editor and publish. Do not create a second copy. Port the prototype logic into it.

### 2.2 Build time vs run time
The prototype's "template mode" evaluates the theme's original first item with Node `vm`. That must NOT run in the browser. Do this at BUILD time in `scripts/`:
- For each theme, evaluate the original data once, take the first item as a template, and store it in the theme's `schema-v2.json` under a new key `dataSeed` as plain JSON (with demo strings already blanked).
- At run time the engine only does string replacement of the array literal with JSON. No `eval`, no `vm`.

### 2.3 Per-theme data operations
Store each theme's operations in its `schema-v2.json` (`dataSeed.ops`). Operation kinds, all proven in the prototype:

| kind | what it does |
|---|---|
| `simple` | Replace the array literal with shop products mapped through the theme's field map (`field-maps.json`). Also turn ON every boolean flag found in the original items (featured, bestSeller, isNew, deal, ...) except out-of-stock/sold-out style flags, and set `badge:'New'` if the theme has `badge`. THIS IS REQUIRED: home-page sections are built by filtering on these flags, and with flags off they render empty. |
| `template` | Clone the theme's own first item as a template so every field the theme's code reads exists (e.g. `sizes[0]`, `priceUSD`). Blank demo strings, set name/price/image/category/description from the shop. |
| `empty` | Replace an "extra variants" list with `[]` so the theme cannot pad the catalog with demo products. |
| `freezeSelf` / `freeze` | After the declaration, add `NAME.push=function(){return 0};` so load-time generator loops cannot add demo items back. |
| `custom` | Theme stores rows in its own format. Write a builder. |

### 2.4 Operations per theme (from the prototype run)

| theme | array (in the HTML) | op |
|---|---|---|
| aura-luxe | CATALOGUE | simple |
| elura-botanicals | PRODUCTS_CATALOGUE | simple |
| autopro-kenya | PRODUCTS_DATABASE | simple |
| etalon | CATALOGUE_PRODUCTS | simple |
| kinetic-electronics | PRODUCTS | simple |
| veluna | PRODUCTS | simple |
| woodora | PRODUCTS | simple |
| aurex-electronics | window.AUREX_PRODUCTS | simple |
| shamba-bora | PRODUCTS_DATA | simple |
| nairobi-feast | MENU_DATABASE | simple |
| aurus-real-estate | PROPERTIES_DATA | simple |
| elysian-stays | INITIAL_PROPERTIES | simple |
| volthaus | PRODUCTS (declared `const PRODUCTS = [];` and filled by generators) | simple + freezeSelf |
| maison-alchemie | PRODUCTS | template |
| olkeri-expeditions | PACKAGES | template |
| kicks-vault | MODEL_BLUEPRINTS (seed) + EXTRA_VARIANTS | template + empty |
| atelier-vera | RAW_CATALOG (positional rows `[category,title,priceUSD,compareUSD,badge,material,origin,sizes,colors]`) | custom |

Prototype code: `fill.mjs` (functions `fillHtml`, `fillHtmlTemplate`, `fillMulti`), `OPS` table in `run.mjs` and `skel-run.mjs`. `fill.mjs` also finds arrays preceded by a `/*__ESHOP_DATA_x__*/` marker.

## 3. Steps

### Step 1: read-only status check and confirm the root cause (no code changes)
Report with file:line evidence:
1. `git status --short` summary.
2. Which theme IDs are enabled (`FILLED_THEME_IDS` in worker.js, supported list in theme-skeleton-client.js) and what a customer gets today for the others (error, blank, old adapter).
3. Where in `scripts/convert-*theme-skeletons*.mjs` the HTML inside JavaScript template literals is rewritten. Show the code that removes `${...}` attributes/text. Confirm or refute 1.2 with the `${` counts (run the count yourself).
4. How aura-luxe and kicks-vault keep 100% of `${` (hand edits? special rules?).
Then STOP.

### Step 2: fix the converter so JS data expressions survive (blocks everything else)
Rule for the converter, inside `<script>` template literals and any HTML string built in JS:
- never remove, rewrite or replace an attribute whose value contains `${`;
- never replace a text node that contains `${`;
- never drop an element because its content contains `${`;
- only bar-ify/blank text that is PURE static copy (no `${`).
Static copy inside JS strings is handled by explicit slot rules (Step 4), not by the generic scrubber.
Then regenerate all skeletons.
Acceptance, per theme, all measured by script and shown in one table:
- `${` count inside scripts is at least 99% of the original (script from 1.2),
- `node skel-run.mjs <theme>` shows 3/3 test products with 0 JS errors for every theme in the 2.4 table,
- aurex's embedded array no longer contains the 104 demo products in the skeleton file.
If after 3 attempts the converter cannot preserve expressions for a theme, FALLBACK for that theme: do not use a generated skeleton; use the ORIGINAL HTML with data ops (2.3) and static-copy rules (Step 4). State which themes use the fallback.
Then STOP and show the table.

### Step 3: integrate data ops for the 17 themes into the shared engine
1. Add the `dataSeed` build step (build time only, 2.2) and write each theme's ops (2.4) into its `schema-v2.json`, plus the `/*__ESHOP_DATA_<name>__*/` marker before the array in the skeleton, plus `dataBindings` and `stripRules.replaceKnownJavascriptData` consistent with how kicks-vault does it today.
2. Port the fill logic into the existing shared `fillThemeForShop` (one function for preview, editor, publish). Keep aura-luxe, kicks-vault, cira-atelier behaviour unchanged. Remove the `data-eshop-skeleton-preview` attribute when filling for live/preview-with-data.
3. Categories: replace the shop's categories into the theme where it has a category list (`categoriesArray` in `field-maps.json`) so filter chips show the shop's categories.
4. Generate tests for every theme in a loop: fills with 0, 1, exact-fit and too-many (200) products without errors; with 0 products show the empty state or hide the section, never demo products; leak test A (no original demo product names anywhere: text, attributes, script source); `theme-adapter-settles` still passes.
5. Table: theme / products shown / JS errors / demo names left (DOM) / (source) / pass-fail. Only passing themes go into the supported lists (client and worker).
Then STOP.

### Step 4: remove hardcoded demo copy (most important for launch)
Batches of 5 themes, stop after each batch with a table.
1. Build a "demo fingerprint" per theme from the original: brand name, phones, emails, addresses, WhatsApp (`wa.me`), `tel:`/`mailto:`, socials, `og:*`, meta description, JSON-LD, hero headline/subheadline, reviews/testimonials, image URLs and hosts.
2. Replace or remove via explicit rules in `schema-v2.json` (`singleSlots`, `strip`). No class-name guessing. Store name, phone, WhatsApp, email, address, socials, about come from the shop's business settings. If the shop has no value, REMOVE the element or section; never keep demo text. Remove demo JSON-LD/og tags and regenerate from shop data.
3. Leak test B: filled output contains none of the fingerprint strings (visible text, attributes, script source, meta, JSON-LD, image URLs).
4. Start with the Verified leaks in 1.2 (aurex, aura-luxe, cira-atelier, kifaru, maison-alchemie, shamba-bora, veluna) and: elysian-stays 1/8 demo names, woodora 1, aura-luxe 1 in script source, maison-alchemie 5/9 names in hero alt/reviews/description.
5. Images: atelier-vera, shop and index pick stock photos with their own function and ignore the shop image. Make them use the shop image when present.

### Step 5: the 6 failing themes (max 3 attempts each)
Order: kifaru-build, index (grocery), shop (nail supplies), blush-nailtech, arcadia-events, mikaa-woodfire-coast. Details in `RESULTS.md`. Note: with the original HTML, kifaru shows 1/3 (seed swapped, generator frozen); index crashes reading 'id' after its pipe-delimited seed is replaced; shop shows 0/3 with no error; blush shows 2/3; arcadia data is `APP_DATA.services` (object property); mikaa mapped a photo gallery, menu data is elsewhere.

### Step 6: remaining themes
maison-elysee (salon; services via `generateCatalog()`/`SERVICES`) and aurelia-grand (rooms nested in `AURELIA_LOCATIONS`) only if the catalogue supports those item types (see 5). cira-atelier: static copy only. oserengoni-estate, zima-fresh: React bundles, out of scope.

## 4. Definition of done for a theme
A theme is enabled in the picker only when ALL are true:
- fills with 0, 1, exact-fit and too-many products without JS errors,
- shows the shop's products and categories,
- leak test A and B pass (no demo products, name, phone, email, address, socials, images, meta, JSON-LD),
- the finished HTML is what gets stored and served on publish (not the empty skeleton, not the raw demo).

## 5. Open question for the product owner (do not assume)
Non-product themes (services, menus, properties, safari packages, events, gallery) need the shop's catalogue to hold those item types. The owner stated the app currently holds products and categories only. For those themes, product records are mapped into the theme's item shape (e.g. a "product" becomes a menu item or a property card). Confirm with the owner before building any service-specific mapping (blush-nailtech services, maison-elysee, arcadia-events).

## 6. Report format at the end of every step
- Files changed (list).
- Test results: table only, failing names only.
- Findings with Verified / Reported / Unverified.
- "What I did NOT verify".
- Tokens/time spent is NOT a result. State what is actually done and what is not.
