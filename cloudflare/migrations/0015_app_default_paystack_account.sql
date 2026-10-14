CREATE TABLE IF NOT EXISTS paystack_owner_defaults (
  owner_username TEXT PRIMARY KEY,
  source_tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
