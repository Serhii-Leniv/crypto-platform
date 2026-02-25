package org.serhiileniv.order.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.exception.OrderNotFoundException;
import org.serhiileniv.order.kafka.OrderEventProducer;
import org.serhiileniv.order.kafka.event.OrderCancelledEvent;
import org.serhiileniv.order.kafka.event.OrderPlacedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {
        private final OrderRepository orderRepository;
        private final OrderMatchingEngine matchingEngine;
        private final OrderEventProducer eventProducer;

        @Transactional
        public OrderResponse placeOrder(OrderRequest request, UUID userId) {
                log.info("Placing order for user {}: {} {} {} @ {}",
                                userId, request.side(), request.quantity(), request.symbol(), request.price());
                Order order = Order.builder()
                                .userId(userId)
                                .symbol(request.symbol())
                                .orderType(request.orderType())
                                .side(request.side())
                                .price(request.price())
                                .quantity(request.quantity())
                                .build();
                order = orderRepository.save(order);
                OrderPlacedEvent placedEvent = new OrderPlacedEvent(
                                order.getId(),
                                order.getUserId(),
                                order.getSymbol(),
                                order.getOrderType(),
                                order.getSide(),
                                order.getPrice(),
                                order.getQuantity(),
                                LocalDateTime.now());
                eventProducer.sendOrderPlacedEvent(placedEvent);
                matchingEngine.matchOrder(order);
                UUID savedOrderId = order.getId();
                order = orderRepository.findById(savedOrderId)
                                .orElseThrow(() -> new OrderNotFoundException(savedOrderId));
                log.info("Order placed successfully: {} with status: {}", order.getId(), order.getStatus());
                return OrderResponse.fromEntity(order);
        }

        @Transactional
        public void cancelOrder(UUID orderId, UUID userId) {
                Order order = orderRepository.findByIdAndUserId(orderId, userId)
                                .orElseThrow(() -> new OrderNotFoundException(orderId));
                if (order.getStatus() == OrderStatus.FILLED) {
                        throw new IllegalStateException("Cannot cancel a filled order");
                }
                if (order.getStatus() == OrderStatus.CANCELLED) {
                        throw new IllegalStateException("Order is already cancelled");
                }
                order.setStatus(OrderStatus.CANCELLED);
                orderRepository.save(order);
                OrderCancelledEvent cancelledEvent = new OrderCancelledEvent(
                                order.getId(),
                                order.getUserId(),
                                order.getSymbol(),
                                order.getSide(),
                                order.getRemainingQuantity(),
                                order.getPrice(),
                                "Cancelled by user",
                                LocalDateTime.now());
                eventProducer.sendOrderCancelledEvent(cancelledEvent);
                log.info("Order cancelled: {}", orderId);
        }

        public OrderResponse getOrderById(UUID orderId, UUID userId) {
                Order order = orderRepository.findByIdAndUserId(orderId, userId)
                                .orElseThrow(() -> new OrderNotFoundException(orderId));
                return OrderResponse.fromEntity(order);
        }

        public List<OrderResponse> getUserOrders(UUID userId) {
                List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
                return orders.stream()
                                .map(OrderResponse::fromEntity)
                                .collect(Collectors.toList());
        }

        public OrderMatchingEngine.OrderBook getOrderBook(String symbol) {
                return matchingEngine.getOrderBook(symbol);
        }
}
