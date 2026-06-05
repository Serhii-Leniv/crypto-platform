package org.serhiileniv.order.property;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.serhiileniv.order.client.WalletClient;
import org.serhiileniv.order.config.TradingMetrics;
import org.serhiileniv.order.kafka.event.OrderMatchedEvent;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.orderbook.OrderBookManager;
import org.serhiileniv.order.orderbook.SymbolOrderBook;
import org.serhiileniv.order.repository.OrderRepository;
import org.serhiileniv.order.repository.TradingPairRepository;
import org.serhiileniv.order.service.OrderMatchingEngine;
import org.serhiileniv.order.service.OutboxService;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.serhiileniv.order.property.OrderArbitraries.SYMBOL;
import static org.serhiileniv.order.property.OrderArbitraries.USER_POOL;

/**
 * Property tests on the full matching engine cycle.
 *
 * All collaborators (repository, wallet client, outbox, trading-pair lookup) are mocked
 * as no-ops. The engine is real. What we're asserting are pure matching invariants:
 *
 *   1. Conservation of quantity — Σ filled (BUYs) == Σ filled (SELLs).
 *   2. Match price always between seller's limit and buyer's limit.
 *   3. STP — no produced match has buyer.userId == seller.userId.
 *   4. filled never exceeds total — no over-filling under any sequence.
 *   5. Cancelled orders never produce fills.
 */
class OrderMatchingEnginePropertyTest {

    private OrderMatchingEngine engine;
    private OrderBookManager bookManager;
    private SymbolOrderBook book;

    private OrderMatchingEngine setup() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        bookManager = new OrderBookManager(registry);
        book = bookManager.getOrCreate(SYMBOL);

        OrderRepository orderRepo  = Mockito.mock(OrderRepository.class);
        TradingPairRepository pairs = Mockito.mock(TradingPairRepository.class);
        WalletClient wallet        = Mockito.mock(WalletClient.class);
        OutboxService outbox       = Mockito.mock(OutboxService.class);
        TradingMetrics metrics     = new TradingMetrics(registry);

        Mockito.when(pairs.findById(ArgumentMatchers.any())).thenReturn(Optional.empty());

        return new OrderMatchingEngine(orderRepo, bookManager, wallet, pairs, metrics, outbox);
    }

    /** Replays a sequence: for each order, add it to the book then run the matching cycle. */
    private List<OrderMatchedEvent> runSequence(List<Order> orders) {
        engine = setup();
        List<OrderMatchedEvent> all = new ArrayList<>();
        for (Order o : orders) {
            book.add(o);
            all.addAll(engine.matchOrder(o));
        }
        return all;
    }

    // ───── Properties ─────

    @Property(tries = 200)
    void conservationOfQuantity(@ForAll("orderSequence") List<Order> orders) {
        runSequence(orders);

        BigDecimal totalBuyFilled = orders.stream()
                .filter(o -> o.getSide() == OrderSide.BUY)
                .map(Order::getFilledQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSellFilled = orders.stream()
                .filter(o -> o.getSide() == OrderSide.SELL)
                .map(Order::getFilledQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        assertThat(totalBuyFilled)
                .as("Σ BUY fills should equal Σ SELL fills (conservation)")
                .isEqualByComparingTo(totalSellFilled);
    }

    @Property(tries = 200)
    void matchPriceWithinSellerAndBuyerLimits(@ForAll("orderSequence") List<Order> orders) {
        List<OrderMatchedEvent> matches = runSequence(orders);

        for (OrderMatchedEvent m : matches) {
            BigDecimal matchPrice = m.getPrice();
            if (m.getSellerLimitPrice() != null) {
                assertThat(matchPrice)
                        .as("match price (%s) must be ≥ seller's limit (%s)",
                                matchPrice, m.getSellerLimitPrice())
                        .isGreaterThanOrEqualTo(m.getSellerLimitPrice());
            }
            if (m.getBuyerLimitPrice() != null) {
                assertThat(matchPrice)
                        .as("match price (%s) must be ≤ buyer's limit (%s)",
                                matchPrice, m.getBuyerLimitPrice())
                        .isLessThanOrEqualTo(m.getBuyerLimitPrice());
            }
        }
    }

    @Property(tries = 200)
    void stpNeverProducesSameUserMatch(@ForAll("orderSequence") List<Order> orders) {
        List<OrderMatchedEvent> matches = runSequence(orders);

        for (OrderMatchedEvent m : matches) {
            assertThat(m.getBuyerUserId())
                    .as("STP: a match must never have the same buyer and seller")
                    .isNotEqualTo(m.getSellerUserId());
        }
    }

    @Property(tries = 200)
    void filledNeverExceedsQuantity(@ForAll("orderSequence") List<Order> orders) {
        runSequence(orders);

        for (Order o : orders) {
            assertThat(o.getFilledQuantity())
                    .as("filled (%s) must never exceed total quantity (%s) for order %s",
                            o.getFilledQuantity(), o.getQuantity(), o.getId())
                    .isLessThanOrEqualTo(o.getQuantity());
        }
    }

    @Property(tries = 200)
    void fullyFilledOrdersHaveFilledStatus(@ForAll("orderSequence") List<Order> orders) {
        runSequence(orders);

        for (Order o : orders) {
            if (o.getFilledQuantity().compareTo(o.getQuantity()) == 0
                    && o.getFilledQuantity().compareTo(BigDecimal.ZERO) > 0) {
                assertThat(o.getStatus())
                        .as("order %s is fully filled but status is %s", o.getId(), o.getStatus())
                        .isEqualTo(OrderStatus.FILLED);
            }
        }
    }

    @Property(tries = 200)
    void matchPriceEqualsMakerPrice(@ForAll("orderSequence") List<Order> orders) {
        // Every match should execute at the resting (maker) order's price —
        // price improvement always goes to the incoming taker.
        engine = setup();
        for (Order o : orders) {
            // Before adding this order: snapshot what's already in the book.
            // If this order matches anything, that something is by definition the maker.
            List<OrderMatchedEvent> matches = engine.matchOrder(addedToBook(o));
            for (OrderMatchedEvent m : matches) {
                BigDecimal makerPrice = (o.getSide() == OrderSide.BUY)
                        ? m.getSellerLimitPrice()
                        : m.getBuyerLimitPrice();
                if (makerPrice != null) {
                    assertThat(m.getPrice())
                            .as("Match price (%s) must equal maker's limit (%s) — price improvement to taker",
                                    m.getPrice(), makerPrice)
                            .isEqualByComparingTo(makerPrice);
                }
            }
        }
    }

    private Order addedToBook(Order o) {
        book.add(o);
        return o;
    }

    @Property(tries = 200)
    void cancelledOrderDoesNotFillAfterCancellation(@ForAll("orderSequence") List<Order> orders) {
        engine = setup();
        if (orders.isEmpty()) return;

        // Run first half of the sequence
        int half = Math.max(1, orders.size() / 2);
        for (int i = 0; i < half; i++) {
            book.add(orders.get(i));
            engine.matchOrder(orders.get(i));
        }

        // Cancel the first still-open order, capture its fill at the moment of cancellation
        Order victim = orders.subList(0, half).stream()
                .filter(o -> o.getStatus() == OrderStatus.PENDING
                          || o.getStatus() == OrderStatus.PARTIALLY_FILLED)
                .findFirst().orElse(null);
        if (victim == null) return;

        BigDecimal filledAtCancel = victim.getFilledQuantity();
        victim.setStatus(OrderStatus.CANCELLED);
        book.remove(victim);

        // Run the rest of the sequence
        for (int i = half; i < orders.size(); i++) {
            book.add(orders.get(i));
            engine.matchOrder(orders.get(i));
        }

        assertThat(victim.getFilledQuantity())
                .as("Cancelled order %s gained additional fills after cancellation (was %s, now %s)",
                        victim.getId(), filledAtCancel, victim.getFilledQuantity())
                .isEqualByComparingTo(filledAtCancel);
    }

    @Property(tries = 200)
    void partiallyFilledOrdersHavePartialStatus(@ForAll("orderSequence") List<Order> orders) {
        runSequence(orders);

        for (Order o : orders) {
            BigDecimal filled = o.getFilledQuantity();
            BigDecimal total  = o.getQuantity();
            boolean isPartiallyFilled = filled.compareTo(BigDecimal.ZERO) > 0
                    && filled.compareTo(total) < 0;

            if (isPartiallyFilled) {
                assertThat(o.getStatus())
                        .as("order %s filled %s/%s, expected PARTIALLY_FILLED, got %s",
                                o.getId(), filled, total, o.getStatus())
                        .isEqualTo(OrderStatus.PARTIALLY_FILLED);
            }
        }
    }

    // ───── Generators ─────

    @Provide
    Arbitrary<List<Order>> orderSequence() {
        // 2..15 orders; user pool is small so STP collisions occur regularly,
        // price band is narrow so crosses are common.
        return OrderArbitraries.orders().list().ofMinSize(2).ofMaxSize(15);
    }
}
