# 🪙 Crypto Exchange Platform

[![Java](https://img.shields.io/badge/Java-17-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/17/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4.1-6DB33F?style=flat-square&logo=spring&logoColor=white)](https://spring.io/projects/spring-boot)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-7.5-231F20?style=flat-square&logo=apache-kafka&logoColor=white)](https://kafka.apache.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A **production-grade cryptocurrency exchange platform** built with a microservices architecture. The system handles user authentication, order placement and matching, wallet management, and real-time market data — all communicating asynchronously through **Apache Kafka**.

---

## ✨ Key Features

- **JWT Authentication** — Stateless access tokens + Redis-backed refresh token rotation
- **Price-Time Priority Order Matching Engine** — Supports LIMIT and MARKET orders for BUY/SELL
- **Wallet & Fund Management** — Deposit, withdraw, and atomic fund locking for open orders
- **Event-Driven Architecture** — Services communicate via Kafka topics (Saga pattern)
- **Market Data Service** — Real-time trade aggregation cached in Redis
- **API Gateway** — Single entry point with JWT validation filter and CORS support
- **Fully Dockerized** — One-command startup with `docker compose`

---

## 🏛️ Architecture

```
                          ┌─────────────────────┐
                          │    API Gateway       │
                          │     :8080            │
                          │  (JWT Filter + CORS) │
                          └─────────┬───────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
    ┌──────┴──────┐        ┌────────┴──────┐       ┌────────┴──────┐
    │ Auth Service │        │ Order Service │       │ Wallet Service│
    │    :8081     │        │    :8082      │       │    :8083      │
    │ PostgreSQL   │        │ PostgreSQL    │       │ PostgreSQL    │
    │ Redis        │        │ Kafka Producer│       │ Kafka Consumer│
    └─────────────┘        └──────┬────────┘       └───────────────┘
                                  │
                         ┌────────┴────────┐
                         │  Apache Kafka   │
                         │  (order events) │
                         └────────┬────────┘
                                  │
                         ┌────────┴────────┐
                         │  Market Data    │
                         │    :8084        │
                         │  PostgreSQL     │
                         │  Redis Cache    │
                         └─────────────────┘
```

---

## 🛠️ Technology Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Language           | Java 17                                 |
| Framework          | Spring Boot 3.4.1                       |
| API Gateway        | Spring Cloud Gateway                    |
| Security           | Spring Security + JWT (JJWT 0.12)       |
| Messaging          | Apache Kafka (Confluent 7.5)            |
| Persistence        | Spring Data JPA + PostgreSQL            |
| Caching            | Spring Data Redis                       |
| Object Mapping     | MapStruct + Lombok                      |
| Containerization   | Docker + Docker Compose                 |
| Build Tool         | Maven (multi-module)                    |
| API Docs           | SpringDoc OpenAPI (Swagger UI)          |

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Java 17+ (for local development)

### Run with Docker

```bash
# 1. Clone the repository
git clone https://github.com/Serhii-Leniv/crypto-platform.git
cd crypto-platform

# 2. Copy environment variables
cp .env.example .env
# Edit .env and set a strong JWT_SECRET_KEY

# 3. Build and start all services
docker compose up --build
```

All services will be available after infrastructure (Postgres, Kafka, Redis) is healthy.

### Verify the Stack is Running

```bash
curl http://localhost:8080/api/v1/market-data
```

---

## 📡 API Reference

All requests go through the **API Gateway** on port `8080`. Protected routes require a valid `Authorization: Bearer <token>` header.

### Auth Service — `/api/v1/auth`

| Method | Path        | Auth | Description                    |
|--------|-------------|------|--------------------------------|
| POST   | `/register` | ❌   | Register a new user            |
| POST   | `/login`    | ❌   | Login and receive tokens       |
| POST   | `/refresh`  | ❌   | Refresh the access token       |
| POST   | `/logout`   | ✅   | Revoke the refresh token       |

**Register / Login body:**
```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

### Order Service — `/api/v1/orders`

| Method | Path          | Auth | Description             |
|--------|---------------|------|-------------------------|
| POST   | `/`           | ✅   | Place a new order       |
| GET    | `/`           | ✅   | List user's orders      |
| GET    | `/{orderId}`  | ✅   | Get a specific order    |
| DELETE | `/{orderId}`  | ✅   | Cancel an open order    |

**Place Order body:**
```json
{
  "symbol": "BTC-USDT",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": 0.1,
  "price": 45000.00
}
```

---

### Wallet Service — `/api/v1/wallets`

| Method | Path              | Auth | Description               |
|--------|-------------------|------|---------------------------|
| POST   | `/deposit`        | ✅   | Deposit funds             |
| POST   | `/withdraw`       | ✅   | Withdraw funds            |
| GET    | `/`               | ✅   | List all user wallets     |
| GET    | `/transactions`   | ✅   | List user transactions    |

**Deposit / Withdraw body:**
```json
{
  "currency": "USDT",
  "amount": 1000.00
}
```

---

### Market Data Service — `/api/v1/market-data`

| Method | Path          | Auth | Description                     |
|--------|---------------|------|---------------------------------|
| GET    | `/`           | ❌   | Get all trading pairs data      |
| GET    | `/{symbol}`   | ❌   | Get market data for a symbol    |

---

## ⚙️ Environment Variables

See [`.env.example`](.env.example) for a full list. The most important variable is:

| Variable        | Description                     | Default (insecure!) |
|-----------------|---------------------------------|---------------------|
| `JWT_SECRET_KEY`| HS256 secret for JWT signing    | Local dev value     |

---

## 🗂️ Project Structure

```
crypto/
├── crypto-auth/            # Authentication & JWT service
├── crypto-order-matching/  # Order book & matching engine
├── crypto-wallet/          # Wallet & transaction management
├── crypto-market-data/     # Market data aggregation & caching
├── crypto-gateway/         # API Gateway (routing + auth filter)
├── docker/                 # PostgreSQL init scripts
├── docker-compose.yml      # Full stack orchestration
└── pom.xml                 # Parent Maven POM
```

---

## 📝 How Order Matching Works

1. User places a **LIMIT BUY** order for `BTC-USDT` at price `45,000`.
2. The **Order Service** saves the order, then calls the **Matching Engine**.
3. The Matching Engine queries existing **SELL** orders sorted by price ascending (best ask first).
4. If a SELL order's price ≤ 45,000, a match is executed at the SELL order's price (price-time priority).
5. A `OrderMatchedEvent` is published to **Kafka**.
6. The **Wallet Service** consumes the event and atomically transfers funds between buyer and seller.
7. The **Market Data Service** consumes the event and updates the last trade price & 24h stats (cached in Redis).

---

## 📜 License

[MIT](LICENSE)
>>>>>>> d580e82 (feat: rework & fix)
