ALTER TABLE accounts ADD COLUMN email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_unique
  ON accounts (email)
  WHERE email IS NOT NULL;
