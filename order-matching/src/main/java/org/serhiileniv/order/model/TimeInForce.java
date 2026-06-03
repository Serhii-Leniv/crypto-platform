package org.serhiileniv.order.model;

public enum TimeInForce {
    /** Good-Till-Cancelled — default. Order rests in the book until filled or cancelled by user. */
    GTC,
    /** Immediate-Or-Cancel — match as much as possible immediately; any remainder is cancelled. */
    IOC,
    /** Fill-Or-Kill — order must fill completely in one shot or it's rejected entirely. */
    FOK,
    /** Post-Only — order must add liquidity (be a maker). Rejected if it would cross the book. */
    POST_ONLY
}
