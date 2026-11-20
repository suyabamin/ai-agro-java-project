package com.agroai.exception;

public class AssignmentNotFoundException extends RuntimeException {
    public AssignmentNotFoundException(String message) {
        super(message);
    }

    public static AssignmentNotFoundException forId(String assignmentId) {
        return new AssignmentNotFoundException("Field assignment not found with ID: " + assignmentId);
    }
}
