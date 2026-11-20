package com.agroai.dto;

import java.time.Instant;
import java.util.UUID;

public class ApiResponse<T> {
    private boolean success;
    private T data;
    private String message;
    private String requestId;
    private Instant timestamp;

    public ApiResponse() {
    }

    public ApiResponse(boolean success, T data, String message, String requestId) {
        this.success = success;
        this.data = data;
        this.message = message;
        this.requestId = requestId != null ? requestId : UUID.randomUUID().toString();
        this.timestamp = Instant.now();
    }

    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(true, data, message, UUID.randomUUID().toString());
    }

    public static <T> ApiResponse<T> failure(String message) {
        return new ApiResponse<>(false, null, message, UUID.randomUUID().toString());
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
