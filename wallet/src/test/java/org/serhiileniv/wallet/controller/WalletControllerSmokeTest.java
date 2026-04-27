package org.serhiileniv.wallet.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.serhiileniv.wallet.dto.DepositRequest;
import org.serhiileniv.wallet.service.WalletService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WalletController.class)
@AutoConfigureMockMvc(addFilters = false)
class WalletControllerSmokeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WalletService walletService;

    @Test
    void getWallets_ShouldReturnOk() throws Exception {
        UUID userId = UUID.randomUUID();
        when(walletService.getUserWallets(userId)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/wallets")
                .header("X-User-Id", userId.toString()))
                .andExpect(status().isOk());
    }

    @Test
    void deposit_ShouldReturnCreated() throws Exception {
        UUID userId = UUID.randomUUID();
        DepositRequest request = new DepositRequest();
        request.setCurrency("USDT");
        request.setAmount(new BigDecimal("100"));

        mockMvc.perform(post("/api/v1/wallets/deposit")
                .header("X-User-Id", userId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }
}
