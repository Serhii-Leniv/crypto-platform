package org.serhiileniv.wallet.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.wallet.kafka.event.OrderPlacedEvent;
import org.serhiileniv.wallet.kafka.event.OrderSide;
import org.serhiileniv.wallet.repository.ProcessedEventRepository;
import org.serhiileniv.wallet.service.WalletService;

import java.math.BigDecimal;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

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

    /**
     * Wallet now mutates state synchronously via /internal/wallets/* REST calls from
     * order-matching. The Kafka listener is a deliberate no-op — it parses the payload
     * (so malformed JSON is logged and discarded) and never touches WalletService.
     */
    @Test
    void consumeOrderEvent_validPayload_isNoOp() throws Exception {
        OrderPlacedEvent event = new OrderPlacedEvent();
        event.setEventType("ORDER_PLACED");
        event.setOrderId(UUID.randomUUID());
        event.setUserId(UUID.randomUUID());
        event.setSymbol("BTC-USDT");
        event.setSide(OrderSide.BUY);
        event.setPrice(new BigDecimal("50000"));
        event.setQuantity(new BigDecimal("1"));

        String message = objectMapper.writeValueAsString(event);
        orderEventConsumer.consumeOrderEvent(message, event.getOrderId().toString());

        verifyNoInteractions(walletService);
        verify(processedEventRepository, never()).save(any());
    }

    @Test
    void consumeOrderEvent_malformedJson_isSwallowed() {
        // Should log and discard — never throw, never call walletService.
        orderEventConsumer.consumeOrderEvent("not-json{", "any-key");
        verifyNoInteractions(walletService);
    }
}
