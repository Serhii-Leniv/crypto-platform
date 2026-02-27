package org.serhiileniv.cryptoauth.dto;
public record AuthResponse(
        String accessToken,
        String refreshToken
) {
}
