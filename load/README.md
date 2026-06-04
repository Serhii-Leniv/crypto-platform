# Load testing

A small [k6](https://k6.io/) script that drives the matching engine and measures end-to-end
place-order latency + throughput.

## What it measures

`place-orders.js` hits `POST /api/v1/orders` directly on the order-matching service (port 8082),
bypassing the gateway's per-user rate limit so the numbers reflect the engine, not the limiter.
Each request exercises the full critical path:

```
validate trading pair
  → walletClient.lock          (sync REST → wallet-service)
  → persist Order              (postgres-order)
  → enter SymbolOrderBook      (per-symbol ReentrantLock)
  → OrderMatchingEngine.matchOrder
  → walletClient.settle        (sync REST → wallet-service, single @Transactional)
  → respond with final status
```

Two demo users (alice, bob) alternate BUY/SELL so settled trades keep both wallets liquid.
A `setup()` step tops up both users with a generous float so the benchmark measures engine
throughput rather than wallet exhaustion.

## How to run

The local stack must be up (`docker compose up -d`) and the gateway healthy.

```bash
# 5 VUs · 30s — contention-free baseline
docker run --rm --network host \
  -v "$(pwd)/load:/scripts" \
  -e BASE_URL=http://localhost:8082 \
  -e WALLET_URL=http://localhost:8083 \
  grafana/k6 run --duration 30s --vus 5 /scripts/place-orders.js

# 50 VUs · 30s — saturation point (surfaces wallet-row lock contention)
docker run --rm --network host \
  -v "$(pwd)/load:/scripts" \
  -e BASE_URL=http://localhost:8082 \
  -e WALLET_URL=http://localhost:8083 \
  grafana/k6 run --duration 30s --vus 50 /scripts/place-orders.js
```

On Windows / Git Bash the `-v` mount needs the Windows-format path:

```bash
MSYS_NO_PATHCONV=1 docker run --rm --network host \
  -v "$(pwd -W)/load:/scripts" \
  -e BASE_URL=http://localhost:8082 \
  -e WALLET_URL=http://localhost:8083 \
  grafana/k6 run --duration 30s --vus 5 /scripts/place-orders.js
```

## Reading the results

The script reports custom metrics alongside k6's defaults:

| Metric | Meaning |
|---|---|
| `place_order_latency_ms` | Per-request wall-clock latency (Trend with p50/p90/p95/p99). |
| `place_order_ok` | Count of 2xx responses (matched or rested without error). |
| `place_order_fail` | Count of non-2xx responses. |
| `insufficient_funds_rate` | Share of failures returning HTTP 400 + body `Insufficient` — proxy for wallet exhaustion. |

If `insufficient_funds_rate` is > 0, the `setup()` top-up isn't enough; bump the deposit
amounts at the top of `place-orders.js`. The script is intentionally not idempotent — wallets
accumulate across runs.

## Cross-checking with Grafana

While k6 runs, open Grafana → "Trading Engine Health" (admin panel → Metrics) and watch:

- `orders.place.duration` (timer) — server-side P99
- `wallet.settle.duration` (timer) — settlement P99
- `orderbook.depth` — book size by symbol/side
- `matches.filled` — fills/sec

The k6-measured latency includes one HTTP hop more than the server-side timer, so the two
should agree within a few ms of HTTP overhead.
