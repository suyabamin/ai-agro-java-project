package com.agroai.dto;

import com.agroai.model.FarmVisibility;
import jakarta.validation.constraints.NotNull;

public record UpdateFarmVisibilityRequest(
        @NotNull(message = "Visibility is required")
        FarmVisibility visibility,

        @NotNull(message = "Expected version is required for optimistic concurrency")
        Integer expectedVersion
) {
}
