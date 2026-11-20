package com.agroai.dto;

import com.agroai.model.EmploymentType;
import com.agroai.model.JobCategory;
import com.agroai.model.SalaryType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record UpdateJobRequest(
        @NotBlank(message = "Job title is required")
        @Size(min = 3, max = 100, message = "Job title must be between 3 and 100 characters")
        String title,

        @NotBlank(message = "Job description is required")
        @Size(min = 10, max = 4000, message = "Job description must be between 10 and 4000 characters")
        String description,

        @NotNull(message = "Job category is required")
        JobCategory jobCategory,

        @NotNull(message = "Employment type is required")
        EmploymentType employmentType,

        List<String> requiredSkills,

        @Size(max = 500, message = "Experience requirements cannot exceed 500 characters")
        String experienceRequirements,

        @Min(value = 1, message = "Number of positions must be at least 1")
        Integer numberOfPositions,

        SalaryType salaryType,

        @DecimalMin(value = "0.0", message = "Minimum salary cannot be negative")
        Double minimumSalary,

        @DecimalMin(value = "0.0", message = "Maximum salary cannot be negative")
        Double maximumSalary,

        String currency,

        @Size(max = 200, message = "Location summary cannot exceed 200 characters")
        String locationSummary,

        @NotNull(message = "Application deadline is required")
        Instant applicationDeadline,

        Instant startDate,
        Instant endDate,

        @NotNull(message = "Expected version is required for optimistic concurrency control")
        Integer expectedVersion
) {}
