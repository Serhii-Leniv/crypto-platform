package org.serhiileniv.wallet.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.wallet.dto.*;
import org.serhiileniv.wallet.model.Transaction;
import org.serhiileniv.wallet.model.Wallet;
import org.serhiileniv.wallet.service.WalletService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wallets")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Wallets", description = "Wallet balance management — deposit, withdraw, and transaction history")
@SecurityRequirement(name = "bearerAuth")
public class WalletController {
    private final WalletService walletService;

    @PostMapping("/deposit")
    @Operation(summary = "Deposit funds", description = "Credits the specified currency amount to the user's wallet. Creates the wallet automatically if it does not exist.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Deposit processed"),
        @ApiResponse(responseCode = "400", description = "Invalid amount or currency", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<Void> deposit(
            @Valid @RequestBody DepositRequest request,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Deposit request for user {}: {} {}", userId, request.getAmount(), request.getCurrency());
        walletService.deposit(UUID.fromString(userId), request.getCurrency(), request.getAmount());
        log.info("Deposit successful for user {}: {} {}", userId, request.getAmount(), request.getCurrency());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/withdraw")
    @Operation(summary = "Withdraw funds", description = "Debits the specified currency amount from the user's available (non-locked) balance.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Withdrawal processed"),
        @ApiResponse(responseCode = "400", description = "Invalid amount or currency", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "404", description = "Wallet not found for currency", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Insufficient available balance", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<Void> withdraw(
            @Valid @RequestBody WithdrawRequest request,
            @RequestHeader("X-User-Id") String userId) {
        log.info("Withdrawal request for user {}: {} {}", userId, request.getAmount(), request.getCurrency());
        walletService.withdraw(UUID.fromString(userId), request.getCurrency(), request.getAmount());
        log.info("Withdrawal successful for user {}: {} {}", userId, request.getAmount(), request.getCurrency());
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @GetMapping
    @Operation(summary = "List wallets", description = "Returns all wallets for the authenticated user, one per currency.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Wallet list"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<List<WalletResponse>> getWallets(@RequestHeader("X-User-Id") String userId) {
        log.debug("Fetching wallets for user {}", userId);
        List<Wallet> wallets = walletService.getUserWallets(UUID.fromString(userId));
        List<WalletResponse> response = wallets.stream()
                .map(WalletResponse::from)
                .toList();
        log.debug("Returning {} wallets for user {}", response.size(), userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/transactions")
    @Operation(summary = "List transactions", description = "Returns the full transaction history for the authenticated user (deposits, withdrawals, trade settlements), newest first.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Transaction list"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<List<TransactionResponse>> getTransactions(@RequestHeader("X-User-Id") String userId) {
        log.debug("Fetching transactions for user {}", userId);
        List<Transaction> transactions = walletService.getUserTransactions(UUID.fromString(userId));
        List<TransactionResponse> response = transactions.stream()
                .map(TransactionResponse::from)
                .toList();
        log.debug("Returning {} transactions for user {}", response.size(), userId);
        return ResponseEntity.ok(response);
    }
}
