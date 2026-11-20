package com.agroai.exception;

public class EmailVerificationRequiredException extends RuntimeException {

    public EmailVerificationRequiredException(String message) {
        super(message);
    }

    public EmailVerificationRequiredException() {
        super("Email verification is required before executing privileged agricultural operations.");
    }
}
