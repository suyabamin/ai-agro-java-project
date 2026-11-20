package com.agroai.dto;

import com.agroai.model.ApplicationStatus;
import com.agroai.model.JobApplication;

import java.time.Instant;
import java.util.List;

public record JobApplicationResponseDTO(
        String applicationId,
        String jobId,
        String farmId,
        String applicantUid,
        String applicantName,
        String applicantEmail,
        String applicantPhone,
        String coverLetter,
        String relevantExperience,
        List<String> skills,
        String availability,
        Double expectedSalary,
        ApplicationStatus status,
        Instant submittedAt,
        Instant updatedAt,
        Instant reviewedAt,
        String reviewedBy,
        String decisionReason,
        int version
) {
    public static JobApplicationResponseDTO fromEntity(JobApplication app) {
        if (app == null) {
            return null;
        }
        return new JobApplicationResponseDTO(
                app.getApplicationId(),
                app.getJobId(),
                app.getFarmId(),
                app.getApplicantUid(),
                app.getApplicantName(),
                app.getApplicantEmail(),
                app.getApplicantPhone(),
                app.getCoverLetter(),
                app.getRelevantExperience(),
                app.getSkills(),
                app.getAvailability(),
                app.getExpectedSalary(),
                app.getStatus(),
                app.getSubmittedAt(),
                app.getUpdatedAt(),
                app.getReviewedAt(),
                app.getReviewedBy(),
                app.getDecisionReason(),
                app.getVersion()
        );
    }
}
