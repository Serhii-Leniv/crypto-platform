package org.serhiileniv.order.exception;

import java.util.UUID;

public class UnauthorizedOrderAccessException extends RuntimeException {
    public UnauthorizedOrderAccessException(UUID orderId) {
        super("Access denied to order: " + orderId);
    }
}
