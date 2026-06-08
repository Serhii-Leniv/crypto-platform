package org.serhiileniv.order.service;

import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.client.WalletClient;
import org.serhiileniv.order.config.TradingMetrics;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.TradingPair;
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.serhiileniv.order.orderbook.SymbolOrderBook;
import org.serhiileniv.order.repository.OrderRepository;
import org.serhiileniv.order.repository.TradingPairRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderMatchingEngine {

    private final OrderRepository orderRepository;
    private final OrderBookManager orderBookManager;
    private final WalletClient walletClient;
    private final TradingPairRepository tradingPairRepository;
    private final TradingMetrics metrics;
    private final OutboxService outboxService;

    @Transactional
    public List<OrderMatchedEvent> matchOrder(Order newOrder) {
        Timer.Sample matchTimer = metrics.startMatchTimer();
        try {
            return doMatchOrder(newOrder);
        } finally {
            metrics.stopMatchTimer(matchTimer);
        }
    }

    private List<OrderMatchedEvent> doMatchOrder(Order newOrder) {
        log.info("Starting matching for order: {}", newOrder.getId());
        List<OrderMatchedEvent> matchedEvents = new ArrayList<>();
        SymbolOrderBook book = orderBookManager.getOrCreate(newOrder.getSymbol());
        book.lock();
        try {
            List<Order> candidates = book.matchableCandidates(newOrder);
            for (Order counterparty : candidates) {
                if (newOrder.isFullyFilled()) break;
                if (counterparty.getStatus() != OrderStatus.PENDING
                        && counterparty.getStatus() != OrderStatus.PARTIALLY_FILLED) {
                    continue;
                }
                // Self-trade prevention: never match a user against themselves
                if (newOrder.getUserId().equals(counterparty.getUserId())) {
                    log.info("STP: skipping self-match between {} and {}", newOrder.getId(), counterparty.getId());
                    metrics.recordSelfTradeSkip();
                    continue;
                }
                if (!canMatch(newOrder, counterparty)) break;

                OrderMatchedEvent event = executeMatch(newOrder, counterparty);

                // Fee determination: counterparty was sitting in the book → it's the MAKER.
                // The incoming newOrder is the TAKER (it removed liquidity).
                TradingPair pair = tradingPairRepository.findById(event.getSymbol()).orElse(null);
                int makerFeeBps = pair != null ? pair.getMakerFeeBps() : 10;
                int takerFeeBps = pair != null ? pair.getTakerFeeBps() : 20;
                boolean buyerIsMaker = counterparty.getSide() == OrderSide.BUY;  // counterparty == maker

                // Atomic 4-wallet settlement BEFORE persisting the match. If settle throws,
                // the @Transactional method rolls back the in-memory fill() updates we just made
                // by re-throwing — the caller (OrderService) sees the failure synchronously.
                walletClient.settle(new WalletClient.SettleRequest(
                        event.getBuyerUserId(), event.getSellerUserId(),
                        baseOf(event.getSymbol()), quoteOf(event.getSymbol()),
                        event.getQuantity(),
                        event.getPrice().multiply(event.getQuantity()),
                        event.getPrice(),
                        event.getBuyerLimitPrice(),
                        event.getTradeId(),
                        event.getSymbol(),
                        buyerIsMaker ? makerFeeBps : takerFeeBps,
                        buyerIsMaker ? takerFeeBps : makerFeeBps));

                matchedEvents.add(event);
                orderRepository.save(counterparty);
                orderRepository.save(newOrder);
                if (counterparty.isFullyFilled()) book.remove(counterparty);
                outboxService.recordOrderMatched(event);
                metrics.recordFill(event.getSymbol(), event.getQuantity());
                log.info("Matched {} units @ {} for trade {}", event.getQuantity(), event.getPrice(), event.getTradeId());
            }
            if (newOrder.isFullyFilled()) book.remove(newOrder);
        } finally {
            book.unlock();
        }
        log.info("Matching done for order {}. Filled: {}/{}", newOrder.getId(), newOrder.getFilledQuantity(), newOrder.getQuantity());
        return matchedEvents;
    }

    private static String baseOf(String symbol)  { return symbol.split("[/-]")[0]; }
    private static String quoteOf(String symbol) { return symbol.split("[/-]")[1]; }

    /** Builds the order book view from the in-memory book (no DB query). */
    public OrderBook getOrderBook(String symbol) {
        SymbolOrderBook book = orderBookManager.getOrCreate(symbol);
        return new OrderBook(book.getOrders(OrderSide.BUY), book.getOrders(OrderSide.SELL));
    }

    private boolean canMatch(Order newOrder, Order counterparty) {
        if (newOrder.getPrice() == null) return true;
        if (counterparty.getPrice() == null) return true;
        if (newOrder.getSide() == OrderSide.BUY) {
            return newOrder.getPrice().compareTo(counterparty.getPrice()) >= 0;
        } else {
            return newOrder.getPrice().compareTo(counterparty.getPrice()) <= 0;
        }
    }

    private OrderMatchedEvent executeMatch(Order newOrder, Order counterparty) {
        BigDecimal fillQty   = newOrder.getRemainingQuantity().min(counterparty.getRemainingQuantity());
        BigDecimal matchPrice = counterparty.getPrice() != null ? counterparty.getPrice() : newOrder.getPrice();
        newOrder.fill(fillQty);
        counterparty.fill(fillQty);

        OrderMatchedEvent event = new OrderMatchedEvent();
        event.setTradeId(UUID.randomUUID());
        if (newOrder.getSide() == OrderSide.BUY) {
            event.setBuyOrderId(newOrder.getId());
            event.setSellOrderId(counterparty.getId());
            event.setBuyerUserId(newOrder.getUserId());
            event.setSellerUserId(counterparty.getUserId());
            event.setBuyerLimitPrice(newOrder.getPrice());
            event.setSellerLimitPrice(counterparty.getPrice());
        } else {
            event.setBuyOrderId(counterparty.getId());
            event.setSellOrderId(newOrder.getId());
            event.setBuyerUserId(counterparty.getUserId());
            event.setSellerUserId(newOrder.getUserId());
            event.setBuyerLimitPrice(counterparty.getPrice());
            event.setSellerLimitPrice(newOrder.getPrice());
        }
        event.setSymbol(newOrder.getSymbol());
        event.setPrice(matchPrice);
        event.setQuantity(fillQty);
        event.setTimestamp(Instant.now());
        return event;
    }

    public record OrderBook(List<Order> buyOrders, List<Order> sellOrders) {}
}
