package org.serhiileniv.wallet.repository;
import org.serhiileniv.wallet.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {
    List<Transaction> findByWalletIdOrderByCreatedAtDesc(UUID walletId);
    Optional<Transaction> findByReferenceId(UUID referenceId);
    @Query("SELECT t FROM Transaction t WHERE t.walletId IN " +
            "(SELECT w.id FROM Wallet w WHERE w.userId = :userId) " +
            "ORDER BY t.createdAt DESC")
    List<Transaction> findByUserIdOrderByCreatedAtDesc(@Param("userId") UUID userId);
}
