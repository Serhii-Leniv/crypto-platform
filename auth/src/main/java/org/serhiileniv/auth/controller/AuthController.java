package org.serhiileniv.auth.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.serhiileniv.auth.dto.AuthResponse;
import org.serhiileniv.auth.dto.UserDto;
import org.serhiileniv.auth.service.UserService;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "User registration, login, JWT issuance, refresh token rotation, and logout")
public class AuthController {
    private final UserService userService;

    @PostMapping("/register")
    @Operation(summary = "Register", description = "Creates a new user account and issues an access + refresh token pair. Rate-limited to 3 req/s per IP.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Account created — tokens issued", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
        @ApiResponse(responseCode = "400", description = "Validation error (missing/invalid fields)", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Email already registered", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody UserDto request) {
        return ResponseEntity.ok(userService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Login", description = "Authenticates the user and returns a new access + refresh token pair. Rate-limited to 5 req/s per IP.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Authenticated — tokens issued", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
        @ApiResponse(responseCode = "400", description = "Validation error", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody UserDto request) {
        return ResponseEntity.ok(userService.login(request));
    }

    @PostMapping("/logout")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Logout", description = "Revokes the refresh token stored in Redis. The access token expires naturally after 15 minutes.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Logged out — refresh token revoked"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        userService.logout(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh token", description = "Exchanges a valid refresh token for a new access + refresh token pair (rotation). The old refresh token is invalidated.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "New tokens issued", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
        @ApiResponse(responseCode = "401", description = "Refresh token missing, expired, or revoked", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<AuthResponse> refreshToken(HttpServletRequest request) {
        return ResponseEntity.ok(userService.refreshToken(request));
    }
}
