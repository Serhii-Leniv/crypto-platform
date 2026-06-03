# 0004 — Separate Postgres database per service

**Status:** Accepted
**Date:** 2026-06-03

## Context

The platform has five services. The first iteration used a single `postgres` container hosting all four databases (`auth_db`, `order_db`, `wallet_db`, `market_db`). Convenient for `docker compose up`, but it created several problems:

- Schema migrations across services had to coordinate Flyway baseline versions on a shared instance.
- A vacuum or long migration on one service's tables held locks that affected the others.
- "Cross-service joins" became syntactically possible — and someone would eventually write one, defeating service boundaries.
- A misconfigured `JDBC_URL` on one service could connect to another service's tables.

## Decision

Four separate Postgres containers — one per stateful service:

| Container | Port (host) | Database |
|---|---|---|
| `postgres-auth` | 5432 | `auth_db` |
| `postgres-order` | 5433 | `order_db` |
| `postgres-wallet` | 5434 | `wallet_db` |
| `postgres-market` | 5435 | `market_db` |

Each service has its own Flyway migration history, its own connection pool, and no SQL-level access to any other service's data.

## Consequences

- **True service ownership**: schemas evolve independently. A migration mistake in `wallet-service` cannot break `order-matching`.
- **Independent failure domains**: locking, vacuum, autovacuum tuning, replication topology can all differ per service.
- **No cross-service joins** — by construction. If `order-matching` needs wallet state it must go through a wallet-service API.
- **Operational overhead**: four containers instead of one. Mitigated by Compose (one `up` still brings them all up) and identical config.
- **Backup strategy**: each service is backed up independently. Slightly more total disk but vastly simpler recovery.
- **PgAdmin / observability**: pgAdmin is pre-provisioned with all four registered as separate servers.

## Alternatives considered

- **Single Postgres with schema-per-service**: cheaper, but a shared instance still couples vacuum, replication, and connection-pool sizing. Migrations across schemas in one Flyway history are awkward.
- **Single database with naming convention** (`auth_users`, `wallet_balances`): rejected — invites the cross-service-join failure mode this decision is meant to prevent.
- **One database, multiple users with permissions**: would prevent unauthorised cross-service queries at the SQL layer but doesn't help with vacuum / migration coupling.
