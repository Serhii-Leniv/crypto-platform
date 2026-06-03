package org.serhiileniv.order.model;

public enum OrderStatus {
    /** Stop order awaiting trigger — funds locked, not yet in the matching book. */
    TRIGGER_PENDING,
    PENDING,
    PARTIALLY_FILLED,
    FILLED,
    CANCELLED
}
