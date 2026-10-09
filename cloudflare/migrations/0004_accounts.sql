CREATE TABLE IF NOT EXISTS accounts (
  username TEXT PRIMARY KEY,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_tenants (
  username TEXT NOT NULL REFERENCES accounts(username) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL UNIQUE,
  PRIMARY KEY (username, tenant_id)
);
