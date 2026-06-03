-- Synthetic 24h trade history for each demo pair so the dashboard shows believable rolling
-- aggregates on fresh start. Only loads when the trades table is empty — once real trade
-- events arrive (or this seed has run), it stops appending.
--
-- Each pair gets ~48 trades spread over the past 24h: a random walk that ends near the
-- seeded last_price. After startup, MarketDataService.refreshAllMetrics() recomputes
-- the cached snapshot on market_data from this history.

INSERT INTO trades (symbol, price, quantity, traded_at)
SELECT
    p.symbol,
    -- Random walk: start ~3% off target, drift to target across 48 steps with ±0.4% jitter
    GREATEST(
        p.target * (1.0 - 0.03 + (s::numeric / 47.0) * 0.03
                       + (random() - 0.5) * 0.008),
        p.target * 0.5
    )::numeric(20, 8) AS price,
    (p.hourly_vol * (0.5 + random()))::numeric(20, 8) AS quantity,
    NOW() - ((47 - s) * INTERVAL '30 minutes') AS traded_at
FROM generate_series(0, 47) s
CROSS JOIN (VALUES
    ('BTC-USDT',   95234.50, 384.0     ),
    ('ETH-USDT',    3487.25,  3038.0   ),
    ('SOL-USDT',     164.80, 10916.0   ),
    ('BNB-USDT',     648.40,  1711.0   ),
    ('XRP-USDT',       0.5482, 88541.0 ),
    ('ADA-USDT',       0.4524, 45416.0 ),
    ('DOGE-USDT',      0.1635, 175416.0),
    ('AVAX-USDT',     34.85,  3437.0   ),
    ('LINK-USDT',     17.42,  5166.0   ),
    ('DOT-USDT',       7.18,  3854.0   )
) AS p(symbol, target, hourly_vol)
WHERE NOT EXISTS (SELECT 1 FROM trades);
