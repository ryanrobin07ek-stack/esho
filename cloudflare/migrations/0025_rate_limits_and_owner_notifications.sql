-- Atomic fixed-window counters for public write endpoints (orders, holds, payment setup, analytics).
-- `key` is "<scope>:<tenant>:<sha256(ip)>"; no raw IP addresses are stored.
-- Old windows are pruned by the scheduled retention job.
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_window
  ON rate_limit_counters (window_start);

-- Outbox of owner alerts (new order, booking request, hold, paid-but-short-stock). The Craft app
-- polls GET /api/store/notifications; events hold references and a first name only.
CREATE TABLE IF NOT EXISTS owner_notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS owner_notifications_tenant_created
  ON owner_notifications (tenant_id, created_at DESC);
