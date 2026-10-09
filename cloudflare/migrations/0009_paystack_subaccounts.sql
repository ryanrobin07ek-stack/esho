CREATE TABLE IF NOT EXISTS paystack_subaccounts (
  tenant_id TEXT PRIMARY KEY,
  subaccount_code TEXT UNIQUE,
  status TEXT NOT NULL,
  bank_name TEXT NOT NULL DEFAULT '',
  account_last4 TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
