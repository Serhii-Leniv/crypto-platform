package org.serhiileniv.wallet.repository;

import org.serhiileniv.wallet.model.FailedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FailedEventRepository extends JpaRepository<FailedEvent, UUID> {
    List<FailedEvent> findByReplayedFalseOrderByFailedAtDesc();
    List<FailedEvent> findByTopicOrderByFailedAtDesc(String topic);
}
