CREATE TABLE IF NOT EXISTS storefront_product_interest (
  tenant_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  product_id TEXT NOT NULL,
  cart_quantity INTEGER NOT NULL DEFAULT 0 CHECK (cart_quantity BETWEEN 0 AND 99),
  cart_updated_at TEXT NOT NULL DEFAULT '',
  wishlist_active INTEGER NOT NULL DEFAULT 0 CHECK (wishlist_active IN (0, 1)),
  wishlist_updated_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, visitor_hash, product_id)
);

CREATE INDEX IF NOT EXISTS storefront_product_interest_tenant_updated
  ON storefront_product_interest (tenant_id, updated_at);

CREATE TABLE IF NOT EXISTS storefront_hold_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  customer_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'released')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT '',
  released_at TEXT NOT NULL DEFAULT '',
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS storefront_hold_requests_tenant_created
  ON storefront_hold_requests (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS storefront_hold_requests_tenant_product_status
  ON storefront_hold_requests (tenant_id, product_id, status, expires_at);
