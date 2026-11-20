package com.agroai.dto;

import jakarta.validation.constraints.Size;

public record ApplicationDecisionRequest(
        @Size(max = 1000, message = "Decision reason cannot exceed 1000 characters")
        String decisionReason,

        Integer expectedVersion
) {}
