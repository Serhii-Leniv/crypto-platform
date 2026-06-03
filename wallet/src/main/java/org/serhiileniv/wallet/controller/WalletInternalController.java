package org.serhiileniv.wallet.controller;

import io.swagger.v3.oas.annotations.Hidden;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.service.WalletService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Service-to-service wallet operations, called synchronously by order-matching during
 * order placement, cancellation, and trade settlement.
 *
 * Exposed only on the internal Docker network at /internal/wallets/** — the gateway
 * does NOT route /internal/* paths anywhere, so these endpoints are unreachable from
 * the public API. order-matching reaches them directly at http://wallet-service:8083.
 */
@RestController
@RequestMapping("/internal/wallets")
@RequiredArgsConstructor
@Slf4j
@Hidden
public class WalletInternalController {

    private final WalletService walletService;

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

    @PostMapping("/lock")
    public void lock(@RequestBody LockRequest req) {
        walletService.lockFunds(req.userId(), req.currency(), req.amount(), req.orderId(),
                req.description() != null ? req.description() : "Locked for order " + req.orderId());
    }

    @PostMapping("/unlock")
    public void unlock(@RequestBody LockRequest req) {
        walletService.unlockFunds(req.userId(), req.currency(), req.amount(), req.orderId(),
                req.description() != null ? req.description() : "Unlocked from order " + req.orderId());
    }

    @PostMapping("/settle")
    public void settle(@RequestBody SettleRequest req) {
        walletService.settleTrade(
                req.buyerId(), req.sellerId(),
                req.baseCurrency(), req.quoteCurrency(),
                req.baseAmount(), req.quoteAmount(),
                req.executionPrice(), req.buyerLimitPrice(),
                req.tradeId(), req.symbol(),
                req.buyerFeeBps() != null ? req.buyerFeeBps() : 0,
                req.sellerFeeBps() != null ? req.sellerFeeBps() : 0);
    }
}
