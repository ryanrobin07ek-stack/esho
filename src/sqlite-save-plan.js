// Deciding WHAT to write, separately from writing it, so it can be tested without a phone.
//
// The app keeps its data as one big snapshot and used to rewrite the whole database on every save,
// in a single message to the native SQLite plugin. With ~22 MB of website drafts that message became
// a 54 MB string in the Capacitor bridge and Android killed the app. These two functions make a save
// write only what changed, in batches small enough to never do that again.

export const BATCH_CHARS = 1_000_000;

/**
 * @param snapshot { tables: { [table]: rows[] } } the data as the app has it now.
 * @param known Map<table, { ids: rowId[], json: string[] }> what is on disk, in row order.
 * @param tables the table names, in the order they are saved.
 * @returns jobs: { table, kind: 'update', next, updates: [{ index, rowId, json }] }
 *               | { table, kind: 'rewrite', next }
 */
export function planSave(snapshot, known, tables) {
  const work = [];
  for (const table of tables) {
    const next = (snapshot.tables[table] || []).map(row => JSON.stringify(row));
    const previous = known.get(table);
    if (previous && previous.json.length === next.length) {
      const updates = [];
      for (let index = 0; index < next.length; index += 1) {
        if (previous.json[index] !== next[index]) {
          updates.push({ index, rowId: previous.ids[index], json: next[index] });
        }
      }
      // Same rows, same order, nothing changed: this table costs nothing to save.
      if (updates.length) work.push({ table, kind: 'update', next, updates });
      continue;
    }
    // Rows were added or removed, or nothing is known about this table yet: rewrite just this table.
    work.push({ table, kind: 'rewrite', next });
  }
  return work;
}

/** Splits the statements into batches of about `limit` characters each, keeping their order. */
export function batchStatements(work, limit = BATCH_CHARS) {
  const batches = [];
  let current = [];
  let size = 0;
  const push = (statement, values) => {
    const weight = statement.length + values.reduce((total, value) => total + String(value).length, 0);
    // A single row larger than the limit still travels, just on its own.
    if (current.length && size + weight > limit) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push({ statement, values });
    size += weight;
  };
  for (const job of work) {
    if (job.kind === 'update') {
      for (const update of job.updates) {
        push(`UPDATE "${job.table}" SET payload=? WHERE row_id=?`, [update.json, update.rowId]);
      }
      continue;
    }
    push(`DELETE FROM "${job.table}"`, []);
    for (const json of job.next) push(`INSERT INTO "${job.table}" (payload) VALUES (?)`, [json]);
  }
  if (current.length) batches.push(current);
  return batches;
}
