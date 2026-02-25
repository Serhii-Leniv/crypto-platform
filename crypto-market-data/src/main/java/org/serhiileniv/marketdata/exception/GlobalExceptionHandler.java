package org.serhiileniv.marketdata.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;

@RestControllerAdvice
@Slf4j
@SuppressWarnings("null")
public class GlobalExceptionHandler {
    private static final URI MARKET_DATA_NOT_FOUND_TYPE = URI
            .create("https://api.crypto-exchange.com/errors/market-data-not-found");
    private static final URI INTERNAL_ERROR_TYPE = URI.create("https://api.crypto-exchange.com/errors/internal-error");

    @ExceptionHandler(MarketDataNotFoundException.class)
    public ProblemDetail handleMarketDataNotFound(MarketDataNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setType(MARKET_DATA_NOT_FOUND_TYPE);
        problem.setTitle("Market Data Not Found");
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGenericException(Exception ex) {
        log.error("Unexpected error occurred in market service: ", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                ex.getMessage() != null ? ex.getMessage() : "An unexpected error occurred");
        problem.setType(INTERNAL_ERROR_TYPE);
        problem.setTitle("Internal Server Error");
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }
}
