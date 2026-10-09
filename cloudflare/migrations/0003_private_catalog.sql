ALTER TABLE catalog_snapshots
ADD COLUMN admin_payload TEXT NOT NULL DEFAULT '{}';
