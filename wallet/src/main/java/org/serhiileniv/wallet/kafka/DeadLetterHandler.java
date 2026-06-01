package org.serhiileniv.wallet.kafka;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.serhiileniv.wallet.model.FailedEvent;
import org.serhiileniv.wallet.repository.FailedEventRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeadLetterHandler {

    private final FailedEventRepository failedEventRepository;
    private final MeterRegistry meterRegistry;

    private Counter deadLetterCounter;

    @PostConstruct
    void init() {
        deadLetterCounter = Counter.builder("kafka.dead_letter.total")
                .description("Total number of events routed to the dead-letter topic")
                .tag("topic", "order-events")
                .register(meterRegistry);
    }

    @KafkaListener(topics = "order-events.DLT", groupId = "wallet-group-dlt")
    public void handleDeadLetter(ConsumerRecord<String, String> record) {
        String originalError = extractOriginalError(record);
        String originalClass = extractOriginalClass(record);

        log.error("Dead-letter event received — persisted for manual review. " +
                  "topic={} partition={} offset={} key={} error={}",
                record.topic(), record.partition(), record.offset(),
                record.key(), originalError);

        FailedEvent failed = FailedEvent.builder()
                .topic("order-events")
                .partition(record.partition())
                .offset(record.offset())
                .key(record.key())
                .payload(record.value())
                .errorMessage(originalError)
                .errorClass(originalClass)
                .build();

        failedEventRepository.save(failed);
        deadLetterCounter.increment();
    }

    private String extractOriginalError(ConsumerRecord<String, String> record) {
        return record.headers().lastHeader("kafka_dlt-exception-message") != null
                ? new String(record.headers().lastHeader("kafka_dlt-exception-message").value())
                : "unknown";
    }

    private String extractOriginalClass(ConsumerRecord<String, String> record) {
        return record.headers().lastHeader("kafka_dlt-exception-fqcn") != null
                ? new String(record.headers().lastHeader("kafka_dlt-exception-fqcn").value())
                : "unknown";
    }
}
