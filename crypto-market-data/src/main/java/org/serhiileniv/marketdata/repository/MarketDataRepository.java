package org.serhiileniv.marketdata.repository;
import org.serhiileniv.marketdata.model.MarketData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;
@Repository
public interface MarketDataRepository extends JpaRepository<MarketData, UUID> {
    Optional<MarketData> findBySymbol(String symbol);
}
