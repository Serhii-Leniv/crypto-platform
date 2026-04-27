package org.serhiileniv.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import java.nio.charset.StandardCharsets;
import org.serhiileniv.auth.model.User;

@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {
    @Value("${application.security.jwt.secret-key}")
    private String secretKey;
    @Value("${application.security.jwt.access-token.expiration}")
    private long accessExpiration;
    @Value("${application.security.jwt.refresh-token.expiration}")
    private long refreshExpiration;

    public String generateAccessToken(User user) {
        if (user.getId() == null) {
            throw new IllegalArgumentException("User ID must not be null for token generation");
        }
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId().toString());
        String token = buildToken(claims, user, accessExpiration);
        log.debug("Access token generated for user id={}, email={}", user.getId(), user.getEmail());
        return token;
    }

    public String generateRefreshToken(User user) {
        String token = buildToken(new HashMap<>(), user, refreshExpiration);
        log.debug("Refresh token generated for user id={}, email={}", user.getId(), user.getEmail());
        return token;
    }

    private String buildToken(Map<String, Object> extraClaims, User user, long expiration) {
        return Jwts.builder()
                .claims(extraClaims)
                .subject(user.getEmail())
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignedByKey())
                .compact();
    }

    public String extractUsername(String token) {
        try {
            return extractClaims(token, Claims::getSubject);
        } catch (JwtException e) {
            log.warn("Failed to extract username from token: {}", e.getMessage());
            return null;
        }
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        if (username == null) {
            log.warn("Token validation failed — could not extract username");
            return false;
        }
        if (!username.equals(userDetails.getUsername())) {
            log.warn("Token validation failed — subject mismatch for user: {}", userDetails.getUsername());
            return false;
        }
        if (isTokenExpired(token)) {
            log.warn("Token validation failed — token expired for user: {}", userDetails.getUsername());
            return false;
        }
        return true;
    }

    public boolean isTokenExpired(String token) {
        return extractClaims(token, Claims::getExpiration).before(new Date());
    }

    private SecretKey getSignedByKey() {
        byte[] keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private <T> T extractClaims(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = Jwts.parser()
                .verifyWith(getSignedByKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claimsResolver.apply(claims);
    }
}
