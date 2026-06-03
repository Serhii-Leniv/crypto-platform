package org.serhiileniv.order.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "trading_pairs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TradingPair {

    @Id
    @Column(length = 20)
    private String symbol;

    @Column(name = "base_currency", nullable = false, length = 10)
    private String baseCurrency;

    @Column(name = "quote_currency", nullable = false, length = 10)
    private String quoteCurrency;

    @Column(name = "min_quantity", nullable = false, precision = 20, scale = 8)
    private BigDecimal minQuantity;

    @Column(name = "tick_size", nullable = false, precision = 20, scale = 8)
    private BigDecimal tickSize;

    @Column(nullable = false, length = 20)
    private String status;

    /** Fees in basis points (1 bp = 0.01%). Maker provides liquidity, taker removes it. */
    @Column(name = "maker_fee_bps", nullable = false)
    @Builder.Default
    private Integer makerFeeBps = 10;

    @Column(name = "taker_fee_bps", nullable = false)
    @Builder.Default
    private Integer takerFeeBps = 20;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public boolean isActive() {
        return "ACTIVE".equals(status);
    }
}
