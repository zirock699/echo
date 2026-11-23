-- Create with the provisioned Sites D1 binding named DB.
CREATE TABLE IF NOT EXISTS user_state (
 owner TEXT PRIMARY KEY NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
 data TEXT NOT NULL CHECK (json_valid(data)),
 payload BLOB,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_state_updated_at ON user_state(updated_at);
