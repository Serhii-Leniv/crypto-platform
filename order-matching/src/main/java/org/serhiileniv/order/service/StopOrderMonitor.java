package org.serhiileniv.order.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.client.MarketDataClient;
import org.serhiileniv.order.kafka.event.OrderPlacedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.serhiileniv.order.repository.OrderRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Polls market prices every few seconds and activates STOP_LIMIT orders whose trigger
 * has been crossed. An activated stop becomes a plain LIMIT order: status flips to
 * PENDING, it enters the order book, the matching engine attempts to fill it.
 *
 * BUY  stop triggers when last_price >= triggerPrice (price rose to the trigger)
 * SELL stop triggers when last_price <= triggerPrice (price fell to the trigger)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StopOrderMonitor {

    private final OrderRepository orderRepository;
    private final OrderBookManager orderBookManager;
    private final OrderMatchingEngine matchingEngine;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final MarketDataClient marketDataClient;

    @Scheduled(fixedDelay = 3000, initialDelay = 10_000)
    @Transactional
    public void activateTriggeredStops() {
        List<Order> stops = orderRepository.findByStatusAndOrderType(
                OrderStatus.TRIGGER_PENDING, OrderType.STOP_LIMIT);
        if (stops.isEmpty()) return;

        Map<String, BigDecimal> prices = marketDataClient.getAllLastPrices();
        for (Order stop : stops) {
            BigDecimal lastPrice = prices.get(stop.getSymbol());
            if (lastPrice == null || stop.getTriggerPrice() == null) continue;
            if (!isTriggered(stop, lastPrice)) continue;

            log.info("Activating STOP_LIMIT {} for {}: trigger={} last={} → entering book as LIMIT @ {}",
                    stop.getId(), stop.getSymbol(), stop.getTriggerPrice(), lastPrice, stop.getPrice());

            stop.setStatus(OrderStatus.PENDING);
            orderRepository.save(stop);
            orderBookManager.getOrCreate(stop.getSymbol()).add(stop);

            // Inform downstream listeners that the order is now a live LIMIT in the book.
            applicationEventPublisher.publishEvent(new OrderPlacedEvent(
                    stop.getId(), stop.getUserId(), stop.getSymbol(),
                    OrderType.LIMIT, stop.getSide(),
                    stop.getPrice(), stop.getQuantity(), LocalDateTime.now()));

            matchingEngine.matchOrder(stop);
        }
    }

    private static boolean isTriggered(Order stop, BigDecimal lastPrice) {
        if (stop.getSide() == OrderSide.BUY) {
            // Buy-stop activates when price climbs to the trigger
            return lastPrice.compareTo(stop.getTriggerPrice()) >= 0;
        } else {
            // Sell-stop activates when price falls to the trigger
            return lastPrice.compareTo(stop.getTriggerPrice()) <= 0;
        }
    }
}
