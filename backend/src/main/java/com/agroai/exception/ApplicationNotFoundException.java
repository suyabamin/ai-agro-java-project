package com.agroai.exception;

public class ApplicationNotFoundException extends RuntimeException {
    public ApplicationNotFoundException(String applicationId) {
        super("Job application not found with ID: " + applicationId);
    }
}
