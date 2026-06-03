package org.serhiileniv.wallet.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "failed_events", indexes = {
        @Index(name = "idx_failed_topic", columnList = "topic"),
        @Index(name = "idx_failed_replayed", columnList = "replayed")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FailedEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String topic;

    @Column(name = "kafka_partition", nullable = false)
    private Integer partition;

    @Column(name = "kafka_offset", nullable = false)
    private Long offset;

    @Column(length = 255)
    private String key;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(length = 255)
    private String errorClass;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime failedAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean replayed = false;

    @Column
    private LocalDateTime replayedAt;
}
