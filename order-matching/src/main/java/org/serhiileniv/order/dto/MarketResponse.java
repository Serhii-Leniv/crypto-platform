package org.serhiileniv.order.dto;

import org.serhiileniv.order.model.TradingPair;

import java.math.BigDecimal;

public record MarketResponse(
        String symbol,
        String baseCurrency,
        String quoteCurrency,
        BigDecimal minQuantity,
        BigDecimal tickSize,
        String status,
        Integer makerFeeBps,
        Integer takerFeeBps
) {
    public static MarketResponse fromEntity(TradingPair p) {
        return new MarketResponse(
                p.getSymbol(),
                p.getBaseCurrency(),
                p.getQuoteCurrency(),
                p.getMinQuantity(),
                p.getTickSize(),
                p.getStatus(),
                p.getMakerFeeBps(),
                p.getTakerFeeBps()
        );
    }
}
