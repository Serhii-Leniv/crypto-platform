package org.serhiileniv.auth.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.serhiileniv.auth.dto.AuthResponse;
import org.serhiileniv.auth.dto.UserDto;
import org.serhiileniv.auth.service.UserService;
import org.serhiileniv.auth.service.UserService.LoginResult;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "User registration, login, JWT issuance, refresh token rotation, and logout")
public class AuthController {
    private final UserService userService;

    private static final int REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

    @PostMapping("/register")
    @Operation(summary = "Register", description = "Creates a new user account and issues an access token. Refresh token is set as an httpOnly cookie. Rate-limited to 3 req/s per IP.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Account created — access token issued", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
        @ApiResponse(responseCode = "400", description = "Validation error (missing/invalid fields)", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "409", description = "Email already registered", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody UserDto request,
            HttpServletResponse response) {
        LoginResult result = userService.register(request);
        setRefreshCookie(response, result.refreshToken());
        return ResponseEntity.ok(new AuthResponse(result.accessToken(), result.isAdmin()));
    }

    @PostMapping("/login")
    @Operation(summary = "Login", description = "Authenticates the user and returns a new access token. Refresh token is set as an httpOnly cookie. Rate-limited to 5 req/s per IP.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Authenticated — access token issued", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
        @ApiResponse(responseCode = "400", description = "Validation error", content = @Content(schema = @Schema(implementation = ProblemDetail.class))),
        @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody UserDto request,
            HttpServletResponse response) {
        LoginResult result = userService.login(request);
        setRefreshCookie(response, result.refreshToken());
        return ResponseEntity.ok(new AuthResponse(result.accessToken(), result.isAdmin()));
    }

    @PostMapping("/logout")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Logout", description = "Revokes the refresh token from Redis and clears the httpOnly cookie.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Logged out — refresh token revoked"),
        @ApiResponse(responseCode = "401", description = "Missing or invalid JWT token", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        userService.logout(request);
        clearRefreshCookie(response);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh token", description = "Exchanges a valid refresh token cookie for a new access token. The refresh token cookie is preserved.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "New access token issued", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
        @ApiResponse(responseCode = "401", description = "Refresh token missing, expired, or revoked", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    })
    public ResponseEntity<AuthResponse> refreshToken(HttpServletRequest request) {
        LoginResult result = userService.refreshToken(request);
        return ResponseEntity.ok(new AuthResponse(result.accessToken(), result.isAdmin()));
    }

    private void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        Cookie cookie = new Cookie("refresh_token", refreshToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // set true when behind HTTPS in prod
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge(REFRESH_TOKEN_MAX_AGE);
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("refresh_token", "");
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/api/v1/auth");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }
}
