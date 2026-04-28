package org.serhiileniv.wallet.kafka;

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
        try {
            log.info("Received event with key: {}", key);
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(message);
            String eventType = root.path("eventType").asText("");
            switch (eventType) {
                case "ORDER_MATCHED"   -> handleOrderMatched(objectMapper.treeToValue(root, OrderMatchedEvent.class));
                case "ORDER_PLACED"    -> handleOrderPlaced(objectMapper.treeToValue(root, OrderPlacedEvent.class));
                case "ORDER_CANCELLED" -> handleOrderCancelled(objectMapper.treeToValue(root, OrderCancelledEvent.class));
                default -> log.warn("Unknown or missing eventType '{}', key={}", eventType, key);
            }
        } catch (Exception e) {
            log.error("Error processing event key={}: {}", key, message, e);
        }
    }

    private void handleOrderPlaced(OrderPlacedEvent event) {
        if (processedEventRepository.existsByEventId(event.getOrderId())) {
            log.info("Order {} already processed, skipping", event.getOrderId());
            return;
        }
        log.info("Processing OrderPlacedEvent: {}", event.getOrderId());
        if (event.getSide() == OrderSide.BUY && event.getPrice() != null) {
            String quoteCurrency = extractQuoteCurrency(event.getSymbol());
            BigDecimal totalCost = event.getPrice().multiply(event.getQuantity());
            walletService.lockFunds(event.getUserId(), quoteCurrency, totalCost, event.getOrderId());
        } else if (event.getSide() == OrderSide.SELL) {
            String baseCurrency = extractBaseCurrency(event.getSymbol());
            walletService.lockFunds(event.getUserId(), baseCurrency, event.getQuantity(), event.getOrderId());
        }
        processedEventRepository.save(new ProcessedEvent(event.getOrderId(), "ORDER_PLACED"));
        log.info("OrderPlacedEvent processed: {}", event.getOrderId());
    }

    private void handleOrderCancelled(OrderCancelledEvent event) {
        if (processedEventRepository.existsByEventId(event.getOrderId())) {
            log.info("Cancellation for order {} already processed, skipping", event.getOrderId());
            return;
        }
        log.info("Processing OrderCancelledEvent: {}", event.getOrderId());
        if (event.getSide() == OrderSide.BUY && event.getPrice() != null) {
            String quoteCurrency = extractQuoteCurrency(event.getSymbol());
            BigDecimal totalCost = event.getPrice().multiply(event.getRemainingQuantity());
            walletService.unlockFunds(event.getUserId(), quoteCurrency, totalCost, event.getOrderId());
        } else if (event.getSide() == OrderSide.SELL) {
            String baseCurrency = extractBaseCurrency(event.getSymbol());
            walletService.unlockFunds(event.getUserId(), baseCurrency, event.getRemainingQuantity(),
                    event.getOrderId());
        }
        processedEventRepository.save(new ProcessedEvent(event.getOrderId(), "ORDER_CANCELLED"));
        log.info("OrderCancelledEvent processed: {}", event.getOrderId());
    }

    private void handleOrderMatched(OrderMatchedEvent event) {
        if (processedEventRepository.existsByEventId(event.getTradeId())) {
            log.info("Trade {} already processed, skipping", event.getTradeId());
            return;
        }
        log.info("Processing OrderMatchedEvent: {}", event.getTradeId());
        String[] currencies = extractCurrencies(event.getSymbol());
        String baseCurrency = currencies[0];
        String quoteCurrency = currencies[1];
        BigDecimal baseAmount = event.getQuantity();
        BigDecimal quoteAmount = event.getPrice().multiply(event.getQuantity());
        walletService.processTrade(event.getBuyerUserId(), baseCurrency, baseAmount, event.getTradeId(), true);
        walletService.processTrade(event.getBuyerUserId(), quoteCurrency, quoteAmount, event.getTradeId(), false);
        walletService.processTrade(event.getSellerUserId(), baseCurrency, baseAmount, event.getTradeId(), false);
        walletService.processTrade(event.getSellerUserId(), quoteCurrency, quoteAmount, event.getTradeId(), true);
        
        if (event.getBuyerLimitPrice() != null) {
            BigDecimal slippage = event.getBuyerLimitPrice().subtract(event.getPrice()).multiply(event.getQuantity());
            if (slippage.compareTo(BigDecimal.ZERO) > 0) {
                walletService.unlockFunds(event.getBuyerUserId(), quoteCurrency, slippage, event.getTradeId());
                log.info("Unlocked slippage: {} {} for user {} on trade {}", 
                         slippage, quoteCurrency, event.getBuyerUserId(), event.getTradeId());
            }
        }
        
        processedEventRepository.save(new ProcessedEvent(event.getTradeId(), "ORDER_MATCHED"));
        log.info("OrderMatchedEvent processed: {}", event.getTradeId());
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
