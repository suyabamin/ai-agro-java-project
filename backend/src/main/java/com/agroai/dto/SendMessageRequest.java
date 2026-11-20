package com.agroai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
        @NotBlank(message = "Message content is required")
        @Size(min = 1, max = 2000, message = "Message content must be between 1 and 2000 characters")
        String content
) {}
