package org.serhiileniv.marketdata.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.serhiileniv.marketdata.dto.MarketDataResponse;
import org.serhiileniv.marketdata.exception.MarketDataNotFoundException;
import org.serhiileniv.marketdata.service.MarketDataService;
import org.serhiileniv.marketdata.model.MarketData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MarketDataController.class)
@AutoConfigureMockMvc(addFilters = false)
class MarketDataControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private MarketDataService marketDataService;

    private MarketDataResponse sampleResponse(String symbol) {
        return MarketDataResponse.builder()
                .id(UUID.randomUUID())
                .symbol(symbol)
                .lastPrice(new BigDecimal("50000"))
                .high24h(new BigDecimal("51000"))
                .low24h(new BigDecimal("49000"))
                .volume24h(new BigDecimal("100"))
                .priceChange24h(new BigDecimal("500"))
                .priceChangePercent24h(new BigDecimal("1.00"))
                .tradeCount24h(42L)
                .updatedAt(Instant.now())
                .build();
    }

    @Test
    void getMarketData_ValidSymbol_Returns200() throws Exception {
        when(marketDataService.getMarketData("BTC-USDT"))
                .thenReturn(MarketData.builder()
                        .id(UUID.randomUUID())
                        .symbol("BTC-USDT")
                        .lastPrice(new BigDecimal("50000"))
                        .high24h(new BigDecimal("51000"))
                        .low24h(new BigDecimal("49000"))
                        .volume24h(new BigDecimal("100"))
                        .tradeCount24h(10L)
                        .build());

        mockMvc.perform(get("/api/v1/market-data/BTC-USDT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("BTC-USDT"))
                .andExpect(jsonPath("$.lastPrice").value(50000));
    }

    @Test
    void getMarketData_AltSymbol_Returns200() throws Exception {
        when(marketDataService.getMarketData("ETH-USDT"))
                .thenReturn(MarketData.builder()
                        .id(UUID.randomUUID())
                        .symbol("ETH-USDT")
                        .lastPrice(new BigDecimal("3000"))
                        .high24h(new BigDecimal("3100"))
                        .low24h(new BigDecimal("2900"))
                        .volume24h(new BigDecimal("500"))
                        .tradeCount24h(5L)
                        .build());

        mockMvc.perform(get("/api/v1/market-data/ETH-USDT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("ETH-USDT"));
    }

    @Test
    void getMarketData_NotFound_Returns404() throws Exception {
        when(marketDataService.getMarketData("BTC-USDT"))
                .thenThrow(new MarketDataNotFoundException("BTC-USDT"));

        mockMvc.perform(get("/api/v1/market-data/BTC-USDT"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getMarketData_InvalidSymbolFormat_Returns400() throws Exception {
        mockMvc.perform(get("/api/v1/market-data/invalid_symbol"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getAllMarketData_Returns200WithList() throws Exception {
        when(marketDataService.getAllMarketData())
                .thenReturn(List.of(
                        MarketData.builder()
                                .id(UUID.randomUUID()).symbol("BTC/USDT")
                                .lastPrice(new BigDecimal("50000"))
                                .high24h(new BigDecimal("51000"))
                                .low24h(new BigDecimal("49000"))
                                .volume24h(new BigDecimal("100"))
                                .tradeCount24h(10L)
                                .build()
                ));

        mockMvc.perform(get("/api/v1/market-data"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].symbol").value("BTC/USDT"))
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getAllMarketData_EmptyList_Returns200() throws Exception {
        when(marketDataService.getAllMarketData()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/market-data"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }
}
