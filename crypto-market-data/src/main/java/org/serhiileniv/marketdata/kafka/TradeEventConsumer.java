package org.serhiileniv.marketdata.kafka;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.marketdata.kafka.event.OrderMatchedEvent;
import org.serhiileniv.marketdata.service.MarketDataService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;
@Component
@RequiredArgsConstructor
@Slf4j
public class TradeEventConsumer {
    private final MarketDataService marketDataService;
    private final ObjectMapper objectMapper;
    @KafkaListener(topics = "order-events", groupId = "market-data-service-group")
    public void consumeOrderEvent(@Payload String message,
            @Header(KafkaHeaders.RECEIVED_KEY) String key) {
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(message);
            if ("ORDER_MATCHED".equals(root.path("eventType").asText())) {
                handleTradeEvent(objectMapper.treeToValue(root, OrderMatchedEvent.class));
            }
        } catch (Exception e) {
            log.error("Error processing trade event: {}", message, e);
        }
    }
    private void handleTradeEvent(OrderMatchedEvent event) {
        log.info("Processing trade event for symbol: {}", event.getSymbol());
        marketDataService.updateMarketData(event.getSymbol(), event.getPrice(), event.getQuantity());
    }
}
