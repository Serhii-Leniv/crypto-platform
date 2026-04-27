# Crypto Exchange Platform

[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4.5-6DB33F?style=flat-square&logo=spring&logoColor=white)](https://spring.io/projects/spring-boot)
[![Spring Cloud](https://img.shields.io/badge/Spring_Cloud-2024.0.1-6DB33F?style=flat-square&logo=spring&logoColor=white)](https://spring.io/projects/spring-cloud)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-7.8-231F20?style=flat-square&logo=apache-kafka&logoColor=white)](https://kafka.apache.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-8-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A production-grade cryptocurrency exchange platform built on a microservices architecture. The system handles user authentication, order placement and matching, wallet management, and real-time market data — all communicating asynchronously through Apache Kafka.

---

## Key Features

- **JWT Authentication** — Stateless access tokens (15 min) with Redis-backed refresh token rotation (7 days)
- **Price-Time Priority Matching Engine** — In-memory order book supporting LIMIT and MARKET orders for BUY/SELL
- **Wallet & Fund Management** — Deposit, withdraw, and atomic fund locking using a Saga pattern over Kafka
- **Event-Driven Architecture** — Order lifecycle events (`ORDER_PLACED`, `ORDER_MATCHED`, `ORDER_CANCELLED`) fan out over a single Kafka topic
- **Market Data Aggregation** — 24 h rolling stats (last price, high, low, volume, trade count) cached in Redis with midnight reset
- **API Gateway** — Single entry point with JWT validation filter, `X-User-Id` header injection, and CORS support
- **Virtual Threads** — All four WebMVC services run on Java 21 virtual threads (`spring.threads.virtual.enabled=true`)
- **OpenAPI / Swagger UI** — Interactive API documentation available at `/swagger-ui.html` on every service
- **Fully Dockerized** — One-command startup with `docker compose`

---

## Architecture

```
                        ┌────────────────────────┐
                        │       API Gateway       │
                        │         :8080           │
                        │  JWT filter + CORS      │
                        └───────────┬─────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
    ┌──────┴──────┐        ┌────────┴───────┐       ┌───────┴───────┐
    │ Auth Service│        │ Order Service  │       │ Wallet Service│
    │    :8081    │        │    :8082       │       │    :8083      │
    │ PostgreSQL  │        │ PostgreSQL     │       │ PostgreSQL    │
    │ Redis       │        │ Kafka Producer │       │ Kafka Consumer│
    └─────────────┘        └──────┬─────────┘       └───────────────┘
                                  │
                         ┌────────┴────────┐
                         │  Apache Kafka   │
                         │  order-events   │
                         └────────┬────────┘
                                  │
                         ┌────────┴────────┐
                         │  Market Data    │
                         │    :8084        │
                         │  PostgreSQL     │
                         │  Redis Cache    │
                         └─────────────────┘
```

### Request flow

1. Every request hits the **API Gateway** on port `8080`.
2. The `JwtAuthenticationFilter` validates the `Authorization: Bearer <token>` header for protected routes.
3. The validated `userId` claim is injected as an `X-User-Id` header before forwarding downstream.
4. Public routes (`/api/v1/auth/**`, `/api/v1/market-data/**`) bypass the filter.

---

## Technology Stack

| Layer              | Technology                                  |
|--------------------|---------------------------------------------|
| Language           | Java 21 (virtual threads enabled)           |
| Framework          | Spring Boot 3.4.5                           |
| API Gateway        | Spring Cloud Gateway 2024.0.1               |
| Security           | Spring Security + JWT (JJWT 0.12.6)         |
| Messaging          | Apache Kafka — Confluent Platform 7.8 KRaft |
| Persistence        | Spring Data JPA + PostgreSQL 15             |
| Caching            | Spring Data Redis 8                         |
| Object Mapping     | MapStruct 1.6.3 + Lombok 1.18.36            |
| Containerization   | Docker + Docker Compose                     |
| Build Tool         | Maven (multi-module)                        |
| API Docs           | SpringDoc OpenAPI 2.8.6 (Swagger UI)        |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Java 21+ (for local development only)
- Maven 3.9+ (for local development only)

### Run with Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/Serhii-Leniv/crypto-platform.git
cd crypto-platform

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET_KEY to a random string of at least 32 characters

# 3. Build and start all services
docker compose up --build
```

All microservices start after the infrastructure (Postgres, Kafka, Redis) reports healthy.

### Verify the Stack

```bash
# Public endpoint — no token required
curl http://localhost:8080/api/v1/market-data

# Register a user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'
```

### Management UIs

| Tool       | URL                        | Credentials              |
|------------|----------------------------|--------------------------|
| pgAdmin 4  | http://localhost:5050      | admin@crypto.com / admin |
| Swagger UI | http://localhost:8081/swagger-ui.html | Auth service |
| Swagger UI | http://localhost:8082/swagger-ui.html | Order service |
| Swagger UI | http://localhost:8083/swagger-ui.html | Wallet service |
| Swagger UI | http://localhost:8084/swagger-ui.html | Market data  |

---

## API Reference

All requests are routed through the **API Gateway** on port `8080`. Protected routes require `Authorization: Bearer <accessToken>`.

### Authentication — `POST /api/v1/auth`

| Method | Path        | Auth | Description                        |
|--------|-------------|------|------------------------------------|
| POST   | `/register` | No   | Register a new user account        |
| POST   | `/login`    | No   | Authenticate and receive tokens    |
| POST   | `/refresh`  | No   | Obtain a new access token          |
| POST   | `/logout`   | Yes  | Revoke the current refresh token   |

**Request body** (`/register`, `/login`):
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response**:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

### Orders — `/api/v1/orders`

| Method | Path                | Auth | Description                          |
|--------|---------------------|------|--------------------------------------|
| POST   | `/`                 | Yes  | Place a new order                    |
| GET    | `/`                 | Yes  | List all orders for the current user |
| GET    | `/{orderId}`        | Yes  | Retrieve a specific order            |
| DELETE | `/{orderId}`        | Yes  | Cancel an open order                 |
| GET    | `/book/{symbol}`    | Yes  | Retrieve the live order book         |

**Place order request body**:
```json
{
  "symbol": "BTC-USDT",
  "side": "BUY",
  "orderType": "LIMIT",
  "quantity": 0.1,
  "price": 45000.00
}
```

Supported values: `side` — `BUY` | `SELL`; `orderType` — `LIMIT` | `MARKET`. Symbol format: `BASE-QUOTE` or `BASE/QUOTE` (e.g. `BTC-USDT`, `ETH/USDT`).

---

### Wallets — `/api/v1/wallets`

| Method | Path              | Auth | Description                          |
|--------|-------------------|------|--------------------------------------|
| POST   | `/deposit`        | Yes  | Deposit funds into a wallet          |
| POST   | `/withdraw`       | Yes  | Withdraw funds from a wallet         |
| GET    | `/`               | Yes  | List all wallets for the current user|
| GET    | `/transactions`   | Yes  | List all transactions                |

**Deposit / Withdraw request body**:
```json
{
  "currency": "USDT",
  "amount": 1000.00
}
```

---

### Market Data — `/api/v1/market-data`

| Method | Path            | Auth | Description                         |
|--------|-----------------|------|-------------------------------------|
| GET    | `/`             | No   | List 24 h stats for all symbols     |
| GET    | `/{symbol}`     | No   | Get 24 h stats for a specific symbol|

**Response example**:
```json
{
  "symbol": "BTC-USDT",
  "lastPrice": 45123.50,
  "openPrice24h": 44800.00,
  "high24h": 45500.00,
  "low24h": 44200.00,
  "volume24h": 123.456,
  "tradeCount24h": 87
}
```

---

## Order Matching

The matching engine uses **price-time priority**:

1. A `LIMIT BUY` order for `BTC-USDT` at `45,000` is saved to PostgreSQL.
2. An `OrderPlacedEvent` is published to the `order-events` Kafka topic.
3. The matching engine queries open `SELL` orders sorted by price ascending.
4. The first SELL order with price ≤ 45,000 is matched at the SELL price.
5. An `OrderMatchedEvent` is published to `order-events`.
6. **Wallet service** (consumer group `wallet-group`) atomically transfers funds between buyer and seller, releasing locked balances.
7. **Market data service** (consumer group `market-data-group`) updates last price, 24 h stats, and evicts the Redis cache.

Idempotency is enforced via a `ProcessedEvent` table in the wallet service — duplicate events keyed by `orderId` / `tradeId` are discarded.

---

## Environment Variables

Copy `.env.example` to `.env` before starting. The only variable that **must** be changed for production:

| Variable         | Description                           | Requirement             |
|------------------|---------------------------------------|-------------------------|
| `JWT_SECRET_KEY` | HS256 signing secret shared by all services | Minimum 32 characters |

---

## Project Structure

```
crypto-platform/
├── auth/                   # Registration, login, JWT issuance, refresh token rotation
├── gateway/                # Spring Cloud Gateway — routing, JWT filter, CORS
├── order-matching/         # Order book, price-time-priority matching engine, Kafka producer
├── wallet/                 # Wallet balances, fund locking/unlocking, Kafka consumer
├── market-data/            # 24 h trade stats, Redis cache, Kafka consumer
├── frontend/               # React + TypeScript frontend
├── docker/                 # PostgreSQL init scripts
├── docker-compose.yml      # Full stack orchestration
└── pom.xml                 # Parent Maven POM
```

---

## Local Development

```bash
# Build all modules (skip tests)
mvn -B clean package -DskipTests

# Run all tests
mvn -B clean verify

# Run tests for a single module
mvn -B test -pl order-matching

# Run a single test class
mvn -B test -pl order-matching -Dtest=OrderMatchingEngineTest
```

Start infrastructure only (Postgres, Kafka, Redis) while running services locally:

```bash
docker compose up postgres redis-cache redis-market kafka
```

---

## License

[MIT](LICENSE)
