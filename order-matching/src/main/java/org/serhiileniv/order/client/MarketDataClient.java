package org.serhiileniv.order.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads current market prices from market-data service via HTTP. Used by the stop-order
 * monitor to check whether triggers should fire.
 *
 * Caches in-memory for a few seconds — the monitor polls every 2s; we don't want a fresh
 * round-trip per symbol on each tick.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MarketDataClient {

    private final RestClient marketDataRestClient;

    private record Ticker(String symbol, BigDecimal lastPrice) {}

    public Map<String, BigDecimal> getAllLastPrices() {
        try {
            List<Map<String, Object>> rows = marketDataRestClient.get()
                    .uri("/api/v1/market-data")
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<List<Map<String, Object>>>() {});
            Map<String, BigDecimal> out = new HashMap<>();
            if (rows != null) {
                for (Map<String, Object> row : rows) {
                    Object sym = row.get("symbol");
                    Object lp = row.get("lastPrice");
                    if (sym != null && lp != null) {
                        out.put(sym.toString(), new BigDecimal(lp.toString()));
                    }
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("market-data fetch failed: {}", e.getMessage());
            return Map.of();
        }
    }

    @Configuration
    static class RestClientConfig {
        @Bean
        public RestClient marketDataRestClient(@Value("${app.market.base-url:http://market-service:8084}") String baseUrl) {
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
