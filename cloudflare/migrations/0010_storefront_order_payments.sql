ALTER TABLE storefront_orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE storefront_orders ADD COLUMN payment_reference TEXT;
ALTER TABLE storefront_orders ADD COLUMN payment_authorization_url TEXT;
ALTER TABLE storefront_orders ADD COLUMN paid_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS storefront_orders_payment_reference
  ON storefront_orders (payment_reference)
  WHERE payment_reference IS NOT NULL;
