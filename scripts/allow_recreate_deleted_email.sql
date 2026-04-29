ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_not_deleted_key
ON users (LOWER(email))
WHERE account_status <> 'deleted';
