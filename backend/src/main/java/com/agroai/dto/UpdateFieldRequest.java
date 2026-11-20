package com.agroai.dto;

import com.agroai.model.CropType;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.SoilType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateFieldRequest(
        @NotBlank(message = "Field name is required")
        @Size(min = 2, max = 80, message = "Field name must be between 2 and 80 characters")
        String name,

        CropType cropType,
        SoilType soilType,
        IrrigationType irrigationType,

        @NotNull(message = "Area in hectares is required")
        @DecimalMin(value = "0.01", message = "Field area must be at least 0.01 hectares")
        @DecimalMax(value = "10000.0", message = "Field area cannot exceed 10000.0 hectares")
        Double areaHectares,

        FieldStatus status,

        @Size(max = 500, message = "Notes cannot exceed 500 characters")
        String notes,

        @NotNull(message = "Expected version is required for optimistic concurrency control")
        Integer expectedVersion
) {}
