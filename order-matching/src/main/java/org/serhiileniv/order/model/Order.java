package org.serhiileniv.order.model;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.domain.Persistable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_symbol_status", columnList = "symbol, status"),
        @Index(name = "idx_user_id", columnList = "user_id"),
        @Index(name = "idx_created_at", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order implements Persistable<UUID> {
    @Id
    private UUID id;

    /**
     * OrderService now pre-generates the order ID so it can be passed to wallet-service for the
     * synchronous fund lock before the row is persisted. With a non-null @Id, Spring Data's
     * default save() would treat the entity as detached and try MERGE (failing because the row
     * doesn't exist yet). Implementing Persistable lets us tell Spring it's new until the first
     * load/persist sets isNew=false, which routes save() through INSERT.
     */
    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override
    public UUID getId() { return id; }

    @Override
    public boolean isNew() { return isNew; }

    @PostPersist @PostLoad
    void markPersisted() { this.isNew = false; }
    @Column(nullable = false)
    private UUID userId;
    @Column(nullable = false, length = 20)
    private String symbol; 
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private OrderType orderType;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 4)
    private OrderSide side;
    @Column(precision = 20, scale = 8)
    private BigDecimal price; 
    @Column(nullable = false, precision = 20, scale = 8)
    private BigDecimal quantity;
    @Column(nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal filledQuantity = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @Column(name = "time_in_force", nullable = false, length = 10)
    @Builder.Default
    private TimeInForce timeInForce = TimeInForce.GTC;
    /** Activation level for STOP_LIMIT orders; null for plain LIMIT/MARKET. */
    @Column(name = "trigger_price", precision = 20, scale = 8)
    private BigDecimal triggerPrice;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    public BigDecimal getRemainingQuantity() {
        return quantity.subtract(filledQuantity);
    }
    public boolean isFullyFilled() {
        return filledQuantity.compareTo(quantity) >= 0;
    }
    public void fill(BigDecimal fillQuantity) {
        this.filledQuantity = this.filledQuantity.add(fillQuantity);
        if (isFullyFilled()) {
            this.status = OrderStatus.FILLED;
        } else if (this.filledQuantity.compareTo(BigDecimal.ZERO) > 0) {
            this.status = OrderStatus.PARTIALLY_FILLED;
        }
    }
}
