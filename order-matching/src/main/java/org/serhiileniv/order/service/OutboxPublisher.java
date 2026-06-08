package org.serhiileniv.order.service;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.model.OutboxEvent;
import org.serhiileniv.order.repository.OutboxEventRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Polls {@code outbox_events} and ships pending rows to Kafka, at least once.
 *
 * The poll cadence is short ({@value #POLL_INTERVAL_MS} ms) so under healthy conditions the
 * lag between a business commit and the Kafka publish is well under a second. When Kafka is
 * unhealthy, attempts increment and rows accumulate — the {@code orderbook.outbox.backlog}
 * gauge alerts on this.
 *
 * Failures are logged but not propagated; a future scheduler tick will retry the same row
 * until the broker accepts it or an operator drains the table manually.
 *
 * See ADR-0009.
 */

@Component
@Slf4j
public class OutboxPublisher {

    private static final long POLL_INTERVAL_MS = 500;
    private static final int  BATCH_SIZE       = 100;
    private static final String TOPIC          = "order-events";

    private final OutboxEventRepository repo;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final MeterRegistry registry;

    private final AtomicLong backlogGauge = new AtomicLong(0);

    public OutboxPublisher(OutboxEventRepository repo,
                           @Qualifier("outboxKafkaTemplate") KafkaTemplate<String, String> kafkaTemplate,
                           MeterRegistry registry) {
        this.repo          = repo;
        this.kafkaTemplate = kafkaTemplate;
        this.registry      = registry;
        registry.gauge("orderbook.outbox.backlog", backlogGauge, AtomicLong::doubleValue);
    }

    @Scheduled(fixedDelay = POLL_INTERVAL_MS, initialDelay = 5_000)
    @Transactional
    public void publishBatch() {
        List<OutboxEvent> batch = repo.findUnpublished(PageRequest.of(0, BATCH_SIZE));
        backlogGauge.set(repo.countByPublishedAtIsNull());
        if (batch.isEmpty()) return;

        log.debug("Publishing outbox batch of {} events", batch.size());
        for (OutboxEvent row : batch) {
            try {
                kafkaTemplate
                        .send(TOPIC, row.getAggregateId().toString(), row.getPayload())
                        .get(5, TimeUnit.SECONDS);  // sync per row keeps ordering + lets us mark on success
                row.setPublishedAt(Instant.now());
                row.setLastError(null);
                registry.counter("orderbook.outbox.published", Tags.of("outcome", "success")).increment();
            } catch (Exception e) {
                row.setAttempts(row.getAttempts() + 1);
                row.setLastError(truncate(e.getMessage(), 1000));
                registry.counter("orderbook.outbox.published", Tags.of("outcome", "failure")).increment();
                log.warn("Outbox publish failed for {} {} (attempt {}): {}",
                        row.getEventType(), row.getId(), row.getAttempts(), e.getMessage());
            }
        }
        // One save() flushes the entire batch (managed entities are dirty-checked at commit).
        // No explicit saveAll() needed — the entities are already in the persistence context.
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
