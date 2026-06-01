package org.serhiileniv.order.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.service.OrderMatchingEngine;
import org.serhiileniv.order.service.OrderService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
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
@Tag(name = "Orders", description = "Trade order management — place, query, cancel, and view the live order book")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {
    private final OrderService orderService;

    @PostMapping
    @Operation(summary = "Place order", description = "Creates a new BUY or SELL LIMIT/MARKET order. Publishes OrderPlacedEvent to Kafka and runs the matching engine synchronously.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Order created", content = @Content(schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid request body", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "422", description = "LIMIT order submitted without a price", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
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
    @Operation(summary = "Get order", description = "Retrieves a single order by ID. Only the owner can access their orders.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Order found", content = @Content(schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Order belongs to a different user", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "Order not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<OrderResponse> getOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        log.debug("Fetching order {} for user {}", orderId, userId);
        OrderResponse response = orderService.getOrderById(orderId, UUID.fromString(userId));
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @Operation(summary = "List user orders", description = "Returns all orders placed by the authenticated user, newest first.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Orders list"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<Page<OrderResponse>> getUserOrders(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        return ResponseEntity.ok(orderService.getUserOrders(UUID.fromString(userId), pageable));
    }

    @DeleteMapping("/{orderId}")
    @Operation(summary = "Cancel order", description = "Cancels a PENDING or PARTIALLY_FILLED order. Publishes OrderCancelledEvent to unlock the reserved balance.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Order cancelled"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "403", description = "Order belongs to a different user", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "Order not found", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<Void> cancelOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Cancelling order {} for user {}", orderId, userId);
        orderService.cancelOrder(orderId, UUID.fromString(userId));
        log.info("Order {} cancelled by user {}", orderId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/book/{symbol:.+}")
    @Operation(summary = "Get order book", description = "Returns all open buy and sell orders for the given symbol, sorted by price-time priority.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Order book snapshot"),
        @ApiResponse(responseCode = "400", description = "Invalid symbol format", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<OrderMatchingEngine.OrderBook> getOrderBook(
            @PathVariable
            @Pattern(regexp = "^[A-Z]{3,6}[/-][A-Z]{3,6}$", message = "Symbol must be in format XXX/XXX or XXX-XXX")
            String symbol) {
        log.debug("Fetching order book for symbol {}", symbol);
        return ResponseEntity.ok(orderService.getOrderBook(symbol));
    }
}
