// Shared stock between the till and a website: queue stock updates, apply Main Store allocations,
// record a sale made on this device against shared inventory.
import { rows, run, stmt, transaction } from './db.js';
import { nowIso, numberTag } from './format.js';

async function recordSharedStockUpdate(sku, stock) {
  const tenantId = (await rows("SELECT value FROM pos_settings WHERE key='shared_tenant_id'"))[0]?.value;
  if (!tenantId || !sku || !Number.isSafeInteger(stock) || stock < 0) return;
  const eventId = numberTag('STOCK');
  const createdAt = nowIso();
  const body = JSON.stringify({ mode: 'replace', items: [{ sku, stock }] });
  await transaction([
    stmt(`INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(tenant_id,sku) DO UPDATE SET stock=excluded.stock,updated_at=excluded.updated_at`,
    [tenantId, sku, stock, createdAt]),
    stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
      [tenantId, eventId, createdAt]),
    stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
      VALUES (?,?,?,'connect','pending',?)`, [eventId, tenantId, body, createdAt])
  ]);
  await window.EshopInventoryBridge?.updateLocalStock?.(tenantId, [{ sku, stock }]);
  if (navigator.onLine !== false && window.EshopInventoryBridge?.hasTenantOwnerKey?.(tenantId) !== false) {
    try {
      await window.EshopInventoryBridge?.request?.(tenantId, 'connect', 'POST', JSON.parse(body));
      await run("UPDATE pos_inventory_queue SET status='synced',last_error=NULL,updated_at=? WHERE event_id=?",
        [nowIso(), eventId]);
    } catch (error) {
      await run('UPDATE pos_inventory_queue SET last_error=?,updated_at=? WHERE event_id=?',
        [String(error instanceof Error ? error.message : error).slice(0, 500), nowIso(), eventId]);
    }
  }
}

async function applyMainStoreAllocations(tenantId, allocations) {
  if (!tenantId || !Array.isArray(allocations)) {
    throw new Error('Main Store allocations need a website and a product list.');
  }
  const createdAt = nowIso();
  await transaction([
    stmt(`INSERT INTO pos_settings (key,value) VALUES ('shared_tenant_id',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [tenantId]),
    ...allocations.flatMap((allocation) => {
      const sku = String(allocation?.sku || '').trim();
      const stock = Number(allocation?.pos_stock);
      if (!sku || !Number.isSafeInteger(stock) || stock < 0) {
        throw new Error('Each Main Store POS allocation needs a SKU and a whole-number stock value.');
      }
      return [
        stmt('UPDATE pos_products SET stock_count=? WHERE sku=?', [stock, sku]),
        stmt(`INSERT INTO shared_inventory (tenant_id,sku,stock,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(tenant_id,sku) DO UPDATE SET stock=excluded.stock,updated_at=excluded.updated_at`,
        [tenantId, sku, stock, createdAt])
      ];
    })
  ]);
  await loadState();
  await render();
  return true;
}

async function recordSharedLocalSale(tenantId, eventId, items, updateMirrors = true) {
  const id = String(eventId || '').trim();
  if (!tenantId || !/^[a-zA-Z0-9_-]{1,120}$/.test(id) || !Array.isArray(items) || !items.length) {
    throw new Error('The shared stock sale is invalid.');
  }
  const normalized = new Map();
  for (const item of items) {
    const sku = String(item?.sku || '').trim();
    const quantity = Number(item?.quantity);
    if (!sku || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99999) {
      throw new Error('Each shared stock item needs a SKU and a positive whole-number quantity.');
    }
    normalized.set(sku, (normalized.get(sku) || 0) + quantity);
  }
  const existing = (await rows('SELECT event_id FROM shared_inventory_events WHERE tenant_id=? AND event_id=?',
    [tenantId, id]))[0];
  if (existing) return { duplicate: true };
  const createdAt = nowIso();
  await transaction([
    stmt('INSERT INTO shared_inventory_events (tenant_id,event_id,created_at) VALUES (?,?,?)',
      [tenantId, id, createdAt]),
    ...[...normalized].map(([sku, quantity]) =>
      stmt('INSERT INTO shared_inventory_event_items (tenant_id,event_id,sku,quantity) VALUES (?,?,?,?)',
        [tenantId, id, sku, quantity])),
    stmt(`INSERT INTO pos_inventory_queue (event_id,tenant_id,items_json,operation,status,updated_at)
      VALUES (?,?,?,'sale','pending',?)`,
    [id, tenantId, JSON.stringify([...normalized].map(([sku, quantity]) => ({ sku, quantity }))), createdAt])
  ]);
  if (updateMirrors) {
    await window.EshopInventoryBridge?.updateLocalStock?.(tenantId, await Promise.all([...normalized.keys()].map(async (sku) => ({
      sku,
      stock: Number((await rows('SELECT stock FROM shared_inventory WHERE tenant_id=? AND sku=?', [tenantId, sku]))[0]?.stock)
    }))));
  }
  return { duplicate: false };
}

export { recordSharedStockUpdate, applyMainStoreAllocations, recordSharedLocalSale };
