package org.serhiileniv.wallet.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record AdminDepositRequest(
        @NotNull UUID userId,
        @NotBlank String currency,
        @NotNull @DecimalMin("0.00000001") BigDecimal amount
) {}
