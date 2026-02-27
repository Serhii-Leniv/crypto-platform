package org.serhiileniv.order.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.serhiileniv.order.model.OrderSide;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderCancelledEvent {
    private UUID orderId;
    private UUID userId;
    private String symbol;
    private OrderSide side;
    private BigDecimal remainingQuantity;
    private BigDecimal price;
    private String reason;
    private LocalDateTime timestamp;
}
