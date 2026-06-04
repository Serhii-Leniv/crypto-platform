package org.serhiileniv.order.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.kafka.event.OrderCancelledEvent;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.kafka.event.OrderPlacedEvent;
import org.serhiileniv.order.model.OutboxEvent;
import org.serhiileniv.order.repository.OutboxEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Records domain events into the {@code outbox_events} table.
 *
 * Callers invoke {@link #record(String, UUID, Object)} inside their own business
 * transaction; the insert participates in that transaction so the outbox row commits
 * exactly when the order/trade does. The {@code OutboxPublisher} then ships these
 * rows to Kafka asynchronously and at least once. See ADR-0009.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxService {

    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String eventType, UUID aggregateId, Object payload) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialise outbox payload for " + eventType, e);
        }
        OutboxEvent row = OutboxEvent.builder()
                .id(UUID.randomUUID())
                .eventType(eventType)
                .aggregateId(aggregateId)
                .payload(json)
                .build();
        outboxRepository.save(row);
        log.debug("Outbox row written: {} for {}", eventType, aggregateId);
    }

    public void recordOrderPlaced(OrderPlacedEvent event) {
        record("ORDER_PLACED", event.getOrderId(), event);
    }

    public void recordOrderMatched(OrderMatchedEvent event) {
        record("ORDER_MATCHED", event.getTradeId(), event);
    }

    public void recordOrderCancelled(OrderCancelledEvent event) {
        record("ORDER_CANCELLED", event.getOrderId(), event);
    }
}
