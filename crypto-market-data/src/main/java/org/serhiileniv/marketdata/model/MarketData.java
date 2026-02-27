package org.serhiileniv.marketdata.model;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
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
    @Column(nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal volume24h = BigDecimal.ZERO;
    @Column(nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal high24h = BigDecimal.ZERO;
    @Column(nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal low24h = BigDecimal.ZERO;
    @Column(precision = 20, scale = 8)
    private BigDecimal priceChange24h;
    @Column(precision = 10, scale = 2)
    private BigDecimal priceChangePercent24h;
    @Column
    private Long tradeCount24h;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    public void updateFromTrade(BigDecimal price, BigDecimal quantity) {
        BigDecimal oldPrice = this.lastPrice;
        this.lastPrice = price;
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
        if (oldPrice != null && oldPrice.compareTo(BigDecimal.ZERO) > 0) {
            this.priceChange24h = price.subtract(oldPrice);
            this.priceChangePercent24h = priceChange24h
                    .divide(oldPrice, 4, java.math.RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
        }
    }
}
