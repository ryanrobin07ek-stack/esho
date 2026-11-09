# Craft App Guide

This guide describes the screens and functionality currently present in this Craft app workspace. It is an operator-oriented map of the application, not a promise that every analysis or integration is a live external service. Where a screen is heuristic, local-only, or not yet connected to a real transaction flow, that is called out below.

## What the app is

Craft is a storefront and small-business management application available as a web app and an Android app. Its main areas are:

- **Home**: launch the Web Studio, POS, and main-store workspace.
- **Web Studio**: manage shop catalogs and settings, edit a storefront design, and publish shop sites.
- **POS**: record in-person sales, manage stock, customers, orders, expenses, and reports.
- **Customer storefront**: browse a shop, search products, view categories and product details, use a bag, and check out.

The app's route controller is in `index.html`; POS is implemented primarily in `src/pos.js`. The interface is connected to supporting code in `src/`, `public/`, Android native plugins, and the optional Cloudflare Worker.

## Quick screen map

| Area | Screen or route | What it is for |
|---|---|---|
| Home | `/` | Open Craft/Web Studio, POS, and Main Store. |
| App account | `/app-account` | Sign in or create/manage the Craft app account used for shop ownership and account-level services. |
| Web Studio | `/account/web` and `/account/web/studio/...` | Manage websites and the main shop workspace. |
| Products | `/account/products`, `/store/products` | Add, edit, remove, and publish products. |
| Categories | `/account/categories`, `/store/categories` | Create and manage product categories. |
| Inventory | `/account/inventory`, `/store/inventory` | Review and update shop stock. |
| Website design | `/account/web/themes`, `/account/web/themes/select`, `/account/web/site` | Choose a theme and edit the storefront in Theme Studio. |
| Website/store settings | `/account/web/store`, `/account/store` | Update customer-facing store details and related store information. |
| Web profile | `/account/profile/...` | Manage profile sections, accounts, websites, and custom domains. |
| POS | `/pos` and `/pos/...` | Counter sales, inventory, customer records, orders, and business management. |
| Live storefront | `/web` | Preview/open the customer-facing shop. |
| Storefront pages | `/categories`, `/category/...`, `/product/...`, `/search`, `/bag`, `/checkout` | Customer shopping journey. |

Routes can have additional query parameters (for example search, sort, price range, stock filter, or a new-site setup state).

## Home

**Route:** `/`

The Home screen is the app launchpad. It provides:

- **Craft/Web Studio** link to shop and website management.
- **POS** link to the counter-sales workspace.
- **Main Store** link to the main shop workspace.
- **Account** icon to the app account screen.
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

Custom pages are distinct from the theme's product/category content. The theme should not replace or rewrite catalog data.

## Theme selection, Theme Studio, and publishing

### Theme catalog

**Routes:** `/account/web/themes` and `/account/web/themes/select`

The current selectable theme is **Elora Linen**. Aviya and Stepz are not offered in the picker. Legacy theme files and compatibility code may remain for older already-published websites; their presence does not make them current selectable themes.

### Theme Studio

**Route:** `/account/web/site` (with query parameters for editing or new-site setup)

Theme Studio loads the bundled theme in the shared HTML editor. It supports editing a preview, saving a design, and returning the saved design to Craft. A new shop can continue from the editor into final website setup.

For Elora, the intended division is:

- Preserve the theme's visual design, typography, colors, and product/category card styling.
- Populate product and category content from the selected shop's Craft catalog.
- Do not import Elora's sample product names or sample catalog as the shop's data.
- Product and category imagery comes from the shop catalog; owners add actual product photos through product management.

### Publishing

Publishing validates the filled storefront and sends the selected shop's catalog/site output through the Cloudflare Worker. Published storefronts serve the validated, shop-filled result rather than exposing the raw editor template. Product media is uploaded to the configured R2 media area when the publishing configuration supports it.

**Payment limitation:** the bundled Elora demo checkout is not a live payment integration. It no longer displays a false “checkout complete” success message. A real online payment experience requires the supported payment/account configuration and checkout route, not just the demo theme's button.

## Customer-facing storefront

### Live Web

**Route:** `/web`

Displays the live shop preview/storefront using the selected shop's catalog and store configuration.

### Shopping screens

- **Categories:** `/categories` lists available categories.
- **Category:** `/category/<slug>` displays a category's products, with sort and optional price/stock filters.
- **Product:** `/product/<slug>` shows product details and images.
- **Search:** `/search` searches the shop catalog.
- **Favorites:** `/favorites` lists saved/favorite products.
- **Bag:** `/bag` displays items selected for purchase.
- **Checkout:** `/checkout` collects checkout/order information through the configured storefront flow.
- **Order confirmation:** `/checkout/confirmation` displays the result of an order/checkout flow.
- **Custom page:** `/pages/<slug>` displays a published custom page.

The customer storefront and the app's local management screens share shop data through the application catalog. Whether an online payment is completed depends on the configured provider and the actual checkout integration; a theme preview by itself cannot charge a customer.

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

## Store payments and online orders

The Web Studio has payment settings for supported website checkout and displays online order/payment records where that integration is enabled. Account-level payment configuration and shop catalog publishing are separate steps. POS payment recording and website checkout are also separate flows.

Selecting mobile money in POS records the sale based on the operator's manual verification.

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
```

Android sync/build workflow:

```powershell
npm run cap:sync
Set-Location android
.\gradlew.bat assembleDebug
```

The debug APK is written under `android/app/build/outputs/apk/debug/`. Installation requires Android SDK/ADB and a connected or authorized Android device.

## Source map for maintainers

| Code | Responsibility |
|---|---|
| `index.html` | Main route controller, app workspace screens, profile/web settings, and storefront route dispatch. |
| `src/bootstrap.js` | Initializes SQLite, POS, theme runtime globals, and Capacitor app services. |
| `src/sqlite.js` | SQLite database setup and browser/native persistence bridge. |
| `src/pos.js` | POS screens, checkout, inventory, orders, invoices, suppliers, reports, settings, and sync workflows. |
| `archive/mpesa-ui/` | Archived dedicated M-Pesa workspace snapshot and tools; not compiled into the active app. |
| `archive/mpesa-notification-listener/` | Archived Android listener and JavaScript bridge; not compiled into the active app. |
| `src/theme-catalog.js` | Selectable storefront theme catalog; currently Elora Linen only. |
| `public/theme-packages/elora-linen/index.html` | Elora storefront package and preview. |
| `public/theme-importer.js`, `public/theme-skeleton-engine.js` | Import and fill HTML themes using the shop's current products/categories. |
| `public/liquid-themes/theme-studio.html` | Shared HTML/Liquid Theme Studio editor. |
| `cloudflare/worker.js` | Cloudflare API, authentication/account/shop endpoints, publishing, storefront delivery, and related services. |
| `tests/` | Automated coverage for POS, archived M-Pesa tools, themes, accounts, domains, analytics, and Worker behavior. |

## Known boundaries

- Theme previews and demo content are not a substitute for a real shop catalog; published catalog content should come from the selected shop's records.
- The Elora template's checkout is not itself a real payment processor.
- Analytics and business warnings depend on the completeness and correctness of saved data.
- Optional Cloudflare publishing, custom domains, online payments, and cloud sync require their respective accounts, credentials, DNS, and service configuration.
