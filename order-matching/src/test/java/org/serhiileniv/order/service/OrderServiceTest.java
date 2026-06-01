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
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.serhiileniv.order.orderbook.SymbolOrderBook;
import org.serhiileniv.order.repository.OrderRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderMatchingEngine matchingEngine;
    @Mock
    private ApplicationEventPublisher applicationEventPublisher;
    @Mock
    private OrderBookManager orderBookManager;
    @Mock
    private SymbolOrderBook symbolOrderBook;

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
        when(orderBookManager.getOrCreate(any())).thenReturn(symbolOrderBook);

        OrderResponse response = orderService.placeOrder(orderRequest, userId);

        assertNotNull(response);
        assertEquals(orderId, response.id());
        verify(orderRepository).save(any(Order.class));
        verify(applicationEventPublisher).publishEvent(any(Object.class));
        verify(matchingEngine).matchOrder(any());
    }

    @Test
    void cancelOrder_Success() {
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));
        when(orderBookManager.getOrCreate(any())).thenReturn(symbolOrderBook);

        orderService.cancelOrder(orderId, userId);

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        verify(orderRepository).save(order);
        verify(applicationEventPublisher).publishEvent(any(Object.class));
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

    @Test
    void getUserOrders_ReturnsUserOrders() {
        Pageable pageable = PageRequest.of(0, 20);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable))
                .thenReturn(new PageImpl<>(List.of(order)));

        Page<OrderResponse> orders = orderService.getUserOrders(userId, pageable);

        assertEquals(1, orders.getTotalElements());
        assertEquals(orderId, orders.getContent().get(0).id());
    }

    @Test
    void getUserOrders_EmptyList() {
        Pageable pageable = PageRequest.of(0, 20);
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable))
                .thenReturn(Page.empty());

        Page<OrderResponse> orders = orderService.getUserOrders(userId, pageable);

        assertTrue(orders.isEmpty());
    }

    @Test
    void cancelOrder_PartiallyFilled_Success() {
        order.setStatus(OrderStatus.PARTIALLY_FILLED);
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));
        when(orderBookManager.getOrCreate(any())).thenReturn(symbolOrderBook);

        orderService.cancelOrder(orderId, userId);

        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        verify(orderRepository).save(order);
    }

    @Test
    void placeOrder_MarketOrder_SkipsPriceValidation() {
        OrderRequest marketRequest = new OrderRequest(
                "ETH-USDT", OrderType.MARKET, OrderSide.BUY, null, new BigDecimal("0.5"));
        Order marketOrder = Order.builder()
                .id(orderId).userId(userId).symbol("ETH-USDT")
                .orderType(OrderType.MARKET).side(OrderSide.BUY)
                .quantity(new BigDecimal("0.5")).filledQuantity(BigDecimal.ZERO)
                .status(OrderStatus.PENDING).build();
        when(orderRepository.save(any())).thenReturn(marketOrder);
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(marketOrder));
        when(orderBookManager.getOrCreate(any())).thenReturn(symbolOrderBook);

        OrderResponse response = orderService.placeOrder(marketRequest, userId);

        assertNotNull(response);
        assertEquals("ETH-USDT", response.symbol());
    }
}
