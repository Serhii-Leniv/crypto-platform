package org.serhiileniv.marketdata.controller;

import org.junit.jupiter.api.Test;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.service.MarketDataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Collections;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MarketDataController.class)
@AutoConfigureMockMvc(addFilters = false)
class MarketDataControllerSmokeTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MarketDataService marketDataService;

    @Test
    void getAllMarketData_ShouldReturnOk() throws Exception {
        when(marketDataService.getAllMarketData()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/market-data"))
                .andExpect(status().isOk());
    }

    @Test
    void getMarketData_ShouldReturnOk() throws Exception {
        String symbol = "BTC-USDT";
        MarketData marketData = MarketData.builder()
                .symbol(symbol)
                .lastPrice(new BigDecimal("50000"))
                .build();
        when(marketDataService.getMarketData(symbol)).thenReturn(marketData);

        mockMvc.perform(get("/api/v1/market-data/" + symbol))
                .andExpect(status().isOk());
    }
}
