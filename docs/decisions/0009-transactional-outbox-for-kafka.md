# 0009 — Transactional outbox for Kafka events

**Status:** Accepted
**Date:** 2026-06-04

## Context

After [ADR-0001](0001-sync-wallet-rest-for-fund-locking.md) and [ADR-0002](0002-atomic-settlement-transaction.md) made fund locking and settlement synchronous, Kafka was downgraded from a correctness channel to an informational analytics stream. But the publishing path itself still had a classic dual-write hazard:

```java
@TransactionalEventListener(phase = AFTER_COMMIT)
public void sendOrderPlacedEvent(OrderPlacedEvent event) {
    kafkaTemplate.send("order-events", key, event);  // fire-and-forget
}
```

The race:

1. `OrderService.placeOrder()` commits the order to `postgres-order`.
2. Spring fires the `AFTER_COMMIT` listener.
3. The listener calls `kafkaTemplate.send(...)` asynchronously.
4. **If Kafka is down** at step 3 — broker unhealthy, network partition, JVM crash between commit and send — the event is lost. The `whenComplete` callback logs an error and that's it.

`market-data` then never sees the trade. Its 24h aggregates and WebSocket broadcasts diverge from reality silently. There is no replay mechanism — Kafka log doesn't have the message, the DB doesn't remember that it tried, and no operator-visible signal of the gap appears.

This isn't acceptable for an informational stream the frontend depends on for live trade ticks. The fix is the well-known transactional outbox pattern.

## Decision

Introduce an `outbox_events` table in `postgres-order`:

```sql
CREATE TABLE outbox_events (
    id            UUID PRIMARY KEY,
    event_type    VARCHAR(40) NOT NULL,
    aggregate_id  UUID NOT NULL,
    payload       TEXT NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    published_at  TIMESTAMP NULL,
    attempts      INT NOT NULL DEFAULT 0,
    last_error    TEXT NULL
);
CREATE INDEX idx_outbox_unpublished
    ON outbox_events (created_at) WHERE published_at IS NULL;
```

Replace every `applicationEventPublisher.publishEvent(...)` call with `outboxService.record(...)` (in `OrderService` and `OrderMatchingEngine`). The `record(...)` method requires an existing transaction (`@Transactional(propagation = MANDATORY)`) and inserts the outbox row into the caller's transaction, so the row either commits with the business write or rolls back with it. No dual write.

A new `OutboxPublisher` (`@Scheduled(fixedDelay = 500ms, initialDelay = 5s)`) polls the partial index, ships each pending row to Kafka via a dedicated `KafkaTemplate<String,String>` (the payload is pre-serialised JSON), and stamps `published_at` on broker acknowledgement. On failure it increments `attempts` and stores `last_error`. Retries happen on every subsequent tick — the row stays in the pending set until the broker accepts it.

The dedicated `outboxKafkaTemplate` uses `StringSerializer` so the already-serialised JSON in `payload` flows through verbatim. The project's default `KafkaTemplate<String,Object>` (with `JsonSerializer` for values) would re-encode the string into a quoted JSON scalar and break the existing `market-data` deserialiser.

Producer is configured with `acks=all` and `enable.idempotence=true` so the broker confirms durability before we stamp `published_at`, and a transient duplicate from retry doesn't end up in the topic.

New metrics:

- `orderbook.outbox.backlog` — gauge of `count WHERE published_at IS NULL`. Alerts when > 100 for 5m.
- `orderbook.outbox.published{outcome}` — counter, success / failure.

The old `OrderEventProducer` class and its `AFTER_COMMIT` listeners are deleted; nothing else publishes to `order-events`.

## Consequences

- **At-least-once delivery, end-to-end**: an event is durable in `postgres-order` from the moment the business transaction commits. Kafka outages, JVM crashes between commit and publish, and broker rejections all leave a recoverable row in the outbox.
- **Bounded staleness**: a healthy publisher catches up within one poll cycle (500ms). The frontend's live trade ticks are delayed by that much on average — already imperceptible.
- **Same-row ordering preserved**: each row uses the aggregate id (`orderId` or `tradeId`) as the Kafka key, which Kafka partitions on. Events for the same order stay on the same partition and arrive in publish order.
- **Cross-aggregate ordering not guaranteed**: two trades on the same symbol may settle in DB order A → B but publish in order B → A if the publisher tick picks them up in a different sequence. Acceptable — `market-data` is order-agnostic.
- **`market-data` becomes truly idempotent-dependent**: at-least-once delivery means the same `tradeId` can appear twice on the topic. The existing dedupe via `processed_events`-style tracking handles this, but we now lean on it harder.
- **Operational visibility**: the backlog gauge is the canary. A non-zero backlog for > a few seconds means publisher is stuck — Kafka is down, the producer is misconfigured, or the DB connection pool is exhausted.
- **DB write amplification**: every place / cancel / match now writes one extra row. At p99 throughput (~70 ops/sec, see [Performance](../../README.md#performance)) this is negligible. At 10× scale, batched outbox writes or partitioning the table by day would be the next step.
- **Manual replay**: a stuck row stays in `outbox_events` forever (no max-attempts cap). The intentional choice — Kafka outages are operator-resolved, not auto-discarded.

## Alternatives considered

- **Change-Data-Capture (Debezium)**: would tail the WAL on `postgres-order` and emit events without any application code touching Kafka. Cleaner separation, but adds a heavy operational dependency (Kafka Connect + a Debezium connector per service) for a single topic. Rejected — outbox is closer to the existing stack.
- **Two-phase commit between Postgres and Kafka**: XA over Kafka is supported by some clients but operationally fragile and adds a coordinator failure mode. Rejected for the same reasons as in [ADR-0001](0001-sync-wallet-rest-for-fund-locking.md).
- **`AFTER_COMMIT` with synchronous Kafka send + retry-on-failure inside the listener**: same race, just with the failure window shrunk. The listener can't be retried after the transaction is gone, so any failure that survives the in-listener retry is still a permanent event loss.
- **Cap `attempts` and dead-letter to `failed_events`**: would prevent a "stuck row blocks the index" scenario in theory. In practice with the partial index there's no blocking — failing rows just sit there. Adding the cap requires an admin replay tool; deferred until first incident demands it.
- **Drop Kafka entirely** (since wallet no longer needs it after [ADR-0001](0001-sync-wallet-rest-for-fund-locking.md)): considered, rejected. `market-data`'s 24h aggregator and WebSocket broadcast are still driven by the topic, and the analytics stream is genuinely useful as a decoupling boundary for future consumers (notification service, reporting, etc.).
