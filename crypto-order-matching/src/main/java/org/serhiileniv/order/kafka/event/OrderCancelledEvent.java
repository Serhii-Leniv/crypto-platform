package org.serhiileniv.order.kafka.event;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.serhiileniv.order.model.OrderSide;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
public class OrderCancelledEvent {
    private String eventType = "ORDER_CANCELLED";
    private UUID orderId;
    private UUID userId;
    private String symbol;
    private OrderSide side;
    private BigDecimal remainingQuantity;
    private BigDecimal price;
    private String reason;
    private LocalDateTime timestamp;

    public OrderCancelledEvent(UUID orderId, UUID userId, String symbol, OrderSide side,
                               BigDecimal remainingQuantity, BigDecimal price,
                               String reason, LocalDateTime timestamp) {
        this.orderId = orderId;
        this.userId = userId;
        this.symbol = symbol;
        this.side = side;
        this.remainingQuantity = remainingQuantity;
        this.price = price;
        this.reason = reason;
        this.timestamp = timestamp;
        this.eventType = "ORDER_CANCELLED";
    }
}
