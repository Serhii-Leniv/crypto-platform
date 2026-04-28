package org.serhiileniv.wallet.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.wallet.exception.InsufficientFundsException;
import org.serhiileniv.wallet.model.Wallet;
import org.serhiileniv.wallet.repository.TransactionRepository;
import org.serhiileniv.wallet.repository.WalletRepository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class WalletServiceTest {

    @Mock
    private WalletRepository walletRepository;
    @Mock
    private TransactionRepository transactionRepository;

    @InjectMocks
    private WalletService walletService;

    private UUID userId;
    private String currency;
    private Wallet wallet;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        currency = "USDT";
        wallet = Wallet.builder()
                .userId(userId)
                .currency(currency)
                .balance(new BigDecimal("1000"))
                .lockedBalance(BigDecimal.ZERO)
                .build();
    }

    @Test
    void deposit_Success() {
        when(walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)).thenReturn(Optional.of(wallet));

        walletService.deposit(userId, currency, new BigDecimal("500"));

        assertEquals(0, new BigDecimal("1500").compareTo(wallet.getBalance()));
        verify(walletRepository).save(wallet);
        verify(transactionRepository).save(any());
    }

    @Test
    void withdraw_Success() {
        when(walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)).thenReturn(Optional.of(wallet));

        walletService.withdraw(userId, currency, new BigDecimal("500"));

        assertEquals(0, new BigDecimal("500").compareTo(wallet.getBalance()));
        verify(walletRepository).save(wallet);
    }

    @Test
    void withdraw_InsufficientFunds() {
        when(walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)).thenReturn(Optional.of(wallet));

        assertThrows(InsufficientFundsException.class,
                () -> walletService.withdraw(userId, currency, new BigDecimal("1500")));
    }

    @Test
    void lockFunds_Success() {
        when(walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)).thenReturn(Optional.of(wallet));

        walletService.lockFunds(userId, currency, new BigDecimal("100"), UUID.randomUUID());

        assertEquals(0, new BigDecimal("1000").compareTo(wallet.getBalance())); // Total balance stays same
        assertEquals(0, new BigDecimal("900").compareTo(wallet.getAvailableBalance())); // Available decreases
        assertEquals(0, new BigDecimal("100").compareTo(wallet.getLockedBalance()));
    }

    @Test
    void unlockFunds_Success() {
        wallet.setLockedBalance(new BigDecimal("100"));
        when(walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)).thenReturn(Optional.of(wallet));

        walletService.unlockFunds(userId, currency, new BigDecimal("100"),
                UUID.fromString("00000000-0000-0000-0000-000000000000"));

        assertEquals(0, new BigDecimal("1000").compareTo(wallet.getBalance()));
        assertEquals(0, new BigDecimal("1000").compareTo(wallet.getAvailableBalance()));
        assertEquals(0, BigDecimal.ZERO.compareTo(wallet.getLockedBalance()));
    }

    @Test
    void processTrade_Buy_Success() {
        when(walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)).thenReturn(Optional.of(wallet));

        walletService.processTrade(userId, currency, new BigDecimal("100"), UUID.randomUUID(), true);

        assertEquals(0, new BigDecimal("1100").compareTo(wallet.getBalance()));
        verify(transactionRepository).save(any());
    }

    @Test
    void processTrade_Sell_Success() {
        wallet.setLockedBalance(new BigDecimal("100"));
        when(walletRepository.findByUserIdAndCurrencyWithLock(userId, currency)).thenReturn(Optional.of(wallet));

        walletService.processTrade(userId, currency, new BigDecimal("100"), UUID.randomUUID(), false);

        assertEquals(0, BigDecimal.ZERO.compareTo(wallet.getLockedBalance()));
        assertEquals(0, new BigDecimal("900").compareTo(wallet.getBalance())); // Total balance decreases on sell
        verify(transactionRepository).save(any());
    }
}
