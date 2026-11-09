import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { WEBSITE_THEME_CATALOG } from '../src/theme-catalog.js';
import {
  classifyQrCode, createPosApp, matchProductLabel, MIN_IMAGE_MATCH_SIMILARITY,
  parseProductLabel, rankImageMatches, suggestImageCategories
} from '../src/pos.js';

test('POS cart interactions render locally without reloading saved POS state', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const addCart = source.match(/else if \(action === 'add-cart'\) \{([\s\S]*?)\n      \} else if \(action === 'cart-plus'/)?.[1];
  const addProduct = source.match(/async function addProductToSale\([\s\S]*?\n  \}/)?.[0];
  assert.ok(addCart);
  assert.match(addCart, /updateCartPanel\(\)/);
  assert.doesNotMatch(addCart, /await refresh\(\)/);
  assert.ok(addProduct);
  assert.match(addProduct, /updateCartPanel\(\)/);
  assert.doesNotMatch(addProduct, /await refresh\(\)/);
});

test('POS sales load all line items in one batch instead of querying once per sale', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const listSales = source.match(/async function listSales\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(listSales);
  assert.match(listSales, /FROM pos_sale_items WHERE sale_id IN \(SELECT id FROM pos_sales\)/);
  assert.doesNotMatch(listSales, /for \(const sale of sales\) \{[\s\S]*?await rows\(/);
});

test('POS product and inventory rows expose pencil and trash actions', async () => {
  const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const inventory = source.match(/if \(screen === '\/catalogue\/inventory'\) \{([\s\S]*?)\n    \}\n    return `<section class="pos-content">/)?.[1];
  assert.ok(inventory, 'POS inventory screen should have a bounded renderer.');
  assert.match(inventory, /iconLink\(`\/pos\/inventory\?edit=\$\{item\.id\}`/);
  assert.match(inventory, /iconButton\('delete-product'/);
  const products = source.match(/if \(screen === '\/catalogue\/products'\) \{([\s\S]*?)\n    \}\n    if \(screen === '\/catalogue\/categories'\)/)?.[1];
  assert.ok(products, 'POS products screen should have a bounded renderer.');
  assert.match(products, /iconLink\(`\/pos\/catalogue\/products\?edit=\$\{item\.id\}`/);
  assert.match(products, /iconButton\('delete-product'/);
  assert.match(source, /if \(screen === '\/catalogue\/products'\)[\s\S]*?params\.get\('edit'\)[\s\S]*?productForm\(product\)/);
  const categories = source.match(/if \(screen === '\/catalogue\/categories'\) \{([\s\S]*?)\n    \}\n    if \(screen === '\/catalogue\/suppliers'\)/)?.[1];
  assert.ok(categories, 'POS categories screen should have a bounded renderer.');
  assert.match(categories, /iconButton\('rename-category'/);
  assert.match(categories, /iconButton\('delete-category'/);
  assert.match(categories, /Default category/);
  assert.match(source, /<details class="pos-catalogue-item">[\s\S]*?iconButton\('rename-category'/);
  assert.match(source, /productDetailsCards\('\/pos\/catalogue\/products'\)/);
  assert.match(source, /productDetailsCards\('\/pos\/inventory', 'inventory'\)/);
  assert.match(source, /summaryMode === 'inventory'[\s\S]*?in stock/);
  assert.match(source, /categoryDetailsCards\(\)/);
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /\.pos-row-actions \.pos-icon-action \{[\s\S]*?border: 0 !important;[\s\S]*?background: transparent !important/);
  assert.match(pageSource, /\.pos-row-actions \.product-list-delete \{[\s\S]*?color: var\(--danger\)/);
  assert.match(pageSource, /@media \(max-width: 520px\) \{[\s\S]*?\.pos-catalogue-desktop-list \{\s*display: none/);
  assert.match(pageSource, /@media \(max-width: 520px\) \{[\s\S]*?\.pos-mobile-catalogue \{\s*display: grid/);
  assert.match(pageSource, /\.pos-catalogue-item\[open\] \{[\s\S]*?background: var\(--app-card-surface/);
  assert.match(pageSource, /\.pos-catalogue-item > summary strong \{[\s\S]*?font-size: 0\.84rem;[\s\S]*?font-weight: 500/);
});

test('Orders removes the New sale border and quotations use selectable three-column product cards', async () => {
  const [source, pageSource] = await Promise.all([
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  const orders = source.match(/function renderOrders\(\) \{([\s\S]*?)\n  \}/)?.[1];
  const quotations = source.match(/function renderQuotations\(\) \{([\s\S]*?)\n  \}/)?.[1];

  assert.ok(orders, 'Orders renderer should exist.');
  assert.match(orders, /class="btn-secondary pos-orders-new-sale">New sale/);
  assert.ok(quotations, 'Quotations renderer should exist.');
  assert.match(quotations, /class="pos-product-picks pos-quote-product-grid"/);
  assert.match(quotations, /class="pos-product-tile pos-quote-product"/);
  assert.match(quotations, /type="checkbox" name="products" value="\$\{product\.id\}"/);
  assert.match(quotations, /product\.imageUri[\s\S]*?pos-product-placeholder/);
  assert.match(pageSource, /\.pos-orders-new-sale\s*\{\s*border:\s*0 !important/);
  assert.match(pageSource, /\.pos-quote-product-grid\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(pageSource, /\.pos-quote-product input\[type="checkbox"\]\s*\{[\s\S]*?position:\s*absolute/);
});

test('More keeps its three destinations in separate full-width cards', async () => {
  const [source, pageSource] = await Promise.all([
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  const more = source.match(/function renderMore\(\) \{([\s\S]*?)\n  \}/)?.[1];

  assert.ok(more, 'More renderer should exist.');
  assert.equal((more.match(/'pos-more-card'/g) || []).length, 3);
  assert.match(more, /Business instances/);
  assert.match(more, /Sales &amp; receipts/);
  assert.match(more, /Settings/);
  assert.match(pageSource, /\.pos-content \.pos-more-card\s*\{[^}]*width:\s*100vw[^}]*margin-left:\s*calc\(50% - 50vw\)/);
  assert.match(pageSource, /\.pos-more-link\s*\{[^}]*min-height:\s*104px/);
});

test('workspace screen navigation uses side drawers and loading placeholders use skeletons', async () => {
  const [pageSource, posSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8')
  ]);
  assert.match(pageSource, /renderWorkspaceSidebar\(title, items, activeRoute\)[\s\S]*?workspace-sidebar-scrim[\s\S]*?workspace-sidebar-links[\s\S]*?aria-current="page"/);
  assert.match(pageSource, /title: "Orders" \},\s*\{ route: "\/store\/payments", title: "Payments" \}/);
  assert.doesNotMatch(pageSource, /class="studio-workspace-top-nav"|class="studio-nested-nav"/);
  assert.match(posSource, /const sectionMenu = \(title, items, current\)[\s\S]*?workspace-sidebar-scrim[\s\S]*?workspace-sidebar-links/);
  assert.match(posSource, /sectionMenu\('Overview sections', tabs\.map/);
  assert.doesNotMatch(posSource, /pos-subnav|pos-overview-tabs/);
  const businessRenderer = pageSource.match(/renderMainShopWorkspace\(path\) \{([\s\S]*?)\r?\n  webStudioNavigation\(/)?.[1];
  const webStudioRenderer = pageSource.match(/renderWebStudioWorkspace\(path\) \{([\s\S]*?)\r?\n  async getMainShopSnapshot\(/)?.[1];
  assert.match(businessRenderer || '', /getCachedMainShopSnapshot\(\)[\s\S]*?renderMainShopContent\(path, cachedSnapshot\)[\s\S]*?renderWorkspaceLoading/);
  assert.match(webStudioRenderer || '', /getCachedMainShopSnapshot\(\)[\s\S]*?renderMainShopContent\(path, cachedSnapshot\)[\s\S]*?renderWorkspaceLoading/);
  assert.match(pageSource, /const profileLinks = \[[\s\S]*?title: "Profile"[\s\S]*?title: "Webs"[\s\S]*?title: "Accounts"[\s\S]*?title: "Privacy"[\s\S]*?title: "Recommended actions"[\s\S]*?title: "Link devices"[\s\S]*?title: "Updates"/);
  assert.match(pageSource, /Profile and app links[\s\S]*?profileLinks\.map[\s\S]*?workspace-sidebar-logout/);
  assert.match(posSource, /workspace-sidebar-divider[\s\S]*?Profile and app links[\s\S]*?Profile[\s\S]*?Webs[\s\S]*?Accounts[\s\S]*?Privacy[\s\S]*?Recommended actions[\s\S]*?Link devices[\s\S]*?Updates[\s\S]*?Log out/, 'POS drawer should append the profile, account and privacy links and logout.');
  assert.doesNotMatch(pageSource, /studio-hamburger/);
  assert.match(pageSource, /const sectionSidebar = this\.renderWorkspaceSidebar/);
  assert.match(pageSource, /\$\{this\.renderWorkspaceSidebar\(`\$\{page\.section\.title\} screens`/);
  assert.match(pageSource, /\.business-lens-shell \.workspace-sidebar-link \{\s*font-size:\s*\.76rem/);
  assert.match(pageSource, /\.business-lens-shell \.studio-workspace-bottom-link \{\s*gap:\s*2px;\s*font-size:\s*\.55rem/);
  assert.match(pageSource, /\.bl-date-filter select,[\s\S]*?\.bl-inline-filter input \{\s*min-height:\s*32px;[\s\S]*?border:\s*0;/);
  assert.match(pageSource, /\.bl-filter-row button \{[^}]*border:\s*0;/);
  assert.match(pageSource, /\.workspace-sidebar-logout\s*\{[\s\S]*?color:\s*#ffc1c1/);
  const mainShopSnapshot = pageSource.match(/async getMainShopSnapshot\(\) \{([\s\S]*?)\r?\n  \},\r?\n\r?\n  formatMainShopMoney/)?.[1];
  assert.ok(mainShopSnapshot);
  assert.doesNotMatch(mainShopSnapshot, /listBusinessRecords/);
  assert.match(pageSource, /const \[suppliers, purchaseOrders, tickets\] = await Promise\.all\([\s\S]*?listBusinessRecords\("supplier", tenantId\)[\s\S]*?listBusinessRecords\("purchase", tenantId\)[\s\S]*?listBusinessRecords\("ticket", tenantId\)/);
  assert.match(pageSource, /home-dashboard-skeleton[\s\S]*?home-data-card[\s\S]*?home-data-label home-skeleton-line[\s\S]*?home-data-value home-skeleton-line[\s\S]*?home-data-note home-skeleton-line[\s\S]*?home-attention-row[\s\S]*?home-recent-row/);
  assert.match(pageSource, /renderWorkspaceLoading\(label\)[\s\S]*?studio-metric-grid[\s\S]*?studio-data-card[\s\S]*?studio-panel workspace-skeleton-panel/);
});

test('barcode and QR scanning formats route safely without treating QR text as a product', () => {
  assert.deepEqual(classifyQrCode('ESHOP-RECEIPT:POS-123'), {
    type: 'receipt', label: 'Receipt reference', content: 'ESHOP-RECEIPT:POS-123'
  });
  assert.deepEqual(classifyQrCode('https://shop.example/products'), {
    type: 'link', label: 'Store or web link', content: 'https://shop.example/products'
  });
  assert.deepEqual(classifyQrCode('123456789012'), {
    type: 'text', label: 'QR code text', content: '123456789012'
  });
});

test('loading website stock imports local website products into POS without admin-key sync', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sync = posSource.match(/async function syncSharedStock\(source\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function toast/)?.[1];
  assert.ok(sync, 'POS shared stock flow should be present.');
  assert.match(sync, /let catalog = bridge\.localCatalog\(websiteId\)[\s\S]*?if \(\(!catalog \|\| !catalog\.products\?\.length\) && navigator\.onLine !== false\) \{\s*catalog = await bridge\.catalog\(websiteId\)/);
  assert.match(sync, /if \(source === 'website'\)[\s\S]*?for \(const websiteProduct of \(catalog\.products \|\| \[\]\)\.filter\(\(product\) => product\.status !== 'archived'\)\)[\s\S]*?await addCategory\(categoryName\)[\s\S]*?await saveProduct\(\{[\s\S]*?stock,[\s\S]*?const saved = \(await listProducts\(\)\)/);
  assert.match(sync, /return \{ count: imported\.length, pending: 0, localOnly: true \}/);
  assert.doesNotMatch(sync.match(/if \(source === 'website'\) \{([\s\S]*?)\r?\n    \}\r?\n    const websiteBySku/)?.[1] || '', /bridge\.request|syncInventorySales/);
  assert.match(posSource, /result\.localOnly[\s\S]*?loaded into this device's POS\. Cloud stock sharing is separate/);
  assert.match(posSource, /hasTenantOwnerKey\?\.\(event\.tenant_id\) === false\) continue/);
  assert.match(appSource, /hasTenantOwnerKey\(tenantId\) \{[\s\S]*?item\.tenant_id === tenantId && typeof item\.owner_token === "string" && item\.owner_token/);
});

test('embedded theme preview replaces demo catalog and resolves merchant product categories', async () => {
  const appSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const seed = JSON.parse(await readFile(
    new URL('../public/theme-packages/drizzle-restaurant/data.json', import.meta.url), 'utf8'
  ));
  const start = appSource.indexOf('const themeData = JSON.parse(embeddedDataScript[2]);');
  const end = appSource.indexOf('const safeThemeData = JSON.stringify(mergedThemeData)', start);
  assert.ok(start >= 0 && end > start, 'Embedded theme catalog mapping should be present.');
  const mergeCatalog = new Function(
    'embeddedDataScript',
    'catalog',
    'theme',
    `${appSource.slice(start, end)}\nreturn mergedThemeData;`
  );
  const merged = mergeCatalog([null, null, JSON.stringify(seed)], {
    categories: [{ id: 12, name: 'Food' }, { id: 34, name: 'Drinks' }],
    products: [
      { id: 101, name: 'Merchant meal', category_id: 12, price: 8, status: 'active' },
      { id: 102, name: 'Merchant tea', category_name: 'drinks', price: 3, status: 'active' }
    ]
  }, { name: 'Drizzle' });

  assert.deepEqual(merged.categories.map(({ name }) => name), ['Food', 'Drinks']);
  assert.deepEqual(merged.products.map(({ name }) => name), ['Merchant meal', 'Merchant tea']);
  assert.deepEqual(merged.products.map(({ categoryIds }) => categoryIds), [
    ['eshop-category-12'],
    ['eshop-category-34']
  ]);
  assert.ok(!JSON.stringify(merged.products).includes('Drizzle Artisan Burger'));
  assert.match(appSource, /if\(String\(key\)==="drizzle\.restaurant\.v1"\)return null/);
});

test('label OCR parser suggests product name, currency price and validated expiry date', () => {
  assert.deepEqual(parseProductLabel('Kijani Tea 250g\nKSh 125.50\nEXP: 2027-04-15'), {
    name: 'Kijani Tea 250g', price: 125.5, expiryDate: '2027-04-15'
  });
  assert.deepEqual(parseProductLabel('MILK\nBest before 31/02/2027'), {
    name: 'MILK', price: null, expiryDate: ''
  });
});

test('label scans match only saved catalogue names and reject unknown or ambiguous products', () => {
  const products = [
    { id: 1, name: 'Kijani Tea 250g', active: true },
    { id: 2, name: 'Kijani Tea 500g', active: true },
    { id: 3, name: 'Milk', active: true }
  ];
  assert.equal(matchProductLabel('KIJANI TEA 250g\nNet weight 250g\nBest before 2027', products)?.id, 1);
  assert.equal(matchProductLabel('KIJANI\nTEA\n250g\nNet weight 250g', products)?.id, 1);
  assert.equal(matchProductLabel('Kijani Tea', products), null);
  assert.equal(matchProductLabel('Fresh milk and other groceries', products), null);
  assert.equal(matchProductLabel('No saved product here', products), null);
});

test('photo category suggestions map image labels only to existing categories', () => {
  const categories = [{ id: 1, name: 'Food' }, { id: 2, name: 'Drinks' }, { id: 3, name: 'Other' }];
  assert.deepEqual(
    suggestImageCategories([{ text: 'Fruit', confidence: 0.95 }, { text: 'Bottle', confidence: 0.88 }], categories)
      .map(({ categoryId }) => categoryId),
    [1, 2]
  );
  assert.deepEqual(suggestImageCategories([{ text: 'Unknown object', confidence: 0.99 }], categories), []);
});

test('photo matching returns only confident top-three choices and never auto-selects', () => {
  const hex = (values) => values.map((value) => ((value + 256) % 256).toString(16).padStart(2, '0')).join('');
  const query = new Int8Array([127, 0, 0, 0]);
  const products = [
    { id: 1, name: 'close', imageEmbeddingHex: hex([126, 4, 0, 0]) },
    { id: 2, name: 'exact', imageEmbeddingHex: hex([127, 0, 0, 0]) },
    { id: 3, name: 'other', imageEmbeddingHex: hex([0, 127, 0, 0]) },
    { id: 4, name: 'similar', imageEmbeddingHex: hex([121, 30, 0, 0]) },
    { id: 5, name: 'fourth', imageEmbeddingHex: hex([110, 64, 0, 0]) }
  ];
  const matches = rankImageMatches(products, query);
  assert.equal(MIN_IMAGE_MATCH_SIMILARITY, 0.7);
  assert.deepEqual(matches.map(({ product }) => product.id), [2, 1, 4]);
  assert.equal(rankImageMatches(products, query, 1).length, 1);
  assert.equal(rankImageMatches(products, new Int8Array(4)).length, 0);
});

test('photo matching ranks 5000 saved embeddings within the local scan budget', () => {
  const query = new Int8Array(1024);
  query[0] = 127;
  const products = Array.from({ length: 5000 }, (_, id) => {
    const imageEmbedding = new Int8Array(1024);
    imageEmbedding[0] = id === 4999 ? 127 : 0;
    imageEmbedding[1] = id === 4999 ? 0 : 127;
    return { id, imageEmbedding };
  });
  const started = performance.now();
  const matches = rankImageMatches(products, query);
  assert.ok(performance.now() - started < 1000, '5000-image cosine ranking should finish within one second');
  assert.deepEqual(matches.map(({ product }) => product.id), [4999]);
});

test('POS sales and received purchases queue refreshed product stock for cloud sync', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const receiveStart = posSource.indexOf('async function receivePurchaseOrder(recordId)');
  const syncStart = posSource.indexOf('async function syncInventorySales', receiveStart);
  const checkoutStart = posSource.indexOf("case 'checkout': {");
  const paymentStart = posSource.indexOf("case 'payment': {", checkoutStart);
  const receivePurchase = posSource.slice(receiveStart, syncStart);
  const checkout = posSource.slice(checkoutStart, paymentStart);
  const saveCheckoutStart = posSource.indexOf('async function saveCheckout(');
  const saveCheckoutEnd = posSource.indexOf('async function queueCloudRecord(', saveCheckoutStart);
  const saveCheckout = posSource.slice(saveCheckoutStart, saveCheckoutEnd);
  assert.ok(receiveStart >= 0 && syncStart > receiveStart, 'Purchase receiving should have a bounded implementation.');
  assert.ok(checkoutStart >= 0 && paymentStart > checkoutStart, 'POS checkout should have a bounded implementation.');
  assert.ok(saveCheckoutStart >= 0 && saveCheckoutEnd > saveCheckoutStart, 'POS checkout should reuse the shared sale-save flow.');
  assert.match(receivePurchase, /const products = await listProducts\(\)[\s\S]*?await queueProduct\(product\)/);
  assert.match(saveCheckout, /const productsAfterSale = await listProducts\(\)[\s\S]*?await queueProduct\(product\)/);
  assert.match(checkout, /await saveCheckout\(data, method, Boolean\(method\)\)/);
  assert.doesNotMatch(posSource, /beginMpesaWait|finishMpesaSale|matchesMpesaSalePayment/);
  const appStart = posSource.indexOf('export function createPosApp()');
  const queueCategory = posSource.indexOf('async function queueCategory(category', appStart);
  const seedCatalogue = posSource.indexOf('async function seedCatalogueSync()', appStart);
  assert.ok(queueCategory > appStart && seedCatalogue > queueCategory,
    'Catalogue seeding must be scoped inside createPosApp where queueCategory is defined.');
  assert.match(posSource.slice(seedCatalogue, posSource.indexOf('async function applyRemoteChange', seedCatalogue)),
    /queueCategory\(category\)[\s\S]*queueProduct\(product\)[\s\S]*queueExpense\(expense\)/);
  const queueProductStart = posSource.indexOf('async function queueProduct(product', appStart);
  const queueCategoryStart = posSource.indexOf('async function queueCategory(category', queueProductStart);
  const productQueue = posSource.slice(queueProductStart, queueCategoryStart);
  assert.match(productQueue, /if \(!product\.sku\)[\s\S]*createSku\(\)[\s\S]*UPDATE pos_products SET sku=/);
  assert.doesNotMatch(productQueue, /This product needs a SKU before it can sync/);
  assert.match(posSource, /async function seedCloudCatalogueForTenant\(tenantId\)[\s\S]*cloud_catalogue_seeded:\$\{tenantId\}[\s\S]*seedCatalogueSync\(\)/);
  assert.match(posSource, /async function syncCloudBusinessRecords\(\)[\s\S]*await seedCloudCatalogueForTenant\(tenantId\)/);
  assert.match(posSource, /let pageCursor = cursor;[\s\S]*latestChanges = new Map\(\)[\s\S]*const previous = latestChanges\.get\(key\)/);
  assert.match(posSource, /while \(pageCursor < latestRevision && pageLength === 500 && pagesRead < 20\)/);
  assert.match(posSource, /Cloud sync returned an invalid change list/);
  assert.match(posSource, /Cloud backup and sync/);
  assert.match(posSource, /including the phone app/);
  assert.match(posSource, /<\/strong> <span>\$\{escapeHtml\(detail\)\}/);
});

test('Android POS exposes same-shop Bluetooth phone-to-phone snapshot sync', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const nativePlugin = await readFile(
    new URL('../android/app/src/main/java/com/eshop/atelier/NearbyBluetoothPlugin.java', import.meta.url),
    'utf8'
  );
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(posSource, /button\('Receive over Bluetooth', 'nearby-bt-host'/);
  assert.match(posSource, /button\('Find a Bluetooth register', 'nearby-bt-find'/);
  assert.match(posSource, /async function startBluetoothNearbySync\(mode\)[\s\S]*?state\.cloudScopeId === 'local'[\s\S]*?NearbyBluetooth\.startHosting\(\)[\s\S]*?NearbyBluetooth\.startDiscovery\(\)/);
  assert.match(nativePlugin, /listenUsingRfcommWithServiceRecord/);
  assert.match(nativePlugin, /createRfcommSocketToServiceRecord/);
  assert.match(nativePlugin, /MAX_MESSAGE_BYTES = 64 \* 1024/);
  assert.match(manifest, /android\.permission\.BLUETOOTH_SCAN/);
  assert.match(manifest, /android\.permission\.BLUETOOTH_CONNECT/);
  assert.match(manifest, /android\.permission\.BLUETOOTH_ADVERTISE/);
});

test('published Craft storefront runtime syncs customer activity without running in previews', async () => {
  const theme = await readFile(new URL('../public/theme-packages/craft-main-storefront/index.html', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../public/craft-storefront-cloudflare.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(theme, /src="\/craft-storefront-cloudflare\.js"[^>]*data-craft-cloudflare-runtime/);
  assert.match(runtime, /window\.__ESHOP_CLOUDFLARE_STOREFRONT__ !== true/);
  assert.match(runtime, /\/api\/product-interest/);
  assert.match(runtime, /location\.hash\.slice\(1\)/);
  assert.match(app, /productViewsBySlug\.get\(String\(product\.slug \|\| ""\)\)[\s\S]*?productViewsBySlug\.get\(String\(product\.id\)\)/);
  assert.match(runtime, /\/api\/orders/);
  assert.match(runtime, /\/api\/payments\/paystack\/initialize/);
  assert.match(runtime, /requestProductHold\(form\)/);
  assert.match(runtime, /\/api\/product-holds/);
  assert.match(runtime, /\/api\/newsletter\/subscribe/);
  assert.match(theme, /id="product-hold-form" data-product-id=/);
  assert.match(theme, /Request a hold/);
  assert.match(theme, /not reserved until the shop approves your request/);
  assert.match(app, /const themeId = "craft-main-storefront";[\s\S]*?const publishStore = \{[\s\S]*?website_theme_id: themeId/);
  assert.match(app, /store\.website_theme_id\) \|\| "craft-main-storefront"/);
  assert.match(app, /key: "remoteHolds",[\s\S]*?listStorefrontHolds\(activeTenant\.id\)/);
  assert.match(app, /key === "remoteHolds"[\s\S]*?result\.value\.holds/);
  assert.doesNotThrow(() => new Script(runtime), 'The injected customer activity runtime should parse as JavaScript.');
});

test('nearby Wi-Fi pairing needs one phone scan and asks the PC operator before transfer', async () => {
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const appBridge = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(posSource, /The phone scans this register’s QR once/);
  assert.match(posSource, /encrypted POS transfer goes directly over the same Wi-Fi/);
  assert.match(posSource, /nearbyPairing\(tenantId, 'GET'[\s\S]*?relayOffer\.offer[\s\S]*?nearbyPairing\(tenantId, 'POST'[\s\S]*?action: 'answer'/);
  assert.match(posSource, /window\.confirm\(`A phone scanned this PC’s pairing QR[\s\S]*?transfer POS data\?`\)/);
  assert.doesNotMatch(posSource, /data-nearby-scan-answer|Pairing answer/);
  assert.match(posSource, /type: 'record-change'/);
  assert.match(posSource, /Connected to \$\{peerName\} · Live sync on/);
  assert.match(posSource, /snapshot-request[\s\S]*?initial-response/);
  assert.match(posSource, /cloudSyncEnabled && document\.visibilityState !== 'hidden'[\s\S]*?\}, 5000\)/);
  assert.match(appBridge, /nearbyPairing\(tenantId, method, data = \{\}\)[\s\S]*?AppController\.cloudflareRequest/);
});

test('browser register is a separate Capacitor-free POS entry with persistent browser storage', async () => {
  const page = await readFile(new URL('../register.html', import.meta.url), 'utf8');
  const browserEntry = await readFile(new URL('../src/browser-register.js', import.meta.url), 'utf8');
  assert.match(page, /Craft Register/);
  assert.match(page, /Connect this register to your shop.s Cloudflare sync/);
  assert.match(page, /Craft account username/);
  assert.match(page, /pattern="\[a-z0-9\\-]\+"/);
  assert.match(page, /id="browser-cloud-form" method="post"/);
  assert.match(page, /id="browser-sync-state"/);
  assert.match(page, /id="browser-sync-action"/);
  assert.match(page, /id="browser-disconnect-action"/);
  assert.match(page, /id="browser-use-shop-action"/);
  assert.match(page, /id="browser-reset-action"/);
  assert.match(page, /browser-data-status/);
  assert.match(page, /Use this shop.s POS[\s\S]*?does not erase cloud records or data on other devices/);
  assert.match(page, /src="\/src\/browser-register\.js"/);
  assert.match(browserEntry, /from 'sql\.js'/);
  assert.match(browserEntry, /indexedDB\.open/);
  assert.match(browserEntry, /\/api\/auth\/login/);
  assert.match(browserEntry, /\/api\/business\/records/);
  assert.match(browserEntry, /https:\/\/eshop-storefront\.ryanrobin07-ek\.workers\.dev/);
  assert.match(browserEntry, /history\.replaceState/);
  assert.match(browserEntry, /activeWebsiteId:/);
  assert.match(browserEntry, /syncPosRecords: requestCloud/);
  assert.match(browserEntry, /nearbyPairing: requestNearbyPairing/);
  assert.match(browserEntry, /setAccountShops\(shops, cloudConnection\.tenant\)/);
  assert.match(browserEntry, /This browser is connected to \$\{cloudConnection\.tenant\}, but its backup is still set to \$\{status\.tenant\}/);
  assert.match(browserEntry, /Permanently erase all POS records stored in this browser/);
  assert.match(browserEntry, /ShopPOS\.stopNearbySync\(\)[\s\S]*?ShopPOS\.disconnectCloudSync\(\)[\s\S]*?ShopSQLite\.clearSavedData\(\)/);
  assert.match(browserEntry, /function clearSavedDatabase\(store\)[\s\S]*?objectStore\(DATABASE_STORE\)\.delete\(DATABASE_KEY\)/);
  assert.match(browserEntry, /Use this shop.s POS[\s\S]*?replaceWithCloudShop\(cloudConnection\.tenant\)/);
  assert.match(browserEntry, /local products, stock, receipts[\s\S]*?does not change the shop.s cloud records/);
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  assert.match(posSource, /async function disconnectCloudSync\(\)[\s\S]*?cloud_sync_enabled','0'[\s\S]*?await refresh\(\)/);
  assert.match(posSource, /async function replaceWithCloudShop\(tenantId\)[\s\S]*?The shop returned an invalid POS record list[\s\S]*?DELETE FROM pos_cloud_outbox[\s\S]*?cloud_catalogue_seeded:\$\{tenantId\}[\s\S]*?await applyRemoteChange\(change\)/);
  assert.match(posSource, /getCloudSyncStatus, syncCloudNow, switchCloudSyncTenant, replaceWithCloudShop, disconnectCloudSync, stopNearbySync/);
  assert.match(browserEntry, /switchCloudSyncTenant\(cloudConnection\.tenant\)/);
  assert.match(browserEntry, /setupBrowserNavigation\(\)/);
  assert.match(browserEntry, /event\.preventDefault\(\);[\s\S]*?const nextHash = `#\$\{route\}`/);
  assert.match(browserEntry, /updateSyncBanner\(\)/);
  assert.match(browserEntry, /Connected to \$\{cloudConnection\.tenant\}, but cloud backup is OFF on this browser/);
  assert.match(browserEntry, /createPosApp\(\)/);
  assert.match(browserEntry, /ShopPOS\.refresh\(\)/);
  assert.doesNotMatch(browserEntry, /from ['"]@capacitor/);
});

test('Studio payment setup captures the active tenant and allows retry after a timed-out bank request', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const capacitorConfig = await readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
  const studioLoader = pageSource.match(/async loadMainShopWorkspace\(path\) \{([\s\S]*?)\n  \},\n\n  [a-zA-Z]/)?.[1];
  assert.ok(studioLoader, 'Studio workspace event handlers should have a bounded loader scope.');
  assert.match(studioLoader, /const activeTenant = AppController\.getActiveTenant\(\);/);
  assert.match(pageSource, /paystackSetupRequest\(path, tenantId, options = \{\}, anonymous = false\)[\s\S]*?setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
  assert.match(pageSource, /data-paystack-retry hidden/);
  assert.match(pageSource, /bindBusinessCloudActions\(container, path, snapshot,[\s\S]*?\["\/account\/payments", "\/account\/web\/studio\/payments"\]\.includes\(path\)[\s\S]*?bindPaystackSetup\(container, tenantId\)/);
  assert.match(pageSource, /Promise\.allSettled\(\[[\s\S]*?getPaystackAccount\(tenantId\)[\s\S]*?getPaystackBanks\(tenantId\)/);
  assert.match(pageSource, /getPaystackBanks\(tenantId\)[\s\S]*?tenantId, \{\}, true/);
  assert.match(capacitorConfig, /const appHostname = 'rrobin\.co\.ke';[\s\S]*?hostname: appHostname/);
});

test('new websites inherit Paystack from the app account instead of collecting website-specific bank details', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const websiteSetup = pageSource.match(/id="new-website-form"([\s\S]*?)<\/form>/)?.[1];
  const websiteSubmit = pageSource.match(/const newWebsiteForm = document\.getElementById\("new-website-form"\);([\s\S]*?)\n    \}\n    if \(newWebsiteForm\?\.querySelector/)?.[1];
  assert.ok(websiteSetup, 'Website setup should have a bounded form.');
  assert.ok(websiteSubmit, 'Website setup should have a bounded submit handler.');
  assert.match(websiteSetup, /Payment settings belong to your signed-in app account/);
  assert.doesNotMatch(websiteSetup, /paystack_(?:account_number|settlement_bank|business_name)|name="paystack_reuse_existing"/);
  assert.match(websiteSubmit, /Website created at \$\{result\.tenant\.hostname\}\. It uses your app account's Paystack default\./);
  assert.match(websiteSubmit, /this\.getActiveTenant\(\)\.id !== WEBSITE_BUILDER_DRAFT_TENANT_ID[\s\S]*?const draftCatalog = this\.tenantCatalogs\(\)\.find/);
  assert.match(websiteSubmit, /this\.setActiveTenantCatalog\(\{ \.\.\.result\.tenant, owner_token: result\.owner_token \}, \{[\s\S]*?\.\.\.draftCatalog/);
  assert.match(websiteSubmit, /this\.navigate\(`\/account\/web\/site\?tenant=\$\{encodeURIComponent\(result\.tenant\.id\)\}`\)/);
  assert.doesNotMatch(websiteSubmit, /await this\.applyWebsiteBuilderDraft/);
  assert.doesNotMatch(websiteSubmit, /savePaystackAccount|setPaystackDefault|paystackDetails/);
  assert.match(pageSource, /App-account Paystack payments/);
  assert.match(pageSource, /Every website registered to your app account will use this account at checkout/);
  assert.match(pageSource, /async bindPaystackReuseSetup\(container, tenantId\)[\s\S]*?setPaystackDefault\(/);
  assert.match(pageSource, /getPaystackDefault\(tenantId\)[\s\S]*?\/api\/payments\/paystack\/default/);
});

test('choosing a website theme opens the shared Liquid Theme Studio', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const choices = pageSource.match(/renderWebsiteThemeChoices\(\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteTheme\(/)?.[1];
  assert.ok(choices, 'The theme picker should render.');
  assert.match(choices, /const themeEditorRoute = theme => `\/account\/web\/site\?new=1&edit=1&theme=\$\{encodeURIComponent\(theme\.id\)\}`/);
  assert.doesNotMatch(choices, /data-theme-storefront-preview|<iframe/);
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor);
  assert.match(editor, /\/liquid-themes\/theme-studio\.html/);
  assert.match(editor, /searchParams\.set\("loadUrl", studioTheme\.preview_url\)/);
  assert.doesNotMatch(editor, /builder-storefront-html|builder-preview-device|builder-tools-home/);
});

test('Kinetic privacy and Veluna contact navigation render real theme screens', async () => {
  const kinetic = await readFile(new URL('../live-websites/kinetic-electronics/index.html', import.meta.url), 'utf8');
  const veluna = await readFile(new URL('../live-websites/veluna-—-grand-electronics-retail-store/index.html', import.meta.url), 'utf8');
  assert.match(kinetic, /else if \(hash === '#\/privacy'\)\s*\{\s*this\.outlet\.innerHTML = renderStaticPolicyView\(/);
  assert.match(veluna, /hash === '#\/support' \|\| hash === '#\/contact'[\s\S]*?appRoot\.innerHTML = renderSupportPage\(\)/);
});

test('hosted theme editor keeps SPA hash navigation inside the preview iframe', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /hostedTheme && previewDocument && previewWindow && routedHostedPreviewDocument !== previewDocument[\s\S]*?target\?\.closest\("a\[href\]"\)\?\.getAttribute\("href"\)\?\.trim\(\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopImmediatePropagation\(\)[\s\S]*?previewWindow\.location\.hash = href/);
});

test('Main Store shows Split products beside Categories in the Products navigation', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /products:\s*\[[\s\S]*?route: "\/store\/categories", title: "Categories"\s*\},\s*\{\s*route: "\/store\/split-shop", title: "Split products"/);
  assert.match(pageSource, /if \(path === "\/store\/split-shop"\) return this\.renderSplitShop\(snapshot, activeTenant\)/);
  assert.match(pageSource, /"\/store\/categories", "\/store\/inventory", "\/store\/split-shop"/);
  assert.match(pageSource, /this\.bindSplitShopEvents\(renderSnapshot, path\)/);
});

test('M-Pesa workspace is removed and old deep links return to home', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const [bootstrap, archivedUi, archivedTools] = await Promise.all([
    readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-ui/index.html.snapshot', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-ui/mpesa-tools.js', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(pageSource, /home-bento-mpesa|M-Pesa|mpesa-screen|renderMpesaScreen|ShopMpesaTools/);
  assert.match(pageSource, /if \(path === "\/mpesa" \|\| path\.startsWith\("\/mpesa\/"\)\)\s*\{\s*this\.navigate\("\/", true\)/);
  assert.doesNotMatch(bootstrap, /MpesaTools|mpesa-tools/);
  assert.match(archivedUi, /renderMpesaScreen/);
  assert.match(archivedTools, /renderMpesaToolScreen/);
});

test('M-Pesa notification listener is archived and absent from the active app', async () => {
  const [manifest, mainActivity, bootstrap, pageSource, posSource,
    archivedService, archivedParser, archivedPlugin, archivedBridge, archivedUi] = await Promise.all([
    readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MainActivity.java', import.meta.url), 'utf8'),
    readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/pos.js', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/android/app/src/main/java/com/eshop/atelier/MpesaNotificationListenerService.kt', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/android/app/src/main/java/com/eshop/atelier/MpesaNotificationParser.kt', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/android/app/src/main/java/com/eshop/atelier/MpesaNotificationsPlugin.kt', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-notification-listener/src/mpesa-notifications.js', import.meta.url), 'utf8'),
    readFile(new URL('../archive/mpesa-ui/index.html.snapshot', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(manifest, /MpesaNotificationListenerService|BIND_NOTIFICATION_LISTENER_SERVICE/);
  assert.doesNotMatch(manifest, /READ_SMS|RECEIVE_SMS/);
  assert.doesNotMatch(mainActivity, /MpesaNotificationsPlugin/);
  assert.doesNotMatch(bootstrap, /MpesaNotifications|mpesa-notifications/);
  assert.doesNotMatch(pageSource, /bindMpesaNotificationEvents|MpesaNotifications|mpesa-self-identifiers|NotificationListenerService|renderMpesaScreen|ShopMpesaTools/);
  assert.doesNotMatch(posSource, /beginMpesaWait|finishMpesaSale|matchesMpesaSalePayment|MpesaNotifications/);
  assert.match(archivedUi, /renderMpesaScreen/);
  assert.match(archivedService, /NotificationListenerService/);
  assert.match(archivedParser, /sender\.equals\("MPESA", ignoreCase = true\)/);
  assert.match(archivedPlugin, /ACTION_NOTIFICATION_LISTENER_SETTINGS/);
  assert.match(archivedBridge, /transactionReceived/);
  assert.doesNotMatch(pageSource, /data-mpesa-transaction-list|renderMpesaScreen|ShopMpesaTools/);
  await Promise.all([
    assert.rejects(readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MpesaNotificationListenerService.kt', import.meta.url))),
    assert.rejects(readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MpesaNotificationParser.kt', import.meta.url))),
    assert.rejects(readFile(new URL('../android/app/src/main/java/com/eshop/atelier/MpesaNotificationsPlugin.kt', import.meta.url))),
    assert.rejects(readFile(new URL('../src/mpesa-notifications.js', import.meta.url))),
    assert.rejects(readFile(new URL('../src/mpesa-tools.js', import.meta.url)))
  ]);
});

test('classic inline app script avoids Vite rewriting dynamic module imports', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const bootstrap = await readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8');
  assert.doesNotMatch(pageSource, /await import\(["']\//);
  assert.match(pageSource, /EshopThemeRuntime\.loadEditableStorefrontTheme\(\)/);
  assert.equal((pageSource.match(/EshopThemeRuntime\.loadThemeSkeleton\(\)/g) || []).length, 2);
  assert.match(bootstrap, /loadPublicThemeModule = path => import\(\/\* @vite-ignore \*\/ new URL\(path, window\.location\.origin\)\.href\)/);
});

test('filled themes use the shared fill engine while legacy adapter behavior remains available', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../public/theme-catalog-adapter.js', import.meta.url), 'utf8');
  assert.match(pageSource, /fillThemeForShop\(theme\.id, catalog/);
  assert.match(pageSource, /if \(appEditableTheme\) \{[\s\S]*?fillEditableStorefrontTheme/);
  assert.match(pageSource, /filledHtml = await themeClient\.fillThemeForShop\(themeId/);
  assert.match(workerSource, /"craft-main-storefront"/);
  assert.match(workerSource, /published-sites\/\$\{tenantId\}\/\$\{themeId\}\//);
  assert.match(workerSource, /let html = await new Response\(theme\.body\)\.text\(\)/);
  assert.doesNotMatch(workerSource, /const catalogAdapter = `<script src="\/theme-catalog-adapter\.js"/);
  assert.match(adapter, /function adaptProductGrids\(\)/);
  assert.match(adapter, /function setCardProduct\(card, product\)/);
  assert.doesNotMatch(adapter, /function bindCategoryLinks\(\)/);
  assert.doesNotMatch(adapter, /eshopCategoryBound/);
  assert.doesNotMatch(adapter, /applyMobileCardLayout|eshop-mobile-card-layout|eshop-mobile-card-columns/);
  assert.doesNotMatch(pageSource, /builder-mobile-card|data-editor-panel="cards"|Mobile cards|mobile_card_layout,/);
  assert.match(pageSource, /delete updatedStore\.mobile_card_layout/);
  assert.match(pageSource, /bindWebsiteBuilderEvents\(\) \{\s*const editorRouteParams = new URLSearchParams\(this\.currentRoute\(\)\.split\("\?"\)\[1\] \|\| ""\);\s*const draftEditor/);
  assert.match(adapter, /No products are available yet\./);
  assert.match(adapter, /eshopCategoryId/);
  assert.doesNotMatch(adapter, /#eshop-category=/);
  assert.match(adapter, /event\.stopPropagation\(\)/);
  assert.match(adapter, /event\.stopImmediatePropagation\(\)/);
});

test('Website Add controls persist and publish contact settings across hosted themes', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../public/theme-catalog-adapter.js', import.meta.url), 'utf8');
  const storefront = await readFile(new URL('../public/builder-storefront.html', import.meta.url), 'utf8');
  const presets = await import('../src/website-appearance-presets.js');
  assert.match(pageSource, /title: "Add", route: "\/account\/web\/studio\/websites\/add"/);
  assert.match(pageSource, /name="whatsapp_enabled"[\s\S]*?field\("whatsapp_url"[\s\S]*?field\("location_address"[\s\S]*?field\("location_map_embed_url"/);
  assert.match(pageSource, /data-additions-publish[\s\S]*?openCloudflarePublishModal\(\)/);
  assert.match(pageSource, /whatsapp_enabled: data\.get\("whatsapp_enabled"\) === "on" \? 1 : 0/);
  assert.match(adapter, /function applyContactFooter\(\)/);
  assert.match(adapter, /https:\/\/wa\.me\/\$\{phoneDigits\}/);
  assert.match(adapter, /location_map_embed_url/);
  assert.match(adapter, /socialLinks\.forEach/);
  assert.match(adapter, /data-eshop-floating-contacts/);
  assert.match(adapter, /aria-label", label/);
  assert.match(adapter, /applyStoreAppearance\(\)/);
  assert.match(adapter, /--eshop-accent-gradient/);
  assert.match(adapter, /dataset\.eshopCategoryBrowser/);
  assert.match(adapter, /data-eshop-catalog-fallback/);
  assert.match(adapter, /data-eshop-add-to-bag/);
  assert.match(adapter, /data-eshop-product-open/);
  assert.match(adapter, /fetch\("\/api\/orders"/);
  assert.match(adapter, /fetch\("\/api\/payments\/paystack\/initialize"/);
  assert.doesNotMatch(adapter, /href\s*=\s*`tel:/i);
  assert.doesNotMatch(storefront, /href="tel:/i);
  assert.match(storefront, /data-eshop-floating-contacts/);
  assert.match(storefront, /data-eshop-contact-icon/);
  assert.match(pageSource, /data-builder-publish-design/);
  assert.match(pageSource, /method: "PATCH", body: JSON\.stringify\(\{ store: appearance \}\)/);
  assert.equal(presets.WEBSITE_FONTS.length, 102);
  assert.equal(presets.WEBSITE_COLOR_THEMES.length, 102);
  assert.equal(presets.WEBSITE_COLOR_FILTERS.length, 102);
  assert.equal(presets.WEBSITE_DESIGN_THEMES.length, 4);
  assert.equal(presets.WEBSITE_DESIGN_PRESETS.length, 4);
  assert.deepEqual(presets.WEBSITE_DESIGN_THEMES.map(theme => theme.name), [
    "Quiet Lounge", "Tech Bento", "Street Energy", "Organic Editorial"
  ]);
  assert.equal(presets.WEBSITE_CARD_SHAPES.length, 13);
  assert.deepEqual(
    [presets.WEBSITE_COLOR_FILTERS[0].accent2, presets.WEBSITE_COLOR_FILTERS[0].accent3],
    ["#f06445", "#8fd14f"]
  );
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor, 'The website editor route should render.');
  assert.match(editor, /builder-theme-studio/);
  assert.doesNotMatch(editor, /builder-storefront-html|builder-tools-home|data-editor-tab/);
});

test('Theme Studio replaces the legacy website editor and keeps final setup', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor, 'The existing website editor should render.');
  assert.match(editor, /id="builder-theme-studio"/);
  assert.match(editor, /searchParams\.set\("loadUrl", studioTheme\.preview_url\)/);
  assert.match(editor, /new-website-form/);
  assert.match(editor, /Continue setup/);
  assert.doesNotMatch(editor, /builder-storefront-html|builder-preview-device|builder-tools-home|STEP 3 OF 3/);
  assert.doesNotMatch(pageSource, /\/theme-packages\/craft-main-storefront\/index\.html/);
});

test('Craft app branding uses the supplied shopping bag icon and launcher label', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const capacitorConfig = await readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
  const androidStrings = await readFile(new URL('../android/app/src/main/res/values/strings.xml', import.meta.url), 'utf8');
  const webManifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const logo = await readFile(new URL('../public/eshop-logo.png', import.meta.url));
  const launcher = await readFile(new URL('../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', import.meta.url));
  assert.match(pageSource, /<title>Craft<\/title>[\s\S]*?href="\/favicon\.svg"/);
  assert.match(capacitorConfig, /appName: 'Craft'/);
  assert.match(androidStrings, /<string name="app_name">Craft<\/string>/);
  assert.equal(webManifest.name, 'Craft');
  assert.equal(webManifest.short_name, 'Craft');
  assert.equal(logo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(launcher.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('app account includes email recovery and sends verified reset codes to the Worker', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const accountRenderer = pageSource.match(/renderAppAccount\(\) \{([\s\S]*?)\n  \},\n\n  render[^]*?\(/)?.[1];
  assert.ok(accountRenderer, 'The app-account screen should be rendered.');
  assert.match(accountRenderer, /id="app-account-email-field" hidden[\s\S]*?name="email" type="email"/);
  assert.match(accountRenderer, /id="app-account-forgot-password">Forgot password\?/);
  assert.match(accountRenderer, /id="app-account-recovery" hidden[\s\S]*?id="app-account-recovery-code"[\s\S]*?id="app-account-new-password"/);
  assert.match(pageSource, /fetchAuth\("\/api\/auth\/request-reset-code"[\s\S]*?fetchAuth\("\/api\/auth\/verify-reset-code"[\s\S]*?fetchAuth\("\/api\/auth\/reset-password"/);
  assert.match(pageSource, /Your recovery email is used only for password recovery, not marketing/);
});

test('theme editor storefront and Studio replace built-in demo catalogs with the selected website catalog', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const loader = pageSource.match(/const loadHostedThemePreview = async \(frame, theme, catalog, assetUrl = theme\.preview_url\) => \{[\s\S]*?\n    \};\n    const themePreviewFrames/)?.[0]
    .replace(/\n    const themePreviewFrames[\s\S]*$/, '');
  assert.ok(loader, 'The packaged theme loader should be available for the editor.');
  const theme = {
    id: 'maridadi-living',
    name: 'Maridadi Living',
    preview_url: '/theme-packages/maridadi-living/index.html',
    studio_url: '/theme-packages/maridadi-living/studio.html'
  };
  const output = await new Script(`${loader}; loadHostedThemePreview;`).runInNewContext({
    URL,
    window: { location: { origin: 'https://app.test' }, localStorage: { getItem: () => null } },
    fetch: async url => ({
      ok: true,
      text: () => readFile(new URL(`../public${new URL(url).pathname}`, import.meta.url), 'utf8')
    })
  });
  const readSiteData = html => {
    const match = html.match(/<script\b[^>]*\bid=["']ff-site-data["'][^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(match, 'Theme output should include site data.');
    return JSON.parse(match[1]);
  };
  for (const assetUrl of [theme.preview_url, theme.studio_url]) {
    const emptyCatalogHtml = await output(null, theme, { products: [], categories: [] }, assetUrl);
    const emptyCatalog = readSiteData(emptyCatalogHtml);
    assert.deepEqual(emptyCatalog.products, []);
    assert.deepEqual(emptyCatalog.categories, []);

    const storageShimTag = emptyCatalogHtml.match(/<script>\(\(\)=>\{const p=Storage\.prototype;[\s\S]*?<\/script>/);
    assert.ok(storageShimTag, 'Theme preview should isolate persisted native theme data.');
    class PreviewStorage {
      constructor() {
        this.values = new Map([
          ['maridadi_site_data', '{"products":[{"name":"Old demo product"}]}'],
          ['maridadi_applied_revision', '1'],
          ['maridadi_cart', '[]']
        ]);
      }
      getItem(key) { return this.values.get(String(key)) ?? null; }
      setItem(key, value) { this.values.set(String(key), String(value)); }
      removeItem(key) { this.values.delete(String(key)); }
      clear() { this.values.clear(); }
    }
    const storageListeners = [];
    const previewWindow = {
      addEventListener(type, listener, capture) {
        storageListeners.push({ type, listener, capture });
      }
    };
    new Script(storageShimTag[0].slice('<script>'.length, -'</script>'.length))
      .runInNewContext({ Storage: PreviewStorage, window: previewWindow });
    const storage = new PreviewStorage();
    assert.equal(storage.getItem('maridadi_site_data'), null);
    assert.equal(storage.getItem('maridadi_applied_revision'), '1');
    assert.equal(storage.getItem('maridadi_cart'), null);
    storage.setItem('maridadi_site_data', '{"products":[{"name":"Shop product"}]}');
    assert.match(storage.values.get('maridadi_site_data'), /Shop product/);
    let storefrontProducts = ['Shop Apple'];
    previewWindow.addEventListener('storage', event => {
      if (event.key === 'maridadi_site_data' && event.newValue) {
        storefrontProducts = JSON.parse(event.newValue).products.map(product => product.name);
      }
    });
    const siteDataStorageGuard = storageListeners.find(listener =>
      listener.type === 'storage' && listener.capture);
    assert.ok(siteDataStorageGuard, 'Theme preview should block saved theme data storage events.');
    let propagationStopped = false;
    const savedDemoCatalogEvent = {
      key: 'maridadi_site_data',
      newValue: '{"products":[{"name":"Old demo product"}]}',
      stopImmediatePropagation() { propagationStopped = true; }
    };
    siteDataStorageGuard.listener(savedDemoCatalogEvent);
    if (!propagationStopped) {
      storageListeners.filter(listener => listener.type === 'storage' && !listener.capture)
        .forEach(listener => listener.listener(savedDemoCatalogEvent));
    }
    assert.deepEqual(storefrontProducts, ['Shop Apple']);

    const shopCatalogHtml = await output(null, theme, {
      products: [{ id: 1, name: 'Shop Apple', category_name: 'Fresh Food', price: 5, stock: 4 }],
      categories: [{ id: 1, name: 'Fresh Food' }]
    }, assetUrl);
    const shopCatalog = readSiteData(shopCatalogHtml);
    assert.deepEqual(shopCatalog.products.map(product => product.name), ['Shop Apple']);
    assert.deepEqual(shopCatalog.categories.map(category => category.name), ['Fresh Food']);
    assert.equal(shopCatalog.products[0].category, 'fresh-food');
    assert.doesNotMatch(shopCatalog.products.map(product => product.name).join(' '), /sofa|table|bed/i);
  }
});

test('website editor back button returns to that website settings screen', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor, 'Website editor should be rendered by a dedicated method.');
  assert.match(editor, /const editorReturnRoute = draftEditor\s*\?\s*"\/account\/web\/themes\/select"\s*:\s*`\/account\/profile\/webs\/\$\{encodeURIComponent\(tenant\.id\)\}`/);
  assert.doesNotMatch(editor, /previousEditorRoute/);
  assert.match(editor, /href="\$\{AppUtils\.escapeHTML\(editorReturnRoute\)\}" data-route="\$\{AppUtils\.escapeHTML\(editorReturnRoute\)\}" aria-label="Back to previous screen"/);
});

test('existing website editor routes stay pinned to the selected tenant', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const routeTenantSelection = pageSource.match(/if \(path === "\/account\/web\/site" && params\.get\("new"\) !== "1" && params\.has\("tenant"\)\) \{([\s\S]*?)\n    \}\n    if \(path === "\/account\/web\/site" && params\.get\("new"\) === "1"\)/)?.[1];
  const editHandler = pageSource.match(/const editWebsite = e\.target\.closest\("\[data-edit-website\]"\);([\s\S]*?)\n      }\n\n      const editStore/)?.[1];
  assert.ok(routeTenantSelection, 'Opening an editor URL should resolve its explicit website tenant.');
  assert.match(routeTenantSelection, /tenantCatalogs\(\)\.find\(item => item\.tenant_id === tenantId\)/);
  assert.match(routeTenantSelection, /this\.setActiveTenantCatalog\(\{[\s\S]*?\}, catalog\)/);
  assert.ok(editHandler, 'Website design editing should have a dedicated handler.');
  assert.match(editHandler, /this\.navigate\(`\/account\/web\/site\?tenant=\$\{encodeURIComponent\(website\.tenant_id\)\}`\)/);
});

test('uploaded catalog photos are compressed before saving and uploaded before deployment', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const compression = pageSource.match(/async compressImageFile\(file, \{([\s\S]*?)\n  \},\n\n  formatMoney/)?.[0];
  const imageUpload = pageSource.match(/async uploadCatalogImage\(image, apiUrl, tenant, token\) \{([\s\S]*?)\n  \},\n\n  openCloudflarePublishModal/)?.[1];
  const publishModal = pageSource.match(/openCloudflarePublishModal\(\) \{([\s\S]*?)\n  \},\n\n  initStudioModals/)?.[1];
  assert.ok(compression, 'Image uploads should use the shared on-device compressor.');
  assert.ok(imageUpload, 'Publishing should upload compressed images to the Worker.');
  assert.ok(publishModal, 'Catalog publishing should include the uploaded image URLs.');
  assert.match(compression, /new Image\(\)[\s\S]*?URL\.createObjectURL\(file\)[\s\S]*?toBlob[\s\S]*?image\/webp[\s\S]*?maxBytes/);
  assert.match(imageUpload, /new URL\(image\)[\s\S]*?isRrobinDomain[\s\S]*?mode: "cors"[\s\S]*?maxDimension: 800, maxBytes: 2_800_000/);
  assert.match(imageUpload, /crypto\.subtle\.digest\("SHA-256"[\s\S]*?ESHOP_CATALOG_MEDIA_UPLOADS_V1:\$\{tenant\.id\}[\s\S]*?cachedPublicUrl\.pathname\.startsWith\(`\/media\/\$\{tenant\.id\}\/`\)[\s\S]*?return cachedPublicUrl\.href/);
  assert.match(imageUpload, /compressImageFile[\s\S]*?\/api\/media[\s\S]*?method: "POST"[\s\S]*?publicUrl\.pathname\.startsWith\(`\/media\/\$\{tenant\.id\}\/`\)[\s\S]*?localStorage\.setItem\(cacheKey, JSON\.stringify\(uploadedMedia\)\)/);
  assert.match(publishModal, /async image => \{[\s\S]*?fallbackProductImageCount \+= 1[\s\S]*?keeping its original URL[\s\S]*?return image/);
  assert.match(publishModal, /await Promise\.all\(\(Array\.isArray\(product\.images\)[\s\S]*?publishProductImage\)[\s\S]*?products: publishProducts/);
  assert.doesNotMatch(publishModal, /will not be published until R2|uploaded photos await R2/);
  assert.match(posSource, /window\.AppUtils\.compressImageFile\(file, \{ maxDimension: 1800, maxBytes: 900_000 \}\)/);

  const image = 'data:image/png;base64,unchanged-image';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(image));
  const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const cachedUrl = 'https://shop.example/media/main/11111111-1111-4111-8111-111111111111.webp';
  let uploadRequests = 0;
  const uploadMethod = new Script(`({ async uploadCatalogImage(image, apiUrl, tenant, token) { ${imageUpload} } })`)
    .runInNewContext({
      crypto: globalThis.crypto,
      TextEncoder,
      URL,
      fetch: async () => { uploadRequests += 1; throw new Error('Unchanged images must not trigger a network request.'); },
      window: { localStorage: { getItem: () => JSON.stringify({ [fingerprint]: cachedUrl }) } }
    });
  assert.equal(await uploadMethod.uploadCatalogImage(image, new URL('https://shop.example/api/catalog'), { id: 'main' }, 'token'), cachedUrl);
  assert.equal(uploadRequests, 0, 'A previously uploaded unchanged image should not be uploaded again.');

  const remoteImage = 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=1000&q=80';
  const remoteFingerprint = [...new Uint8Array(await globalThis.crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(remoteImage)
  ))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const uploadedUrl = 'https://rayoo.rrobin.co.ke/media/rayoo/11111111-1111-4111-8111-111111111111.webp';
  const requests = [];
  let compressionOptions;
  const externalUpload = new Script(`({ async uploadCatalogImage(image, apiUrl, tenant, token) { ${imageUpload} } })`)
    .runInNewContext({
      crypto: globalThis.crypto,
      TextEncoder,
      URL,
      File,
      Blob,
      Response,
      console,
      fetch: async (input, options) => {
        const url = String(input);
        requests.push({ url, options });
        if (url === remoteImage) return new Response(new Blob(['source'], { type: 'image/jpeg' }), { status: 200 });
        if (url.startsWith('data:image/webp')) return new Response(new Blob(['compressed'], { type: 'image/webp' }), { status: 200 });
        return new Response(JSON.stringify({ ok: true, url: uploadedUrl }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      },
      AppUtils: {
        async compressImageFile(file, options) {
          assert.equal(file.type, 'image/jpeg');
          compressionOptions = options;
          return 'data:image/webp;base64,compressed';
        }
      },
      window: { localStorage: {
        getItem: () => JSON.stringify({ [fingerprint]: cachedUrl }),
        setItem: () => {}
      } }
    });
  assert.equal(
    await externalUpload.uploadCatalogImage(remoteImage, new URL('https://worker.example/api/catalog'), {
      id: 'rayoo', hostname: 'rayoo.rrobin.co.ke'
    }, 'token'),
    uploadedUrl
  );
  assert.equal(compressionOptions.maxDimension, 800);
  assert.equal(compressionOptions.maxBytes, 2_800_000);
  assert.equal(requests[0].options.mode, 'cors');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(requests.at(-1).options.method, 'POST');
  assert.equal(requests.at(-1).options.headers['Content-Type'], 'image/webp');
  assert.equal(
    await externalUpload.uploadCatalogImage(uploadedUrl, new URL('https://worker.example/api/catalog'), {
      id: 'rayoo', hostname: 'rayoo.rrobin.co.ke'
    }, 'token'),
    uploadedUrl,
    'Images already hosted on the shop domain should not be uploaded again.'
  );
});

test('Web Studio website products and categories can be removed without deleting Store/POS records', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const websiteWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\r?\n    \}\r?\n    if \(path === "\/store\/categories"\)/)?.[1];
  const categoryWorkspace = pageSource.match(/if \(path === "\/store\/categories"\) \{([\s\S]*?)\r?\n    \}\r?\n    if \(path === "\/store\/inventory"\)/)?.[1];
  const productRemoval = pageSource.match(/document\.querySelectorAll\("\[data-remove-website-product\]"\)([\s\S]*?)document\.querySelectorAll\("\[data-remove-website-category\]"\)/)?.[1];
  const categoryRemoval = pageSource.match(/document\.querySelectorAll\("\[data-remove-website-category\]"\)([\s\S]*?)document\.querySelectorAll\("\[data-store-pos-category\]"\)/)?.[1];
  const bulkRemovalBinding = pageSource.match(/currentContent\.querySelectorAll\("\[data-bulk-removal\]"\)([\s\S]*?)document\.querySelectorAll\("\.business-filter"\)/)?.[1];
  assert.ok(websiteWorkspace, 'Website product workspace should render removal controls.');
  assert.ok(categoryWorkspace, 'Website category workspace should render removal controls.');
  assert.ok(productRemoval, 'Website product removal should be bound.');
  assert.ok(categoryRemoval, 'Website category removal should be bound.');
  assert.ok(bulkRemovalBinding, 'Website bulk removal should be bound after workspace rendering.');
  assert.match(websiteWorkspace, /Website products are saved in app SQLite, separately from Store\/POS inventory/);
  assert.match(websiteWorkspace, /existsInPos = snapshot\.posProducts\.some[\s\S]*?data-store-pos-product="\$\{product\.id\}"[\s\S]*?Add to Store\/POS/);
  assert.match(pageSource, /document\.querySelectorAll\("\[data-store-pos-product\]"\)[\s\S]*?addWebsiteProductToPos\(Number\(button\.dataset\.storePosProduct\)\)[\s\S]*?Product added to POS/);
  assert.match(websiteWorkspace, /data-remove-website-product="\$\{product\.id\}"[\s\S]*?Remove from this website/);
  assert.match(categoryWorkspace, /data-remove-website-category="\$\{category\.id\}"[\s\S]*?Remove category from this website/);
  assert.match(productRemoval, /SQLiteEngine\.deleteProduct\(productId\)[\s\S]*?await window\.ShopSQLite\.flush\(\)[\s\S]*?cacheActiveTenantCatalog/);
  assert.match(productRemoval, /Store\/POS inventory will not be deleted/);
  assert.match(categoryRemoval, /SQLiteEngine\.deleteCategory\(categoryId\)[\s\S]*?await window\.ShopSQLite\.flush\(\)[\s\S]*?cacheActiveTenantCatalog/);
  assert.match(categoryRemoval, /remain on this website as uncategorized/);
  assert.match(websiteWorkspace, /Select all products[\s\S]*?Remove selected products[\s\S]*?data-bulk-item="\$\{product\.id\}"/);
  assert.match(categoryWorkspace, /Select all categories[\s\S]*?Remove selected categories[\s\S]*?data-bulk-item="\$\{category\.id\}"/);
  assert.match(websiteWorkspace, /class="studio-inline-actions web-product-actions"[\s\S]*?class="btn-secondary web-product-action-card"[\s\S]*?class="btn-primary web-product-action-card"[\s\S]*?class="btn-secondary web-product-action-card"[\s\S]*?class="btn-secondary web-product-action-card"/);
  assert.match(pageSource, /\.studio-inline-actions\.web-product-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*grid-auto-rows:\s*72px/);
  assert.match(pageSource, /\.store-bulk-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(pageSource, /\.store-bulk-actions \[data-bulk-remove\]\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/);
  assert.match(websiteWorkspace, /class="store-product-detail-wrap"[\s\S]*?store-product-name[\s\S]*?formatMainShopMoney\(product\.price,\s*currency\)/);
  assert.match(categoryWorkspace, /class="store-category-import-row"[\s\S]*?class="store-category-wrap"/);
  assert.match(pageSource, /\.store-product-detail-wrap,\s*\.store-category-wrap\s*\{[^}]*border-radius:\s*12px/);
  assert.match(bulkRemovalBinding, /selectAll\.onchange[\s\S]*?items\.forEach\(item => \{ item\.onchange = updateSelection; \}\)[\s\S]*?SQLiteEngine\.deleteProduct\(id\)[\s\S]*?SQLiteEngine\.deleteCategory\(id\)[\s\S]*?await window\.ShopSQLite\.flush\(\)/);
});

test('Web Studio can add multiple Store products at once and carries their images into the website catalog', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const productsWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\n    \}\n    if \(path === "\/store\/categories"\)/)?.[1];
  const importHandler = pageSource.match(/document\.querySelectorAll\("\.store-existing-product-form"\)\.forEach\(form => \{([\s\S]*?)\n      const addProductTrigger/)?.[1];
  assert.ok(productsWorkspace, 'Web Studio should render the website product workspace.');
  assert.ok(importHandler, 'Existing-website Store imports should have a submit handler.');
  assert.match(productsWorkspace, /data-store-import-select-all> Select all available products/);
  assert.match(productsWorkspace, /data-store-import-product="\$\{index\}"/);
  assert.match(productsWorkspace, /const image = pos\.imageUri \|\| pos\.images\?\.\[0\]/);
  assert.match(importHandler, /selectAll\?\.addEventListener\("change"[\s\S]*?products\.forEach\(input => \{ input\.checked = selectAll\.checked; \}\)/);
  assert.match(importHandler, /selectedProducts[\s\S]*?await syncExistingProduct\(product\)[\s\S]*?added to this website/);
  assert.match(pageSource, /images: product\.imageUri \? \[product\.imageUri\] : webProduct\?\.images \|\| \[\]/);
});

test('managing a website opens its Web Studio products and exposes publishing', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const manageHandler = pageSource.match(/const manageWebsite = e\.target\.closest\("\[data-manage-website\]"\);([\s\S]*?)\r?\n      }\r?\n\r?\n      const editWebsite/)?.[1];
  assert.ok(manageHandler, 'Website management should have a dedicated click handler.');
  assert.match(manageHandler, /this\.setActiveTenantCatalog\([\s\S]*?this\.navigate\("\/account\/web\/studio\/store\/products"\)/);
  const productsWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\r?\n    \}\r?\n    if \(path === "\/store\/categories"\)/)?.[1];
  assert.ok(productsWorkspace, 'Web Studio should render the website product workspace.');
  assert.match(productsWorkspace, /id="btn-publish-cloudflare">Publish to \$\{AppUtils\.escapeHTML\(activeTenant\.hostname\)\}/);
  assert.match(productsWorkspace, /Publish to make your updates visible at/);
  assert.match(productsWorkspace, /id="product-modal-container"/);
});

test('all hosted themes load the shared mobile stylesheet without forcing navigation into blocks', async () => {
  const mobileCss = await readFile(new URL('../src/theme-mobile.css', import.meta.url), 'utf8');
  assert.doesNotMatch(mobileCss, /nav\s*,\s*\[role="navigation"\]\s*\{\s*display:\s*block/i);
  const themeEntries = await readdir(new URL('../live-websites/', import.meta.url), { withFileTypes: true });
  const themeDirectories = themeEntries.filter(entry => entry.isDirectory());
  let checkedThemes = 0;
  for (const entry of themeDirectories) {
    const folder = new URL(`../live-websites/${encodeURIComponent(entry.name)}/`, import.meta.url);
    let html;
    let stylesheet;
    try {
      [html, stylesheet] = await Promise.all([
        readFile(new URL('index.html', folder), 'utf8'),
        readFile(new URL('eshop-mobile.css', folder), 'utf8')
      ]);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    assert.match(html, /eshop-mobile\.css\?v=3/, `${entry.name} should use the refreshed mobile stylesheet`);
    assert.doesNotMatch(html, /\.{3,}\/src\/assets\/images\//, `${entry.name} should use valid local image paths`);
    assert.doesNotMatch(html, /["']\.{3,}\/images\//, `${entry.name} should not contain malformed image paths`);
    assert.equal(stylesheet, mobileCss, `${entry.name} should use the shared mobile stylesheet`);
    checkedThemes++;
  }
  assert.equal(checkedThemes, 28);
});

test('new-website Webmaker stages catalog before themes and keeps existing website management separate', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
  const websitesNavigation = pageSource.match(/title: "Websites",([\s\S]*?)\n      \},\n      \{\n        title: "Payments"/)?.[1];
  const webmaker = pageSource.match(/renderWebsiteBuilderCatalog\(embedded = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteThemes/)?.[1];
  const themeChoices = pageSource.match(/renderWebsiteThemeChoices\(\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteTheme\(/)?.[1];
  const workspaceLoader = pageSource.match(/async loadMainShopWorkspace\(path\) \{([\s\S]*?)\n  \},\n\n  [a-zA-Z]/)?.[1];
  const websiteBuilderBinder = pageSource.match(/bindWebsiteBuilderEvents\(\) \{([\s\S]*?)\n  \},\n\n  postRenderSetup/)?.[1];
  assert.ok(websitesNavigation, 'Websites tabs should have a bounded navigation entry.');
  assert.ok(webmaker, 'New website Webmaker should stage catalog data.');
  assert.ok(themeChoices, 'New website theme selection should be a separate step.');
  assert.ok(workspaceLoader, 'Studio workspace loader should be available.');
  assert.ok(websiteBuilderBinder, 'Webmaker events should have a dedicated binder.');
  assert.match(websitesNavigation, /route: "\/account\/web\/studio\/websites\/webmaker"[\s\S]*?title: "Webmaker"[\s\S]*?title: "Add"[\s\S]*?title: "Theme Studio"/);
  assert.match(pageSource, /page\.route === "\/account\/web\/studio\/websites\/webmaker"[\s\S]*?renderWebsiteBuilderCatalog\(true\)/);
  assert.match(pageSource, /path === "\/account\/web\/themes" \|\| path === "\/account\/web\/themes\/select"[\s\S]*?path === "\/account\/web\/studio\/websites\/webmaker"/);
  assert.doesNotMatch(pageSource.match(/if \(manageWebsite\) \{([\s\S]*?)\n      \}\n\n      const editWebsite/)?.[1] || "", /websites\/webmaker/);
  assert.match(pageSource, /const initialPath = path === "\/account\/web"\s*\? "\/account\/web\/studio\/dashboard\/overview"/);
  assert.match(webmaker, /NEW WEBSITE · STEP 1 OF 3[\s\S]*?Add products and categories[\s\S]*?Choose products from Store[\s\S]*?website-wizard-category-form[\s\S]*?website-wizard-product-form[\s\S]*?Continue to choose a theme/);
  assert.match(pageSource, /ESHOP_WEBSITE_DRAFT_LEGACY_CATALOG_CLEANUP_V2[\s\S]*?saved\.products = \[\];[\s\S]*?saved\.categories = \[\]/);
  assert.match(webmaker, /<a class="btn-primary" href="\/account\/web\/themes\/select" data-route="\/account\/web\/themes\/select">Continue to choose a theme/);
  assert.doesNotMatch(pageSource, /if \(!draft\.categories\.length\) return null;/);
  assert.match(webmaker, /data-remove-wizard-product/);
  assert.match(webmaker, /website-wizard-clear-products/);
  assert.match(webmaker, /website-wizard-store-picker" hidden role="dialog" aria-modal="true"[\s\S]*?website-wizard-store-search[\s\S]*?value="all">All categories[\s\S]*?value="general">General \(uncategorized\)/);
  assert.match(posSource, /FROM pos_products p LEFT JOIN pos_categories c ON c\.id = p\.category_id/);
  assert.match(pageSource, /const categoryMatches = selectedCategory === "all" \|\|\s*\(selectedCategory === "general" \? !category/);
  assert.match(pageSource, /const name = categoryName\(product\) \|\| "General"/);
  assert.match(pageSource, /id="website-wizard-store-import"|id="website-wizard-import-store"/);
  assert.match(workspaceLoader, /currentContent\.innerHTML = this\.renderMainShopContent\(path, renderSnapshot\);[\s\S]*?AppController\.bindWebsiteBuilderEvents\(\)/);
  assert.match(websiteBuilderBinder, /picker\.hidden = false;[\s\S]*?const products = await window\.ShopPOS\.listProducts\(\)/);
  assert.doesNotMatch(webmaker, /name="sku"|product\.sku/);
  assert.match(pageSource, /SQLiteEngine\.saveProduct\(\{\s*name: product\.name,\s*sku: ""/);
  assert.match(pageSource, /generateProductSku\(\)[\s\S]*?crypto\.getRandomValues\(bytes\)/);
  assert.match(themeChoices, /NEW WEBSITE · STEP 2 OF 3[\s\S]*?Choose a storefront theme/);
  assert.doesNotMatch(themeChoices, /business type|website-wizard-business-type/i);
  assert.doesNotMatch(webmaker, /website-wizard-business-type/);
  assert.match(websiteBuilderBinder, /data-remove-wizard-product[\s\S]*?draft\.products = draft\.products\.filter/);
  assert.match(websiteBuilderBinder, /website-wizard-clear-products[\s\S]*?draft\.products = \[\]/);
  assert.doesNotMatch(pageSource, /websiteBusinessType\(draft\.business_type\)|Choose a business type before/);
  const mainThemes = WEBSITE_THEME_CATALOG.filter(theme => theme.is_main === true);
  assert.deepEqual(mainThemes.map(theme => theme.id), [
    'elora-linen'
  ], 'Only the current storefront themes are registered.');
  assert.deepEqual(WEBSITE_THEME_CATALOG.filter(theme => theme.validation_status === 'passed').map(theme => theme.id), [
    'elora-linen'
  ], 'Only standalone themes that pass validation are selectable.');
  assert.match(pageSource, /websiteThemesForPicker\(\) \{\s*return this\.websiteThemes\(\)\.filter\(theme =>\s*theme\.validation_status === "passed" && theme\.editor_mode === "liquid-html"\)/);
  assert.match(pageSource, /NEW WEBSITE · FINAL SETUP[\s\S]*?Shop \/ website name[\s\S]*?Website address[\s\S]*?>Set up</);
  assert.match(pageSource, /const editorReturnRoute = draftEditor\s*\?\s*"\/account\/web\/themes\/select"/);
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor, "The selected theme should open the Theme Studio.");
  assert.match(editor, /id="builder-theme-studio"/);
  assert.match(editor, /Continue setup/);
  assert.match(editor, /new=1&finish=1&theme=/);
  assert.doesNotMatch(pageSource, /NEW WEBSITE · STEP 3 OF 3|btn-builder-finish-website|saveEditorDesign/);
  assert.match(pageSource, /prepareWebsiteBuilderDraftTenant\(draft, themeId\)[\s\S]*?WEBSITE_BUILDER_DRAFT_TENANT_ID/);
  assert.match(pageSource, /ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1/);
  assert.match(pageSource, /SQLiteEngine\.db\.tables\.products = \[\];\s*SQLiteEngine\.db\.tables\.categories = \[\];\s*SQLiteEngine\.db\.tables\.inventory = \[\]/);
  assert.match(pageSource, /const hasSavedDraftCatalog = Boolean\(savedCatalog\?\.draft_signature\)/);
  assert.match(pageSource, /savedSignature === signature && savedCatalog\?\.draft_signature === signature/);
  assert.match(pageSource, /availableThemes\.find\(theme =>\s*theme\.id === themeId\) \|\| availableThemes\.find\(theme =>\s*theme\.id === draft\.selected_theme\)/);
  assert.match(pageSource, /if \(catalogIsCurrent\) \{[\s\S]*?website_theme_id: selectedTheme\.id[\s\S]*?this\.cacheActiveTenantCatalog\(\)[\s\S]*?return;/);
  assert.match(pageSource, /const useThemeRoute = `\/account\/web\/site\?new=1&edit=1&theme=/);
  assert.match(pageSource, /websiteThemesForPicker\(\)\s*\{\s*return this\.websiteThemes\(\)\.filter\(theme =>\s*theme\.validation_status === "passed" && theme\.editor_mode === "liquid-html"\)/);
  assert.match(pageSource, /applyWebsiteBuilderDraft\(draft, themeId\)[\s\S]*?theme\.id === \(themeId \|\| draft\.selected_theme\)[\s\S]*?website_theme_id: selectedTheme\.id[\s\S]*?this\.cacheActiveTenantCatalog\(\)/);
  assert.doesNotMatch(pageSource, /previewWindow\.setBuilderCatalog\(\{\s*products: JSON\.parse\(JSON\.stringify\(websiteDraft\.products\)\),\s*categories: JSON\.parse\(JSON\.stringify\(websiteDraft\.categories\)\)/);
  assert.match(pageSource, /fillThemeForShop\(theme\.id, catalog/);
  assert.match(pageSource, /async prepareWebsiteBuilderDraftTenant\(draft, themeId\)[\s\S]*?await this\.applyWebsiteBuilderDraft\(draft, selectedTheme\.id\);[\s\S]*?window\.localStorage\.setItem\(WEBSITE_BUILDER_DRAFT_SYNC_KEY, signature\);/);
  assert.match(pageSource, /handleRoute\(fullPath, shouldScroll = true, draftPrepared = false\)[\s\S]*?if \(!draftPrepared\) \{[\s\S]*?Preparing your new website preview[\s\S]*?this\.prepareWebsiteBuilderDraftTenant\([\s\S]*?\.then\(\(\) => \{[\s\S]*?this\.currentRoute\(\) === fullPath[\s\S]*?this\.handleRoute\(fullPath, shouldScroll, true\);/);
  assert.match(pageSource, /removeItem\("ESHOP_NEW_WEBSITE_DRAFT_V1"\)[\s\S]*?Website created at/);
  assert.equal((pageSource.match(/cloudflareRequest\("\/api\/tenants"/g) || []).length, 1,
    'Only the final name-and-domain form can create a website.');
  const createRequestGuard = pageSource.match(/async cloudflareRequest\(path,[\s\S]*?\n  \},\n\n  async loadTenantCatalog/)?.[0];
  assert.match(createRequestGuard || "", /this\.isWebsiteBuilderDraftTenant\(this\.getActiveTenant\(\)\.id\)[\s\S]*?finalTenantSetup[\s\S]*?throw new Error\("Cloudflare requests are disabled for the local website draft/);
  assert.match(pageSource, /openCloudflarePublishModal\(\) \{\s*if \(this\.isWebsiteBuilderDraftTenant\(this\.getActiveTenant\(\)\.id\)\)/);
  assert.match(themeChoices, /const themeEditorRoute = theme => `\/account\/web\/site\?new=1&edit=1&theme=\$\{encodeURIComponent\(theme\.id\)\}`/);
  assert.doesNotMatch(themeChoices, /data-theme-preview-remote|<iframe/);
});

test('empty non-main shop previews never import the shared seed catalog', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const method = pageSource.match(/async importBuilderCatalogIfEmpty\(previewWindow\) \{[\s\S]*?\n  \},\n\n  async ensureBuilderCatalogImported/)?.[0]
    .replace(/\n\n  async ensureBuilderCatalogImported[\s\S]*$/, '');
  assert.ok(method, 'The storefront seed importer should be available.');
  const products = [];
  const categories = [];
  const importer = new Function(
    'AppController',
    'SQLiteEngine',
    'window',
    `return ({${method}}).importBuilderCatalogIfEmpty;`
  )(
    { getActiveTenant: () => ({ id: 'fogo' }) },
    {
      select: () => products,
      getCategories: () => categories
    },
    { localStorage: { getItem: () => null } }
  );

  const imported = await importer({ getBuilderSeedCatalog: () => {
    assert.fail('A tenant preview must not read the shared seed catalog.');
  } });
  assert.equal(imported, false);
  assert.deepEqual(products, []);
  assert.deepEqual(categories, []);
});

test('new website draft discards a stale Chapa catalog and rejects non-main theme routes', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const prepareDraft = pageSource.match(/async prepareWebsiteBuilderDraftTenant\(draft, themeId\) \{([\s\S]*?)\n  \},\n\n  restoreWebsiteBuilderPreviousTenant/)?.[1];
  assert.ok(prepareDraft, 'The draft preparation method should be available.');

  const draft = {
    categories: [{ id: 'draft-category', name: 'Draft category' }],
    products: [{ id: 'draft-product', name: 'Draft product', category_id: 'draft-category', price: 5, stock: 2 }],
    section_layout: { order: [], hidden: [], removed: [], added: [] },
    selected_theme: 'elora-linen'
  };
  const signature = JSON.stringify({
    categories: draft.categories.map(category => [String(category.id), category.name]),
    products: draft.products.map(product => [
      String(product.id), String(product.source_product_id || ''), product.name,
      Number(product.price) || 0, Number(product.stock) || 0, String(product.category_id)
    ])
  });
  const tables = {
    tenant_catalogs: [
      { tenant_id: 'main', products: [], categories: [], inventory: [], pages: [], store: {} },
      {
        tenant_id: '__new_website_draft__',
        products: [{ id: 1, name: 'Chapa product' }],
        categories: [{ id: 1, name: 'Chapa category' }],
        inventory: [{ product_id: 1 }],
        pages: [{ title: 'Chapa page' }],
        store: { name: 'Chapa', title: 'Chapa Store', primary_color: '#FF0000' }
      }
    ],
    products: [],
    categories: [],
    inventory: [],
    pages: [],
    store: [{}]
  };
  const storage = new Map([
    ['ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1', signature]
  ]);
  const window = {
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    ShopSQLite: { flush: async () => {} }
  };
  const SQLiteEngine = {
    db: { tables },
    save: () => {},
    select: table => tables[table],
    getCategories: () => tables.categories,
    getPages: () => tables.pages,
    getStore: () => tables.store[0] || {},
    updateStore: values => { tables.store[0] = { ...tables.store[0], ...values }; }
  };
  let activeTenant = { id: 'main', name: 'Main shop', hostname: 'main.test' };
  const controller = {
    getActiveTenant: () => activeTenant,
    tenantCatalogs: () => tables.tenant_catalogs,
    cacheActiveTenantCatalog: () => {},
    setActiveTenantCatalog(tenant, catalog) {
      activeTenant = tenant;
      for (const table of ['products', 'categories', 'inventory', 'pages']) {
        tables[table] = structuredClone(catalog[table] || []);
      }
      tables.store = [structuredClone(catalog.store || {})];
      const index = tables.tenant_catalogs.findIndex(item => item.tenant_id === tenant.id);
      const cached = { tenant_id: tenant.id, ...structuredClone(catalog) };
      if (index < 0) tables.tenant_catalogs.push(cached);
      else tables.tenant_catalogs[index] = cached;
    },
    async applyWebsiteBuilderDraft(websiteDraft, themeId) {
      tables.categories = structuredClone(websiteDraft.categories);
      tables.products = structuredClone(websiteDraft.products);
      SQLiteEngine.updateStore({ website_theme_id: themeId });
    }
  };
  const runPreparation = new Function(
    'SQLiteEngine', 'StudioRenderers', 'window',
    'WEBSITE_BUILDER_DRAFT_TENANT_ID', 'WEBSITE_BUILDER_DRAFT_PREVIOUS_TENANT_KEY',
    'WEBSITE_BUILDER_DRAFT_SYNC_KEY',
    `return async function(draft, themeId) { ${prepareDraft} };`
  )(
    SQLiteEngine,
    { websiteThemesForPicker: () => [
      { id: 'elora-linen', is_main: true, editor_mode: 'liquid-html', validation_status: 'passed' }
    ], saveWebsiteBuilderDraft: () => {} },
    window,
    '__new_website_draft__',
    'ESHOP_NEW_WEBSITE_PREVIOUS_TENANT_V1',
    'ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1'
  );

  await runPreparation.call(controller, draft, 'chapa-theme');

  assert.deepEqual(tables.categories.map(category => category.name), ['Draft category']);
  assert.deepEqual(tables.products.map(product => product.name), ['Draft product']);
  assert.deepEqual(tables.inventory, []);
  assert.deepEqual(tables.pages, []);
  assert.equal(SQLiteEngine.getStore().name, 'New website draft');
  assert.equal(SQLiteEngine.getStore().website_theme_id, 'elora-linen');
  assert.equal(tables.tenant_catalogs.find(item => item.tenant_id === '__new_website_draft__').draft_signature, signature);
});

test('new websites start with a clean draft and each shop has a dedicated domains screen', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /resetWebsiteBuilderDraft\(\) \{[\s\S]*?removeItem\("ESHOP_NEW_WEBSITE_DRAFT_V1"\)[\s\S]*?removeItem\(WEBSITE_BUILDER_DRAFT_SYNC_KEY\)[\s\S]*?tenant_catalogs = AppController\.tenantCatalogs\(\)\.filter/);
  assert.match(pageSource, /data-start-new-website[\s\S]*?await StudioRenderers\.resetWebsiteBuilderDraft\(\)[\s\S]*?navigate\("\/account\/web\/themes"\)/);
  assert.match(pageSource, /href="\/account\/profile\/webs\/\$\{encodeURIComponent\(website\.id\)\}\/domains"[^>]*>Domains/);
  assert.match(pageSource, /const websiteDomainScreen = selectedWebsite \?[\s\S]*?Your Craft address[\s\S]*?Connect a custom subdomain[\s\S]*?To change an existing custom domain, remove it here first/);
  assert.match(pageSource, /websiteDetailSection === "domains" \? websiteDomainScreen/);
  assert.match(pageSource, /const websiteDomainSettingsMatch = path\.match/);
  assert.match(pageSource, /loadCustomHostnameStatus\(domainTenantId\)/);
  assert.match(pageSource, /const theme = this\.websiteThemesForPicker\(\)\.find\(item => item\.id === themeId\)/);
  assert.match(pageSource, /const availableThemes = StudioRenderers\.websiteThemesForPicker\(\);[\s\S]*?availableThemes\.find\(theme => theme\.id === params\.get\("theme"\)\)/);
});

test('main app inline script parses before packaging', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const inlineScripts = [...pageSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(script => !/\bsrc\s*=/.test(script[1]));
  const appScript = inlineScripts.find(script => !/\btype\s*=\s*["']module["']/i.test(script[1]));
  assert.ok(appScript, 'The app should have an inline application script.');
  assert.doesNotThrow(() => new Script(appScript[2], { filename: 'index.html:inline-app-script' }));
  for (const script of inlineScripts.filter(item => /\btype\s*=\s*["']module["']/i.test(item[1]))) {
    assert.doesNotThrow(() => new Script(script[2], { filename: 'index.html:inline-module-script' }));
  }
});

test('home fade moves from light surroundings to dark dashboard surfaces', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const homeStyle = pageSource.match(/\.home-screen\s*\{([^}]*)\}/)?.[1];
  const tintStyle = pageSource.match(/\.home-background-tint\s*\{([^}]*)\}/)?.[1];
  assert.ok(homeStyle, 'The home screen should define its own color treatment.');
  assert.ok(tintStyle, 'The background images should be covered by the home fade.');
  assert.match(homeStyle, /--home-light-foreground:\s*#111/);
  assert.match(homeStyle, /--home-dark-foreground:\s*#fff/);
  assert.match(tintStyle, /linear-gradient\(\s*180deg,[\s\S]*?rgb\(245 245 245 \/ 25%\)[\s\S]*?rgb\(245 245 245 \/ 34%\)[\s\S]*?rgb\(245 245 245 \/ 45%\)[\s\S]*?rgb\(5 5 5 \/ 97%\)/);
  assert.match(pageSource, /\.home-screen-greeting\s*\{[^}]*color:\s*var\(--home-light-foreground\)/);
  assert.match(pageSource, /\.home-data-card,\s*\.home-panel\s*\{[^}]*background:\s*var\(--home-dark-card\)[^}]*color:\s*var\(--home-dark-foreground\)/);
});

test('home backdrop cycles through cropped reference images', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /class="home-background" aria-hidden="true"[\s\S]*?data-home-background-current[\s\S]*?data-home-background-next[\s\S]*?home-background-tint/);
  assert.match(pageSource, /desktop: `\/home-backgrounds\/home-\$\{number\}\.jpg`/);
  assert.match(pageSource, /mobile: `\/home-backgrounds\/mobile-\$\{number\}\.jpg`/);
  assert.match(pageSource, /window\.matchMedia\("\(max-width: 600px\)"\)/);
  assert.match(pageSource, /window\.setInterval\(rotateBackground,\s*8500\)/);
  assert.match(pageSource, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(pageSource, /window\.clearInterval\(this\.homeBackgroundTimer\)/);
  assert.match(pageSource, /window\.removeEventListener\("resize", this\.homeBackgroundResizeHandler\)/);
  const images = await Promise.all(Array.from({ length: 18 }, (_, index) => {
    const variant = index < 9 ? 'home' : 'mobile';
    const number = String(index % 9 + 1).padStart(2, '0');
    return readFile(new URL(`../public/home-backgrounds/${variant}-${number}.jpg`, import.meta.url));
  }));
  for (const image of images) assert.deepEqual([...image.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test('PesaFlow-style background emblem rotates outside Home and Theme Studio', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const emblem = pageSource.match(/<div class="app-background-emblem" aria-hidden="true">([\s\S]*?)<\/div>\s*<div id="app">/)?.[1];
  assert.ok(emblem, 'The decorative emblem should be a static, hidden-from-accessibility layer.');
  assert.equal((emblem.match(/class="app-background-emblem-ring"/g) || []).length, 9);
  assert.match(pageSource, /\.app-background-emblem-mark\s*\{[^}]*animation:\s*app-background-emblem-spin 34s linear infinite/);
  assert.match(pageSource, /@keyframes app-background-emblem-spin\s*\{\s*to\s*\{\s*transform:\s*rotate\(360deg\)/);
  assert.match(pageSource, /const showBackgroundEmblem = \(isAppShell \|\| path\.startsWith\("\/store\/"\)\)\s*&&\s*path !== "\/"\s*&&\s*path !== "\/account\/web\/site"/);
  assert.match(pageSource, /classList\.toggle\("app-background-emblem-active", showBackgroundEmblem\)/);
  assert.match(pageSource, /body\.app-background-emblem-active #app\s*\{[^}]*background:\s*transparent/);
  assert.match(pageSource, /body\.craft-app-ui\.app-background-emblem-active #app\s*\{[^}]*background:\s*transparent/);
});

test('home summary metrics are compact full-width cards', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const metricGrid = pageSource.match(/\.home-metric-grid\s*\{([^}]*)\}/)?.[1];
  const metricCard = pageSource.match(/\.home-data-card\s*\{([^}]*)\}/)?.[1];
  const launchpad = pageSource.match(/renderLaunchpad\(\)\s*\{[\s\S]*?return `([\s\S]*?)`;\s*\n\s*\},/)?.[1];
  assert.match(metricGrid || '', /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(metricCard || '', /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1\.2fr\)/);
  assert.match(metricCard || '', /border-radius:\s*12px/);
  assert.match(metricGrid || '', /margin-top:\s*clamp\(48px,\s*9vh,\s*72px\)/);
  assert.match(pageSource, /\.home-data-note\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(pageSource, /class="home-panel" aria-label="Recent orders"/);
  assert.match(pageSource, /class="home-panel home-panel-compact" aria-label="Yesterday’s sales"/);
  assert.match(pageSource, /class="home-panel home-panel-compact" aria-label="Needs attention"/);
});

test('recent orders show a short product name, payment amount and POS or Web', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /const nameCharacters = Array\.from\(itemName\);[\s\S]*?nameCharacters\.length > 12[\s\S]*?nameCharacters\.slice\(0,\s*11\)\.join\(""\)/);
  assert.match(pageSource, /const channelLabel = \/web\|online\/i\.test\(String\(sale\.channel \|\| ""\)\) \? "Web" : "POS"/);
  assert.match(pageSource, /<strong>\$\{AppUtils\.escapeHTML\(itemLabel\)\}<\/strong>[\s\S]*?<small>\$\{channelLabel\}<\/small>[\s\S]*?<strong>\$\{AppUtils\.escapeHTML\(money\(sale\.total\)\)\}<\/strong>[\s\S]*?<small>Payment<\/small>/);
  assert.doesNotMatch(pageSource, /sale\.reference \|\| "Sale"|dateLabel|Recorded sales in|yesterdayTotal/);
  assert.match(pageSource, /Yesterday<\/span><h2>\$\{yesterdaySales\.length\} sale/);
});

test('mobile Studio notifications sit above the fixed bottom navigation', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(pageSource, /@media \(max-width: 680px\)\s*\{\s*body\.app-shell \.toast-container\s*\{[^}]*bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom,\s*0px\)\)[^}]*z-index:\s*1101/);
  assert.match(pageSource, /body\.app-shell \.toast\s*\{[^}]*width:\s*min\(100%,\s*560px\)/);
});

test('website currency control is native-app-only in Payments, not in the website editor', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const storefront = await readFile(new URL('../public/builder-storefront.html', import.meta.url), 'utf8');
  const storeEditor = pageSource.match(/renderWebsiteStoreEditor\(\) \{([\s\S]*?)\n  \},\n\n  renderProductsManager/)?.[1];
  const payments = pageSource.match(/if \(path === "\/account\/payments"\) \{([\s\S]*?)\n    \}\n    if \(path === "\/store\/orders"/)?.[1];
  const currencyBinder = pageSource.match(/const websiteCurrencyForm = container\.querySelector\("\[data-app-website-currency\]"\);([\s\S]*?)\n    const branchesUrl/)?.[1];
  assert.ok(storeEditor, 'Website store details editor should have a bounded renderer.');
  assert.ok(payments, 'App Payments should have a bounded renderer.');
  assert.ok(currencyBinder, 'App currency settings should have a bounded save handler.');
  assert.doesNotMatch(storeEditor, /currency|Store details and website currency/);
  assert.match(payments, /window\.Capacitor\?\.isNativePlatform\?\.\(\) === true/);
  assert.match(payments, /data-app-website-currency/);
  assert.match(payments, /Website currency/);
  assert.match(currencyBinder, /window\.Capacitor\?\.isNativePlatform\?\.\(\) === true/);
  assert.match(currencyBinder, /SQLiteEngine\.updateStore\(\{ currency, currency_symbol: currencySymbol \}\)/);
  assert.match(currencyBinder, /AppController\.cacheActiveTenantCatalog\(\)[\s\S]*?window\.ShopSQLite\.flush\(\)/);
  assert.match(currencyBinder, /Product prices were not converted; publish the catalog to update the live site/);
  assert.doesNotMatch(pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1] || "", /Store details and website currency|>Store settings</);
  assert.match(pageSource, /currency: "KES",\s*currency_symbol: "KSh"/);
  assert.match(storefront, /"priceCurrency": String\(SQLiteEngine\.getStore\(\)\.currency \|\| "KES"\)\.toUpperCase\(\)/);
});

test('app shell keeps readable text on white surfaces while preserving accent button contrast', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const themeSettingsStart = pageSource.indexOf('  applyThemeSettings(appearance = this.getStudioAppearance()) {');
  const themeSettingsEnd = pageSource.indexOf('  setAppShellTheme(', themeSettingsStart);
  const themeSettings = themeSettingsStart >= 0 && themeSettingsEnd > themeSettingsStart
    ? pageSource.slice(themeSettingsStart, themeSettingsEnd)
    : null;
  assert.ok(themeSettings, 'App shell theme settings should have a bounded method scope.');
  assert.match(themeSettings, /const foreground = "#18181B";/);
  assert.match(themeSettings, /const accentForeground = isWhiteAccent \|\| !isDarkAccent \? "#18181B" : "#FFFFFF";/);
  assert.match(themeSettings, /setProperty\("--accent-contrast", accentForeground\)/);
  assert.match(themeSettings, /setProperty\("--text-muted", "#66666B"\)/);
  assert.match(themeSettings, /setProperty\("--text-dim", "#8A8A90"\)/);
});

test('home navigation drawer links directly to Shops & Tenants outside builder preview', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const mobileDrawer = pageSource.match(/<!-- Mobile Navigation Drawer -->([\s\S]*?)<\/div>\s*`/);
  assert.ok(mobileDrawer, 'Home navigation should include a mobile drawer.');
  assert.match(mobileDrawer[1], /href="\/account\/tenants" class="mobile-nav-link" data-route="\/account\/tenants">Shops &amp; Tenants<\/a>/);
  assert.match(mobileDrawer[1], /\$\{options\.builderPreview \? "" : `[\s\S]*?href="\/account\/tenants"/);
});

test('storefront checkout clearly continues to Paystack after submitting an order', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const checkout = pageSource.match(/renderCheckout\(\) \{([\s\S]*?)\n  \},\n\n  renderOrderConfirmation/)?.[1];
  assert.ok(checkout, 'Storefront checkout should have a bounded renderer.');
  assert.match(checkout, /Submit your order to continue to Paystack’s secure payment page/);
  assert.match(checkout, /Place Order &amp; Continue to Paystack/);
  assert.doesNotMatch(checkout, /Place Unpaid Order/);
  assert.match(pageSource, /const payment = await window\.EshopInventoryBridge\.initializeStorefrontPayment\(tenantId, serverOrder\.order_number\);[\s\S]*?window\.location\.assign\(payment\.authorization_url\)/);
});

test('published storefront checkout creates server orders and sends customers to Paystack', async () => {
  const storefront = await readFile(new URL('../public/builder-storefront.html', import.meta.url), 'utf8');
  const checkout = storefront.match(/renderCheckout\(\) \{([\s\S]*?)\n  \},\n\n  renderOrderConfirmation/)?.[1];
  const checkoutHandler = storefront.match(/initCheckoutForm\(\) \{([\s\S]*?)\n  \},\n\n  async initPaystackReturn/)?.[1];
  const paymentReturn = storefront.match(/async initPaystackReturn\(\) \{([\s\S]*?)\n  \},\n\n  initStudioModals/)?.[1];
  const inlineScript = storefront.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(checkout, 'Published storefront checkout should have a bounded renderer.');
  assert.ok(checkoutHandler, 'Published storefront should have a bounded checkout handler.');
  assert.ok(paymentReturn, 'Published storefront should verify Paystack returns.');
  assert.ok(inlineScript, 'Published storefront should include its application script.');
  new Script(inlineScript);
  assert.match(checkout, /Continue to Paystack/);
  assert.match(checkout, /Paystack unavailable for \$\{AppUtils\.escapeHTML\(currency\)\}/);
  assert.match(checkout, /disabled aria-describedby="checkout-status"/);
  assert.match(checkout, /Craft mobile app under Payments[\s\S]*?publish the catalog/);
  assert.match(storefront, /\.btn-primary:disabled,[\s\S]*?cursor: not-allowed;[\s\S]*?transform: none;/);
  assert.match(checkout, /data-checkout-status/);
  assert.doesNotMatch(checkout, /name="cardNumber"|name="cardCvc"|tab-payment-momo|value="Julian"/);
  assert.match(storefront, /formatMoney\(num\) \{[\s\S]*?SQLiteEngine\.getStore\(\)\.currency[\s\S]*?style:\s*"currency"[\s\S]*?currency:/);
  assert.match(checkout, /const checkoutAvailable = builderPreviewMode \|\| currency === "KES";/);
  assert.match(checkoutHandler, /fetch\("\/api\/orders"/);
  assert.match(checkoutHandler, /fetch\("\/api\/payments\/paystack\/initialize"/);
  assert.match(checkoutHandler, /window\.location\.assign\(authorizationUrl\.toString\(\)\)/);
  assert.match(checkoutHandler, /Paystack checkout currently requires KES/);
  assert.match(storefront, /window\.__ESHOP_CLOUDFLARE_STOREFRONT__ && !builderPreviewMode/);
  assert.match(paymentReturn, /if \(builderPreviewMode\) return;/);
  assert.match(paymentReturn, /fetch\(`\/api\/payments\/paystack\/verify\?/);
});

test('published storefront reports anonymous product interest and submits owner-approved hold requests', async () => {
  const storefront = await readFile(new URL('../public/builder-storefront.html', import.meta.url), 'utf8');
  const ownerUi = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const inlineScript = storefront.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript, 'Published storefront should include its application script.');
  new Script(inlineScript);
  assert.match(storefront, /Request a hold[\s\S]*?not reserved unless the owner approves it[\s\S]*?data-product-hold-form/);
  assert.match(storefront, /recordStorefrontVisit\(path \|\| "\/"\)/);
  assert.match(storefront, /recordProductInterest\(productId, action, value\)/);
  assert.match(storefront, /fetch\("\/api\/product-interest"/);
  assert.match(storefront, /fetch\("\/api\/product-holds"/);
  assert.match(ownerUi, /Storefront hold requests[\s\S]*?data-online-holds-load/);
  assert.match(ownerUi, /Approve for 24 hours/);
  assert.match(ownerUi, /Product activity · last 30 days[\s\S]*?data-business-product-analytics/);
  assert.match(ownerUi, /listStorefrontHolds\(tenantId\)[\s\S]*?updateStorefrontHold\(tenantId, id, action\)/);
});

test('POS persists products, manual payments, invoices and business instances in SQLite', async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => fileURLToPath(new URL(`../node_modules/sql.js/dist/${file}`, import.meta.url))
  });

  const db = new SQL.Database();
  const handlers = {};
  const root = { innerHTML: '' };
  const toast = {
    textContent: '',
    classList: { add() {}, remove() {}, toggle() {} }
  };
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldFormData = globalThis.FormData;
  const oldConfirm = globalThis.confirm;
  const oldPrompt = globalThis.prompt;
  let promptValue = null;
  const runSql = (statement, values = []) => {
    db.run(statement, values);
    const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0;
    return { changes: { changes: db.getRowsModified(), lastId } };
  };
  const queryRows = (statement, values = []) => {
    const query = db.prepare(statement);
    query.bind(values);
    const result = [];
    while (query.step()) result.push(query.getAsObject());
    query.free();
    return result;
  };
  globalThis.window = {
    location: { hash: '#/pos' },
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); },
    setInterval() { return 1; },
    ShopSQLite: {
      async query(statement, values = []) {
        const query = db.prepare(statement);
        query.bind(values);
        const result = [];
        while (query.step()) result.push(query.getAsObject());
        query.free();
        return { values: result };
      },
      async run(statement, values = []) { return runSql(statement, values); },
      async execute(statement) { db.exec(statement); },
      async executeSet(statements) {
        db.run('BEGIN');
        try {
          for (const item of statements) runSql(item.statement, item.values);
          db.run('COMMIT');
          return { changes: { changes: db.getRowsModified() } };
        } catch (error) {
          db.run('ROLLBACK');
          throw error;
        }
      }
    }
  };
  globalThis.document = {
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); },
    getElementById(id) { return id === 'app' ? root : id === 'pos-toast' ? toast : null; },
    createElement() { return { className: '', classList: { add() {}, remove() {}, toggle() {} } }; },
    body: { appendChild() {} }
  };
  globalThis.FormData = class {
    constructor(form) { this.values = form.values; }
    entries() { return Object.entries(this.values); }
  };
  globalThis.confirm = () => true;
  globalThis.prompt = () => promptValue;

  try {
    db.run(`CREATE TABLE pos_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      buying_price_cents INTEGER,
      stock_count INTEGER DEFAULT 0,
      sku TEXT,
      image_uri TEXT,
      low_stock_threshold INTEGER NOT NULL DEFAULT 3,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`);
    db.run(`INSERT INTO pos_products
      (id,name,category_id,price_cents,sku,stock_count,created_at)
      VALUES (1,'Legacy item',1,250,'LEGACY-1',5,'2024-01-01T00:00:00.000Z')`);
    const app = createPosApp();
    await app.init();
    assert.equal(queryRows('SELECT name,sku,barcode FROM pos_products WHERE id=1')[0].name, 'Legacy item');
    assert.equal(queryRows('SELECT name,sku,barcode FROM pos_products WHERE id=1')[0].sku, 'LEGACY-1');
    assert.equal(queryRows('SELECT name,sku,barcode FROM pos_products WHERE id=1')[0].barcode, null);
    assert.equal(queryRows('SELECT expiry_date FROM pos_products WHERE id=1')[0].expiry_date, null);
    assert.equal(queryRows('SELECT hex(image_embedding) AS embedding FROM pos_products WHERE id=1')[0].embedding, '');
    const savedEmbedding = '7f00'.repeat(64);
    const photoProductId = await app.saveProduct({
      name: 'Photo sample', categoryId: 1, price: 1.25, sku: 'PHOTO-1', barcode: '',
      expiryDate: '', stock: '', buyingPrice: '', lowStockThreshold: 3, active: true,
      imageUri: 'data:image/jpeg;base64,AA==', imageEmbeddingHex: savedEmbedding
    });
    assert.equal(queryRows('SELECT hex(image_embedding) AS embedding FROM pos_products WHERE id=?', [photoProductId])[0].embedding, savedEmbedding.toUpperCase());
    assert.equal((await app.listProducts()).find((product) => product.id === photoProductId).imageEmbedding[0], 127);
    await runSql('DELETE FROM pos_products WHERE id=?', [photoProductId]);
    runSql('DELETE FROM pos_products WHERE id=1');
    runSql("DELETE FROM sqlite_sequence WHERE name='pos_products'");
    await app.refresh();
    const storeMarkup = app.render('/pos');
    assert.match(storeMarkup, /class="pos-bottom-nav"/);
    assert.equal((storeMarkup.match(/class="pos-tab /g) || []).length, 5);
    assert.match(storeMarkup, /class="pos-nav-icon" aria-hidden="true">＋<\/span><span>Sell<\/span>/);
    assert.match(storeMarkup, /class="pos-nav-icon" aria-hidden="true">▦<\/span><span>Catalogue<\/span>/);
    assert.match(storeMarkup, /class="pos-nav-icon" aria-hidden="true">▤<\/span><span>Orders<\/span>/);
    assert.doesNotMatch(storeMarkup, /Open app account|>Account<\/a>/);
    assert.match(storeMarkup, /aria-label="POS screens menu"[\s\S]*?href="\/account\/profile\/webs"[\s\S]*?href="\/account\/profile\/accounts"[\s\S]*?href="\/account\/profile\/privacy"/);
    const inventoryMarkup = app.render('/pos/inventory');
    assert.match(inventoryMarkup, /class="[^"]*pos-main pos-main-with-tabs"[\s\S]*?class="pos-brand[^"]*"[\s\S]*?<span>Inventory<\/span>[\s\S]*?<details class="workspace-menu pos-section-menu"[\s\S]*?aria-label="Catalogue screens menu"[\s\S]*?class="workspace-sidebar-link is-active" aria-current="page">Inventory<\/a>[\s\S]*?<\/details>[\s\S]*?<section class="pos-content"/);
    assert.doesNotMatch(inventoryMarkup, /<span>POS<\/span>/);
    assert.doesNotMatch(inventoryMarkup, /Open checkout|Open app account|>Account<\/a>/);
    assert.match(inventoryMarkup, /Export inventory/);
    assert.match(inventoryMarkup, /Restore backup/);
    assert.match(inventoryMarkup, /Import CSV/);
    assert.match(inventoryMarkup, /Reorder at/);
    assert.match(inventoryMarkup, /Scan barcode \(optional\)/);
    assert.match(inventoryMarkup, /Scan product label/);
    assert.match(inventoryMarkup, /Expiry date · optional/);
    assert.match(inventoryMarkup, /A separate SKU is assigned automatically/);
    assert.match(inventoryMarkup, /data-product-barcode-status/);
    assert.match(inventoryMarkup, /Suggest category from photo/);
    assert.match(inventoryMarkup, /data-image-category-suggestions/);
    assert.match(inventoryMarkup, /Take product photo/);
    assert.match(inventoryMarkup, /data-product-image-preview/);
    assert.doesNotMatch(inventoryMarkup, /SKU · same as website product/);
    const settingsMarkup = app.render('/pos/settings');
    assert.match(settingsMarkup, /Bluetooth \/ USB barcode scanner[\s\S]*?device’s Bluetooth settings[\s\S]*?data-pos-barcode-input/);
    assert.match(settingsMarkup, /Nearby device sync/);
    assert.match(settingsMarkup, /data-nearby-sync-status/);
    assert.match(settingsMarkup, /phone scans this register’s QR once/);
    assert.match(settingsMarkup, /encrypted POS transfer goes directly over the same Wi-Fi/);
    assert.match(settingsMarkup, /Create pairing QR/);
    assert.match(settingsMarkup, /Scan pairing QR/);
    assert.match(settingsMarkup, /same Wi-Fi/);
    for (const route of ['/pos', '/pos/overview', '/pos/catalogue/inventory', '/pos/orders', '/pos/more']) {
      assert.match(storeMarkup, new RegExp(`href="${route}" data-route="${route}"`));
    }
    assert.doesNotMatch(storeMarkup, /class="pos-tabs"/);
    assert.match(storeMarkup, /placeholder="Search products"/);
    assert.doesNotMatch(storeMarkup, /data-pos-barcode-input|Bluetooth \/ USB scanner/);
    assert.match(storeMarkup, /Scan with camera/);
    assert.match(storeMarkup, />All</);
    assert.doesNotMatch(storeMarkup, />Filter</);
    const overviewMarkup = app.render('/pos/overview');
    assert.match(overviewMarkup, /href="\/" data-route="\/" data-home-screen class="pos-brand pos-brand-back pos-brand-overview" aria-label="Back to Craft home"[^>]*>[\s\S]*?<svg viewBox="0 0 24 24"[\s\S]*?<span>Overview<\/span>/);
    assert.doesNotMatch(overviewMarkup, /<span>POS<\/span>/);
    assert.doesNotMatch(overviewMarkup, /<h2>Overview<\/h2>/);
    assert.match(overviewMarkup, /class="pos-overview-controls"/);
    assert.match(overviewMarkup, /aria-label="Overview sections menu"[\s\S]*?class="workspace-sidebar-link is-active" aria-current="page">Summary<\/a>/);
    assert.doesNotMatch(overviewMarkup, /Business overview|Manage expenses|Store performance/);
    assert.match(overviewMarkup, /class="pos-overview-card"[^>]*aria-label="Business totals"/);
    assert.match(overviewMarkup, /<small>Revenue<\/small>/);
    assert.match(overviewMarkup, /<small>Profit<\/small>/);
    assert.match(overviewMarkup, /<small>Operating profit<\/small>/);
    assert.match(overviewMarkup, /<small>Credit<\/small>/);
    assert.equal((overviewMarkup.match(/class="pos-overview-metric"/g) || []).length, 5);
    assert.match(overviewMarkup, /class="pos-card pos-revenue-card"/);
    assert.match(app.render('/pos'), /<span>Sell<\/span>/);
    const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    for (const [index, script] of [...pageSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()) {
      if (/\bsrc\s*=/.test(script[1])) continue;
      assert.doesNotThrow(() => new Script(script[2], { filename: `index.html:inline-script-${index + 1}` }));
    }
    const posSource = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
    assert.match(posSource, /decodeFromVideoElement\(video/);
    assert.match(posSource, /getUserMedia\(\{[\s\S]*?facingMode: \{ ideal: 'environment' \}/);
    assert.match(posSource, /Added \$\{result\.name\}\. Scan the next item\./);
    assert.match(posSource, /data-scanner-mode="barcode"[\s\S]*?data-scanner-mode="label"/);
    assert.match(posSource, /data-scanner-mode="match"[\s\S]*?Matching starts automatically/);
    assert.doesNotMatch(posSource, /data-scanner-find-matches|Find photo matches/);
    assert.match(posSource, /async function scanPhotoMatchFrames\(session, video, overlay, status\)[\s\S]*?captureVideoFrameForVision\(video, 256\)[\s\S]*?rankImageMatches\(products, embedding\)[\s\S]*?Tap the correct product to add it/);
    assert.match(posSource, /Date\.now\(\) - lastProcessedAt < 550/);
    assert.match(posSource, /No saved product photos yet/);
    assert.match(posSource, /async function captureProductPhoto\(\)[\s\S]*?navigator\.mediaDevices\.getUserMedia[\s\S]*?capture\.disabled = false/);
    assert.match(posSource, /action === 'take-product-photo'[\s\S]*?captureProductPhoto\(\)[\s\S]*?Photo capture cancelled/);
    assert.match(posSource, /async function createProductImageEmbedding\(productId, imageUri\)[\s\S]*?await saveProduct\(\{ \.\.\.product, imageEmbeddingHex \}\)/);
    assert.match(posSource, /async function getProductVision\(\)[\s\S]*?return \{ plugin: ProductVision \}/);
    assert.match(posSource, /const products = state\.products\.filter\(\(product\) => product\.active\);[\s\S]*?rankImageMatches\(products, embedding\)/);
    assert.match(posSource, /async function saveProduct\(data\)[\s\S]*?image_embedding/);
    assert.match(posSource, /const \{ imageEmbedding, imageEmbeddingHex, \.\.\.syncProduct \} = product/);
    assert.match(posSource, /async function scanLabelFrames\([\s\S]*?TextRecognition\.processImage\(\{ path: framePath, script: Script\.Latin \}\)/);
    assert.match(posSource, /data-label-confirm/);
    assert.match(posSource, /if \(result\?\.captured \|\| result\?\.closeScanner\) await session\.close\(\)/);
    assert.match(posSource, /if \(barcode\.format === 'QR_CODE'\) \{[\s\S]*?if \(!productForm\) \{[\s\S]*?showQrDetails\(value\);[\s\S]*?const result = await onBarcode\(value\);[\s\S]*?if \(result\?\.captured \|\| result\?\.closeScanner\) await session\.close\(\)/);
    assert.match(posSource, /Barcode \$\{code\} captured successfully\. Complete the product details and save\./);
    assert.match(posSource, /return \{ captured: true \};[\s\S]*?return false;/);
    assert.match(posSource, /Product name filled from the label\. Enter the remaining details below\./);
    assert.match(posSource, /productForm\.elements\.name\.value = name;[\s\S]*?await session\.close\(\)/);
    const labelProductResult = posSource.match(/result\.innerHTML = productForm\s*\?([\s\S]*?)\n\s*: `/)?.[1];
    assert.ok(labelProductResult, 'Product label scanning should show a distinct name-only confirmation.');
    assert.match(labelProductResult, /Product name found[\s\S]*?Use details/);
    assert.doesNotMatch(labelProductResult, /data-label-price|data-label-expiry/);
    assert.match(posSource, /data-pos-form="product" novalidate/);
    assert.match(posSource, /field\('Selling price', 'price'.*required: true/);
    assert.match(posSource, /Enter a selling price before adding this product/);
    assert.match(posSource, /Product saved\.[\s\S]*?createProductImageEmbedding\(productId, imageUri\)/);
    const labelScannerSource = posSource.match(/async function scanLabelFrames\([\s\S]*?function showLabelSuggestions/)?.[0];
    assert.ok(labelScannerSource, 'Product-label OCR must have a dedicated scan handler.');
    assert.match(labelScannerSource, /if \(!productForm\) savedProducts = \(await listProducts\(\)\)\.filter\(\(product\) => product\.active\)/);
    assert.match(labelScannerSource, /matchProductLabel\(text, savedProducts\)[\s\S]*?addProductToSale\(product, true\)/);
    assert.match(posSource, /async function addProductToSale\(product, closeScanner = false\)[\s\S]*?if \(closeScanner\) await barcodeScanner\?\.close\(\);[\s\S]*?await refresh\(\)/);
    assert.match(labelScannerSource, /No saved product matched this label[\s\S]*?Nothing was added to the sale/);
    assert.doesNotMatch(labelScannerSource, /saveProduct\(/);
    assert.match(labelScannerSource, /Date\.now\(\) - lastProcessedAt < 700/);
    assert.match(posSource, /action === 'scan-product-label'[\s\S]*?openBarcodeScanner\(async \(\) => null, \{\s*allowProductLabel: true, productForm: form, initialMode: 'label'/);
    assert.match(posSource, /action === 'scan-sale-barcode'[\s\S]*?openBarcodeScanner\(addScannedBarcode, \{ allowProductLabel: true \}\)/);
    assert.doesNotMatch(posSource, /scan-label-from-scanner|startLabelScanOnNextRender/);
    assert.match(posSource, /new RTCPeerConnection\(\{ iceServers: \[\] \}\)/);
    assert.match(posSource, /createDataChannel\('eshop-pos-sync'/);
    assert.match(posSource, /snapshot-start/);
    const bootstrapSource = await readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8');
    const originalStorefront = await readFile(new URL('../public/builder-storefront.html', import.meta.url), 'utf8');
    const sqliteSource = await readFile(new URL('../src/sqlite.js', import.meta.url), 'utf8');
    const cloudflareWorkerSource = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
    const webManifest = await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
    const androidManifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
    const androidBackupRules = await readFile(new URL('../android/app/src/main/res/xml/backup_rules.xml', import.meta.url), 'utf8');
    const androidDataExtractionRules = await readFile(new URL('../android/app/src/main/res/xml/data_extraction_rules.xml', import.meta.url), 'utf8');
    assert.match(pageSource, /btn-publish-cloudflare/);
    assert.match(pageSource, /ESHOP_CLOUDFLARE_PUBLISH_URL_V1/);
    assert.match(pageSource, /href="\/account\/tenants" data-route="\/account\/tenants"/);
    assert.match(pageSource, /path === "\/account\/tenants"/);
    assert.match(pageSource, /renderTenantsManager\(\)/);
    assert.match(pageSource, /renderAppAccount\(\)[\s\S]*?Craft app account[\s\S]*?id="app-account-form"[\s\S]*?Cloudflare human verification/);
    const launchpad = pageSource.match(/renderLaunchpad\(\)\s*\{[\s\S]*?return `([\s\S]*?)`;\s*\n\s*\},/)?.[1];
    assert.ok(launchpad, 'The app should render a dedicated Home screen.');
    const homeRoutes = [...launchpad.matchAll(/class="home-workspace-card home-workspace-card-(?:main|craft)" href="([^"]+)" data-route=/g)].map(([, route]) => route);
    assert.deepEqual(homeRoutes, ['/account/main-shop', '/account/web']);
    assert.doesNotMatch(launchpad, /home-screen-logo|<img[^>]+eshop-logo/);
    assert.match(launchpad, /<p class="home-screen-greeting">Hi, \$\{AppUtils\.escapeHTML\(username\)\} <span aria-hidden="true">👋<\/span><\/p>/);
    assert.match(pageSource, /renderLaunchpad\(\)\s*\{[\s\S]*?ESHOP_ACCOUNT_SESSION_V1[\s\S]*?ESHOP_ACCOUNT_USERNAME_V1/);
    assert.match(pageSource, /\.home-screen-greeting\s*\{[^}]*color:\s*var\(--home-light-foreground\)/);
    assert.match(launchpad, /class="home-screen-profile" href="\/app-account" data-route="\/app-account" aria-label="Account"/);
    assert.match(launchpad, /class="home-pos-card" href="\/pos" data-route="\/pos" aria-label="Open POS"/);
    assert.match(launchpad, /class="home-launcher-group" role="group" aria-label="POS and workspaces"[\s\S]*class="home-pos-card"[\s\S]*class="home-workspace-grid" aria-label="Choose a workspace"[\s\S]*Main Store[\s\S]*Craft/);
    assert.match(launchpad, /data-home-dashboard aria-label="Store overview" aria-live="polite"/);
    assert.match(launchpad, /data-home-dashboard aria-label="Store overview" aria-live="polite" aria-busy="true"[\s\S]*?home-dashboard-skeleton[\s\S]*?home-skeleton-line/);
    assert.match(pageSource, /async loadHomeDashboard\(\)[\s\S]*?StudioRenderers\.getMainShopSnapshot\(\)[\s\S]*?Sales today[\s\S]*?Recent orders/);
    assert.match(launchpad, /class="home-shortcut-grid" aria-label="Quick actions"[\s\S]*?href="\/store\/products" data-route="\/store\/products"[\s\S]*?Products[\s\S]*?href="\/store\/inventory" data-route="\/store\/inventory"[\s\S]*?Inventory[\s\S]*?href="\/store\/orders" data-route="\/store\/orders"[\s\S]*?Orders[\s\S]*?href="\/store\/categories" data-route="\/store\/categories"[\s\S]*?Categories/);
    assert.equal((launchpad.match(/class="home-shortcut-link"/g) || []).length, 4);
    assert.match(pageSource, /if \(path === "\/"\) void this\.loadHomeDashboard\(\)/);
    assert.doesNotMatch(launchpad, /Overall Revenue|Overall Profit|Overall Customers|Average Order|home-overall-metric/);
    assert.doesNotMatch(pageSource, /loadHomeOverallMetrics|home-overall-metric|home-overall-metrics/);
    assert.match(pageSource, /path === "\/account\/main-shop" \|\| path\.startsWith\("\/account\/main-shop\/"\)[\s\S]*?renderMainShopWorkspace\(path\)/);
    assert.match(pageSource, /renderMainShopWorkspace\(path\)\s*\{[\s\S]*?title: "Overview"[\s\S]*?title: "Sales"[\s\S]*?title: "Products"[\s\S]*?title: "Customers"[\s\S]*?title: "More"[\s\S]*?title: "Insights"[\s\S]*?title: "Revenue"[\s\S]*?title: "Channels"[\s\S]*?title: "Transactions"[\s\S]*?title: "Inventory"[\s\S]*?title: "Categories"[\s\S]*?title: "Marketing"[\s\S]*?title: "Newsletter"[\s\S]*?title: "Finance"[\s\S]*?title: "Stores"[\s\S]*?title: "Settings"[\s\S]*?title: "Help"/);
    assert.match(pageSource, /data-business-filter-toggle aria-label="Show filters" aria-controls="business-date-filters" aria-expanded="false"[\s\S]*?viewBox="0 0 24 24"[\s\S]*?id="business-date-filters" class="bl-date-filter" aria-label="Business filters" hidden/);
    assert.match(pageSource, /businessFilterToggle\.addEventListener\("click"[\s\S]*?businessFilters\.hidden = !expanded/);
    assert.doesNotMatch(pageSource, /href="\/pos" class="studio-preview-link" data-route="\/pos">Open POS/);
    assert.match(pageSource, /src="\/src\/business-lens\.js"/);
    assert.match(pageSource, /data-filter="range"[\s\S]*?data-filter="channel"[\s\S]*?data-filter="category"[\s\S]*?data-filter="granularity"/);
    assert.match(pageSource, /data-business-export="transactions"/);
    assert.match(pageSource, /window\.ShopPOS\.listExpenses \? window\.ShopPOS\.listExpenses\(\)/);
    assert.match(pageSource, /window\.ShopPOS\.listInstances \? window\.ShopPOS\.listInstances\(\)/);
    assert.match(pageSource, /if \(path === "\/account" \|\| path === "\/account\/main-shop" \|\| path === "\/account\/main-shop\/" \|\| path === "\/account\/dashboard"\)[\s\S]*?Gross web revenue[\s\S]*?Customer visits[\s\S]*?Awaiting payments[\s\S]*?What’s moving/);
    assert.doesNotMatch(pageSource, /studio-hamburger/);
    assert.match(pageSource, /\.workspace-sidebar\s*\{[^}]*position:\s*fixed[^}]*right:\s*0[^}]*bottom:\s*0[^}]*width:\s*min\(86vw,\s*360px\)/);
    assert.doesNotMatch(pageSource, /class="studio-workspace-top-nav"|class="studio-nested-nav"/);
    assert.match(pageSource, /renderWorkspaceSidebar\(title, items, activeRoute\)[\s\S]*?workspace-sidebar-links[\s\S]*?aria-current="page"/);
    assert.match(pageSource, /renderWorkspaceLoading\(label\)[\s\S]*?studio-metric-grid[\s\S]*?studio-data-card[\s\S]*?studio-panel workspace-skeleton-panel/);
    assert.match(pageSource, /\.business-lens-shell \.studio-workspace-heading\s*\{[^}]*align-items:\s*center/);
    assert.doesNotMatch(pageSource.match(/\.business-lens-shell \.studio-workspace-heading\s*\{([^}]*)\}/)?.[1] || "", /position:\s*sticky/);
    assert.match(pageSource, /\.business-lens-shell \.workspace-menu summary\s*\{[^}]*width:\s*38px/);
    assert.match(pageSource, /\.pos-tab\.is-active\s*\{[^}]*background:\s*transparent/);
    assert.doesNotMatch(pageSource, /pos-screen-enter|@keyframes pos-screen-enter/);
    assert.match(pageSource, /label: "Webs"[\s\S]*?profile-sidebar-link/);
    assert.match(pageSource, /if \(isDrawer\)[\s\S]*?profile-sidebar/);
    assert.match(pageSource, /if \(path === "\/store\/products"\)[\s\S]*?Add from Store[\s\S]*?Add web product[\s\S]*?webProducts\.map/);
    assert.match(pageSource, /if \(path === "\/store\/inventory"\)[\s\S]*?Website stock is managed independently[\s\S]*?webProducts\.map/);
    assert.match(pageSource, /getMainShopSnapshot\(\)[\s\S]*?window\.ShopPOS\.listProducts\(\)[\s\S]*?window\.ShopPOS\.listCategories\(\)[\s\S]*?window\.ShopPOS\.listSales\(\)[\s\S]*?SQLiteEngine\.select\("orders"\)/);
    assert.match(pageSource, /path === "\/store\/website"[\s\S]*?Deploy storefront to web/);
    assert.match(pageSource, /generateProductSku\(\)[\s\S]*?ESHOP-\$\{Array\.from\(bytes/);
    assert.doesNotMatch(pageSource, /name="sku" value="\$\{AppUtils\.escapeHTML\(product \? product\.sku : `ESHOP-\$\{Date\.now\(\)\}`\)\}"/);
    assert.match(pageSource, /\.home-screen-main\s*\{[^}]*width:\s*100%[^}]*max-width:\s*860px/);
    assert.match(pageSource, /\.home-launcher-group\s*\{[^}]*justify-content:\s*flex-start[^}]*gap:\s*12px[^}]*padding:\s*12px[^}]*border-radius:\s*16px[^}]*backdrop-filter:\s*blur\(4px\)/);
    assert.match(pageSource, /\.home-launcher-group\s*\{[^}]*background:\s*rgba\(225,\s*243,\s*248,\s*\.035\)/);
    assert.match(pageSource, /\.home-pos-card\s*\{[^}]*grid-template-columns:\s*42px minmax\(0,\s*1fr\) 24px[^}]*min-height:\s*90px/);
    assert.match(pageSource, /\.home-workspace-card\s*\{[^}]*min-height:\s*136px/);
    assert.match(pageSource, /\.home-workspace-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(pageSource, /@media \(max-width: 600px\)\s*\{\s*\.home-launcher-group\s*\{[^}]*width:\s*calc\(100% \+ var\(--home-horizontal-gutter\) \+ var\(--home-horizontal-gutter\)\)[^}]*margin-left:\s*calc\(0px - var\(--home-horizontal-gutter\)\)[^}]*margin-bottom:\s*-46px[^}]*padding-bottom:\s*clamp\(24px,\s*3\.5vh,\s*30px\)[^}]*border-right:\s*1px solid rgba\(235,\s*250,\s*255,\s*\.56\)[^}]*border-left:\s*1px solid rgba\(235,\s*250,\s*255,\s*\.56\)[^}]*border-radius:\s*0/);
    assert.match(pageSource, /\.home-metric-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.doesNotMatch(pageSource, /\.home-screen-header\s*\{[^}]*border-bottom:/);
    assert.doesNotMatch(launchpad, /home-bento-card|home-credit-card|home-cube/);
    assert.doesNotMatch(launchpad, /Where would you like to go|Manage your online shop/);
    assert.match(pageSource, /renderLaunchpad\(\)\s*\{\s*document\.title = "Home — Craft"/);
    assert.match(webManifest, /"name":"Craft","short_name":"Craft"/);
    assert.match(webManifest, /"src":"\/favicon-512\.png"/);
    assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
    assert.match(pageSource, /path === "\/app-account"[\s\S]*?renderAppAccount\(\)/);
    assert.match(pageSource, /appAccountForm\.onsubmit = async event =>[\s\S]*?\/api\/auth\/\$\{registering \? "register" : "login"\}[\s\S]*?ESHOP_ACCOUNT_SESSION_V1[\s\S]*?restoreAccountWebsites\(result\.tenants, origin\)/);
    assert.match(pageSource, /name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example\.com"/);
    assert.match(pageSource, /id="app-account-recovery-email-form"[\s\S]*?\/api\/auth\/set-recovery-email[\s\S]*?ESHOP_ACCOUNT_EMAIL_V1/);
    assert.match(pageSource, /id="app-account-forgot-password"[\s\S]*?\/api\/auth\/request-reset-code[\s\S]*?\/api\/auth\/verify-reset-code[\s\S]*?\/api\/auth\/reset-password/);
    assert.match(pageSource, /#app-account-confirm-field\[hidden\],[\s\S]*?#app-account-turnstile\[hidden\]\s*\{\s*display:\s*none !important/);
    assert.doesNotMatch(pageSource, /app-account-verification-checkbox|Start Cloudflare verification/);
    assert.match(pageSource, /const updateTurnstileVisibility = \(\) => \{[\s\S]*?passwordField\.value === confirmField\.value[\s\S]*?turnstileContainer\.hidden = false;\s*void configureTurnstile\(\);/);
    assert.match(pageSource, /sitekey: config\.turnstile_site_key,\s*appearance:\s*"always",\s*callback\(token\) \{\s*turnstileToken = token;[\s\S]*?appAccountForm\.requestSubmit\(submitButton\)/);
    assert.match(pageSource, /const setAuthMode = mode => \{[\s\S]*?accountError\.hidden = true;\s*accountError\.textContent = "";/);
    assert.match(pageSource, /turnstileContainer\.hidden = !registering \|\| !turnstileRequested/);
    assert.match(pageSource, /if \(registering && !turnstileToken\) \{[\s\S]*?Complete the Cloudflare checkbox to create your account\./);
    assert.doesNotMatch(pageSource, /Tap Create app account to finish/);
    assert.match(pageSource, /appAccountForm\.querySelectorAll\("\[data-app-auth-mode\]"\)\.forEach\(button => \{\s*button\.onclick = \(\) => \{\s*const registering = button\.dataset\.appAuthMode === "register";\s*setAuthMode\(button\.dataset\.appAuthMode\);\s*if \(!registering\) return;\s*\};\s*\}\);/);
    assert.match(pageSource, /Your POS sales and inventory remain on this device; signing in does not upload or sync them/);
    assert.doesNotMatch(pageSource, /&larr;\s+(?:Profile menu|Your websites|Choose a design|Themes|Edit website|Studio|Build Your Web)/);
    assert.match(pageSource, /class="profile-page-back"[^>]*aria-label="Back to profile menu">&larr;<\/a>/);
    assert.doesNotMatch(posSource, /&larr;\s*Back to checkout/);
    assert.doesNotMatch(posSource, /href="\/app-account" data-route="\/app-account"/);
    assert.doesNotMatch(pageSource, /@keyframes pos-screen-enter|classList\.add\("pos-screen-enter"\)/);
    assert.match(pageSource, /\.pos-tab\.is-active\s*\{[^}]*background:\s*transparent !important/);
    assert.match(pageSource, /\.pos-tab:active\s*\{\s*background:\s*transparent/);
    assert.match(pageSource, /\.workspace-menu\[open\]\s*\{\s*z-index:\s*1202/);
    assert.match(pageSource, /\.pos-main-with-tabs \.pos-header-divider\s*\{\s*display:\s*none/);
    assert.match(pageSource, /\.pos-main-with-tabs > \.pos-content > \.pos-section-heading h2\s*\{\s*display:\s*none/);
    assert.match(pageSource, /\.pos-filter-row input\s*\{[^}]*height:\s*38px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.pos-filter-row select\s*\{[^}]*flex:\s*0 1 132px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.pos-scanner-entry \.btn-secondary\s*\{[^}]*min-height:\s*38px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.workspace-sidebar-link\.is-active,\s*\.workspace-sidebar-link:focus-visible/);
    assert.match(pageSource, /const managementSurface = activePath\.startsWith\("\/account"\) \|\| activePath === "\/app-account"[\s\S]*?\$\{managementSurface \? "" : `<div class="nav-center">[\s\S]*?href="\/bag"[\s\S]*?managementSurface \? "" :/);
    assert.match(pageSource, /Cloudflare verification failed[\s\S]*?allowed hostnames, including localhost for Android/);
    assert.match(pageSource, /\.native-app-shell \.profile-page-back,[\s\S]*?\.native-app-shell \.studio-back-link,[\s\S]*?display:\s*none !important/);
    assert.match(bootstrapSource, /Capacitor\.isNativePlatform\(\)[\s\S]*?native-app-shell[\s\S]*?backButton/);
    assert.match(pageSource, /if \(event\.detail\?\.canGoBack\) \{\s*window\.history\.back\(\);/);
    assert.match(pageSource, /renderAccount\(\)\s*\{[\s\S]*?route: "\/account\/web"[\s\S]*?Management<\/h1>/);
    const managementModules = pageSource.match(/renderAccount\(\)\s*\{\s*const modules = \[([\s\S]*?)\n    \];/)?.[1];
    assert.ok(managementModules, "Management module ordering should be explicitly defined.");
    const moduleOrder = [...managementModules.matchAll(/title: "([^"]+)"/g)].map(([, title]) => title);
    assert.deepEqual(moduleOrder, [
      "Point of Sale",
      "Products Manager",
      "Inventory",
      "Categories",
      "Business Dashboard",
      "Build Your Web",
      "Live Web",
      "Store Settings",
      "Shops & Tenants",
      "Plans & Tiering"
    ]);
    assert.match(pageSource, /title: "Live Web", description: "Preview the customer-facing Craft website\.", route: "\/web"/);
    assert.match(pageSource, /studio-profile-btn[\s\S]*?aria-label="Profile"/);
    assert.match(pageSource, /profile-sidebar[\s\S]*?Privacy[\s\S]*?Updates/);
    assert.match(pageSource, /\.profile-menu-overlay\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*justify-content:\s*flex-end;[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*\.56\)/);
    assert.match(pageSource, /\.profile-sidebar\s*\{[^}]*width:\s*min\(50vw,\s*420px\);[^}]*height:\s*100dvh;[^}]*background:\s*#171717/);
    assert.match(pageSource, /renderProfileScreen\(path = "\/account\/profile"\)/);
    assert.match(pageSource, /class="profile-menu-overlay" aria-label="Profile menu"/);
    assert.match(pageSource, /class="profile-menu-backdrop" href="\/account"/);
    assert.match(pageSource, /const isDrawer = path === "\/account\/profile"/);
    assert.match(pageSource, /\{ id: "home", label: "Home", route: "\/" \}/);
    assert.match(pageSource, /\{ id: "updates", label: "Updates" \}/);
    assert.match(pageSource, /const href = section\.route \|\| `\/account\/profile\/\$\{section\.id\}`/);
    assert.match(pageSource, /class="container profile-page-container" aria-label="\$\{AppUtils\.escapeHTML\(activeLabel\)\} screen"/);
    assert.match(pageSource, /profile-page-avatar[\s\S]*?Full name[\s\S]*?profile-page-card"><h2>Store name<\/h2>/);
    assert.match(pageSource, /<h2>Store details<\/h2>[\s\S]*?store\.description[\s\S]*?store\.location[\s\S]*?store\.email[\s\S]*?store\.phone/);
    assert.match(pageSource, /<h2>Web domains<\/h2>[\s\S]*?website\.hostname/);
    assert.match(pageSource, /profile-page-websites[\s\S]*?Domain: <a[\s\S]*?Browse web[\s\S]*?data-delete-website/);
    assert.match(pageSource, /href="\/account\/profile\/webs\/\$\{encodeURIComponent\(website\.id\)\}" data-route="\/account\/profile\/webs\/\$\{encodeURIComponent\(website\.id\)\}"/);
    assert.match(pageSource, /data-manage-website="\$\{AppUtils\.escapeHTML\(website\.id\)\}">Manage this web/);
    assert.match(pageSource, /Showing inventory for[\s\S]*?activeTenant\.name[\s\S]*?Switch website/);
    assert.match(pageSource, /const manageWebsite = e\.target\.closest\("\[data-manage-website\]"\)[\s\S]*?this\.setActiveTenantCatalog\([\s\S]*?this\.navigate\("\/account"\)/);
    assert.match(pageSource, /websiteSettingsScreen[\s\S]*?Edit store details[\s\S]*?data-edit-website[\s\S]*?Edit website design[\s\S]*?Delete web/);
    assert.match(pageSource, /const \[sectionId, \.\.\.sectionRouteParts\] = requestedSection\.split\("\/"\)/);
    assert.match(pageSource, /cloudflareRequest\(`\/api\/tenants\/\$\{encodeURIComponent\(tenantId\)\}`, \{\s*method: "DELETE"/);
    assert.match(pageSource, /ESHOP_PRIVACY_POLICY_AGREED_V1[\s\S]*?Privacy Policy[\s\S]*?id="privacy-policy-agreement" type="checkbox" \$\{privacyAgreement \? "checked" : ""\}/);
    assert.match(pageSource, /Current version[\s\S]*?1\.0\.0[\s\S]*?No recent version history is available[\s\S]*?Current version details/);
    assert.match(pageSource, /accountsScreen[\s\S]*?Delete account[\s\S]*?Add new account[\s\S]*?href="\/account\/web\/themes" data-route="\/account\/web\/themes"/);
    assert.match(pageSource, /linkedDevicesScreen[\s\S]*?Cloud POS sync[\s\S]*?Cloudflare account[\s\S]*?\/pos\/more\/settings[\s\S]*?Connect another device[\s\S]*?same shop account/);
    assert.match(posSource, /BrowserMultiFormatReader/);
    assert.match(posSource, /BrowserMultiFormatReader/);
    assert.match(posSource, /seedCatalogueSync/);
    assert.match(pageSource, /bindEvents\(\)\s*\{[\s\S]*?document\.addEventListener\("click", async \(e\) => \{[\s\S]*?const deleteWebsite = e\.target\.closest\("\[data-delete-website\]"\)[\s\S]*?await this\.cloudflareRequest/);
    assert.match(pageSource, /const href = section\.route \|\| `\/account\/profile\/\$\{section\.id\}`[\s\S]*?data-route="\$\{href\}"/);
    assert.match(pageSource, /\.profile-sidebar-logout\s*\{[^}]*margin-top:\s*auto/);
    assert.match(pageSource, /class="profile-sidebar-logout" href="\/" data-route="\/" data-home-screen aria-label="Log out"[\s\S]*?<span>Log out<\/span>/);
    assert.match(pageSource, /path === "\/account\/profile" \|\| path\.startsWith\("\/account\/profile\/"\)[\s\S]*?renderProfileScreen\(path\)/);
    assert.match(pageSource, /renderWeb\(\)\s*\{\s*return StudioRenderers\.renderMainShopWorkspace\("\/account\/web"\);/);
    assert.match(pageSource, /webStudioNavigation\(\)[\s\S]*?title: "Dashboard"[\s\S]*?title: "Store"[\s\S]*?title: "CRM"[\s\S]*?title: "Websites"[\s\S]*?title: "Payments"/);
    assert.match(pageSource, /title: "Overview"[\s\S]*?title: "Visits"[\s\S]*?title: "Traffic"[\s\S]*?title: "Performance"[\s\S]*?title: "Product intelligence"/);
    assert.match(pageSource, /title: "Products"[\s\S]*?title: "Categories"[\s\S]*?title: "Inventory"[\s\S]*?title: "Orders and bookings"/);
    assert.match(pageSource, /title: "Repeat customers and point sets"[\s\S]*?title: "Newsletter"[\s\S]*?title: "Notifications"/);
    assert.match(pageSource, /title: "Web editor"[\s\S]*?title: "Webmaker"[\s\S]*?title: "Page editor"/);
    assert.match(pageSource, /aria-label="Web Studio sections"[\s\S]*?sections\.map\(section =>/);
    assert.match(pageSource, /<header class="studio-workspace-heading">[\s\S]*?class="studio-workspace-back" href="\/" data-route="\/" data-home-screen aria-label="Back to Craft home"[\s\S]*?class="studio-workspace-tab-title">\$\{AppUtils\.escapeHTML\(page\.title\)\}<\/h1>/);
    assert.doesNotMatch(pageSource, /<span class="studio-workspace-kicker">CRAFT<\/span><h1>Web Studio<\/h1>/);
    assert.match(pageSource, /path === "\/account\/web" \|\| path\.startsWith\("\/account\/web\/studio\/"\)[\s\S]*?renderMainShopWorkspace\(path\)/);
    assert.match(pageSource, /renderMainShopContent\(page\.contentPath, snapshot, true\)/);
    assert.match(pageSource, /CUSTOMER NOTIFICATIONS[\s\S]*?data-enable-notifications[\s\S]*?data-disable-notifications/);
    assert.match(pageSource, /websiteThemes\(\)[\s\S]*?website_themes[\s\S]*?preview_catalog[\s\S]*?SQLiteEngine\.save\(\)/);
    assert.match(pageSource, /renderWebsiteThemeChoices\(\)[\s\S]*?data-theme-preview-direct="1"[\s\S]*?data-theme-preview-remote="\$\{AppUtils\.escapeHTML\(theme\.preview_url \|\| ""\)\}"/);
    assert.match(pageSource, /renderWebsiteTheme\(themeId\)[\s\S]*?const useThemeRoute = `\/account\/web\/site\?new=1&edit=1&theme=\$\{encodeURIComponent\(theme\.id\)\}`;[\s\S]*?theme\.studio_url \? "Open this theme’s Studio →" : "Use this theme →"[\s\S]*?data-theme-preview-direct="1"[\s\S]*?data-theme-preview-remote="\$\{AppUtils\.escapeHTML\(theme\.preview_url \|\| ""\)\}"/);
    assert.match(pageSource, /activeThemePreviewLoads < 2/);
    assert.match(pageSource, /new IntersectionObserver\(entries => \{[\s\S]*?themePreviewObserver\.observe\(frame\)/);
    assert.doesNotMatch(pageSource.match(/renderWebsiteThemeChoices\(\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteTheme\(/)?.[1] || "", /src="\/builder-storefront\.html\?builder=1&theme-preview=1"/);
    assert.doesNotMatch(pageSource.match(/renderWebsiteTheme\(themeId\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteEditor/)?.[1] || "", /src="\/builder-storefront\.html\?builder=1&theme-preview=1"/);
    const themeCatalog = await readFile(new URL('../src/theme-catalog.js', import.meta.url), 'utf8');
    const themeBootstrap = await readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8');
    assert.equal((themeCatalog.match(/preview_url:/g) || []).length, 2);
    assert.match(themeCatalog, /id: "storefront-engine"[\s\S]*?preview_url: "\/theme-packages\/storefront-engine\/index\.html"[\s\S]*?studio_url: "\/theme-packages\/storefront-engine\/studio\.html"/);
    assert.match(themeBootstrap, /EshopWebsiteThemeCatalog = WEBSITE_THEME_CATALOG/);
    assert.match(pageSource, /data-theme-preview-remote/);
    assert.match(pageSource, /loadHostedThemePreview[\s\S]*?fillThemeForShop\(theme\.id, catalog/);
    const themePreviewSetup = pageSource.match(/const themePreviewFrames = \[\.\.\.document\.querySelectorAll\("\[data-theme-storefront-preview\]"\)\][\s\S]*?const storefrontFrame =/)?.[0];
    assert.ok(themePreviewSetup, "Theme previews should have an isolated catalog initialization path.");
    assert.match(themePreviewSetup, /products: draft\.products,\s*categories: draft\.categories/);
    assert.doesNotMatch(pageSource, /Preview the full live storefront, including its products and working navigation\./);
    assert.match(sqliteSource, /'tenant_catalogs','website_themes'/);
    const accountsMigration = await readFile(new URL('../cloudflare/migrations/0004_accounts.sql', import.meta.url), 'utf8');
    assert.match(accountsMigration, /CREATE TABLE IF NOT EXISTS accounts/);
    assert.match(accountsMigration, /password_salt TEXT NOT NULL/);
    assert.match(accountsMigration, /password_hash TEXT NOT NULL/);
    assert.match(accountsMigration, /CREATE TABLE IF NOT EXISTS account_tenants/);
    assert.match(pageSource, /website_themes:\s*\[\]/);
    assert.match(originalStorefront, /get\("theme-preview"\)\s*===\s*"1"[\s\S]*?ESHOP_THEME_PREVIEW_DB_V1/);
    assert.match(pageSource, /renderWebsiteEditor\(isNewWebsite = false\)[\s\S]*?grid-template-columns:minmax\(0,1fr\)[\s\S]*?Website preview canvas[\s\S]*?width:min\(360px,calc\(100vw - 16px\)\)[\s\S]*?Local draft storefront preview[\s\S]*?width:150%;height:150%[\s\S]*?transform:scale\(\.666667\)[\s\S]*?Website editing controls/);
    assert.match(pageSource, /postRenderSetup\(path, params\) \{[\s\S]*?path === "\/account\/web\/site"[\s\S]*?this\.bindWebsiteBuilderEvents\(\)/);
    assert.match(pageSource, /const loadStore = document\.getElementById\("website-wizard-load-store"\);\s*if \(loadStore\) loadStore\.onclick = async/);
    assert.match(pageSource, /<section aria-label="Website editing controls"[^>]*padding:5px 10px 0/);
    assert.match(pageSource, /id="builder-editor-status"[^>]*margin:4px 2px 0;min-height:14px/);
    assert.match(pageSource, /builder-primary-color[\s\S]*?builder-background-color[\s\S]*?builder-text-color[\s\S]*?builder-font-family/);
    assert.match(pageSource, /role="toolbar"[\s\S]*?overflow-x:auto[\s\S]*?touch-action:pan-x[\s\S]*?flex:0 0 82px/);
    assert.match(pageSource, /builder-preview-loading[\s\S]*?builder-preview-reload/);
    assert.match(pageSource, /const width = Math\.min\(280, availableWidth, availableHeight \* 9 \/ 19\)/);
    assert.match(pageSource, /\["colors", "◉", "Color"\][\s\S]*?\["background", "▧", "Background"\][\s\S]*?\["text", "T", "Text color"\][\s\S]*?\["fonts", "Aa", "Fonts"\][\s\S]*?\["brand", "●", "Brand"\][\s\S]*?\["words", "✎", "Edit words"\]/);
    assert.match(pageSource, /data-editor-tab="\$\{id\}" aria-pressed="false"[^>]*background:transparent;color:#b4b4bb/);
    assert.match(pageSource, /data-editor-panel="colors" hidden/);
    assert.match(pageSource, /min-height:0;max-height:126px;overflow:auto;padding:5px 2px 0/);
    assert.doesNotMatch(pageSource, /\["pages", "▤", "Pages"\]|data-editor-panel="pages"/);
    assert.match(pageSource, /const selectedPanel = selectedTool === "brand" \? "colors" : selectedTool/);
    assert.match(pageSource, /id="builder-elements-toggle" type="checkbox" role="switch" aria-label="Enable element editing"/);
    assert.match(pageSource, /target\.closest\("button,input,select,textarea,summary,\[role='button'\],\[role='menuitem'\],\[data-action\],\[onclick\]"\)\) return;/);
    assert.match(pageSource, /if \(link && \(link\.closest\("nav,footer"\) \|\| link\.getAttribute\("href"\)\.startsWith\("#"\)\)\) return;/);
    assert.match(pageSource, /id="builder-select-whole-structure" type="checkbox"[\s\S]*?Select and move the whole section or hero group/);
    assert.match(pageSource, /id="builder-text-edit-sheet" aria-label="Edit text" aria-modal="true" role="dialog" hidden/);
    assert.match(pageSource, /id="builder-text-edit-input" aria-label="Edit selected text"/);
    assert.match(pageSource, /id="builder-text-edit-cancel"[\s\S]*?id="builder-text-edit-save"/);
    assert.match(pageSource, /window\.visualViewport\?\.addEventListener\("resize", positionTextEditSheet\)[\s\S]*?window\.visualViewport\?\.addEventListener\("scroll", positionTextEditSheet\)/);
    assert.match(pageSource, /kind === "text"\) \{\s*showTextEditSheet\(selectedElementRecord\.text \|\| element\.textContent \|\| ""\)/);
    assert.match(pageSource, /textEditInput\.addEventListener\("input"[\s\S]*?selectedElementRecord\.text = textEditInput\.value[\s\S]*?selectedElement\.textContent = textEditInput\.value/);
    assert.doesNotMatch(pageSource, /contenteditable", "true"|builder-text-focus-layer|builder-text-focus-bar/);
    assert.match(pageSource, /id="builder-element-image" aria-label="Selected image URL"/);
    assert.match(pageSource, /id="builder-element-image-file" aria-label="Upload replacement image" type="file" accept="image\/\*"/);
    assert.match(pageSource, /id="builder-element-link" aria-label="Selected link URL"/);
    assert.match(pageSource, /id="builder-element-move-up"[\s\S]*?id="builder-element-move-down"[\s\S]*?id="builder-element-move-left"[\s\S]*?id="builder-element-move-right"/);
    assert.match(pageSource, /id="builder-element-delete-link"[^>]*>Delete link/);
    assert.match(pageSource, /id="builder-editor-tools-slot" style="position:relative"/);
    assert.match(pageSource, /id="builder-element-editor" hidden style="position:absolute;inset:0 0 auto;z-index:1;box-sizing:border-box;width:100%;max-height:148px;overflow:auto/);
    assert.match(pageSource, /<div id="builder-tools-home">[\s\S]*?Website editor tools[\s\S]*?data-editor-panel="words"/);
    assert.match(pageSource, /id="builder-element-rotate-left"[\s\S]*?id="builder-element-rotate-right"[\s\S]*?id="builder-element-delete"/);
    assert.match(pageSource, /previewDocument\.addEventListener\("click", editorClickHandler, true\)/);
    assert.match(pageSource, /element_edits: \[\.\.\.elementEdits\.values\(\)\]/);
    assert.match(pageSource, /syncElementEditsToCatalog\s*=\s*\(\)\s*=>[\s\S]*?SQLiteEngine\.updateStore\(\{\s*element_edits:/);
    assert.match(pageSource, /selectedElementRecord\.offsetX[\s\S]*?selectedElementRecord\.offsetY[\s\S]*?setElementOffset\(selectedElement/);
    assert.match(pageSource, /selectedElementRecord\.linkDeleted = true[\s\S]*?selectedLink\.remove\(\)/);
    assert.match(pageSource, /selectElement = \(element, kind, link\) => \{[\s\S]*?toolsSlot\.style\.minHeight = `\$\{toolsHome\.getBoundingClientRect\(\)\.height\}px`[\s\S]*?elementPanel\.hidden = false[\s\S]*?toolsHome\.hidden = true/);
    assert.match(pageSource, /builder-element-back[\s\S]*?clearElementSelection\(\)[\s\S]*?Editor tools\./);
    assert.doesNotMatch(pageSource, /storefrontFrame\.style\.filter = "blur/);
    assert.match(pageSource, /storefrontPreviewAttempts < 60[\s\S]*?window\.setTimeout\(initializeStorefrontPreview, 100\)/);
    assert.match(pageSource, /target\.closest\("\.hero-content,\.hero-slide,\.flagship-banner,\.flagship-card-overlay,\.campaign-inner,\.campaign-card/);
    assert.match(pageSource, /skippedPhotos[\s\S]*?edit\.kind === "image" && \/\^data:image\\\//);
    assert.match(pageSource, /uploads compressed images to the shop's image storage/);
    assert.match(pageSource, /builder-page-form[\s\S]*?Heading[\s\S]*?Words[\s\S]*?Save/);
    assert.match(pageSource, /id="btn-builder-save-design" title="Save design"[\s\S]*?id="btn-publish-cloudflare" title="Publish website"/);
    assert.match(pageSource, /renderWebsiteStoreEditor\(\)[\s\S]*?id="website-store-form"[\s\S]*?Store name[\s\S]*?Store description/);
    assert.match(pageSource, /if \(!appAccountSession\) \{[\s\S]*?const accountRoute = `\/app-account\?continue=\$\{encodeURIComponent\(continueTo\)\}`;[\s\S]*?Open app account/);
    assert.match(pageSource, /id="new-website-form"[\s\S]*?Shop \/ website name[\s\S]*?Website address[\s\S]*?Create website/);
    assert.doesNotMatch(pageSource.match(/if \(isNewWebsite\) \{([\s\S]*?)\n    \}\n    return `/)?.[1] || "", /data-shop-auth-mode|shop-turnstile-widget|Create account/);
    assert.match(pageSource, /path === "\/account\/web\/themes"/);
    assert.match(pageSource, /path\.startsWith\("\/account\/web\/themes\/"\)/);
    assert.match(pageSource, /path === "\/account\/web\/site"/);
    assert.doesNotMatch(pageSource, /data-use-website-theme/);
    assert.match(pageSource, /data-edit-website/);
    assert.match(pageSource, /data-edit-store/);
    assert.match(pageSource, /pages: SQLiteEngine\.getPages\(\)/);
    assert.match(pageSource, /SQLiteEngine\.updateStore\(\{\s*primary_color,\s*background_color,\s*text_color,\s*font_family,\s*element_edits:/);
    assert.match(pageSource, /newWebsiteForm\.onsubmit = async event =>/);
    assert.match(pageSource, /Website setup uses your Craft app account/);
    assert.match(pageSource, /this\.cloudflareRequest\("\/api\/tenants"[\s\S]*?sessionToken/);
    assert.match(pageSource, /continueTo\.startsWith\("\/account\/web\/site\?new=1&theme="\)[\s\S]*?this\.navigate\(continueTo\)/);
    assert.match(pageSource, /preview_appearance:\s*\{\s*primary_color:\s*"#18181B"/);
    assert.match(pageSource, /primary_color:\s*"#18181B",\s*background_color:\s*"#FAFAF8",\s*text_color:\s*"#18181B"/);
    assert.match(pageSource, /api\/auth\/session[\s\S]*?Your account session expired\. Sign in again to continue; you do not need to create another account/);
    assert.match(cloudflareWorkerSource, /const verification = await verifyTurnstile\(request, env, input\.turnstile_token\)/);
    assert.match(cloudflareWorkerSource, /if \(!verification\.ok\)/);
    assert.match(pageSource, /appearance:\s*"always"[\s\S]*?window\.turnstile\.render\(widget/);
    assert.match(pageSource, /callback\(token\) \{\s*turnstileToken = token;\s*accountError\.hidden = true;[\s\S]*?if \(autoSubmitEnabled && !authSubmitting\) appAccountForm\.requestSubmit\(submitButton\)/);
    assert.match(pageSource, /This account already exists\. Sign in to keep using it—no new account is needed/);
    assert.match(pageSource, /\.store-design-options\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
    assert.match(pageSource, /@media \(max-width:\s*600px\)[\s\S]*?\.store-design-options\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.match(pageSource, /\.store-color-options\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
    assert.match(pageSource, /@media \(max-width:\s*600px\)[\s\S]*?\.store-color-options\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    assert.match(pageSource, /name: "White", value: "#FFFFFF"/);
    assert.match(pageSource, /name: "Home blue", value: "#244EE8"/);
    assert.match(pageSource, /name: "Sky blue", value: "#0284C7"/);
    assert.match(pageSource, /name: "Teal", value: "#0F766E"/);
    assert.match(pageSource, /name: "Violet", value: "#7C3AED"/);
    assert.match(pageSource, /name: "Coral", value: "#E85D4F"/);
    assert.match(pageSource, /type="color" id="custom-store-color"/);
    assert.match(pageSource, /customColorRadio\.value = customColorInput\.value\.toUpperCase\(\);\s*customColorRadio\.checked = true/);
    assert.match(pageSource, /<h1 class="section-heading">Settings<\/h1>/);
    assert.doesNotMatch(pageSource, /These choices style your customer-facing website, not the Craft app\./);
    assert.match(pageSource, /<h3 class="form-card-title">App appearance<\/h3>/);
    assert.match(pageSource, /<span class="form-label">App accent color<\/span>/);
    assert.match(pageSource, /--launch-blue: var\(--accent\)/);
    assert.match(pageSource, /studioAppearanceKey\(\)/);
    assert.match(pageSource, /getStudioAppearance\(\)/);
    assert.match(pageSource, /window\.localStorage\.setItem\(this\.studioAppearanceKey\(\), JSON\.stringify\(appearance\)\)/);
    assert.match(pageSource, /settingsForm\.addEventListener\("change", \(\) => this\.applyThemeSettings\(selectedAppearance\(\)\)\)/);
    assert.match(pageSource, /applyThemeSettings\(appearance = this\.getStudioAppearance\(\)\)\s*\{\s*const themeTarget = document\.documentElement;[\s\S]*?themeTarget\.style\.setProperty\("--accent", appearance\.primary_color\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--bg", "#FFFFFF"\)/);
    assert.match(pageSource, /const foreground = isWhiteAccent \|\| !isDarkAccent \? "#18181B" : "#FFFFFF"/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface", "#FFFFFF"\)/);
    assert.match(pageSource, /const isWhiteAccent = appearance\.primary_color\.toUpperCase\(\) === "#FFFFFF"/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-subtle", "#F5F5F5"\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-hover", "#EBEBEB"\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--border", "#E2E2E5"\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--text-main", foreground\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--text-muted", isWhiteAccent \? "#666660"/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--accent-hover", isWhiteAccent \? "#F4F4F5"/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-subtle"/);
    assert.match(pageSource, /\.navbar\s*\{[^}]*background-color:\s*var\(--surface\)/);
    assert.match(pageSource, /themeTarget\.style\.setProperty\("--surface-hover"/);
    assert.match(pageSource, /--font-display: Impact, Haettenschweiler, "Arial Narrow", "sans-serif-condensed", sans-serif/);
    assert.match(pageSource, /font-family: var\(--font-display\)/);
    assert.doesNotMatch(pageSource, /name="fontFamily"|Typography<\/label>/);
    const appearanceStart = pageSource.indexOf("  applyThemeSettings(appearance = this.getStudioAppearance()) {");
    const appearanceEnd = pageSource.indexOf("  setAppShellTheme(", appearanceStart);
    const appearanceMethod = pageSource.slice(appearanceStart, appearanceEnd);
    assert.doesNotMatch(appearanceMethod, /--font-main|--font-serif|--font-display/);
    assert.match(pageSource, /input\[type="radio"\][\s\S]*?accent-color: var\(--accent\)/);
    assert.match(pageSource, /body\.app-shell #app\s*\{[^}]*background-color:\s*var\(--bg\)/);
    assert.match(pageSource, /setAppShellTheme\(path, params = new URLSearchParams\(\)\)[\s\S]*?path === "\/pos" \|\| path\.startsWith\("\/pos\/"\)/);
    assert.match(pageSource, /this\.setAppShellTheme\(path, params\)/);
    assert.match(pageSource, /forEach\(property => document\.documentElement\.style\.removeProperty\(property\)\)/);
    assert.match(pageSource, /cacheActiveTenantCatalog\(\);[\s\S]*?AppUtils\.showToast\("App appearance saved/);
    assert.match(originalStorefront, /root\.style\.setProperty\("--radius-lg", largeRadius\)/);
    assert.match(originalStorefront, /minimal:\s*\["4px",\s*"2px",\s*"6px"\]/);
    assert.match(originalStorefront, /root\.style\.setProperty\("--accent-hover", hoverColor\)/);
    assert.match(originalStorefront, /root\.style\.setProperty\("--accent-light", lightColor\)/);
    assert.match(originalStorefront, /root\.style\.setProperty\("--accent-contrast", luminance > 0\.179 \? "#18181B" : "#FFFFFF"\)/);
    assert.match(pageSource, /async loadTenantCatalog\(tenant\)/);
    const seedInitialSource = pageSource.match(/seedInitial\([\s\S]*?\n  \},\n\n  save\(\)/)?.[0];
    assert.ok(seedInitialSource);
    assert.doesNotMatch(seedInitialSource, /btn-provision-main-owner/);
    assert.match(pageSource, /initTenantManager\(\)[\s\S]*?getElementById\("btn-provision-main-owner"\)/);
    assert.match(pageSource, /private=1/);
    assert.match(pageSource, /tenant_catalogs/);
    assert.match(pageSource, /"Authorization":/);
    assert.match(pageSource, /const accountSession = tenant\.id === "main" \? "" : window\.localStorage\.getItem\("ESHOP_ACCOUNT_SESSION_V1"\)/);
    assert.match(pageSource, /images:\s*Array\.isArray\(product\.images\)[\s\S]*?\^data:image\\\//);
    assert.match(originalStorefront, /await this\.loadCloudflareCatalog\(\)/);
    assert.match(originalStorefront, /fetch\("\/api\/catalog"/);
    assert.match(cloudflareWorkerSource, /url\.pathname === "\/api\/catalog"/);
    assert.match(cloudflareWorkerSource, /PUBLISH_TOKEN/);
    assert.match(cloudflareWorkerSource, /catalog_snapshots/);
    assert.match(cloudflareWorkerSource, /tenantIdFromRequest/);
    assert.match(cloudflareWorkerSource, /api\/tenants/);
    assert.match(cloudflareWorkerSource, /__ESHOP_CLOUDFLARE_STOREFRONT__ = true/);
    assert.match(pageSource, /\.pos-overview-controls\s*\{[^}]*display:\s*flex[^}]*gap:\s*8px/);
    assert.match(pageSource, /navigate\(path,\s*openWorkspaceHome\s*=\s*false\)/);
    assert.match(pageSource, /this\.navigate\(route,\s*link\.hasAttribute\("data-home-screen"\)\)/);
    assert.match(pageSource, /class="brand-logo studio-module-brand studio-module-back" data-route="\/" data-home-screen aria-label="Back to Craft home"/);
    assert.match(pageSource, /class="brand-logo" data-route="\$\{storefrontHome\}" \$\{options\.builderPreview \? "" : "data-home-screen"\} aria-label="Craft home"/);
    assert.match(pageSource, /\.studio-module-navbar \.studio-profile-btn\s*\{[^}]*border-radius:\s*50%[^}]*background:\s*#000[^}]*color:\s*#fff/);
    assert.match(pageSource, /\.workspace-menu\s*\{[^}]*margin-left:\s*auto/);
    assert.match(pageSource, /\.pos-ranges\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto[^}]*touch-action:\s*pan-x/);
    assert.match(pageSource, /\.pos-overview-card\s*\{[^}]*min-height:\s*260px[^}]*border:\s*0[^}]*background:\s*#111/);
    assert.match(pageSource, /body\.craft-app-ui #app \.pos-overview-card\s*\{[^}]*background-color:\s*#111 !important;[^}]*color:\s*#fff !important;/);
    assert.match(pageSource, /\.pos-overview-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(pageSource, /\.pos-overview-metrics\s*\{[^}]*align-content:\s*space-between/);
    assert.match(pageSource, /\.pos-overview-metric:nth-child\(even\)\s*\{[^}]*text-align:\s*right/);
    assert.match(pageSource, /\.pos-revenue-card\s*\{[^}]*min-height:\s*320px/);
    assert.match(pageSource, /\.pos-revenue-chart-line\s*\{[^}]*stroke:\s*var\(--accent\)/);
    assert.match(pageSource, /\.pos-bottom-nav\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(pageSource, /\.pos-bottom-nav \.pos-tab\s*\{[^}]*flex-direction:\s*column/);
    assert.match(pageSource, /\.pos-bottom-nav \.pos-tab\.is-active\s*\{[^}]*background:\s*#ededee !important/);
    assert.match(pageSource, /\.pos-payment-option\s*\{[^}]*min-height:\s*36px/);
    assert.match(pageSource, /\.pos-customer-fields input\s*\{[^}]*min-height:\s*30px/);
    assert.match(pageSource, /\.pos-checkout-actions \.btn-primary,[\s\S]*?height:\s*30px/);
    assert.match(pageSource, /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.pos-product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
    assert.match(sqliteSource, /'store','categories','products','pages'/);
    assert.match(sqliteSource, /ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1/);
    assert.match(pageSource, /getPages\(publishedOnly = false\)/);
    assert.match(pageSource, /savePage\(data\)/);
    assert.match(pageSource, /deletePage\(id\)/);
    assert.doesNotMatch(pageSource, /href="\/account\/web\/pages" class="btn-secondary" data-route="\/account\/web\/pages">Manage Pages/);
    assert.match(pageSource, /id="page-editor-form"/);
    assert.match(pageSource, /path === "\/account\/web\/pages"[\s\S]*?renderPagesManager\(\)/);
    assert.match(pageSource, /path\.startsWith\("\/pages\/"\)[\s\S]*?renderCustomPage\(slug\)/);
    assert.match(pageSource, /SQLiteEngine\.getPages\(true\)/);
    assert.match(pageSource, /AppUtils\.escapeHTML\(page\.content \|\| ""\)\.replace/);
    assert.doesNotMatch(pageSource, /title: "Store Viewer"/);
    assert.match(pageSource, /renderStudioStore\(\)[\s\S]*?return this\.renderLiveWeb\(\)/);
    assert.match(pageSource, /path === "\/web"\)\s*\{\s*html = StudioRenderers\.renderLiveWeb\(\)/);
    assert.match(pageSource, /renderLiveWeb\(\)[\s\S]*?title="Complete customer-facing storefront"[\s\S]*?src="\/builder-storefront\.html\?builder=1"/);
    assert.match(pageSource, /height:\s*100dvh/);
    assert.match(pageSource, /name="imageFile"[^>]*accept="image\/\*"/);
    assert.match(pageSource, /Choose an image to save it in this device's SQLite catalog/);
    assert.match(pageSource, /images:\s*image\s*\?\s*\[image\]\s*:\s*\[\]/);
    assert.match(pageSource, /readProductImage\(file\)[\s\S]*?reader\.readAsDataURL\(file\)/);
    assert.match(pageSource, /selectedImage\.size > 5 \* 1024 \* 1024/);
    assert.match(pageSource, /const frameTop = Math\.max\(0,\s*storefrontFrame\.getBoundingClientRect\(\)\.top\)/);
    assert.doesNotMatch(pageSource, /observer\.observe\(frameDocument\.documentElement\)/);
    assert.doesNotMatch(pageSource, /previewWindow\.setBuilderNavigation/);
    assert.match(pageSource, /renderWebsiteEditor\([\s\S]*?data-editor-theme-url="\$\{AppUtils\.escapeHTML\(this\.websiteThemes\(\)\.find\(theme => theme\.id === selectedTheme\)\?\.preview_url \|\| ""\)\}" src="about:blank"/);
    assert.match(pageSource, /previewWindow\.setBuilderCatalog\(\{[\s\S]*?products:\s*SQLiteEngine\.select\("products"[\s\S]*?categories:\s*SQLiteEngine\.getCategories\(\)[\s\S]*?store:\s*SQLiteEngine\.getStore\(\)/);
    assert.match(pageSource, /window\.EshopBuilderSqlite = \{[\s\S]*?saveProduct:[\s\S]*?deleteProduct:[\s\S]*?saveCategory:[\s\S]*?deleteCategory:[\s\S]*?updateInventoryStock:/);
    assert.match(pageSource, /await window\.ShopSQLite\.flush\(\)/);
    assert.match(originalStorefront, /window\.applyBuilderElementEdits = edits =>/);
    assert.match(originalStorefront, /window\.applyBuilderElementEdits\(SQLiteEngine\.getStore\(\)\.element_edits\)/);
    assert.match(originalStorefront, /eshop-builder-offset-x[\s\S]*?element\.style\.translate[\s\S]*?edit\.linkDeleted/);
    assert.match(originalStorefront, /Object\.entries\(step\)\.every\(\(\[key, value\]\) => currentLineage\[index\]\[key\] === value\)/);
    assert.match(originalStorefront, /const findByLineage = lineage =>/);
    assert.match(originalStorefront, /"text", "image", "icon", "link"/);
    assert.match(pageSource, /await this\.ensureBuilderCatalogImported\(\)/);
    assert.match(pageSource, /async ensureBuilderCatalogImported\(\)[\s\S]*?builder=1&catalog-import=1/);
    assert.match(pageSource, /async importBuilderCatalogIfEmpty\(previewWindow\)[\s\S]*?savedProducts\.length !== catalog\.products\.length/);
    assert.match(pageSource, /if \(SQLiteEngine\.select\("products"\)\.length \|\| SQLiteEngine\.getCategories\(\)\.length \|\|/);
    assert.match(pageSource, /existingIds = new Set\(SQLiteEngine\.getCategories\(\)\.map\(item => item\.id\)\)/);
    assert.match(pageSource, /!existingIds\.has\(item\.id\) && item\.name === category\.name/);
    assert.match(pageSource, /categoryIds\.set\(category\.id, savedCategory\.id\)/);
    assert.match(pageSource, /await SQLiteEngine\.resetBuildYourWebDataOnce\(\)/);
    assert.match(pageSource, /resetBuildYourWebDataOnce\(\)[\s\S]*?this\.db\.tables\.pages = \[\][\s\S]*?this\.updateStore\(/);
    assert.doesNotMatch(pageSource, /resetBuildYourWebDataOnce\(\)[\s\S]*?this\.db\.tables\.(?:products|categories)\s*=/);
    assert.match(originalStorefront, /<section class="hero-section" id="hero-carousel-section">/);
    assert.match(originalStorefront, /class="footer-grid"/);
    assert.match(originalStorefront, /categories\.map\(category =>[\s\S]*?categoryRoute\(category\)[\s\S]*?publishedPages\.map/);
    assert.match(originalStorefront, /publishedPages\.length \?[\s\S]*?Pages/);
    assert.doesNotMatch(originalStorefront, /Account &amp; Store Studio|All Collections \(11\)|Carbon-Neutral Certified|Encrypted 256-bit Checkout/);
    assert.match(originalStorefront, /data-eshop-floating-contacts/);
    assert.match(originalStorefront, /window\.setBuilderCatalog = \(catalog\) =>/);
    assert.match(originalStorefront, /getPages\(publishedOnly = false\)/);
    assert.match(originalStorefront, /getPageBySlug\(slug, publishedOnly = false\)/);
    assert.match(originalStorefront, /\.builder-preview #main-navbar \.btn-studio-pill\s*\{\s*display:\s*none !important;/);
    assert.doesNotMatch(originalStorefront, /\.builder-preview #main-navbar \.mobile-menu-btn,[\s\S]*?display:\s*none !important/);
    assert.doesNotMatch(originalStorefront, /\.builder-preview #main-navbar \.brand-logo,[\s\S]*?display:\s*none !important/);
    assert.match(originalStorefront, /document\.documentElement\.classList\.add\("builder-preview"\)/);
    assert.match(originalStorefront, /navigate\(path\) \{\s*\/\* Hash routing:/);
    assert.match(originalStorefront, /created = await persistBuilderCatalogChange\("createOrder", orderData, cart\)/);
    assert.match(originalStorefront, /SQLiteEngine\.insert\("orders", created\);\s*SQLiteEngine\.clearCart\(\)/);
    assert.match(originalStorefront, /window\.getBuilderSeedCatalog = \(\) =>/);
    assert.match(originalStorefront, /root\.style\.setProperty\("--bg", background\)/);
    assert.match(originalStorefront, /root\.style\.setProperty\("--font-main", mainFont\)/);
    assert.match(originalStorefront, /path\.startsWith\("\/pages\/"\)[\s\S]*?getPageBySlug\(slug, false\)/);
    assert.match(originalStorefront, /catalog\.pages\) \? JSON\.parse\(JSON\.stringify\(catalog\.pages\)\)/);
    assert.match(originalStorefront, /async saveProduct\(data\) \{\s*if \(builderPreviewMode\) return persistBuilderCatalogChange\("saveProduct", data\)/);
    assert.match(originalStorefront, /async deleteProduct\(id\) \{\s*if \(builderPreviewMode\) return persistBuilderCatalogChange\("deleteProduct", id\)/);
    assert.match(originalStorefront, /saved = await SQLiteEngine\.saveProduct\(/);
    assert.match(originalStorefront, /storageKey: themePreviewMode \? "ESHOP_THEME_PREVIEW_DB_V1" : builderPreviewMode \? "ESHOP_BUILDER_PREVIEW_DB_V1" : "ESHOP_SQLITE_DB_V1"/);
    assert.match(originalStorefront, /if \(builderPreviewMode\) \{\s*this\.seedInitial\(\s*themePreviewMode \? seedCategories : \[\],\s*themePreviewMode \? seedProducts : \[\]/);
    assert.match(originalStorefront, /themePreviewMode && \(!catalog\.products\.length \|\| !catalog\.categories\.length\)/);
    assert.match(pageSource, /if \(!Array\.isArray\(theme\.preview_catalog\?\.products\) \|\| !theme\.preview_catalog\.products\.length/);
    assert.match(pageSource, /let attempts = 0;[\s\S]*?setTimeout\(initializeThemePreview, 100\)[\s\S]*?frame\.addEventListener\("load"/);
    assert.match(androidManifest, /android:allowBackup="true"[\s\S]*?android:fullBackupContent="@xml\/backup_rules"[\s\S]*?android:dataExtractionRules="@xml\/data_extraction_rules"/);
    assert.match(androidBackupRules, /<include domain="database" path="\." \/>/);
    assert.match(androidDataExtractionRules, /<cloud-backup>[\s\S]*?<include domain="database" path="\." \/>[\s\S]*?<\/cloud-backup>[\s\S]*?<device-transfer>[\s\S]*?<include domain="database" path="\." \/>/);
    assert.match(originalStorefront, /@media \(max-width: 600px\)[\s\S]*?\.products-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    assert.match(originalStorefront, /@media \(max-width: 600px\)[\s\S]*?\.product-card-thumb-link\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
    assert.match(originalStorefront, /@media \(max-width: 600px\)[\s\S]*?\.product-card-quick-add\s*\{[^}]*min-height:\s*34px/);
    assert.match(pageSource, /id="builder-storefront-html"[\s\S]*?title="Mobile-sized live website preview"/);
    assert.match(pageSource, /hostedTheme && previewDocument && previewWindow && routedHostedPreviewDocument !== previewDocument[\s\S]*?target\?\.closest\("a\[href\]"\)\?\.getAttribute\("href"\)\?\.trim\(\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopImmediatePropagation\(\)[\s\S]*?previewWindow\.location\.hash = href/);
    assert.doesNotMatch(pageSource, /Desktop view|Tablet view|Phone view|view-mode-desktop|view-mode-tablet|view-mode-mobile/);
    assert.match(pageSource, /const storefrontHome = options\.builderPreview \? "\/account\/store" : "\/"/);
    assert.match(pageSource, /<nav class="nav-menu">[\s\S]*publishedPages\.map/);
    assert.match(pageSource, /renderFooter\(\)\s*\{\s*return `\s*<footer class="footer">/);
    assert.doesNotMatch(pageSource, /THE HOUSE|Account Portal|Storefront Viewer|Studio Analytics|Atelier Plans/);
    assert.match(pageSource, /<!-- Mobile Navigation Drawer -->/);
    assert.match(pageSource, /@media \(max-width:\s*768px\)[\s\S]*?\.navbar:not\(\.studio-module-navbar\) \.nav-center\s*\{[^}]*display:\s*block/);
    assert.doesNotMatch(pageSource, /studio-store-frame-wrapper|view-mode-desktop|view-mode-tablet|view-mode-mobile/);

    const submit = async (kind, values, formOptions = {}) => Promise.all(handlers.submit.map((handler) => handler({
      target: { closest: (selector) => selector === 'form[data-pos-form]'
        ? { dataset: { posForm: kind }, values, ...formOptions } : null },
      preventDefault() {}
    })));
    const click = async (action, attributes = {}) => Promise.all(handlers.click.map((handler) => handler({
      target: { closest: (selector) => selector === '[data-pos-action]' ? { dataset: { posAction: action, ...attributes } } : null }
    })));

    let focusedRequiredField = '';
    const missingPriceStatus = { textContent: '' };
    await submit('product', {
      id: '0', name: 'Unpriced sample', categoryId: '1', price: '', stock: '2'
    }, {
      elements: { price: { name: 'price', focus() { focusedRequiredField = 'price'; }, scrollIntoView() {} } },
      querySelector(selector) {
        return selector === '[data-product-submit-status]' ? missingPriceStatus : null;
      }
    });

    assert.equal(focusedRequiredField, 'price');
    assert.match(missingPriceStatus.textContent, /selling price/i);
    assert.match(toast.textContent, /selling price/i);
    assert.equal(queryRows("SELECT COUNT(*) AS count FROM pos_products WHERE name='Unpriced sample'")[0].count, 0);
    await submit('product', {
      id: '0', name: 'Canvas Tote', categoryId: '1', price: '18.50',
      buyingPrice: '7.25', stock: '4', barcode: '123456789012', expiryDate: '2027-04-15', imageUri: ''
    });
    assert.match(root.innerHTML, /Canvas Tote/, toast.textContent);
    assert.equal(queryRows('PRAGMA table_info(pos_products)').some((column) => column.name === 'barcode'), true);
    assert.equal(queryRows('SELECT barcode FROM pos_products WHERE id=1')[0].barcode, '123456789012');
    assert.equal(queryRows('SELECT expiry_date FROM pos_products WHERE id=1')[0].expiry_date, '2027-04-15');
    assert.equal((await app.findProductByCode('123456789012')).id, 1);
    assert.equal((await app.findProductByCode('ESHOP-UNKNOWN')), null);
    assert.match(app.render('/pos/catalogue/inventory'), /aria-label="Edit Canvas Tote"/);
    const editMarkup = app.render('/pos/catalogue/products', new URLSearchParams('edit=1'));
    assert.match(editMarkup, /<h3>Edit product<\/h3>[\s\S]*?name="id" value="1"[\s\S]*?name="name" value="Canvas Tote"/);
    await submit('product', {
      id: '1', name: 'Canvas Tote', categoryId: '1', price: '18.50',
      buyingPrice: '7.25', stock: '4', barcode: '123456789012', expiryDate: '2027-04-15',
      imageUri: '', lowStockThreshold: '3', active: '1'
    });
    assert.equal(queryRows('SELECT name,price_cents FROM pos_products WHERE id=1')[0].name, 'Canvas Tote');
    assert.equal(queryRows('SELECT price_cents FROM pos_products WHERE id=1')[0].price_cents, 1850);
    await app.addScannedBarcode('123456789012');
    assert.match(root.innerHTML, /data-pos-quantity="1"/);
    await click('cancel-sale');
    const keyboardInput = {
      value: '123456789012',
      closest: (selector) => selector === '[data-pos-barcode-input]' ? keyboardInput : null
    };
    await handlers.keydown[0]({
      key: 'Enter', target: keyboardInput, preventDefault() {}
    });
    assert.match(root.innerHTML, /data-pos-quantity="1"/);
    await click('cancel-sale');
    await app.addScannedBarcode('UNKNOWN-987');
    assert.match(window.location.hash, /\/pos\/catalogue\/products\?new=1&barcode=UNKNOWN-987/);
    window.location.hash = '#/pos';
    await app.refresh();
    assert.match(app.render('/pos/inventory'), /Inventory/);
    assert.match(app.render('/pos/inventory'), /Sync details to active website draft/);

    await click('add-cart', { id: '1' });
    assert.doesNotMatch(root.innerHTML, /Current sale/);
    assert.match(root.innerHTML, /data-pos-quantity="1"/);
    assert.match(root.innerHTML, /data-method="Mobile money"/);
    assert.match(root.innerHTML, /data-method="Cash"/);
    assert.match(root.innerHTML, /data-method="Bank"/);
    assert.match(root.innerHTML, /data-method="Card"/);
    assert.match(root.innerHTML, /data-method="Other"/);
    assert.match(root.innerHTML, /pos-payment-logo/);
    assert.match(root.innerHTML, />Tax · 0%/);
    assert.doesNotMatch(root.innerHTML, /SMS|automatic matching/);
    await click('set-discount');
    assert.match(root.innerHTML, /role="dialog" aria-modal="true"/);
    await submit('discount', { discountAmount: '3.7' });
    assert.match(root.innerHTML, /Discount · 20%/);
    assert.match(root.innerHTML, /name="discount" value="3\.7"/);
    await click('set-discount');
    await submit('discount', { discountAmount: '500' });
    assert.match(toast.textContent, /no greater than the sale subtotal/i);
    assert.match(root.innerHTML, /Discount · 20%/);
    assert.match(root.innerHTML, /role="dialog" aria-modal="true"/);
    await click('close-discount');
    assert.doesNotMatch(root.innerHTML, /role="dialog" aria-modal="true"/);
    await handlers.change[0]({
      type: 'change',
      target: { value: '2', dataset: { posQuantity: '1' }, closest: (selector) =>
        selector === '[data-pos-quantity]' ? { value: '2', dataset: { posQuantity: '1' } } : null }
    });
    await app.refresh();
    assert.match(root.innerHTML, /value="2" aria-label="Quantity" data-pos-quantity="1"/);
    await click('checkout-method', { method: 'Card' });
    assert.match(root.innerHTML, /data-method="Card" aria-pressed="true"/);
    await click('cancel-sale');
    assert.match(root.innerHTML, /Your sale is empty/);
    assert.doesNotMatch(root.innerHTML, /data-pos-action="cancel-sale"/);

    await click('add-cart', { id: '1' });
    await handlers.change[0]({
      type: 'change',
      target: { value: '2', dataset: { posQuantity: '1' }, closest: (selector) =>
        selector === '[data-pos-quantity]' ? { value: '2', dataset: { posQuantity: '1' } } : null }
    });
    await app.refresh();
    await submit('checkout', { paymentMethod: 'Other', customerName: 'Sample Customer', customerPhone: '0700 000 001', dueDate: '', discount: '2' });
    const paidSale = queryRows('SELECT paid,total_cents,discount_cents FROM pos_sales')[0];
    assert.equal(paidSale.paid, 1);
    assert.equal(queryRows('SELECT payment_method FROM pos_sales')[0].payment_method, 'Other');
    assert.equal(paidSale.total_cents, 3500);
    assert.equal(paidSale.discount_cents, 200);
    assert.match(app.render('/pos/sales', new URLSearchParams('open=1')), /Subtotal \/ discount \/ tax/);
    const customerMarkup = app.render('/pos/customers');
    assert.match(customerMarkup, /Sample Customer/);
    assert.match(customerMarkup, /Revenue/);
    assert.equal(queryRows('SELECT stock_count FROM pos_products WHERE id=1')[0].stock_count, 2);
    assert.equal(window.location.hash, '#/pos');
    assert.match(root.innerHTML, /Your sale is empty/);
    assert.doesNotMatch(window.location.hash, /\/sales/);
    assert.equal((await app.listBusinessRecords('product', 'local')).find(product => product.name === 'Canvas Tote').stock, 2);
    await click('add-cart', { id: '1' });
    await submit('checkout', { paymentMethod: 'Card', customerName: 'Sample Customer', customerPhone: '0700 000 001', dueDate: '' });
    assert.equal((await app.listBusinessRecords('product', 'local')).find(product => product.name === 'Canvas Tote').stock, 1);
    const repeatCustomerInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    assert.match(repeatCustomerInsights, /Sample Customer/);
    assert.match(repeatCustomerInsights, /Repeat customers<\/strong><span>1/);
    assert.match(repeatCustomerInsights, /units in 30 days · consider about/);
    const overviewWithRevenue = app.render('/pos/overview');
    assert.match(overviewWithRevenue, /class="pos-card pos-revenue-card"/);
    assert.match(overviewWithRevenue, /aria-label="Net sales before tax over time"/);
    assert.match(overviewWithRevenue, /class="pos-revenue-chart-line"/);
    const insightMarkup = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    for (const heading of ['Needs attention', 'Sales trends', 'Revenue rhythm', 'Product performance', 'Category performance', 'Basket patterns', 'Customers', 'Busy days and hours', 'Recorded cost changes', 'Payment mix changes', 'Large-receipt review', 'Cash receipt review', 'Seasonality and selling periods', 'Data quality and confidence', 'Actionable recommendations', 'Goals and benchmarks', 'Priority alerts', 'Money and cash flow']) {
      assert.match(insightMarkup, new RegExp(`<h3>${heading}</h3>`));
    }
    assert.match(insightMarkup, /Top seller/);
    assert.match(insightMarkup, /Highest fully costed gross profit/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Profit&range=30d')), /Profit and loss/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Profit&range=30d')), /Break-even needs|Approximate revenue to cover/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Profit&range=30d')), /aria-label="Recorded operating profit over time"/);
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Stock&range=30d')), /Days cover/);
    await submit('revenue-goal', { amount: '100000' });
    assert.ok(queryRows("SELECT value FROM pos_settings WHERE key='monthly_revenue_goal_cents'")[0], toast.textContent);
    assert.equal(queryRows("SELECT value FROM pos_settings WHERE key='monthly_revenue_goal_cents'")[0].value, '10000000');
    const goalInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    assert.match(goalInsights, /Monthly net-sales target/);
    assert.match(goalInsights, /role="progressbar" aria-label="Monthly revenue goal progress"/);
    if (new Date().getDate() >= 7) {
      assert.match(goalInsights, /Monthly revenue goal is behind the current pace/);
    } else {
      assert.doesNotMatch(goalInsights, /Monthly revenue goal is behind the current pace/);
    }
    runSql("UPDATE pos_settings SET value='USD' WHERE key='currency'");
    await app.refresh();
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /saved goal is in KES while the store now uses USD/);
    runSql("UPDATE pos_settings SET value='KES' WHERE key='currency'");
    await app.refresh();
    runSql('UPDATE pos_products SET stock_count=0 WHERE id=1');
    await app.refresh();
    const alertInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d'));
    assert.match(alertInsights, /1 product out of stock/);
    const alertKey = /data-pos-action="snooze-alert" data-key="([^"]+)"/.exec(alertInsights)?.[1];
    assert.ok(alertKey);
    await click('dismiss-alert', { key: alertKey });
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /Restore 1 dismissed alert/);
    await click('restore-alerts');
    assert.match(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /1 product out of stock/);
    await click('snooze-alert', { key: alertKey });
    assert.doesNotMatch(app.render('/pos/overview', new URLSearchParams('tab=Insights&range=30d')), /1 product out of stock/);
    runSql('UPDATE pos_products SET stock_count=1 WHERE id=1');
    runSql("UPDATE pos_products SET sku='TOTE-1' WHERE id=1");
    runSql("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('shared_tenant_id','main')");
    runSql("INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES ('main','TOTE-1',100,'test')");
    const sharedSales = [];
    window.EshopInventoryBridge = {
      websites() { return [{ tenant_id: 'main', name: 'Main shop' }]; },
      async request(tenantId, action, method, body) {
        if (method === 'POST') sharedSales.push({ tenantId, action, method, body });
        return { ok: true, items: [] };
      }
    };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
    assert.match(pageSource, /\.pos-goal-track\s*\{[^}]*height:\s*7px/);
    assert.match(pageSource, /\.pos-insight-alert\.is-critical\s*\{/);
    assert.match(insightMarkup, /Repeat customers/);
    assert.match(insightMarkup, /Outstanding credit/);
    assert.match(insightMarkup, /Busiest day/);
    assert.match(insightMarkup, /Canvas Tote/);
    assert.match(pageSource, /\.pos-insights-dashboard\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    assert.match(pageSource, /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.pos-insights-dashboard\s*\{[^}]*grid-template-columns:\s*1fr/);

    window.location.hash = '#/pos';
    await app.refresh();
    await click('add-cart', { id: '1' });
    await click('checkout-method', { method: 'Mobile money' });
    assert.match(root.innerHTML, /Confirm the payment with the mobile-money provider before completing this sale/);
    await submit('checkout', { paymentMethod: 'Mobile money', customerName: '', customerPhone: '', dueDate: '' });
    const manuallyRecordedSale = queryRows("SELECT id,paid,payment_status,total_cents FROM pos_sales WHERE payment_method='Mobile money'")[0];
    assert.equal(manuallyRecordedSale.paid, 1);
    assert.equal(manuallyRecordedSale.payment_status, 'confirmed');
    assert.equal(manuallyRecordedSale.total_cents, 1850);
    const manualPayment = queryRows("SELECT mpesa_ref,sender_name,sender_phone FROM pos_sale_payments WHERE sale_id=?", [manuallyRecordedSale.id])[0];
    assert.equal(manualPayment.mpesa_ref, null);
    assert.equal(manualPayment.sender_name, null);
    assert.equal(manualPayment.sender_phone, null);
    assert.equal(queryRows("SELECT status FROM pos_inventory_queue")[0].status, 'pending');
    await app.refresh();
    assert.match(app.render('/pos/inventory'), /Offline: shared stock changes are saved locally and queued for D1 sync/);
    assert.equal(queryRows("SELECT stock FROM shared_inventory WHERE tenant_id='main' AND sku='TOTE-1'")[0].stock, 99);
    assert.match(toast.textContent, /shared stock sync pending/);
    globalThis.navigator.onLine = true;
    await handlers.online[0]();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await app.refresh();
    assert.equal(sharedSales.length, 1);
    assert.equal(sharedSales[0].tenantId, 'main');
    assert.equal(sharedSales[0].action, 'sale');
    assert.deepEqual(sharedSales[0].body.items, [{ sku: 'TOTE-1', quantity: 1 }]);
    assert.equal(queryRows("SELECT status FROM pos_inventory_queue")[0].status, 'synced');
    await app.recordSharedLocalSale('main', 'WEB-OFFLINE-1', [{ sku: 'TOTE-1', quantity: 2 }]);
    assert.equal(queryRows("SELECT stock FROM shared_inventory WHERE tenant_id='main' AND sku='TOTE-1'")[0].stock, 97);
    assert.equal(queryRows("SELECT status FROM pos_inventory_queue WHERE event_id='WEB-OFFLINE-1'")[0].status, 'pending');
    await handlers.online[0]();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(sharedSales.length, 2);
    assert.deepEqual(sharedSales[1].body.items, [{ sku: 'TOTE-1', quantity: 2 }]);
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_sale_payments')[0].count, 3);

    runSql(`INSERT INTO pos_sales
      (receipt_number,subtotal_cents,tax_cents,discount_cents,total_cents,currency,payment_method,paid,
       customer_name,customer_phone,due_date,payment_status,amount_paid_cents,created_at)
      VALUES ('MANUAL-PENDING',1850,0,0,1850,'KES','Mobile money',0,NULL,NULL,NULL,'pending',0,'2026-01-01T00:00:00.000Z')`);
    const manualPending = queryRows("SELECT id FROM pos_sales WHERE receipt_number='MANUAL-PENDING'")[0];
    await submit('payment', { saleId: String(manualPending.id), amount: '5', method: 'Mobile money' });
    assert.equal(queryRows('SELECT payment_status FROM pos_sales WHERE id=?', [manualPending.id])[0].payment_status, 'partial');
    await submit('payment', { saleId: String(manualPending.id), amount: '13.50', method: 'Mobile money' });
    assert.equal(queryRows('SELECT paid FROM pos_sales WHERE id=?', [manualPending.id])[0].paid, 1);

    window.location.hash = '#/pos/invoices?new=1';
    await app.refresh();
    await click('invoice-add', { id: '1' });
    await submit('invoice', {
      id: '0', customerName: 'Customer', customerContact: '',
      dueDate: '', notes: ''
    });
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_invoices')[0].count, 1);

    const date = new Date();
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    await submit('expense', {
      id: '0', date: dateValue, category: 'Supplies', label: 'Packaging',
      amount: '2.50', paymentMethod: 'Cash', note: ''
    });
    const savedExpense = queryRows('SELECT id FROM pos_expenses')[0];
    assert.ok(savedExpense, toast.textContent);
    const expenseId = savedExpense.id;
    await submit('expense', {
      id: String(expenseId), date: dateValue, category: 'Supplies', label: 'Updated packaging',
      amount: '3.50', paymentMethod: 'Cash', note: ''
    });
    assert.equal(queryRows('SELECT label,amount_cents FROM pos_expenses WHERE id=?', [expenseId])[0].label, 'Updated packaging');
    await submit('movement', { type: 'float_in', amount: '20', note: 'Opening float' });
    await submit('till', { date: dateValue, countedCash: '20' });
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_cash_movements')[0].count, 1);
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_till_closes')[0].count, 1);

    window.location.hash = '#/pos/instances';
    await app.refresh();
    await submit('instance', { name: 'Morning shift', mode: 'counted', durationMinutes: '60', startAt: '', endAt: '' });
    const instanceId = queryRows('SELECT id FROM pos_instances')[0].id;
    await click('instance-checkpoint', { id: instanceId });
    await click('instance-pause', { id: instanceId });
    await click('instance-resume', { id: instanceId });
    await click('instance-stop', { id: instanceId });
    assert.equal(queryRows('SELECT status FROM pos_instances WHERE id=?', [instanceId])[0].status, 'completed');

    for (let index = 0; index < 48; index += 1) {
      const monthOffset = Math.floor(index / 12) - 4;
      const day = index % 12 < 6 ? 3 : 25;
      const createdAt = new Date(date.getFullYear(), date.getMonth() + monthOffset, day, 12, 0, 0).toISOString();
      const receipt = `ANALYTICS-${index}`;
      const taxCents = index === 0 ? 200 : 0;
      const totalCents = 2000 + taxCents;
      runSql(`INSERT INTO pos_sales
        (receipt_number,subtotal_cents,tax_cents,total_cents,currency,payment_method,paid,customer_name,customer_phone,due_date,payment_status,amount_paid_cents,created_at)
        VALUES (?,2000,?,?,'KES','Cash',1,'History Customer','07000000002','','paid',?,?)`,
      [receipt, taxCents, totalCents, totalCents, createdAt]);
      const saleId = queryRows('SELECT id FROM pos_sales WHERE receipt_number=?', [receipt])[0].id;
      runSql(`INSERT INTO pos_sale_items (sale_id,product_id,name,quantity,unit_price_cents,unit_cost_cents,unit_cost_captured)
        VALUES (?,1,'Canvas Tote',1,2000,725,1)`, [saleId]);
      runSql(`INSERT INTO pos_sale_payments (sale_id,method,amount_cents,status,created_at)
        VALUES (?,'Cash',?,'confirmed',?)`, [saleId, totalCents, createdAt]);
    }
    await app.refresh();
    const deepHistoryInsights = app.render('/pos/overview', new URLSearchParams('tab=Insights&range=all'));
    assert.match(deepHistoryInsights, /Strongest month segment/);
    assert.match(deepHistoryInsights, /sales in 4 months/);
    assert.match(deepHistoryInsights, /A contribution group/);
    assert.match(deepHistoryInsights, /Loyal · 3\+ paid sales<\/strong><span>1/);
    const historicalProfit = app.render('/pos/overview', new URLSearchParams('tab=Profit&range=all'));
    assert.match(historicalProfit, /Tax on fully paid sales<\/span><b>KES\u00a02\.00/);

    const categoryId = queryRows('SELECT id FROM pos_categories ORDER BY id LIMIT 1')[0].id;
    const createdProductId = await app.saveProduct({
      name: 'Generated SKU test', categoryId, price: 12, buyingPrice: null, stock: 4, sku: '',
      lowStockThreshold: 7, active: false
    });
    const savedSku = queryRows('SELECT sku FROM pos_products WHERE id = ?', [createdProductId])[0].sku;
    assert.match(savedSku, /^ESHOP-[A-F0-9]{16}$/);
    assert.doesNotMatch(savedSku, /customer|phone|email/i);
    const generatedProduct = (await app.listProducts()).find(product => product.id === createdProductId);
    assert.equal(generatedProduct.name, 'Generated SKU test');
    assert.equal(generatedProduct.lowStockThreshold, 7);
    assert.equal(generatedProduct.active, false);
    assert.doesNotMatch(app.render('/pos'), /Generated SKU test/);

    const csvInput = {
      files: [{ async text() {
        return 'name,price,stock,category,sku,low_stock_threshold,active\nImported Item,2.5,8,CSV Category,CSV-1,4,false';
      } }],
      matches(selector) { return selector === '[data-pos-csv-import]'; },
      value: ''
    };
    await handlers.change[1]({
      target: { closest(selector) { return selector === '[data-pos-import], [data-pos-csv-import]' ? csvInput : null; } }
    });
    const importedProduct = (await app.listProducts()).find(product => product.sku === 'CSV-1');
    assert.equal(importedProduct.name, 'Imported Item');
    assert.equal(importedProduct.price, 2.5);
    assert.equal(importedProduct.stock, 8);
    assert.equal(importedProduct.lowStockThreshold, 4);
    assert.equal(importedProduct.active, false);
    assert.equal(csvInput.value, '');

    await submit('supplier', { id: '', name: 'Canvas Supply Co', phone: '+254700000000', email: 'orders@example.test', supplies: 'Canvas and bags' });
    const supplier = (await app.listBusinessRecords('supplier', 'local'))[0];
    assert.equal(supplier.name, 'Canvas Supply Co');
    assert.match(app.render('/pos/catalogue/suppliers'), /Purchase order/);
    const saleProduct = (await app.listProducts()).find(product => product.name === 'Canvas Tote');
    const stockBeforeReceipt = saleProduct.stock || 0;
    await submit('purchase', {
      supplierId: supplier.id, reference: 'INV-100', product1: saleProduct.sku,
      quantity1: '2', cost1: '8', product2: '', quantity2: '', cost2: '', product3: '', quantity3: '', cost3: ''
    });
    const purchase = (await app.listBusinessRecords('purchase', 'local'))[0];
    assert.equal(purchase.status, 'ordered');
    await click('receive-purchase', { recordId: purchase.id });
    assert.equal((await app.listBusinessRecords('purchase', 'local'))[0].status, 'received');
    assert.equal((await app.listProducts()).find(product => product.name === 'Canvas Tote').stock, stockBeforeReceipt + 2);
    assert.equal((await app.listBusinessRecords('product', 'local')).find(product => product.sku === saleProduct.sku).stock,
      stockBeforeReceipt + 2);

    window.location.hash = '#/pos';
    await app.refresh();
    promptValue = 'Hold for pickup';
    await click('add-cart', { id: String(saleProduct.id) });
    await click('park-ticket');
    const parked = (await app.listBusinessRecords('ticket', 'local'))[0];
    assert.equal(parked.name, 'Hold for pickup');
    assert.match(app.render('/pos/orders'), /Hold for pickup/);
    await click('resume-ticket', { recordId: parked.id });
    assert.match(root.innerHTML, /Canvas Tote/);
    await click('delete-ticket', { recordId: parked.id });
    assert.equal((await app.listBusinessRecords('ticket', 'local')).length, 0);
    assert.ok((await app.listCategories()).some(category => category.id === categoryId));
    assert.ok(Array.isArray(await app.listSales()));

    const source = await readFile(new URL('../src/pos.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /confirmPendingMpesaSalePayment|linkMpesaTransaction|pos_payment_links|smsParser/);
  } finally {
    db.close();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
    else delete globalThis.navigator;
    globalThis.FormData = oldFormData;
    globalThis.confirm = oldConfirm;
    globalThis.prompt = oldPrompt;
  }
});
