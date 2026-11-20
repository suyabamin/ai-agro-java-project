package com.agroai.dto;

import com.agroai.model.ApplicationMessage;

import java.time.Instant;

public record ApplicationMessageResponseDTO(
        String messageId,
        String applicationId,
        String jobId,
        String farmId,
        String senderUid,
        String senderRole,
        String senderName,
        String content,
        Instant sentAt
) {
    public static ApplicationMessageResponseDTO fromEntity(ApplicationMessage message) {
        if (message == null) {
            return null;
        }
        return new ApplicationMessageResponseDTO(
                message.getMessageId(),
                message.getApplicationId(),
                message.getJobId(),
                message.getFarmId(),
                message.getSenderUid(),
                message.getSenderRole(),
                message.getSenderName(),
                message.getContent(),
                message.getSentAt()
        );
    }
}
