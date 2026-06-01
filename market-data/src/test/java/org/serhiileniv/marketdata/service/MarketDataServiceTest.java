package org.serhiileniv.marketdata.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.marketdata.exception.MarketDataNotFoundException;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.repository.MarketDataRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MarketDataServiceTest {

    @Mock
    private MarketDataRepository marketDataRepository;

    @InjectMocks
    private MarketDataService marketDataService;

    private String symbol;
    private MarketData marketData;

    @BeforeEach
    void setUp() {
        symbol = "BTC/USDT";
        marketData = MarketData.builder()
                .symbol(symbol)
                .lastPrice(new BigDecimal("50000"))
                .high24h(new BigDecimal("51000"))
                .low24h(new BigDecimal("49000"))
                .volume24h(new BigDecimal("100"))
                .build();
        // save() now returns the (mutated) entity — return the same object that was passed in
        lenient().when(marketDataRepository.save(any(MarketData.class))).thenAnswer(i -> i.getArguments()[0]);
    }

    @Test
    void getMarketData_Success() {
        when(marketDataRepository.findBySymbol(symbol)).thenReturn(Optional.of(marketData));

        MarketData result = marketDataService.getMarketData(symbol);

        assertNotNull(result);
        assertEquals(symbol, result.getSymbol());
        verify(marketDataRepository).findBySymbol(symbol);
    }

    @Test
    void getMarketData_NotFound() {
        when(marketDataRepository.findBySymbol(symbol)).thenReturn(Optional.empty());

        assertThrows(MarketDataNotFoundException.class, () -> marketDataService.getMarketData(symbol));
    }

    @Test
    void getAllMarketData_Success() {
        when(marketDataRepository.findAll()).thenReturn(List.of(marketData));

        List<MarketData> result = marketDataService.getAllMarketData();

        assertFalse(result.isEmpty());
        assertEquals(1, result.size());
    }

    @Test
    void updateMarketData_Existing() {
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.updateMarketData(symbol, new BigDecimal("50500"), new BigDecimal("0.5"));

        verify(marketDataRepository).save(marketData);
        assertEquals(new BigDecimal("50500"), marketData.getLastPrice());
    }

    @Test
    void updateMarketData_New() {
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.empty());
        when(marketDataRepository.save(any(MarketData.class))).thenAnswer(i -> i.getArguments()[0]);

        marketDataService.updateMarketData(symbol, new BigDecimal("50500"), new BigDecimal("0.5"));

        verify(marketDataRepository, atLeastOnce()).save(any(MarketData.class));
    }

    @Test
    void updateMarketData_UpdatesHigh24h_WhenPriceIsHigher() {
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.updateMarketData(symbol, new BigDecimal("52000"), new BigDecimal("0.1"));

        assertEquals(new BigDecimal("52000"), marketData.getHigh24h());
        assertEquals(new BigDecimal("52000"), marketData.getLastPrice());
    }

    @Test
    void updateMarketData_DoesNotUpdateHigh_WhenPriceIsLower() {
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.updateMarketData(symbol, new BigDecimal("49500"), new BigDecimal("0.1"));

        assertEquals(new BigDecimal("51000"), marketData.getHigh24h());
    }

    @Test
    void updateMarketData_UpdatesLow24h_WhenPriceIsLower() {
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.updateMarketData(symbol, new BigDecimal("48000"), new BigDecimal("0.2"));

        assertEquals(new BigDecimal("48000"), marketData.getLow24h());
    }

    @Test
    void updateMarketData_IncrementsTradeCount() {
        marketData.setTradeCount24h(5L);
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.updateMarketData(symbol, new BigDecimal("50000"), new BigDecimal("0.5"));

        assertEquals(6L, marketData.getTradeCount24h());
    }

    @Test
    void updateMarketData_AccumulatesVolume() {
        when(marketDataRepository.findBySymbolWithLock(symbol)).thenReturn(Optional.of(marketData));

        marketDataService.updateMarketData(symbol, new BigDecimal("50000"), new BigDecimal("2.0"));

        assertEquals(0, new BigDecimal("102.0").compareTo(marketData.getVolume24h()));
    }

    @Test
    void getAllMarketData_EmptyRepository_ReturnsEmptyList() {
        when(marketDataRepository.findAll()).thenReturn(List.of());

        List<MarketData> result = marketDataService.getAllMarketData();

        assertTrue(result.isEmpty());
    }

    @Test
    void resetDailyStats_SavesAllWithResetValues() {
        when(marketDataRepository.findAll()).thenReturn(List.of(marketData));

        marketDataService.resetDailyStats();

        assertEquals(BigDecimal.ZERO, marketData.getVolume24h());
        assertEquals(0L, marketData.getTradeCount24h());
        verify(marketDataRepository).saveAll(List.of(marketData));
    }
}
