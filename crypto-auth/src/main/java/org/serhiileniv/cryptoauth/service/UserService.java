package org.serhiileniv.cryptoauth.service;

import org.springframework.http.HttpHeaders;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.serhiileniv.cryptoauth.dto.AuthResponse;
import org.serhiileniv.cryptoauth.dto.UserDto;
import org.serhiileniv.cryptoauth.exception.InvalidCredentialsException;
import org.serhiileniv.cryptoauth.exception.TokenException;
import org.serhiileniv.cryptoauth.exception.UserAlreadyExistsException;
import org.serhiileniv.cryptoauth.model.RefreshToken;
import org.serhiileniv.cryptoauth.model.User;
import org.serhiileniv.cryptoauth.repository.RefreshTokenRepository;
import org.serhiileniv.cryptoauth.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional
    public AuthResponse register(UserDto userDto) {
        if (userDto == null) {
            throw new IllegalArgumentException("User data must not be null");
        }
        if (userRepository.existsUserByEmail(userDto.email())) {
            throw new UserAlreadyExistsException(userDto.email());
        }
        String encodedPassword = passwordEncoder.encode(userDto.password());
        User user = User.builder()
                .email(userDto.email())
                .password(encodedPassword)
                .build();
        user = userRepository.save(user);
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        refreshTokenRepository.save(new RefreshToken(refreshToken, user.getEmail()));
        return new AuthResponse(accessToken, refreshToken);
    }

    @Transactional
    public AuthResponse login(UserDto userDto) {
        User user = userRepository.findUserByEmail(userDto.email())
                .orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(userDto.password(), user.getPassword())) {
            throw new InvalidCredentialsException();
        }
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        refreshTokenRepository.save(new RefreshToken(refreshToken, user.getEmail()));
        return new AuthResponse(accessToken, refreshToken);
    }

    public AuthResponse refreshToken(HttpServletRequest request) {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new TokenException("Refresh token is missing");
        }
        String refreshToken = authHeader.substring(7);
        String userEmail = jwtService.extractUsername(refreshToken);
        if (userEmail != null) {
            refreshTokenRepository.findById(refreshToken)
                    .orElseThrow(() -> new TokenException("Refresh token not found or revoked"));
            User user = userRepository.findUserByEmail(userEmail)
                    .orElseThrow(() -> new InvalidCredentialsException());
            if (jwtService.isTokenValid(refreshToken, user)) {
                String accessToken = jwtService.generateAccessToken(user);
                return new AuthResponse(accessToken, refreshToken);
            }
        }
        throw new TokenException("Invalid refresh token");
    }

    public void logout(HttpServletRequest request) {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String refreshToken = authHeader.substring(7);
            refreshTokenRepository.deleteById(refreshToken);
        }
    }
}
