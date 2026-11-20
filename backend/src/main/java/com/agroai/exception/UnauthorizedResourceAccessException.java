package com.agroai.exception;

public class UnauthorizedResourceAccessException extends RuntimeException {

    private final String resourceType;
    private final String resourceId;

    public UnauthorizedResourceAccessException(String message) {
        super(message);
        this.resourceType = "RESOURCE";
        this.resourceId = "UNKNOWN";
    }

    public UnauthorizedResourceAccessException(String resourceType, String resourceId, String message) {
        super(message);
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }

    public String getResourceType() {
        return resourceType;
    }

    public String getResourceId() {
        return resourceId;
    }
}
