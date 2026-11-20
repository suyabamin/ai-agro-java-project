package com.agroai.dto;

import com.agroai.model.AssignmentStatus;
import com.agroai.model.FieldAssignment;

import java.time.Instant;
import java.util.List;

public record FieldAssignmentResponseDTO(
        String assignmentId,
        String farmId,
        String fieldId,
        String farmerUid,
        String farmerSafeUid,
        String farmerName,
        AssignmentStatus status,
        List<String> permissions,
        String assignedByUid,
        String sourceApplicationId,
        String sourceJobId,
        Instant assignedAt,
        Instant updatedAt,
        Instant releasedAt,
        String releasedByUid,
        String releaseReason,
        Integer version
) {
    public static FieldAssignmentResponseDTO fromEntity(FieldAssignment a) {
        if (a == null) {
            return null;
        }
        return new FieldAssignmentResponseDTO(
                a.getAssignmentId(),
                a.getFarmId(),
                a.getFieldId(),
                a.getFarmerUid(),
                a.getFarmerSafeUid(),
                a.getFarmerName(),
                a.getStatus(),
                a.getPermissions(),
                a.getAssignedByUid(),
                a.getSourceApplicationId(),
                a.getSourceJobId(),
                a.getAssignedAt(),
                a.getUpdatedAt(),
                a.getReleasedAt(),
                a.getReleasedByUid(),
                a.getReleaseReason(),
                a.getVersion()
        );
    }
}
