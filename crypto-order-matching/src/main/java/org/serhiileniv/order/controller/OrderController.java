package org.serhiileniv.order.controller;
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
public class OrderController {
    private final OrderService orderService;
    @PostMapping
    public ResponseEntity<OrderResponse> placeOrder(
            @Valid @RequestBody OrderRequest request,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Placing order for user: {}", userId);
        OrderResponse response = orderService.placeOrder(request, UUID.fromString(userId));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    @GetMapping("/{orderId}")
    public ResponseEntity<OrderResponse> getOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        OrderResponse response = orderService.getOrderById(orderId, UUID.fromString(userId));
        return ResponseEntity.ok(response);
    }
    @GetMapping
    public ResponseEntity<List<OrderResponse>> getUserOrders(
            @RequestHeader("X-User-Id") String userId) {
        List<OrderResponse> orders = orderService.getUserOrders(UUID.fromString(userId));
        return ResponseEntity.ok(orders);
    }
    @DeleteMapping("/{orderId}")
    public ResponseEntity<Void> cancelOrder(
            @PathVariable UUID orderId,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Cancelling order {} for user: {}", orderId, userId);
        orderService.cancelOrder(orderId, UUID.fromString(userId));
        return ResponseEntity.noContent().build();
    }
}
