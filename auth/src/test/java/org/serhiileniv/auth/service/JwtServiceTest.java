package org.serhiileniv.auth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.serhiileniv.auth.model.User;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private static final long ACCESS_EXP = 900_000L;
    private static final long REFRESH_EXP = 604_800_000L;

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secretKey", SECRET);
        ReflectionTestUtils.setField(jwtService, "accessExpiration", ACCESS_EXP);
        ReflectionTestUtils.setField(jwtService, "refreshExpiration", REFRESH_EXP);
    }

    private User user() {
        return User.builder()
                .id(UUID.randomUUID())
                .email("test@example.com")
                .password("encoded")
                .build();
    }

    @Test
    void generateAccessToken_ContainsSubjectAndNotEmpty() {
        String token = jwtService.generateAccessToken(user());
        assertNotNull(token);
        assertFalse(token.isBlank());
    }

    @Test
    void generateAccessToken_NullUserId_ThrowsIllegalArgument() {
        User noId = User.builder().email("test@example.com").password("encoded").build();
        assertThrows(IllegalArgumentException.class, () -> jwtService.generateAccessToken(noId));
    }

    @Test
    void extractUsername_ValidAccessToken_ReturnsEmail() {
        User u = user();
        String token = jwtService.generateAccessToken(u);
        assertEquals(u.getEmail(), jwtService.extractUsername(token));
    }

    @Test
    void extractUsername_InvalidToken_ReturnsNull() {
        assertNull(jwtService.extractUsername("this.is.not.a.jwt"));
    }

    @Test
    void isTokenValid_ValidToken_ReturnsTrue() {
        User u = user();
        String token = jwtService.generateAccessToken(u);
        assertTrue(jwtService.isTokenValid(token, u));
    }

    @Test
    void isTokenValid_WrongUserEmail_ReturnsFalse() {
        User u = user();
        String token = jwtService.generateAccessToken(u);
        User other = User.builder().id(UUID.randomUUID()).email("other@example.com").password("encoded").build();
        assertFalse(jwtService.isTokenValid(token, other));
    }

    @Test
    void isTokenValid_ExpiredToken_ReturnsFalse() {
        JwtService expiredJs = new JwtService();
        ReflectionTestUtils.setField(expiredJs, "secretKey", SECRET);
        ReflectionTestUtils.setField(expiredJs, "accessExpiration", 0L);
        ReflectionTestUtils.setField(expiredJs, "refreshExpiration", REFRESH_EXP);

        User u = user();
        String token = expiredJs.generateAccessToken(u);
        assertFalse(expiredJs.isTokenValid(token, u));
    }

    @Test
    void isTokenExpired_FreshToken_ReturnsFalse() {
        User u = user();
        String token = jwtService.generateAccessToken(u);
        assertFalse(jwtService.isTokenExpired(token));
    }

    @Test
    void generateRefreshToken_ExtractableUsername() {
        User u = user();
        String token = jwtService.generateRefreshToken(u);
        assertNotNull(token);
        assertEquals(u.getEmail(), jwtService.extractUsername(token));
    }

    @Test
    void isTokenValid_InvalidTokenString_ReturnsFalse() {
        User u = user();
        assertFalse(jwtService.isTokenValid("garbage.token.value", u));
    }
}
