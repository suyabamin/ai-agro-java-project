package com.agroai.dto;

import com.agroai.model.EmploymentType;
import com.agroai.model.Job;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import com.agroai.model.SalaryType;

import java.time.Instant;
import java.util.List;

public record PublicJobResponseDTO(
        String jobId,
        String farmId,
        String farmName,
        String farmDistrict,
        String farmDivision,
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
        Instant publishedAt
) {
    public static PublicJobResponseDTO fromEntity(Job job, String farmName, String district, String division) {
        if (job == null) {
            return null;
        }
        return new PublicJobResponseDTO(
                job.getJobId(),
                job.getFarmId(),
                farmName,
                district,
                division,
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
                job.getPublishedAt()
        );
    }
}
