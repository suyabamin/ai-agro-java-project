package com.agroai.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateFarmRequest(
        @NotBlank(message = "Farm name is required")
        @Size(min = 3, max = 100, message = "Farm name must be between 3 and 100 characters")
        String name,

        @Size(max = 500, message = "Description cannot exceed 500 characters")
        String description,

        @NotBlank(message = "District is required")
        @Size(min = 2, max = 50, message = "District must be between 2 and 50 characters")
        String district,

        @NotBlank(message = "Division is required")
        @Size(min = 2, max = 50, message = "Division must be between 2 and 50 characters")
        String division,

        @Size(max = 200, message = "Detailed address cannot exceed 200 characters")
        String detailedAddress,

        @NotNull(message = "Total area is required")
        @DecimalMin(value = "0.1", message = "Total area must be at least 0.1 hectares")
        @DecimalMax(value = "100000.0", message = "Total area cannot exceed 100,000 hectares")
        Double totalAreaHectares,

        @NotNull(message = "Expected version is required for optimistic concurrency")
        Integer expectedVersion
) {
}
