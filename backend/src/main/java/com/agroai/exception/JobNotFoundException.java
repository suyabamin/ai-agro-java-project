package com.agroai.exception;

public class JobNotFoundException extends RuntimeException {
    public JobNotFoundException(String jobId) {
        super("Job posting not found with ID: " + jobId);
    }
}
