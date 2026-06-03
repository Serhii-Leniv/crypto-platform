package org.serhiileniv.order.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.exception.InsufficientFundsException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.UUID;

/**
 * Synchronous HTTP client to wallet-service for fund lock / unlock / settle operations.
 *
 * Why synchronous: the previous async Kafka-based flow left a window where an order
 * was visible to the matching engine before funds were actually reserved — effectively
 * allowing trades on credit. Real exchanges always lock funds atomically with order
 * book entry. This client makes that possible.
 *
 * Calls go directly to wallet-service via the internal Docker network, bypassing the
 * gateway (so no JWT round-trip). The {@code /internal/wallets/**} endpoints aren't
 * routed by the gateway and are therefore unreachable from the public API.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WalletClient {

    private final RestClient walletRestClient;

    public record LockRequest(
            UUID userId, String currency, BigDecimal amount,
            UUID orderId, String description) {}

    public record SettleRequest(
            UUID buyerId, UUID sellerId,
            String baseCurrency, String quoteCurrency,
            BigDecimal baseAmount, BigDecimal quoteAmount,
            BigDecimal executionPrice, BigDecimal buyerLimitPrice,
            UUID tradeId, String symbol,
            Integer buyerFeeBps, Integer sellerFeeBps) {}

    public void lock(UUID userId, String currency, BigDecimal amount, UUID orderId, String description) {
        try {
            walletRestClient.post()
                    .uri("/internal/wallets/lock")
                    .body(new LockRequest(userId, currency, amount, orderId, description))
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        throw new InsufficientFundsException(
                                "Insufficient " + currency + " balance to place order");
                    })
                    .toBodilessEntity();
        } catch (InsufficientFundsException e) {
            throw e;
        } catch (Exception e) {
            log.error("Wallet lock call failed for user={} amount={} {}: {}", userId, amount, currency, e.getMessage());
            throw new RuntimeException("Wallet service unavailable", e);
        }
    }

    public void unlock(UUID userId, String currency, BigDecimal amount, UUID orderId, String description) {
        try {
            walletRestClient.post()
                    .uri("/internal/wallets/unlock")
                    .body(new LockRequest(userId, currency, amount, orderId, description))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.error("Wallet unlock call failed for user={} amount={} {}: {}", userId, amount, currency, e.getMessage());
            // Unlock failures shouldn't block order cancellation flow — log and continue
        }
    }

    public void settle(SettleRequest req) {
        try {
            walletRestClient.post()
                    .uri("/internal/wallets/settle")
                    .body(req)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.error("Wallet settle failed for trade {}: {}", req.tradeId(), e.getMessage());
            throw new RuntimeException("Trade settlement failed: " + e.getMessage(), e);
        }
    }

    @Configuration
    static class RestClientConfig {
        @Bean
        public RestClient walletRestClient(@Value("${app.wallet.base-url:http://wallet-service:8083}") String baseUrl) {
            return RestClient.builder()
                    .baseUrl(baseUrl)
                    .requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(
                            java.net.http.HttpClient.newBuilder()
                                    .connectTimeout(Duration.ofSeconds(2))
                                    .build()))
                    .build();
        }
    }
}
