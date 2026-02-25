package org.serhiileniv.cryptoauth.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.serhiileniv.cryptoauth.dto.AuthResponse;
import org.serhiileniv.cryptoauth.dto.UserDto;
import org.serhiileniv.cryptoauth.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Endpoints for user registration, login, and token management")
public class AuthController {
    private final UserService userService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user", description = "Creates a new user account and returns JWT tokens")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody UserDto request) {
        return ResponseEntity.ok(userService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "User login", description = "Authenticates user and returns JWT tokens")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody UserDto request) {
        return ResponseEntity.ok(userService.login(request));
    }

    @PostMapping("/logout")
    @Operation(summary = "User logout", description = "Revokes access and refresh tokens")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        userService.logout(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh token", description = "Obtains a new access token using a valid refresh token")
    public ResponseEntity<AuthResponse> refreshToken(HttpServletRequest request) {
        return ResponseEntity.ok(userService.refreshToken(request));
    }
}
