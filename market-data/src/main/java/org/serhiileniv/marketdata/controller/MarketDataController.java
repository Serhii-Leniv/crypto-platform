package org.serhiileniv.marketdata.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.marketdata.dto.MarketDataResponse;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.service.MarketDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/market-data")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Market Data", description = "Endpoints for retrieving real-time market data")
public class MarketDataController {
    private final MarketDataService marketDataService;

    @GetMapping("/{symbol:.+}")
    @Operation(summary = "Get market data", description = "Retrieves market data for a specific symbol")
    public ResponseEntity<MarketDataResponse> getMarketData(@PathVariable String symbol) {
        MarketData marketData = marketDataService.getMarketData(symbol);
        return ResponseEntity.ok(MarketDataResponse.from(marketData));
    }

    @GetMapping
    @Operation(summary = "Get all market data", description = "Lists market data for all available symbols")
    public ResponseEntity<List<MarketDataResponse>> getAllMarketData() {
        List<MarketData> marketDataList = marketDataService.getAllMarketData();
        List<MarketDataResponse> response = marketDataList.stream()
                .map(MarketDataResponse::from)
                .toList();
        return ResponseEntity.ok(response);
    }
}
