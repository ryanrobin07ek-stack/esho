-- Live stock per product option (Size M, Colour Red), the counterpart of main_store_inventory.web_stock
-- for variants. Until now a variant's stock lived only inside the published catalogue JSON and nothing
-- ever wrote back to it, so selling "Size M" never reduced it and a shop could oversell a size forever.
--
-- published_stock remembers what the owner last published. A republish that does not change that number
-- leaves the live count alone, so republishing never resurrects stock that has already been sold; a
-- republish that does change it is the owner restocking, and the live count follows.
CREATE TABLE IF NOT EXISTS storefront_variant_stock (
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  published_stock INTEGER NOT NULL DEFAULT 0 CHECK (published_stock >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, product_id, variant_id)
);

-- One row per order and variant, so a settlement that is replayed (webhook, verify and a manual
-- record can all land) deducts exactly once.
CREATE TABLE IF NOT EXISTS storefront_variant_deductions (
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, order_number, product_id, variant_id)
);

-- Only variants the shop actually tracks are guarded, so an order for an untracked product is
-- unaffected, exactly as the SKU-level deduction behaves.
CREATE TRIGGER IF NOT EXISTS storefront_variant_order_check
BEFORE INSERT ON storefront_variant_deductions
WHEN EXISTS (
  SELECT 1 FROM storefront_variant_stock
  WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id AND variant_id=NEW.variant_id
)
BEGIN
  SELECT RAISE(ABORT, 'insufficient_variant_stock')
  WHERE NOT EXISTS (
    SELECT 1 FROM storefront_variant_stock
    WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id AND variant_id=NEW.variant_id
      AND stock >= NEW.quantity
  );
END;

CREATE TRIGGER IF NOT EXISTS storefront_variant_order_deduct
AFTER INSERT ON storefront_variant_deductions
WHEN EXISTS (
  SELECT 1 FROM storefront_variant_stock
  WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id AND variant_id=NEW.variant_id
)
BEGIN
  UPDATE storefront_variant_stock
  SET stock=stock-NEW.quantity, updated_at=NEW.created_at
  WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id AND variant_id=NEW.variant_id;
END;
