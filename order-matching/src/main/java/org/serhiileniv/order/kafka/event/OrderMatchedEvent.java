package org.serhiileniv.order.kafka.event;

import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
public class OrderMatchedEvent {
    private String eventType = "ORDER_MATCHED";
    private UUID tradeId;
    private UUID buyOrderId;
    private UUID sellOrderId;
    private String symbol;
    private BigDecimal price;
    private BigDecimal quantity;
    private UUID buyerUserId;
    private UUID sellerUserId;
    private LocalDateTime timestamp;

    public OrderMatchedEvent(UUID tradeId, UUID buyOrderId, UUID sellOrderId, String symbol,
                             BigDecimal price, BigDecimal quantity,
                             UUID buyerUserId, UUID sellerUserId, LocalDateTime timestamp) {
        this.tradeId = tradeId;
        this.buyOrderId = buyOrderId;
        this.sellOrderId = sellOrderId;
        this.symbol = symbol;
        this.price = price;
        this.quantity = quantity;
        this.buyerUserId = buyerUserId;
        this.sellerUserId = sellerUserId;
        this.timestamp = timestamp;
        this.eventType = "ORDER_MATCHED";
    }
}
