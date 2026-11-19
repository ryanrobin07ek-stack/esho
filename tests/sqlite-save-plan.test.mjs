// The app crashed on the phone with OutOfMemoryError in com.getcapacitor.Bridge.callPluginMethod:
// every save rewrote the whole database (≈22 MB, mostly website drafts) in ONE message to the native
// SQLite plugin. These tests hold the replacement to its two promises: write only what changed, and
// never put more than about a megabyte in one message, while the database still ends up exactly
// matching the app's data.
import assert from "node:assert/strict";
import test from "node:test";
import initSqlJs from "sql.js";
import { BATCH_CHARS, batchStatements, planSave } from "../src/sqlite-save-plan.js";

const TABLES = ["store", "products", "studio_settings"];
const draft = (key, size) => ({ id: key, key, value: "<html>" + "x".repeat(size) + "</html>" });

// A small stand-in for the phone's database, applying batches the way sqlite.js does.
async function openDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  for (const table of TABLES) {
    db.run(`CREATE TABLE "${table}" (row_id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL)`);
  }
  const known = new Map(TABLES.map(table => [table, { ids: [], json: [] }]));
  const messages = [];
  const save = snapshot => {
    const work = planSave(snapshot, known, TABLES);
    const batches = batchStatements(work);
    db.run("BEGIN");
    for (const batch of batches) {
      messages.push(JSON.stringify(batch).length);
      for (const { statement, values } of batch) db.run(statement, values);
    }
    db.run("COMMIT");
    for (const job of work) {
      if (job.kind === "update") {
        for (const update of job.updates) known.get(job.table).json[update.index] = update.json;
        continue;
      }
      const ids = (db.exec(`SELECT row_id FROM "${job.table}" ORDER BY row_id`)[0]?.values || []).map(row => row[0]);
      known.set(job.table, { ids, json: job.next.slice() });
    }
    return { work, batches };
  };
  const read = table => (db.exec(`SELECT payload FROM "${table}" ORDER BY row_id`)[0]?.values || [])
    .map(row => JSON.parse(row[0]));
  return { save, read, messages };
}

test("a save with nothing changed writes nothing at all", async () => {
  const phone = await openDatabase();
  const data = { tables: { store: [{ id: 1, name: "Shop" }], products: [{ id: 7, name: "Shirt" }], studio_settings: [] } };
  phone.save(data);
  const again = phone.save(JSON.parse(JSON.stringify(data)));
  assert.equal(again.work.length, 0, "an unchanged snapshot must not touch the database");
  assert.equal(again.batches.length, 0);
});

test("editing one draft updates that one row, not the whole database", async () => {
  const phone = await openDatabase();
  const data = {
    tables: {
      store: [{ id: 1, name: "Shop" }],
      products: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Product ${i}` })),
      studio_settings: [draft("amani", 200_000), draft("lala", 200_000), draft("solana", 200_000)]
    }
  };
  phone.save(data);
  data.tables.studio_settings[1] = draft("lala", 210_000);
  const { work, batches } = phone.save(data);
  assert.deepEqual(work.map(job => [job.table, job.kind, job.updates?.length]), [["studio_settings", "update", 1]]);
  assert.equal(batches.length, 1);
  assert.match(batches[0][0].statement, /^UPDATE "studio_settings" SET payload=\? WHERE row_id=\?$/);
  assert.deepEqual(phone.read("studio_settings"), data.tables.studio_settings, "the database matches the app");
  assert.equal(phone.read("products").length, 50, "products were left alone and are intact");
});

test("a database the size of the one on the phone never sends a message big enough to crash", async () => {
  // Measured on the phone: 33 drafts, 21.45 M characters, the largest 1.86 M.
  const phone = await openDatabase();
  const sizes = [1.86, 1.65, 1.53, 1.47, 1.39, 1.38, 1.35, 1.32, 1.31, 1.27, 1.19, 1.15, 1.08, 0.75];
  const drafts = sizes.map((mb, i) => draft(`shop-${i}`, Math.round(mb * 1_048_576)));
  const data = { tables: { store: [{ id: 1 }], products: [{ id: 1, name: "Shirt" }], studio_settings: drafts } };
  phone.save(data);
  const biggestRow = Math.max(...drafts.map(row => JSON.stringify(row).length));
  const biggestMessage = Math.max(...phone.messages);
  // Old behaviour: one message carrying everything (~19 M characters here, 54 MB on the phone).
  assert.ok(biggestMessage < biggestRow + 100_000,
    `largest message ${biggestMessage} chars must be about one row, never the whole database`);
  assert.ok(phone.messages.length >= sizes.length / 2, "the write is spread over many small messages");
  assert.deepEqual(phone.read("studio_settings").map(row => row.key), drafts.map(row => row.key));
});

test("adding and removing rows rewrites only that table, and later saves stay in step", async () => {
  const phone = await openDatabase();
  const data = { tables: { store: [{ id: 1 }], products: [{ id: 1 }, { id: 2 }], studio_settings: [draft("a", 10)] } };
  phone.save(data);

  data.tables.products.push({ id: 3 });
  let result = phone.save(data);
  assert.deepEqual(result.work.map(job => [job.table, job.kind]), [["products", "rewrite"]]);
  assert.deepEqual(phone.read("products"), data.tables.products);

  // The new row ids were read back, so an edit after a rewrite lands on the right row.
  data.tables.products[2] = { id: 3, name: "Renamed" };
  result = phone.save(data);
  assert.deepEqual(result.work.map(job => [job.table, job.kind]), [["products", "update"]]);
  assert.deepEqual(phone.read("products"), data.tables.products);

  data.tables.products.splice(0, 1);
  phone.save(data);
  assert.deepEqual(phone.read("products"), data.tables.products, "a removed row is gone from disk too");
});

test("batches respect the limit, and an oversized row still travels on its own", () => {
  const work = [{ table: "studio_settings", kind: "rewrite", next: ["a".repeat(600), "b".repeat(600), "c".repeat(5000), "d"] }];
  const batches = batchStatements(work, 1000);
  for (const batch of batches) {
    const size = batch.reduce((n, s) => n + s.statement.length + s.values.reduce((m, v) => m + String(v).length, 0), 0);
    assert.ok(size <= 1000 || batch.length === 1, `batch of ${size} chars must fit, unless it is one big row`);
  }
  assert.equal(batches.flat()[0].statement, 'DELETE FROM "studio_settings"', "the delete still comes first");
  assert.equal(batches.flat().length, 5, "every statement is kept, in order");
  assert.ok(BATCH_CHARS <= 2_000_000);
});
