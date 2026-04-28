package org.serhiileniv.wallet.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.exception.WalletNotFoundException;
import org.serhiileniv.wallet.model.*;
import org.serhiileniv.wallet.repository.TransactionRepository;
import org.serhiileniv.wallet.repository.WalletRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;

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
                .description("Locked for order " + orderId)
                .build();
        transactionRepository.save(transaction);
        log.info("Funds locked for user {}: {} {}", userId, amount, currency);
    }

    @Transactional
    public void unlockFunds(UUID userId, String currency, BigDecimal amount, UUID orderId) {
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
                .description("Unlocked from order " + orderId)
                .build();
        transactionRepository.save(transaction);
        log.info("Funds unlocked for user {}: {} {}", userId, amount, currency);
    }

    @Transactional
    public void processTrade(UUID userId, String currency, BigDecimal amount, UUID tradeId, boolean isBuy) {
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
                .description((isBuy ? "Buy" : "Sell") + " trade " + tradeId)
                .build();
        transactionRepository.save(transaction);
        log.info("Trade processed for user {}: {} {} {}", userId, isBuy ? "BUY" : "SELL", amount, currency);
    }

    public List<Wallet> getUserWallets(UUID userId) {
        return walletRepository.findByUserId(userId);
    }

    public List<Transaction> getUserTransactions(UUID userId) {
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<Wallet> findAllWallets() {
        return walletRepository.findAll();
    }

    public List<Transaction> findAllTransactions() {
        return transactionRepository.findAll();
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
