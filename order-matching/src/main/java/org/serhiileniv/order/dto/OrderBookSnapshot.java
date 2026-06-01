package org.serhiileniv.order.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderBookSnapshot(
        String symbol,
        List<PriceLevel> bids,
        List<PriceLevel> asks,
        LocalDateTime timestamp
) {
    public record PriceLevel(BigDecimal price, BigDecimal quantity, int orderCount) {}
}
