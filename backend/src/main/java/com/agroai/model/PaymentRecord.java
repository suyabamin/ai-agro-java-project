package com.agroai.model;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Manual payment record for farm work or field assignment compensation.
 * Manual records only; does not prove or represent automated banking or digital transfer.
 */
public record PaymentRecord(
        String paymentId,
        String farmId,
        String assignmentId,
        PaymentScope scope,
        String payerUid,
        String payerName,
        String farmerUid,
        String farmerName,
        BigDecimal amount,
        String currency,
        Instant paymentDate,
        String purpose,
        String notes,
        PaymentStatus status,
        Instant createdAt,
        String createdBy,
        Instant reversedAt,
        String reversedBy,
        String reversalReason,
        int version
) { }
