package com.agroai.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record CreateAssignmentRequest(
        @NotBlank(message = "Farmer UID is required")
        String farmerUid,

        List<String> permissions,

        String sourceApplicationId,

        String sourceJobId
) {
}
