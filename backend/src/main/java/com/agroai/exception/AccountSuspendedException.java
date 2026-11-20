package com.agroai.exception;

public class AccountSuspendedException extends RuntimeException {

    public AccountSuspendedException(String message) {
        super(message);
    }

    public AccountSuspendedException() {
        super("Your AgroAI account has been suspended by administration.");
    }
}
