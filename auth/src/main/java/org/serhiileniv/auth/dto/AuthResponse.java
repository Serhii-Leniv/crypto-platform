package org.serhiileniv.auth.dto;
public record AuthResponse(
        String accessToken,
        boolean isAdmin
) {
    public AuthResponse(String accessToken) {
        this(accessToken, false);
    }
}
