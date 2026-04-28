package org.serhiileniv.order.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.service.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/v1/admin/orders")
@RequiredArgsConstructor
@Slf4j
public class AdminOrderController {

    private final OrderService orderService;

    @GetMapping
    public ResponseEntity<List<OrderResponse>> getAllOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String side,
            @RequestParam(required = false) String userId,
            @RequestHeader("X-User-Role") String role) {
        log.info("Admin: listing all orders, status={}, symbol={}, side={}, userId={}", status, symbol, side, userId);
        List<OrderResponse> orders = orderService.findAllOrders();
        Stream<OrderResponse> stream = orders.stream();
        if (status != null && !status.isBlank()) {
            OrderStatus statusEnum = OrderStatus.valueOf(status.toUpperCase());
            stream = stream.filter(o -> statusEnum.name().equals(o.status().name()));
        }
        if (symbol != null && !symbol.isBlank()) {
            stream = stream.filter(o -> symbol.equalsIgnoreCase(o.symbol()));
        }
        if (side != null && !side.isBlank()) {
            OrderSide sideEnum = OrderSide.valueOf(side.toUpperCase());
            stream = stream.filter(o -> sideEnum.name().equals(o.side().name()));
        }
        if (userId != null && !userId.isBlank()) {
            UUID userUuid = UUID.fromString(userId);
            stream = stream.filter(o -> userUuid.equals(o.userId()));
        }
        return ResponseEntity.ok(stream.toList());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelOrder(
            @PathVariable UUID id,
            @RequestHeader("X-User-Role") String role) {
        log.info("Admin: cancelling order {}", id);
        orderService.adminCancelOrder(id);
        return ResponseEntity.noContent().build();
    }
}
