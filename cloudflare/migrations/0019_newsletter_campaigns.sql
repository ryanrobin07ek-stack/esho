CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'subscribed', 'unsubscribed')),
  confirmation_token_hash TEXT NOT NULL DEFAULT '',
  unsubscribe_token TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_tenant_status
  ON newsletter_subscribers (tenant_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_confirmation_token
  ON newsletter_subscribers (confirmation_token_hash)
  WHERE confirmation_token_hash != '';

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_unsubscribe_token
  ON newsletter_subscribers (unsubscribe_token);
