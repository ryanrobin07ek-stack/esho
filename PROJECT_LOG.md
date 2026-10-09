# E-Shop Atelier Project Log

## 2026-10-04 — Local POS integration

- Replaced the launchpad's disabled POS placeholder with a complete POS workspace, styled with E-Shop typography, colors, and compact cards.
- Added a relational SQLite POS engine for inventory/categories, tax/currency, sales/receipts, manual and partial payments, invoices, expenses, cash movements/till close, overview analytics, and timed/counted business instances.
- Expanded Overview and Insights with period-over-period revenue/expense comparisons, a recent revenue chart, top products and recorded margin estimates, restock pace guidance, out-of-stock and overdue-credit alerts, dormant stock, busiest day/hour, payment mix, expense categories, and repeat/top/inactive customer summaries.
- POS data remains separate from the online storefront product catalog. Store/mobile-money payments are entered manually; SMS import, automatic M-Pesa matching, and payment confirmation are not included.
- Added `npm run test:pos` integration coverage for product persistence, checkout/stock deduction, manually recorded mobile-money payments, invoices, and instance lifecycle.
- Verified the production build and opened the POS and Inventory screens through live reload on the connected Android phone.

### POS analytics expanded

- Added locally saved monthly pre-tax net-sales goals with progress, required remaining daily pace, a currency guard, and a clearly labeled straight-line month-end run rate.
- Added severity-ranked, persistent priority alerts with 24-hour snooze, dismissal, and restore controls; generated alerts cover inventory, below-cost products, overdue credit, recorded cost increases, unusual cash receipts, overnight receipts, and adequately sampled goal pacing.
- Expanded analysis with pre-tax net sales separated from tax and payment collections, Pareto-style product contribution, fully costed gross-earner rankings, category revenue/margin mix, customer lifecycle and concentration, calendar-day-normalized weekday performance, qualified complete-month segment patterns, inventory cost/retail exposure and days-of-cover estimates, recorded-profit trend, and data-quality coverage.
- Added minimum-sample and attribution caveats throughout. No SMS ingestion, automated mobile-money matching, external financial data, or unsupported seasonal/causal claims were introduced.
- Verified `npm run test:pos` and `npm run build`.

## 2026-10-04

### Product direction clarified

- This is intended to be a mobile-first website builder for online stores, similar to Shopify: choose a theme, name the store, manage products in SQLite, preview the site, and deploy it to Cloudflare.
- Cloudflare is not the current bottleneck. The immediate needs are a better mobile builder experience, a native feel, and seeing app-code UI edits on the phone without rebuilding/reinstalling the APK each time.
- These are two separate feedback loops: Capacitor live reload is for developer code changes; the app's own preview should reflect draft store/theme/product changes from SQLite without rebuilding the native shell.
- No live-reload setup, builder redesign, or app preview work has been implemented yet.

### Capacitor live-reload session started

- Vite started on the computer at `http://192.168.0.38:5173`.
- Ran Capacitor 8 live reload for Android with that LAN address and port. The resulting debug APK contains `server.url: http://192.168.0.38:5173`.
- The first automated launch lost the wireless ADB connection after the build; ADB reconnected and the app was launched manually. A fresh phone screenshot showed the storefront home screen.
- Keep the Vite process running while editing web UI code. The development APK depends on the computer being reachable at that address; this live-reload URL is not for a production APK.
- This setup covers developer code changes only. The in-app store preview still needs to reflect user-authored theme and product changes from SQLite without an APK rebuild.

### Android blank-screen investigation

- Initial report: the installed Android app opened to a white screen.
- A startup ordering issue was addressed: the inline app controller now waits for the SQLite initialization promise before loading or seeding the database.
- The rebuilt app was installed on the connected Android phone. The phone log then exposed the remaining database failure: `Cannot perform this operation because there is no current transaction.`
- Root cause: persistence code manually began and committed a transaction around `executeSet`, while the SQLite plugin's `executeSet` already handles the transaction.
- Fix: removed the extra manual transaction statements and routed direct and scheduled saves through the write queue.
- Rebuilt the debug APK with JDK 21 and installed it on the phone. The app launched and displayed product listings. A filtered log check for the relaunched app showed no new startup errors.

### Mobile UI observation

- The phone screenshot showed a two-column product grid. Some card text, including price and discount details, wrapped awkwardly and made the layout feel cramped.
- This is recorded as a review item only. No mobile UI redesign or styling changes were made.

### Current limitations

- Device verification covered app launch and a storefront screenshot on one connected phone; it did not cover all screens, flows, devices, or offline scenarios.
- The app currently stores data locally. The README states there is no server sync or payment integration.
