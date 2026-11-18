-- Funnel events (checkout_start, purchase, booking_submitted) join the daily per-product event counters.
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt and the existing counts are copied over.
CREATE TABLE storefront_event_daily_new (
  tenant_id TEXT NOT NULL,
  day TEXT NOT NULL,
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'view', 'wishlist_add', 'cart_add', 'booking', 'checkout_start', 'purchase', 'booking_submitted'
  )),
  n INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (tenant_id, day, product_id, event_type)
);

INSERT INTO storefront_event_daily_new (tenant_id, day, product_id, event_type, n)
  SELECT tenant_id, day, product_id, event_type, n FROM storefront_event_daily;

DROP TABLE storefront_event_daily;
ALTER TABLE storefront_event_daily_new RENAME TO storefront_event_daily;
