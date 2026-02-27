package org.serhiileniv.cryptoauth.service;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.serhiileniv.cryptoauth.dto.AuthResponse;
import org.serhiileniv.cryptoauth.dto.UserDto;
import org.serhiileniv.cryptoauth.exception.InvalidCredentialsException;
import org.serhiileniv.cryptoauth.exception.TokenException;
import org.serhiileniv.cryptoauth.exception.UserAlreadyExistsException;
import org.serhiileniv.cryptoauth.model.RefreshToken;
import org.serhiileniv.cryptoauth.model.User;
import org.serhiileniv.cryptoauth.repository.RefreshTokenRepository;
import org.serhiileniv.cryptoauth.repository.UserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private JwtService jwtService;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private UserDto userDto;
    private User user;

    @BeforeEach
    void setUp() {
        userDto = new UserDto("test@example.com", "password123");
        user = User.builder()
                .id(UUID.randomUUID())
                .email("test@example.com")
                .password("encodedPassword")
                .build();
    }

    @Test
    void register_Success() {
        when(userRepository.existsUserByEmail(userDto.email())).thenReturn(false);
        when(passwordEncoder.encode(userDto.password())).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenReturn(user);
        when(jwtService.generateAccessToken(any())).thenReturn("accessToken");
        when(jwtService.generateRefreshToken(any())).thenReturn("refreshToken");

        AuthResponse response = userService.register(userDto);

        assertNotNull(response);
        assertEquals("accessToken", response.accessToken());
        assertEquals("refreshToken", response.refreshToken());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void register_UserAlreadyExists() {
        when(userRepository.existsUserByEmail(userDto.email())).thenReturn(true);

        assertThrows(UserAlreadyExistsException.class, () -> userService.register(userDto));
        verify(userRepository, never()).save(any());
    }

    @Test
    void login_Success() {
        when(userRepository.findUserByEmail(userDto.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(userDto.password(), user.getPassword())).thenReturn(true);
        when(jwtService.generateAccessToken(user)).thenReturn("accessToken");
        when(jwtService.generateRefreshToken(user)).thenReturn("refreshToken");

        AuthResponse response = userService.login(userDto);

        assertNotNull(response);
        assertEquals("accessToken", response.accessToken());
        verify(userRepository).findUserByEmail(userDto.email());
    }

    @Test
    void login_InvalidCredentials_EmailNotFound() {
        when(userRepository.findUserByEmail(userDto.email())).thenReturn(Optional.empty());

        assertThrows(InvalidCredentialsException.class, () -> userService.login(userDto));
    }

    @Test
    void login_InvalidCredentials_WrongPassword() {
        when(userRepository.findUserByEmail(userDto.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(userDto.password(), user.getPassword())).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> userService.login(userDto));
    }

    @Test
    void refreshToken_Success() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        String authHeader = "Bearer refreshToken";
        when(request.getHeader(HttpHeaders.AUTHORIZATION)).thenReturn(authHeader);
        when(jwtService.extractUsername("refreshToken")).thenReturn("test@example.com");
        when(refreshTokenRepository.findById("refreshToken")).thenReturn(Optional.of(new RefreshToken()));
        when(userRepository.findUserByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(jwtService.isTokenValid("refreshToken", user)).thenReturn(true);
        when(jwtService.generateAccessToken(user)).thenReturn("newAccessToken");

        AuthResponse response = userService.refreshToken(request);

        assertEquals("newAccessToken", response.accessToken());
        assertEquals("refreshToken", response.refreshToken());
    }

    @Test
    void refreshToken_MissingHeader() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader(HttpHeaders.AUTHORIZATION)).thenReturn(null);

        assertThrows(TokenException.class, () -> userService.refreshToken(request));
    }
}
