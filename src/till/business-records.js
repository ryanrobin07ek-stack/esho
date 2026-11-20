// Generic business records (suppliers, purchases, tickets, cloud sales) kept for cloud sync.
import { rows, stmt, transaction } from './db.js';
import { nowIso, numberTag } from './format.js';

function businessRecordStatements(entity, recordId, payload, deleted = false, serverRevision = 0, tenantId = 'local') {
  if (!['supplier', 'purchase', 'ticket', 'sale', 'product', 'category', 'expense', 'setting'].includes(entity)
    || !/^[A-Za-z0-9_-]{1,120}$/.test(String(recordId || ''))
    || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('This business record cannot be saved for sync.');
  }
  const changedAt = nowIso();
  const changeId = numberTag('SYNC');
  const payloadJson = JSON.stringify(payload);
  const scope = String(tenantId || 'local');
  return [
    stmt(`INSERT INTO pos_business_records (tenant_id,entity,record_id,payload_json,deleted,server_revision,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,entity,record_id) DO UPDATE SET
      payload_json=excluded.payload_json,deleted=excluded.deleted,
      server_revision=MAX(pos_business_records.server_revision,excluded.server_revision),updated_at=excluded.updated_at`,
    [scope, entity, String(recordId), payloadJson, deleted ? 1 : 0, serverRevision, changedAt]),
    stmt(`INSERT INTO pos_cloud_outbox (change_id,tenant_id,entity,record_id,payload_json,deleted,created_at)
      VALUES (?,?,?,?,?,?,?)`,
    [changeId, scope, entity, String(recordId), payloadJson, deleted ? 1 : 0, changedAt])
  ];
}

async function saveBusinessRecord(entity, recordId, payload, deleted = false, serverRevision = 0, tenantId = 'local') {
  await transaction(businessRecordStatements(entity, recordId, payload, deleted, serverRevision, tenantId));
}

async function listBusinessRecords(entity, tenantId = 'local') {
  const records = await rows(`SELECT record_id,payload_json,server_revision FROM pos_business_records
    WHERE tenant_id=? AND entity=? AND deleted=0 ORDER BY updated_at DESC`, [tenantId, entity]);
  return records.map((record) => {
    let payload;
    try {
      payload = JSON.parse(record.payload_json);
    } catch {
      throw new Error(`Saved ${entity} record ${record.record_id} has invalid data.`);
    }
    return { ...payload, id: record.record_id, serverRevision: Number(record.server_revision) || 0 };
  });
}

export { businessRecordStatements, saveBusinessRecord, listBusinessRecords };
