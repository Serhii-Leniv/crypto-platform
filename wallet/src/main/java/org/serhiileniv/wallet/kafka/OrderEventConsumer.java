package org.serhiileniv.wallet.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.kafka.event.OrderCancelledEvent;
import org.serhiileniv.wallet.kafka.event.OrderMatchedEvent;
import org.serhiileniv.wallet.kafka.event.OrderPlacedEvent;
import org.serhiileniv.wallet.kafka.event.OrderSide;
import org.serhiileniv.wallet.model.ProcessedEvent;
import org.serhiileniv.wallet.repository.ProcessedEventRepository;
import org.serhiileniv.wallet.service.WalletService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderEventConsumer {
    private final WalletService walletService;
    private final ProcessedEventRepository processedEventRepository;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "order-events", groupId = "wallet-service-group")
    @Transactional
    public void consumeOrderEvent(@Payload String message,
            @Header(KafkaHeaders.RECEIVED_KEY) String key) {
        log.info("Received event with key: {}", key);
        com.fasterxml.jackson.databind.JsonNode root;
        try {
            root = objectMapper.readTree(message);
        } catch (JsonProcessingException e) {
            // Malformed JSON — not retryable, log and discard
            log.error("Unparseable event payload, discarding. key={} payload={}", key, message, e);
            return;
        }
        // Business exceptions propagate to DefaultErrorHandler → exponential backoff → DLT
        // NOTE: wallet now mutates state synchronously via /internal/wallets/* REST endpoints
        // called by order-matching during place/cancel/match. Kafka events for ORDER_PLACED,
        // ORDER_CANCELLED, ORDER_MATCHED are NO LONGER consumed here — they're left flowing
        // only for market-data analytics. Keeping this listener as a no-op preserves the
        // wallet's place in the consumer group so Kafka doesn't replay history on restart.
        String eventType = root.path("eventType").asText("");
        log.debug("Skipping {} event for key={} (wallet uses sync REST now)", eventType, key);
        // Runtime exceptions (InsufficientFunds, WalletNotFound, etc.) are not caught here —
        // they bubble up to DefaultErrorHandler which retries with exponential backoff then routes to DLT
    }

    private void handleOrderPlaced(OrderPlacedEvent event) {
        if (processedEventRepository.existsByEventIdAndEventType(event.getOrderId(), "ORDER_PLACED")) {
            log.info("Order {} already processed, skipping", event.getOrderId());
            return;
        }
        log.info("Processing OrderPlacedEvent: {}", event.getOrderId());
        if (event.getSide() == OrderSide.BUY && event.getPrice() != null) {
            String quoteCurrency = extractQuoteCurrency(event.getSymbol());
            BigDecimal totalCost = event.getPrice().multiply(event.getQuantity());
            String desc = String.format("%s BUY order placed @ %s — %s %s locked",
                    event.getSymbol(), trim(event.getPrice()), trim(totalCost), quoteCurrency);
            walletService.lockFunds(event.getUserId(), quoteCurrency, totalCost, event.getOrderId(), desc);
        } else if (event.getSide() == OrderSide.SELL) {
            String baseCurrency = extractBaseCurrency(event.getSymbol());
            String desc = String.format("%s SELL order placed — %s %s locked",
                    event.getSymbol(), trim(event.getQuantity()), baseCurrency);
            walletService.lockFunds(event.getUserId(), baseCurrency, event.getQuantity(), event.getOrderId(), desc);
        }
        processedEventRepository.save(new ProcessedEvent(event.getOrderId(), "ORDER_PLACED"));
        log.info("OrderPlacedEvent processed: {}", event.getOrderId());
    }

    private void handleOrderCancelled(OrderCancelledEvent event) {
        if (processedEventRepository.existsByEventIdAndEventType(event.getOrderId(), "ORDER_CANCELLED")) {
            log.info("Cancellation for order {} already processed, skipping", event.getOrderId());
            return;
        }
        log.info("Processing OrderCancelledEvent: {}", event.getOrderId());
        String reason = event.getReason() != null && !event.getReason().isBlank() ? event.getReason() : "cancelled";
        if (event.getSide() == OrderSide.BUY && event.getPrice() != null) {
            String quoteCurrency = extractQuoteCurrency(event.getSymbol());
            BigDecimal totalCost = event.getPrice().multiply(event.getRemainingQuantity());
            String desc = String.format("%s BUY order %s — %s %s unlocked",
                    event.getSymbol(), reason.toLowerCase(), trim(totalCost), quoteCurrency);
            walletService.unlockFunds(event.getUserId(), quoteCurrency, totalCost, event.getOrderId(), desc);
        } else if (event.getSide() == OrderSide.SELL) {
            String baseCurrency = extractBaseCurrency(event.getSymbol());
            String desc = String.format("%s SELL order %s — %s %s unlocked",
                    event.getSymbol(), reason.toLowerCase(), trim(event.getRemainingQuantity()), baseCurrency);
            walletService.unlockFunds(event.getUserId(), baseCurrency, event.getRemainingQuantity(),
                    event.getOrderId(), desc);
        }
        processedEventRepository.save(new ProcessedEvent(event.getOrderId(), "ORDER_CANCELLED"));
        log.info("OrderCancelledEvent processed: {}", event.getOrderId());
    }

    private void handleOrderMatched(OrderMatchedEvent event) {
        if (processedEventRepository.existsByEventIdAndEventType(event.getTradeId(), "ORDER_MATCHED")) {
            log.info("Trade {} already processed, skipping", event.getTradeId());
            return;
        }
        log.info("Processing OrderMatchedEvent: {}", event.getTradeId());
        String[] currencies = extractCurrencies(event.getSymbol());
        String baseCurrency = currencies[0];
        String quoteCurrency = currencies[1];
        BigDecimal baseAmount = event.getQuantity();
        BigDecimal quoteAmount = event.getPrice().multiply(event.getQuantity());

        // Rich descriptions: include symbol + price + side so the transaction log reads as a story.
        String buyerBaseDesc  = String.format("%s BUY filled @ %s — received %s %s",
                event.getSymbol(), trim(event.getPrice()), trim(baseAmount), baseCurrency);
        String buyerQuoteDesc = String.format("%s BUY filled @ %s — paid %s %s",
                event.getSymbol(), trim(event.getPrice()), trim(quoteAmount), quoteCurrency);
        String sellerBaseDesc  = String.format("%s SELL filled @ %s — delivered %s %s",
                event.getSymbol(), trim(event.getPrice()), trim(baseAmount), baseCurrency);
        String sellerQuoteDesc = String.format("%s SELL filled @ %s — received %s %s",
                event.getSymbol(), trim(event.getPrice()), trim(quoteAmount), quoteCurrency);

        walletService.processTrade(event.getBuyerUserId(),  baseCurrency,  baseAmount,  event.getTradeId(), true,  buyerBaseDesc);
        walletService.processTrade(event.getBuyerUserId(),  quoteCurrency, quoteAmount, event.getTradeId(), false, buyerQuoteDesc);
        walletService.processTrade(event.getSellerUserId(), baseCurrency,  baseAmount,  event.getTradeId(), false, sellerBaseDesc);
        walletService.processTrade(event.getSellerUserId(), quoteCurrency, quoteAmount, event.getTradeId(), true,  sellerQuoteDesc);

        if (event.getBuyerLimitPrice() != null) {
            BigDecimal slippage = event.getBuyerLimitPrice().subtract(event.getPrice()).multiply(event.getQuantity());
            if (slippage.compareTo(BigDecimal.ZERO) > 0) {
                String desc = String.format("%s BUY slippage refund — %s %s returned (filled below limit)",
                        event.getSymbol(), trim(slippage), quoteCurrency);
                walletService.unlockFunds(event.getBuyerUserId(), quoteCurrency, slippage, event.getTradeId(), desc);
                log.info("Unlocked slippage: {} {} for user {} on trade {}",
                         slippage, quoteCurrency, event.getBuyerUserId(), event.getTradeId());
            }
        }

        processedEventRepository.save(new ProcessedEvent(event.getTradeId(), "ORDER_MATCHED"));
        log.info("OrderMatchedEvent processed: {}", event.getTradeId());
    }

    /** Strip trailing zeros for display in descriptions: 0.05000000 → 0.05, 95234.50 → 95234.5. */
    private static String trim(BigDecimal v) {
        if (v == null) return "0";
        return v.stripTrailingZeros().toPlainString();
    }

    private static final java.util.regex.Pattern SYMBOL_PATTERN =
            java.util.regex.Pattern.compile("^[A-Z]{3,6}[/-][A-Z]{3,6}$");

    private String[] extractCurrencies(String symbol) {
        validateSymbol(symbol);
        return symbol.split("[/-]");
    }

    private String extractQuoteCurrency(String symbol) {
        validateSymbol(symbol);
        String[] parts = symbol.split("[/-]");
        return parts[1];
    }

    private String extractBaseCurrency(String symbol) {
        validateSymbol(symbol);
        return symbol.split("[/-]")[0];
    }

    private void validateSymbol(String symbol) {
        if (symbol == null || !SYMBOL_PATTERN.matcher(symbol).matches()) {
            throw new IllegalArgumentException("Invalid trading symbol: " + symbol);
        }
    }
}
