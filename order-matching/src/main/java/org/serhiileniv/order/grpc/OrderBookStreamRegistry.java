package org.serhiileniv.order.grpc;

import io.grpc.stub.StreamObserver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
@Slf4j
public class OrderBookStreamRegistry {

    private final ConcurrentHashMap<String, CopyOnWriteArrayList<StreamObserver<OrderBookSnapshot>>> bySymbol =
            new ConcurrentHashMap<>();

    public void register(String symbol, StreamObserver<OrderBookSnapshot> observer) {
        bySymbol.computeIfAbsent(symbol, k -> new CopyOnWriteArrayList<>()).add(observer);
        log.debug("OrderBook stream subscriber registered for symbol={}. Total: {}", symbol, bySymbol.get(symbol).size());
    }

    public void deregister(String symbol, StreamObserver<OrderBookSnapshot> observer) {
        CopyOnWriteArrayList<StreamObserver<OrderBookSnapshot>> list = bySymbol.get(symbol);
        if (list != null) {
            list.remove(observer);
            log.debug("OrderBook stream subscriber deregistered for symbol={}. Total: {}", symbol, list.size());
        }
    }

    public void broadcast(String symbol, OrderBookSnapshot snapshot) {
        CopyOnWriteArrayList<StreamObserver<OrderBookSnapshot>> list = bySymbol.get(symbol);
        if (list == null || list.isEmpty()) return;
        log.debug("Broadcasting order book snapshot for symbol={} to {} subscribers", symbol, list.size());
        for (StreamObserver<OrderBookSnapshot> observer : list) {
            try {
                observer.onNext(snapshot);
            } catch (Exception e) {
                log.warn("Failed to send order book snapshot to subscriber for symbol={}, removing: {}", symbol, e.getMessage());
                list.remove(observer);
            }
        }
    }
}
