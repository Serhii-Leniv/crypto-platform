package org.serhiileniv.auth.dto;

import org.serhiileniv.auth.model.User;
import java.util.UUID;

public record UserAdminResponse(UUID id, String email, String role) {
    public static UserAdminResponse from(User user) {
        return new UserAdminResponse(user.getId(), user.getEmail(), user.getRole().name());
    }
}
