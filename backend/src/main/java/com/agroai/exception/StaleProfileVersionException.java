package com.agroai.exception;

public class StaleProfileVersionException extends RuntimeException {

    private final int expectedVersion;
    private final int currentVersion;

    public StaleProfileVersionException(int expectedVersion, int currentVersion) {
        super(String.format("Stale profile version: expected %d but current is %d", expectedVersion, currentVersion));
        this.expectedVersion = expectedVersion;
        this.currentVersion = currentVersion;
    }

    public int getExpectedVersion() {
        return expectedVersion;
    }

    public int getCurrentVersion() {
        return currentVersion;
    }
}
