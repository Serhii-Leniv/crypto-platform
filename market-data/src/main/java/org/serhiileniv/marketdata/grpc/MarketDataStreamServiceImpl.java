package org.serhiileniv.marketdata.grpc;

import io.grpc.stub.ServerCallStreamObserver;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;

@GrpcService
@RequiredArgsConstructor
@Slf4j
public class MarketDataStreamServiceImpl extends MarketDataStreamServiceGrpc.MarketDataStreamServiceImplBase {

    private final MarketDataStreamRegistry registry;

    @Override
    public void streamAllMarketData(SubscribeRequest request, StreamObserver<MarketDataUpdate> responseObserver) {
        log.info("New market data stream subscriber connected");
        registry.register(responseObserver);

        if (responseObserver instanceof ServerCallStreamObserver<MarketDataUpdate> serverCallObserver) {
            serverCallObserver.setOnCancelHandler(() -> {
                log.info("Market data stream subscriber disconnected");
                registry.deregister(responseObserver);
            });
        }
        // Stream stays open — updates are pushed via registry.broadcast()
    }
}
