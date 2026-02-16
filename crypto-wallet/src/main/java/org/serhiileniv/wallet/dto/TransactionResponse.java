package org.serhiileniv.wallet.dto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.serhiileniv.wallet.model.Transaction;
import org.serhiileniv.wallet.model.TransactionStatus;
import org.serhiileniv.wallet.model.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionResponse {
    private UUID id;
    private UUID walletId;
    private TransactionType type;
    private BigDecimal amount;
    private String currency;
    private UUID referenceId;
    private TransactionStatus status;
    private String description;
    private LocalDateTime createdAt;
    public static TransactionResponse from(Transaction transaction) {
        return TransactionResponse.builder()
                .id(transaction.getId())
                .walletId(transaction.getWalletId())
                .type(transaction.getType())
                .amount(transaction.getAmount())
                .currency(transaction.getCurrency())
                .referenceId(transaction.getReferenceId())
                .status(transaction.getStatus())
                .description(transaction.getDescription())
                .createdAt(transaction.getCreatedAt())
                .build();
    }
}
