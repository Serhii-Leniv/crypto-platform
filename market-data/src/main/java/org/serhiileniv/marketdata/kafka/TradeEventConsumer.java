package org.serhiileniv.marketdata.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.marketdata.grpc.MarketDataStreamRegistry;
import org.serhiileniv.marketdata.grpc.MarketDataUpdate;
import org.serhiileniv.marketdata.kafka.event.OrderMatchedEvent;
import org.serhiileniv.marketdata.model.MarketData;
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
    private final MarketDataStreamRegistry streamRegistry;
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
        MarketData updated = marketDataService.updateMarketData(event.getSymbol(), event.getPrice(), event.getQuantity());
        streamRegistry.broadcast(toProto(updated));
    }

    private MarketDataUpdate toProto(MarketData md) {
        return MarketDataUpdate.newBuilder()
                .setSymbol(md.getSymbol())
                .setLastPrice(md.getLastPrice().toPlainString())
                .setVolume24H(md.getVolume24h().toPlainString())
                .setHigh24H(md.getHigh24h().toPlainString())
                .setLow24H(md.getLow24h().toPlainString())
                .setPriceChange24H(md.getPriceChange24h() != null ? md.getPriceChange24h().toPlainString() : "0")
                .setPriceChangePct24H(md.getPriceChangePercent24h() != null ? md.getPriceChangePercent24h().toPlainString() : "0")
                .setTradeCount24H(md.getTradeCount24h() != null ? md.getTradeCount24h() : 0L)
                .setUpdatedAt(md.getUpdatedAt().toString())
                .build();
    }
}
