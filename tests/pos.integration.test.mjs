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
  assert.ok(receiveStart >= 0 && syncStart > receiveStart, 'Purchase receiving should have a bounded implementation.');
  assert.ok(checkoutStart >= 0 && paymentStart > checkoutStart, 'POS checkout should have a bounded implementation.');
  assert.match(receivePurchase, /const products = await listProducts\(\)[\s\S]*?await queueProduct\(product\)/);
  assert.match(checkout, /const productsAfterSale = await listProducts\(\)[\s\S]*?await queueProduct\(product\)/);
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
  assert.doesNotMatch(websiteSubmit, /await this\.applyWebsiteBuilderDraft/);
  assert.doesNotMatch(websiteSubmit, /savePaystackAccount|setPaystackDefault|paystackDetails/);
  assert.match(pageSource, /App-account Paystack payments/);
  assert.match(pageSource, /Every website registered to your app account will use this account at checkout/);
  assert.match(pageSource, /async bindPaystackReuseSetup\(container, tenantId\)[\s\S]*?setPaystackDefault\(/);
  assert.match(pageSource, /getPaystackDefault\(tenantId\)[\s\S]*?\/api\/payments\/paystack\/default/);
});

test('using a website theme follows the shared app route instead of a missing callback', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const themePreview = pageSource.match(/renderWebsiteTheme\(themeId\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteEditor/)?.[1];
  const themePreviewSetup = pageSource.match(/const themePreviewFrames = document\.querySelectorAll\("\[data-theme-storefront-preview\]"\);([\s\S]*?)const storefrontFrame =/)?.[1];
  const applyWebsiteDraft = pageSource.match(/async applyWebsiteBuilderDraft\(draft, themeId\) \{([\s\S]*?)\n  \},\n\n  cloudflareConnection/)?.[1];
  assert.ok(themePreview, 'Website theme preview should render in its own method.');
  assert.ok(themePreviewSetup, 'Theme previews should initialize from the post-render lifecycle.');
  assert.ok(applyWebsiteDraft, 'Applying the new website draft should be handled by the app controller.');
  assert.match(applyWebsiteDraft, /StudioRenderers\.websiteThemes\(\)\.find/);
  assert.doesNotMatch(applyWebsiteDraft, /this\.websiteThemes\(/);
  assert.match(themePreview, /const useThemeRoute = `\/account\/web\/site\?new=1&edit=1&theme=\$\{encodeURIComponent\(theme\.id\)\}`;/);
  assert.match(themePreview, /href="\$\{AppUtils\.escapeHTML\(useThemeRoute\)\}" data-route="\$\{AppUtils\.escapeHTML\(useThemeRoute\)\}"/);
  assert.match(themePreviewSetup, /StudioRenderers\.websiteThemes\(\)/);
  assert.doesNotMatch(themePreviewSetup, /this\.websiteThemes\(|this\.websiteBuilderDraft\(/);
  assert.doesNotMatch(themePreviewSetup, /products:\s*JSON\.parse\(JSON\.stringify\(websiteDraft\.products\)\)/);
  assert.match(pageSource, /const previewDescription = theme\.preview_url[\s\S]*?uses its sample products[\s\S]*?products and \$\{draft\.categories\.length\} categories are ready for the editor/);
  assert.match(pageSource, /const catalog = \{\s*products: SQLiteEngine\.select\("products", product => product\.status !== "archived"\),\s*categories: SQLiteEngine\.getCategories\(\),\s*store: SQLiteEngine\.getStore\(\),\s*pages: SQLiteEngine\.getPages\(\)\s*\};[\s\S]*?window\.__ESHOP_THEME_CATALOG__=\$\{catalogJson\}/);
  assert.match(pageSource, /const link = e\.target\.closest\("\[data-route\]"\);[\s\S]*?this\.navigate\(route,/);
  assert.doesNotMatch(pageSource, /data-use-website-theme|useWebsiteTheme/);
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

test('selected hosted themes load the owner catalog adapter for products and category links', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../public/theme-catalog-adapter.js', import.meta.url), 'utf8');
  assert.match(pageSource, /const catalogAdapter = `<script src="\$\{window\.location\.origin\}\/theme-catalog-adapter\.js" defer>/);
  assert.match(pageSource, /catalogBootstrap\}\$\{catalogAdapter\}/);
  assert.match(workerSource, /const catalogAdapter = `<script src="\/theme-catalog-adapter\.js" defer>/);
  assert.match(workerSource, /catalogBootstrap\}\$\{catalogAdapter\}/);
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
  assert.ok(editor, 'The website editor should render its appearance screens.');
  assert.match(editor, /data-appearance-screen-content="filters" style="display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(editor, /data-appearance-screen-content="themes"/);
  assert.match(editor, /PRODUCT SURFACE/);
  assert.match(editor, /appearancePresets\.designPresets\.map/);
  assert.doesNotMatch(editor, /title="Brand"|title="Style"/);
  assert.match(pageSource, /window\.EshopWebsiteAppearance\?\.fonts \|\| \[\]/);
  const editorEvents = pageSource.match(/postRenderSetup\(path, params\) \{([\s\S]*?)\n  \},\n\n  initHeroCarousel/)?.[1];
  assert.ok(editorEvents, 'The website editor interactions should be initialized after route rendering.');
  assert.match(editorEvents, /const appearancePresets = window\.EshopWebsiteAppearance/);
  assert.match(editorEvents, /appearancePresets\.filters\.find/);
  assert.match(editorEvents, /appearancePresets\.designPresets\.find/);
});

test('website editor back button returns to the account screen it was opened from', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const editor = pageSource.match(/renderWebsiteEditor\(isNewWebsite = false\) \{([\s\S]*?)\n  \},\n\n  renderWebsiteStoreEditor/)?.[1];
  assert.ok(editor, 'Website editor should be rendered by a dedicated method.');
  assert.match(editor, /const previousEditorRoute = AppController\.lastRenderedPath \|\| ""/);
  assert.match(editor, /previousEditorRoute !== AppController\.currentRoute\(\)[\s\S]*?previousEditorRoute\.split[\s\S]*?startsWith\("\/account\/"\)[\s\S]*?\? previousEditorRoute\s*:\s*"\/account\/web"/);
  assert.match(editor, /href="\$\{AppUtils\.escapeHTML\(editorReturnRoute\)\}" data-route="\$\{AppUtils\.escapeHTML\(editorReturnRoute\)\}" aria-label="Back to previous screen"/);
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
  assert.match(imageUpload, /crypto\.subtle\.digest\("SHA-256"[\s\S]*?ESHOP_CATALOG_MEDIA_UPLOADS_V1:\$\{tenant\.id\}[\s\S]*?cachedPublicUrl\.pathname\.startsWith\(`\/media\/\$\{tenant\.id\}\/`\)[\s\S]*?return cachedPublicUrl\.href/);
  assert.match(imageUpload, /compressImageFile[\s\S]*?\/api\/media[\s\S]*?method: "POST"[\s\S]*?publicUrl\.pathname\.startsWith\(`\/media\/\$\{tenant\.id\}\/`\)[\s\S]*?localStorage\.setItem\(cacheKey, JSON\.stringify\(uploadedMedia\)\)/);
  assert.match(publishModal, /await Promise\.all\(\(Array\.isArray\(product\.images\)[\s\S]*?publishImage\)[\s\S]*?products: publishProducts/);
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
});

test('Web Studio website products and categories can be removed without deleting Store/POS records', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const websiteWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\n    \}\n    if \(path === "\/store\/categories"\)/)?.[1];
  const categoryWorkspace = pageSource.match(/if \(path === "\/store\/categories"\) \{([\s\S]*?)\n    \}\n    if \(path === "\/store\/inventory"\)/)?.[1];
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
  const manageHandler = pageSource.match(/const manageWebsite = e\.target\.closest\("\[data-manage-website\]"\);([\s\S]*?)\n      }\n\n      const editWebsite/)?.[1];
  assert.ok(manageHandler, 'Website management should have a dedicated click handler.');
  assert.match(manageHandler, /this\.setActiveTenantCatalog\([\s\S]*?this\.navigate\("\/account\/web\/studio\/store\/products"\)/);
  const productsWorkspace = pageSource.match(/if \(path === "\/store\/products"\) \{([\s\S]*?)\n    \}\n    if \(path === "\/store\/categories"\)/)?.[1];
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
  assert.equal(checkedThemes, WEBSITE_THEME_CATALOG.length);
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
  assert.match(websitesNavigation, /route: "\/account\/web\/studio\/websites\/webmaker"[\s\S]*?title: "Webmaker"[\s\S]*?title: "Web editor"[\s\S]*?title: "Page editor"/);
  assert.match(pageSource, /page\.route === "\/account\/web\/studio\/websites\/webmaker"[\s\S]*?renderWebsiteBuilderCatalog\(true\)/);
  assert.match(pageSource, /path === "\/account\/web\/themes" \|\| path === "\/account\/web\/themes\/select"[\s\S]*?path === "\/account\/web\/studio\/websites\/webmaker"/);
  assert.doesNotMatch(pageSource.match(/if \(manageWebsite\) \{([\s\S]*?)\n      \}\n\n      const editWebsite/)?.[1] || "", /websites\/webmaker/);
  assert.match(pageSource, /const initialPath = path === "\/account\/web"\s*\? "\/account\/web\/studio\/dashboard\/overview"/);
  assert.match(webmaker, /NEW WEBSITE · STEP 1 OF 3[\s\S]*?Add products and categories[\s\S]*?Choose products from Store[\s\S]*?website-wizard-category-form[\s\S]*?website-wizard-product-form[\s\S]*?Continue to choose a business type and theme/);
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
  assert.match(themeChoices, /NEW WEBSITE · STEP 2 OF 3[\s\S]*?Choose a business type and matching website theme/);
  assert.match(themeChoices, /id="website-wizard-business-type"/);
  assert.doesNotMatch(webmaker, /website-wizard-business-type/);
  assert.match(pageSource, /const businessTypeStepComplete = saved\.business_type_step === 2;[\s\S]*?business_type: businessTypeStepComplete && typeof saved\.business_type === "string" \? saved\.business_type : ""/);
  assert.match(websiteBuilderBinder, /draft\.business_type = businessTypeSelect\.value;[\s\S]*?draft\.business_group = businessType\.group;[\s\S]*?draft\.business_type_step = 2;[\s\S]*?draft\.selected_theme = ""/);
  assert.match(themeChoices, /businessType \? themes\.slice\(0, \(WEBSITE_THEME_BUSINESS_GROUPS\[businessType\.group\] \|\| \[\]\)\.length\)/);
  assert.match(themeChoices, /businessType \? themes\.slice\(\(WEBSITE_THEME_BUSINESS_GROUPS\[businessType\.group\] \|\| \[\]\)\.length\) : themes/);
  assert.match(pageSource, /website_business_type: draft\.business_type,[\s\S]*?website_business_group: businessType\.group/);
  const businessTypes = pageSource.match(/const WEBSITE_BUSINESS_TYPE_GROUPS = ([\s\S]*?)\n\];/)?.[1];
  const themeGroups = pageSource.match(/const WEBSITE_THEME_BUSINESS_GROUPS = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(businessTypes, 'Kenyan business-type groups should be defined.');
  assert.ok(themeGroups, 'Themes should be grouped by intended business.');
  for (const type of [
    'Clothing boutiques', 'Thrift / mtumba shops', 'Phone and accessories shops', 'Supermarkets and minimarkets',
    'Nyama choma joints', 'Cloud kitchens (delivery only)', 'Airbnb and short-term rentals',
    'Safari camps and tented camps', 'Hair salons', 'Nail studios (manicure and pedicure)',
    'Mobile beauty services (home visits)', 'Real estate agencies', 'Safari companies'
  ]) assert.ok(businessTypes.includes(`"${type}"`), `Business type "${type}" should be offered.`);
  const groupedThemeIds = [...themeGroups.matchAll(/"([a-z0-9-]+)"/g)].map(match => match[1]);
  const availableThemeIds = new Set(WEBSITE_THEME_CATALOG.map(theme => theme.id));
  assert.equal(groupedThemeIds.length, 28, 'All 28 business-specific themes should be assigned to groups.');
  assert.equal(new Set(groupedThemeIds).size, 28, 'Each theme should appear in exactly one business group.');
  assert.ok(groupedThemeIds.every(themeId => availableThemeIds.has(themeId)), 'Theme groups should only contain available themes.');
  assert.match(themeGroups, /"Beauty Services & Bookings": \[\s*"blush-theory-nail-studio-editorial-nail-art-online-booking-apoth",\s*"maison-elysee-haute-coiffure-luxury-salon-beauty-atelier",\s*"lacqueria-the-art-of-the-hand-nail-atelier-booking-shop"/);
  assert.match(themeGroups, /"Events": \[\s*"arcadia-events-bespoke-event-planning-spatial-design-studio",\s*"cira-atelier-event-architecture-management"/);
  assert.match(themeGroups, /"Property & Real Estate": \[\s*"aurus-real-estate-kenya-luxury-property-discovery-platform"/);
  assert.match(pageSource, /Choose a business type before choosing a theme/);
  assert.match(pageSource, /NEW WEBSITE · FINAL STEP[\s\S]*?Create your website/);
  assert.match(pageSource, /id="btn-builder-finish-website"[\s\S]*?Finish &amp; create/);
  assert.match(pageSource, /prepareWebsiteBuilderDraftTenant\(draft, themeId\)[\s\S]*?WEBSITE_BUILDER_DRAFT_TENANT_ID/);
  assert.match(pageSource, /ESHOP_NEW_WEBSITE_DRAFT_SYNC_V1/);
  assert.match(pageSource, /SQLiteEngine\.db\.tables\.products = \[\];\s*SQLiteEngine\.db\.tables\.categories = \[\];\s*SQLiteEngine\.db\.tables\.inventory = \[\]/);
  assert.match(pageSource, /window\.localStorage\.getItem\(WEBSITE_BUILDER_DRAFT_SYNC_KEY\) === signature/);
  assert.match(pageSource, /const useThemeRoute = `\/account\/web\/site\?new=1&edit=1&theme=/);
  assert.match(pageSource, /websiteThemesForBusinessType\(draft = this\.websiteBuilderDraft\(\)\)[\s\S]*?relatedIds\.has\(theme\.id\)[\s\S]*?themes\.filter\(theme => !relatedIds\.has\(theme\.id\)\)/);
  assert.match(pageSource, /applyWebsiteBuilderDraft\(draft, themeId\)[\s\S]*?theme\.id === \(themeId \|\| draft\.selected_theme\)[\s\S]*?website_theme_id: selectedTheme\.id[\s\S]*?this\.cacheActiveTenantCatalog\(\)/);
  assert.doesNotMatch(pageSource, /previewWindow\.setBuilderCatalog\(\{\s*products: JSON\.parse\(JSON\.stringify\(websiteDraft\.products\)\),\s*categories: JSON\.parse\(JSON\.stringify\(websiteDraft\.categories\)\)/);
  assert.match(pageSource, /window\.__ESHOP_THEME_CATALOG__=\$\{catalogJson\}/);
  assert.match(pageSource, /this\.applyWebsiteBuilderDraft\(draft, selectedTheme\.id\)\.then\(\(\) => \{[\s\S]*?WEBSITE_BUILDER_DRAFT_SYNC_KEY[\s\S]*?\}\)\.catch\(error => \{[\s\S]*?New website draft could not be loaded into the editor/);
  assert.match(pageSource, /removeItem\("ESHOP_NEW_WEBSITE_DRAFT_V1"\)[\s\S]*?Website created at/);
});

test('main app inline script parses before packaging', async () => {
  const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const inlineScripts = [...pageSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(script => !/\bsrc\s*=/.test(script[1]));
  assert.equal(inlineScripts.length, 1, 'The app should have one inline application script.');
  assert.doesNotThrow(() => new Script(inlineScripts[0][2], { filename: 'index.html:inline-app-script' }));
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
  const themeSettings = pageSource.match(/applyThemeSettings\(appearance = this\.getStudioAppearance\(\)\) \{([\s\S]*?)\n  \},\n\n  setAppShellTheme/)?.[1];
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
  assert.match(paymentReturn, /fetch\(`\/api\/payments\/paystack\/verify\?/);
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
    assert.match(storeMarkup, />Sell</);
    assert.match(storeMarkup, />Catalogue</);
    assert.match(storeMarkup, />Orders</);
    assert.doesNotMatch(storeMarkup, /Open app account|>Account<\/a>/);
    const inventoryMarkup = app.render('/pos/inventory');
    assert.match(inventoryMarkup, /class="pos-main pos-main-with-tabs"[\s\S]*?class="pos-brand"[\s\S]*?<span>Inventory<\/span>[\s\S]*?<nav class="pos-tabs pos-subnav"[\s\S]*?<\/nav>[\s\S]*?<section class="pos-content"/);
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
    assert.match(overviewMarkup, /href="\/" data-route="\/" data-home-screen class="pos-brand pos-brand-overview" aria-label="Craft home"[^>]*>[\s\S]*?<span>Overview<\/span>/);
    assert.doesNotMatch(overviewMarkup, /<span>POS<\/span>/);
    assert.doesNotMatch(overviewMarkup, /<h2>Overview<\/h2>/);
    assert.match(overviewMarkup, /class="pos-overview-controls"/);
    assert.doesNotMatch(overviewMarkup, /Business overview|Manage expenses|Store performance/);
    assert.match(overviewMarkup, /class="pos-overview-card"[^>]*aria-label="Business totals"/);
    assert.match(overviewMarkup, /<small>Revenue<\/small>/);
    assert.match(overviewMarkup, /<small>Profit<\/small>/);
    assert.match(overviewMarkup, /<small>Operating profit<\/small>/);
    assert.match(overviewMarkup, /<small>Credit<\/small>/);
    assert.equal((overviewMarkup.match(/class="pos-overview-metric"/g) || []).length, 4);
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
    const homeRoutes = [...launchpad.matchAll(/class="home-credit-card-link" href="([^"]+)" data-route=/g)].map(([, route]) => route);
    assert.deepEqual(homeRoutes, ['/account/web', '/pos']);
    assert.match(launchpad, /<img class="home-screen-logo" src="\/eshop-logo\.png" alt="Craft">/);
    assert.match(launchpad, /class="home-screen-profile" href="\/app-account" data-route="\/app-account" aria-label="Account"/);
    assert.match(launchpad, /class="home-credit-card" role="group"/);
    assert.match(launchpad, /class="home-store-card" href="\/account\/main-shop" data-route="\/account\/main-shop" aria-label="Main Store">\s*<strong>Main Store<\/strong>/);
    assert.match(launchpad, /class="home-overall-metrics" aria-label="Overall business metrics"[\s\S]*?Overall Revenue[\s\S]*?data-home-metric="revenue"[\s\S]*?Overall Profit[\s\S]*?data-home-metric="profit"[\s\S]*?Overall Customers[\s\S]*?data-home-metric="customers"[\s\S]*?Average Order[\s\S]*?data-home-metric="average-order"/);
    assert.match(pageSource, /loadHomeOverallMetrics\(\)[\s\S]*?getMainShopSnapshot\(\)[\s\S]*?Cost data unavailable[\s\S]*?averageOrder/);
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
    assert.match(pageSource, /studio-hamburger" href="\/account\/profile" data-route="\/account\/profile" aria-label="Open account and website menu/);
    assert.match(pageSource, /\.studio-workspace-top-nav,\s*\.studio-nested-nav\s*\{[^}]*position:\s*sticky[^}]*top:\s*env\(safe-area-inset-top,\s*0px\)/);
    assert.match(pageSource, /\.business-lens-shell \.studio-workspace-heading\s*\{[^}]*align-items:\s*center/);
    assert.doesNotMatch(pageSource.match(/\.business-lens-shell \.studio-workspace-heading\s*\{([^}]*)\}/)?.[1] || "", /position:\s*sticky/);
    assert.match(pageSource, /\.business-lens-shell \.studio-workspace-top-nav\s*\{[^}]*top:\s*env\(safe-area-inset-top,\s*0px\)/);
    assert.match(pageSource, /\.pos-overview-tabs\s*\{[^}]*position:\s*sticky[^}]*top:\s*env\(safe-area-inset-top,\s*0px\)/);
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
    assert.match(pageSource, /\.home-credit-card\s*\{[^}]*aspect-ratio:\s*1\.62[^}]*background:\s*#000[^}]*color:\s*#fff/);
    assert.match(pageSource, /\.home-screen-main\s*\{[^}]*width:\s*100%[^}]*padding:\s*clamp\(12px,\s*2\.5vh,\s*28px\)/);
    assert.match(pageSource, /\.home-overall-metrics\s*\{[^}]*width:\s*100%[^}]*display:\s*grid/);
    assert.match(pageSource, /\.home-overall-metric\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/);
    assert.match(pageSource, /\.home-credit-card\s*\{[^}]*width:\s*min\(100%,\s*700px\)/);
    assert.match(pageSource, /\.home-credit-card-heading\s*\{[^}]*gap:\s*12px/);
    assert.match(pageSource, /\.home-screen-header\s*\{[^}]*border-bottom:\s*2px solid #000/);
    assert.match(pageSource, /\.home-store-card\s*\{[^}]*min-height:\s*48px[^}]*border-radius:\s*999px[^}]*background:\s*#000/);
    assert.match(launchpad, /home-credit-card-eyebrow">CRAFT · BUSINESS/);
    assert.doesNotMatch(launchpad, /home-credit-card-chip|Workspace access|Web Studio \+ POS|WEB &nbsp; •••• &nbsp; POS/);
    assert.match(launchpad, /href="\/account\/web" data-route="\/account\/web" aria-label="Craft Web Studio"[\s\S]*?src="\/eshop-mark\.png"[\s\S]*?home-credit-card-label">Craft/);
    assert.match(launchpad, /href="\/pos" data-route="\/pos" aria-label="Point of Sale"[\s\S]*?home-credit-card-label">POS[\s\S]*?<svg viewBox="0 0 24 24"[\s\S]*?M3 4h2l2\.2 11\.1/);
    assert.doesNotMatch(launchpad, /Where would you like to go|Manage your online shop/);
    assert.match(pageSource, /renderLaunchpad\(\)\s*\{\s*document\.title = "Home — Craft"/);
    assert.match(webManifest, /icons\/eshop-icon\.png/);
    assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/);
    assert.match(pageSource, /path === "\/app-account"[\s\S]*?renderAppAccount\(\)/);
    assert.match(pageSource, /appAccountForm\.onsubmit = async event =>[\s\S]*?\/api\/auth\/\$\{registering \? "register" : "login"\}[\s\S]*?ESHOP_ACCOUNT_SESSION_V1[\s\S]*?restoreAccountWebsites\(result\.tenants, origin\)/);
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
    assert.match(pageSource, /\.pos-subnav\s*\{[^}]*position:\s*sticky[^}]*top:\s*env\(safe-area-inset-top,\s*0px\)/);
    assert.match(pageSource, /\.pos-main-with-tabs \.pos-header-divider\s*\{\s*display:\s*none/);
    assert.match(pageSource, /\.pos-main-with-tabs > \.pos-content > \.pos-section-heading h2\s*\{\s*display:\s*none/);
    assert.match(pageSource, /\.pos-filter-row input\s*\{[^}]*height:\s*38px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.pos-filter-row select\s*\{[^}]*flex:\s*0 1 132px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.pos-scanner-entry \.btn-secondary\s*\{[^}]*min-height:\s*38px[^}]*border-radius:\s*999px/);
    assert.match(pageSource, /\.studio-workspace-top-link\.is-active::after,\s*\.studio-nested-nav a\.is-active::after/);
    assert.match(pageSource, /\.pos-subnav \.pos-tab\.is-active::after,\s*\.pos-overview-tabs \.pos-tab\.is-active::after\s*\{\s*display:\s*block/);
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
    assert.match(pageSource, /profile-sidebar[\s\S]*?Recommended actions[\s\S]*?Link devices[\s\S]*?Privacy/);
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
    assert.match(pageSource, /<header class="studio-workspace-heading">[\s\S]*?<h1>Web Studio<\/h1>[\s\S]*?<a class="studio-hamburger" href="\/account\/profile" data-route="\/account\/profile" aria-label="Open account and website menu"/);
    assert.match(pageSource, /path === "\/account\/web" \|\| path\.startsWith\("\/account\/web\/studio\/"\)[\s\S]*?renderMainShopWorkspace\(path\)/);
    assert.match(pageSource, /renderMainShopContent\(page\.contentPath, snapshot, true\)/);
    assert.match(pageSource, /CUSTOMER NOTIFICATIONS[\s\S]*?data-enable-notifications[\s\S]*?data-disable-notifications/);
    assert.match(pageSource, /websiteThemes\(\)[\s\S]*?website_themes[\s\S]*?preview_catalog[\s\S]*?SQLiteEngine\.save\(\)/);
    assert.match(pageSource, /renderWebsiteThemes\(\)[\s\S]*?website-theme-card[\s\S]*?Preview theme[\s\S]*?data-theme-storefront-preview="\$\{AppUtils\.escapeHTML\(theme\.id\)\}"[\s\S]*?theme\.preview_url/);
    assert.match(pageSource, /renderWebsiteTheme\(themeId\)[\s\S]*?const useThemeRoute = `\/account\/web\/site\?new=1&theme=\$\{encodeURIComponent\(theme\.id\)\}`;[\s\S]*?href="\$\{AppUtils\.escapeHTML\(useThemeRoute\)\}" data-route="\$\{AppUtils\.escapeHTML\(useThemeRoute\)\}"[\s\S]*?Use theme &rarr;[\s\S]*?data-theme-storefront-preview="\$\{AppUtils\.escapeHTML\(theme\.id\)\}"[\s\S]*?theme\.preview_url/);
    const themeCatalog = await readFile(new URL('../src/theme-catalog.js', import.meta.url), 'utf8');
    const themeBootstrap = await readFile(new URL('../src/bootstrap.js', import.meta.url), 'utf8');
    assert.equal((themeCatalog.match(/"preview_url":/g) || []).length, 28);
    assert.equal((themeCatalog.match(/https:\/\/eshop-storefront\.ryanrobin07-ek\.workers\.dev\/themes\//g) || []).length, 28);
    assert.match(themeBootstrap, /EshopWebsiteThemeCatalog = WEBSITE_THEME_CATALOG/);
    assert.match(pageSource, /themePreviewRemote === "1"[\s\S]*?Hosted theme preview does not match a saved theme|Hosted theme preview/);
    assert.match(pageSource, /themePreviewFrames[\s\S]*?theme\.preview_catalog[\s\S]*?getBuilderSeedCatalog\(\)[\s\S]*?SQLiteEngine\.save\(\)[\s\S]*?await window\.ShopSQLite\.flush\(\)[\s\S]*?previewWindow\.setBuilderCatalog/);
    const themePreviewSetup = pageSource.match(/const themePreviewFrames = document\.querySelectorAll\("\[data-theme-storefront-preview\]"\);([\s\S]*?)const storefrontFrame =/)?.[1];
    assert.ok(themePreviewSetup, "Theme previews should have an isolated catalog initialization path.");
    assert.doesNotMatch(themePreviewSetup, /products:\s*SQLiteEngine\.select\("products"/);
    assert.doesNotMatch(pageSource, /Preview the full live storefront, including its products and working navigation\./);
    assert.match(sqliteSource, /'tenant_catalogs','website_themes'/);
    const accountsMigration = await readFile(new URL('../cloudflare/migrations/0004_accounts.sql', import.meta.url), 'utf8');
    assert.match(accountsMigration, /CREATE TABLE IF NOT EXISTS accounts/);
    assert.match(accountsMigration, /password_salt TEXT NOT NULL/);
    assert.match(accountsMigration, /password_hash TEXT NOT NULL/);
    assert.match(accountsMigration, /CREATE TABLE IF NOT EXISTS account_tenants/);
    assert.match(pageSource, /website_themes:\s*\[\]/);
    assert.match(originalStorefront, /get\("theme-preview"\)\s*===\s*"1"[\s\S]*?ESHOP_THEME_PREVIEW_DB_V1/);
    assert.match(pageSource, /renderWebsiteEditor\(isNewWebsite = false\)[\s\S]*?grid-template-columns:minmax\(0,1fr\)[\s\S]*?Website preview canvas[\s\S]*?width:min\(360px,calc\(100vw - 16px\)\)[\s\S]*?Mobile-sized live website preview[\s\S]*?width:150%;height:150%[\s\S]*?transform:scale\(\.666667\)[\s\S]*?Website editing controls/);
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
    const appearanceMethod = pageSource.match(/applyThemeSettings\(appearance = this\.getStudioAppearance\(\)\)\s*\{[\s\S]*?\n  \},\n\n  setAppShellTheme/)[0];
    assert.doesNotMatch(appearanceMethod, /--font-main|--font-serif|--font-display/);
    assert.match(pageSource, /input\[type="radio"\][\s\S]*?accent-color: var\(--accent\)/);
    assert.match(pageSource, /body\.app-shell #app\s*\{[^}]*background-color:\s*var\(--bg\)/);
    assert.match(pageSource, /setAppShellTheme\(path\)[\s\S]*?path === "\/pos" \|\| path\.startsWith\("\/pos\/"\)/);
    assert.match(pageSource, /this\.setAppShellTheme\(path\)/);
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
    assert.match(pageSource, /\.pos-overview-controls\s*\{[^}]*gap:\s*3px/);
    assert.match(pageSource, /navigate\(path,\s*openWorkspaceHome\s*=\s*false\)/);
    assert.match(pageSource, /this\.navigate\(route,\s*link\.hasAttribute\("data-home-screen"\)\)/);
    assert.match(pageSource, /class="brand-logo studio-module-brand" data-route="\/" data-home-screen aria-label="Craft home"/);
    assert.match(pageSource, /class="brand-logo" data-route="\$\{storefrontHome\}" \$\{options\.builderPreview \? "" : "data-home-screen"\} aria-label="Craft home"/);
    assert.match(pageSource, /\.studio-module-navbar \.studio-profile-btn\s*\{[^}]*border-radius:\s*50%[^}]*background:\s*#000[^}]*color:\s*#fff/);
    assert.match(pageSource, /\.pos-overview-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.match(pageSource, /\.pos-overview-tabs\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0[^}]*overflow-x:\s*auto[^}]*touch-action:\s*pan-x/);
    assert.match(pageSource, /\.pos-ranges\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto[^}]*touch-action:\s*pan-x/);
    assert.match(pageSource, /\.pos-overview-tabs \.pos-tab\s*\{[^}]*min-height:\s*30px/);
    assert.match(pageSource, /\.pos-overview-card\s*\{[^}]*min-height:\s*260px[^}]*border:\s*0[^}]*background:\s*#111/);
    assert.match(pageSource, /\.pos-overview-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(pageSource, /\.pos-overview-metrics\s*\{[^}]*align-content:\s*space-between/);
    assert.match(pageSource, /\.pos-overview-metric:nth-child\(even\)\s*\{[^}]*text-align:\s*right/);
    assert.match(pageSource, /\.pos-revenue-card\s*\{[^}]*min-height:\s*320px/);
    assert.match(pageSource, /\.pos-revenue-chart-line\s*\{[^}]*stroke:\s*var\(--accent\)/);
    assert.match(pageSource, /\.pos-bottom-nav\s*\{[^}]*overflow-x:\s*auto/);
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
    assert.match(pageSource, /renderWebsiteEditor\([\s\S]*?src="\/builder-storefront\.html\?builder=1"/);
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
    await submit('checkout', { paymentMethod: 'Mobile money', customerName: '', customerPhone: '', dueDate: '' });
    const pending = queryRows("SELECT id,paid,payment_status FROM pos_sales WHERE payment_method='Mobile money'")[0];
    assert.equal(pending.paid, 0);
    assert.equal(pending.payment_status, 'pending');
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
    assert.equal(queryRows('SELECT COUNT(*) AS count FROM pos_sale_payments')[0].count, 2);

    await submit('payment', { saleId: String(pending.id), amount: '5', method: 'Mobile money' });
    assert.equal(queryRows('SELECT payment_status FROM pos_sales WHERE id=?', [pending.id])[0].payment_status, 'partial');
    await submit('payment', { saleId: String(pending.id), amount: '13.50', method: 'Mobile money' });
    assert.equal(queryRows('SELECT paid FROM pos_sales WHERE id=?', [pending.id])[0].paid, 1);

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
