package org.serhiileniv.order.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.dto.OrderBookSnapshot;
import org.serhiileniv.order.dto.OrderBookSnapshot.PriceLevel;
import org.serhiileniv.order.kafka.event.OrderCancelledEvent;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.kafka.event.OrderPlacedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.repository.OrderRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderBookBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;
    private final OrderRepository orderRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onOrderMatched(OrderMatchedEvent event) {
        broadcastOrderBook(event.getSymbol());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onOrderPlaced(OrderPlacedEvent event) {
        broadcastOrderBook(event.getSymbol());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onOrderCancelled(OrderCancelledEvent event) {
        broadcastOrderBook(event.getSymbol());
    }

    private void broadcastOrderBook(String symbol) {
        try {
            List<Order> bids = orderRepository.findBuyOrdersForMatching(symbol, OrderSide.BUY).stream()
                    .filter(o -> o.getStatus() == OrderStatus.PENDING || o.getStatus() == OrderStatus.PARTIALLY_FILLED)
                    .toList();
            List<Order> asks = orderRepository.findSellOrdersForMatching(symbol, OrderSide.SELL).stream()
                    .filter(o -> o.getStatus() == OrderStatus.PENDING || o.getStatus() == OrderStatus.PARTIALLY_FILLED)
                    .toList();

            List<PriceLevel> bidLevels = aggregateLevels(bids, Comparator.reverseOrder());
            List<PriceLevel> askLevels = aggregateLevels(asks, Comparator.naturalOrder());

            OrderBookSnapshot snapshot = new OrderBookSnapshot(symbol, bidLevels, askLevels, LocalDateTime.now());
            String topic = "/topic/orderbook/" + symbol.replace("/", "-");
            messagingTemplate.convertAndSend(topic, snapshot);
            log.debug("Broadcasted order book for {}: {} bids, {} asks", symbol, bidLevels.size(), askLevels.size());
        } catch (Exception e) {
            log.error("Failed to broadcast order book for {}: {}", symbol, e.getMessage());
        }
    }

    private List<PriceLevel> aggregateLevels(List<Order> orders, Comparator<BigDecimal> priceOrder) {
        Map<BigDecimal, List<Order>> byPrice = orders.stream()
                .collect(Collectors.groupingBy(Order::getPrice));
        return byPrice.entrySet().stream()
                .map(e -> new PriceLevel(
                        e.getKey(),
                        e.getValue().stream()
                                .map(Order::getRemainingQuantity)
                                .reduce(BigDecimal.ZERO, BigDecimal::add),
                        e.getValue().size()))
                .sorted(Comparator.comparing(PriceLevel::price, priceOrder))
                .limit(20)
                .collect(Collectors.toList());
    }
}
