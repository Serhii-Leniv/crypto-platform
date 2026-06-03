package org.serhiileniv.order.orderbook;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import org.serhiileniv.order.model.OrderSide;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class OrderBookManager {

    private final ConcurrentHashMap<String, SymbolOrderBook> books = new ConcurrentHashMap<>();
    private final MeterRegistry meterRegistry;

    public OrderBookManager(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public SymbolOrderBook getOrCreate(String symbol) {
        return books.computeIfAbsent(symbol, s -> {
            SymbolOrderBook book = new SymbolOrderBook(s);
            // Register depth gauges once per symbol; Micrometer dedupes identical (name,tags) ids.
            meterRegistry.gauge("orderbook.depth", Tags.of("symbol", s, "side", "BUY"),  book,
                    b -> b.getOrders(OrderSide.BUY).size());
            meterRegistry.gauge("orderbook.depth", Tags.of("symbol", s, "side", "SELL"), book,
                    b -> b.getOrders(OrderSide.SELL).size());
            return book;
        });
    }

    public int symbolCount() {
        return books.size();
    }
}
