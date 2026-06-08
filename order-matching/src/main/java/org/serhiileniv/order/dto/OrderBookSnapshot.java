package org.serhiileniv.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderBookSnapshot(
        String symbol,
        List<PriceLevel> bids,
        List<PriceLevel> asks,
        Instant timestamp
) {
    public record PriceLevel(BigDecimal price, BigDecimal quantity, int orderCount) {}
}
