CREATE TABLE IF NOT EXISTS nearby_pairings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  host_token_hash TEXT NOT NULL,
  guest_token_hash TEXT NOT NULL,
  answer_sdp TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS nearby_pairings_expiry
  ON nearby_pairings (expires_at);
