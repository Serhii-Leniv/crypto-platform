package org.serhiileniv.order.property;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.model.TimeInForce;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Shared jqwik generators for matching-engine property tests.
 *
 * Design notes:
 *   - Users come from a small fixed pool (4 IDs). With ~50% probability any two random
 *     orders share a user, which is what we need to actually exercise STP code paths.
 *     Generating fresh UUIDs each time would make STP collisions vanishingly rare.
 *   - Prices live in a narrow integer band (90 000 – 100 000) so orders are likely to
 *     cross. Wide-band prices would mostly add to the book without matching anything,
 *     reducing the test's ability to stress the matching logic.
 *   - Quantities are small fractional values; what matters is the structural invariants,
 *     not absolute magnitudes.
 */
public final class OrderArbitraries {

    static final List<UUID> USER_POOL = List.of(
            UUID.fromString("11111111-1111-4111-8111-111111111111"),
            UUID.fromString("22222222-2222-4222-8222-222222222222"),
            UUID.fromString("33333333-3333-4333-8333-333333333333"),
            UUID.fromString("44444444-4444-4444-8444-444444444444")
    );

    public static final String SYMBOL = "BTC-USDT";

    private OrderArbitraries() {}

    public static Arbitrary<OrderSide> sides() {
        return Arbitraries.of(OrderSide.BUY, OrderSide.SELL);
    }

    public static Arbitrary<UUID> userIds() {
        return Arbitraries.of(USER_POOL);
    }

    /** Limit prices in a band tight enough that crosses are common. */
    public static Arbitrary<BigDecimal> prices() {
        return Arbitraries.integers().between(90_000, 100_000)
                .map(BigDecimal::valueOf);
    }

    /** Quantities in (0, 1.0] — five decimal places, never zero. */
    public static Arbitrary<BigDecimal> quantities() {
        return Arbitraries.integers().between(1, 100_000)
                .map(i -> new BigDecimal(i).movePointLeft(5));
    }

    public static Arbitrary<Order> orders() {
        return Combinators.combine(sides(), userIds(), prices(), quantities())
                .as((side, userId, price, qty) -> newOrder(side, userId, price, qty));
    }

    /** Orders whose userId is one of the given users — used to stress STP. */
    public static Arbitrary<Order> ordersByUsers(List<UUID> allowedUsers) {
        return Combinators.combine(
                sides(), Arbitraries.of(allowedUsers), prices(), quantities()
        ).as((side, userId, price, qty) -> newOrder(side, userId, price, qty));
    }

    public static Order newOrder(OrderSide side, UUID userId, BigDecimal price, BigDecimal qty) {
        return Order.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .symbol(SYMBOL)
                .orderType(OrderType.LIMIT)
                .side(side)
                .price(price)
                .quantity(qty)
                .filledQuantity(BigDecimal.ZERO)
                .timeInForce(TimeInForce.GTC)
                .status(OrderStatus.PENDING)
                .build();
    }
}
