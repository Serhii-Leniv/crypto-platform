package org.serhiileniv.order.grpc;

import io.grpc.stub.ServerCallStreamObserver;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.service.OrderMatchingEngine;
import org.serhiileniv.order.service.OrderService;

@GrpcService
@RequiredArgsConstructor
@Slf4j
public class OrderBookStreamServiceImpl extends OrderBookStreamServiceGrpc.OrderBookStreamServiceImplBase {

    private final OrderBookStreamRegistry registry;
    private final OrderService orderService;

    @Override
    public void streamOrderBook(OrderBookRequest request, StreamObserver<OrderBookSnapshot> responseObserver) {
        String symbol = request.getSymbol();
        log.info("New order book stream subscriber for symbol={}", symbol);
        registry.register(symbol, responseObserver);

        // Send immediate snapshot
        try {
            OrderMatchingEngine.OrderBook book = orderService.getOrderBook(symbol);
            responseObserver.onNext(buildSnapshot(symbol, book));
        } catch (Exception e) {
            log.warn("Could not send initial order book snapshot for symbol={}: {}", symbol, e.getMessage());
        }

        if (responseObserver instanceof ServerCallStreamObserver<OrderBookSnapshot> serverCallObserver) {
            serverCallObserver.setOnCancelHandler(() -> {
                log.info("Order book stream subscriber disconnected for symbol={}", symbol);
                registry.deregister(symbol, responseObserver);
            });
        }
    }

    public static OrderBookSnapshot buildSnapshot(String symbol, OrderMatchingEngine.OrderBook book) {
        OrderBookSnapshot.Builder builder = OrderBookSnapshot.newBuilder().setSymbol(symbol);
        for (Order o : book.buyOrders()) {
            builder.addBuyOrders(OrderEntry.newBuilder()
                    .setPrice(o.getPrice() != null ? o.getPrice().toPlainString() : "0")
                    .setQuantity(o.getQuantity().toPlainString())
                    .setFilledQuantity(o.getFilledQuantity().toPlainString())
                    .build());
        }
        for (Order o : book.sellOrders()) {
            builder.addSellOrders(OrderEntry.newBuilder()
                    .setPrice(o.getPrice() != null ? o.getPrice().toPlainString() : "0")
                    .setQuantity(o.getQuantity().toPlainString())
                    .setFilledQuantity(o.getFilledQuantity().toPlainString())
                    .build());
        }
        return builder.build();
    }
}
