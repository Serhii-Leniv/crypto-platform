package org.serhiileniv.wallet.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
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
