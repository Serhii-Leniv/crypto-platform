package org.serhiileniv.order.service;

import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.order.client.WalletClient;
import org.serhiileniv.order.config.TradingMetrics;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.exception.InvalidSymbolException;
import org.serhiileniv.order.exception.OrderNotFoundException;
import org.serhiileniv.order.kafka.OrderEventProducer;
import org.serhiileniv.order.kafka.event.OrderCancelledEvent;
import org.serhiileniv.order.kafka.event.OrderPlacedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.model.TimeInForce;
import org.serhiileniv.order.model.TradingPair;
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.serhiileniv.order.orderbook.SymbolOrderBook;
import org.serhiileniv.order.repository.OrderRepository;
import org.serhiileniv.order.repository.TradingPairRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {
        private final OrderRepository orderRepository;
        private final OrderMatchingEngine matchingEngine;
        private final ApplicationEventPublisher applicationEventPublisher;
        private final OrderBookManager orderBookManager;
        private final TradingPairRepository tradingPairRepository;
        private final WalletClient walletClient;
        private final TradingMetrics metrics;

        @PersistenceContext
        private EntityManager entityManager;

        @Transactional
        public OrderResponse placeOrder(OrderRequest request, UUID userId) {
                Timer.Sample timer = metrics.startPlacementTimer();
                String outcome = "success";
                try {
                        return doPlaceOrder(request, userId);
                } catch (PostOnlyRejectedException e)   { outcome = "post_only_rejected"; metrics.recordOrderRejected(outcome); throw e; }
                catch (FokRejectedException e)          { outcome = "fok_rejected";       metrics.recordOrderRejected(outcome); throw e; }
                catch (InvalidSymbolException e)        { outcome = "invalid_symbol";     metrics.recordOrderRejected(outcome); throw e; }
                catch (RuntimeException e)              { outcome = e.getClass().getSimpleName(); metrics.recordOrderRejected("error"); throw e; }
                finally {
                        metrics.stopPlacementTimer(timer, outcome);
                }
        }

        private OrderResponse doPlaceOrder(OrderRequest request, UUID userId) {
                log.info("Placing order for user {}: {} {} {} @ {} (TIF={}, type={})",
                                userId, request.side(), request.quantity(), request.symbol(), request.price(),
                                request.effectiveTimeInForce(), request.orderType());
                TradingPair pair = validateAgainstTradingPair(request);

                UUID orderId = UUID.randomUUID();
                TimeInForce tif = request.effectiveTimeInForce();

                // Synchronous fund lock — same for all order types incl. STOP_LIMIT (funds reserved
                // even while the trigger hasn't fired yet, matching real-exchange behaviour).
                lockFundsForOrder(orderId, userId, request, pair);

                Order order = Order.builder()
                                .id(orderId)
                                .userId(userId)
                                .symbol(request.symbol())
                                .orderType(request.orderType())
                                .side(request.side())
                                .price(request.price())
                                .quantity(request.quantity())
                                .timeInForce(tif)
                                .triggerPrice(request.triggerPrice())
                                .status(request.orderType() == OrderType.STOP_LIMIT
                                                ? OrderStatus.TRIGGER_PENDING
                                                : OrderStatus.PENDING)
                                .build();

                // STOP_LIMIT lives in the DB as TRIGGER_PENDING and does NOT enter the book until
                // the scheduled stop monitor sees the market cross triggerPrice.
                if (request.orderType() == OrderType.STOP_LIMIT) {
                        order = orderRepository.save(order);
                        log.info("Stop-limit parked: {} trigger={} limit={}", order.getId(), order.getTriggerPrice(), order.getPrice());
                        metrics.recordOrderPlaced(request.symbol(), request.side(), request.orderType(), tif);
                        return OrderResponse.fromEntity(order);
                }

                SymbolOrderBook book = orderBookManager.getOrCreate(order.getSymbol());

                // POST_ONLY: reject if order would cross the top of book — only adds liquidity.
                if (tif == TimeInForce.POST_ONLY && wouldCross(order, book)) {
                        compensateLockOnReject(orderId, userId, request, pair);
                        throw new PostOnlyRejectedException("POST_ONLY order would cross the book and was rejected");
                }

                // FOK: feasibility scan — if total available counterparty liquidity (respecting STP)
                // is less than the order quantity, reject without entering the book.
                if (tif == TimeInForce.FOK) {
                        BigDecimal avail = book.availableCounterpartyQty(order);
                        if (avail.compareTo(request.quantity()) < 0) {
                                compensateLockOnReject(orderId, userId, request, pair);
                                throw new FokRejectedException("FOK order cannot be fully filled (available: "
                                                + trimZeros(avail) + " " + pair.getBaseCurrency() + ")");
                        }
                }

                order = orderRepository.save(order);
                book.add(order);

                OrderPlacedEvent placedEvent = new OrderPlacedEvent(
                                order.getId(),
                                order.getUserId(),
                                order.getSymbol(),
                                order.getOrderType(),
                                order.getSide(),
                                order.getPrice(),
                                order.getQuantity(),
                                LocalDateTime.now());
                applicationEventPublisher.publishEvent(placedEvent);

                matchingEngine.matchOrder(order);

                order = orderRepository.findById(orderId)
                                .orElseThrow(() -> new OrderNotFoundException(orderId));

                // IOC: any unfilled portion is cancelled — never rests in the book.
                if (tif == TimeInForce.IOC && order.getStatus() != OrderStatus.FILLED
                                && order.getStatus() != OrderStatus.CANCELLED) {
                        BigDecimal remaining = order.getRemainingQuantity();
                        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                                order.setStatus(OrderStatus.CANCELLED);
                                order = orderRepository.save(order);
                                book.remove(order);
                                unlockRemainder(orderId, userId, order, pair, remaining, "IOC unfilled remainder cancelled");
                        }
                }

                metrics.recordOrderPlaced(request.symbol(), request.side(), request.orderType(), tif);
                log.info("Order placed successfully: {} with status: {}", order.getId(), order.getStatus());
                return OrderResponse.fromEntity(order);
        }

        private boolean wouldCross(Order order, SymbolOrderBook book) {
                BigDecimal bestOpposite = book.bestOppositePrice(order.getSide());
                if (bestOpposite == null) return false;
                if (order.getPrice() == null) return true;
                return order.getSide() == OrderSide.BUY
                                ? order.getPrice().compareTo(bestOpposite) >= 0
                                : order.getPrice().compareTo(bestOpposite) <= 0;
        }

        private void compensateLockOnReject(UUID orderId, UUID userId, OrderRequest request, TradingPair pair) {
                try {
                        if (request.side() == OrderSide.BUY && request.price() != null) {
                                walletClient.unlock(userId, pair.getQuoteCurrency(),
                                                request.price().multiply(request.quantity()), orderId,
                                                request.symbol() + " order rejected — funds refunded");
                        } else if (request.side() == OrderSide.SELL) {
                                walletClient.unlock(userId, pair.getBaseCurrency(), request.quantity(), orderId,
                                                request.symbol() + " order rejected — funds refunded");
                        }
                } catch (Exception e) {
                        log.error("Compensation unlock failed for rejected order {}: {}", orderId, e.getMessage());
                }
        }

        private void unlockRemainder(UUID orderId, UUID userId, Order order, TradingPair pair,
                                     BigDecimal remaining, String reason) {
                if (remaining == null || remaining.compareTo(BigDecimal.ZERO) <= 0 || pair == null) return;
                if (order.getSide() == OrderSide.BUY && order.getPrice() != null) {
                        BigDecimal cost = order.getPrice().multiply(remaining);
                        walletClient.unlock(userId, pair.getQuoteCurrency(), cost, orderId,
                                        order.getSymbol() + " " + reason + " — " + trimZeros(cost) + " "
                                                        + pair.getQuoteCurrency() + " unlocked");
                } else if (order.getSide() == OrderSide.SELL) {
                        walletClient.unlock(userId, pair.getBaseCurrency(), remaining, orderId,
                                        order.getSymbol() + " " + reason + " — " + trimZeros(remaining) + " "
                                                        + pair.getBaseCurrency() + " unlocked");
                }
        }

        public static class PostOnlyRejectedException extends RuntimeException {
                public PostOnlyRejectedException(String msg) { super(msg); }
        }
        public static class FokRejectedException extends RuntimeException {
                public FokRejectedException(String msg) { super(msg); }
        }

        private void lockFundsForOrder(UUID orderId, UUID userId, OrderRequest request, TradingPair pair) {
                if (request.side() == OrderSide.BUY) {
                        if (request.price() == null) {
                                // MARKET BUY: lock based on a conservative price ceiling — for the demo,
                                // we don't support unlimited market-buy locks. Reject for safety.
                                throw new InvalidSymbolException("MARKET BUY orders are not supported (no price reference for lock)");
                        }
                        BigDecimal cost = request.price().multiply(request.quantity());
                        String desc = String.format("%s BUY order placed @ %s — %s %s locked",
                                        request.symbol(), trimZeros(request.price()), trimZeros(cost), pair.getQuoteCurrency());
                        walletClient.lock(userId, pair.getQuoteCurrency(), cost, orderId, desc);
                } else {
                        String desc = String.format("%s SELL order placed — %s %s locked",
                                        request.symbol(), trimZeros(request.quantity()), pair.getBaseCurrency());
                        walletClient.lock(userId, pair.getBaseCurrency(), request.quantity(), orderId, desc);
                }
        }

        private static String trimZeros(BigDecimal v) {
                return v == null ? "0" : v.stripTrailingZeros().toPlainString();
        }

        @Transactional
        public void cancelOrder(UUID orderId, UUID userId) {
                Order order = orderRepository.findByIdAndUserId(orderId, userId)
                                .orElseThrow(() -> new OrderNotFoundException(orderId));
                if (order.getStatus() == OrderStatus.FILLED) {
                        throw new IllegalStateException("Cannot cancel a filled order");
                }
                if (order.getStatus() == OrderStatus.CANCELLED) {
                        throw new IllegalStateException("Order is already cancelled");
                }

                BigDecimal remaining = order.getRemainingQuantity();
                boolean wasInBook = order.getStatus() == OrderStatus.PENDING
                                || order.getStatus() == OrderStatus.PARTIALLY_FILLED;
                order.setStatus(OrderStatus.CANCELLED);
                orderRepository.save(order);
                // Stops (TRIGGER_PENDING) were never in the book; skip the remove.
                if (wasInBook) {
                        orderBookManager.getOrCreate(order.getSymbol()).remove(order);
                }

                // Synchronous wallet unlock — funds returned before the request completes.
                if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                        TradingPair pair = tradingPairRepository.findById(order.getSymbol()).orElse(null);
                        if (pair != null) {
                                if (order.getSide() == OrderSide.BUY && order.getPrice() != null) {
                                        BigDecimal cost = order.getPrice().multiply(remaining);
                                        String desc = String.format("%s BUY order cancelled by user — %s %s unlocked",
                                                        order.getSymbol(), trimZeros(cost), pair.getQuoteCurrency());
                                        walletClient.unlock(userId, pair.getQuoteCurrency(), cost, orderId, desc);
                                } else if (order.getSide() == OrderSide.SELL) {
                                        String desc = String.format("%s SELL order cancelled by user — %s %s unlocked",
                                                        order.getSymbol(), trimZeros(remaining), pair.getBaseCurrency());
                                        walletClient.unlock(userId, pair.getBaseCurrency(), remaining, orderId, desc);
                                }
                        }
                }

                // Informational Kafka event — market-data may want to know the order is gone.
                OrderCancelledEvent cancelledEvent = new OrderCancelledEvent(
                                order.getId(),
                                order.getUserId(),
                                order.getSymbol(),
                                order.getSide(),
                                remaining,
                                order.getPrice(),
                                "Cancelled by user",
                                LocalDateTime.now());
                applicationEventPublisher.publishEvent(cancelledEvent);
                log.info("Order cancelled: {}", orderId);
        }

        @Transactional
        public OrderResponse getOrderById(UUID orderId, UUID userId) {
                Order order = orderRepository.findByIdAndUserId(orderId, userId)
                                .orElseThrow(() -> new OrderNotFoundException(orderId));
                return OrderResponse.fromEntity(order);
        }

        @Transactional(readOnly = true)
        public Page<OrderResponse> getUserOrders(UUID userId, Pageable pageable) {
                return orderRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(OrderResponse::fromEntity);
        }

        @Transactional
        public OrderMatchingEngine.OrderBook getOrderBook(String symbol) {
                return matchingEngine.getOrderBook(symbol);
        }

        /**
         * Reject orders for symbols that aren't in the canonical trading_pairs registry
         * or that fall below the per-pair minimum quantity. Format-level regex validation
         * happens earlier in the DTO; this is the business-rule guardrail.
         * Returns the resolved TradingPair for downstream lock-currency resolution.
         */
        private TradingPair validateAgainstTradingPair(OrderRequest request) {
                TradingPair pair = tradingPairRepository.findById(request.symbol())
                                .orElseThrow(() -> new InvalidSymbolException(
                                                "Symbol not listed: " + request.symbol()));
                if (!pair.isActive()) {
                        throw new InvalidSymbolException(
                                        "Market not currently tradable: " + request.symbol() + " (status: " + pair.getStatus() + ")");
                }
                if (request.quantity().compareTo(pair.getMinQuantity()) < 0) {
                        throw new InvalidSymbolException(
                                        "Quantity below minimum for " + request.symbol() + ": "
                                                        + pair.getMinQuantity().stripTrailingZeros().toPlainString());
                }
                // Tick size: limit price must be a multiple of tick_size
                if (request.price() != null && pair.getTickSize() != null
                                && pair.getTickSize().compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal remainder = request.price().remainder(pair.getTickSize());
                        if (remainder.compareTo(BigDecimal.ZERO) != 0) {
                                throw new InvalidSymbolException(
                                                "Price " + trimZeros(request.price()) + " is not a multiple of tick size "
                                                                + trimZeros(pair.getTickSize()) + " for " + request.symbol());
                        }
                }
                return pair;
        }
}
