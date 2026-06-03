# 0003 — In-memory order book with per-symbol `ReentrantLock`

**Status:** Accepted
**Date:** 2026-06-03

## Context

The matching engine needs O(log n) lookup of the best bid/ask and FIFO at each price level. With a SQL-backed book, every match round-trips to Postgres for the candidate scan and again for each update. At trading load this serialises through the database and adds 1–10 ms per match — small per request but lethal for an order book.

PostgreSQL remains the source of truth for orders (durability, history, regulatory replay). The hot path needs to live somewhere faster.

## Decision

Maintain a per-JVM **in-memory order book**:

- `OrderBookManager` — `ConcurrentHashMap<String, SymbolOrderBook>` keyed by symbol.
- `SymbolOrderBook` — holds two `TreeMap<BigDecimal, ArrayDeque<Order>>` (bids reversed for max-first, asks natural for min-first), guarded by one `ReentrantLock`.
- `OrderBookInitializer` (`ApplicationRunner`) — on JVM start, scans `orders WHERE status IN (PENDING, PARTIALLY_FILLED)` and rebuilds the books.

Every mutation acquires the per-symbol lock. Other symbols' books are unaffected — symbol parallelism is the natural shard.

## Consequences

- **Match latency**: dominated by lock contention on one symbol, not by network or disk. Easily sub-millisecond for the in-memory scan.
- **Single point of replay**: at startup, all open orders must be replayable from the DB. `OrderBookInitializer` does this synchronously in the `ApplicationRunner` phase before any HTTP traffic is accepted.
- **Single JVM**: the book is not distributed. Horizontal scaling requires either symbol-sharding (route requests for a given symbol to one instance) or a distributed in-memory grid. Out of scope for this codebase.
- **Crash semantics**: if the JVM dies mid-match (after `Order.fill()` but before `orderRepository.save()`), the DB still has the pre-fill state and the book replays it cleanly on restart. The settlement transaction in wallet-service either committed (fill happened, the orders just look unfilled in this JVM until next save) or rolled back (clean state). The hazard is narrow but real and would justify event-sourcing in a production deployment.
- **GC pressure**: orders are short-lived `Order` references inside the `ArrayDeque`; nothing exotic. Heap is bounded by the open-order count.

## Alternatives considered

- **Pure SQL book with index-only scans**: simplest, but the per-match round-trip cost dominates. Considered for an MVP — rejected once the platform started claiming real-exchange semantics.
- **Redis ZSET as the book**: would distribute trivially but adds a network hop per scan-step and loses the `ArrayDeque` FIFO at a price level (ZSETs are sorted by score; ties need secondary sort).
- **Off-heap structure (Chronicle Queue)**: overkill for this load; complexity not justified.
