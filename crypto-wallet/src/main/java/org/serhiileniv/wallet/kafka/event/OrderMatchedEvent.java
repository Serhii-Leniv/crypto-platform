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
public class OrderMatchedEvent {
    private UUID tradeId;
    private UUID buyOrderId;
    private UUID sellOrderId;
    private String symbol;
    private BigDecimal price;
    private BigDecimal quantity;
    private UUID buyerUserId;
    private UUID sellerUserId;
    private LocalDateTime timestamp;
}
