package org.serhiileniv.marketdata.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.marketdata.exception.MarketDataNotFoundException;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.model.Trade;
import org.serhiileniv.marketdata.repository.MarketDataRepository;
import org.serhiileniv.marketdata.repository.TradeRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MarketDataServiceTest {

    @Mock
    private MarketDataRepository marketDataRepository;
    @Mock
    private TradeRepository tradeRepository;

    @InjectMocks
    private MarketDataService marketDataService;

    private String symbol;
    private MarketData marketData;

    @BeforeEach
    void setUp() {
        symbol = "BTC-USDT";
        marketData = MarketData.builder()
                .symbol(symbol)
                .lastPrice(new BigDecimal("50000"))
                .openPrice24h(new BigDecimal("50000"))
                .high24h(new BigDecimal("50000"))
                .low24h(new BigDecimal("50000"))
                .volume24h(BigDecimal.ZERO)
                .tradeCount24h(0L)
                .build();
        lenient().when(marketDataRepository.save(any(MarketData.class))).thenAnswer(i -> i.getArguments()[0]);
    }

    @Test
    void getMarketData_Success() {
        when(marketDataRepository.findBySymbol(symbol)).thenReturn(Optional.of(marketData));
        assertNotNull(marketDataService.getMarketData(symbol));
    }

    @Test
    void getMarketData_NotFound() {
        when(marketDataRepository.findBySymbol(symbol)).thenReturn(Optional.empty());
        assertThrows(MarketDataNotFoundException.class, () -> marketDataService.getMarketData(symbol));
    }

    @Test
    void getAllMarketData_ReturnsRepoContents() {
        when(marketDataRepository.findAll()).thenReturn(List.of(marketData));
        assertEquals(1, marketDataService.getAllMarketData().size());
    }

    @Test
    void updateMarketData_PersistsTradeAndRecomputesFromAggregates() {
        Aggs agg = new Aggs(new BigDecimal("52000"), new BigDecimal("49000"),
                new BigDecimal("3.5"), 7L, new BigDecimal("50000"), new BigDecimal("51000"));
        when(tradeRepository.aggregateSince(eqSymbol(), any(LocalDateTime.class))).thenReturn(agg);
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.updateMarketData(symbol, new BigDecimal("51000"), new BigDecimal("0.5"));

        verify(tradeRepository).save(any(Trade.class));
        assertEquals(new BigDecimal("51000"), marketData.getLastPrice());
        assertEquals(new BigDecimal("52000"), marketData.getHigh24h());
        assertEquals(new BigDecimal("49000"), marketData.getLow24h());
        assertEquals(new BigDecimal("3.5"),   marketData.getVolume24h());
        assertEquals(7L,                       marketData.getTradeCount24h());
    }

    @Test
    void recomputeMetrics_NoTradesInWindow_ZeroesAggregatesKeepsLastPrice() {
        when(tradeRepository.aggregateSince(eqSymbol(), any(LocalDateTime.class)))
                .thenReturn(new Aggs(null, null, null, 0L, null, null));
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.recomputeMetrics(symbol);

        assertEquals(0L, marketData.getTradeCount24h());
        assertEquals(0, BigDecimal.ZERO.compareTo(marketData.getVolume24h()));
        assertEquals(0, BigDecimal.ZERO.compareTo(marketData.getPriceChange24h()));
    }

    private static String eqSymbol() {
        return anyString();
    }

    // Test projection implementing TradeRepository.Aggregates
    private record Aggs(
            BigDecimal high, BigDecimal low, BigDecimal volume, Long tradeCount,
            BigDecimal openPrice, BigDecimal lastPrice
    ) implements TradeRepository.Aggregates {
        @Override public BigDecimal getHigh()       { return high; }
        @Override public BigDecimal getLow()        { return low; }
        @Override public BigDecimal getVolume()     { return volume; }
        @Override public Long       getTradeCount() { return tradeCount; }
        @Override public BigDecimal getOpenPrice()  { return openPrice; }
        @Override public BigDecimal getLastPrice()  { return lastPrice; }
    }
}
