CREATE TABLE IF NOT EXISTS account_google_identities (
  google_sub TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE REFERENCES accounts(username) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
