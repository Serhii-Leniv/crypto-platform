-- Tick-level trade history. All 24h aggregates (last_price, volume_24h, high_24h, low_24h,
-- open_price_24h, price_change_24h, trade_count_24h) on market_data are now derived from
-- aggregation over this table for the rolling 24h window. The market_data row is the cached
-- snapshot; the truth is here.

CREATE TABLE IF NOT EXISTS trades (
    id        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol    VARCHAR(20)    NOT NULL,
    price     NUMERIC(20, 8) NOT NULL,
    quantity  NUMERIC(20, 8) NOT NULL,
    traded_at TIMESTAMP      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol_traded_at ON trades (symbol, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_traded_at        ON trades (traded_at);
