# Architecture Decision Records

Each file in this folder is a single **Architecture Decision Record (ADR)** — a short, immutable note documenting one significant choice. Together they form the engineering history of this codebase: *what was decided, why, and what the trade-off cost.*

## Why bother

Code shows *what* the system does today. Git history shows *when* it changed. Neither shows *why* the choice was made or what was rejected. ADRs fill that gap so a future maintainer (or a senior reviewer in an interview) can read the engineering reasoning without spelunking through deleted branches.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-sync-wallet-rest-for-fund-locking.md) | Synchronous wallet REST for fund locking | Accepted |
| [0002](0002-atomic-settlement-transaction.md) | Atomic 4-wallet settlement in one transaction | Accepted |
| [0003](0003-in-memory-order-book.md) | In-memory order book with per-symbol `ReentrantLock` | Accepted |
| [0004](0004-separate-postgres-per-service.md) | Separate Postgres database per service | Accepted |
| [0005](0005-persistable-uuid-for-orders.md) | `Persistable<UUID>` for pre-generated order IDs | Accepted |
| [0006](0006-real-exchange-order-semantics.md) | Real-exchange order semantics — TIF, STP, stop-limit | Accepted |
| [0007](0007-solo-workflow-direct-push.md) | Solo workflow — direct push for trivia, FF-merge for features | Accepted |
| [0008](0008-fees-credited-to-house-wallet.md) | Maker / taker fees credited to a house wallet | Accepted |
| [0009](0009-transactional-outbox-for-kafka.md) | Transactional outbox for Kafka events | Accepted |

## Format

Each ADR is a short Markdown file with the following sections:

```markdown
# NNNN — Title

**Status:** Accepted | Superseded by [NNNN](...) | Deprecated
**Date:** YYYY-MM-DD

## Context
Two or three sentences on the situation that forced the decision. State the
constraint, not the solution.

## Decision
One or two sentences. The chosen path, named precisely.

## Consequences
- What this buys us.
- What it costs us.
- What new failure modes it introduces.
- What it makes harder to change later.

## Alternatives considered
- Option A — why rejected.
- Option B — why rejected.
```

## Rules

1. **ADRs are immutable.** Once an ADR is `Accepted`, do not edit the substance — write a new ADR that supersedes it and update the old one's `Status` line to `Superseded by [NNNN]`.
2. **Numbering is sequential** (`0001`, `0002`, …). Never reuse a number. Never reorder.
3. **One decision per ADR.** If a feature bundles three independent calls, write three ADRs.
4. **Write the ADR at the same time as the code.** ADRs written six months later are reconstructed memory, not engineering reasoning.
5. **Brevity beats completeness.** A 40-line ADR that names the trade-off cleanly is more useful than a 400-line essay.

## When to write a new ADR

Any of these warrants an ADR:

- A non-trivial choice between sync and async, or REST and messaging.
- A schema design that locks in a constraint (composite keys, partitioning, soft-delete vs hard-delete).
- A library choice when at least one credible alternative exists (Kafka vs RabbitMQ, Flyway vs Liquibase, MapStruct vs manual).
- A workflow change (PR vs direct push, squash vs rebase, conventional commits).
- A correctness fix that changes a previously-accepted invariant (e.g. moving from at-least-once to exactly-once delivery).
- Removing a feature or dependency that was previously load-bearing.

The bar is: *would a future reader, looking at the diff alone, wonder why this was chosen?* If yes — write the ADR.
