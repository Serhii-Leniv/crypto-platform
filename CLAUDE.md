# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow — ALWAYS FOLLOW

Every commit must be authored as **Serhii Leniv**, without exception:

```bash
GIT_AUTHOR_NAME="Serhii Leniv" GIT_AUTHOR_EMAIL="leniv.tech@gmail.com" \
GIT_COMMITTER_NAME="Serhii Leniv" GIT_COMMITTER_EMAIL="leniv.tech@gmail.com" \
git commit -m "feat: ..."
```

- **Never commit to `main` directly** — use a feature branch.
- **Push after completing work** — never leave unpushed commits.
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `ci:` — present tense, no trailing period.
- **Before merging to main**: squash WIP commits so each commit on main is self-contained.

## Build & Test Commands

```bash
# Build entire multi-module project
mvn -B clean verify

# Build without running tests
mvn -B clean package -DskipTests

# Run all tests
mvn -B clean verify -DskipTests=false

# Run tests for a single module
mvn -B test -pl order-matching

# Run a single test class
mvn -B test -pl order-matching -Dtest=OrderMatchingEngineTest

# Run a single test method
mvn -B test -pl wallet -Dtest=WalletServiceTest#methodName
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
| `gateway` | 8080 | Spring Cloud Gateway — single entry point, JWT filter, CORS, rate limiting, circuit breakers |
| `auth` | 8081 | Registration, login, JWT issuance, refresh token (httpOnly cookie) |
| `order-matching` | 8082 | In-memory order book, price-time-priority matching engine, Kafka producer |
| `wallet` | 8083 | Wallet balances, fund locking/unlocking (saga pattern), Kafka consumer |
| `market-data` | 8084 | 24h trade stats, WebSocket broadcast, Kafka consumer + Redis cache |

**Infrastructure:** 4 separate PostgreSQL containers (one per service):
- `postgres-auth` :5432 → `auth_db`
- `postgres-order` :5433 → `order_db`
- `postgres-wallet` :5434 → `wallet_db`
- `postgres-market` :5435 → `market_db`

Two Redis instances: `redis-cache` (:6379) for auth refresh tokens, `redis-market` (:6380) for market data cache.

## Naming Conventions

- **Module directories**: no prefix — `auth`, `gateway`, `wallet`, `order-matching`, `market-data`
- **Spring app names**: `auth-service`, `api-gateway`, `wallet-service`, `order-matching-service`, `market-data-service`
- **Java packages**: `org.serhiileniv.auth`, `org.serhiileniv.gateway`, `org.serhiileniv.wallet`, `org.serhiileniv.order`, `org.serhiileniv.marketdata`
- **Docker containers**: `auth-service`, `api-gateway`, `wallet-service`, `order-matching-service`, `market-data-service`
- **Kafka consumer groups**: `wallet-group`, `market-data-group`
- **Kafka topics**: `order-events`

## Request Flow & Auth

The gateway validates JWTs **before** forwarding requests. `gateway/JwtAuthenticationFilter` parses the `Authorization: Bearer <token>` header, extracts the `userId` claim, and injects an `X-User-Id` header into the downstream request. Services read user identity from this header — they do not re-validate JWTs independently (except `wallet` which also holds a JWT secret for its own token extraction).

Routes `/api/v1/auth/**` and `/api/v1/market-data/**` are public. All other routes require the `JwtAuthenticationFilter` gateway filter.

CORS is configured with `allowCredentials: true` and `allowedOriginPatterns` (wildcard origins are incompatible with credentials).

JWT access tokens expire in 15 min (900000 ms); refresh tokens expire in 7 days. **Refresh tokens are stored as an httpOnly cookie** (`refresh_token`, Path `/api/v1/auth`) — never in localStorage. `AuthResponse` body contains only `accessToken`. On mount, the frontend calls `/api/v1/auth/refresh` to restore the session from the cookie.

## Order Matching & In-Memory Order Book

`SymbolOrderBook` holds bids (`TreeMap<BigDecimal, ArrayDeque<Order>>` reversed) and asks (natural order) per symbol, protected by a `ReentrantLock`. `OrderBookManager` (`ConcurrentHashMap`) manages all books. `OrderBookInitializer` (ApplicationRunner) loads all `PENDING`/`PARTIALLY_FILLED` orders from the DB on startup.

Order placement in `OrderService` follows this sequence:
1. Persist the order to PostgreSQL.
2. Add to in-memory book: `orderBookManager.getOrCreate(symbol).add(order)`.
3. Publish `OrderPlacedEvent` → Kafka topic `order-events`.
4. Synchronously invoke `OrderMatchingEngine.matchOrder()`.
5. If a match is found, publish `OrderMatchedEvent` → `order-events`.
6. On cancel, remove from book and publish `OrderCancelledEvent` → `order-events`.

`getOrderBook()` reads directly from the in-memory book — no DB query.

## Kafka Events

Both `wallet` and `market-data` consume from `order-events` in separate consumer groups. Event type discrimination uses the `eventType` field: `ORDER_PLACED`, `ORDER_MATCHED`, `ORDER_CANCELLED`.

Idempotency is enforced via a `ProcessedEvent` table in the wallet service — events keyed by `orderId` or `tradeId` are skipped if already processed.

## Wallet Fund Locking (Saga Pattern)

- `OrderPlacedEvent` → lock quote currency (BUY) or base currency (SELL).
- `OrderMatchedEvent` → transfer funds between buyer and seller atomically.
- `OrderCancelledEvent` → unlock the previously locked funds.

Symbol format is `BASE-QUOTE` (e.g., `BTC-USDT`), split on `/` or `-`.

## Pagination

All list endpoints return `Page<T>` with `page`/`size` query params; max page size 100. Frontend uses React Query with `queryKey: ['key', page]`.

## WebSocket

STOMP over SockJS. Gateway routes `/ws/market-data/**` → market-data, `/ws/orderbook/**` → order-matching. Frontend hooks: `useMarketDataSocket`, `useOrderBookSocket` (reconnect delay 5s). Topics: `/topic/orderbook/{symbol}`, `/topic/trades/{symbol}`, `/topic/market-data`.

## Key Design Notes

- **Lombok + MapStruct**: annotation processor order matters — `lombok-mapstruct-binding` is declared in the parent POM's compiler plugin. Always keep Lombok before MapStruct in `annotationProcessorPaths`.
- **DDL**: `spring.jpa.hibernate.ddl-auto=update` in all services. Schema evolves automatically — no migration tool.
- **JWT secret must match** across gateway, auth, order-matching, and wallet services. All four read from the `JWT_SECRET_KEY` env var / `application.security.jwt.secret-key` property.
- **Tests use Mockito mocks** — no embedded DB or Testcontainers. Smoke tests (`*SmokeTest`) use `@SpringBootTest` with `@MockBean` for infrastructure.
- **No comments** unless the WHY is non-obvious. Never describe what the code does.
- **Validate at system boundaries** only — `@Valid` on controller params, not inside services.
