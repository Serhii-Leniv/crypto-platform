-- Role flag on users. Single boolean keeps things simple for demo;
-- production would use a roles table with FK + many-to-many for fine grained perms.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
