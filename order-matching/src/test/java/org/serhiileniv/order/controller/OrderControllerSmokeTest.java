package org.serhiileniv.order.controller;

import org.junit.jupiter.api.Test;
import org.serhiileniv.order.service.OrderMatchingEngine;
import org.serhiileniv.order.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(OrderController.class)
@AutoConfigureMockMvc(addFilters = false)
class OrderControllerSmokeTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OrderService orderService;

    @Test
    void getUserOrders_ShouldReturnOk() throws Exception {
        UUID userId = UUID.randomUUID();
        when(orderService.getUserOrders(userId)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/orders")
                .header("X-User-Id", userId.toString()))
                .andExpect(status().isOk());
    }

    @Test
    void getOrderBook_ShouldReturnOk() throws Exception {
        String symbol = "BTC-USDT";
        when(orderService.getOrderBook(symbol))
                .thenReturn(new OrderMatchingEngine.OrderBook(Collections.emptyList(), Collections.emptyList()));

        mockMvc.perform(get("/api/v1/orders/book/" + symbol))
                .andExpect(status().isOk());
    }
}
