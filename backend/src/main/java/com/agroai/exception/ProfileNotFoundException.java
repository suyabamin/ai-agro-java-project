package com.agroai.exception;

public class ProfileNotFoundException extends RuntimeException {

    public ProfileNotFoundException(String message) {
        super(message);
    }

    public ProfileNotFoundException(String uid, boolean uninitialized) {
        super("User profile has not been initialized for UID: " + uid);
    }
}
