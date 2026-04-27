package org.serhiileniv.order.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.service.OrderMatchingEngine;
import org.serhiileniv.order.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Slf4j
@Validated
@Tag(name = "Orders", description = "Endpoints for managing trade orders")
public class OrderController {
    private final OrderService orderService;

    @PostMapping
    @Operation(summary = "Place order", description = "Creates a new BUY or SELL order")
    public ResponseEntity<OrderResponse> placeOrder(
            @Valid @RequestBody OrderRequest request,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Placing {} {} order for user {}: symbol={}, qty={}, price={}",
                request.side(), request.orderType(), userId, request.symbol(), request.quantity(), request.price());
        OrderResponse response = orderService.placeOrder(request, UUID.fromString(userId));
        log.info("Order placed: id={}, status={}, user={}", response.id(), response.status(), userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{orderId}")
    @Operation(summary = "Get order", description = "Retrieves an order by ID")
    public ResponseEntity<OrderResponse> getOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        log.debug("Fetching order {} for user {}", orderId, userId);
        OrderResponse response = orderService.getOrderById(orderId, UUID.fromString(userId));
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @Operation(summary = "Get user orders", description = "Lists all orders for the authenticated user")
    public ResponseEntity<List<OrderResponse>> getUserOrders(
            @RequestHeader("X-User-Id") String userId) {
        log.debug("Fetching all orders for user {}", userId);
        List<OrderResponse> orders = orderService.getUserOrders(UUID.fromString(userId));
        log.debug("Returning {} orders for user {}", orders.size(), userId);
        return ResponseEntity.ok(orders);
    }

    @DeleteMapping("/{orderId}")
    @Operation(summary = "Cancel order", description = "Cancels a pending order")
    public ResponseEntity<Void> cancelOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Cancelling order {} for user {}", orderId, userId);
        orderService.cancelOrder(orderId, UUID.fromString(userId));
        log.info("Order {} cancelled by user {}", orderId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/book/{symbol:.+}")
    @Operation(summary = "Get order book", description = "Retrieves the current buy and sell orders for a symbol")
    public ResponseEntity<OrderMatchingEngine.OrderBook> getOrderBook(
            @PathVariable
            @Pattern(regexp = "^[A-Z]{3,6}[/-][A-Z]{3,6}$", message = "Symbol must be in format XXX/XXX or XXX-XXX")
            String symbol) {
        log.debug("Fetching order book for symbol {}", symbol);
        return ResponseEntity.ok(orderService.getOrderBook(symbol));
    }
}
