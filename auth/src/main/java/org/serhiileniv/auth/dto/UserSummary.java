package org.serhiileniv.auth.dto;

import org.serhiileniv.auth.model.User;

import java.util.UUID;

public record UserSummary(
        UUID id,
        String email,
        boolean isAdmin
) {
    public static UserSummary fromEntity(User u) {
        return new UserSummary(u.getId(), u.getEmail(), u.isAdmin());
    }
}
