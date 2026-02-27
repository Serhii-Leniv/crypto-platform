package org.serhiileniv.marketdata.repository;

import jakarta.persistence.LockModeType;
import org.serhiileniv.marketdata.model.MarketData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MarketDataRepository extends JpaRepository<MarketData, UUID> {
    Optional<MarketData> findBySymbol(String symbol);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM MarketData m WHERE m.symbol = :symbol")
    Optional<MarketData> findBySymbolWithLock(@Param("symbol") String symbol);
}
