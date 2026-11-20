package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.RecordPaymentRequest;
import com.agroai.dto.ReversePaymentRequest;
import com.agroai.model.PaymentRecord;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class PaymentController {
    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @RequiresRevocationCheck
    @PostMapping("/farms/{farmId}/payments")
    public ResponseEntity<ApiResponse<PaymentRecord>> recordPayment(
            @PathVariable String farmId,
            @Valid @RequestBody RecordPaymentRequest request,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        PaymentRecord payment = paymentService.recordPayment(farmId, request, user.getUid());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(payment, "Manual payment entry recorded successfully"));
    }

    @GetMapping("/farms/{farmId}/payments")
    public ResponseEntity<ApiResponse<List<PaymentRecord>>> listFarmPayments(
            @PathVariable String farmId,
            @RequestParam(required = false) String farmerUid,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        List<PaymentRecord> payments = paymentService.listFarmPayments(farmId, farmerUid, user.getUid(), limit);
        return ResponseEntity.ok(ApiResponse.success(payments, "Farm payments retrieved"));
    }

    @GetMapping("/assignments/{assignmentId}/payments")
    public ResponseEntity<ApiResponse<List<PaymentRecord>>> listAssignmentPayments(
            @PathVariable String assignmentId,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        List<PaymentRecord> payments = paymentService.listAssignmentPayments(assignmentId, user.getUid(), limit);
        return ResponseEntity.ok(ApiResponse.success(payments, "Assignment payments retrieved"));
    }

    @GetMapping("/payments/my")
    public ResponseEntity<ApiResponse<List<PaymentRecord>>> listMyPayments(
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        List<PaymentRecord> payments = paymentService.listMyPayments(user.getUid(), limit);
        return ResponseEntity.ok(ApiResponse.success(payments, "My payments retrieved"));
    }

    @GetMapping("/payments/{paymentId}")
    public ResponseEntity<ApiResponse<PaymentRecord>> getPayment(
            @PathVariable String paymentId,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        PaymentRecord payment = paymentService.getPayment(paymentId, user.getUid());
        return ResponseEntity.ok(ApiResponse.success(payment, "Payment record retrieved"));
    }

    @RequiresRevocationCheck
    @PostMapping("/payments/{paymentId}/reverse")
    public ResponseEntity<ApiResponse<PaymentRecord>> reversePayment(
            @PathVariable String paymentId,
            @Valid @RequestBody ReversePaymentRequest request,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        PaymentRecord payment = paymentService.reversePayment(paymentId, request, user.getUid());
        return ResponseEntity.ok(ApiResponse.success(payment, "Payment record reversed with audit trail"));
    }
}
