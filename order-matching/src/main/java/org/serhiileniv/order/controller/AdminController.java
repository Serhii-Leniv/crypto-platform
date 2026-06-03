package org.serhiileniv.order.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.serhiileniv.order.dto.MarketResponse;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.exception.InvalidSymbolException;
import org.serhiileniv.order.model.TradingPair;
import org.serhiileniv.order.repository.OrderRepository;
import org.serhiileniv.order.repository.TradingPairRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * Admin endpoints under /api/v1/admin/**. Gateway gates these with requireAdmin=true.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin")
public class AdminController {

    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "HALTED", "DELISTED");

    private final OrderRepository orderRepository;
    private final TradingPairRepository tradingPairRepository;

    @GetMapping("/orders")
    @Operation(summary = "List all orders across users (admin only)")
    public Page<OrderResponse> listAllOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return orderRepository.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(OrderResponse::fromEntity);
    }

    @GetMapping("/markets")
    @Operation(summary = "List all markets including non-active (admin only)")
    public List<MarketResponse> listAllMarkets() {
        return tradingPairRepository.findAll().stream()
                .sorted((a, b) -> a.getSymbol().compareTo(b.getSymbol()))
                .map(MarketResponse::fromEntity)
                .toList();
    }

    public record StatusUpdate(String status) {}

    @PutMapping("/markets/{symbol}/status")
    @Operation(summary = "Halt or resume a market (admin only)")
    public MarketResponse updateMarketStatus(@PathVariable String symbol, @RequestBody StatusUpdate body) {
        if (body == null || body.status() == null || !ALLOWED_STATUSES.contains(body.status())) {
            throw new InvalidSymbolException("Status must be one of: " + ALLOWED_STATUSES);
        }
        TradingPair pair = tradingPairRepository.findById(symbol)
                .orElseThrow(() -> new InvalidSymbolException("Symbol not listed: " + symbol));
        pair.setStatus(body.status());
        return MarketResponse.fromEntity(tradingPairRepository.save(pair));
    }
}
