CREATE TABLE IF NOT EXISTS main_store_inventory (
  tenant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  source_channel TEXT NOT NULL CHECK (source_channel IN ('pos', 'web', 'both')),
  pos_enabled INTEGER NOT NULL CHECK (pos_enabled IN (0, 1)),
  web_enabled INTEGER NOT NULL CHECK (web_enabled IN (0, 1)),
  master_stock INTEGER NOT NULL CHECK (master_stock >= 0),
  pos_stock INTEGER NOT NULL CHECK (pos_stock >= 0),
  web_stock INTEGER NOT NULL CHECK (web_stock >= 0),
  reserved_stock INTEGER NOT NULL CHECK (reserved_stock >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, sku),
  CHECK (master_stock = pos_stock + web_stock + reserved_stock),
  CHECK (pos_enabled = 1 OR pos_stock = 0),
  CHECK (web_enabled = 1 OR web_stock = 0)
);

CREATE INDEX IF NOT EXISTS main_store_inventory_tenant_product
  ON main_store_inventory (tenant_id, product_id);

CREATE TRIGGER IF NOT EXISTS main_store_inventory_stock_insert_check
BEFORE INSERT ON inventory_stock
WHEN EXISTS (
  SELECT 1 FROM main_store_inventory
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND pos_stock != NEW.stock
)
BEGIN
  SELECT RAISE(ABORT, 'pos_channel_not_allocated')
  WHERE NOT EXISTS (
    SELECT 1 FROM main_store_inventory
    WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND pos_enabled=1
      AND master_stock + NEW.stock - pos_stock >= web_stock + reserved_stock
  ) AND NOT EXISTS (
    SELECT 1 FROM main_store_inventory
    WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND pos_enabled=0 AND NEW.stock=0
  );
END;

CREATE TRIGGER IF NOT EXISTS main_store_inventory_stock_insert_sync
AFTER INSERT ON inventory_stock
WHEN EXISTS (
  SELECT 1 FROM main_store_inventory
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND pos_stock != NEW.stock
)
BEGIN
  UPDATE main_store_inventory
  SET master_stock=master_stock+NEW.stock-pos_stock,
      pos_stock=NEW.stock, updated_at=NEW.updated_at
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku;
END;

CREATE TRIGGER IF NOT EXISTS main_store_inventory_stock_update_check
BEFORE UPDATE OF stock ON inventory_stock
WHEN EXISTS (
  SELECT 1 FROM main_store_inventory
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND pos_stock != NEW.stock
)
BEGIN
  SELECT RAISE(ABORT, 'pos_channel_not_allocated')
  WHERE NOT EXISTS (
    SELECT 1 FROM main_store_inventory
    WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND pos_enabled=1
      AND master_stock + NEW.stock - pos_stock >= web_stock + reserved_stock
  ) AND NOT EXISTS (
    SELECT 1 FROM main_store_inventory
    WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND pos_enabled=0 AND NEW.stock=0
  );
END;

CREATE TRIGGER IF NOT EXISTS main_store_inventory_stock_update_sync
AFTER UPDATE OF stock ON inventory_stock
WHEN EXISTS (
  SELECT 1 FROM main_store_inventory
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND NEW.stock != OLD.stock
    AND pos_stock != NEW.stock
)
BEGIN
  UPDATE main_store_inventory
  SET master_stock=master_stock+NEW.stock-pos_stock,
      pos_stock=NEW.stock, updated_at=NEW.updated_at
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku;
END;

CREATE TRIGGER IF NOT EXISTS main_store_pos_sale_check
BEFORE INSERT ON inventory_event_items
WHEN EXISTS (
  SELECT 1 FROM main_store_inventory
  WHERE tenant_id = NEW.tenant_id AND sku = NEW.sku AND pos_enabled = 1
)
BEGIN
  SELECT RAISE(ABORT, 'insufficient_pos_allocation')
  WHERE NOT EXISTS (
    SELECT 1 FROM main_store_inventory
    WHERE tenant_id = NEW.tenant_id AND sku = NEW.sku
      AND pos_enabled = 1 AND pos_stock >= NEW.quantity
  );
END;

DROP TRIGGER IF EXISTS main_store_pos_sale_deduct;

CREATE TABLE IF NOT EXISTS storefront_inventory_deductions (
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, order_number, sku)
);

CREATE TRIGGER IF NOT EXISTS main_store_web_order_check
BEFORE INSERT ON storefront_inventory_deductions
WHEN EXISTS (
  SELECT 1 FROM main_store_inventory
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku
)
BEGIN
  SELECT RAISE(ABORT, 'insufficient_web_allocation')
  WHERE NOT EXISTS (
    SELECT 1 FROM main_store_inventory
    WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku AND web_enabled=1
      AND web_stock >= NEW.quantity + COALESCE((
        SELECT SUM(hold.quantity) FROM storefront_hold_requests hold
        WHERE hold.tenant_id=NEW.tenant_id AND hold.product_id=NEW.product_id
          AND hold.status='approved' AND hold.expires_at>NEW.created_at
      ),0)
  );
END;

CREATE TRIGGER IF NOT EXISTS main_store_web_order_deduct
AFTER INSERT ON storefront_inventory_deductions
WHEN EXISTS (
  SELECT 1 FROM main_store_inventory
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku
)
BEGIN
  UPDATE main_store_inventory
  SET web_stock=web_stock-NEW.quantity,
      master_stock=master_stock-NEW.quantity,
      updated_at=NEW.created_at
  WHERE tenant_id=NEW.tenant_id AND sku=NEW.sku;
END;
