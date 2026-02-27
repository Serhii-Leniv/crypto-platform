package org.serhiileniv.wallet.exception;

import java.util.UUID;

public class WalletNotFoundException extends RuntimeException {
    public WalletNotFoundException(UUID userId, String currency) {
        super("Wallet not found for user " + userId + " and currency " + currency);
    }
}
