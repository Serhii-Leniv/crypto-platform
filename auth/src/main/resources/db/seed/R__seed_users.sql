-- Demo users for local dev. Loaded only when spring.profiles.active=dev
-- (gated via spring.flyway.locations including db/seed in application-dev.properties).
-- Password for all three users: Password1
-- BCrypt hash generated against the running auth-service.
-- UUIDs are deterministic so wallet/order seeds in other services can FK to these.
-- ON CONFLICT keyed on user_id (PK); email has no unique constraint.

INSERT INTO users (user_id, email, password, is_admin)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'alice@demo.io',   '$2a$10$MdJB4qhWB/.z3MiedZ/v5uuc1pWGyZwDCOfKmbPvXrj5pmN9DnE2S', TRUE),
    ('22222222-2222-4222-8222-222222222222', 'bob@demo.io',     '$2a$10$MdJB4qhWB/.z3MiedZ/v5uuc1pWGyZwDCOfKmbPvXrj5pmN9DnE2S', FALSE),
    ('33333333-3333-4333-8333-333333333333', 'charlie@demo.io', '$2a$10$MdJB4qhWB/.z3MiedZ/v5uuc1pWGyZwDCOfKmbPvXrj5pmN9DnE2S', FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Make sure alice stays admin even if she existed before the column was added.
UPDATE users SET is_admin = TRUE WHERE email = 'alice@demo.io';
