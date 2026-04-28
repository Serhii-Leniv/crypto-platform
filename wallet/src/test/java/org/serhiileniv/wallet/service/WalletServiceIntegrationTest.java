package org.serhiileniv.wallet.service;

import org.junit.jupiter.api.Test;
import org.serhiileniv.wallet.exception.InsufficientFundsException;
import org.serhiileniv.wallet.model.ProcessedEvent;
import org.serhiileniv.wallet.model.Wallet;
import org.serhiileniv.wallet.repository.ProcessedEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.kafka.core.KafkaTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Testcontainers
class WalletServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @MockBean
    @SuppressWarnings("rawtypes")
    KafkaTemplate kafkaTemplate;

    @Autowired
    WalletService walletService;

    @Autowired
    ProcessedEventRepository processedEventRepository;

    private Wallet findWallet(UUID userId, String currency) {
        return walletService.getUserWallets(userId).stream()
                .filter(w -> currency.equals(w.getCurrency()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Wallet not found for " + userId + "/" + currency));
    }

    @Test
    void deposit_createsWalletAndAddsBalance() {
        UUID userId = UUID.randomUUID();

        walletService.deposit(userId, "USDT", new BigDecimal("10000"));

        Wallet wallet = findWallet(userId, "USDT");
        assertEquals(0, new BigDecimal("10000").compareTo(wallet.getBalance()));
        assertEquals(0, BigDecimal.ZERO.compareTo(wallet.getLockedBalance()));
    }

    @Test
    void deposit_accumulatesBalance() {
        UUID userId = UUID.randomUUID();

        walletService.deposit(userId, "BTC", new BigDecimal("1"));
        walletService.deposit(userId, "BTC", new BigDecimal("0.5"));

        Wallet wallet = findWallet(userId, "BTC");
        assertEquals(0, new BigDecimal("1.5").compareTo(wallet.getBalance()));
    }

    @Test
    void lockFunds_reducesAvailableBalance() {
        UUID userId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        walletService.deposit(userId, "USDT", new BigDecimal("50000"));

        walletService.lockFunds(userId, "USDT", new BigDecimal("25000"), orderId);

        Wallet wallet = findWallet(userId, "USDT");
        assertEquals(0, new BigDecimal("50000").compareTo(wallet.getBalance()));
        assertEquals(0, new BigDecimal("25000").compareTo(wallet.getLockedBalance()));
        assertEquals(0, new BigDecimal("25000").compareTo(wallet.getAvailableBalance()));
    }

    @Test
    void unlockFunds_restoresAvailableBalance() {
        UUID userId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        walletService.deposit(userId, "USDT", new BigDecimal("50000"));
        walletService.lockFunds(userId, "USDT", new BigDecimal("25000"), orderId);

        walletService.unlockFunds(userId, "USDT", new BigDecimal("25000"), orderId);

        Wallet wallet = findWallet(userId, "USDT");
        assertEquals(0, new BigDecimal("50000").compareTo(wallet.getAvailableBalance()));
        assertEquals(0, BigDecimal.ZERO.compareTo(wallet.getLockedBalance()));
    }

    @Test
    void lockFunds_insufficientBalance_throwsException() {
        UUID userId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        walletService.deposit(userId, "USDT", new BigDecimal("100"));

        assertThrows(InsufficientFundsException.class,
                () -> walletService.lockFunds(userId, "USDT", new BigDecimal("1000"), orderId));
    }

    @Test
    void processedEventRepository_enforcesIdempotency() {
        UUID eventId = UUID.randomUUID();

        processedEventRepository.save(new ProcessedEvent(eventId, "ORDER_PLACED"));

        assertTrue(processedEventRepository.existsByEventId(eventId));

        assertThrows(Exception.class,
                () -> processedEventRepository.saveAndFlush(new ProcessedEvent(eventId, "ORDER_PLACED")));
    }
}
