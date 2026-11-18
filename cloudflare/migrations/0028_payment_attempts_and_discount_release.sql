-- Every Paystack reference ever issued for an order. storefront_orders.payment_reference only holds the
-- newest one, so a customer paying an older (re-initialised) checkout link would otherwise never be matched
-- to the order. The webhook and verify endpoint look a reference up here when it is not the current one.
CREATE TABLE IF NOT EXISTS storefront_payment_attempts (
  reference TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  subaccount_code TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS storefront_payment_attempts_order
  ON storefront_payment_attempts (tenant_id, order_number);

-- discount_released=1 means this (cancelled) order has already given its discount redemption back, so a
-- cancel -> reopen -> cancel cycle releases exactly once and reopening re-reserves it.
ALTER TABLE storefront_orders ADD COLUMN discount_released INTEGER NOT NULL DEFAULT 0;

UPDATE storefront_orders SET discount_released = 1
  WHERE status = 'cancelled' AND discount_code IS NOT NULL AND discount_code != '';
