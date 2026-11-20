package com.agroai.model;

import java.time.Instant;
import java.util.List;

/** Private review for one assignment tenure, with 24-hour edit history. */
public record AssignmentReview(
        String assignmentId,
        String farmId,
        String fieldId,
        String authorUid,
        String farmerUid,
        int rating,
        String comment,
        Instant createdAt,
        Instant updatedAt,
        List<AssignmentReviewRevision> revisions
) {
    public AssignmentReview(String assignmentId, String farmId, String fieldId, String authorUid, String farmerUid,
                            int rating, String comment, Instant createdAt) {
        this(assignmentId, farmId, fieldId, authorUid, farmerUid, rating, comment, createdAt, createdAt, List.of());
    }
}
