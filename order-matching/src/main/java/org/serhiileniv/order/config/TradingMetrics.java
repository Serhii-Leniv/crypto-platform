package org.serhiileniv.order.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.model.TimeInForce;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Domain-level Micrometer metrics for the matching engine.
 * Names follow Micrometer conventions (dots, lowercase); Prometheus scraping
 * converts them to snake_case automatically.
 */
@Component
public class TradingMetrics {

    private final MeterRegistry registry;

    public TradingMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public void recordOrderPlaced(String symbol, OrderSide side, OrderType type, TimeInForce tif) {
        Counter.builder("orders.placed")
                .description("Orders accepted into the system (after lock, before match)")
                .tags(Tags.of(
                        "symbol", symbol,
                        "side", side.name(),
                        "type", type.name(),
                        "tif", tif.name()))
                .register(registry)
                .increment();
    }

    public void recordOrderRejected(String reason) {
        Counter.builder("orders.rejected")
                .description("Orders rejected at placement time")
                .tag("reason", reason)
                .register(registry)
                .increment();
    }

    public Timer.Sample startPlacementTimer() {
        return Timer.start(registry);
    }

    public void stopPlacementTimer(Timer.Sample sample, String outcome) {
        sample.stop(Timer.builder("orders.place.duration")
                .description("End-to-end placeOrder duration")
                .tag("outcome", outcome)
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry));
    }

    public void recordFill(String symbol, BigDecimal quantity) {
        Counter.builder("matches.filled")
                .description("Individual fills (one per matched pair)")
                .tag("symbol", symbol)
                .register(registry)
                .increment();
        Counter.builder("matches.fill.volume")
                .description("Filled base-currency volume")
                .tag("symbol", symbol)
                .register(registry)
                .increment(quantity.doubleValue());
    }

    public void recordSelfTradeSkip() {
        Counter.builder("matches.stp.skips")
                .description("Counterparty skipped due to self-trade prevention")
                .register(registry)
                .increment();
    }

    public Timer.Sample startMatchTimer() {
        return Timer.start(registry);
    }

    public void stopMatchTimer(Timer.Sample sample) {
        sample.stop(Timer.builder("matches.duration")
                .description("OrderMatchingEngine.matchOrder() duration")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry));
    }

    public void registerBookDepth(String symbol, AtomicLong bidCount, AtomicLong askCount) {
        registry.gauge("orderbook.depth", Tags.of("symbol", symbol, "side", "BUY"),  bidCount, AtomicLong::doubleValue);
        registry.gauge("orderbook.depth", Tags.of("symbol", symbol, "side", "SELL"), askCount, AtomicLong::doubleValue);
    }
}
