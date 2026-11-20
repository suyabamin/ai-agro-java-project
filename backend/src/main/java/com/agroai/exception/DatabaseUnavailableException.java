package com.agroai.exception;

/**
 * Thrown when Cloud Firestore or persistent storage is unavailable in production,
 * guaranteeing fail-closed behavior instead of silent in-memory fallback.
 */
public class DatabaseUnavailableException extends RuntimeException {

    public DatabaseUnavailableException(String message) {
        super(message);
    }

    public DatabaseUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
