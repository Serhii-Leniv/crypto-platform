package org.serhiileniv.wallet.model;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
@Entity
@Table(name = "wallets", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "user_id", "currency" })
}, indexes = {
        @Index(name = "idx_user_id", columnList = "user_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Wallet {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false)
    private UUID userId;
    @Column(nullable = false, length = 10)
    private String currency;
    @Column(nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;
    @Column(nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal lockedBalance = BigDecimal.ZERO;
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    public BigDecimal getAvailableBalance() {
        return balance.subtract(lockedBalance);
    }
    public void deposit(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Deposit amount must be positive");
        }
        this.balance = this.balance.add(amount);
    }
    public void withdraw(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be positive");
        }
        if (getAvailableBalance().compareTo(amount) < 0) {
            throw new IllegalStateException("Insufficient available balance");
        }
        this.balance = this.balance.subtract(amount);
    }
    public void lock(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Lock amount must be positive");
        }
        if (getAvailableBalance().compareTo(amount) < 0) {
            throw new IllegalStateException("Insufficient available balance to lock");
        }
        this.lockedBalance = this.lockedBalance.add(amount);
    }
    public void unlock(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Unlock amount must be positive");
        }
        if (this.lockedBalance.compareTo(amount) < 0) {
            throw new IllegalStateException("Insufficient locked balance");
        }
        this.lockedBalance = this.lockedBalance.subtract(amount);
    }
    public void debitLocked(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Debit amount must be positive");
        }
        if (this.lockedBalance.compareTo(amount) < 0) {
            throw new IllegalStateException("Insufficient locked balance");
        }
        this.lockedBalance = this.lockedBalance.subtract(amount);
        this.balance = this.balance.subtract(amount);
    }
}
