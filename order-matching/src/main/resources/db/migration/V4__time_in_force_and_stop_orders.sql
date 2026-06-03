-- Two new order capabilities, matching what real spot exchanges support.
--
-- 1) Time-in-force on every order:
--    GTC       — Good-Till-Cancelled (current behaviour, default)
--    IOC       — Immediate-Or-Cancel (any unfilled qty is cancelled, never rests)
--    FOK       — Fill-Or-Kill (entire order must fill immediately, else rejected)
--    POST_ONLY — Order must be a maker; if it would cross the book, it's rejected
--
-- 2) Stop-limit orders. trigger_price is the price level that activates the order.
--    A stop_limit BUY  triggers when market_price >= trigger_price → it then
--      enters the book as a normal LIMIT at `price`.
--    A stop_limit SELL triggers when market_price <= trigger_price.
--    Status TRIGGER_PENDING means: funds locked, order not in the matching book yet.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS time_in_force VARCHAR(10) NOT NULL DEFAULT 'GTC';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trigger_price NUMERIC(20, 8);
