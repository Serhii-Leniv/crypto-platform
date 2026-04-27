package org.serhiileniv.order.dto;

import jakarta.validation.constraints.*;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderType;
import java.math.BigDecimal;

public record OrderRequest(
        @NotBlank(message = "Symbol is required") @Pattern(regexp = "^[A-Z]{3,6}[/-][A-Z]{3,6}$", message = "Symbol must be in format XXX/XXX or XXX-XXX") String symbol,
        @NotNull(message = "Order type is required") OrderType orderType,
        @NotNull(message = "Order side is required") OrderSide side,
        @DecimalMin(value = "0.00000001", message = "Price must be greater than 0") BigDecimal price,
        @NotNull(message = "Quantity is required") @DecimalMin(value = "0.00000001", message = "Quantity must be greater than 0") BigDecimal quantity) {
    public OrderRequest {
        if (orderType == OrderType.LIMIT && (price == null || price.compareTo(BigDecimal.ZERO) <= 0)) {
            throw new IllegalArgumentException("LIMIT orders must have a valid price");
        }
    }
}
