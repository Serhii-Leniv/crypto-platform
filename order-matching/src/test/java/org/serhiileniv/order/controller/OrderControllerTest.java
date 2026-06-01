package org.serhiileniv.order.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.serhiileniv.order.dto.OrderRequest;
import org.serhiileniv.order.dto.OrderResponse;
import org.serhiileniv.order.exception.OrderNotFoundException;
import org.serhiileniv.order.exception.UnauthorizedOrderAccessException;
import org.serhiileniv.order.model.OrderSide;
import org.serhiileniv.order.model.OrderStatus;
import org.serhiileniv.order.model.OrderType;
import org.serhiileniv.order.service.OrderMatchingEngine;
import org.serhiileniv.order.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OrderController.class)
@AutoConfigureMockMvc(addFilters = false)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private OrderService orderService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID ORDER_ID = UUID.randomUUID();

    private OrderResponse sampleResponse() {
        return new OrderResponse(ORDER_ID, USER_ID, "BTC-USDT",
                OrderType.LIMIT, OrderSide.BUY,
                new BigDecimal("45000"), new BigDecimal("0.1"),
                BigDecimal.ZERO, OrderStatus.PENDING,
                LocalDateTime.now(), LocalDateTime.now());
    }

    @Test
    void placeOrder_ValidRequest_Returns201() throws Exception {
        OrderRequest req = new OrderRequest("BTC-USDT", OrderType.LIMIT, OrderSide.BUY,
                new BigDecimal("45000"), new BigDecimal("0.1"));
        when(orderService.placeOrder(any(), eq(USER_ID))).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/orders")
                        .header("X-User-Id", USER_ID.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(ORDER_ID.toString()))
                .andExpect(jsonPath("$.symbol").value("BTC-USDT"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void placeOrder_MissingSymbol_Returns400() throws Exception {
        String badBody = """
                {"orderType":"LIMIT","side":"BUY","price":45000,"quantity":0.1}
                """;

        mockMvc.perform(post("/api/v1/orders")
                        .header("X-User-Id", USER_ID.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(badBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getOrder_Existing_Returns200() throws Exception {
        when(orderService.getOrderById(ORDER_ID, USER_ID)).thenReturn(sampleResponse());

        mockMvc.perform(get("/api/v1/orders/" + ORDER_ID)
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ORDER_ID.toString()));
    }

    @Test
    void getOrder_NotFound_Returns404() throws Exception {
        when(orderService.getOrderById(ORDER_ID, USER_ID))
                .thenThrow(new OrderNotFoundException(ORDER_ID));

        mockMvc.perform(get("/api/v1/orders/" + ORDER_ID)
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void getOrder_WrongUser_Returns403() throws Exception {
        when(orderService.getOrderById(ORDER_ID, USER_ID))
                .thenThrow(new UnauthorizedOrderAccessException(ORDER_ID));

        mockMvc.perform(get("/api/v1/orders/" + ORDER_ID)
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void getUserOrders_Returns200() throws Exception {
        when(orderService.getUserOrders(eq(USER_ID), any()))
                .thenReturn(new PageImpl<>(List.of(sampleResponse())));

        mockMvc.perform(get("/api/v1/orders")
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].symbol").value("BTC-USDT"));
    }

    @Test
    void cancelOrder_Existing_Returns204() throws Exception {
        doNothing().when(orderService).cancelOrder(ORDER_ID, USER_ID);

        mockMvc.perform(delete("/api/v1/orders/" + ORDER_ID)
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isNoContent());
    }

    @Test
    void cancelOrder_NotFound_Returns404() throws Exception {
        doThrow(new OrderNotFoundException(ORDER_ID))
                .when(orderService).cancelOrder(ORDER_ID, USER_ID);

        mockMvc.perform(delete("/api/v1/orders/" + ORDER_ID)
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void getOrderBook_ValidSymbol_Returns200() throws Exception {
        when(orderService.getOrderBook("BTC-USDT"))
                .thenReturn(new OrderMatchingEngine.OrderBook(Collections.emptyList(), Collections.emptyList()));

        mockMvc.perform(get("/api/v1/orders/book/BTC-USDT")
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.buyOrders").isArray())
                .andExpect(jsonPath("$.sellOrders").isArray());
    }

    @Test
    void getOrderBook_InvalidSymbol_Returns400() throws Exception {
        mockMvc.perform(get("/api/v1/orders/book/invalid_symbol")
                        .header("X-User-Id", USER_ID.toString()))
                .andExpect(status().isBadRequest());
    }
}
