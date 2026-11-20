package com.agroai.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateApplicationRequest(
        @NotBlank(message = "Cover letter is required")
        @Size(min = 10, max = 3000, message = "Cover letter must be between 10 and 3000 characters")
        String coverLetter,

        @Size(max = 1000, message = "Relevant experience cannot exceed 1000 characters")
        String relevantExperience,

        List<String> skills,

        @Size(max = 200, message = "Availability note cannot exceed 200 characters")
        String availability,

        @DecimalMin(value = "0.0", message = "Expected salary cannot be negative")
        Double expectedSalary
) {}
