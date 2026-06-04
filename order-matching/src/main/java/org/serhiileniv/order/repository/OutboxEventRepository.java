package org.serhiileniv.order.repository;

import org.serhiileniv.order.model.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /** Oldest-first batch of events still pending Kafka delivery. */
    @Query("SELECT e FROM OutboxEvent e WHERE e.publishedAt IS NULL ORDER BY e.createdAt ASC")
    List<OutboxEvent> findUnpublished(Pageable pageable);

    /** Count of pending events — exposed as a Prometheus gauge for backlog alerting. */
    long countByPublishedAtIsNull();
}
