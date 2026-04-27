package org.serhiileniv.auth.dto;
public record AuthResponse(
        String accessToken,
        String refreshToken
) {
}
