package org.serhiileniv.marketdata.dto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.serhiileniv.marketdata.model.MarketData;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketDataResponse {
    private UUID id;
    private String symbol;
    private BigDecimal lastPrice;
    private BigDecimal volume24h;
    private BigDecimal high24h;
    private BigDecimal low24h;
    private BigDecimal priceChange24h;
    private BigDecimal priceChangePercent24h;
    private Long tradeCount24h;
    private LocalDateTime updatedAt;
    public static MarketDataResponse from(MarketData marketData) {
        return MarketDataResponse.builder()
                .id(marketData.getId())
                .symbol(marketData.getSymbol())
                .lastPrice(marketData.getLastPrice())
                .volume24h(marketData.getVolume24h())
                .high24h(marketData.getHigh24h())
                .low24h(marketData.getLow24h())
                .priceChange24h(marketData.getPriceChange24h())
                .priceChangePercent24h(marketData.getPriceChangePercent24h())
                .tradeCount24h(marketData.getTradeCount24h())
                .updatedAt(marketData.getUpdatedAt())
                .build();
    }
}
