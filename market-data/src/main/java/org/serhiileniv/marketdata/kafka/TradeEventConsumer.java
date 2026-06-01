package org.serhiileniv.marketdata.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.marketdata.dto.MarketDataResponse;
import org.serhiileniv.marketdata.dto.TradeEventDto;
import org.serhiileniv.marketdata.kafka.event.OrderMatchedEvent;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.service.MarketDataService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class TradeEventConsumer {

    private final MarketDataService marketDataService;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;

    @KafkaListener(topics = "order-events", groupId = "market-data-service-group")
    public void consumeOrderEvent(@Payload String message,
            @Header(KafkaHeaders.RECEIVED_KEY) String key) {
        com.fasterxml.jackson.databind.JsonNode root;
        try {
            root = objectMapper.readTree(message);
        } catch (JsonProcessingException e) {
            log.error("Unparseable trade event payload, discarding. key={}", key, e);
            return;
        }
        try {
            if ("ORDER_MATCHED".equals(root.path("eventType").asText())) {
                handleTradeEvent(objectMapper.treeToValue(root, OrderMatchedEvent.class));
            }
        } catch (JsonProcessingException e) {
            log.error("Trade event mapping failed, discarding. key={}", key, e);
        }
        // Other runtime exceptions propagate → DefaultErrorHandler retries → DLT
    }

    private void handleTradeEvent(OrderMatchedEvent event) {
        log.info("Processing trade event for symbol: {}", event.getSymbol());
        MarketData updated = marketDataService.updateMarketData(
                event.getSymbol(), event.getPrice(), event.getQuantity());
        broadcastUpdates(event, updated);
    }

    private void broadcastUpdates(OrderMatchedEvent event, MarketData updated) {
        String symbolPath = event.getSymbol().replace("/", "-");

        // Broadcast individual trade tick
        TradeEventDto trade = new TradeEventDto(
                event.getTradeId(),
                event.getSymbol(),
                event.getPrice(),
                event.getQuantity(),
                event.getTimestamp());
        messagingTemplate.convertAndSend("/topic/trades/" + symbolPath, trade);

        // Broadcast updated 24h stats
        messagingTemplate.convertAndSend("/topic/market-data/" + symbolPath,
                MarketDataResponse.from(updated));

        log.debug("Broadcasted trade and market-data update for {}", event.getSymbol());
    }
}
