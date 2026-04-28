CREATE TABLE IF NOT EXISTS wallets (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID           NOT NULL,
    currency        VARCHAR(10)    NOT NULL,
    balance         NUMERIC(20, 8) NOT NULL DEFAULT 0,
    locked_balance  NUMERIC(20, 8) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP      NOT NULL,
    updated_at      TIMESTAMP      NOT NULL,
    UNIQUE (user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_user_id ON wallets (user_id);

CREATE TABLE IF NOT EXISTS transactions (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id    UUID           NOT NULL,
    type         VARCHAR(20)    NOT NULL,
    amount       NUMERIC(20, 8) NOT NULL,
    currency     VARCHAR(10)    NOT NULL,
    reference_id UUID,
    status       VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    description  VARCHAR(500),
    created_at   TIMESTAMP      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_id    ON transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_reference_id ON transactions (reference_id);
CREATE INDEX IF NOT EXISTS idx_created_at   ON transactions (created_at);

CREATE TABLE IF NOT EXISTS processed_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID        NOT NULL UNIQUE,
    event_type   VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP   NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_id ON processed_events (event_id);
