CREATE TABLE IF NOT EXISTS custom_hostnames (
  hostname TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  cloudflare_hostname_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  ssl_status TEXT NOT NULL,
  validation_records TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS custom_hostnames_tenant
  ON custom_hostnames (tenant_id);
