# E-Shop Atelier Roadmap

This roadmap prioritizes a useful, easy-to-navigate app with little or no required ongoing cost. Monetizing the app comes last, after core workflows are complete and reliable.

## Product direction

E-Shop Atelier is a mobile-first app for creating and managing an online shop: choose a theme, edit products, preview the shop, and publish it. Prefer simple flows, local-first storage, and free or open-source services. Explain unavoidable third-party, domain, hosting, or payment-provider charges before relying on them; do not add an app subscription or paywall while core work remains.

“Money last” means app monetization is deferred. Accepting a shop owner's own customer payments is a separate commerce capability and can be considered when the core store workflow is ready.

## Current state

- The project is a Vite storefront wrapped for Android with Capacitor.
- The home screen links to POS, Live Web, and Web Builder/Studio.
- Shop and POS data are stored locally through SQLite; POS records do not sync across devices.
- App accounts and Cloudflare storefront publishing are implemented.
- A shared visual refresh covers storefront, Studio/account, website builder, and POS. The refreshed debug APK was built, installed, and launched on the connected Android phone on 2026-10-06.
- All 10 existing tests passed after the visual refresh.

## Earlier priorities (superseded by current priorities below)

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
