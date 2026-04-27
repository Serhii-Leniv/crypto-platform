package org.serhiileniv.marketdata.exception;

public class MarketDataNotFoundException extends RuntimeException {
    public MarketDataNotFoundException(String symbol) {
        super("Market data not found for symbol: " + symbol);
    }
}
