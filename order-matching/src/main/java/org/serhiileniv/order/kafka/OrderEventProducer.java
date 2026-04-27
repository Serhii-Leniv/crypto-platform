package org.serhiileniv.order.kafka;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.kafka.event.OrderCancelledEvent;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.kafka.event.OrderPlacedEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderEventProducer {
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private static final String ORDER_EVENTS_TOPIC = "order-events";
    public void sendOrderPlacedEvent(OrderPlacedEvent event) {
        log.info("Sending OrderPlacedEvent for order: {}", event.getOrderId());
        kafkaTemplate.send(ORDER_EVENTS_TOPIC, event.getOrderId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to send OrderPlacedEvent: {}", event, ex);
                    } else {
                        log.info("OrderPlacedEvent sent successfully: {}", event.getOrderId());
                    }
                });
    }
    public void sendOrderMatchedEvent(OrderMatchedEvent event) {
        log.info("Sending OrderMatchedEvent for trade: {}", event.getTradeId());
        kafkaTemplate.send(ORDER_EVENTS_TOPIC, event.getTradeId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to send OrderMatchedEvent: {}", event, ex);
                    } else {
                        log.info("OrderMatchedEvent sent successfully: {}", event.getTradeId());
                    }
                });
    }
    public void sendOrderCancelledEvent(OrderCancelledEvent event) {
        log.info("Sending OrderCancelledEvent for order: {}", event.getOrderId());
        kafkaTemplate.send(ORDER_EVENTS_TOPIC, event.getOrderId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to send OrderCancelledEvent: {}", event, ex);
                    } else {
                        log.info("OrderCancelledEvent sent successfully: {}", event.getOrderId());
                    }
                });
    }
}
