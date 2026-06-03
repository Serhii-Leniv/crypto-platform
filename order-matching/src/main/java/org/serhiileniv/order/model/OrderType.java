package org.serhiileniv.order.model;

public enum OrderType {
    LIMIT,
    MARKET,
    /** Limit order that activates only after the market crosses {@code triggerPrice}. */
    STOP_LIMIT
}
