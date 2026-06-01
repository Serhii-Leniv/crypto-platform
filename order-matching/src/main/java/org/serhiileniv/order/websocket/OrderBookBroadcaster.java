package org.serhiileniv.order.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.dto.OrderBookSnapshot;
import org.serhiileniv.order.kafka.event.OrderCancelledEvent;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.kafka.event.OrderPlacedEvent;
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderBookBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;
    private final OrderBookManager orderBookManager;

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
            OrderBookSnapshot snapshot = orderBookManager.getOrCreate(symbol).snapshot();
            messagingTemplate.convertAndSend("/topic/orderbook/" + symbol.replace("/", "-"), snapshot);
            log.debug("Broadcasted order book for {}: {} bid levels, {} ask levels",
                    symbol, snapshot.bids().size(), snapshot.asks().size());
        } catch (Exception e) {
            log.error("Failed to broadcast order book for {}: {}", symbol, e.getMessage());
        }
    }
}
