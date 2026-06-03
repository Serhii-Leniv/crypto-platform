# 0001 — Synchronous wallet REST for fund locking

**Status:** Accepted
**Date:** 2026-06-03

## Context

The original design locked funds asynchronously: `OrderService` published an `OrderPlacedEvent` to Kafka, and a `wallet-service` consumer reserved the buyer's quote currency (or the seller's base currency). The order was added to the in-memory book immediately after publishing — *before* the consumer ran.

This left a window during which:

- The order was visible to the matching engine and could be matched.
- The matched counterparty could be settled.
- The original order's funds had not yet been deducted.

In practice this meant the platform could execute trades on credit. Even with `processed_events` idempotency, an `Insufficient` outcome at the consumer would leave a filled trade that the wallet couldn't honour. Real exchanges (Binance, Coinbase, Kraken) lock atomically with order acceptance — async locking is a correctness bug, not a design choice.

## Decision

Move fund locking onto the synchronous request path. `OrderService.placeOrder()` calls `walletClient.lock(...)` over HTTP **before** persisting the order, before adding it to the book, and before invoking the matching engine. A 4xx from `/internal/wallets/lock` aborts placement — the order never exists.

Kafka events for `ORDER_PLACED` / `ORDER_CANCELLED` / `ORDER_MATCHED` are kept as an informational stream consumed by `market-data` for analytics. The wallet consumer is now a deliberate no-op that preserves the consumer-group offset.

## Consequences

- **Correctness**: trading on credit is impossible by construction; the lock is the gate to the book.
- **Latency coupling**: `wallet-service` latency now sits directly on the order-placement P99. A wallet outage manifests as a placement failure rather than silent inconsistency — surfaced honestly to the caller.
- **Coupling shape**: order-matching depends on wallet-service at runtime. The two were independently scalable before; now they're not in the placement path.
- **Compensating logic**: TIF rejections (POST_ONLY, FOK) and IOC remainders now require *compensating unlocks* (`OrderService.compensateLockOnReject` / `unlockRemainder`). Best-effort — failure is logged but does not propagate.
- **Operational signal**: `wallet-service` becomes part of the order-matching SLO. Circuit-breaker on the gateway → wallet path becomes essential.

## Alternatives considered

- **Two-phase commit (XA)**: rejected — requires XA support across PostgreSQL + Kafka, adds a coordinator failure mode, and is operationally heavy for a single correctness invariant.
- **Outbox pattern with sync-then-publish**: the placement transaction writes the lock and the order in one local transaction, and an outbox publishes the event. Considered, but wallet-service still needs to be the source of truth for balances — the order-matching service can't authoritatively lock funds it doesn't own. The sync-REST shape is simpler and the latency hit is small in practice (sub-10ms in-cluster).
- **Optimistic locking + reversal**: place the order, let it match, then unwind on settlement failure. Rejected — the reversal would need to back out a fill that may already have been broadcast to other counterparties.
