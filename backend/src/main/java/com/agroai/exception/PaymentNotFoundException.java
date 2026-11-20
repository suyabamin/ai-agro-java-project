package com.agroai.exception;

public class PaymentNotFoundException extends RuntimeException {
    public PaymentNotFoundException(String paymentId) {
        super("Payment record not found: " + paymentId);
    }
}
