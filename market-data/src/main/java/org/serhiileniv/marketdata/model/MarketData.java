package org.serhiileniv.marketdata.model;
import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
@Entity
@Table(name = "market_data", indexes = {
        @Index(name = "idx_symbol", columnList = "symbol"),
        @Index(name = "idx_updated_at", columnList = "updated_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketData implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, unique = true, length = 20)
    private String symbol;
    @Column(nullable = false, precision = 20, scale = 8)
    private BigDecimal lastPrice;
    @Column(name = "volume_24h", nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal volume24h = BigDecimal.ZERO;
    @Column(name = "high_24h", nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal high24h = BigDecimal.ZERO;
    @Column(name = "low_24h", nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal low24h = BigDecimal.ZERO;
    @Column(name = "price_change_24h", precision = 20, scale = 8)
    private BigDecimal priceChange24h;
    @Column(name = "price_change_percent_24h", precision = 10, scale = 2)
    private BigDecimal priceChangePercent24h;
    @Column(name = "trade_count_24h")
    private Long tradeCount24h;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
    @Column(name = "open_price_24h", precision = 20, scale = 8)
    private BigDecimal openPrice24h;

    public void updateFromTrade(BigDecimal price, BigDecimal quantity) {
        this.lastPrice = price;
        if (this.openPrice24h == null) {
            this.openPrice24h = price;
        }
        if (this.high24h == null || price.compareTo(this.high24h) > 0) {
            this.high24h = price;
        }
        if (this.low24h == null || price.compareTo(this.low24h) < 0) {
            this.low24h = price;
        }
        this.volume24h = this.volume24h.add(quantity);
        if (this.tradeCount24h == null) {
            this.tradeCount24h = 0L;
        }
        this.tradeCount24h++;
        if (this.openPrice24h.compareTo(BigDecimal.ZERO) > 0) {
            this.priceChange24h = price.subtract(this.openPrice24h);
            this.priceChangePercent24h = this.priceChange24h
                    .divide(this.openPrice24h, 4, java.math.RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
        }
    }

    public void resetDailyStats() {
        this.openPrice24h = this.lastPrice;
        this.high24h = this.lastPrice;
        this.low24h = this.lastPrice;
        this.volume24h = BigDecimal.ZERO;
        this.tradeCount24h = 0L;
        this.priceChange24h = BigDecimal.ZERO;
        this.priceChangePercent24h = BigDecimal.ZERO;
    }
}
