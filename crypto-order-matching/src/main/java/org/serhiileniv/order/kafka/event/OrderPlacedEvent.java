package org.serhiileniv.order.kafka.event;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderPlacedEvent {
    private UUID orderId;
    private UUID userId;
    private String symbol;
    private OrderType orderType;
    private OrderSide side;
    private BigDecimal price;
    private BigDecimal quantity;
    private LocalDateTime timestamp;
}
