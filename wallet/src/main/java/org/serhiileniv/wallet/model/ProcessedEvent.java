package org.serhiileniv.wallet.model;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name = "processed_events", indexes = {
        @Index(name = "idx_event_id_type", columnList = "event_id, event_type", unique = true)
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessedEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID eventId;
    @Column(nullable = false, length = 50)
    private String eventType;
    @Column(nullable = false, updatable = false)
    private Instant processedAt;

    @PrePersist
    void onCreate() { this.processedAt = Instant.now(); }
    public ProcessedEvent(UUID eventId, String eventType) {
        this.eventId = eventId;
        this.eventType = eventType;
    }
}
