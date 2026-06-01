package org.serhiileniv.order.orderbook;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class OrderBookManager {

    private final ConcurrentHashMap<String, SymbolOrderBook> books = new ConcurrentHashMap<>();

    public SymbolOrderBook getOrCreate(String symbol) {
        return books.computeIfAbsent(symbol, SymbolOrderBook::new);
    }

    public int symbolCount() {
        return books.size();
    }
}
