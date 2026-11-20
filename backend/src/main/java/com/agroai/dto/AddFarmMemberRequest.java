package com.agroai.dto;

import com.agroai.model.FarmRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AddFarmMemberRequest(
        @NotBlank(message = "User ID is required")
        String userId,

        @NotNull(message = "Role is required")
        FarmRole role
) {
}
