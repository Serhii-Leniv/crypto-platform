CREATE TABLE IF NOT EXISTS orders (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID           NOT NULL,
    symbol          VARCHAR(20)    NOT NULL,
    order_type      VARCHAR(10)    NOT NULL,
    side            VARCHAR(4)     NOT NULL,
    price           NUMERIC(20, 8),
    quantity        NUMERIC(20, 8) NOT NULL,
    filled_quantity  NUMERIC(20, 8) NOT NULL DEFAULT 0,
    status          VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP      NOT NULL,
    updated_at      TIMESTAMP      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbol_status ON orders (symbol, status);
CREATE INDEX IF NOT EXISTS idx_user_id        ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_created_at     ON orders (created_at);
