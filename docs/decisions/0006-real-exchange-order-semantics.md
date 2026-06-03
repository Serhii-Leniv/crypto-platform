# 0006 — Real-exchange order semantics: TIF, STP, stop-limit

**Status:** Accepted
**Date:** 2026-06-03

## Context

A plain LIMIT / MARKET book is a starting point, not a finished exchange. Once placement and settlement were correct ([ADR-0001](0001-sync-wallet-rest-for-fund-locking.md), [ADR-0002](0002-atomic-settlement-transaction.md)), the gap between this codebase and a credible exchange was: order semantics. Specifically the things every Binance / Coinbase user takes for granted — IOC, FOK, POST_ONLY, the platform refusing to match a user against themselves, and stop orders.

This ADR documents the three additions made in one phase because they share an implementation surface.

## Decision

### Time-in-Force (TIF)

`TimeInForce` enum on `LIMIT` orders: `GTC` (default) | `IOC` | `FOK` | `POST_ONLY`. Enforced in `OrderService.placeOrder()`:

- **GTC** — default; order rests in the book until filled or cancelled.
- **POST_ONLY** — checked *before* book entry via `SymbolOrderBook.bestOppositePrice(side)`. If the limit would cross the top of book, the order is rejected with a compensating unlock.
- **FOK** — checked *before* book entry via `SymbolOrderBook.availableCounterpartyQty(aggressor)` (which respects STP). If less liquidity is available than the order quantity, reject with compensating unlock.
- **IOC** — matched first, then any unfilled remainder is cancelled and the unmatched portion of the lock is unlocked.

### Self-Trade Prevention (STP)

In `OrderMatchingEngine.matchOrder()`, the candidate loop skips any counterparty with `counterparty.userId.equals(newOrder.userId)`. The skip happens before `canMatch` so the loop continues to the next candidate rather than aborting.

`availableCounterpartyQty` for FOK also filters out same-user candidates so an FOK that *appears* fillable against my own book is correctly rejected as unfillable.

### Stop-limit orders

New `OrderType.STOP_LIMIT` and `OrderStatus.TRIGGER_PENDING`. At placement:

- Funds are locked synchronously, same as any other order ([ADR-0001](0001-sync-wallet-rest-for-fund-locking.md)).
- The order is persisted with `status = TRIGGER_PENDING` and **does not enter the book**.

`StopOrderMonitor` (`@Scheduled(fixedDelay = 3000, initialDelay = 10_000)`) polls market prices via `MarketDataClient.getAllLastPrices()` and scans `orders WHERE status = TRIGGER_PENDING`. Activation:

- BUY-stop: `lastPrice >= triggerPrice` → flip to `PENDING`, add to book, call `OrderMatchingEngine.matchOrder(order)`.
- SELL-stop: `lastPrice <= triggerPrice` → same.

## Consequences

- **Realism**: the order types and behaviours match what professional traders expect. STP in particular prevents wash-trading patterns.
- **Compensation surface**: any rejection after the lock (`POST_ONLY`, `FOK`, IOC remainder) requires a compensating unlock. These are best-effort and logged — see `OrderService.compensateLockOnReject`. A failure here leaves a stale lock that admin reconciliation must clear.
- **Stop-order latency**: the monitor's `fixedDelay = 3s` means a stop can activate up to 3 seconds after the trigger price is breached. Acceptable for the demo; a production deployment would want the monitor wired to the matching engine's price-tick event instead of polling.
- **No `availableCounterpartyQty` cache**: the FOK feasibility scan walks the opposite side under the per-symbol lock. For deep books and many concurrent FOKs, this is O(depth) per FOK. Acceptable at current scale; would need a precomputed depth ladder if FOK volume rose.
- **Funds locked for `TRIGGER_PENDING`**: this matches Binance behaviour — stop orders reserve their cost even before triggering. Users see this in their wallet as locked balance.

## Alternatives considered

- **Stop activation via event-driven trigger** (subscribe to trade events, evaluate stops on each price update): more responsive than polling, but adds a coupling from the matching engine to the stop monitor and requires careful ordering with the current price-tick path. Deferred — the polling shape was sufficient for the demo and trivially correct.
- **STP modes** (`CANCEL_NEWEST`, `CANCEL_BOTH`, `DECREASE_AND_CANCEL` à la Binance): only `SKIP` is implemented (silently skip the matching candidate). Future ADR could add the others if required.
- **`MARKET BUY`**: explicitly rejected by `OrderService.lockFundsForOrder()` — there is no price ceiling against which to lock, and the demo does not implement a quote-currency-budget alternative. `MARKET SELL` is supported because the seller is locking a known base-currency quantity.
