CREATE TABLE IF NOT EXISTS pos_sync_changes (
  revision INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  changed_at TEXT NOT NULL,
  UNIQUE (tenant_id, change_id)
);

CREATE INDEX IF NOT EXISTS pos_sync_changes_tenant_revision
  ON pos_sync_changes (tenant_id, revision);

CREATE TABLE IF NOT EXISTS storefront_visits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS storefront_visits_tenant_created
  ON storefront_visits (tenant_id, created_at);
