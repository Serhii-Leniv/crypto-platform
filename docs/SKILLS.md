# Engineering skills demonstrated

A one-table view of *what this codebase shows that I know how to do*, mapped to the concrete file or commit where you'd verify it.

For the why behind each pattern, see [decisions/](decisions/). For the how-it-works narrative, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Distributed systems

| Engineering problem | Pattern / approach | Where in this codebase |
|---|---|---|
| Dual-write to DB + message broker without races | **Transactional outbox** — row written inside the business transaction; separate `@Scheduled` publisher ships it to Kafka at least once | [ADR-0009](decisions/0009-transactional-outbox-for-kafka.md) · `order-matching/.../service/OutboxPublisher.java` |
| Multi-resource atomic transaction across users + currencies | **Single `@Transactional`** wrapping all wallet movements; pessimistic row locks in deterministic order to avoid deadlocks | [ADR-0002](decisions/0002-atomic-settlement-transaction.md) · `wallet/.../service/WalletService.java#settleTrade` |
| Synchronous fund commitment before exposing state | **Sync REST in critical path** instead of async messaging — funds are reserved before the order is visible to the matching engine | [ADR-0001](decisions/0001-sync-wallet-rest-for-fund-locking.md) · `OrderService.placeOrder` |
| Idempotent message consumers | **Composite unique key** `(event_id, event_type)` in `processed_events` — same `orderId` can appear for both `ORDER_PLACED` and `ORDER_CANCELLED` without collision | `wallet/.../model/ProcessedEvent.java` |
| Conservation invariant across distributed wallets | **Fees credited to a synthetic house wallet** in the same transaction → `Σ deposits = Σ debits` per trade, machine-checkable in a reconciliation job | [ADR-0008](decisions/0008-fees-credited-to-house-wallet.md) · `WalletService.settleTrade` |
| Per-service schema ownership + independent failure domains | **One Postgres container per service** (`postgres-auth/order/wallet/market`) — no cross-service joins by construction | [ADR-0004](decisions/0004-separate-postgres-per-service.md) · `docker-compose.yml` |

## Concurrency

| Problem | Approach | Where |
|---|---|---|
| Sub-millisecond order book operations with durability | **In-memory `TreeMap<BigDecimal, ArrayDeque<Order>>`** per symbol, replayed from Postgres on JVM startup | [ADR-0003](decisions/0003-in-memory-order-book.md) · `order-matching/.../orderbook/SymbolOrderBook.java` |
| Serialise mutations per symbol without serialising the whole engine | **Per-symbol `ReentrantLock`** — orders on different symbols are fully parallel | `SymbolOrderBook.java#lock()` |
| Pre-generate identifiers before persistence | **`Persistable<UUID>` interface override** so Spring Data takes the `INSERT` path despite a non-null `@Id` | [ADR-0005](decisions/0005-persistable-uuid-for-orders.md) · `order-matching/.../model/Order.java` |

## Correctness testing

| Problem | Approach | Where |
|---|---|---|
| State-machine correctness under arbitrary input | **Property-based testing** with jqwik — 14 properties × 200–500 random sequences each (~5,500 total per CI run) | `order-matching/.../property/*PropertyTest.java` |
| Real persistence semantics, not just mocked | **Testcontainers Postgres** in integration tests | `order-matching/.../OrderServiceIntegrationTest.java` |
| Conservation of quantity across matches | Property: `Σ BUY fills == Σ SELL fills` after any random order sequence | `OrderMatchingEnginePropertyTest.conservationOfQuantity` |
| Self-trade prevention enforcement | Property: no produced `OrderMatchedEvent` has `buyerUserId == sellerUserId` | `OrderMatchingEnginePropertyTest.stpNeverProducesSameUserMatch` |
| Price improvement to taker | Property: match price always equals the resting (maker) order's price | `OrderMatchingEnginePropertyTest.matchPriceEqualsMakerPrice` |

## Observability

| Problem | Approach | Where |
|---|---|---|
| Cross-instance percentile aggregation in Prometheus | **Histogram percentiles** (`publishPercentileHistogram()`) — `histogram_quantile()` in PromQL works because the `_bucket` series is emitted; summaries (the default) cannot aggregate across instances | `order-matching/.../config/TradingMetrics.java` · `wallet/.../config/WalletMetrics.java` |
| Domain-meaningful metrics, not just JVM defaults | **Custom Micrometer counters / timers / gauges** with structured labels (symbol, side, type, tif, currency, outcome) | `TradingMetrics.java` · `WalletMetrics.java` |
| Pre-built operational view | **Pre-provisioned Grafana dashboard** loaded via `docker/grafana/provisioning/` — ten panels covering throughput, latency p50/p95/p99, rejections, STP skips, book depth, fees, Kafka lag | `docker/grafana/provisioning/dashboards/trading-engine.json` |
| Runbook-style alert rules | **Prometheus alerts** with concrete trigger conditions and remediation hints — see also [RUNBOOKS.md](RUNBOOKS.md) | `docker/prometheus/alerts.yml` |
| HTTP request tracing across services | **Micrometer Tracing + Brave** with Zipkin export on `:9411`. *Kafka and WebSocket context propagation is on the roadmap — Brave's Kafka instrumentation and `traceparent` injection in `OutboxPublisher` would close the loop end-to-end.* | `gateway/.../config/TracingConfig.java` |

## Operations

| Problem | Approach | Where |
|---|---|---|
| Versioned schema evolution | **Flyway** migrations per service + repeatable seed scripts (`R__seed_*.sql`) for the dev profile | `*/src/main/resources/db/migration/` |
| Fail-fast on partial outages, prevent thread-pool exhaustion | **Resilience4j circuit breakers** wrapping every downstream route at the gateway | `gateway/.../config/CircuitBreakerConfig.java` |
| Rate limiting per authenticated user | **Token-bucket via Redis** at the gateway | `gateway/src/main/resources/application.yml` |
| Dead-letter queue with manual replay | Kafka business failures retried with exponential backoff, then routed to `<topic>.DLT`; failed events visible in the admin panel for inspection and replay | `wallet/.../kafka/DeadLetterHandler.java` · `wallet/.../controller/FailedEventController.java` |
| Performance baseline | **k6 load test** measures end-to-end `POST /orders` latency + throughput. ~70 ops/sec single-instance, p95 = 104ms at 5 VUs, mean settle = 7.7ms | `load/place-orders.js` · [README #Performance](../README.md#performance) |

## API surface

| Problem | Approach | Where |
|---|---|---|
| Stateless authentication that's gateway-validatable | **JWT (HS256)** with 15-minute access tokens + `httpOnly` refresh-token cookie with rotation | `auth/.../service/UserService.java` · `gateway/.../filter/JwtAuthenticationFilter.java` |
| Single security perimeter | **Gateway-only JWT validation**; downstream services trust the injected `X-User-Id` header. Internal-only `/internal/wallets/*` endpoints are not routed by the gateway and are unreachable from the public API | `gateway/src/main/resources/application.yml` · `wallet/.../controller/WalletInternalController.java` |
| Role-based admin access | `is_admin` column → JWT claim → `requireAdmin` gateway filter on `/api/v1/admin/**` | `gateway/.../filter/AdminRoleFilter.java` |
| Real-time market data fanout | **WebSocket** (STOMP over SockJS) — `/topic/orderbook/{symbol}`, `/topic/trades/{symbol}`, `/topic/market-data` | `market-data/.../config/WebSocketConfig.java` |

## Documentation discipline

| Problem | Approach | Where |
|---|---|---|
| Decisions explained, not just code shown | **9 Architecture Decision Records** in `Context / Decision / Consequences / Alternatives considered` format — immutable; superseded decisions get a new ADR rather than an edit | [docs/decisions/](decisions/) |
| Mechanics explained, not just diagrammed | **`ARCHITECTURE.md`** with five Mermaid sequence diagrams (place, match, cancel, stop activation, outbox publish), state-distribution table, settlement breakdown, failure-mode matrix | [ARCHITECTURE.md](ARCHITECTURE.md) |
| First-impression for someone with 90 seconds | **`README.md`** repositions the project as a distributed-systems study illustrated through a crypto exchange — patterns first, domain second | [../README.md](../README.md) |
| Operational discipline beyond "alerts fire" | **`RUNBOOKS.md`** — concrete steps for each Prometheus alert | [RUNBOOKS.md](RUNBOOKS.md) |

---

## How to skim this for a 5-minute conversation

If you only have time for three things, the most senior-distinguishing artifacts are:

1. **[ADR-0009 — transactional outbox](decisions/0009-transactional-outbox-for-kafka.md)** — shows you understand dual-write hazards and the menu of solutions (XA, Debezium, outbox), and why you chose what you chose.
2. **[OrderMatchingEnginePropertyTest.java](../order-matching/src/test/java/org/serhiileniv/order/property/OrderMatchingEnginePropertyTest.java)** — property-based testing of a state machine is a rare skill in portfolio projects.
3. **The Performance section in the README** with k6 numbers — shows you measure rather than guess.

Anything else can be a follow-up question.
