package com.agroai.dto;

import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.MembershipStatus;

import java.time.Instant;

public record FarmMemberResponseDTO(
        String membershipId,
        String farmId,
        String userId,
        FarmRole role,
        MembershipStatus status,
        Instant joinedAt,
        Instant updatedAt
) {
    public static FarmMemberResponseDTO fromEntity(FarmMembership m) {
        if (m == null) {
            return null;
        }
        return new FarmMemberResponseDTO(
                m.getMembershipId(),
                m.getFarmId(),
                m.getUserId(),
                m.getRole(),
                m.getStatus(),
                m.getJoinedAt(),
                m.getUpdatedAt()
        );
    }
}
