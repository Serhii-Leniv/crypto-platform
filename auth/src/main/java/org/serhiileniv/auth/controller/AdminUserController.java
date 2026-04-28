package org.serhiileniv.auth.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.serhiileniv.auth.dto.UpdateRoleRequest;
import org.serhiileniv.auth.dto.UserAdminResponse;
import org.serhiileniv.auth.model.Role;
import org.serhiileniv.auth.model.User;
import org.serhiileniv.auth.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@Slf4j
public class AdminUserController {

    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<UserAdminResponse>> getAllUsers() {
        log.info("Admin: listing all users");
        List<UserAdminResponse> users = userRepository.findAll().stream()
                .map(UserAdminResponse::from)
                .toList();
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/{id}/role")
    public ResponseEntity<UserAdminResponse> updateRole(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRoleRequest request) {
        log.info("Admin: updating role for user {} to {}", id, request.role());
        User user = userRepository.findUserById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        try {
            user.setRole(Role.valueOf(request.role().toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role: " + request.role());
        }
        userRepository.save(user);
        log.info("Admin: role updated for user {} to {}", id, user.getRole());
        return ResponseEntity.ok(UserAdminResponse.from(user));
    }
}
