CREATE TABLE IF NOT EXISTS storefront_service_appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_price_cents INTEGER NOT NULL CHECK (service_price_cents >= 0),
  currency TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240 AND duration_minutes % 15 = 0),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  slot_reserved_until TEXT NOT NULL,
  timezone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirming', 'confirmed', 'rejected', 'cancelled')),
  request_expires_at TEXT NOT NULL,
  deposit_percent INTEGER NOT NULL CHECK (deposit_percent BETWEEN 0 AND 100),
  deposit_cents INTEGER NOT NULL CHECK (deposit_cents >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('not_required', 'initializing', 'pending', 'paid', 'failed')),
  payment_reference TEXT,
  payment_authorization_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS storefront_service_appointments_tenant_start
  ON storefront_service_appointments (tenant_id, starts_at);

CREATE INDEX IF NOT EXISTS storefront_service_appointments_tenant_status_created
  ON storefront_service_appointments (tenant_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS storefront_service_appointments_payment_reference
  ON storefront_service_appointments (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS storefront_appointment_slots (
  tenant_id TEXT NOT NULL,
  slot_start TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, slot_start)
);

CREATE INDEX IF NOT EXISTS storefront_appointment_slots_appointment
  ON storefront_appointment_slots (tenant_id, appointment_id);

CREATE INDEX IF NOT EXISTS storefront_appointment_slots_expiration
  ON storefront_appointment_slots (tenant_id, expires_at);
