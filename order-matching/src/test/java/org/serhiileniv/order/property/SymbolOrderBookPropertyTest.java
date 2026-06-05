package org.serhiileniv.order.property;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Arbitraries;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.orderbook.SymbolOrderBook;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.serhiileniv.order.property.OrderArbitraries.SYMBOL;
import static org.serhiileniv.order.property.OrderArbitraries.USER_POOL;
import static org.serhiileniv.order.property.OrderArbitraries.orders;
import static org.serhiileniv.order.property.OrderArbitraries.ordersByUsers;
import static org.serhiileniv.order.property.OrderArbitraries.newOrder;

/**
 * Property tests on the in-memory order book.
 *
 * These exercise the book's pure data-structure contract without dragging in the
 * matching engine, wallet client, or any Spring context. Failures here mean the
 * book itself is wrong, independent of how it's used.
 */
class SymbolOrderBookPropertyTest {

    @Property(tries = 500)
    void addThenRemoveIsEmpty(@ForAll("orders") Order order) {
        SymbolOrderBook book = new SymbolOrderBook(SYMBOL);

        book.add(order);
        book.remove(order);

        assertThat(book.getOrders(order.getSide())).isEmpty();
    }

    @Property(tries = 500)
    void addingNOrdersOfSameSideProducesNVisibleOrders(@ForAll("ordersList") List<Order> orders) {
        SymbolOrderBook book = new SymbolOrderBook(SYMBOL);

        // Force all to the same side so we don't lose any to the wrong half-book.
        List<Order> uniformSide = orders.stream()
                .map(o -> newOrder(OrderSide.BUY, o.getUserId(), o.getPrice(), o.getQuantity()))
                .toList();
        uniformSide.forEach(book::add);

        assertThat(book.getOrders(OrderSide.BUY)).hasSize(uniformSide.size());
    }

    @Property(tries = 500)
    void bestOppositePriceForBuyIsMinAsk(@ForAll("sellOrders") List<Order> sells) {
        SymbolOrderBook book = new SymbolOrderBook(SYMBOL);
        sells.forEach(book::add);

        BigDecimal expectedMin = sells.stream()
                .map(Order::getPrice)
                .min(BigDecimal::compareTo)
                .orElse(null);

        assertThat(book.bestOppositePrice(OrderSide.BUY))
                .isEqualByComparingTo(expectedMin);
    }

    @Property(tries = 500)
    void bestOppositePriceForSellIsMaxBid(@ForAll("buyOrders") List<Order> buys) {
        SymbolOrderBook book = new SymbolOrderBook(SYMBOL);
        buys.forEach(book::add);

        BigDecimal expectedMax = buys.stream()
                .map(Order::getPrice)
                .max(BigDecimal::compareTo)
                .orElse(null);

        assertThat(book.bestOppositePrice(OrderSide.SELL))
                .isEqualByComparingTo(expectedMax);
    }

    @Property(tries = 500)
    void availableCounterpartyQtyExcludesAggressorsOwnOrders(
            @ForAll("ordersFromUser1") List<Order> ownOrders) {

        SymbolOrderBook book = new SymbolOrderBook(SYMBOL);
        ownOrders.forEach(book::add);

        // Aggressor from the SAME user — STP must mean their "available" liquidity is 0.
        UUID user1 = USER_POOL.get(0);
        Order aggressor = newOrder(
                OrderSide.BUY, user1, BigDecimal.valueOf(99_999), BigDecimal.ONE);

        assertThat(book.availableCounterpartyQty(aggressor))
                .isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Property(tries = 500)
    void availableCounterpartyQtyRespectsPriceLimit(@ForAll("sellOrders") List<Order> sells) {
        SymbolOrderBook book = new SymbolOrderBook(SYMBOL);
        sells.forEach(book::add);

        // BUY aggressor at 92 000 from a DIFFERENT user can only consume sells priced <= 92 000.
        UUID buyer = USER_POOL.get(USER_POOL.size() - 1);
        BigDecimal limit = BigDecimal.valueOf(92_000);
        Order aggressor = newOrder(OrderSide.BUY, buyer, limit, BigDecimal.valueOf(1_000_000));

        BigDecimal expected = sells.stream()
                .filter(s -> !s.getUserId().equals(buyer))
                .filter(s -> s.getPrice().compareTo(limit) <= 0)
                .map(Order::getRemainingQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal actual = book.availableCounterpartyQty(aggressor);

        // availableCounterpartyQty short-circuits once it has enough — so actual ≤ expected
        // but if the full sum is also less than the aggressor's qty, the values must match exactly.
        if (expected.compareTo(aggressor.getRemainingQuantity()) <= 0) {
            assertThat(actual).isEqualByComparingTo(expected);
        } else {
            assertThat(actual).isGreaterThanOrEqualTo(aggressor.getRemainingQuantity());
        }
    }

    // ───── Generators ─────

    @Provide
    Arbitrary<Order> orders() {
        return OrderArbitraries.orders();
    }

    @Provide
    Arbitrary<List<Order>> ordersList() {
        return OrderArbitraries.orders().list().ofMinSize(1).ofMaxSize(20);
    }

    @Provide
    Arbitrary<List<Order>> sellOrders() {
        return OrderArbitraries.orders()
                .map(o -> newOrder(OrderSide.SELL, o.getUserId(), o.getPrice(), o.getQuantity()))
                .list().ofMinSize(1).ofMaxSize(15);
    }

    @Provide
    Arbitrary<List<Order>> buyOrders() {
        return OrderArbitraries.orders()
                .map(o -> newOrder(OrderSide.BUY, o.getUserId(), o.getPrice(), o.getQuantity()))
                .list().ofMinSize(1).ofMaxSize(15);
    }

    @Provide
    Arbitrary<List<Order>> ordersFromUser1() {
        return ordersByUsers(List.of(USER_POOL.get(0)))
                .list().ofMinSize(1).ofMaxSize(10);
    }
}
