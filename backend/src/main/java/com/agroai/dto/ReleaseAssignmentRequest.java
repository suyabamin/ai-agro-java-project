package com.agroai.dto;

import jakarta.validation.constraints.Size;

public record ReleaseAssignmentRequest(
        @Size(max = 500, message = "Release reason cannot exceed 500 characters")
        String releaseReason,

        Integer expectedVersion
) {
}
