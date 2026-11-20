package com.agroai.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

public record RecordPaymentRequest(
        String assignmentId,
        @NotBlank String farmerUid,
        @NotNull @DecimalMin(value = "0.01", message = "Amount must be greater than zero") BigDecimal amount,
        @NotBlank String currency,
        @NotNull Instant paymentDate,
        @NotBlank @Size(max = 255) String purpose,
        @Size(max = 1000) String notes
) { }
