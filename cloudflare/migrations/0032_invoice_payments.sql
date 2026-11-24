-- Online payment for POS invoices. An invoice itself lives on the owner's device; this table only holds the
-- payment request made for it: one row per invoice, with an unguessable token that forms the customer's
-- pay link (/pay/<token>) and the Paystack reference once the customer starts paying.
CREATE TABLE IF NOT EXISTS invoice_payments (
  token TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  shop_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'initializing', 'pending', 'paid', 'failed')),
  payment_reference TEXT,
  payment_subaccount_code TEXT,
  payment_authorization_url TEXT,
  channel TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, invoice_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_reference
  ON invoice_payments (payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant
  ON invoice_payments (tenant_id, updated_at DESC);
