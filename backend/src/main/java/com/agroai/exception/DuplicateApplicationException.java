package com.agroai.exception;

public class DuplicateApplicationException extends RuntimeException {
    public DuplicateApplicationException(String jobId, String applicantUid) {
        super("User '" + applicantUid + "' has already applied for job '" + jobId + "'");
    }
}
