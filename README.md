# Craft (E-Shop Atelier)

Craft is a mobile-first app for small shop owners in Kenya. It combines three things:

- **Website builder.** Litrus Mixer is the only website editor. It builds a storefront and publishes it to the owner's own address (`<shop>.rrobin.co.ke`, or a connected custom hostname).
- **Point of sale (POS).** An offline-first register with inventory, receipts, credit, expenses, till, and business analytics.
- **Shop operations.** Owner tools for web orders, manual and Paystack payments, discount codes, service bookings, newsletters and reports.

It is a Vite web app (vanilla JavaScript, one large `index.html`) wrapped for Android with Capacitor. The hosted backend is a Cloudflare Worker with D1 (SQL), KV (tenants and sessions) and R2 (media and published sites).

Start here: [APP_OVERVIEW.md](APP_OVERVIEW.md) (what it does, for owners), [APP_GUIDE.md](APP_GUIDE.md) (screens), [APP_ARCHITECTURE.md](APP_ARCHITECTURE.md) (how it fits together), [cloudflare/STOREFRONT_COMMERCE.md](cloudflare/STOREFRONT_COMMERCE.md) (the storefront commerce API contract). When a document and the code disagree, the code is right; please fix the document.

## What was removed (do not restore)

The old website themes, Theme Studio, the standalone `builder-storefront.html`, the browser register page (`register.html`) and the `live-websites` flow were retired on purpose. See [THEME-ENGINE-HANDOFF.md](THEME-ENGINE-HANDOFF.md). Some unused leftover files may still be in the tree (for example `public/theme-packages/`, `public/theme-skeleton-*.js`, `src/liquid-*.js`, `experiments/liquid-themes/`, `docs/engine/`, `src/browser-register.*`). They are not reachable from the theme picker (`src/theme-catalog.js` lists only `litrus-mixer`) or from the publish path; treat them as dead code.

## Folder layout

| Path | What it holds |
|---|---|
| `index.html` | The whole app shell: routes, Craft owner screens, Web Studio, customer-route renderers, `AppController`, `SQLiteEngine`. Vanilla JS, large. |
| `src/` | Modules loaded by `src/bootstrap.js`: `pos.js` (POS), `sqlite.js`, `business-lens.js`, `craft-ai*.js`, `product-*.js`, `business-notifications.js`, `theme-catalog.js` (lists only Litrus Mixer). |
| `public/litrus-mixer/` | The Litrus Mixer editor (`index.html`), its live storefront runtime (`live-catalog.js`) and a mobile mock (`phone-mock.html`). |
| `public/official-site/` | The Craft marketing homepage that the Worker serves at `rrobin.co.ke/` when no main-shop storefront is published. |
| `public/` (rest) | Service worker (`sw.js`), manifest, icons, fonts, storefront analytics, `data/` (bundled product taxonomy). |
| `cloudflare/` | `worker.js` (the API and storefront server), `seo.js`, `wrangler.jsonc`, `migrations/` (D1 SQL, `0001` to `0030`), and the Cloudflare-side documents. |
| `scripts/` | `boot-smoke.mjs`, `litrus-browser-smoke.mjs`, `lint-inline-script.mjs`, `link-main-shop-owner.mjs`. `sync-storefront-engine.mjs` is a retired helper for the old theme engine. |
| `tests/` | Node test files (`node --test`). |
| `android/` | Capacitor Android project. Do not edit by hand unless you are changing native code. |
| `www/` | Build output of `npm run build` (this is also what the Worker serves as static assets). Regenerate, do not hand-edit. |
| `archive/` | Retired M-Pesa notification code, kept for reference only. |
| `docs/engine/` | Notes and prototypes from the retired theme-fill engine; historical only. |

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies. |
| `npm run dev` | Vite dev server for browser development. |
| `npm run build` | Build the app into `www/`. |
| `npm test` | Run every file in `tests/` (`node --test tests/*.test.mjs`). |
| `npm run test:pos` / `npm run test:cloudflare` | Run only the POS integration tests or the Worker tests (`tests/cloudflare.worker.test.mjs`, which applies migrations to an in-memory sql.js database). |
| `npm run lint:inline` | ESLint over the inline application script in `index.html` (catches undefined names). |
| `npm run test:boot` | Opens the production build (`vite preview`) in Playwright Chromium and checks the app boots. Run `npm run build` first. |
| `npm run test:litrus-browser` | Playwright smoke test of the Litrus Mixer editor and its storefront preview (serves `public/` locally). Needs Playwright's Chromium installed. |
| `npm run cap:sync` | Build, then `cap sync` to the Android project. |
| `npm run cf:dev` | Build, then `wrangler dev` with a local D1/KV/R2. |
| `npm run cf:d1:migrate:local` | Apply migrations to the local development database. |
| `npm run cf:d1:migrate:remote` | Apply migrations to PRODUCTION D1. Manual step; see the deploy checklist. |
| `npm run cf:deploy` | Build and deploy the Worker and assets to PRODUCTION. Manual step. |
| `npm run cf:link-main-owner` | Interactive helper that links an account to the main shop (`scripts/link-main-shop-owner.mjs`). |

For Android: install Android Studio and the SDK, then `npm install`, `npx cap add android` (first time only), `npm run cap:sync`, `npx cap open android`. The app ID is `com.eshop.atelier`. Normal builds use `https://rrobin.co.ke` as the local WebView hostname so Turnstile sees one stable, allowlisted hostname; allow `rrobin.co.ke` in the Turnstile widget. For live reload, set `CAPACITOR_LIVE_RELOAD_URL` (for example `http://localhost:5173`), run `adb reverse tcp:5173 tcp:5173`, sync, and install once; leave the variable unset for normal builds. Turnstile registration may not work in live-reload mode.

## Local data

Website catalog and app records are saved as JSON payloads in SQLite tables; POS records use relational SQLite tables in the same database. Android uses native SQLite (`@capacitor-community/sqlite`); the browser uses SQLite WebAssembly persisted in IndexedDB (`jeep-sqlite`). The POS catalog and the web catalog are separate data sets: editing one does not edit the other unless the owner uses the explicit shared-inventory and import features.

Product photos are compressed on the device to WebP (up to 1800 px and 1.5 MB; the selected original can be up to 5 MB). Publishing uploads them to the Worker, which stores them under `media/<tenant>/` in the `BUSINESS_ARCHIVE` R2 bucket and puts the public URLs in the published catalog. Unchanged images are cached per tenant by fingerprint and reused on later publishes.

## POS

POS has its own SQLite-backed inventory, categories, checkout, receipts, credit and partial payments, invoices and quotations, expenses, till movements and close, tax and currency settings, business analytics and timed or counted business instances. Mobile-money payments are recorded manually by the operator; incoming SMS and automatic M-Pesa matching are not integrated (that code is in `archive/`). Overview figures separate pre-tax net sales from tax and collections, and they state their minimum-history and cost-coverage limits.

**Nearby device sync (Android).** In POS, More, Settings, Nearby device sync: one phone taps **Receive over Bluetooth** and the other taps **Find a Bluetooth register**; both must select the same shop. Snapshots can include receipt customer names and phone numbers, so connect trusted devices only. There is also a QR-based Wi-Fi pairing (**Create pairing QR** and **Scan pairing QR**) that uses `/api/nearby/pairing` briefly; its details are in `cloudflare/BUSINESS_SYNC.md` and `src/pos.js` and were not re-tested for this document. Cloud backup and sync is a separate, optional feature (see `cloudflare/BUSINESS_SYNC.md`). The dedicated browser register page was removed; the browser build of the app still opens `/pos`.

## Website publishing (Litrus Mixer)

1. The owner creates a shop (**New web**) or opens an existing one. Craft sends the shop's products, categories and store details to the Litrus editor in an iframe (`/litrus-mixer/index.html?craft=1`), which edits the design and bakes it into one self-contained HTML document marked `<meta name="eshop-filled-theme" content="litrus-mixer">`.
2. The app saves that HTML locally. When the owner presses **Publish**, the app uploads images (`POST /api/media`), writes the catalog (`PUT /api/catalog`, stored in D1 `catalog_snapshots`) and then sends the HTML to `POST /api/theme-publish`.
3. The Worker checks the HTML (complete document, correct meta marker, no template placeholders) and that its `catalog_updated_at` still matches the saved catalog, then writes it to R2 under `published-sites/<tenant>/litrus-mixer/` and records a pointer in KV (`published-theme:<tenant>`).
4. Visitors to the shop hostname get that saved HTML with the live catalog injected. The Worker never serves the raw editor. If the catalog is ahead of the last publish, the shop keeps serving its last published page. A shop with nothing published gets a plain "This website is not available" page.
5. At runtime `public/litrus-mixer/live-catalog.js` runs the storefront: cart, checkout (`/api/orders`), Paystack hand-off, discount preview, holds, and service appointment requests. Pricing, stock and discounts are always re-computed by the Worker.

Only `litrus-mixer` and the Craft platform's own `craft-main-storefront` can be published. Publishing a retired theme returns `422`; shops published earlier with a retired theme keep serving their stored HTML.

## Cloudflare backend

One Worker (`cloudflare/worker.js`) serves the API, the storefronts and the static app. It is configured in `cloudflare/wrangler.jsonc`: D1 `DB`, KV `TENANTS`, R2 `BUSINESS_ARCHIVE`, static assets `ASSETS` (from `../www`), a daily cron (`17 3 * * *` UTC) that runs retention cleanup and sends booking reminder emails, and routes for `rrobin.co.ke/*` and `*.rrobin.co.ke/*`. Cloudflare DNS needs proxied `@` and `*` A records pointing at `192.0.2.1`; explicit records (for example `www`) take precedence.

Accounts are a username and password (PBKDF2-SHA-256 in the Worker, sessions stored by hash in KV), with an optional recovery email and optional Google sign-in. Every shop has a random owner key; Cloudflare stores only its SHA-256 hash. The master `PUBLISH_TOKEN` is only for protected administration; never put it, the Turnstile secret or any other secret in the app or in source control.

Worker secrets and variables the code reads (names only): `PUBLISH_TOKEN`, `TURNSTILE_SITE_KEY` (public, in `wrangler.jsonc`), `TURNSTILE_SECRET_KEY`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `RATE_LIMIT_SALT` (optional; falls back to `PUBLISH_TOKEN`), `SERVICE_REMINDER_WINDOW_HOURS` (optional; hours ahead to remind, 1-72, default 36), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `OPENROUTER_API_KEY`, `AI_MODEL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CUSTOM_HOSTNAME_TARGET`, and the optional image-search keys `UNSPLASH_ACCESS_KEY`, `PIXABAY_API_KEY`, `PEXELS_API_KEY`. For local Worker development only, `cloudflare/.dev.vars` may set `DEV_SKIP_SHOP_CREATE_LIMIT=true` (production allows five shop creations per IP per hour); do not commit that file.

Commerce features on the Worker, all documented in [cloudflare/STOREFRONT_COMMERCE.md](cloudflare/STOREFRONT_COMMERCE.md): server-side order pricing with variants and holds, per-IP rate limits, manual payments (cash, mobile money, bank, other), Paystack payments with idempotent settlement, discount codes, owner notifications (outbox plus email), service appointment requests with optional deposits (customers can view, move or cancel a booking through an emailed link, `POST /api/service-appointments/manage`; owners can also cancel, reschedule, mark completed or no-show, and mark a deposit refunded), booking reminder emails, and retention.

## Database migrations

D1 schema files in `cloudflare/migrations/` must be applied in order and never edited once released (`0001` to `0024` are released; `0025` to `0030` exist as unapplied local files; the next new file is `0031`). Groups:

| Files | Purpose |
|---|---|
| `0001`-`0003` | Catalog snapshots, per-tenant catalogs, private owner-only catalog payload (purchase cost). |
| `0004`, `0016`, `0017` | Accounts, account to shop links, recovery email, Google identities. |
| `0005`, `0020` | Shared inventory and event deductions; main-store allocations and stock triggers. |
| `0006`, `0007`, `0011`, `0012` | Business branches, push (newsletter) subscriptions, POS sync change log, storefront visits, nearby pairing relay. |
| `0008`, `0010`, `0018`, `0022` | Storefront orders and payment state, product interest and holds, daily event counters. |
| `0009`, `0013`-`0015`, `0024` | Paystack subaccounts, reuse, pending setup, app-account default, live-account audit columns. |
| `0019` | Newsletter subscribers and campaigns. |
| `0021` | Custom hostnames. |
| `0023` | Service appointments and slot reservations. |
| `0025`-`0029` | **Not yet applied to production.** `0025` rate-limit counters and owner notifications; `0026` manual payments and needs-attention flags on orders; `0027` discount codes; `0028` payment attempts and discount release; `0029` funnel events (checkout start, purchase, booking submitted). |
| `0030` | **Not yet applied to production.** Service booking management: rebuilds the appointment and slot tables for capacity (several bookings per time), a hashed customer manage token, customer or owner cancellation, completed and no-show outcomes, deposit refund flags and reminder tracking. Existing rows are kept. |

## Deploy checklist (manual; never automatic)

Nothing in this repository deploys by itself, and automated agents must not deploy. The owner does this by hand:

1. `npm test`, `npm run lint:inline`, `npm run build`, `npm run test:boot` (and `npm run test:litrus-browser` after editor changes) all pass.
2. Back up or note the current D1 state. Review the pending migration files (`0025` to `0030`).
3. `npm run cf:d1:migrate:remote` first. Migrations are applied before the new Worker code is deployed because the new code expects the new tables and columns (in particular `0028` adds `storefront_orders.discount_released`, which every order status change uses).
4. `npm run cf:deploy`.
5. Confirm required secrets exist, and that the Paystack webhook (`/api/payments/paystack/webhook`, `charge.success`) points at the production Worker.
6. Smoke check: the apex homepage, one published shop, a test order, and the owner app's Orders screen.

Rotate the master token after it has appeared in chat or a log. Android builds are separate (`npm run cap:sync`, then Gradle `assembleDebug` in `android/`).

## Known limitations

- Booking deposits are never refunded by the Worker: cancelling a paid booking only flags the deposit as due, and the owner refunds in Paystack and marks it refunded. Reminders go out once a day (cron), only to bookings starting inside the reminder window, and only when email is configured. Worker defaults: capacity 1 (range 1-20), customers may cancel or move a booking until 2 hours before the start (0-168), at most 2 reschedules (0-10). These come from the shop's saved store settings (`service_capacity`, `service_cancel_cutoff_hours`, `service_max_reschedules`); no control for them was found in the owner app or the Litrus editor, so they stay at the defaults unless set another way.
- Cancelling an order that is already paid does not restock and does not refund; the owner does both by hand.
- Rate limits protect the database, not one shop's availability: many IPs can still slow ordering for one shop.
- The web catalog and the POS catalog are separate data sets.
- The owner app has screens for orders, manual payments, discount codes and bookings. The owner-alerts panel is on the Orders screen and on CRM > Notifications (not on Bookings). It is fed by `GET /api/store/notifications` (`BusinessNotifications.owner` in `src/business-notifications.js`, `renderOwnerAlertsPanel` in `index.html`); emailed alerts need `RESEND_API_KEY`, `EMAIL_FROM` and an account recovery email.
- Paystack checkout requires KES; other currencies cannot take card payments.
- Litrus shops get real URLs, canonical tags and sitemap entries only for the home page and product pages (`/products/<slug>`); categories and pages have no Litrus route.
- Some retired theme code remains in `index.html` as unreachable branches.
- Tests exercise the Worker against sql.js and local stubs; they do not prove behaviour against real Paystack, Resend or Cloudflare services.
