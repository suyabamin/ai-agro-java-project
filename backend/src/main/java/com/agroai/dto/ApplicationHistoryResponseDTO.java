package com.agroai.dto;

import com.agroai.model.ApplicationHistory;
import com.agroai.model.ApplicationStatus;

import java.time.Instant;

public record ApplicationHistoryResponseDTO(
        String historyId,
        String applicationId,
        String jobId,
        String farmId,
        String applicantUid,
        ApplicationStatus previousStatus,
        ApplicationStatus newStatus,
        String actorUid,
        String actorRole,
        Instant timestamp,
        String reason
) {
    public static ApplicationHistoryResponseDTO fromEntity(ApplicationHistory history) {
        if (history == null) {
            return null;
        }
        return new ApplicationHistoryResponseDTO(
                history.getHistoryId(),
                history.getApplicationId(),
                history.getJobId(),
                history.getFarmId(),
                history.getApplicantUid(),
                history.getPreviousStatus(),
                history.getNewStatus(),
                history.getActorUid(),
                history.getActorRole(),
                history.getTimestamp(),
                history.getReason()
        );
    }
}
