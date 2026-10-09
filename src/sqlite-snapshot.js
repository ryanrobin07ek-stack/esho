export function hasPersistedSQLiteData(snapshot) {
  return Boolean(
    snapshot?.tables &&
    Object.values(snapshot.tables).some(rows => Array.isArray(rows) && rows.length > 0)
  );
}
