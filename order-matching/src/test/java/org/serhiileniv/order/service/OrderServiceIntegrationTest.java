package org.serhiileniv.order.service;

import org.junit.jupiter.api.Test;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.exception.OrderNotFoundException;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.repository.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.kafka.core.KafkaTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Testcontainers
class OrderServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @MockBean
    @SuppressWarnings("rawtypes")
    KafkaTemplate kafkaTemplate;

    @Autowired
    OrderService orderService;

    @Autowired
    OrderRepository orderRepository;

    @org.junit.jupiter.api.BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        org.mockito.Mockito.when(kafkaTemplate.send(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(java.util.concurrent.CompletableFuture.completedFuture(null));
    }

    @Test
    void placeOrder_persistsToDatabase() {
        UUID userId = UUID.randomUUID();
        OrderRequest request = new OrderRequest(
                "BTC/USDT", OrderType.LIMIT, OrderSide.BUY,
                new BigDecimal("50000"), new BigDecimal("1"));

        OrderResponse response = orderService.placeOrder(request, userId);

        assertNotNull(response.id());
        assertEquals("BTC/USDT", response.symbol());
        assertEquals(OrderStatus.PENDING, response.status());

        Order persisted = orderRepository.findById(response.id()).orElseThrow();
        assertEquals(userId, persisted.getUserId());
        assertEquals(OrderSide.BUY, persisted.getSide());
        assertEquals(0, new BigDecimal("1").compareTo(persisted.getQuantity()));
    }

    @Test
    void cancelOrder_changesStatusToCancelled() {
        UUID userId = UUID.randomUUID();
        OrderRequest request = new OrderRequest(
                "ETH/USDT", OrderType.LIMIT, OrderSide.SELL,
                new BigDecimal("3000"), new BigDecimal("2"));
        OrderResponse placed = orderService.placeOrder(request, userId);

        orderService.cancelOrder(placed.id(), userId);

        Order cancelled = orderRepository.findById(placed.id()).orElseThrow();
        assertEquals(OrderStatus.CANCELLED, cancelled.getStatus());
    }

    @Test
    void cancelOrder_filledOrder_throwsIllegalState() {
        UUID userId = UUID.randomUUID();
        Order filledOrder = Order.builder()
                .userId(userId)
                .symbol("BTC/USDT")
                .orderType(OrderType.LIMIT)
                .side(OrderSide.BUY)
                .price(new BigDecimal("50000"))
                .quantity(new BigDecimal("1"))
                .status(OrderStatus.FILLED)
                .build();
        orderRepository.save(filledOrder);

        assertThrows(IllegalStateException.class,
                () -> orderService.cancelOrder(filledOrder.getId(), userId));
    }

    @Test
    void cancelOrder_wrongUser_throwsOrderNotFound() {
        UUID ownerId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        OrderRequest request = new OrderRequest(
                "BTC/USDT", OrderType.LIMIT, OrderSide.BUY,
                new BigDecimal("50000"), new BigDecimal("0.5"));
        OrderResponse placed = orderService.placeOrder(request, ownerId);

        assertThrows(OrderNotFoundException.class,
                () -> orderService.cancelOrder(placed.id(), otherUserId));
    }

    @Test
    void getUserOrders_returnsOrdersForUser() {
        UUID userId = UUID.randomUUID();
        orderService.placeOrder(new OrderRequest(
                "BTC/USDT", OrderType.LIMIT, OrderSide.BUY,
                new BigDecimal("50000"), new BigDecimal("1")), userId);
        orderService.placeOrder(new OrderRequest(
                "ETH/USDT", OrderType.LIMIT, OrderSide.SELL,
                new BigDecimal("3000"), new BigDecimal("5")), userId);

        var orders = orderService.getUserOrders(userId);

        assertEquals(2, orders.size());
    }
}
