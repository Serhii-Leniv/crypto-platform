package org.serhiileniv.wallet.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.dto.AdminDepositRequest;
import org.serhiileniv.wallet.dto.TransactionResponse;
import org.serhiileniv.wallet.dto.WalletResponse;
import org.serhiileniv.wallet.model.Transaction;
import org.serhiileniv.wallet.model.TransactionStatus;
import org.serhiileniv.wallet.model.TransactionType;
import org.serhiileniv.wallet.model.Wallet;
import org.serhiileniv.wallet.service.WalletService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminWalletController {

    private final WalletService walletService;

    @GetMapping("/wallets")
    public ResponseEntity<List<WalletResponse>> getAllWallets(
            @RequestParam(required = false) String userId,
            @RequestHeader("X-User-Role") String role) {
        log.info("Admin: listing all wallets, userId filter={}", userId);
        List<Wallet> wallets = walletService.findAllWallets();
        Stream<Wallet> stream = wallets.stream();
        if (userId != null && !userId.isBlank()) {
            UUID filterId = UUID.fromString(userId);
            stream = stream.filter(w -> filterId.equals(w.getUserId()));
        }
        List<WalletResponse> response = stream.map(WalletResponse::from).toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<TransactionResponse>> getAllTransactions(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String currency,
            @RequestHeader("X-User-Role") String role) {
        log.info("Admin: listing all transactions, type={}, status={}, currency={}", type, status, currency);
        List<Transaction> transactions = walletService.findAllTransactions();
        Stream<Transaction> stream = transactions.stream();
        if (type != null && !type.isBlank()) {
            TransactionType typeEnum = TransactionType.valueOf(type.toUpperCase());
            stream = stream.filter(t -> typeEnum.equals(t.getType()));
        }
        if (status != null && !status.isBlank()) {
            TransactionStatus statusEnum = TransactionStatus.valueOf(status.toUpperCase());
            stream = stream.filter(t -> statusEnum.equals(t.getStatus()));
        }
        if (currency != null && !currency.isBlank()) {
            stream = stream.filter(t -> currency.equalsIgnoreCase(t.getCurrency()));
        }
        List<TransactionResponse> response = stream
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(TransactionResponse::from)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/wallets/deposit")
    public ResponseEntity<Void> adminDeposit(
            @Valid @RequestBody AdminDepositRequest request,
            @RequestHeader("X-User-Role") String role) {
        log.info("Admin: depositing {} {} for user {}", request.amount(), request.currency(), request.userId());
        walletService.deposit(request.userId(), request.currency(), request.amount());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
