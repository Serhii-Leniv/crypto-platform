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
public class OrderPlacedEvent {
    private String eventType;
    private UUID orderId;
    private UUID userId;
    private String symbol;
    private OrderType orderType;
    private OrderSide side;
    private BigDecimal price;
    private BigDecimal quantity;
    private LocalDateTime timestamp;
}
