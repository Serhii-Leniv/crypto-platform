package org.serhiileniv.wallet.dto;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WithdrawRequest {
    @NotBlank(message = "Currency is required")
    @Pattern(regexp = "^[A-Z]{3,10}$", message = "Currency must be uppercase letters (3-10 chars)")
    private String currency;
    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.00000001", message = "Amount must be positive")
    @DecimalMax(value = "1000000000", message = "Amount too large")
    private BigDecimal amount;
}
