-- Server-side discount codes, tenant scoped. type='percent' stores a whole percent (1-100);
-- type='fixed' stores integer minor units (cents). min_order_cents is checked against the item subtotal.
-- used_count is incremented atomically at order creation and given back when the order is cancelled.
CREATE TABLE IF NOT EXISTS discount_codes (
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value INTEGER NOT NULL CHECK (value >= 1),
  min_order_cents INTEGER NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
  starts_at TEXT,
  ends_at TEXT,
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit >= 1),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS discount_codes_tenant_created
  ON discount_codes (tenant_id, created_at DESC);
