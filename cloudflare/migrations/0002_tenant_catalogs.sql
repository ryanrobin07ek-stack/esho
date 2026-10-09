ALTER TABLE catalog_snapshots RENAME TO catalog_snapshots_legacy;

CREATE TABLE catalog_snapshots (
  tenant_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO catalog_snapshots (tenant_id, payload, updated_at)
SELECT 'main', payload, updated_at FROM catalog_snapshots_legacy;

DROP TABLE catalog_snapshots_legacy;
