# Contributing to Crypto Exchange Platform

Thank you for your interest in contributing! This guide covers how to set up a local development environment, naming conventions, and the pull-request process.

---

## Getting Started

### Prerequisites

| Tool | Minimum version |
|---|---|
| Java | 21 |
| Maven | 3.9 |
| Docker | 24 |
| Docker Compose | v2 |
| Node.js (frontend only) | 20 |

### Local setup

```bash
git clone https://github.com/Serhii-Leniv/crypto-platform.git
cd crypto-platform

# Start infrastructure only (Postgres, Kafka, Redis, Zipkin)
docker compose up postgres redis-cache redis-market kafka zipkin -d

# Build (skip tests for speed)
mvn -B clean package -DskipTests

# Run a specific service from the IDE or CLI:
cd auth && mvn spring-boot:run
```

### Running the full stack

```bash
cp .env.example .env
# Set JWT_SECRET_KEY to a random 32+ character string
docker compose up --build
```

---

## Project Structure

```
crypto-platform/
├── auth/             # Spring Boot — JWT auth, refresh tokens
├── gateway/          # Spring Cloud Gateway — routing, circuit breaker
├── order-matching/   # Order book, matching engine, Kafka producer
├── wallet/           # Fund management, Kafka consumer (Saga)
├── market-data/      # 24h stats, Redis cache, Kafka consumer
├── frontend/         # React 19 + TypeScript + TailwindCSS
├── k8s/              # Kubernetes manifests
└── docker/           # PostgreSQL init scripts, Prometheus/Grafana config
```

---

## Development Workflow

1. **Fork** the repository and create a feature branch from `main`.
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Follow naming conventions** from `CLAUDE.md`:
   - Module dirs: lowercase, no prefix (`auth`, `wallet`, …)
   - Java packages: `org.serhiileniv.<service>`
   - Spring app names: `<service>-service`

3. **Write tests** — unit tests with Mockito are the primary pattern. Integration tests using Testcontainers are in `*IntegrationTest` classes.

4. **Add a Flyway migration** if you change any database schema:
   ```
   <module>/src/main/resources/db/migration/V<N>__description.sql
   ```

5. **Run the full test suite** before pushing:
   ```bash
   mvn -B clean verify
   ```

6. **Open a pull request** against `main` using the PR template.

---

## Coding Standards

- **Lombok + MapStruct**: annotation processors are declared in the parent POM. Always keep Lombok before MapStruct in `annotationProcessorPaths`.
- **No magic strings** for JWT secret, DB URLs, or Kafka bootstrap servers — use environment variables / `application.properties` placeholders.
- **Error handling**: use the existing `GlobalExceptionHandler` (`@RestControllerAdvice`) in each service. Return `ProblemDetail` (RFC 9457) with a `timestamp` extension.
- **Swagger**: annotate every new endpoint with `@Operation`, `@Tag`, and `@ApiResponse` for at least `200`, `400`, and `401`/`403` where applicable.
- **Logging**: use SLF4J (`@Slf4j`). Log at `INFO` for business events, `DEBUG` for internal state, `WARN`/`ERROR` for failures.

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(order): add support for STOP_LIMIT orders
fix(wallet): correctly unlock balance on partial cancel
chore(ci): upgrade JDK to 21.0.4
docs: update API reference for /api/v1/orders
```

---

## Questions

Open a [GitHub Issue](https://github.com/Serhii-Leniv/crypto-platform/issues) or start a Discussion.
