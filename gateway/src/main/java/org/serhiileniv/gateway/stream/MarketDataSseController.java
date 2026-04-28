package org.serhiileniv.gateway.stream;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.grpc.stub.StreamObserver;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.serhiileniv.marketdata.grpc.MarketDataStreamServiceGrpc;
import org.serhiileniv.marketdata.grpc.MarketDataUpdate;
import org.serhiileniv.marketdata.grpc.SubscribeRequest;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.Map;

@RestController
@Slf4j
public class MarketDataSseController {

    @GrpcClient("market-data-service")
    private MarketDataStreamServiceGrpc.MarketDataStreamServiceStub stub;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping(value = "/api/v1/stream/market-data", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamMarketData() {
        log.info("SSE client subscribed to market data stream");
        return Flux.<MarketDataUpdate>create(sink ->
            stub.streamAllMarketData(SubscribeRequest.newBuilder().build(), new StreamObserver<>() {
                @Override public void onNext(MarketDataUpdate value) { sink.next(value); }
                @Override public void onError(Throwable t) {
                    log.warn("Market data gRPC stream error: {}", t.getMessage());
                    sink.error(t);
                }
                @Override public void onCompleted() { sink.complete(); }
            })
        ).map(update -> ServerSentEvent.<String>builder()
                .data(toJson(update))
                .build())
        .doOnCancel(() -> log.info("SSE client disconnected from market data stream"));
    }

    private String toJson(MarketDataUpdate update) {
        Map<String, Object> map = new HashMap<>();
        map.put("symbol", update.getSymbol());
        map.put("lastPrice", update.getLastPrice());
        map.put("volume24h", update.getVolume24H());
        map.put("high24h", update.getHigh24H());
        map.put("low24h", update.getLow24H());
        map.put("priceChange24h", update.getPriceChange24H());
        map.put("priceChangePercent24h", update.getPriceChangePct24H());
        map.put("tradeCount24h", update.getTradeCount24H());
        map.put("updatedAt", update.getUpdatedAt());
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize market data update", e);
            return "{}";
        }
    }
}
