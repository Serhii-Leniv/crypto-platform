package org.serhiileniv.order.dto;
import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.model.TimeInForce;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
public record OrderResponse(
        UUID id,
        UUID userId,
        String symbol,
        OrderType orderType,
        OrderSide side,
        BigDecimal price,
        BigDecimal quantity,
        BigDecimal filledQuantity,
        OrderStatus status,
        TimeInForce timeInForce,
        BigDecimal triggerPrice,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
    public static OrderResponse fromEntity(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getUserId(),
                order.getSymbol(),
                order.getOrderType(),
                order.getSide(),
                order.getPrice(),
                order.getQuantity(),
                order.getFilledQuantity(),
                order.getStatus(),
                order.getTimeInForce(),
                order.getTriggerPrice(),
                order.getCreatedAt(),
                order.getUpdatedAt());
    }
}
