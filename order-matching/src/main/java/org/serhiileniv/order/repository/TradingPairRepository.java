package org.serhiileniv.order.repository;

import org.serhiileniv.order.model.TradingPair;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TradingPairRepository extends JpaRepository<TradingPair, String> {
    List<TradingPair> findByStatus(String status);
}
