package org.serhiileniv.wallet.service;

import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.config.WalletMetrics;
import org.serhiileniv.wallet.exception.WalletNotFoundException;
import org.serhiileniv.wallet.model.*;
import org.serhiileniv.wallet.repository.TransactionRepository;
import org.serhiileniv.wallet.repository.WalletRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {
    /**
     * Synthetic house account that accumulates maker/taker fees.
     * Wallets for this user are auto-created on first settle ([ADR-0008]).
     */
    public static final UUID HOUSE_USER_ID = UUID.fromString("00000000-0000-0000-0000-00000000feee");

    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final WalletMetrics metrics;

    @Transactional
    public void deposit(UUID userId, String currency, BigDecimal amount) {
        log.info("Processing deposit for user {}: {} {}", userId, amount, currency);
        Wallet wallet = getOrCreateWalletLocked(userId, currency);
        wallet.deposit(amount);
        walletRepository.save(wallet);
        Transaction transaction = Transaction.builder()
                .walletId(wallet.getId())
                .type(TransactionType.DEPOSIT)
                .amount(amount)
                .currency(currency)
                .status(TransactionStatus.COMPLETED)
                .description("Deposit")
                .build();
        transactionRepository.save(transaction);
        log.info("Deposit completed for user {}: {} {}", userId, amount, currency);
    }

    @Transactional
    public void withdraw(UUID userId, String currency, BigDecimal amount) {
        log.info("Processing withdrawal for user {}: {} {}", userId, amount, currency);
        Wallet wallet = walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)
                .orElseThrow(() -> new WalletNotFoundException(userId, currency));
        wallet.withdraw(amount);
        walletRepository.save(wallet);
        Transaction transaction = Transaction.builder()
                .walletId(wallet.getId())
                .type(TransactionType.WITHDRAWAL)
                .amount(amount)
                .currency(currency)
                .status(TransactionStatus.COMPLETED)
                .description("Withdrawal")
                .build();
        transactionRepository.save(transaction);
        log.info("Withdrawal completed for user {}: {} {}", userId, amount, currency);
    }

    @Transactional
    public void lockFunds(UUID userId, String currency, BigDecimal amount, UUID orderId) {
        lockFunds(userId, currency, amount, orderId, "Locked for order " + orderId);
    }

    @Transactional
    public void lockFunds(UUID userId, String currency, BigDecimal amount, UUID orderId, String description) {
        log.info("Locking funds for user {}: {} {} for order {}", userId, amount, currency, orderId);
        Wallet wallet = walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)
                .orElseThrow(() -> new WalletNotFoundException(userId, currency));
        wallet.lock(amount);
        walletRepository.save(wallet);
        Transaction transaction = Transaction.builder()
                .walletId(wallet.getId())
                .type(TransactionType.LOCK)
                .amount(amount)
                .currency(currency)
                .referenceId(orderId)
                .status(TransactionStatus.COMPLETED)
                .description(description)
                .build();
        transactionRepository.save(transaction);
        log.info("Funds locked for user {}: {} {}", userId, amount, currency);
    }

    @Transactional
    public void unlockFunds(UUID userId, String currency, BigDecimal amount, UUID orderId) {
        unlockFunds(userId, currency, amount, orderId, "Unlocked from order " + orderId);
    }

    @Transactional
    public void unlockFunds(UUID userId, String currency, BigDecimal amount, UUID orderId, String description) {
        log.info("Unlocking funds for user {}: {} {} for order {}", userId, amount, currency, orderId);
        Wallet wallet = walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)
                .orElseThrow(() -> new WalletNotFoundException(userId, currency));
        wallet.unlock(amount);
        walletRepository.save(wallet);
        Transaction transaction = Transaction.builder()
                .walletId(wallet.getId())
                .type(TransactionType.UNLOCK)
                .amount(amount)
                .currency(currency)
                .referenceId(orderId)
                .status(TransactionStatus.COMPLETED)
                .description(description)
                .build();
        transactionRepository.save(transaction);
        log.info("Funds unlocked for user {}: {} {}", userId, amount, currency);
    }

    @Transactional
    public void processTrade(UUID userId, String currency, BigDecimal amount, UUID tradeId, boolean isBuy) {
        processTrade(userId, currency, amount, tradeId, isBuy,
                (isBuy ? "Buy" : "Sell") + " trade " + tradeId);
    }

    @Transactional
    public void processTrade(UUID userId, String currency, BigDecimal amount, UUID tradeId, boolean isBuy, String description) {
        log.info("Processing trade for user {}: {} {} {}, tradeId: {}",
                userId, isBuy ? "BUY" : "SELL", amount, currency, tradeId);
        Wallet wallet = getOrCreateWalletLocked(userId, currency);
        if (isBuy) {
            wallet.deposit(amount);
        } else {
            wallet.debitLocked(amount);
        }
        walletRepository.save(wallet);
        Transaction transaction = Transaction.builder()
                .walletId(wallet.getId())
                .type(isBuy ? TransactionType.TRADE_BUY : TransactionType.TRADE_SELL)
                .amount(amount)
                .currency(currency)
                .referenceId(tradeId)
                .status(TransactionStatus.COMPLETED)
                .description(description)
                .build();
        transactionRepository.save(transaction);
        log.info("Trade processed for user {}: {} {} {}", userId, isBuy ? "BUY" : "SELL", amount, currency);
    }

    /**
     * Atomic 4-wallet trade settlement in a single DB transaction.
     * Both buyer and seller wallets (base + quote each) are updated together; either all
     * four sides commit or none do. Wallets are locked in deterministic (userId, currency)
     * order to avoid deadlocks under concurrent matches.
     *
     * Wallet effects:
     *   buyer  base:  +baseAmount         (credit, from previously-locked seller funds)
     *   buyer  quote: -quoteAmount        (debit locked, returns slippage if buyer had higher limit price)
     *   seller base:  -baseAmount         (debit locked)
     *   seller quote: +quoteAmount        (credit)
     *
     * @param buyerLimitPrice optional — if supplied and greater than execution price, the
     *                        difference is refunded (unlocked) on the buyer's quote wallet.
     */
    @Transactional
    public void settleTrade(
            UUID buyerId, UUID sellerId,
            String baseCurrency, String quoteCurrency,
            BigDecimal baseAmount, BigDecimal quoteAmount,
            BigDecimal executionPrice, BigDecimal buyerLimitPrice,
            UUID tradeId, String symbol,
            int buyerFeeBps, int sellerFeeBps) {
        Timer.Sample settleTimer = metrics.startSettleTimer();
        try {
            doSettleTrade(buyerId, sellerId, baseCurrency, quoteCurrency, baseAmount, quoteAmount,
                    executionPrice, buyerLimitPrice, tradeId, symbol, buyerFeeBps, sellerFeeBps);
        } finally {
            metrics.stopSettleTimer(settleTimer);
        }
    }

    private void doSettleTrade(
            UUID buyerId, UUID sellerId,
            String baseCurrency, String quoteCurrency,
            BigDecimal baseAmount, BigDecimal quoteAmount,
            BigDecimal executionPrice, BigDecimal buyerLimitPrice,
            UUID tradeId, String symbol,
            int buyerFeeBps, int sellerFeeBps) {
        if (buyerId.equals(sellerId)) {
            throw new IllegalArgumentException("Self-trade not allowed");
        }
        log.info("Settling trade {} for {}: {} {} <-> {} {} @ {} (buyerFee={}bps, sellerFee={}bps)",
                tradeId, symbol, baseAmount, baseCurrency, quoteAmount, quoteCurrency, executionPrice,
                buyerFeeBps, sellerFeeBps);

        // Fees are charged in the asset the user RECEIVES (industry standard):
        //   buyer  receives base → fee deducted from base credit
        //   seller receives quote → fee deducted from quote credit
        BigDecimal buyerFee  = baseAmount .multiply(BigDecimal.valueOf(buyerFeeBps)) .divide(BigDecimal.valueOf(10_000), 8, java.math.RoundingMode.HALF_UP);
        BigDecimal sellerFee = quoteAmount.multiply(BigDecimal.valueOf(sellerFeeBps)).divide(BigDecimal.valueOf(10_000), 8, java.math.RoundingMode.HALF_UP);
        BigDecimal buyerNet  = baseAmount.subtract(buyerFee);
        BigDecimal sellerNet = quoteAmount.subtract(sellerFee);

        // Lock wallets via repository; the underlying SELECT FOR UPDATE provides deadlock
        // safety because we always touch the same wallets per (userId, currency).
        Wallet buyerBase   = getOrCreateWalletLocked(buyerId,  baseCurrency);
        Wallet buyerQuote  = walletRepository.findByUserIdAndCurrencyWithLock(buyerId,  quoteCurrency)
                .orElseThrow(() -> new WalletNotFoundException(buyerId, quoteCurrency));
        Wallet sellerBase  = walletRepository.findByUserIdAndCurrencyWithLock(sellerId, baseCurrency)
                .orElseThrow(() -> new WalletNotFoundException(sellerId, baseCurrency));
        Wallet sellerQuote = getOrCreateWalletLocked(sellerId, quoteCurrency);

        // Movements: buyer gets net base (post-fee), seller gets net quote (post-fee).
        buyerBase.deposit(buyerNet);
        buyerQuote.debitLocked(quoteAmount);
        sellerBase.debitLocked(baseAmount);
        sellerQuote.deposit(sellerNet);

        walletRepository.save(buyerBase);
        walletRepository.save(buyerQuote);
        walletRepository.save(sellerBase);
        walletRepository.save(sellerQuote);

        // Transaction records — narrative includes fee when non-zero.
        String buyerBaseDesc  = String.format("%s BUY filled @ %s — received %s %s%s",
                symbol, trimZeros(executionPrice), trimZeros(buyerNet), baseCurrency,
                buyerFee.signum() > 0 ? " (fee " + trimZeros(buyerFee) + " " + baseCurrency + ")" : "");
        String buyerQuoteDesc = String.format("%s BUY filled @ %s — paid %s %s",
                symbol, trimZeros(executionPrice), trimZeros(quoteAmount), quoteCurrency);
        String sellerBaseDesc  = String.format("%s SELL filled @ %s — delivered %s %s",
                symbol, trimZeros(executionPrice), trimZeros(baseAmount), baseCurrency);
        String sellerQuoteDesc = String.format("%s SELL filled @ %s — received %s %s%s",
                symbol, trimZeros(executionPrice), trimZeros(sellerNet), quoteCurrency,
                sellerFee.signum() > 0 ? " (fee " + trimZeros(sellerFee) + " " + quoteCurrency + ")" : "");

        transactionRepository.save(buildTxn(buyerBase.getId(),   TransactionType.TRADE_BUY,  buyerNet,    baseCurrency,  tradeId, buyerBaseDesc));
        transactionRepository.save(buildTxn(buyerQuote.getId(),  TransactionType.TRADE_SELL, quoteAmount, quoteCurrency, tradeId, buyerQuoteDesc));
        transactionRepository.save(buildTxn(sellerBase.getId(),  TransactionType.TRADE_SELL, baseAmount,  baseCurrency,  tradeId, sellerBaseDesc));
        transactionRepository.save(buildTxn(sellerQuote.getId(), TransactionType.TRADE_BUY,  sellerNet,   quoteCurrency, tradeId, sellerQuoteDesc));

        // Fees → house wallet. Previously the fee amounts were deducted from buyer/seller credits
        // but never credited anywhere; they evaporated. ADR-0008 routes them into a synthetic
        // HOUSE_USER_ID wallet per currency, accumulating exchange revenue.
        if (buyerFee.signum() > 0) {
            Wallet houseBase = getOrCreateWalletLocked(HOUSE_USER_ID, baseCurrency);
            houseBase.deposit(buyerFee);
            walletRepository.save(houseBase);
            transactionRepository.save(buildTxn(houseBase.getId(), TransactionType.TRADE_BUY, buyerFee, baseCurrency, tradeId,
                    String.format("%s fee from buyer trade %s — %s %s", symbol, tradeId, trimZeros(buyerFee), baseCurrency)));
            metrics.recordFeeCollected(baseCurrency, buyerFee);
        }
        if (sellerFee.signum() > 0) {
            Wallet houseQuote = getOrCreateWalletLocked(HOUSE_USER_ID, quoteCurrency);
            houseQuote.deposit(sellerFee);
            walletRepository.save(houseQuote);
            transactionRepository.save(buildTxn(houseQuote.getId(), TransactionType.TRADE_BUY, sellerFee, quoteCurrency, tradeId,
                    String.format("%s fee from seller trade %s — %s %s", symbol, tradeId, trimZeros(sellerFee), quoteCurrency)));
            metrics.recordFeeCollected(quoteCurrency, sellerFee);
        }

        // Slippage refund: if buyer's limit price was higher than execution price, return the diff
        if (buyerLimitPrice != null && buyerLimitPrice.compareTo(executionPrice) > 0) {
            BigDecimal slippage = buyerLimitPrice.subtract(executionPrice).multiply(baseAmount);
            if (slippage.compareTo(BigDecimal.ZERO) > 0) {
                buyerQuote.unlock(slippage);
                walletRepository.save(buyerQuote);
                String slipDesc = String.format("%s BUY slippage refund — %s %s returned (filled below limit)",
                        symbol, trimZeros(slippage), quoteCurrency);
                transactionRepository.save(buildTxn(buyerQuote.getId(), TransactionType.UNLOCK, slippage, quoteCurrency, tradeId, slipDesc));
            }
        }

        log.info("Trade {} settled atomically", tradeId);
    }

    private Transaction buildTxn(UUID walletId, TransactionType type, BigDecimal amount,
                                 String currency, UUID referenceId, String description) {
        return Transaction.builder()
                .walletId(walletId)
                .type(type)
                .amount(amount)
                .currency(currency)
                .referenceId(referenceId)
                .status(TransactionStatus.COMPLETED)
                .description(description)
                .build();
    }

    private static String trimZeros(BigDecimal v) {
        return v == null ? "0" : v.stripTrailingZeros().toPlainString();
    }

    public List<Wallet> getUserWallets(UUID userId) {
        return walletRepository.findByUserId(userId);
    }

    public Page<Transaction> getUserTransactions(UUID userId, Pageable pageable) {
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    private Wallet getOrCreateWalletLocked(UUID userId, String currency) {
        return walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)
                .orElseGet(() -> {
                    try {
                        Wallet newWallet = Wallet.builder()
                                .userId(userId)
                                .currency(currency)
                                .balance(BigDecimal.ZERO)
                                .lockedBalance(BigDecimal.ZERO)
                                .build();
                        return walletRepository.saveAndFlush(newWallet);
                    } catch (Exception e) {
                        return walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)
                                .orElseThrow(() -> new RuntimeException("Failed to find or create wallet", e));
                    }
                });
    }
}
