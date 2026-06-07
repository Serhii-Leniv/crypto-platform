# Runbooks

Concrete on-call procedures for each alert defined in [`docker/prometheus/alerts.yml`](../docker/prometheus/alerts.yml). Each entry follows the same structure:

- **Trigger** — the PromQL condition that fires the alert.
- **What it means** — the production scenario this typically reflects.
- **Where to look first** — dashboards, logs, metrics.
- **Mitigation** — steps to take in order, fastest-impact first.
- **Root cause investigation** — once the fire is out, what to dig into.
- **Escalation** — when to wake someone else.

These map to alerts that exist today. As new alerts are added, append entries here in the same shape.

For the metrics that back these queries, see [SKILLS.md § Observability](SKILLS.md#observability). For the architectural shape that the alerts reflect, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## SLOs and error budgets

These are the targets the alerts protect. Documented here, not yet enforced by CI.

| SLI | Target (p99 over 5m) | Error budget (monthly) |
|---|---|---|
| `POST /api/v1/orders` end-to-end latency | < 500 ms | 0.1 % of requests (~43 minutes of breach) |
| `wallet-service settleTrade` latency | < 200 ms | 0.1 % of trades |
| `OrderRejectionRate` (non-insufficient-funds) | < 1 % of placements | 1 % per month |
| `MarketDataConsumerLag` | < 1,000 records | < 5 minutes accumulated lag per month |

When error budget is < 25 %, freeze non-critical deploys to the relevant service and prioritise reliability work.

---

## Alert: `SettleLatencyP99High`

**Trigger**: `histogram_quantile(0.99, sum(rate(wallet_settle_duration_seconds_bucket[5m])) by (le)) > 0.2` for 5 minutes.

**What it means**: the synchronous wallet settle call is taking > 200 ms at p99 for 5 minutes. This is on the critical path for every match — when it's slow, the matching engine's transaction holds the per-symbol `ReentrantLock` longer, and the gateway's order endpoint backs up.

**Where to look first**:

1. Grafana → *Trading Engine Health* → **Settle latency** panel. Confirm the spike and check whether it's symmetric (all settles slow) or skewed (one tail dragging the p99).
2. Grafana → check `wallet_settle_duration_seconds_count` rate against the place-order rate. If settles are happening but slow, contention. If settles aren't happening but orders are, the queue is forming upstream.
3. `wallet-service` logs (`docker compose logs wallet-service --tail 200`) for `Failed to validate connection` or `PESSIMISTIC_WRITE` lock-wait messages.
4. `postgres-wallet` → `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';` to see active lock waits.

**Mitigation** (in order):

1. **Restart `wallet-service`** if the connection pool is exhausted (`HikariPool-1 - Connection is not available`). One-liner: `docker compose restart wallet-service`. This recovers immediately if the issue is pool starvation, not load.
2. **Bump the connection pool** temporarily if traffic is genuinely higher than provisioned. `spring.datasource.hikari.maximum-pool-size` in `wallet/src/main/resources/application.properties`. Default is 10; 20 is safe.
3. **Roll restart `order-matching`** if requests are queueing behind a stuck per-symbol lock. Last resort — drops in-memory book state but `OrderBookInitializer` rebuilds it.

**Root cause investigation**:

- If lock contention is the cause, the underlying issue is documented in [ADR-0002](decisions/0002-atomic-settlement-transaction.md). Long-term fix is sharding wallet-service by user ID — see ADR-0010 (planned).
- If Postgres is slow but not contending, check disk IO and CPU on the `postgres-wallet` host. `docker stats postgres-wallet`.
- Inspect `wallet_settle_duration_seconds_max` for outliers — one slow settle that drags the bucket can be a single bad query plan.

**Escalation**: if alert persists > 30 min after mitigation, suspect a deeper Postgres issue (autovacuum, replication lag) and page DB-knowledgeable engineer.

---

## Alert: `PlaceOrderLatencyP99High`

**Trigger**: `histogram_quantile(0.99, sum(rate(orders_place_duration_seconds_bucket[5m])) by (le)) > 0.5` for 5 minutes.

**What it means**: end-to-end `POST /api/v1/orders` p99 > 500 ms for 5 minutes. This is what users *feel* as "the exchange is slow".

**Where to look first**:

1. **Check `SettleLatencyP99High` first** — `placeOrder` is downstream of `settle` for any match. If settle is slow, place is slow. Follow that runbook.
2. Grafana → *Trading Engine Health* → **Place order latency** panel for the percentile breakdown.
3. Compare to `orders_placed_total` rate. Is volume up (legit load) or constant (something else is slow)?
4. Grafana → **Orders rejected by reason** — if rejections are spiking, the slowness is the validation + compensating-unlock path, not the happy path.
5. Zipkin (`:9411`) → search by recent `traceId` — see where the time is going (HTTP, lock, DB).

**Mitigation**:

1. If settle latency is the cause → follow `SettleLatencyP99High` runbook.
2. If the gateway is the bottleneck (Resilience4j circuit breaker open or rate limiter exhausted), check gateway logs for `CallNotPermittedException`. Bump circuit breaker config in `gateway/src/main/resources/application.yml` if traffic is legit.
3. If it's the in-memory book lock — `matches_duration_seconds` will be elevated. Rare; usually means one symbol has runaway depth. Inspect via `orderbook_depth{symbol=...}` gauge.

**Root cause investigation**:

- If the answer is "everything got slower together", suspect host-level resource exhaustion (CPU, memory) on the Docker host.
- If the slowness is per-symbol, suspect lock contention on a specific symbol's `ReentrantLock`. Consider whether the book has accumulated stale `CANCELLED` orders the candidate scan still walks.

**Escalation**: if traffic is novel (e.g., 10× normal) and the system is genuinely saturated, scale-out is the answer — but we don't have horizontal scaling wired (see [critique](../prep/critique.md) item 1).

---

## Alert: `OrderRejectionRateHigh`

**Trigger**: `sum(rate(orders_rejected_total[5m])) > 5` for 5 minutes (> 5 rejections per second sustained).

**What it means**: something is causing systemic order rejection. This is usually one of:

- An upstream bug spamming malformed orders.
- A genuine influx of users hitting insufficient funds.
- A POST_ONLY-heavy market-making bot getting rejected because the spread is too tight.

**Where to look first**:

1. **The labelled metric tells you the cause immediately**: `sum by (reason) (rate(orders_rejected_total[5m]))`. The dominant `reason` label is your starting point.
2. Possible reasons (defined in `OrderService.placeOrder`):
   - `insufficient_funds` — wallets are out of money. Likely legitimate.
   - `post_only_rejected` — POST_ONLY orders crossing the book. Sharp spread.
   - `fok_rejected` — FOK orders that can't fully fill. Thin liquidity.
   - `invalid_symbol` — clients submitting wrong symbols. Probably a client bug.
   - `error` — uncategorised. Worst case; check logs.

**Mitigation**:

- **`insufficient_funds`** — usually no mitigation; this is normal load. Confirm with the user (or check distinct `userId` count) that it's not a single user spamming.
- **`post_only_rejected` / `fok_rejected`** — no mitigation; these are correct rejections. Likely a market-maker recalibrating.
- **`invalid_symbol`** — check whether a market was recently halted (admin action). If yes, the rejection is correct. If no, suspect a client-side bug; compare which `Origin` header is sending them.
- **`error`** — read the logs. Likely a regression.

**Root cause investigation**: if the rate is sustained > 1 hour, dig into why this load shape is occurring. Communicate with users / clients.

**Escalation**: only if `reason=error` rate is the dominant component — that's a code bug.

---

## Alert: `MarketDataConsumerLag`

**Trigger**: `max(kafka_consumer_fetch_manager_records_lag_max{consumergroup="market-data-group"}) > 1000` for 5 minutes.

**What it means**: the `market-data` service is more than 1,000 records behind on the `order-events` topic. Effects:

- 24-hour stats shown to users will lag reality.
- The orderbook WebSocket broadcast will be stale.
- Recent trades on the Trade page won't appear immediately.

The matching engine and settlement are unaffected — this is read-side staleness only.

**Where to look first**:

1. Grafana → *Trading Engine Health* → **Kafka consumer lag** panel for the trend.
2. Check `market-data-service` health: `curl http://localhost:8084/actuator/health`. If down, this is a service-down problem masquerading as lag.
3. Check `market-data-service` logs for deserialisation failures or DLT spam: `docker compose logs market-data-service --tail 200`.
4. Check Kafka itself: `docker compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group market-data-group`.

**Mitigation**:

1. **Restart `market-data-service`** if it's been running long enough that the consumer has fallen behind due to memory pressure or GC. `docker compose restart market-data-service`.
2. If the consumer has been killed or crashed (zero lag delta but max lag growing), check whether it's even consuming. `kafka-consumer-groups` output will show "no active members".
3. If the lag is from a poison-pill message that's failing repeatedly, inspect the DLT (`order-events.DLT`) topic and the `failed_events` table in `postgres-wallet`. Manual replay via admin panel.

**Root cause investigation**:

- Lag that grows linearly indicates the consumer isn't keeping up with throughput — but the matching engine peaks at ~70 orders/sec single-instance, so this is genuinely unlikely unless `market-data` is dramatically under-provisioned.
- Lag from a stuck consumer (no progress at all) is the dominant real-world cause. Look for thread blocked on DB or external call.

**Escalation**: if lag persists > 30 min after restart, the consumer logic is likely broken on a specific message type — escalate to engineering, do not just keep restarting.

---

## What this runbook doesn't cover

- **Postgres down entirely** — Spring connection pool retry handles short blips. Long outages need DR procedure (TODO: `docs/DR.md`).
- **Kafka down entirely** — outbox accumulates. See [ADR-0009](decisions/0009-transactional-outbox-for-kafka.md) for the at-least-once guarantee. The `orderbook_outbox_backlog` gauge will climb; alert TODO.
- **Gateway DDoS** — gateway has a Redis-backed rate limiter on auth endpoints. For other paths, an upstream WAF / CDN would be the production answer.
- **Settlement reconciliation drift** — daily job that asserts `Σ deposits = Σ debits` per trade. Not yet automated; TODO.

These are all known gaps. Track them honestly when discussing the project.
