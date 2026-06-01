package org.serhiileniv.auth.service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.auth.dto.AuthResponse;
import org.serhiileniv.auth.dto.UserDto;
import org.serhiileniv.auth.exception.InvalidCredentialsException;
import org.serhiileniv.auth.exception.TokenException;
import org.serhiileniv.auth.exception.UserAlreadyExistsException;
import org.serhiileniv.auth.model.RefreshToken;
import org.serhiileniv.auth.model.User;
import org.serhiileniv.auth.repository.RefreshTokenRepository;
import org.serhiileniv.auth.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    public record LoginResult(String accessToken, String refreshToken) {}

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional
    public LoginResult register(UserDto userDto) {
        if (userDto == null) {
            throw new IllegalArgumentException("User data must not be null");
        }
        log.info("Registration attempt for email: {}", userDto.email());
        if (userRepository.existsUserByEmail(userDto.email())) {
            log.warn("Registration failed — email already registered: {}", userDto.email());
            throw new UserAlreadyExistsException(userDto.email());
        }
        String encodedPassword = passwordEncoder.encode(userDto.password());
        User user = User.builder()
                .email(userDto.email())
                .password(encodedPassword)
                .build();
        user = userRepository.save(user);
        log.info("User registered successfully: id={}, email={}", user.getId(), user.getEmail());
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        refreshTokenRepository.save(new RefreshToken(refreshToken, user.getEmail()));
        return new LoginResult(accessToken, refreshToken);
    }

    @Transactional
    public LoginResult login(UserDto userDto) {
        log.info("Login attempt for email: {}", userDto.email());
        User user = userRepository.findUserByEmail(userDto.email())
                .orElseThrow(() -> {
                    log.warn("Login failed — email not found: {}", userDto.email());
                    return new InvalidCredentialsException();
                });
        if (!passwordEncoder.matches(userDto.password(), user.getPassword())) {
            log.warn("Login failed — invalid password for email: {}", userDto.email());
            throw new InvalidCredentialsException();
        }
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        refreshTokenRepository.save(new RefreshToken(refreshToken, user.getEmail()));
        log.info("Login successful: id={}, email={}", user.getId(), user.getEmail());
        return new LoginResult(accessToken, refreshToken);
    }

    public LoginResult refreshToken(HttpServletRequest request) {
        String refreshToken = extractRefreshTokenFromCookie(request);
        if (refreshToken == null) {
            log.warn("Token refresh failed — refresh_token cookie missing");
            throw new TokenException("Refresh token is missing");
        }
        String userEmail = jwtService.extractUsername(refreshToken);
        log.debug("Token refresh requested for email: {}", userEmail);
        if (userEmail != null) {
            refreshTokenRepository.findById(refreshToken)
                    .orElseThrow(() -> {
                        log.warn("Token refresh failed — token not found or revoked for email: {}", userEmail);
                        return new TokenException("Refresh token not found or revoked");
                    });
            User user = userRepository.findUserByEmail(userEmail)
                    .orElseThrow(InvalidCredentialsException::new);
            if (jwtService.isTokenValid(refreshToken, user)) {
                String newAccess = jwtService.generateAccessToken(user);
                log.info("Access token refreshed for email: {}", userEmail);
                return new LoginResult(newAccess, refreshToken);
            }
        }
        log.warn("Token refresh failed — invalid token for email: {}", userEmail);
        throw new TokenException("Invalid refresh token");
    }

    public void logout(HttpServletRequest request) {
        String refreshToken = extractRefreshTokenFromCookie(request);
        if (refreshToken != null) {
            String userEmail = jwtService.extractUsername(refreshToken);
            refreshTokenRepository.deleteById(refreshToken);
            log.info("User logged out, refresh token revoked for email: {}", userEmail);
        } else {
            log.debug("Logout called with no refresh_token cookie");
        }
    }

    private String extractRefreshTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> "refresh_token".equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
