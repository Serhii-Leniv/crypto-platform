package org.serhiileniv.marketdata.service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.repository.MarketDataRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketDataService {
    private final MarketDataRepository marketDataRepository;
    @Cacheable(value = "marketData", key = "#symbol")
    public MarketData getMarketData(String symbol) {
        log.info("Fetching market data for symbol: {} from database", symbol);
        return marketDataRepository.findBySymbol(symbol)
                .orElseThrow(() -> new RuntimeException("Market data not found for symbol: " + symbol));
    }
    @Cacheable(value = "allMarketData")
    public List<MarketData> getAllMarketData() {
        log.info("Fetching all market data from database");
        return marketDataRepository.findAll();
    }
    @Transactional
    @CacheEvict(value = { "marketData", "allMarketData" }, allEntries = true)
    public void updateMarketData(String symbol, BigDecimal price, BigDecimal quantity) {
        log.info("Updating market data for {}: price={}, quantity={}", symbol, price, quantity);
        MarketData marketData = marketDataRepository.findBySymbol(symbol)
                .orElseGet(() -> {
                    MarketData newData = MarketData.builder()
                            .symbol(symbol)
                            .lastPrice(price)
                            .high24h(price)
                            .low24h(price)
                            .volume24h(BigDecimal.ZERO)
                            .tradeCount24h(0L)
                            .build();
                    return marketDataRepository.save(newData);
                });
        marketData.updateFromTrade(price, quantity);
        marketDataRepository.save(marketData);
        log.info("Market data updated for {}: {}", symbol, marketData.getLastPrice());
    }
}
