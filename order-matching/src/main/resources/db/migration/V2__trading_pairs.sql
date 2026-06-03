-- Trading pairs registry: the canonical "what's tradable" whitelist.
-- All order placements validate symbol + min quantity against this table.
-- Real exchanges (Binance, Coinbase) expose equivalent metadata via /exchangeInfo.

CREATE TABLE IF NOT EXISTS trading_pairs (
    symbol         VARCHAR(20)    PRIMARY KEY,
    base_currency  VARCHAR(10)    NOT NULL,
    quote_currency VARCHAR(10)    NOT NULL,
    min_quantity   NUMERIC(20, 8) NOT NULL,
    tick_size      NUMERIC(20, 8) NOT NULL,
    status         VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_pairs_status ON trading_pairs (status);

INSERT INTO trading_pairs (symbol, base_currency, quote_currency, min_quantity, tick_size) VALUES
    ('BTC-USDT',  'BTC',  'USDT', 0.00001,  0.01),
    ('ETH-USDT',  'ETH',  'USDT', 0.0001,   0.01),
    ('SOL-USDT',  'SOL',  'USDT', 0.001,    0.01),
    ('BNB-USDT',  'BNB',  'USDT', 0.001,    0.01),
    ('XRP-USDT',  'XRP',  'USDT', 1,        0.0001),
    ('ADA-USDT',  'ADA',  'USDT', 1,        0.0001),
    ('DOGE-USDT', 'DOGE', 'USDT', 1,        0.00001),
    ('AVAX-USDT', 'AVAX', 'USDT', 0.01,     0.01),
    ('LINK-USDT', 'LINK', 'USDT', 0.01,     0.01),
    ('DOT-USDT',  'DOT',  'USDT', 0.01,     0.01)
ON CONFLICT (symbol) DO NOTHING;
