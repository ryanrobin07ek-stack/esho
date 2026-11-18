# E-Shop Atelier Roadmap

This roadmap prioritizes a useful, easy-to-navigate app with little or no required ongoing cost. Monetizing the app comes last, after core workflows are complete and reliable.

## Product direction

E-Shop Atelier (Craft) is a mobile-first app for creating and managing an online shop: build the site with Litrus Mixer (the only website editor), edit products, preview the shop, publish it, and run orders, payments and bookings. It also includes a POS register. Prefer simple flows, local-first storage, and free or open-source services. Explain unavoidable third-party, domain, hosting, or payment-provider charges before relying on them; do not add an app subscription or paywall while core work remains.

“Money last” means app monetization is deferred. Accepting a shop owner's own customer payments is a separate commerce capability and can be considered when the core store workflow is ready.

## Current state (2026-11-18)

- A Vite app wrapped for Android with Capacitor, plus a Cloudflare Worker (D1, KV, R2) that hosts accounts, shop catalogs, published storefronts and the commerce API.
- Litrus Mixer is the only website editor. The old themes, Theme Studio, the standalone builder storefront, the browser register page and the live-websites flow were removed on purpose and are not coming back (see THEME-ENGINE-HANDOFF.md).
- Shops publish to `<shop>.rrobin.co.ke` through the Worker (catalog in D1, filled page in R2, pointer in KV). Product and service shops are both supported; service shops take appointment requests with optional Paystack deposits.
- Storefront commerce on the Worker: server-side pricing, variants, holds, per-IP rate limits, manual payments, Paystack payments with idempotent settlement, discount codes, owner notifications and a daily retention job. The contract is cloudflare/STOREFRONT_COMMERCE.md.
- POS is local-first with optional cloud backup and nearby device sync (Bluetooth on Android, QR pairing).
- D1 migrations `0001`-`0024` are treated as released (not re-verified against production here). `0025`-`0030` exist as files and are NOT yet applied to production; applying them (then deploying) is a manual owner step.
- Verification is `npm test`, `npm run lint:inline`, `npm run build`, `npm run test:boot` and `npm run test:litrus-browser`. The old note that "all 10 tests pass" is out of date.

## Open items (from the code and docs, not a commitment)

1. Apply `0025`-`0030` to production and deploy, by hand, in that order, then smoke-test one shop end to end (order, manual payment, discount code, booking, customer cancel or reschedule).
2. Decide the policy for cancelling a paid order (today it neither restocks nor refunds).
3. Decide whether Litrus shops need category and custom-page routes (today only the home page and products have real URLs).
4. Remove the dead theme-engine code and the older tests that still read it, carefully (see THEME-ENGINE-HANDOFF.md).
5. Keep the documents honest: when a behaviour changes, update README.md, APP_ARCHITECTURE.md and cloudflare/STOREFRONT_COMMERCE.md together with the test.

## Earlier priorities (historical; superseded, and partly about the retired theme flow)

### 1. Fast on-device UI iteration — active setup

- Current session: Vite live reload is running on the connected phone. After this session ends or the computer's network address changes, restart the Vite server and relaunch the app with Capacitor's live-reload command.
- Keep live-reload URLs and development cleartext settings out of production builds. Capacitor documents the development server URL as a live-reload option, not a production app URL.
- Separate app-code changes from store-content changes: editing a store name, theme selection, or product data should update the in-app preview directly from the local draft state/SQLite, without rebuilding the Android app.

### 2. Make the builder feel native on mobile

- Review navigation, safe areas/system bars, scrolling, touch targets, forms, and keyboard behavior on the target phone.
- Give the builder clear mobile screens for theme selection, store details, product editing, and preview.
- Review the storefront preview at phone widths, especially product-card density, pricing/discount layout, and truncation.
- Agree on the desired interaction and visual direction before making UI changes.

### 3. Validate the core store-creation flow

- Walk through theme selection, store naming, product add/edit, persistence after relaunch, preview updates, and deployment handoff.
- Record failures and test the flow on the connected phone before widening device support.

### 4. Return to deployment after the app workflow

- Revisit Cloudflare deployment only after the mobile builder, preview, and authoring flow are reliable.
- Confirm deployed stores load the selected theme and the latest store/catalog data.

## Current priorities (2026-10-06)

1. Keep the app free or very low-cost to operate; disclose unavoidable provider, domain, hosting, or payment fees before choosing them.
2. Make the main tasks and navigation as simple as possible, then test the shop-creation and publishing flow on the phone.
3. Decide whether backup or cross-device shop sync is needed; POS and shop drafts currently remain local.
4. Add server-backed orders and payment-provider checkout only after the core create, preview, and publish flow is dependable.
5. **Monetization is last.** Do not add app subscriptions, paid tiers, or paywalls until the app is easy to use and its core workflows are complete. Shop owners accepting payments from their own customers is a separate commerce feature.
