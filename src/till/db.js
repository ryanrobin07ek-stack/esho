// Thin wrappers over window.ShopSQLite used by every till module.

const rows = async (sql, values = []) => (await window.ShopSQLite.query(sql, values)).values || [];
const run = (sql, values = []) => window.ShopSQLite.run(sql, values);
const transaction = (statements) => window.ShopSQLite.executeSet(statements, true);
const stmt = (statement, values = []) => ({ statement, values });

export { rows, run, transaction, stmt };
