package com.agroai.dto;

import com.agroai.model.AssignmentHistory;

import java.time.Instant;

public record AssignmentHistoryResponseDTO(
        String historyId,
        String assignmentId,
        String farmId,
        String fieldId,
        String farmerUid,
        String farmerName,
        String eventType,
        String performedByUid,
        String performedByRole,
        String reason,
        String sourceApplicationId,
        Instant timestamp
) {
    public static AssignmentHistoryResponseDTO fromEntity(AssignmentHistory h) {
        if (h == null) {
            return null;
        }
        return new AssignmentHistoryResponseDTO(
                h.getHistoryId(),
                h.getAssignmentId(),
                h.getFarmId(),
                h.getFieldId(),
                h.getFarmerUid(),
                h.getFarmerName(),
                h.getEventType(),
                h.getPerformedByUid(),
                h.getPerformedByRole(),
                h.getReason(),
                h.getSourceApplicationId(),
                h.getTimestamp()
        );
    }
}
