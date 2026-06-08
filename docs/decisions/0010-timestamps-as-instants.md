# 0010 — Timestamps stored and serialised as `Instant`, not `LocalDateTime`

**Status:** Accepted
**Date:** 2026-06-07

## Context

Every entity in the platform — `Order`, `OutboxEvent`, `Wallet`, `Transaction`, `Trade`, `MarketData`, `ProcessedEvent`, `FailedEvent`, `TradingPair` — used `java.time.LocalDateTime` for `createdAt`, `updatedAt`, `tradedAt`, `publishedAt`, and similar columns. Hibernate's `@CreationTimestamp` / `@UpdateTimestamp` filled them via `LocalDateTime.now()` against the JVM's default zone.

The bug surfaced as "every timestamp in the frontend is N hours off". Reproduction:

1. Service containers run with `TZ=UTC`. `LocalDateTime.now()` returns the wall clock in UTC — e.g. `2026-06-07T13:27:00`.
2. The column is `TIMESTAMP WITHOUT TIME ZONE`; Postgres stores the value verbatim with no zone metadata.
3. Jackson serialises `LocalDateTime` as `"2026-06-07T13:27:00"` — no `Z`, no offset, because the type itself has no zone.
4. The browser does `new Date("2026-06-07T13:27:00")`. Per the ECMAScript specification, an ISO 8601 datetime string *without* a timezone designator is interpreted as **local time**.
5. If the user's browser is at UTC+2, the resulting `Date` represents `13:27 UTC+2` — i.e. `11:27 UTC`. The frontend's "X minutes ago" helper subtracts this from `Date.now()` (current real UTC), gets a 2-hour difference, and labels a just-placed order as "2h ago".

The same pathology was already absent for one set of timestamps — Spring's `ProblemDetail` serialised `Instant` with the `Z` suffix, and that one rendered correctly. Two timestamp types, one wire format that browsers can parse unambiguously, one that they can't.

This is a type-system bug, not a configuration bug. `LocalDateTime` means "wall clock without a zone" — it is the right type for "every day at 14:00" but the wrong type for "the moment this trade happened". The latter is an instant in time, and the corresponding Java type is `java.time.Instant`.

## Decision

Convert every timestamp field across the platform from `LocalDateTime` to `Instant`. This applies to:

- Entity fields (`@CreationTimestamp`, `@UpdateTimestamp`, and plain timestamp columns).
- Response DTOs and records.
- Kafka event payloads (`OrderPlacedEvent`, `OrderMatchedEvent`, `OrderCancelledEvent`, `TradeEventDto`).
- Repository query parameters (`@Param("since") Instant since`).
- Test fixtures.

Migrate the corresponding Postgres columns from `TIMESTAMP` to `TIMESTAMP WITH TIME ZONE` per service (Flyway V6 / V5 / V3 depending on the module's existing version chain):

```sql
ALTER TABLE orders
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';
```

Existing rows were written by a JVM whose default zone was UTC, so tagging them with `AT TIME ZONE 'UTC'` during the conversion preserves their meaning.

No Jackson configuration is needed. Spring Boot 3 auto-configures `JavaTimeModule` with `WRITE_DATES_AS_TIMESTAMPS=false`, which serialises `Instant` as `"2026-06-07T13:27:00.247Z"`. Browsers parse this correctly as a UTC instant via `new Date(...)`; the existing frontend formatters (`toLocaleString`, `formatTimeAgo`) work unchanged.

Use explicit `@PrePersist` / `@PreUpdate` JPA callbacks (`this.createdAt = Instant.now()`) instead of `@CreationTimestamp` / `@UpdateTimestamp` on entities with a pre-generated `@Id` (`Persistable<UUID>`). With that combination on Hibernate 6.6, the generator writes the value to the database but leaves the in-memory field null on the entity instance returned from Spring Data's `save(...)`. The frontend would then see `createdAt: null` on the POST response and only the next GET would render a real value. Manual lifecycle callbacks side-step the generator entirely and keep the JVM-side instance in sync with the row.

## Consequences

- **Frontend renders the correct local time on every panel** — order tables, recent trades, wallet timestamps, market-data updated-at. No frontend code changes required; the fix is entirely in the wire format.
- **Type system enforces correctness for new code**: `Instant.now()` is unambiguous about its meaning, so future developers cannot accidentally introduce the same bug via `LocalDateTime.now()` against an unknown JVM zone.
- **Cross-service consistency**: `TIMESTAMP WITH TIME ZONE` columns store a real instant on disk. A future ops query that joins or compares across services no longer needs to remember "this column is UTC by convention".
- **One-shot data migration**: Flyway V6/V5/V3 rewrite the column type in place using `AT TIME ZONE 'UTC'`. Brief table rewrite per service; safe because the project's data volume is small and there's no live cluster behind this. At production scale the same change would need `ALTER TABLE ... ADD COLUMN ..._tz timestamptz`, dual-write, backfill, swap.
- **Kafka event schema change**: existing in-flight events on `order-events` were serialised with `LocalDateTime`. After this change, consumers deserialise `Instant`. Acceptable for this project (queue is drained on restart, no replay window crosses the migration), but in a production system this would warrant a versioned schema or a parallel rollout.
- **Hibernate 6 + JDBC 4.2 path**: `Instant` maps to `TIMESTAMP WITH TIME ZONE` natively. No custom `AttributeConverter` required.

## Alternatives considered

- **Configure Jackson to serialise `LocalDateTime` as UTC with a `Z` suffix.** Would fix the symptom on the wire while leaving the underlying type wrong. New developers reading `LocalDateTime createdAt` would still get the wrong mental model, and any code path that bypassed Jackson (logging, custom serialisation, future GraphQL) would re-introduce the bug. Rejected — fixing the type is cheaper long-term than maintaining a hidden convention.
- **Frontend-only coercion** (`new Date(s.endsWith('Z') ? s : s + 'Z')`). Hides the type bug entirely from the backend and assumes every backend timestamp is implicitly UTC. The first time someone adds a `LocalDateTime` field meaning "every day at 14:00", the frontend would silently mistreat it. Rejected for the same reason — pushing semantic guarantees out to a string-suffix check.
- **`ZonedDateTime` instead of `Instant`.** Carries a zone *name* with each value. Useful for "the meeting is at 14:00 in Kyiv even when DST changes", but every timestamp in this system is a moment in time, not a calendar appointment. `Instant` is the minimal correct type. Rejected as over-specifying.
- **`OffsetDateTime`.** Carries a fixed offset (e.g. `+00:00`) but no zone identity. Functionally equivalent to `Instant` on the wire for our use, slightly less ergonomic in Java because every comparison has to reason about the offset. Rejected — `Instant` is the closer fit semantically.
- **Leave columns as `TIMESTAMP` and only change the Java type.** Would work but loses the on-disk zone tag, so any non-JVM consumer of the DB (psql, BI tool, future ops query) has to remember the "all timestamps are UTC by convention" rule. The migration to `TIMESTAMPTZ` is cheap and makes the convention explicit. Rejected.
