# GitHub Copilot Instructions — Trading Exchange Platform

## What This Project Is
A microservices crypto trading platform. Five Spring Boot 3 / Java 21 services orchestrated via Docker Compose, communicating through Kafka, with a React 18 + TypeScript frontend.

## Module Map
| Directory | Spring App Name | Port | Java Package |
|---|---|---|---|
| `auth/` | `auth-service` | 8081 | `org.serhiileniv.auth` |
| `gateway/` | `api-gateway` | 8080 | `org.serhiileniv.gateway` |
| `order-matching/` | `order-matching-service` | 8082 | `org.serhiileniv.order` |
| `wallet/` | `wallet-service` | 8083 | `org.serhiileniv.wallet` |
| `market-data/` | `market-data-service` | 8084 | `org.serhiileniv.marketdata` |
| `frontend/` | `exchange-ui` | 3000 | — |

## Naming Rules — Always Follow These

### Java classes
- Main classes: `AuthApplication`, `GatewayApplication`, `OrderMatchingApplication`, `WalletApplication`, `MarketDataApplication`
- No module-name prefix on service/repo classes: use `WalletService` not `WalletModuleService`
- DTOs: `<Entity>Request` / `<Entity>Response` — e.g. `OrderRequest`, `WalletResponse`
- Kafka events: `<Action>Event` — e.g. `OrderPlacedEvent`, `OrderMatchedEvent`
- Every Kafka event MUST have a `private String eventType;` field set to `ORDER_PLACED` / `ORDER_MATCHED` / `ORDER_CANCELLED`

### Config values
- Spring app names: `auth-service`, `api-gateway`, `order-matching-service`, `wallet-service`, `market-data-service`
- Kafka consumer groups: `wallet-group`, `market-data-group`
- Kafka topic: `order-events`
- Docker containers: `auth-service`, `api-gateway`, `order-matching-service`, `wallet-service`, `market-data-service`

### Frontend
- Pages/components: PascalCase — `PlaceOrderPage`, `OrderBookPage`
- API functions: camelCase — `placeOrder()`, `getWallets()`, `cancelOrder()`
- Types: PascalCase interfaces — `OrderResponse`, `WalletResponse`, `MarketDataResponse`

## Architecture — Key Rules

**Gateway is the only entry point.** All requests from the browser go through port 8080. The `JwtAuthenticationFilter` validates the JWT and injects `X-User-Id` header. Downstream services read `X-User-Id` — they never parse JWTs themselves (except wallet which has its own copy of the secret).

**Public endpoints** (no JWT): `/api/v1/auth/**`, `/api/v1/market-data/**`, `GET /api/v1/orders/book/{symbol}`

**Kafka events are the integration layer.** Order events flow through `order-events` topic. Wallet and market-data each have their own consumer group and process events independently. Discriminate event type by the `eventType` STRING field — never by field presence.

**Wallet is idempotent.** Before processing any Kafka event, check `processedEventRepository.existsByEventId(id)`. If true, skip. After processing, save a `ProcessedEvent`. This prevents double-spending on event redelivery.

**JWT_SECRET_KEY must be identical** in `gateway`, `auth`, `order-matching`, and `wallet`. It is injected via environment variable. Never hardcode it.

## Patterns in Use

### Service layer
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class ExampleService {
    private final ExampleRepository repository;

    @Transactional
    public void doSomething(UUID userId) {
        log.info("Processing for user {}", userId);
        // ...
    }
}
```

### Kafka consumer
```java
@KafkaListener(topics = "order-events", groupId = "wallet-group")
@Transactional
public void consumeOrderEvent(@Payload String message,
        @Header(KafkaHeaders.RECEIVED_KEY) String key) {
    JsonNode root = objectMapper.readTree(message);
    String eventType = root.path("eventType").asText("");
    switch (eventType) {
        case "ORDER_PLACED"    -> handleOrderPlaced(...);
        case "ORDER_MATCHED"   -> handleOrderMatched(...);
        case "ORDER_CANCELLED" -> handleOrderCancelled(...);
        default -> log.warn("Unknown eventType '{}', key={}", eventType, key);
    }
}
```

### Repository with pessimistic lock
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT w FROM Wallet w WHERE w.userId = :userId AND w.currency = :currency")
Optional<Wallet> findByUserIdAndCurrencyWithLock(@Param("userId") UUID userId,
                                                  @Param("currency") String currency);
```

## Testing Rules
- Use **Mockito mocks only** — no embedded DB, no Testcontainers
- Smoke tests use `@SpringBootTest` + `@MockBean` for all infrastructure
- Always set `eventType` on Kafka event objects in tests — the consumer switches on it

## Frontend Patterns
- Access token: JS memory only (`tokenStore.set()`), never `localStorage` — XSS protection
- All API calls go through the `apiClient` Axios instance (has auth + retry interceptors)
- On error: use `err.userMessage` (set by response interceptor) for display
- On mutation success: call `qc.invalidateQueries({ queryKey: [...] })` to refresh data

## Build Commands
```bash
mvn -B clean verify                  # full build + all tests
mvn -B test -pl order-matching       # single module
docker compose up --build            # start full stack
docker compose config                # validate compose without starting
grep -r "cryptoauth" auth/src/       # should return nothing (package renamed)
```
