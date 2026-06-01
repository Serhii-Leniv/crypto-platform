package org.serhiileniv.marketdata.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.marketdata.dto.MarketDataResponse;
import org.serhiileniv.marketdata.model.MarketData;
import org.serhiileniv.marketdata.service.MarketDataService;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/market-data")
@RequiredArgsConstructor
@Slf4j
@Validated
@Tag(name = "Market Data", description = "Public 24 h rolling statistics — no authentication required. Responses are cached in Redis (10 min TTL, evicted on each trade).")
public class MarketDataController {
    private final MarketDataService marketDataService;

    @GetMapping("/{symbol:.+}")
    @Operation(summary = "Get symbol stats", description = "Returns 24 h rolling statistics for a single trading pair. Cached in Redis — evicted automatically on each matched trade.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Market data found", content = @Content(schema = @Schema(implementation = MarketDataResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid symbol format", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "No trades recorded for this symbol yet", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<MarketDataResponse> getMarketData(
            @PathVariable
            @Pattern(regexp = "^[A-Z]{3,6}[/\\-][A-Z]{3,6}$", message = "Symbol must be in format XXX/XXX or XXX-XXX")
            String symbol) {
        log.info("Fetching market data for symbol: {}", symbol);
        MarketData marketData = marketDataService.getMarketData(symbol);
        log.debug("Market data found for {}: lastPrice={}", symbol, marketData.getLastPrice());
        return ResponseEntity.ok(MarketDataResponse.from(marketData));
    }

    @GetMapping
    @Operation(summary = "List all symbol stats", description = "Returns 24 h statistics for every symbol that has at least one completed trade. Cached in Redis.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Market data list")
    })
    public ResponseEntity<List<MarketDataResponse>> getAllMarketData() {
        log.info("Fetching all market data");
        List<MarketData> marketDataList = marketDataService.getAllMarketData();
        List<MarketDataResponse> response = marketDataList.stream()
                .map(MarketDataResponse::from)
                .toList();
        log.debug("Returning market data for {} symbols", response.size());
        return ResponseEntity.ok(response);
    }
}
