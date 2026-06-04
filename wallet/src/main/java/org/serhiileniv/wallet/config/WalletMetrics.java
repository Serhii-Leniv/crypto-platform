package org.serhiileniv.wallet.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class WalletMetrics {

    private final MeterRegistry registry;

    public WalletMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public Timer.Sample startSettleTimer() {
        return Timer.start(registry);
    }

    public void stopSettleTimer(Timer.Sample sample) {
        sample.stop(Timer.builder("wallet.settle.duration")
                .description("WalletService.settleTrade end-to-end duration")
                .publishPercentiles(0.5, 0.95, 0.99)
                // Emit Prometheus _bucket series too, so histogram_quantile() in Grafana
                // can aggregate across instances.
                .publishPercentileHistogram()
                .register(registry));
    }

    public void recordFeeCollected(String currency, BigDecimal amount) {
        Counter.builder("wallet.fees.collected")
                .description("Fees credited to the house wallet, per currency")
                .tag("currency", currency)
                .register(registry)
                .increment(amount.doubleValue());
    }

    public void recordLock(String currency) {
        Counter.builder("wallet.lock")
                .description("Lock operations on user wallets")
                .tag("currency", currency)
                .register(registry)
                .increment();
    }

    public void recordUnlock(String currency) {
        Counter.builder("wallet.unlock")
                .description("Unlock operations on user wallets")
                .tag("currency", currency)
                .register(registry)
                .increment();
    }
}
