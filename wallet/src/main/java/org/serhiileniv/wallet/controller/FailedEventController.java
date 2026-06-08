package org.serhiileniv.wallet.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.model.FailedEvent;
import org.serhiileniv.wallet.repository.FailedEventRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wallets/admin/failed-events")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Dead-Letter Queue", description = "View and replay Kafka events that failed after all retries")
@SecurityRequirement(name = "bearerAuth")
public class FailedEventController {

    private final FailedEventRepository failedEventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @GetMapping
    @Operation(summary = "List unresolved failed events", description = "Returns all events that landed in the DLT and have not yet been replayed.")
    public ResponseEntity<List<FailedEvent>> listPending() {
        return ResponseEntity.ok(failedEventRepository.findByReplayedFalseOrderByFailedAtDesc());
    }

    @PostMapping("/{id}/replay")
    @Operation(summary = "Replay a failed event", description = "Resends the original payload back to the source topic so the consumer retries it.")
    public ResponseEntity<Void> replay(@PathVariable UUID id) {
        FailedEvent event = failedEventRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Failed event not found: " + id));

        log.info("Replaying failed event id={} topic={} key={}", id, event.getTopic(), event.getKey());
        kafkaTemplate.send(event.getTopic(), event.getKey(), event.getPayload());

        event.setReplayed(true);
        event.setReplayedAt(Instant.now());
        failedEventRepository.save(event);

        log.info("Failed event id={} successfully replayed to topic={}", id, event.getTopic());
        return ResponseEntity.accepted().build();
    }
}
