package org.serhiileniv.wallet.controller;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.dto.*;
import org.serhiileniv.wallet.model.Transaction;
import org.serhiileniv.wallet.model.Wallet;
import org.serhiileniv.wallet.service.WalletService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
@RestController
@RequestMapping("/api/v1/wallets")
@RequiredArgsConstructor
@Slf4j
public class WalletController {
    private final WalletService walletService;
    @PostMapping("/deposit")
    public ResponseEntity<Void> deposit(
            @Valid @RequestBody DepositRequest request,
            @RequestHeader("X-User-Id") String userId) {
        walletService.deposit(UUID.fromString(userId), request.getCurrency(), request.getAmount());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
    @PostMapping("/withdraw")
    public ResponseEntity<Void> withdraw(
            @Valid @RequestBody WithdrawRequest request,
            @RequestHeader("X-User-Id") String userId) {
        walletService.withdraw(UUID.fromString(userId), request.getCurrency(), request.getAmount());
        return ResponseEntity.status(HttpStatus.OK).build();
    }
    @GetMapping
    public ResponseEntity<List<WalletResponse>> getWallets(@RequestHeader("X-User-Id") String userId) {
        List<Wallet> wallets = walletService.getUserWallets(UUID.fromString(userId));
        List<WalletResponse> response = wallets.stream()
                .map(WalletResponse::from)
                .toList();
        return ResponseEntity.ok(response);
    }
    @GetMapping("/transactions")
    public ResponseEntity<List<TransactionResponse>> getTransactions(@RequestHeader("X-User-Id") String userId) {
        List<Transaction> transactions = walletService.getUserTransactions(UUID.fromString(userId));
        List<TransactionResponse> response = transactions.stream()
                .map(TransactionResponse::from)
                .toList();
        return ResponseEntity.ok(response);
    }
}
