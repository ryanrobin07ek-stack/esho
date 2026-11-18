-- Service bookings become a small business flow: capacity (several simultaneous bookings), customer
-- cancel/reschedule through an unguessable token, owner outcomes (completed / no_show), deposit
-- refund flags and idempotent email reminders.
--
-- SQLite cannot widen a CHECK constraint or change a primary key in place, so both tables are rebuilt
-- (copy, drop, rename). Every existing row is kept: existing slot rows become seat 1.

CREATE TABLE storefront_service_appointments_v2 (
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
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirming', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show')),
  request_expires_at TEXT NOT NULL,
  deposit_percent INTEGER NOT NULL CHECK (deposit_percent BETWEEN 0 AND 100),
  deposit_cents INTEGER NOT NULL CHECK (deposit_cents >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('not_required', 'initializing', 'pending', 'paid', 'failed')),
  payment_reference TEXT,
  payment_authorization_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payment_subaccount_code TEXT,
  -- sha256 of the customer's manage token; the token itself is shown once and never stored.
  cancel_token_hash TEXT,
  cancelled_by TEXT CHECK (cancelled_by IS NULL OR cancelled_by IN ('customer', 'owner')),
  cancelled_at TEXT,
  cancel_reason TEXT,
  -- Flag only: the Worker never moves money. The owner refunds in Paystack and marks it refunded.
  deposit_refund_due INTEGER NOT NULL DEFAULT 0 CHECK (deposit_refund_due IN (0, 1)),
  deposit_refunded_at TEXT,
  reschedule_count INTEGER NOT NULL DEFAULT 0 CHECK (reschedule_count >= 0),
  rescheduled_at TEXT,
  reminded_at TEXT,
  reminder_attempts INTEGER NOT NULL DEFAULT 0 CHECK (reminder_attempts >= 0),
  UNIQUE (tenant_id, idempotency_key)
);

INSERT INTO storefront_service_appointments_v2
  (id, tenant_id, idempotency_key, service_id, service_name, service_price_cents, currency, duration_minutes,
   starts_at, ends_at, slot_reserved_until, timezone, customer_name, customer_email, customer_phone, status,
   request_expires_at, deposit_percent, deposit_cents, payment_status, payment_reference,
   payment_authorization_url, created_at, updated_at, payment_subaccount_code)
SELECT id, tenant_id, idempotency_key, service_id, service_name, service_price_cents, currency, duration_minutes,
       starts_at, ends_at, slot_reserved_until, timezone, customer_name, customer_email, customer_phone, status,
       request_expires_at, deposit_percent, deposit_cents, payment_status, payment_reference,
       payment_authorization_url, created_at, updated_at, payment_subaccount_code
FROM storefront_service_appointments;

DROP TABLE storefront_service_appointments;
ALTER TABLE storefront_service_appointments_v2 RENAME TO storefront_service_appointments;

CREATE INDEX storefront_service_appointments_tenant_start
  ON storefront_service_appointments (tenant_id, starts_at);

CREATE INDEX storefront_service_appointments_tenant_status_created
  ON storefront_service_appointments (tenant_id, status, created_at DESC);

CREATE UNIQUE INDEX storefront_service_appointments_payment_reference
  ON storefront_service_appointments (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX storefront_service_appointments_cancel_token
  ON storefront_service_appointments (cancel_token_hash)
  WHERE cancel_token_hash IS NOT NULL;

-- The reminder scan looks across shops for confirmed, not-yet-reminded bookings starting soon.
CREATE INDEX storefront_service_appointments_reminders
  ON storefront_service_appointments (starts_at)
  WHERE status = 'confirmed' AND reminded_at IS NULL;

-- One row per 15-minute block per occupied seat. A shop with capacity N allows N rows per block.
CREATE TABLE storefront_appointment_slots_v2 (
  tenant_id TEXT NOT NULL,
  slot_start TEXT NOT NULL,
  seat INTEGER NOT NULL DEFAULT 1 CHECK (seat >= 1),
  appointment_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, slot_start, seat)
);

INSERT INTO storefront_appointment_slots_v2 (tenant_id, slot_start, seat, appointment_id, expires_at)
SELECT tenant_id, slot_start, 1, appointment_id, expires_at FROM storefront_appointment_slots;

DROP TABLE storefront_appointment_slots;
ALTER TABLE storefront_appointment_slots_v2 RENAME TO storefront_appointment_slots;

CREATE INDEX storefront_appointment_slots_appointment
  ON storefront_appointment_slots (tenant_id, appointment_id);

CREATE INDEX storefront_appointment_slots_expiration
  ON storefront_appointment_slots (tenant_id, expires_at);
