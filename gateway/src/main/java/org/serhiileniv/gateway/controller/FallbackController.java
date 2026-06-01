package org.serhiileniv.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
public class FallbackController {

    @RequestMapping("/fallback/auth")
    public Mono<ResponseEntity<Map<String, String>>> authFallback() {
        return fallback("auth-service");
    }

    @RequestMapping("/fallback/orders")
    public Mono<ResponseEntity<Map<String, String>>> ordersFallback() {
        return fallback("order-matching-service");
    }

    @RequestMapping("/fallback/wallets")
    public Mono<ResponseEntity<Map<String, String>>> walletsFallback() {
        return fallback("wallet-service");
    }

    @RequestMapping("/fallback/market-data")
    public Mono<ResponseEntity<Map<String, String>>> marketFallback() {
        return fallback("market-data-service");
    }

    private Mono<ResponseEntity<Map<String, String>>> fallback(String service) {
        return Mono.just(ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "Service temporarily unavailable",
                        "service", service,
                        "message", "The circuit breaker is open. Please try again shortly."
                )));
    }
}
