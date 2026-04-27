package org.serhiileniv.order.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Orders", description = "Endpoints for managing trade orders")
public class OrderController {
    private final OrderService orderService;

    @PostMapping
    @Operation(summary = "Place order", description = "Creates a new BUY or SELL order")
    public ResponseEntity<OrderResponse> placeOrder(
            @Valid @RequestBody OrderRequest request,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Placing order for user: {}", userId);
        OrderResponse response = orderService.placeOrder(request, UUID.fromString(userId));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{orderId}")
    @Operation(summary = "Get order", description = "Retrieves an order by ID")
    public ResponseEntity<OrderResponse> getOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        OrderResponse response = orderService.getOrderById(orderId, UUID.fromString(userId));
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @Operation(summary = "Get user orders", description = "Lists all orders for the authenticated user")
    public ResponseEntity<List<OrderResponse>> getUserOrders(
            @RequestHeader("X-User-Id") String userId) {
        List<OrderResponse> orders = orderService.getUserOrders(UUID.fromString(userId));
        return ResponseEntity.ok(orders);
    }

    @DeleteMapping("/{orderId}")
    @Operation(summary = "Cancel order", description = "Cancels a pending order")
    public ResponseEntity<Void> cancelOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Cancelling order {} for user: {}", orderId, userId);
        orderService.cancelOrder(orderId, UUID.fromString(userId));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/book/{symbol:.+}")
    @Operation(summary = "Get order book", description = "Retrieves the current buy and sell orders for a symbol")
    public ResponseEntity<org.serhiileniv.order.service.OrderMatchingEngine.OrderBook> getOrderBook(
            @PathVariable String symbol) {
        return ResponseEntity.ok(orderService.getOrderBook(symbol));
    }
}
