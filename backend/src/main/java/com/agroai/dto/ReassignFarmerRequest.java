package com.agroai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReassignFarmerRequest(
        @NotBlank(message = "New farmer UID is required")
        String newFarmerUid,

        @NotBlank(message = "Reassignment reason is required")
        @Size(min = 3, max = 500, message = "Reassignment reason must be between 3 and 500 characters")
        String releaseReason,

        List<String> permissions,

        Integer expectedVersion,

        String sourceApplicationId
) {
}
