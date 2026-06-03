package org.serhiileniv.order.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.order.client.WalletClient;
import org.serhiileniv.order.config.TradingMetrics;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.serhiileniv.order.orderbook.SymbolOrderBook;
import org.serhiileniv.order.repository.OrderRepository;
import org.serhiileniv.order.repository.TradingPairRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class OrderMatchingEngineTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    @Mock
    private OrderBookManager orderBookManager;

    @Mock
    private WalletClient walletClient;

    @Mock
    private TradingPairRepository tradingPairRepository;

    @Mock
    private TradingMetrics metrics;

    @InjectMocks
    private OrderMatchingEngine matchingEngine;

    private final String symbol = "BTC/USDT";
    private final UUID userId1 = UUID.randomUUID();
    private final UUID userId2 = UUID.randomUUID();

    private SymbolOrderBook book;

    @BeforeEach
    void setUp() {
        book = new SymbolOrderBook(symbol);
        when(orderBookManager.getOrCreate(symbol)).thenReturn(book);
    }

    @Test
    void matchOrder_FullFill_BuyOrder() {
        Order sellOrder = createOrder(userId2, symbol, OrderSide.SELL, "50000", "1");
        book.add(sellOrder);

        Order newBuyOrder = createOrder(userId1, symbol, OrderSide.BUY, "50000", "1");
        List<OrderMatchedEvent> matchedEvents = matchingEngine.matchOrder(newBuyOrder);

        assertEquals(1, matchedEvents.size());
        assertEquals(OrderStatus.FILLED, newBuyOrder.getStatus());
        assertEquals(OrderStatus.FILLED, sellOrder.getStatus());
        assertEquals(0, new BigDecimal("1").compareTo(newBuyOrder.getFilledQuantity()));

        verify(orderRepository, atLeastOnce()).save(newBuyOrder);
        verify(orderRepository, atLeastOnce()).save(sellOrder);
        verify(applicationEventPublisher).publishEvent(any(Object.class));
    }

    @Test
    void matchOrder_PartialFill_BuyOrder() {
        Order sellOrder = createOrder(userId2, symbol, OrderSide.SELL, "50000", "0.5");
        book.add(sellOrder);

        Order newBuyOrder = createOrder(userId1, symbol, OrderSide.BUY, "50000", "1");
        List<OrderMatchedEvent> matchedEvents = matchingEngine.matchOrder(newBuyOrder);

        assertEquals(1, matchedEvents.size());
        assertEquals(OrderStatus.PARTIALLY_FILLED, newBuyOrder.getStatus());
        assertEquals(OrderStatus.FILLED, sellOrder.getStatus());
        assertEquals(0, new BigDecimal("0.5").compareTo(matchedEvents.get(0).getQuantity()));
        assertEquals(0, new BigDecimal("0.5").compareTo(newBuyOrder.getFilledQuantity()));
    }

    @Test
    void matchOrder_MultipleCounterpartyOrders() {
        Order sellOrder1 = createOrder(userId2, symbol, OrderSide.SELL, "49000", "0.4");
        Order sellOrder2 = createOrder(userId2, symbol, OrderSide.SELL, "50000", "0.8");
        book.add(sellOrder1);
        book.add(sellOrder2);

        Order newBuyOrder = createOrder(userId1, symbol, OrderSide.BUY, "50000", "1");
        List<OrderMatchedEvent> matchedEvents = matchingEngine.matchOrder(newBuyOrder);

        assertEquals(2, matchedEvents.size());
        assertEquals(OrderStatus.FILLED, newBuyOrder.getStatus());
        assertEquals(0, new BigDecimal("1").compareTo(newBuyOrder.getFilledQuantity()));
        assertEquals(OrderStatus.FILLED, sellOrder1.getStatus());
        assertEquals(OrderStatus.PARTIALLY_FILLED, sellOrder2.getStatus());
        assertEquals(0, new BigDecimal("0.6").compareTo(sellOrder2.getFilledQuantity()));
    }

    @Test
    void matchOrder_NoMatch_PriceTooHigh() {
        Order sellOrder = createOrder(userId2, symbol, OrderSide.SELL, "51000", "1");
        book.add(sellOrder);

        Order newBuyOrder = createOrder(userId1, symbol, OrderSide.BUY, "50000", "1");
        List<OrderMatchedEvent> matchedEvents = matchingEngine.matchOrder(newBuyOrder);

        assertTrue(matchedEvents.isEmpty());
        assertEquals(OrderStatus.PENDING, newBuyOrder.getStatus());
    }

    @Test
    void matchOrder_MarketBuyOrder_MatchesAtCounterpartyPrice() {
        Order sellOrder = createOrder(userId2, symbol, OrderSide.SELL, "48000", "1");
        book.add(sellOrder);

        Order marketBuy = Order.builder()
                .id(UUID.randomUUID()).userId(userId1).symbol(symbol)
                .side(OrderSide.BUY).price(null)
                .quantity(new BigDecimal("1")).filledQuantity(BigDecimal.ZERO)
                .status(OrderStatus.PENDING).build();

        List<OrderMatchedEvent> events = matchingEngine.matchOrder(marketBuy);

        assertEquals(1, events.size());
        assertEquals(0, new BigDecimal("48000").compareTo(events.get(0).getPrice()));
        assertEquals(OrderStatus.FILLED, marketBuy.getStatus());
    }

    @Test
    void matchOrder_SellOrder_MatchesAgainstBuyOrders() {
        Order buyOrder = createOrder(userId2, symbol, OrderSide.BUY, "50000", "2");
        book.add(buyOrder);

        Order newSellOrder = createOrder(userId1, symbol, OrderSide.SELL, "50000", "2");
        List<OrderMatchedEvent> events = matchingEngine.matchOrder(newSellOrder);

        assertEquals(1, events.size());
        assertEquals(OrderStatus.FILLED, newSellOrder.getStatus());
        assertEquals(OrderStatus.FILLED, buyOrder.getStatus());
        assertEquals(userId1, events.get(0).getSellerUserId());
        assertEquals(userId2, events.get(0).getBuyerUserId());
    }

    @Test
    void matchOrder_EmptyOrderBook_NoEvents() {
        Order buyOrder = createOrder(userId1, symbol, OrderSide.BUY, "50000", "1");
        List<OrderMatchedEvent> events = matchingEngine.matchOrder(buyOrder);

        assertTrue(events.isEmpty());
        assertEquals(OrderStatus.PENDING, buyOrder.getStatus());
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    @Test
    void matchOrder_SkipsCancelledCounterparty() {
        Order cancelledSell = createOrder(userId2, symbol, OrderSide.SELL, "50000", "1");
        cancelledSell.setStatus(OrderStatus.CANCELLED);
        Order validSell = createOrder(userId2, symbol, OrderSide.SELL, "50000", "1");
        book.add(cancelledSell);
        book.add(validSell);

        Order buyOrder = createOrder(userId1, symbol, OrderSide.BUY, "50000", "1");
        List<OrderMatchedEvent> events = matchingEngine.matchOrder(buyOrder);

        assertEquals(1, events.size());
        assertEquals(OrderStatus.FILLED, buyOrder.getStatus());
        assertEquals(OrderStatus.FILLED, validSell.getStatus());
        assertEquals(OrderStatus.CANCELLED, cancelledSell.getStatus());
    }

    @Test
    void matchOrder_SellBelowBuyPrice_NoMatch() {
        Order buyOrder = createOrder(userId2, symbol, OrderSide.BUY, "45000", "1");
        book.add(buyOrder);

        Order sellOrder = createOrder(userId1, symbol, OrderSide.SELL, "48000", "1");
        List<OrderMatchedEvent> events = matchingEngine.matchOrder(sellOrder);

        assertTrue(events.isEmpty());
    }

    private Order createOrder(UUID userId, String symbol, OrderSide side, String price, String quantity) {
        return Order.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .symbol(symbol)
                .side(side)
                .price(new BigDecimal(price))
                .quantity(new BigDecimal(quantity))
                .filledQuantity(BigDecimal.ZERO)
                .status(OrderStatus.PENDING)
                .build();
    }
}
