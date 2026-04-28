package org.serhiileniv.marketdata.grpc;

import io.grpc.stub.StreamObserver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.CopyOnWriteArrayList;

@Component
@Slf4j
public class MarketDataStreamRegistry {

    private final CopyOnWriteArrayList<StreamObserver<MarketDataUpdate>> observers = new CopyOnWriteArrayList<>();

    public void register(StreamObserver<MarketDataUpdate> observer) {
        observers.add(observer);
        log.debug("MarketData stream subscriber registered. Total: {}", observers.size());
    }

    public void deregister(StreamObserver<MarketDataUpdate> observer) {
        observers.remove(observer);
        log.debug("MarketData stream subscriber deregistered. Total: {}", observers.size());
    }

    public void broadcast(MarketDataUpdate update) {
        if (observers.isEmpty()) return;
        log.debug("Broadcasting market data update for symbol={} to {} subscribers", update.getSymbol(), observers.size());
        for (StreamObserver<MarketDataUpdate> observer : observers) {
            try {
                observer.onNext(update);
            } catch (Exception e) {
                log.warn("Failed to send market data update to subscriber, removing: {}", e.getMessage());
                observers.remove(observer);
            }
        }
    }
}
