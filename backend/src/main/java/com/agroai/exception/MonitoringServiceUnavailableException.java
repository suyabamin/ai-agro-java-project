package com.agroai.exception;

public class MonitoringServiceUnavailableException extends RuntimeException {
    public MonitoringServiceUnavailableException(String message) { super(message); }
    public MonitoringServiceUnavailableException(String message, Throwable cause) { super(message, cause); }
}
