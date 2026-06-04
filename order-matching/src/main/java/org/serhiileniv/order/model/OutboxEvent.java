package org.serhiileniv.order.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Transactional outbox row. Written inside the same DB transaction as the order mutation
 * that produced the event; the {@code OutboxPublisher} picks it up asynchronously.
 * See ADR-0009.
 */
@Entity
@Table(name = "outbox_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent implements Persistable<UUID> {

    @Id
    private UUID id;

    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override public UUID getId()    { return id; }
    @Override public boolean isNew() { return isNew; }
    @PostPersist @PostLoad void markPersisted() { this.isNew = false; }

    /** {@code ORDER_PLACED}, {@code ORDER_MATCHED}, {@code ORDER_CANCELLED}. */
    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    /** Order id or trade id — used as the Kafka message key for partition affinity. */
    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    /** Serialized JSON of the domain event. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Set the instant the broker confirms acceptance. Null until then. */
    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;
}
