package org.serhiileniv.order.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.serhiileniv.order.orderbook.SymbolOrderBook;
import org.serhiileniv.order.repository.OrderRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderMatchingEngine {

    private final OrderRepository orderRepository;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final OrderBookManager orderBookManager;

    @Transactional
    public List<OrderMatchedEvent> matchOrder(Order newOrder) {
        log.info("Starting matching for order: {}", newOrder.getId());
        List<OrderMatchedEvent> matchedEvents = new ArrayList<>();
        SymbolOrderBook book = orderBookManager.getOrCreate(newOrder.getSymbol());
        book.lock();
        try {
            List<Order> candidates = book.matchableCandidates(newOrder);
            for (Order counterparty : candidates) {
                if (newOrder.isFullyFilled()) break;
                if (counterparty.getStatus() != OrderStatus.PENDING
                        && counterparty.getStatus() != OrderStatus.PARTIALLY_FILLED) {
                    continue;
                }
                if (!canMatch(newOrder, counterparty)) break;

                OrderMatchedEvent event = executeMatch(newOrder, counterparty);
                matchedEvents.add(event);
                orderRepository.save(counterparty);
                orderRepository.save(newOrder);
                if (counterparty.isFullyFilled()) book.remove(counterparty);
                applicationEventPublisher.publishEvent(event);
                log.info("Matched {} units @ {} for trade {}", event.getQuantity(), event.getPrice(), event.getTradeId());
            }
            if (newOrder.isFullyFilled()) book.remove(newOrder);
        } finally {
            book.unlock();
        }
        log.info("Matching done for order {}. Filled: {}/{}", newOrder.getId(), newOrder.getFilledQuantity(), newOrder.getQuantity());
        return matchedEvents;
    }

    /** Builds the order book view from the in-memory book (no DB query). */
    public OrderBook getOrderBook(String symbol) {
        SymbolOrderBook book = orderBookManager.getOrCreate(symbol);
        return new OrderBook(book.getOrders(OrderSide.BUY), book.getOrders(OrderSide.SELL));
    }

    private boolean canMatch(Order newOrder, Order counterparty) {
        if (newOrder.getPrice() == null) return true;
        if (counterparty.getPrice() == null) return true;
        if (newOrder.getSide() == OrderSide.BUY) {
            return newOrder.getPrice().compareTo(counterparty.getPrice()) >= 0;
        } else {
            return newOrder.getPrice().compareTo(counterparty.getPrice()) <= 0;
        }
    }

    private OrderMatchedEvent executeMatch(Order newOrder, Order counterparty) {
        BigDecimal fillQty   = newOrder.getRemainingQuantity().min(counterparty.getRemainingQuantity());
        BigDecimal matchPrice = counterparty.getPrice() != null ? counterparty.getPrice() : newOrder.getPrice();
        newOrder.fill(fillQty);
        counterparty.fill(fillQty);

        OrderMatchedEvent event = new OrderMatchedEvent();
        event.setTradeId(UUID.randomUUID());
        if (newOrder.getSide() == OrderSide.BUY) {
            event.setBuyOrderId(newOrder.getId());
            event.setSellOrderId(counterparty.getId());
            event.setBuyerUserId(newOrder.getUserId());
            event.setSellerUserId(counterparty.getUserId());
            event.setBuyerLimitPrice(newOrder.getPrice());
            event.setSellerLimitPrice(counterparty.getPrice());
        } else {
            event.setBuyOrderId(counterparty.getId());
            event.setSellOrderId(newOrder.getId());
            event.setBuyerUserId(counterparty.getUserId());
            event.setSellerUserId(newOrder.getUserId());
            event.setBuyerLimitPrice(counterparty.getPrice());
            event.setSellerLimitPrice(newOrder.getPrice());
        }
        event.setSymbol(newOrder.getSymbol());
        event.setPrice(matchPrice);
        event.setQuantity(fillQty);
        event.setTimestamp(LocalDateTime.now());
        return event;
    }

    public record OrderBook(List<Order> buyOrders, List<Order> sellOrders) {}
}
