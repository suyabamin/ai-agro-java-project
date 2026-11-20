package com.agroai.model;

import java.time.Instant;

public record AssignmentReviewRevision(
        int revisionNumber,
        int rating,
        String comment,
        Instant editedAt,
        String editedBy
) { }
