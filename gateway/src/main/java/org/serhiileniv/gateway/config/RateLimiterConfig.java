package org.serhiileniv.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

import java.util.Objects;

@Configuration
public class RateLimiterConfig {

    /** IP-based key — used for public endpoints (auth, market-data). */
    @Bean
    public KeyResolver ipKeyResolver() {
        return exchange -> Mono.just(
                Objects.requireNonNull(exchange.getRequest().getRemoteAddress())
                        .getAddress()
                        .getHostAddress()
        );
    }

    /**
     * User-based key for authenticated endpoints (orders, wallet).
     * Falls back to IP when X-User-Id is absent so unauthenticated probes are still limited.
     * Marked @Primary so Spring Cloud Gateway's RequestRateLimiterGatewayFilterFactory
     * can resolve a single default KeyResolver; per-route resolvers are still selected
     * by name via SpEL (e.g. #{@ipKeyResolver}) in application.yml.
     */
    @Bean
    @Primary
    public KeyResolver userKeyResolver() {
        return exchange -> {
            String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
            if (userId != null && !userId.isBlank()) {
                return Mono.just("user:" + userId);
            }
            String ip = Objects.requireNonNull(exchange.getRequest().getRemoteAddress())
                    .getAddress().getHostAddress();
            return Mono.just("ip:" + ip);
        };
    }
}
