package org.serhiileniv.wallet.kafka;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
            Object event = objectMapper.readValue(message, Object.class);
            if (message.contains("\"tradeId\"")) {
                OrderMatchedEvent matchedEvent = objectMapper.readValue(message, OrderMatchedEvent.class);
                handleOrderMatched(matchedEvent);
            } else if (message.contains("\"orderId\"")) {
                OrderPlacedEvent placedEvent = objectMapper.readValue(message, OrderPlacedEvent.class);
                handleOrderPlaced(placedEvent);
            }
        } catch (Exception e) {
            log.error("Error processing event: {}", message, e);
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
        }
        processedEventRepository.save(new ProcessedEvent(event.getOrderId(), "ORDER_PLACED"));
        log.info("OrderPlacedEvent processed: {}", event.getOrderId());
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
        processedEventRepository.save(new ProcessedEvent(event.getTradeId(), "ORDER_MATCHED"));
        log.info("OrderMatchedEvent processed: {}", event.getTradeId());
    }
    private String[] extractCurrencies(String symbol) {
        return symbol.split("/");
    }
    private String extractQuoteCurrency(String symbol) {
        String[] parts = symbol.split("/");
        return parts.length > 1 ? parts[1] : "USD";
    }
}
