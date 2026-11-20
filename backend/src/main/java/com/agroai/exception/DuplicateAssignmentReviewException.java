package com.agroai.exception;

public class DuplicateAssignmentReviewException extends RuntimeException {
    public DuplicateAssignmentReviewException(String assignmentId) {
        super("A review already exists for assignment tenure: " + assignmentId);
    }
}
