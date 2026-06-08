package org.serhiileniv.marketdata.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.marketdata.exception.MarketDataNotFoundException;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.model.Trade;
import org.serhiileniv.marketdata.repository.MarketDataRepository;
import org.serhiileniv.marketdata.repository.TradeRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class MarketDataService {

    private final MarketDataRepository marketDataRepository;
    private final TradeRepository tradeRepository;

    @Cacheable(value = "marketData", key = "#symbol")
    public MarketData getMarketData(String symbol) {
        log.info("Fetching market data for symbol: {} from database", symbol);
        return marketDataRepository.findBySymbol(symbol)
                .orElseThrow(() -> new MarketDataNotFoundException(symbol));
    }

    @Cacheable(value = "allMarketData")
    public List<MarketData> getAllMarketData() {
        log.info("Fetching all market data from database");
        return marketDataRepository.findAll();
    }

    /**
     * Records a trade and recomputes 24h aggregates for the symbol.
     * Truth source is the {@code trades} table — {@code market_data} is the cached snapshot.
     */
    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "marketData",    key = "#symbol"),
            @CacheEvict(value = "allMarketData", allEntries = true)
    })
    public MarketData updateMarketData(String symbol, BigDecimal price, BigDecimal quantity) {
        log.info("Recording trade for {}: price={}, quantity={}", symbol, price, quantity);
        tradeRepository.save(Trade.builder()
                .symbol(symbol)
                .price(price)
                .quantity(quantity)
                .tradedAt(Instant.now())
                .build());
        return recomputeMetrics(symbol);
    }

    /**
     * Recomputes 24h aggregates for one symbol from the trades table and persists
     * the snapshot to {@code market_data}. Safe to call frequently — bounded by
     * the size of the 24h window.
     */
    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "marketData",    key = "#symbol"),
            @CacheEvict(value = "allMarketData", allEntries = true)
    })
    public MarketData recomputeMetrics(String symbol) {
        Instant windowStart = Instant.now().minus(24, ChronoUnit.HOURS);
        TradeRepository.Aggregates agg = tradeRepository.aggregateSince(symbol, windowStart);

        MarketData md = marketDataRepository.findBySymbolWithLock(symbol)
                .orElseGet(() -> MarketData.builder()
                        .symbol(symbol)
                        .lastPrice(BigDecimal.ZERO)
                        .openPrice24h(BigDecimal.ZERO)
                        .high24h(BigDecimal.ZERO)
                        .low24h(BigDecimal.ZERO)
                        .volume24h(BigDecimal.ZERO)
                        .tradeCount24h(0L)
                        .build());

        BigDecimal lastPrice = agg != null && agg.getLastPrice() != null ? agg.getLastPrice() : md.getLastPrice();
        md.setLastPrice(lastPrice);

        if (agg != null && agg.getTradeCount() != null && agg.getTradeCount() > 0) {
            BigDecimal open  = agg.getOpenPrice();
            BigDecimal high  = agg.getHigh();
            BigDecimal low   = agg.getLow();
            BigDecimal vol   = agg.getVolume();
            md.setOpenPrice24h(open);
            md.setHigh24h(high);
            md.setLow24h(low);
            md.setVolume24h(vol);
            md.setTradeCount24h(agg.getTradeCount());
            if (open != null && open.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal change = lastPrice.subtract(open);
                md.setPriceChange24h(change);
                md.setPriceChangePercent24h(
                        change.divide(open, 6, RoundingMode.HALF_UP)
                              .multiply(new BigDecimal("100"))
                              .setScale(2, RoundingMode.HALF_UP));
            }
        } else {
            // No trades in the window — zero out the 24h stats but keep last_price as the most recent
            // historical price (or current md value if even older history is empty).
            md.setOpenPrice24h(lastPrice);
            md.setHigh24h(lastPrice);
            md.setLow24h(lastPrice);
            md.setVolume24h(BigDecimal.ZERO);
            md.setTradeCount24h(0L);
            md.setPriceChange24h(BigDecimal.ZERO);
            md.setPriceChangePercent24h(BigDecimal.ZERO);
        }

        return marketDataRepository.save(md);
    }

    /**
     * Every minute: re-aggregate every symbol so trades that fall outside the 24h window
     * (or trade-less symbols whose last_price stayed the same) reflect reality. Cheap —
     * single SQL per symbol, ~10 symbols.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "marketData",    allEntries = true),
            @CacheEvict(value = "allMarketData", allEntries = true)
    })
    public void refreshAllMetrics() {
        Set<String> symbols = new HashSet<>(tradeRepository.findDistinctSymbols());
        symbols.addAll(marketDataRepository.findAll().stream().map(MarketData::getSymbol).toList());
        log.debug("Refreshing 24h metrics for {} symbols", symbols.size());
        for (String s : symbols) {
            try {
                recomputeMetrics(s);
            } catch (Exception e) {
                log.warn("Failed to refresh metrics for {}: {}", s, e.getMessage());
            }
        }
    }
}
