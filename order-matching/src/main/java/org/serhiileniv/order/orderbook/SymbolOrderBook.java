package org.serhiileniv.order.orderbook;

import org.serhiileniv.order.dto.OrderBookSnapshot;
import org.serhiileniv.order.dto.OrderBookSnapshot.PriceLevel;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

/**
 * Per-symbol, in-memory price-time-priority order book.
 * MARKET orders are stored at sentinel prices so they sort to the "best" position
 * in each side but are excluded from the visual snapshot.
 * Thread-safe via an explicit ReentrantLock; callers must hold it for the full
 * match cycle (matchableCandidates → executeMatch → remove).
 */
public class SymbolOrderBook {

    private static final BigDecimal MARKET_BUY_SENTINEL  = new BigDecimal("999999999.99999999");
    private static final BigDecimal MARKET_SELL_SENTINEL = BigDecimal.ZERO;

    private final String symbol;
    private final TreeMap<BigDecimal, ArrayDeque<Order>> bids = new TreeMap<>(Comparator.reverseOrder());
    private final TreeMap<BigDecimal, ArrayDeque<Order>> asks = new TreeMap<>();
    private final ReentrantLock lock = new ReentrantLock();

    public SymbolOrderBook(String symbol) { this.symbol = symbol; }

    public void lock()   { lock.lock();   }
    public void unlock() { lock.unlock(); }

    public void add(Order order) {
        lock.lock();
        try {
            sideMap(order.getSide())
                    .computeIfAbsent(storageKey(order), k -> new ArrayDeque<>())
                    .addLast(order);
        } finally {
            lock.unlock();
        }
    }

    public void remove(Order order) {
        lock.lock();
        try {
            BigDecimal key = storageKey(order);
            ArrayDeque<Order> queue = sideMap(order.getSide()).get(key);
            if (queue != null) {
                queue.removeIf(o -> o.getId().equals(order.getId()));
                if (queue.isEmpty()) sideMap(order.getSide()).remove(key);
            }
        } finally {
            lock.unlock();
        }
    }

    /** Returns candidates for a match in price-time priority. Must be called with lock held. */
    public List<Order> matchableCandidates(Order aggressor) {
        TreeMap<BigDecimal, ArrayDeque<Order>> counter =
                aggressor.getSide() == OrderSide.BUY ? asks : bids;
        return counter.values().stream()
                .flatMap(Collection::stream)
                .filter(o -> o.getStatus() == OrderStatus.PENDING
                          || o.getStatus() == OrderStatus.PARTIALLY_FILLED)
                .collect(Collectors.toList());
    }

    /** Returns all active orders for a given side (for the REST order book endpoint). */
    public List<Order> getOrders(OrderSide side) {
        lock.lock();
        try {
            return sideMap(side).values().stream()
                    .flatMap(Collection::stream)
                    .filter(o -> o.getStatus() == OrderStatus.PENDING
                              || o.getStatus() == OrderStatus.PARTIALLY_FILLED)
                    .collect(Collectors.toList());
        } finally {
            lock.unlock();
        }
    }

    /** Produces an aggregated snapshot for WebSocket broadcast. */
    public OrderBookSnapshot snapshot() {
        lock.lock();
        try {
            return new OrderBookSnapshot(
                    symbol,
                    aggregateLevels(bids, MARKET_BUY_SENTINEL),
                    aggregateLevels(asks, MARKET_SELL_SENTINEL),
                    LocalDateTime.now());
        } finally {
            lock.unlock();
        }
    }

    private List<PriceLevel> aggregateLevels(
            TreeMap<BigDecimal, ArrayDeque<Order>> map, BigDecimal marketSentinel) {
        return map.entrySet().stream()
                .filter(e -> e.getKey().compareTo(marketSentinel) != 0)
                .limit(20)
                .map(e -> {
                    BigDecimal qty = e.getValue().stream()
                            .filter(o -> o.getStatus() == OrderStatus.PENDING
                                      || o.getStatus() == OrderStatus.PARTIALLY_FILLED)
                            .map(Order::getRemainingQuantity)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    int count = (int) e.getValue().stream()
                            .filter(o -> o.getStatus() == OrderStatus.PENDING
                                      || o.getStatus() == OrderStatus.PARTIALLY_FILLED)
                            .count();
                    return new PriceLevel(e.getKey(), qty, count);
                })
                .filter(l -> l.quantity().compareTo(BigDecimal.ZERO) > 0)
                .collect(Collectors.toList());
    }

    private BigDecimal storageKey(Order order) {
        if (order.getPrice() != null) return order.getPrice();
        return order.getSide() == OrderSide.BUY ? MARKET_BUY_SENTINEL : MARKET_SELL_SENTINEL;
    }

    private TreeMap<BigDecimal, ArrayDeque<Order>> sideMap(OrderSide side) {
        return side == OrderSide.BUY ? bids : asks;
    }
}
