# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
# Build entire multi-module project
mvn -B clean verify

# Build without running tests
mvn -B clean package -DskipTests

# Run all tests
mvn -B clean verify -DskipTests=false

# Run tests for a single module
mvn -B test -pl crypto-order-matching

# Run a single test class
mvn -B test -pl crypto-order-matching -Dtest=OrderMatchingEngineTest

# Run a single test method
mvn -B test -pl crypto-wallet -Dtest=WalletServiceTest#methodName
```

## Running the Full Stack

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET_KEY (min 32 chars for HS256)

# Start all services (infra + microservices)
docker compose up --build

# Verify
curl http://localhost:8080/api/v1/market-data
```

pgAdmin is available at `http://localhost:5050` (admin@crypto.com / admin).

## Architecture

Maven multi-module project — one parent `pom.xml` with five Spring Boot child modules:

| Module | Port | Role |
|---|---|---|
| `crypto-gateway` | 8080 | Spring Cloud Gateway — single entry point, JWT filter, CORS |
| `crypto-auth` | 8081 | Registration, login, JWT issuance, refresh token rotation |
| `crypto-order-matching` | 8082 | Order book, price-time-priority matching engine, Kafka producer |
| `crypto-wallet` | 8083 | Wallet balances, fund locking/unlocking, Kafka consumer |
| `crypto-market-data` | 8084 | 24h trade stats, public market data, Kafka consumer + Redis cache |

**Infrastructure:** Single PostgreSQL instance with separate databases per service (`auth_db`, `order_db`, `wallet_db`, `market_db`). Two Redis instances: `redis-cache` (:6379) for auth refresh tokens, `redis-market` (:6380) for market data cache.

## Request Flow & Auth

The gateway validates JWTs **before** forwarding requests. `crypto-gateway/JwtAuthenticationFilter` parses the `Authorization: Bearer <token>` header, extracts the `userId` claim, and injects an `X-User-Id` header into the downstream request. Services read user identity from this header — they do not re-validate JWTs independently (except `crypto-wallet` which also holds a JWT secret for its own token extraction).

Routes `/api/v1/auth/**` and `/api/v1/market-data/**` are public. All other routes require the `JwtAuthenticationFilter` gateway filter.

JWT access tokens expire in 15 min (900000 ms); refresh tokens expire in 7 days. Refresh tokens are stored in Redis and are revocable on logout.

## Order Matching & Kafka Events

Order placement in `OrderService` follows this sequence:
1. Persist the order to PostgreSQL.
2. Publish `OrderPlacedEvent` → Kafka topic `order-events`.
3. Synchronously invoke `OrderMatchingEngine.matchOrder()`.
4. If a match is found, publish `OrderMatchedEvent` → `order-events`.
5. On cancel, publish `OrderCancelledEvent` → `order-events`.

Both `crypto-wallet` and `crypto-market-data` consume from `order-events` in separate consumer groups. Event type discrimination in `OrderEventConsumer` is done by inspecting JSON field presence (`tradeId` → matched, `orderId` → placed, `reason` → cancelled).

Idempotency is enforced via a `ProcessedEvent` table in the wallet service — events keyed by `orderId` or `tradeId` are skipped if already processed.

## Wallet Fund Locking (Saga Pattern)

- `OrderPlacedEvent` → lock quote currency (BUY) or base currency (SELL).
- `OrderMatchedEvent` → transfer funds between buyer and seller atomically.
- `OrderCancelledEvent` → unlock the previously locked funds.

Symbol format is `BASE-QUOTE` (e.g., `BTC-USDT`), split on `/` or `-`.

## Key Design Notes

- **Lombok + MapStruct**: annotation processor order matters — `lombok-mapstruct-binding` is declared in the parent POM's compiler plugin. Always keep Lombok before MapStruct in `annotationProcessorPaths`.
- **DDL**: `spring.jpa.hibernate.ddl-auto=update` in all services. Schema evolves automatically — no migration tool.
- **JWT secret must match** across gateway, auth, order, and wallet services. All four read from the `JWT_SECRET_KEY` env var / `application.security.jwt.secret-key` property.
- **Tests use Mockito mocks** — no embedded DB or Testcontainers. Smoke tests (`*SmokeTest`) use `@SpringBootTest` with `@MockBean` for infrastructure.
