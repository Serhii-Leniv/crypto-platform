-- Per-pair fee schedule. Basis points (bps): 1 bp = 0.01%, so taker_fee_bps=10 means 0.10%.
-- Real exchanges: Binance spot is around 10bps maker/10bps taker by default; Coinbase is higher.
-- Here we use sensible defaults: maker is rebated less than taker for adding liquidity.

ALTER TABLE trading_pairs ADD COLUMN IF NOT EXISTS maker_fee_bps INTEGER NOT NULL DEFAULT 10;
ALTER TABLE trading_pairs ADD COLUMN IF NOT EXISTS taker_fee_bps INTEGER NOT NULL DEFAULT 20;
