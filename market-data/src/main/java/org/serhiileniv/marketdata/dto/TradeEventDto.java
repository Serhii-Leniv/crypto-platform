package org.serhiileniv.marketdata.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TradeEventDto(
        UUID tradeId,
        String symbol,
        BigDecimal price,
        BigDecimal quantity,
        Instant timestamp
) {}
