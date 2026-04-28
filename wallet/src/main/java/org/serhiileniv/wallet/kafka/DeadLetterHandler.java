package org.serhiileniv.wallet.kafka;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class DeadLetterHandler {

    @KafkaListener(topics = "order-events.DLT", groupId = "wallet-group-dlt")
    public void handleDeadLetter(ConsumerRecord<String, String> record) {
        log.error("Dead-letter event received — manual intervention required. " +
                  "topic={} partition={} offset={} key={} payload={}",
                record.topic(), record.partition(), record.offset(),
                record.key(), record.value());
    }
}
