package org.serhiileniv.gateway.stream;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.grpc.stub.StreamObserver;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.serhiileniv.order.grpc.OrderBookRequest;
import org.serhiileniv.order.grpc.OrderBookSnapshot;
import org.serhiileniv.order.grpc.OrderBookStreamServiceGrpc;
import org.serhiileniv.order.grpc.OrderEntry;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@Slf4j
public class OrderBookSseController {

    @GrpcClient("order-matching-service")
    private OrderBookStreamServiceGrpc.OrderBookStreamServiceStub stub;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping(value = "/api/v1/stream/order-book/{symbol}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamOrderBook(@PathVariable String symbol) {
        log.info("SSE client subscribed to order book stream for symbol={}", symbol);
        return Flux.<OrderBookSnapshot>create(sink ->
            stub.streamOrderBook(
                OrderBookRequest.newBuilder().setSymbol(symbol).build(),
                new StreamObserver<>() {
                    @Override public void onNext(OrderBookSnapshot value) { sink.next(value); }
                    @Override public void onError(Throwable t) {
                        log.warn("Order book gRPC stream error for symbol={}: {}", symbol, t.getMessage());
                        sink.error(t);
                    }
                    @Override public void onCompleted() { sink.complete(); }
                })
        ).map(snapshot -> ServerSentEvent.<String>builder()
                .data(toJson(snapshot))
                .build())
        .doOnCancel(() -> log.info("SSE client disconnected from order book stream for symbol={}", symbol));
    }

    private String toJson(OrderBookSnapshot snapshot) {
        Map<String, Object> map = new HashMap<>();
        map.put("symbol", snapshot.getSymbol());
        map.put("buyOrders", toEntryList(snapshot.getBuyOrdersList()));
        map.put("sellOrders", toEntryList(snapshot.getSellOrdersList()));
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize order book snapshot", e);
            return "{}";
        }
    }

    private List<Map<String, String>> toEntryList(List<OrderEntry> entries) {
        return entries.stream().map(e -> {
            Map<String, String> m = new HashMap<>();
            m.put("price", e.getPrice());
            m.put("quantity", e.getQuantity());
            m.put("filledQuantity", e.getFilledQuantity());
            return m;
        }).toList();
    }
}
