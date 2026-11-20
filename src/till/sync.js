// Cloud business sync: the outbox, the sync loop, status, switching or replacing the shop.
// Moved verbatim from pos.js: change sync behavior only with the owner's OK.
import { saveBusinessRecord } from './business-records.js';
import { rows, run, stmt, transaction } from './db.js';
import { nowIso } from './format.js';
import { listProducts } from './products.js';
import {
  POS_SAFETY_COPY_TABLES, createSafetyCopy, restoreSafetyCopy, safetyCopyDropStatements
} from './safety-copy.js';
import { getSettings } from './settings-store.js';

export function createCloudSync({
  state, sendNearbyChange, seedCloudCatalogueForTenant, applyRemoteChange, refresh
}) {
  let cloudSyncInProgress = false;
  let cloudSyncTimer = 0;

  async function queueCloudRecord(entity, recordId, payload, deleted = false, serverRevision = 0) {
    await saveBusinessRecord(entity, recordId, payload, deleted, serverRevision, state.cloudScopeId);
    await sendNearbyChange({
      entity, record_id: String(recordId), payload, deleted,
      revision: Number(serverRevision) || 0, changed_at: nowIso()
    });
    if (state.settings?.cloudSyncEnabled) {
      clearTimeout(cloudSyncTimer);
      cloudSyncTimer = setTimeout(() => {
        void syncCloudBusinessRecords().catch((error) => {
          state.cloudSyncError = error instanceof Error ? error.message : 'Cloud sync failed.';
        });
      }, 300);
    }
  }

  async function syncCloudBusinessRecords({ allowMassDelete = false } = {}) {
    if (cloudSyncInProgress || navigator.onLine === false || !state.settings?.cloudSyncEnabled) return;
    const tenantId = state.settings.cloudSyncTenantId;
    const bridge = window.EshopInventoryBridge;
    if (!tenantId || typeof bridge?.syncPosRecords !== 'function') return;
    cloudSyncInProgress = true;
    try {
      await seedCloudCatalogueForTenant(tenantId);
      let deviceId = (await rows("SELECT value FROM pos_settings WHERE key='cloud_sync_device_id'"))[0]?.value;
      if (!deviceId) {
        deviceId = `device-${crypto.randomUUID().replace(/-/g, '')}`;
        await run("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_device_id',?)", [deviceId]);
      }
      const pending = await rows(`SELECT change_id,entity,record_id,payload_json,deleted,created_at
        FROM pos_cloud_outbox WHERE tenant_id=? ORDER BY created_at LIMIT 100`, [tenantId]);
      for (let offset = 0; offset < pending.length; offset += 25) {
        const batch = pending.slice(offset, offset + 25);
        await bridge.syncPosRecords(tenantId, 'POST', {
          changes: batch.map((change) => ({
            change_id: change.change_id, device_id: deviceId, entity: change.entity,
            record_id: change.record_id, payload: JSON.parse(change.payload_json),
            deleted: change.deleted === 1, changed_at: change.created_at
          }))
        });
        await transaction(batch.map((change) =>
          stmt('DELETE FROM pos_cloud_outbox WHERE change_id=? AND tenant_id=?', [change.change_id, tenantId])));
      }
      const cursorKey = `cloud_sync_cursor:${tenantId}`;
      const cursor = Number((await rows('SELECT value FROM pos_settings WHERE key=?', [cursorKey]))[0]?.value || 0);
      let pageCursor = cursor;
      let latestRevision = cursor;
      let pagesRead = 0;
      let pageLength = 0;
      const latestChanges = new Map();
      do {
        const result = await bridge.syncPosRecords(tenantId, 'GET', { after: pageCursor, limit: 500 });
        if (!Array.isArray(result.changes) || !Number.isSafeInteger(Number(result.latest_revision))) {
          throw new Error('Cloud sync returned an invalid change list.');
        }
        latestRevision = Math.max(latestRevision, Number(result.latest_revision));
        pageLength = result.changes.length;
        for (const change of result.changes) {
          const revision = Number(change.revision) || 0;
          pageCursor = Math.max(pageCursor, revision);
          const key = `${change.entity}\u0000${change.record_id}`;
          const previous = latestChanges.get(key);
          if (!previous || revision > Number(previous.revision)) latestChanges.set(key, change);
        }
        pagesRead++;
      } while (pageCursor < latestRevision && pageLength === 500 && pagesRead < 20);

      // Background sync must never silently empty the catalogue. If other registers' deletions would
      // remove most of the products stored here, stop and ask the owner (manual "Save and sync now").
      if (!allowMassDelete) {
        const localSkus = new Set((await listProducts()).map((product) => product.sku));
        const doomed = [...latestChanges.values()].filter((change) => change.device_id !== deviceId
          && change.entity === 'product' && change.deleted && localSkus.has(change.payload?.sku)).length;
        if (doomed >= 5 && doomed * 2 > localSkus.size) {
          throw Object.assign(new Error(`Cloud sync paused: another register deleted ${doomed} of this device’s ${localSkus.size} products. Nothing was removed here. Check the other register, then use “Save and sync now” to confirm.`), { code: 'MASS_DELETE' });
        }
      }
      for (const change of latestChanges.values()) {
        if (change.device_id === deviceId) continue;
        if (!['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'].includes(change.entity)
          || typeof change.record_id !== 'string' || !change.payload || typeof change.payload !== 'object') {
          throw new Error('Cloud sync returned an invalid business record.');
        }
        const hasLocalPending = (await rows(`SELECT change_id FROM pos_cloud_outbox
          WHERE tenant_id=? AND entity=? AND record_id=? LIMIT 1`,
        [tenantId, change.entity, change.record_id])).length > 0;
        if (hasLocalPending) continue;
        await applyRemoteChange(change);
        const payloadJson = JSON.stringify(change.payload);
        await run(`INSERT INTO pos_business_records
          (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
          payload_json=excluded.payload_json,deleted=excluded.deleted,
          server_revision=excluded.server_revision,updated_at=excluded.updated_at
          WHERE excluded.server_revision > pos_business_records.server_revision
            OR excluded.updated_at > pos_business_records.updated_at`,
        [tenantId, change.entity, change.record_id, payloadJson, change.deleted ? 1 : 0,
          Number(change.revision) || 0, change.changed_at || nowIso()]);
        await sendNearbyChange({
          entity: change.entity, record_id: change.record_id, payload: change.payload,
          deleted: Boolean(change.deleted), revision: Number(change.revision) || 0,
          changed_at: change.changed_at || nowIso()
        });
      }
      if (pageCursor > cursor) await run('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', [cursorKey, String(pageCursor)]);
      state.cloudSyncError = '';
      await transaction([
        stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", []),
        stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)", [`cloud_sync_last_sync:${tenantId}`, nowIso()])
      ]);
    } catch (error) {
      state.cloudSyncError = error instanceof Error ? error.message : 'Cloud sync failed.';
      await run("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_error',?)",
        [state.cloudSyncError]);
      throw error;
    } finally {
      cloudSyncInProgress = false;
      window.EshopInventoryBridge?.onPosSyncStatusChanged?.();
    }
  }

  async function getCloudSyncStatus() {
    const settings = await getSettings();
    const tenantId = settings.cloudSyncTenantId;
    const pending = tenantId
      ? Number((await rows('SELECT COUNT(*) AS count FROM pos_cloud_outbox WHERE tenant_id=?', [tenantId]))[0]?.count || 0)
      : 0;
    const lastSync = tenantId
      ? (await rows('SELECT value FROM pos_settings WHERE key=?', [`cloud_sync_last_sync:${tenantId}`]))[0]?.value || ''
      : '';
    return { enabled: settings.cloudSyncEnabled, tenant: tenantId, pending, lastSync, error: settings.cloudSyncError };
  }

  async function syncCloudNow(options) {
    await syncCloudBusinessRecords(options);
    if (state.cloudSyncError) throw new Error(state.cloudSyncError);
    await refresh();
  }

  async function disconnectCloudSync() {
    clearTimeout(cloudSyncTimer);
    await transaction([
      stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_enabled','0')", []),
      stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
    ]);
    state.settings = await getSettings();
    state.cloudSyncError = '';
    await refresh();
  }

  async function switchCloudSyncTenant(tenantId) {
    if (!/^[a-z0-9-]{1,80}$/.test(tenantId)
      || typeof window.EshopInventoryBridge?.syncPosRecords !== 'function'
      || window.EshopInventoryBridge.activeWebsiteId?.() !== tenantId) {
      throw new Error('Connect this register to the shop you want to sync first.');
    }
    await window.EshopInventoryBridge.syncPosRecords(tenantId, 'GET', { after: 0, limit: 1 });
    await transaction([
      stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', ['cloud_sync_tenant_id', tenantId]),
      stmt('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', [`cloud_catalogue_seeded:${tenantId}`, '1']),
      stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", [])
    ]);
    state.settings = await getSettings();
    state.cloudScopeId = tenantId;
    await syncCloudBusinessRecords();
    if (state.cloudSyncError) throw new Error(state.cloudSyncError);
    await refresh();
  }

  // Replaces everything in this browser's POS with the shop's cloud records. It is destructive, so:
  // the caller must pass { confirmed: true } after the owner agreed; an empty cloud shop never
  // replaces a populated local catalogue unless { allowEmptyCatalogue: true } is also passed; and
  // the whole rewrite is reversible - the old tables are copied first and restored if any step
  // fails (or the page reloads mid-way), so a failed replace can never leave a wiped catalogue.
  async function replaceWithCloudShop(tenantId, { confirmed = false, allowEmptyCatalogue = false } = {}) {
    if (confirmed !== true) {
      throw new Error('Replacing this browser’s POS data needs explicit confirmation. Browser data has not been changed.');
    }
    if (!/^[a-z0-9-]{1,80}$/.test(tenantId)
      || typeof window.EshopInventoryBridge?.syncPosRecords !== 'function'
      || window.EshopInventoryBridge.activeWebsiteId?.() !== tenantId) {
      throw new Error('Connect this browser to the shop you want to use first.');
    }
    if (cloudSyncInProgress) throw new Error('Cloud sync is already running. Wait for it to finish, then try again.');

    const latestChanges = new Map();
    let cursor = 0;
    let latestRevision = 0;
    let pageLength = 0;
    let pagesRead = 0;
    do {
      const result = await window.EshopInventoryBridge.syncPosRecords(tenantId, 'GET', { after: cursor, limit: 500 });
      if (!Array.isArray(result.changes) || !Number.isSafeInteger(Number(result.latest_revision))) {
        throw new Error('The shop returned an invalid POS record list. Browser data has not been changed.');
      }
      latestRevision = Math.max(latestRevision, Number(result.latest_revision));
      pageLength = result.changes.length;
      for (const change of result.changes) {
        if (!change || !['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'].includes(change.entity)
          || typeof change.record_id !== 'string' || !change.payload || typeof change.payload !== 'object'
          || Array.isArray(change.payload) || !Number.isSafeInteger(Number(change.revision))) {
          throw new Error('The shop returned a malformed POS record. Browser data has not been changed.');
        }
        cursor = Math.max(cursor, Number(change.revision));
        const key = `${change.entity}\u0000${change.record_id}`;
        const previous = latestChanges.get(key);
        if (!previous || Number(change.revision) > Number(previous.revision)) latestChanges.set(key, change);
      }
      pagesRead += 1;
    } while (cursor < latestRevision && pageLength === 500 && pagesRead < 20);
    if (cursor < latestRevision) {
      throw new Error('The shop has more than 10,000 POS changes. Browser data has not been changed; sync through Cloudflare first.');
    }
    if (cloudSyncInProgress) throw new Error('Cloud sync started while preparing the replacement. Browser data has not been changed; wait and retry.');

    const orderedChanges = [...latestChanges.values()].sort((left, right) => {
      const priority = (entity) => entity === 'category' ? 0 : entity === 'product' ? 1 : 2;
      return priority(left.entity) - priority(right.entity) || Number(left.revision) - Number(right.revision);
    });
    const incomingProducts = orderedChanges.filter((change) => change.entity === 'product' && !change.deleted).length;
    const localProducts = Number((await rows('SELECT COUNT(*) AS count FROM pos_products'))[0]?.count || 0);
    if (!incomingProducts && localProducts && !allowEmptyCatalogue) {
      throw new Error(`This shop has no POS products in the cloud, so replacing would erase ${localProducts} product${localProducts === 1 ? '' : 's'} stored in this browser. Browser data has not been changed. Enable cloud sync from the phone that holds the catalogue first.`);
    }
    const previousScope = state.cloudScopeId;
    clearTimeout(cloudSyncTimer);
    cloudSyncInProgress = true;
    state.cloudSyncError = '';
    let safetyCopyReady = false;
    try {
      await createSafetyCopy(POS_SAFETY_COPY_TABLES);
      safetyCopyReady = true;
      await transaction([
        stmt('DELETE FROM shared_inventory_event_items', []),
        stmt('DELETE FROM shared_inventory_events', []),
        stmt('DELETE FROM shared_inventory', []),
        stmt('DELETE FROM pos_inventory_queue', []),
        stmt('DELETE FROM pos_invoice_items', []),
        stmt('DELETE FROM pos_invoices', []),
        stmt('DELETE FROM pos_sale_payments', []),
        stmt('DELETE FROM pos_sale_items', []),
        stmt('DELETE FROM pos_sales', []),
        stmt('DELETE FROM pos_cash_movements', []),
        stmt('DELETE FROM pos_till_closes', []),
        stmt('DELETE FROM pos_instances', []),
        stmt('DELETE FROM pos_expenses', []),
        stmt('DELETE FROM pos_products', []),
        stmt('DELETE FROM pos_categories', []),
        stmt('DELETE FROM pos_business_records', []),
        stmt('DELETE FROM pos_cloud_outbox', []),
        stmt('DELETE FROM pos_settings', []),
        stmt("INSERT INTO pos_categories (name) VALUES ('Other')", []),
        stmt("INSERT INTO pos_settings (key,value) VALUES ('currency','KES'),('tax_rate','0'),('cloud_sync_tenant_id',?),('cloud_sync_enabled','1'),(?, '1')",
          [tenantId, `cloud_catalogue_seeded:${tenantId}`])
      ]);
      state.cloudScopeId = tenantId;
      state.settings = await getSettings();
      for (const change of orderedChanges) {
        await applyRemoteChange(change);
        await run(`INSERT INTO pos_business_records
          (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
          payload_json=excluded.payload_json,deleted=excluded.deleted,
          server_revision=excluded.server_revision,updated_at=excluded.updated_at`,
        [tenantId, change.entity, change.record_id, JSON.stringify(change.payload),
          change.deleted ? 1 : 0, Number(change.revision), change.changed_at || nowIso()]);
      }
      // The new data and the removal of the safety copy commit together.
      await transaction([
        stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)", [`cloud_sync_cursor:${tenantId}`, String(cursor)]),
        stmt("INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)", [`cloud_sync_last_sync:${tenantId}`, nowIso()]),
        stmt("DELETE FROM pos_settings WHERE key='cloud_sync_error'", []),
        ...safetyCopyDropStatements(POS_SAFETY_COPY_TABLES)
      ]);
      safetyCopyReady = false;
      state.settings = await getSettings();
      await refresh();
      return { imported: orderedChanges.length };
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Could not replace browser POS data from the shop.';
      if (safetyCopyReady) {
        try {
          await restoreSafetyCopy(POS_SAFETY_COPY_TABLES);
          state.cloudScopeId = previousScope;
          state.settings = await getSettings();
          message += ' Your previous browser data was restored.';
        } catch (restoreError) {
          message += ` Your previous data is kept in a safety copy and will be restored when the POS next starts (${restoreError instanceof Error ? restoreError.message : 'restore failed'}).`;
        }
      }
      state.cloudSyncError = message;
      await run("INSERT OR REPLACE INTO pos_settings (key,value) VALUES ('cloud_sync_error',?)", [state.cloudSyncError]);
      await refresh();
      throw error instanceof Error ? Object.assign(error, { message }) : new Error(message);
    } finally {
      cloudSyncInProgress = false;
      window.EshopInventoryBridge?.onPosSyncStatusChanged?.();
    }
  }

  return {
    queueCloudRecord, syncCloudBusinessRecords, getCloudSyncStatus, syncCloudNow,
    disconnectCloudSync, switchCloudSyncTenant, replaceWithCloudShop
  };
}
