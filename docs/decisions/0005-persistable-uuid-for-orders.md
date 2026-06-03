# 0005 — `Persistable<UUID>` for pre-generated order IDs

**Status:** Accepted
**Date:** 2026-06-03

## Context

`OrderService.placeOrder()` needs to reference the `orderId` *before* the order is persisted — specifically, it has to pass that ID to `walletClient.lock(...)` so the wallet has a stable key for the lock (used later for `unlock` on cancel and for the idempotency check in `processed_events`).

The natural shape is to generate the ID locally:

```java
UUID orderId = UUID.randomUUID();
walletClient.lock(userId, currency, amount, orderId);
Order order = Order.builder().id(orderId)...build();
orderRepository.save(order);
```

But Spring Data JPA's `save()` uses entity state to decide between `INSERT` (`persist`) and `UPDATE` (`merge`). The default detection is: "is the `@Id` field non-null?" → if yes, `merge`. With a pre-set `@Id`, `save()` issues an `UPDATE` against a row that doesn't exist yet — Hibernate throws `StaleObjectStateException` or silently does nothing depending on the version.

Three workable fixes existed:

1. Call `entityManager.persist(order)` explicitly. Brittle — bypasses Spring Data's repository contract and breaks `@Repository` mocks.
2. Use `@GeneratedValue(strategy = UUID)` and read the ID back after save. Cleaner JPA, but means the wallet lock has to happen *after* the order row exists — which would mean either a 2-phase lock or persisting an order before locking funds (defeating [ADR-0001](0001-sync-wallet-rest-for-fund-locking.md)).
3. Implement `Persistable<UUID>` and override `isNew()`.

## Decision

`Order` implements `org.springframework.data.domain.Persistable<UUID>`:

```java
@Transient
@Builder.Default
private boolean isNew = true;

@Override public UUID getId() { return id; }
@Override public boolean isNew() { return isNew; }

@PostPersist @PostLoad
void markPersisted() { this.isNew = false; }
```

Spring Data consults `isNew()` first; when it returns `true`, the repository takes the `INSERT` path regardless of `@Id` being set. `@PostPersist` and `@PostLoad` flip the flag after persistence / hydration so subsequent `save()` calls on the same instance correctly `UPDATE`.

## Consequences

- **The lock-then-persist flow works** as the natural three lines: lock, build with ID, save.
- **`@Transient boolean isNew`** lives on the entity — minor noise on every read of the model.
- **Tests**: integration tests that build an `Order` and call `save()` need to set `.id(UUID.randomUUID())` explicitly (no `@GeneratedValue` to fall back on). Unit tests using Mockito are unaffected.
- **Cloning an `Order`** to "create a similar new one" requires resetting `isNew = true` manually. Currently nothing in the codebase does this; if it ever does, it's a footgun.

## Alternatives considered

- **`@GeneratedValue(strategy = UUID)`**: covered above — incompatible with pre-lock ID requirement.
- **`entityManager.persist()` + flush**: works mechanically but breaks the Spring Data repository abstraction. Considered briefly during debugging; reverted.
- **Set `@Version` and start at `null`**: Hibernate uses version null as the "new" signal in some configurations. Tried, behaviour was inconsistent across the version field types.
