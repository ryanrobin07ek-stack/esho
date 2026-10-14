ALTER TABLE paystack_subaccounts RENAME TO paystack_subaccounts_previous;

CREATE TABLE paystack_subaccounts (
  tenant_id TEXT PRIMARY KEY,
  subaccount_code TEXT,
  status TEXT NOT NULL,
  bank_name TEXT NOT NULL DEFAULT '',
  account_last4 TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO paystack_subaccounts
  (tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at)
SELECT tenant_id,subaccount_code,status,bank_name,account_last4,created_at,updated_at
FROM paystack_subaccounts_previous
WHERE subaccount_code IS NOT NULL;

DROP TABLE paystack_subaccounts_previous;

CREATE INDEX paystack_subaccounts_code_idx ON paystack_subaccounts (subaccount_code);
