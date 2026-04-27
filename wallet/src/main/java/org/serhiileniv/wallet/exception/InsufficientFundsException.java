package org.serhiileniv.wallet.exception;

import java.math.BigDecimal;

public class InsufficientFundsException extends RuntimeException {
    public InsufficientFundsException(String currency, BigDecimal requested, BigDecimal available) {
        super(String.format("Insufficient %s funds: requested %.8f, available %.8f",
                currency, requested, available));
    }

    public InsufficientFundsException(String message) {
        super(message);
    }
}
