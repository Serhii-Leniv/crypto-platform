# 0002 — Atomic 4-wallet settlement in one transaction

**Status:** Accepted
**Date:** 2026-06-03

## Context

A single match between a buyer and a seller produces four wallet movements:

1. Buyer's base currency: `available += baseAmount − buyerFee`
2. Buyer's quote currency: `locked   −= quoteAmount`
3. Seller's base currency: `locked   −= baseAmount`
4. Seller's quote currency: `available += quoteAmount − sellerFee`

Plus, when the buyer's limit price was higher than the execution price, a slippage refund to the buyer's quote currency.

The original implementation drove each movement from a separate Kafka event handler call in `wallet-service`. If the consumer crashed between movements 2 and 3 — or if any single update failed validation — the wallets ended up in a state where the buyer had received their base currency but the seller had not received their quote currency. Reconciliation was possible (the `processed_events` table records what landed) but expensive and manual.

## Decision

Introduce `POST /internal/wallets/settle`. The handler performs all five movements (four core + slippage refund) inside a single `@Transactional` method on `WalletService.settleTrade(...)`. Either every movement lands or none of them do.

The matching engine calls `walletClient.settle(...)` synchronously per match, inside its own outer transaction. A failure inside settlement throws, the wallet transaction rolls back, and the outer matching transaction rolls back the in-memory `Order.fill(...)` it just applied.

## Consequences

- **Atomicity**: wallet inconsistency from a partial settlement is impossible.
- **Failure visibility**: settlement failures surface as 5xx to the matching engine, which propagates them to the caller. There is no silent state divergence.
- **Tighter coupling**: the matching engine and the wallet service share the trade-level transaction boundary at the protocol level (HTTP + JSON), even though they don't share a physical transaction.
- **Throughput ceiling**: settlement now serialises through one wallet-service transaction per match. Acceptable for a single-instance demo; would need sharding by user-id or by symbol at production scale.
- **Idempotency**: the settle endpoint records `(tradeId, "ORDER_MATCHED")` in `processed_events` before commit. A retry of the same `tradeId` short-circuits to 200.

## Alternatives considered

- **Saga with compensating actions**: the original design. Rejected — compensation for a partial fill that another consumer might have already observed is intractable in the general case.
- **Outbox + at-least-once settlement events**: would solve the durability concern but doesn't solve the *atomicity within the wallet* concern. Each event would still need a transactional handler — we'd be reinventing this ADR inside the consumer.
- **Stored procedure / `WITH` CTE**: would give true single-statement atomicity in Postgres but couples business logic to SQL and loses unit-test ergonomics.
