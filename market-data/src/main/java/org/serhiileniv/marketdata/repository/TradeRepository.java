package org.serhiileniv.marketdata.repository;

import org.serhiileniv.marketdata.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface TradeRepository extends JpaRepository<Trade, UUID> {

    /**
     * Aggregated 24h stats for a symbol. Returns null if no trades in the window.
     * Columns: symbol, high, low, volume, count, openPrice (oldest in window), lastPrice (newest in window).
     */
    @Query(value = """
        SELECT
            MAX(t.price)      AS high,
            MIN(t.price)      AS low,
            SUM(t.quantity)   AS volume,
            COUNT(t.id)       AS trade_count,
            (SELECT price FROM trades WHERE symbol = :symbol AND traded_at >= :since ORDER BY traded_at ASC  LIMIT 1) AS open_price,
            (SELECT price FROM trades WHERE symbol = :symbol                              ORDER BY traded_at DESC LIMIT 1) AS last_price
        FROM trades t
        WHERE t.symbol = :symbol AND t.traded_at >= :since
        """, nativeQuery = true)
    Aggregates aggregateSince(@Param("symbol") String symbol, @Param("since") Instant since);

    List<Trade> findTop10BySymbolOrderByTradedAtDesc(String symbol);

    /** Distinct symbols that have at least one trade — used by the scheduled refresh job. */
    @Query("SELECT DISTINCT t.symbol FROM Trade t")
    List<String> findDistinctSymbols();

    /** Projection for {@link #aggregateSince}. */
    interface Aggregates {
        BigDecimal getHigh();
        BigDecimal getLow();
        BigDecimal getVolume();
        Long       getTradeCount();
        BigDecimal getOpenPrice();
        BigDecimal getLastPrice();
    }
}
