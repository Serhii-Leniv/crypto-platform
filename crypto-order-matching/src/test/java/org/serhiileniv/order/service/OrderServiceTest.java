package org.serhiileniv.order.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.exception.OrderNotFoundException;
import org.serhiileniv.order.kafka.OrderEventProducer;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.repository.OrderRepository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderMatchingEngine matchingEngine;
    @Mock
    private OrderEventProducer eventProducer;

    @InjectMocks
    private OrderService orderService;

    private UUID userId;
    private UUID orderId;
    private OrderRequest orderRequest;
    private Order order;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        orderId = UUID.randomUUID();
        orderRequest = new OrderRequest("BTC/USDT", OrderType.LIMIT, OrderSide.BUY, new BigDecimal("50000"),
                new BigDecimal("1"));
        order = Order.builder()
                .id(orderId)
                .userId(userId)
                .symbol("BTC/USDT")
                .orderType(OrderType.LIMIT)
                .side(OrderSide.BUY)
                .price(new BigDecimal("50000"))
                .quantity(new BigDecimal("1"))
                .status(OrderStatus.PENDING)
                .build();
    }

    @Test
    void placeOrder_Success() {
        when(orderRepository.save(any(Order.class))).thenReturn(order);
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        OrderResponse response = orderService.placeOrder(orderRequest, userId);

        assertNotNull(response);
        assertEquals(orderId, response.id());
        verify(orderRepository).save(any(Order.class));
        verify(eventProducer).sendOrderPlacedEvent(any());
        verify(matchingEngine).matchOrder(any());
    }

    @Test
    void cancelOrder_Success() {
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));

        orderService.cancelOrder(orderId, userId);

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        verify(orderRepository).save(order);
        verify(eventProducer).sendOrderCancelledEvent(any());
    }

    @Test
    void cancelOrder_NotFound() {
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.empty());

        assertThrows(OrderNotFoundException.class, () -> orderService.cancelOrder(orderId, userId));
    }

    @Test
    void cancelOrder_AlreadyFilled() {
        order.setStatus(OrderStatus.FILLED);
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));

        assertThrows(IllegalStateException.class, () -> orderService.cancelOrder(orderId, userId));
    }

    @Test
    void getOrderById_Success() {
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));

        OrderResponse response = orderService.getOrderById(orderId, userId);

        assertNotNull(response);
        assertEquals(orderId, response.id());
    }

    @Test
    void getOrderById_NotFound() {
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.empty());

        assertThrows(OrderNotFoundException.class, () -> orderService.getOrderById(orderId, userId));
    }
}
