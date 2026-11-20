// Inventory sync with a website: receive purchase orders, push sales, load shared stock.
// Moved verbatim from pos.js: change sync behavior only with the owner's OK.
import { businessRecordStatements } from './business-records.js';
import { rows, run, stmt, transaction } from './db.js';
import { nowIso, toCents } from './format.js';
import { addCategory, listCategories, listProducts, saveProduct } from './products.js';
import { recordSharedStockUpdate } from './stock.js';

export function createInventorySync({ state, queueProduct, refresh }) {
  async function receivePurchaseOrder(recordId) {
    const purchase = state.purchases.find((item) => item.id === recordId);
    if (!purchase || purchase.status !== 'ordered') throw new Error('This purchase order is not available to receive.');
    const received = [];
    for (const line of purchase.items) {
      const product = (await rows('SELECT id,name,stock_count FROM pos_products WHERE sku=?', [line.sku]))[0];
      if (!product) throw new Error(`${line.name} is no longer in this catalogue; restore the product before receiving.`);
      const nextStock = (product.stock_count == null ? 0 : Number(product.stock_count)) + line.quantity;
      if (!Number.isSafeInteger(nextStock) || nextStock < 0) throw new Error(`Stock quantity for ${line.name} is invalid.`);
      received.push({ ...line, productId: Number(product.id), nextStock });
    }
    const updatedPurchase = { ...purchase, status: 'received', receivedAt: nowIso() };
    await transaction([
      ...received.map((line) => stmt(
        'UPDATE pos_products SET stock_count=?,buying_price_cents=? WHERE id=?',
        [line.nextStock, toCents(line.unitCost), line.productId]
      )),
      ...businessRecordStatements('purchase', purchase.id, updatedPurchase, false, 0, state.cloudScopeId)
    ]);
    const products = await listProducts();
    for (const line of received) {
      const product = products.find((item) => item.id === line.productId);
      if (!product) throw new Error(`Received stock for ${line.name}, but the updated product could not be loaded for sync.`);
      await queueProduct(product);
    }
    for (const line of received) await recordSharedStockUpdate(line.sku, line.nextStock);
  }

  async function syncInventorySales() {
    const queued = await rows("SELECT event_id,tenant_id,items_json,operation FROM pos_inventory_queue WHERE status!='synced' ORDER BY updated_at,rowid");
    if (navigator.onLine === false || !window.EshopInventoryBridge) return queued.length;
    const sharedTenant = (await rows("SELECT value FROM pos_settings WHERE key='shared_tenant_id'"))[0]?.value;
    const syncedTenants = new Set(sharedTenant ? [sharedTenant] : []);
    for (const event of queued) {
      if (window.EshopInventoryBridge.hasTenantOwnerKey?.(event.tenant_id) === false) continue;
      try {
        const body = JSON.parse(event.items_json);
        if (event.operation === 'connect') {
          await window.EshopInventoryBridge.request(event.tenant_id, 'connect', 'POST', body);
        } else {
          await window.EshopInventoryBridge.request(event.tenant_id, 'sale', 'POST', {
            event_id: event.event_id,
            items: body
          });
        }
        await run("UPDATE pos_inventory_queue SET status='synced',last_error=NULL,updated_at=? WHERE event_id=?",
          [nowIso(), event.event_id]);
        syncedTenants.add(event.tenant_id);
      } catch (error) {
        await run("UPDATE pos_inventory_queue SET status='pending',last_error=?,updated_at=? WHERE event_id=?",
          [String(error instanceof Error ? error.message : 'Sync failed').slice(0, 500), nowIso(), event.event_id]);
      }
    }
    for (const tenantId of syncedTenants) {
      let remote;
      try {
        remote = await window.EshopInventoryBridge.request(tenantId, 'connect', 'GET');
      } catch (error) {
        state.inventorySyncError = String(error instanceof Error ? error.message : error).slice(0, 500);
        await run('UPDATE pos_inventory_queue SET last_error=?,updated_at=? WHERE tenant_id=? AND status=?',
          [`Sales synced; latest D1 stock refresh failed: ${String(error instanceof Error ? error.message : error).slice(0, 400)}`,
            nowIso(), tenantId, 'synced']);
        continue;
      }
      if (!Array.isArray(remote.items)) continue;
      const items = remote.items.map((item) => ({
        sku: String(item.sku || ''),
        stock: Number(item.stock)
      })).filter((item) => item.sku && Number.isSafeInteger(item.stock) && item.stock >= 0);
      if (!items.length) continue;
      await transaction(items.map((item) =>
        stmt(`INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(tenant_id,sku) DO UPDATE SET stock=excluded.stock,updated_at=excluded.updated_at`,
        [tenantId, item.sku, item.stock, nowIso()])));
      await window.EshopInventoryBridge.updateLocalStock?.(tenantId, items);
      await run('UPDATE pos_inventory_queue SET last_error=NULL WHERE tenant_id=? AND status=?', [tenantId, 'synced']);
      state.inventorySyncError = '';
      for (const item of items) {
        await run('UPDATE pos_products SET stock_count=? WHERE sku=?', [item.stock, item.sku]);
      }
    }
    return (await rows("SELECT COUNT(*) AS count FROM pos_inventory_queue WHERE status!='synced'"))[0]?.count || 0;
  }

  async function syncSharedStock(source) {
    const websiteId = document.getElementById('pos-shared-website')?.value || '';
    if (!websiteId) throw new Error('Select a website to connect.');
    const bridge = window.EshopInventoryBridge;
    if (!bridge) throw new Error('Website sync is unavailable. Reload the app and try again.');
    const website = bridge.websites().find((item) => item.tenant_id === websiteId);
    if (!website) throw new Error('The selected website is no longer available. Refresh and try again.');
    let catalog = bridge.localCatalog(websiteId);
    if ((!catalog || !catalog.products?.length) && navigator.onLine !== false) {
      catalog = await bridge.catalog(websiteId);
    }
    if (!catalog) throw new Error('This website has no catalog saved on this device. Open it online once, then try again.');
    if (source === 'website') {
      const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
      const posCategories = await listCategories();
      const categoryIds = new Map(posCategories.map((category) => [normalize(category.name), category.id]));
      const posProducts = await listProducts();
      const productsBySku = new Map(posProducts.filter((product) => product.sku)
        .map((product) => [String(product.sku).trim().toLocaleUpperCase(), product]));
      const imported = [];
      for (const websiteProduct of (catalog.products || []).filter((product) => product.status !== 'archived')) {
        const name = String(websiteProduct.name || '').trim();
        if (!name) continue;
        const stock = websiteProduct.stock == null ? 0 : Number(websiteProduct.stock);
        if (!Number.isSafeInteger(stock) || stock < 0) {
          throw new Error(`${name} has an invalid website stock count.`);
        }
        const categoryName = String((catalog.categories || []).find((category) =>
          String(category.id) === String(websiteProduct.category_id))?.name
          || websiteProduct.category_name || websiteProduct.category || 'Other').trim() || 'Other';
        const categoryKey = normalize(categoryName);
        let categoryId = categoryIds.get(categoryKey);
        if (!categoryId) {
          await addCategory(categoryName);
          const createdCategory = (await listCategories()).find((category) => normalize(category.name) === categoryKey);
          if (!createdCategory) throw new Error(`Could not create POS category "${categoryName}".`);
          categoryId = createdCategory.id;
          categoryIds.set(categoryKey, categoryId);
        }
        const sku = String(websiteProduct.sku || '').trim();
        const existing = (sku && productsBySku.get(sku.toLocaleUpperCase()))
          || posProducts.find((product) => normalize(product.name) === normalize(name)
            && product.categoryId === categoryId);
        const productId = await saveProduct({
          id: existing?.id || 0,
          name: existing?.name || name,
          categoryId: existing?.categoryId || categoryId,
          price: existing?.price ?? (Number(websiteProduct.price) || 0),
          buyingPrice: existing?.buyingPrice ?? websiteProduct.cost_price ?? null,
          stock,
          sku: existing?.sku || sku,
          imageUri: existing?.imageUri || websiteProduct.images?.[0] || '',
          taxonomyCategoryId: websiteProduct.taxonomy_category_id || existing?.taxonomyCategoryId || '',
          taxonomyCustomCategory: websiteProduct.taxonomy_custom_category || existing?.taxonomyCustomCategory || '',
          taxonomyAttributes: websiteProduct.taxonomy_attributes || existing?.taxonomyAttributes || [],
          lowStockThreshold: existing?.lowStockThreshold ?? 3,
          active: existing?.active ?? true
        });
        const saved = (await listProducts()).find((product) => Number(product.id) === Number(productId));
        if (!saved) throw new Error(`${name} was not saved to POS inventory.`);
        if (saved.sku) productsBySku.set(saved.sku.toLocaleUpperCase(), saved);
        posProducts.push(saved);
        imported.push(saved);
      }
      if (!imported.length) throw new Error('This website has no products to load into POS.');
      await refresh();
      return { count: imported.length, pending: 0, localOnly: true };
    }
    const posBySku = new Map();
    for (const product of state.products) {
      const sku = String(product.sku || '').trim();
      if (!sku) continue;
      if (posBySku.has(sku)) throw new Error(`SKU ${sku} is used by more than one POS product.`);
      if (!Number.isSafeInteger(product.stock) || product.stock < 0) {
        throw new Error(`${product.name} needs a tracked whole-number stock count before syncing.`);
      }
      posBySku.set(sku, product);
    }
    const websiteBySku = new Map((catalog.products || [])
      .filter((product) => typeof product.sku === 'string' && product.sku.trim())
      .map((product) => [product.sku.trim(), product]));
    const matches = [...posBySku].filter(([sku]) => websiteBySku.has(sku));
    if (!matches.length) throw new Error('No SKUs match. Add the same SKU to a POS product and website product first.');
    const items = matches.map(([sku, product]) => ({
      sku,
      stock: source === 'pos' ? product.stock : Number(websiteBySku.get(sku).stock)
    }));
    if (items.some((item) => !Number.isSafeInteger(item.stock) || item.stock < 0)) {
      throw new Error('The selected source contains invalid stock counts.');
    }
    if (state.sharedTenantId === websiteId && !confirm('Reset shared stock to the selected source? This replaces the current shared quantities.')) {
      return { count: 0, pending: state.pendingInventoryEvents };
    }
    const eventId = `SYNC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = nowIso();
    const payload = JSON.stringify({ mode: 'replace', items });
    const replaceStatements = items.map((item) =>
      stmt(`INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)
        ON CONFLICT(tenant_id,sku) DO UPDATE SET stock=excluded.stock,updated_at=excluded.updated_at`,
      [websiteId, item.sku, item.stock, createdAt]));
    replaceStatements.push(
      stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
        [websiteId, eventId, createdAt]),
      stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
        VALUES (?,?,?,'connect','pending',?)`,
      [eventId, websiteId, payload, createdAt]),
      stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', ['shared_tenant_id', websiteId])
    );
    await transaction(replaceStatements);
    await bridge.updateLocalStock(websiteId, items);
    const pending = await syncInventorySales();
    await refresh();
    return { count: items.length, pending };
  }

  return { receivePurchaseOrder, syncInventorySales, syncSharedStock };
}
