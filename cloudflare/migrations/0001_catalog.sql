CREATE TABLE IF NOT EXISTS catalog_snapshots (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
