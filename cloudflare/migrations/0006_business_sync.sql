CREATE TABLE IF NOT EXISTS business_branches (
  tenant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, store_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  tenant_id TEXT NOT NULL,
  endpoint_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, endpoint_hash)
);
