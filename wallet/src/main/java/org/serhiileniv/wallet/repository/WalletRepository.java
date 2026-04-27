package org.serhiileniv.wallet.repository;
import jakarta.persistence.LockModeType;
import org.serhiileniv.wallet.model.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
@Repository
public interface WalletRepository extends JpaRepository<Wallet, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.userId = :userId AND w.currency = :currency")
    Optional<Wallet> findByUserIdAndCurrencyWithLock(@Param("userId") UUID userId, @Param("currency") String currency);
    Optional<Wallet> findByUserIdAndCurrency(UUID userId, String currency);
    List<Wallet> findByUserId(UUID userId);
}
