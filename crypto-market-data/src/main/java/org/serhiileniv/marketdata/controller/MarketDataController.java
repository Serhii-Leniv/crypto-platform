package org.serhiileniv.marketdata.controller;
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
public class MarketDataController {
    private final MarketDataService marketDataService;
    @GetMapping("/{symbol}")
    public ResponseEntity<MarketDataResponse> getMarketData(@PathVariable String symbol) {
        MarketData marketData = marketDataService.getMarketData(symbol);
        return ResponseEntity.ok(MarketDataResponse.from(marketData));
    }
    @GetMapping
    public ResponseEntity<List<MarketDataResponse>> getAllMarketData() {
        List<MarketData> marketDataList = marketDataService.getAllMarketData();
        List<MarketDataResponse> response = marketDataList.stream()
                .map(MarketDataResponse::from)
                .toList();
        return ResponseEntity.ok(response);
    }
}
