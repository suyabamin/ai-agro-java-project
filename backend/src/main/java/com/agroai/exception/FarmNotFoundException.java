package com.agroai.exception;

public class FarmNotFoundException extends RuntimeException {

    private final String farmId;

    public FarmNotFoundException(String farmId) {
        super(String.format("Farm with ID '%s' was not found", farmId));
        this.farmId = farmId;
    }

    public String getFarmId() {
        return farmId;
    }
}
