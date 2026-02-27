package org.serhiileniv.order.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.kafka.OrderEventProducer;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.repository.OrderRepository;
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
    private final OrderEventProducer eventProducer;

    @Transactional
    public List<OrderMatchedEvent> matchOrder(Order newOrder) {
        log.info("Starting matching process for order: {}", newOrder.getId());
        List<OrderMatchedEvent> matchedEvents = new ArrayList<>();
        List<Order> counterpartyOrders = getCounterpartyOrders(newOrder);
        for (Order counterpartyOrder : counterpartyOrders) {
            if (newOrder.isFullyFilled()) {
                break;
            }
            if (!canMatch(newOrder, counterpartyOrder)) {
                break;
            }
            OrderMatchedEvent matchEvent = executeMatch(newOrder, counterpartyOrder);
            matchedEvents.add(matchEvent);
            orderRepository.save(counterpartyOrder);
            orderRepository.save(newOrder);
            eventProducer.sendOrderMatchedEvent(matchEvent);
            log.info("Matched {} units at price {} for trade {}",
                    matchEvent.getQuantity(), matchEvent.getPrice(), matchEvent.getTradeId());
        }
        log.info("Matching complete for order {}. Filled: {}/{}",
                newOrder.getId(), newOrder.getFilledQuantity(), newOrder.getQuantity());
        return matchedEvents;
    }

    private List<Order> getCounterpartyOrders(Order order) {
        if (order.getSide() == OrderSide.BUY) {
            return orderRepository.findSellOrdersForMatching(order.getSymbol(), OrderSide.SELL);
        } else {
            return orderRepository.findBuyOrdersForMatching(order.getSymbol(), OrderSide.BUY);
        }
    }

    private boolean canMatch(Order newOrder, Order counterpartyOrder) {
        if (newOrder.getPrice() == null) {
            return true;
        }
        if (newOrder.getSide() == OrderSide.BUY) {
            return newOrder.getPrice().compareTo(counterpartyOrder.getPrice()) >= 0;
        } else {
            return newOrder.getPrice().compareTo(counterpartyOrder.getPrice()) <= 0;
        }
    }

    private OrderMatchedEvent executeMatch(Order newOrder, Order counterpartyOrder) {
        BigDecimal fillQuantity = newOrder.getRemainingQuantity()
                .min(counterpartyOrder.getRemainingQuantity());
        BigDecimal matchPrice = counterpartyOrder.getPrice();
        newOrder.fill(fillQuantity);
        counterpartyOrder.fill(fillQuantity);
        UUID tradeId = UUID.randomUUID();
        OrderMatchedEvent event = new OrderMatchedEvent();
        event.setTradeId(tradeId);
        if (newOrder.getSide() == OrderSide.BUY) {
            event.setBuyOrderId(newOrder.getId());
            event.setSellOrderId(counterpartyOrder.getId());
            event.setBuyerUserId(newOrder.getUserId());
            event.setSellerUserId(counterpartyOrder.getUserId());
        } else {
            event.setBuyOrderId(counterpartyOrder.getId());
            event.setSellOrderId(newOrder.getId());
            event.setBuyerUserId(counterpartyOrder.getUserId());
            event.setSellerUserId(newOrder.getUserId());
        }
        event.setSymbol(newOrder.getSymbol());
        event.setPrice(matchPrice);
        event.setQuantity(fillQuantity);
        event.setTimestamp(LocalDateTime.now());
        return event;
    }

    @Transactional
    public OrderBook getOrderBook(String symbol) {
        List<Order> buyOrders = orderRepository.findBuyOrdersForMatching(symbol, OrderSide.BUY);
        List<Order> sellOrders = orderRepository.findSellOrdersForMatching(symbol, OrderSide.SELL);
        return new OrderBook(buyOrders, sellOrders);
    }

    public record OrderBook(List<Order> buyOrders, List<Order> sellOrders) {
    }
}
