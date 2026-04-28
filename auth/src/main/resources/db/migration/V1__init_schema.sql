CREATE TABLE IF NOT EXISTS users (
    user_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email    VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
);
