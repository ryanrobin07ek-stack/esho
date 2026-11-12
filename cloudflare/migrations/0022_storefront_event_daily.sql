CREATE TABLE IF NOT EXISTS storefront_event_daily (
  tenant_id TEXT NOT NULL,
  day TEXT NOT NULL,
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'wishlist_add', 'cart_add', 'booking')),
  n INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (tenant_id, day, product_id, event_type)
);
