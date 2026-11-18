-- Owner-recorded payments (cash, mobile_money, bank, other) and settlement flags.
-- payment_method is NULL for Paystack payments and unpaid orders.
-- needs_attention=1 means money was received but stock could not be fully deducted at settlement.
-- discount_code is the redeemed code (discount_cents holds the amount taken off).
ALTER TABLE storefront_orders ADD COLUMN payment_method TEXT;
ALTER TABLE storefront_orders ADD COLUMN manual_payment_reference TEXT;
ALTER TABLE storefront_orders ADD COLUMN needs_attention INTEGER NOT NULL DEFAULT 0;
ALTER TABLE storefront_orders ADD COLUMN attention_reason TEXT;
ALTER TABLE storefront_orders ADD COLUMN discount_code TEXT;

CREATE INDEX IF NOT EXISTS storefront_orders_tenant_attention
  ON storefront_orders (tenant_id, needs_attention)
  WHERE needs_attention = 1;
