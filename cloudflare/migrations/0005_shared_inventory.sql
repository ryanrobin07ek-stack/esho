CREATE TABLE IF NOT EXISTS inventory_stock (
  tenant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  stock INTEGER NOT NULL CHECK (stock >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_events (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE TABLE IF NOT EXISTS inventory_event_items (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (tenant_id, event_id, sku),
  FOREIGN KEY (tenant_id, event_id) REFERENCES inventory_events(tenant_id, event_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, sku) REFERENCES inventory_stock(tenant_id, sku)
);

CREATE TRIGGER IF NOT EXISTS inventory_event_item_check_stock
BEFORE INSERT ON inventory_event_items
BEGIN
  SELECT RAISE(ABORT, 'insufficient_stock')
  WHERE NOT EXISTS (
    SELECT 1 FROM inventory_stock
    WHERE tenant_id = NEW.tenant_id AND sku = NEW.sku AND stock >= NEW.quantity
  );
END;

CREATE TRIGGER IF NOT EXISTS inventory_event_item_deduct_stock
AFTER INSERT ON inventory_event_items
BEGIN
  UPDATE inventory_stock
  SET stock = stock - NEW.quantity, updated_at = datetime('now')
  WHERE tenant_id = NEW.tenant_id AND sku = NEW.sku;
END;
