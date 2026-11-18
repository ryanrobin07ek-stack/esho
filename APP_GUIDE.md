# Craft App Guide

This guide maps the app's active user-facing screens, actions, and workflows. It is not a list of every internal JavaScript helper. Optional services and analysis that depend on local data, permissions, or server configuration are identified below instead of being presented as guaranteed live services.

## What the app is

Craft is a storefront and small-business management application available as a web app and an Android app. Its main areas are:

- **Home**: launch the Web Studio, POS, and main-store workspace.
- **Web Studio**: manage shop catalogs and settings, edit a storefront design with Litrus Mixer (the only website editor), publish shop sites, and run orders, payments, discount codes and bookings.
- **POS**: record in-person sales, manage stock, customers, orders, expenses, and reports.
- **Customer storefront**: browse a shop, search products, view categories and product details, use a bag, and check out.

The app's route controller is in `index.html`; POS is implemented primarily in `src/pos.js`. The interface is connected to supporting code in `src/`, `public/`, Android native plugins, and the optional Cloudflare Worker.

## Quick screen map

| Area | Screen or route | What it is for |
|---|---|---|
| Home | `/` | Open Craft/Web Studio, POS, Main Store, quick links, and the store overview. |
| App account | `/app-account` | Sign in or create/manage the Craft app account used for shop ownership and account-level services. |
| Web Studio | `/account/web` and `/account/web/studio/...` | Dashboard, Store, CRM, Websites, and Payments workspaces. |
| Main Store | `/account/main-shop`, `/store/...` | Manage the main shop catalog, inventory, orders, and business views. |
| New website | `/account/web/studio/websites/webmaker` | Add existing Store products or create website-only products, then open the Litrus builder. |
| Website editor | `/account/web/site?...` | Edit, preview, and publish a new or existing Litrus Mixer storefront. This is the only website editor. |
| Website/store settings | `/account/web/store`, `/account/store` | Update customer-facing store details and related store information. |
| Web profile | `/account/profile/...` | Manage profile sections, accounts, websites, and custom domains. |
| POS | `/pos` and `/pos/...` | Counter sales, inventory, customer records, orders, and business management. |
| Storefront pages | `/categories`, `/category/...`, `/product/...`, `/search`, `/bag`, `/checkout` | Customer shopping journey. |
| Published website | The selected shop's hostname | The customer's live site; its root is served by the publishing service, not by the Craft home screen. |

Routes can have additional query parameters (for example search, sort, price range, stock filter, or a new-site setup state).

### Web Studio navigation

| Menu | Screens | Main functions |
|---|---|---|
| Dashboard | Overview, Visits, Traffic, Performance, Product intelligence | Review store activity and metrics; apply date/range filters where offered. |
| Store | Products, Categories, Inventory, Orders, Bookings | Manage the web catalog and stock; review online orders, record manual payments, manage discount codes and owner alerts (Orders); review service appointment requests and holds (Bookings). |
| CRM | Customers, Points, Subscribers, Notifications | Review customer activity and loyalty points, manage newsletter subscribers, and access notification tools. |
| Websites | Websites, Domains, New web, Add | Select/manage sites, connect a subdomain, set up a new site, choose its products, and edit its storefront in Litrus Mixer. |
| Payments | Payments | Configure or review supported website payment-account settings. |

The **Main Store** workspace has direct Store routes such as `/store/products`,
`/store/categories`, `/store/inventory`, `/store/orders`, `/store/revenue`,
`/store/channels`, `/store/split-shop`, `/store/website`, and
`/store/bookings`. These routes share the selected shop context; they do not
make the POS catalog identical to the web catalog.

### POS navigation

| POS tab | Screens and actions |
|---|---|
| Sell | Search/filter products, build a receipt, change quantities, apply supported discounts/tax, add customer details, select a recorded payment method, park/cancel, or complete a sale. |
| Overview | Summary, Revenue, Profit, Products, Stock, Payments, and Reports views with date-range filters. |
| Catalogue | Inventory, Products, Categories, and Suppliers; update stock, edit products, manage categories, and receive supplier purchases. |
| Orders | Orders, Invoices, and Quotations; review receipts, create/manage invoices and quotes, and record full or partial payments. |
| More | Sales & receipts, Customers, Instances, and Settings; manage expenses, cash movements, till close, business sessions, and device/sync settings where available. |

## Home

**Route:** `/`

The Home screen is the app launchpad. It provides:

- **Craft/Web Studio** link to shop and website management.
- **POS** link to the counter-sales workspace.
- **Main Store** link to the main shop workspace.
- **Account** icon to the app account screen.
- Quick links to Products, Inventory, Orders, and Categories.
- Summary metrics for overall revenue, profit, customers, and average order.

The overall metrics are assembled from the data available to the app; they are not a bank balance.

## App account and profile

### App account

**Route:** `/app-account`

This is the account sign-in/registration and account-session screen. The account is used to manage website ownership, restore shop access, and use account-level services. Signing in does not automatically sync all local POS history between devices.

### Profile sections

**Routes:** `/account/profile` and `/account/profile/<section>`

The profile area includes:

- **Profile**: app/account identity information.
- **Accounts**: account-related management.
- **Webs**: list and select owned websites.
- **Recommended actions**: account guidance and follow-up actions.
- **Link devices**: device/account linking tools where available.
- **Privacy**: privacy-related settings or information.
- **Updates**: app/update information.

Website cards show the saved shop address, store details, product/category counts, and actions to manage, browse, edit, or remove a website. The required main Craft site is protected from deletion.

### Website settings and domains

**Routes:** `/account/profile/webs/<shop-id>` and `/account/profile/webs/<shop-id>/domains`

Website settings include shop details and actions to manage the selected shop, edit its store details/design, browse it, or delete it (except the main shop). The **Manage domains** screen lets an owner connect, check, or remove a custom subdomain for a non-main shop.

- Enter a hostname such as `shop.example.com`, not a root domain such as `example.com`.
- The existing Craft address remains the fallback.
- Custom hostname readiness depends on DNS and TLS validation; the screen displays the needed DNS record/status.
- The main Craft hostname is fixed and is not replaceable from this screen.

## Web Studio and shop management

Web Studio contains the tools for managing a shop's catalog, content, design, and publishing.

### Main shop workspace and dashboard

**Routes:** `/account`, `/account/main-shop`, `/account/dashboard`, `/account/main-shop/...`, and `/account/web/studio/...`

The workspace provides the dashboard and shop-management sections. Depending on the route, it includes:

- **Overview / dashboard**: business summary and links to management screens.
- **Visits and traffic**: storefront visits, unique visitor estimates, and product-page activity when analytics data is available.
- **Performance / revenue**: shop performance and sales views.
- **Product intelligence**: product-level performance analysis.
- **Customers**: customer records and related activity.
- **Loyalty**: customer points/loyalty records.
- **Bookings**: booking-related records and settings.
- **Website**: shop website access and management.
- **Payments**: payment provider/account setup for supported web checkout.
- **Orders, sales, and payments**: online order and payment records where connected.
- **Products, categories, and inventory**: catalog management.
- **Channels and split shop**: channel/business-management screens.
- **Pages and plans**: custom storefront content and plan information.

Analytics depend on recorded activity. A metric is only as complete as the locally recorded or successfully synchronized data behind it.

### Products

**Routes:** `/account/products` and `/store/products`

Product management supports creating, viewing, editing, and deleting products. Product data can include names, descriptions, prices, categories, stock/inventory values, and images. In the POS catalog, product rows have explicit edit (pencil) and delete (bin) controls. Product photos can be selected/taken, stored with the local catalog, and published with the shop.

Products are scoped to the currently selected shop. Publishing a catalog sends the selected shop's catalog, not every shop's data.

Product forms can also expose product options/variants and category-based
attributes. On supported Android devices, product media tools can capture or
select photos, remove photo backgrounds, and prepare a 360-degree product spin
from video. Barcode/text scanning and image-assisted identification are
permission- and device-dependent helpers; the merchant reviews and saves the
resulting product data.

### Categories

**Routes:** `/account/categories` and `/store/categories`

Category management lets the operator add, rename/edit, and remove categories and connect products to categories. Protected built-in categories may not be removable. Category names and images can be used by the storefront's category navigation/cards.

### Inventory

**Routes:** `/account/inventory` and `/store/inventory`

Inventory screens show stock levels and provide stock-management actions. Inventory is associated with shop products. The Web Studio catalog and POS inventory are related but not identical data flows; live cross-sync depends on explicitly connecting the POS to a shop and enabling the supported sync.

### Shop/tenant selection

**Route:** `/account/tenants` (also available from shop/account navigation)

The tenant/shop manager switches which shop's catalog and store data are being edited. Products, categories, settings, and published output are isolated per shop. Creating a website starts a new shop setup flow and may require signing in to an app account.

### Website pages and store details

- **Custom pages:** `/account/web/pages` manages additional customer-facing pages.
- **Store details:** `/account/web/store` and `/account/store` edit store name/tagline/description and contact details.
- **Website/shop settings:** found in the Web Studio workspace and profile website settings.

Custom pages are stored with the shop catalog, separate from product and category data. Litrus Mixer has no route for them, so a Litrus storefront does not show or index these pages (it routes only the home page and product pages).

## Website editor (Litrus Mixer) and publishing

Litrus Mixer is the only website editor. The old themes, Theme Studio, the standalone builder storefront and the browser register page were retired and must not be restored (see `THEME-ENGINE-HANDOFF.md`). `src/theme-catalog.js` lists a single entry, `litrus-mixer`.

### New website setup

**Routes:** `/account/web/studio/websites/webmaker`,
`/account/web/studio/websites/add`, and
`/account/web/site?new=1&edit=1&theme=litrus-mixer`

The **New web** workflow lets an owner add products from the Store catalog or
create products specifically for the website, review the website categories,
and then select **Go to web builder**. The builder opens the Litrus Mixer
editor in an iframe for the website draft. A new shop's draft stays on the
device: the app blocks Cloudflare requests for it until the owner finishes setup
(the one exception is the editor's image search). On finishing, the app creates the
shop, publishes its catalog and publishes the Litrus design in one go; if a step
fails before the storefront is published, the half-created shop is deleted again.

### The editor

Craft's toolbar above the editor has **Publish**, **Store** (store details), **Sections**,
**Advanced**, and, in preview, a device picker (Fit, Phone, Tablet, Laptop). The
editor's steps, as labelled inside Craft, are:

| Step | What it does |
|---|---|
| Shop | Shop name, whether it offers products or services, description, slogan, currency, contact and delivery details. For services: open days, opening and closing time, buffer and deposit percentage. |
| Content | Homepage promo cards and FAQs. Products and categories are managed in Craft's Store tools, not here. (The standalone editor, opened outside Craft, labels this step Products or Services.) |
| Style | "Choose a look": pick a style and adjust presentation controls. |
| Review | "Review storefront": preview, save or publish the storefront. |
| Settings | Appearance and homepage settings. |

The standalone editor uses different labels for some steps (Your shop, Products or Services, Style with a "Pick a feeling" heading, Finish with a copyable recipe, and Shop settings).

The **Edit/Preview** switch changes between editor controls and the live
preview. A recipe is saved with the shop so the design can be rebuilt. Edits to the draft do not change the public site until the owner publishes.

### How publishing works

1. The editor produces one self-contained HTML document (marked with `<meta name="eshop-filled-theme" content="litrus-mixer">`) and a recipe. Craft saves both locally.
2. **Publish** (existing shop) uploads new product photos to `POST /api/media`, writes the catalog with `PUT /api/catalog` (D1 `catalog_snapshots`), and sends the HTML with `POST /api/theme-publish`, including the catalog version it was built for.
3. The Worker rejects incomplete HTML, a missing catalog version, a catalog that changed in the meantime (`409`), or a theme that no longer matches the catalog. Otherwise it stores the page in R2 (`published-sites/<shop>/litrus-mixer/...`) and points KV (`published-theme:<shop>`) at it. Retired theme IDs get `422`.
4. Visitors to the shop's hostname receive that stored page with the live catalog injected, plus SEO tags. If the catalog is saved ahead of the republish, the last published page keeps being served. If nothing was ever published, visitors see a plain "This website is not available" page.

**Payment limitation:** a storefront preview or publish button is not a
payment processor. Online payments require the shop's supported payment
configuration and server-side provider confirmation. See
`cloudflare/STOREFRONT_COMMERCE.md` for the exact rules.

## Customer-facing storefront

### Published shop

Customers open the shop's published hostname. The `/` route inside the Craft
app is the owner launchpad; it is not the public storefront root. Owners use
the website preview and website-management screens to inspect a site before
publishing it.

### How a customer shops on a published shop

A published shop is the Litrus storefront: a single-page site that routes the
home page and products (`#/p/<product id>`, which the Worker also serves as
`/products/<slug>` for search engines). It has no separate category, favourites or
custom-page routes. The `/categories`, `/category/...`, `/product/...`, `/search`,
`/bag`, `/checkout` and `/pages/...` routes in the quick screen map come from the
Craft app's built-in renderers; a published shop's visitors get the Litrus storefront.

On a published shop customers can:

- Browse products (with options such as size and colour) and see prices and stock.
- Add to the cart and check out: name, contact, delivery or pickup, and an address for delivery. A discount code can be previewed before ordering.
- **Pay with Paystack** (the shop has a ready Paystack account; KES only) or **place the order and pay the shop directly**. The email is optional only for the second option.
- **Hold** an item for a limited time (small per-visitor limits).
- For service shops, pick a date and an available time and **request an appointment** (name, email and phone are needed). The customer gets a private link (`#/booking/<token>` on the shop's address) to view the booking, move it or cancel it until the shop's cutoff (default 2 hours before), within a reschedule limit (default 2).

The Worker re-prices every order from the published catalog, deducts stock when payment is recorded, and releases holds and discounts. An online payment is completed only when Paystack confirms it; a preview or success screen alone is not enough.

## POS (point of sale)

**Main route:** `/pos`

POS has its own bottom navigation: **Sell**, **Overview**, **Catalogue**, **Orders**, and **More**. POS data is stored in its local SQLite-backed data model.

### Sell

**Route:** `/pos`

- Search and select products.
- Add items to a cart and adjust quantities.
- Apply discounts/tax as configured.
- Select payment method (cash, mobile money, bank, card, or other).
- Record customer details where applicable.
- Park an order, cancel an in-progress sale, or complete the sale.
- Mobile-money sales are recorded manually; Craft does not monitor payment notifications.

### Overview and reports

**Route:** `/pos/overview`

POS Overview reports sales and operating information from POS records, including revenue/profit signals, trends, product/category/customer metrics, stock alerts, expenses, and other operational indicators. It can include monthly sales goals and priority alerts.

Some insights are estimates or heuristics. For example, profit and margin need recorded buying costs; customer/channel attribution needs consistent records; and a trend is not a forecast guarantee. Review the report's qualifications before treating it as accounting or financial advice.

### Catalogue

**Routes:** `/pos/catalogue/inventory`, `/pos/catalogue/products`, `/pos/catalogue/categories`, `/pos/catalogue/suppliers`

- **Inventory:** review stock, import/link website stock where supported, export inventory, and inspect pending sync status.
- **Products:** manage POS products, including edit/delete actions, prices, barcodes, and photos.
- **Categories:** add and rename categories; the protected “Other” category cannot be deleted.
- **Suppliers:** create/edit suppliers, record purchases, and receive stock into inventory.
- Barcode scanning, product-label scanning, camera photos, and image-based category suggestions are available where the device/browser permissions and native plugins allow them.

### Orders

**Routes:** `/pos/orders`, `/pos/orders/invoices`, `/pos/orders/quotations`

- **Orders:** review saved POS orders.
- **Invoices:** create/manage invoices and record payments.
- **Quotations:** create and manage quotes before a sale.
- Sales may be paid in full, partially paid, or remain outstanding; receipts can be printed from a supported device/browser.

### Sales and receipts

**Route:** `/pos/sales`

Shows recorded sales/receipts, their status, totals, payment details, and outstanding balances. An additional payment can be recorded for an unpaid sale.

### Customers

**Route:** `/pos/customers`

Shows customer-level sales information derived from POS records.

### More, expenses, till and register instances

**Routes:** `/pos/more`, `/pos/more/instances`, `/pos/more/settings`

The More area links to sales/receipts, customers, instances, and settings. POS settings include currency, tax, goals, data/sync controls, and supported device-sync setup. Business management includes expenses, cash movements, and till close records.

### POS sync and offline operation

POS is locally stored and designed to remain usable offline. Optional sync features include cloud shop/inventory synchronization and nearby device sync where configured. Local POS data is not automatically uploaded merely because the operator signs into an app account. Cloud and nearby sync are separate connections, and sync scope is shop-specific.

## Archived M-Pesa feature

The dedicated M-Pesa workspace and notification listener are not part of the active app. Their UI and listener source are retained under `archive/mpesa-ui/` and `archive/mpesa-notification-listener/` for reference only. Legacy POS database columns for mobile-money references remain to preserve existing records; new sales use the generic **Mobile money** method and are recorded manually.

## Online orders, payments, discounts and bookings (owner side)

These are in Web Studio, Store, **Orders** and **Bookings** (`/account/web/studio/store/orders` and `.../bookings`; also `/store/orders`, `/store/bookings`).

- **Orders:** online orders with status (pending, confirmed, processing, ready, fulfilled, cancelled) and payment status. Orders that need attention are called out (money received but stock short, payment after cancel, duplicate payment, unmatched payment).
- **Record a payment:** for an order the shop settles itself, choose cash, mobile money, bank or other, with an optional reference. Only full payments are recorded. Already-paid orders are not charged or deducted twice.
- **Cancel:** cancelling releases holds and gives the discount use back. It does not restock a paid order and does not refund; do both manually.
- **Discount codes:** create, switch on/off and delete percent or fixed codes with minimum spend, start/end dates and a usage limit (the Orders screen hosts this panel).
- **Owner alerts:** a list on the Orders screen and under CRM > Notifications of new orders, booking requests, holds and attention events (`GET /api/store/notifications`), also emailed to the account's recovery email when email is configured.
- **Bookings:** service appointment requests (confirm or decline; confirming a request with a deposit creates a Paystack link), plus hold settings and hold requests (approve, reject or release). The server also supports owner cancel, reschedule, completed, no-show and deposit-refunded actions, capacity (several bookings per time), and daily reminder emails, but the app shows only confirm and decline today. A cancelled paid booking only flags the deposit as refund due; refund it in Paystack. The Bookings screen has no alerts panel.
- **Payments:** the Payments tab connects a Paystack account for the app account; website checkout currently needs KES.

POS payment recording and website checkout are separate flows. Selecting mobile money in POS records the sale based on the operator's manual verification.

## Data, storage, and connected services

- **App catalog and website settings:** stored in the local SQLite-backed store and scoped to the selected shop.
- **POS:** relational SQLite records, separate POS sales/order model, and optional sync queues.
- **Browser storage:** the browser build uses a persistent SQLite WebAssembly/IndexedDB-backed implementation.
- **Android storage:** Capacitor/native SQLite is used where available.
- **Cloudflare:** the Worker can provide account/shop services, catalog publication, public storefront delivery, custom domains, analytics, and R2-hosted media when configured.
- **Device permissions:** camera/barcode features require camera access; nearby connections require the relevant Android/browser connectivity permissions and user approvals.

Local records and cloud records are not interchangeable by default. Shop selection controls which catalog is edited, and each optional synchronization path has its own setup and status.

## Build and verification

From the project directory:

```powershell
npm install
npm run dev
npm run build
npm test
npm run lint:inline
npm run test:boot
npm run test:litrus-browser
```

`npm test` runs every `tests/*.test.mjs` file. `lint:inline` lints the inline script in `index.html`. `test:boot` (run `npm run build` first) starts the production build in Playwright Chromium and checks that the app boots. `test:litrus-browser` is a Playwright smoke test of the Litrus Mixer editor and preview. For a single area, run `node --test tests/<file>.test.mjs` (for example `tests/cloudflare.worker.test.mjs`).

Android sync/build workflow:

```powershell
npm run cap:sync
Set-Location android
.\gradlew.bat assembleDebug
```

The debug APK is written under `android/app/build/outputs/apk/debug/`. Installation requires Android SDK/ADB and a connected or authorized Android device. Deploying the Worker (`npm run cf:d1:migrate:remote`, then `npm run cf:deploy`) is a manual, owner-run step; see the deploy checklist in `README.md`.

## Source map for maintainers

| Code | Responsibility |
|---|---|
| `index.html` | Main route controller, app workspace screens, profile/web settings, and storefront route dispatch. |
| `src/bootstrap.js` | Initializes SQLite, POS, shared globals (some leftover theme-runtime globals remain), and Capacitor app services. |
| `src/sqlite.js` | SQLite database setup and browser/native persistence bridge. |
| `src/pos.js` | POS screens, checkout, inventory, orders, invoices, suppliers, reports, settings, and sync workflows. |
| `archive/mpesa-ui/` | Archived dedicated M-Pesa workspace snapshot and tools; not compiled into the active app. |
| `archive/mpesa-notification-listener/` | Archived Android listener and JavaScript bridge; not compiled into the active app. |
| `src/theme-catalog.js` | The theme list; contains only Litrus Mixer. |
| `public/litrus-mixer/index.html` | Litrus Mixer editor, embedded Craft flow, preview and shop-content controls. |
| `public/litrus-mixer/live-catalog.js` | Runtime of a published Litrus storefront: live catalog, cart, checkout, holds, bookings. |
| `src/product-taxonomy.js`, `src/product-variants.js` | Product category attributes and product option/variant fields. |
| `src/product-cutout.js`, `src/product-vision.js` | Native product-media processing and image-assisted tools where supported. |
| `cloudflare/worker.js` | Cloudflare API, authentication/account/shop endpoints, publishing, storefront delivery, orders, payments, discounts, bookings, and related services. |
| `cloudflare/migrations/` | D1 schema files `0001` to `0030` (`0025`-`0030` not yet applied to production). |
| `tests/` | Automated coverage for POS, archived M-Pesa tools, Litrus storefront behaviour, accounts, domains, analytics, and Worker behavior (some older tests still cover retired theme code). |

## Known boundaries

- Published catalog content comes from the selected shop's records, not from editor sample content.
- A storefront preview or publish action does not itself process a payment; online checkout requires supported provider configuration.
- Cancelling a paid order neither restocks nor refunds. Rate limits slow abusive traffic but cannot guarantee a shop's availability.
- Dead code from the retired theme engine remains in places (for example non-Litrus branches in `index.html`, `public/theme-*.js`, `src/liquid-*.js`); it is not reachable from the picker or publish path.
- Analytics and business warnings depend on the completeness and correctness of saved data.
- Optional Cloudflare publishing, custom domains, online payments, and cloud sync require their respective accounts, credentials, DNS, and service configuration.
