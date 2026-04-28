CREATE TABLE IF NOT EXISTS market_data (
    id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol                   VARCHAR(20)    NOT NULL UNIQUE,
    last_price               NUMERIC(20, 8) NOT NULL,
    volume_24h               NUMERIC(20, 8) NOT NULL DEFAULT 0,
    high_24h                 NUMERIC(20, 8) NOT NULL DEFAULT 0,
    low_24h                  NUMERIC(20, 8) NOT NULL DEFAULT 0,
    price_change_24h         NUMERIC(20, 8),
    price_change_percent_24h NUMERIC(10, 2),
    trade_count_24h          BIGINT,
    open_price_24h           NUMERIC(20, 8),
    created_at               TIMESTAMP      NOT NULL,
    updated_at               TIMESTAMP      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbol     ON market_data (symbol);
CREATE INDEX IF NOT EXISTS idx_updated_at ON market_data (updated_at);
