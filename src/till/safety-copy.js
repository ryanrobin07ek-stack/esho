import { rows, stmt, transaction } from './db.js';

// Reversible bulk rewrites. Anything that replaces many rows at once (replacing the browser POS
// with a shop's cloud records, restoring an inventory backup) first copies the affected tables
// inside SQLite (blobs and all), then rolls back from the copy if the rewrite fails part-way.
// The copies are only dropped once the rewrite has fully succeeded, so a crash or reload during
// the rewrite is also undone by recoverInterruptedBulkChange() the next time the POS starts.
const SAFETY_COPY_PREFIX = 'pos_safety_';
// Parents before children, so a copy can be re-inserted in this order and deleted in reverse.
export const POS_SAFETY_COPY_TABLES = [
  'pos_settings', 'pos_cloud_outbox', 'pos_business_records', 'pos_categories', 'pos_products', 'pos_expenses',
  'pos_instances', 'pos_till_closes', 'pos_cash_movements', 'pos_sales', 'pos_sale_payments', 'pos_sale_items',
  'pos_invoices', 'pos_invoice_items', 'pos_inventory_queue', 'shared_inventory', 'shared_inventory_events',
  'shared_inventory_event_items'
];
const orderedSafetyTables = (tables) => POS_SAFETY_COPY_TABLES.filter((table) => tables.includes(table));
async function createSafetyCopy(tables) {
  await transaction(orderedSafetyTables(tables).flatMap((table) => [
    stmt(`DROP TABLE IF EXISTS ${SAFETY_COPY_PREFIX}${table}`),
    stmt(`CREATE TABLE ${SAFETY_COPY_PREFIX}${table} AS SELECT * FROM ${table}`)
  ]));
}
async function dropSafetyCopy(tables) {
  await transaction(orderedSafetyTables(tables).map((table) => stmt(`DROP TABLE IF EXISTS ${SAFETY_COPY_PREFIX}${table}`)));
}
function safetyCopyDropStatements(tables) {
  return orderedSafetyTables(tables).map((table) => stmt(`DROP TABLE IF EXISTS ${SAFETY_COPY_PREFIX}${table}`));
}
async function restoreSafetyCopy(tables) {
  const ordered = orderedSafetyTables(tables);
  const statements = [...ordered].reverse().map((table) => stmt(`DELETE FROM ${table}`));
  for (const table of ordered) {
    const columns = (await rows(`PRAGMA table_info(${SAFETY_COPY_PREFIX}${table})`)).map((column) => column.name);
    if (!columns.length) throw new Error(`The safety copy of ${table} is missing; it cannot be restored.`);
    const list = columns.map((column) => `"${column}"`).join(',');
    statements.push(stmt(`INSERT INTO ${table} (${list}) SELECT ${list} FROM ${SAFETY_COPY_PREFIX}${table}`));
  }
  statements.push(...safetyCopyDropStatements(ordered));
  await transaction(statements);
}
export async function recoverInterruptedBulkChange() {
  const copies = (await rows("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'pos!_safety!_%' ESCAPE '!'"))
    .map((row) => String(row.name).slice(SAFETY_COPY_PREFIX.length));
  const tables = orderedSafetyTables(copies);
  if (!tables.length) return false;
  await restoreSafetyCopy(tables);
  return true;
}

export { createSafetyCopy, dropSafetyCopy, safetyCopyDropStatements, restoreSafetyCopy };
