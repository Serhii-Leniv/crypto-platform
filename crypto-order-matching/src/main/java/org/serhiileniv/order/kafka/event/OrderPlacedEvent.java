package org.serhiileniv.order.kafka.event;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
public class OrderPlacedEvent {
    private String eventType = "ORDER_PLACED";
    private UUID orderId;
    private UUID userId;
    private String symbol;
    private OrderType orderType;
    private OrderSide side;
    private BigDecimal price;
    private BigDecimal quantity;
    private LocalDateTime timestamp;

    public OrderPlacedEvent(UUID orderId, UUID userId, String symbol, OrderType orderType,
                            OrderSide side, BigDecimal price, BigDecimal quantity, LocalDateTime timestamp) {
        this.orderId = orderId;
        this.userId = userId;
        this.symbol = symbol;
        this.orderType = orderType;
        this.side = side;
        this.price = price;
        this.quantity = quantity;
        this.timestamp = timestamp;
        this.eventType = "ORDER_PLACED";
    }
}
