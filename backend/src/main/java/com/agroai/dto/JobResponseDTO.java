package com.agroai.dto;

import com.agroai.model.EmploymentType;
import com.agroai.model.Job;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import com.agroai.model.SalaryType;

import java.time.Instant;
import java.util.List;

public record JobResponseDTO(
        String jobId,
        String farmId,
        String title,
        String description,
        JobCategory jobCategory,
        EmploymentType employmentType,
        List<String> requiredSkills,
        String experienceRequirements,
        int numberOfPositions,
        SalaryType salaryType,
        Double minimumSalary,
        Double maximumSalary,
        String currency,
        String locationSummary,
        Instant applicationDeadline,
        Instant startDate,
        Instant endDate,
        JobStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant publishedAt,
        Instant closedAt,
        Instant archivedAt,
        int version,
        int totalApplicationsCount
) {
    public static JobResponseDTO fromEntity(Job job) {
        if (job == null) {
            return null;
        }
        return new JobResponseDTO(
                job.getJobId(),
                job.getFarmId(),
                job.getTitle(),
                job.getDescription(),
                job.getJobCategory(),
                job.getEmploymentType(),
                job.getRequiredSkills(),
                job.getExperienceRequirements(),
                job.getNumberOfPositions(),
                job.getSalaryType(),
                job.getMinimumSalary(),
                job.getMaximumSalary(),
                job.getCurrency(),
                job.getLocationSummary(),
                job.getApplicationDeadline(),
                job.getStartDate(),
                job.getEndDate(),
                job.getStatus(),
                job.getCreatedBy(),
                job.getCreatedAt(),
                job.getUpdatedAt(),
                job.getPublishedAt(),
                job.getClosedAt(),
                job.getArchivedAt(),
                job.getVersion(),
                job.getTotalApplicationsCount()
        );
    }
}
