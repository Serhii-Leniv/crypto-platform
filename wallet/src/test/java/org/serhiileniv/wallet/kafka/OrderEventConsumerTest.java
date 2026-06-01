package org.serhiileniv.wallet.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.wallet.kafka.event.OrderMatchedEvent;
import org.serhiileniv.wallet.kafka.event.OrderPlacedEvent;
import org.serhiileniv.wallet.kafka.event.OrderSide;
import org.serhiileniv.wallet.repository.ProcessedEventRepository;
import org.serhiileniv.wallet.service.WalletService;

import java.math.BigDecimal;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class OrderEventConsumerTest {

    @Mock
    private WalletService walletService;

    @Mock
    private ProcessedEventRepository processedEventRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private OrderEventConsumer orderEventConsumer;

    private UUID userId = UUID.randomUUID();
    private UUID orderId = UUID.randomUUID();
    private String symbol = "BTC/USDT";

    @Test
    void consumeOrderEvent_OrderPlaced_LockFunds() throws Exception {
        OrderPlacedEvent event = new OrderPlacedEvent();
        event.setEventType("ORDER_PLACED");
        event.setOrderId(orderId);
        event.setUserId(userId);
        event.setSymbol(symbol);
        event.setSide(OrderSide.BUY);
        event.setPrice(new BigDecimal("50000"));
        event.setQuantity(new BigDecimal("1"));

        String message = objectMapper.writeValueAsString(event);
        when(processedEventRepository.existsByEventId(orderId)).thenReturn(false);

        orderEventConsumer.consumeOrderEvent(message, orderId.toString());

        verify(walletService).lockFunds(eq(userId), eq("USDT"), eq(new BigDecimal("50000")), eq(orderId));
        verify(processedEventRepository).save(any());
    }

    @Test
    void consumeOrderEvent_OrderMatched_ProcessTrade() throws Exception {
        UUID tradeId = UUID.randomUUID();
        UUID buyerId = UUID.randomUUID();
        UUID sellerId = UUID.randomUUID();

        OrderMatchedEvent event = new OrderMatchedEvent();
        event.setEventType("ORDER_MATCHED");
        event.setTradeId(tradeId);
        event.setBuyerUserId(buyerId);
        event.setSellerUserId(sellerId);
        event.setSymbol(symbol);
        event.setPrice(new BigDecimal("50000"));
        event.setQuantity(new BigDecimal("0.5"));

        String message = objectMapper.writeValueAsString(event);
        when(processedEventRepository.existsByEventId(tradeId)).thenReturn(false);

        orderEventConsumer.consumeOrderEvent(message, tradeId.toString());

        // Buyer gets 0.5 BTC, spends 25000 USDT
        verify(walletService).processTrade(eq(buyerId), eq("BTC"), eq(new BigDecimal("0.5")), eq(tradeId), eq(true));
        verify(walletService).processTrade(eq(buyerId), eq("USDT"), eq(new BigDecimal("25000.0")), eq(tradeId),
                eq(false));

        // Seller gets 25000 USDT, sends 0.5 BTC
        verify(walletService).processTrade(eq(sellerId), eq("BTC"), eq(new BigDecimal("0.5")), eq(tradeId), eq(false));
        verify(walletService).processTrade(eq(sellerId), eq("USDT"), eq(new BigDecimal("25000.0")), eq(tradeId),
                eq(true));

        verify(processedEventRepository).save(any());
    }

    @Test
    void consumeOrderEvent_OrderCancelled_BuyOrder_UnlocksFunds() throws Exception {
        org.serhiileniv.wallet.kafka.event.OrderCancelledEvent event =
                new org.serhiileniv.wallet.kafka.event.OrderCancelledEvent();
        event.setEventType("ORDER_CANCELLED");
        event.setOrderId(orderId);
        event.setUserId(userId);
        event.setSymbol(symbol);
        event.setSide(OrderSide.BUY);
        event.setPrice(new BigDecimal("50000"));
        event.setRemainingQuantity(new BigDecimal("1"));

        String message = objectMapper.writeValueAsString(event);
        when(processedEventRepository.existsByEventId(orderId)).thenReturn(false);

        orderEventConsumer.consumeOrderEvent(message, orderId.toString());

        // BUY cancel: unlock quote currency (USDT) = price * remaining qty
        verify(walletService).unlockFunds(eq(userId), eq("USDT"),
                eq(new BigDecimal("50000")), eq(orderId));
        verify(processedEventRepository).save(any());
    }

    @Test
    void consumeOrderEvent_SellOrderPlaced_LocksBaseCurrency() throws Exception {
        OrderPlacedEvent event = new OrderPlacedEvent();
        event.setEventType("ORDER_PLACED");
        event.setOrderId(orderId);
        event.setUserId(userId);
        event.setSymbol(symbol);
        event.setSide(OrderSide.SELL);
        event.setPrice(new BigDecimal("50000"));
        event.setQuantity(new BigDecimal("0.5"));

        String message = objectMapper.writeValueAsString(event);
        when(processedEventRepository.existsByEventId(orderId)).thenReturn(false);

        orderEventConsumer.consumeOrderEvent(message, orderId.toString());

        // SELL: lock base currency (BTC) = quantity
        verify(walletService).lockFunds(eq(userId), eq("BTC"),
                eq(new BigDecimal("0.5")), eq(orderId));
    }

    @Test
    void consumeOrderEvent_DuplicateEvent_IsSkipped() throws Exception {
        OrderPlacedEvent event = new OrderPlacedEvent();
        event.setEventType("ORDER_PLACED");
        event.setOrderId(orderId);
        event.setUserId(userId);
        event.setSymbol(symbol);
        event.setSide(OrderSide.BUY);
        event.setPrice(new BigDecimal("50000"));
        event.setQuantity(new BigDecimal("1"));

        String message = objectMapper.writeValueAsString(event);
        when(processedEventRepository.existsByEventId(orderId)).thenReturn(true);

        orderEventConsumer.consumeOrderEvent(message, orderId.toString());

        verify(walletService, never()).lockFunds(any(), any(), any(), any());
    }
}
