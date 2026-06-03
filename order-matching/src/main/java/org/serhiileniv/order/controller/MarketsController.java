package org.serhiileniv.order.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.serhiileniv.order.dto.MarketResponse;
import org.serhiileniv.order.repository.TradingPairRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/markets")
@RequiredArgsConstructor
@Tag(name = "Markets", description = "Public registry of tradable instruments")
public class MarketsController {

    private final TradingPairRepository tradingPairRepository;

    @GetMapping
    @Operation(summary = "List tradable markets",
            description = "Returns the canonical list of trading pairs available on this exchange. " +
                    "Used by clients to populate symbol selectors and enforce min-quantity / tick-size rules.")
    public List<MarketResponse> listActiveMarkets() {
        return tradingPairRepository.findByStatus("ACTIVE").stream()
                .sorted((a, b) -> a.getSymbol().compareTo(b.getSymbol()))
                .map(MarketResponse::fromEntity)
                .toList();
    }
}
