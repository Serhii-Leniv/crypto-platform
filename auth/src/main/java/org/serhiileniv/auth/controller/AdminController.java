package org.serhiileniv.auth.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.serhiileniv.auth.dto.UserSummary;
import org.serhiileniv.auth.repository.UserRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;

/**
 * Admin endpoints exposed under /api/v1/admin/**.
 * Gateway gates them with `JwtAuthenticationFilter=true` (requireAdmin), so the service
 * trusts that any request reaching here was already verified as an admin.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin")
public class AdminController {

    private final UserRepository userRepository;

    @GetMapping("/users")
    @Operation(summary = "List all users (admin only)")
    public List<UserSummary> listUsers() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(u -> u.getEmail()))
                .map(UserSummary::fromEntity)
                .toList();
    }
}
