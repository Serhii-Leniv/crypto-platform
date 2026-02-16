package org.serhiileniv.order.repository;

import org.serhiileniv.order.model.Order;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
        List<Order> findByStatusOrderByCreatedAtAsc(OrderStatus status);

        @Query("SELECT o FROM Order o WHERE o.symbol = :symbol AND o.side = :side AND o.status IN ('PENDING', 'PARTIALLY_FILLED') ORDER BY o.price DESC, o.createdAt ASC")
        List<Order> findBuyOrdersForMatching(@Param("symbol") String symbol, @Param("side") OrderSide side);

        @Query("SELECT o FROM Order o WHERE o.symbol = :symbol AND o.side = :side AND o.status IN ('PENDING', 'PARTIALLY_FILLED') ORDER BY o.price ASC, o.createdAt ASC")
        List<Order> findSellOrdersForMatching(@Param("symbol") String symbol, @Param("side") OrderSide side);

        List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);

        Optional<Order> findByIdAndUserId(UUID id, UUID userId);

        @Query("SELECT o FROM Order o WHERE o.symbol = :symbol AND o.side = :side AND o.status IN ('PENDING', 'PARTIALLY_FILLED') AND o.price >= :price ORDER BY o.createdAt ASC")
        List<Order> findMatchingBuyOrders(@Param("symbol") String symbol, @Param("side") OrderSide side,
                        @Param("price") BigDecimal price);

        @Query("SELECT o FROM Order o WHERE o.symbol = :symbol AND o.side = :side AND o.status IN ('PENDING', 'PARTIALLY_FILLED') AND o.price <= :price ORDER BY o.createdAt ASC")
        List<Order> findMatchingSellOrders(@Param("symbol") String symbol, @Param("side") OrderSide side,
                        @Param("price") BigDecimal price);
}
