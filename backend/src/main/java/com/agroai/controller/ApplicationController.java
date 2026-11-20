package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.ApplicationHistoryResponseDTO;
import com.agroai.dto.ApplicationMessageResponseDTO;
import com.agroai.dto.CreateApplicationRequest;
import com.agroai.dto.JobApplicationResponseDTO;
import com.agroai.dto.SendMessageRequest;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.JobApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ApplicationController {

    private final JobApplicationService applicationService;

    public ApplicationController(JobApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /**
     * Submits an application for a published job.
     * Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PostMapping("/api/v1/jobs/{jobId}/applications")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> apply(
            @PathVariable String jobId,
            @Valid @RequestBody CreateApplicationRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.applyForJob(jobId, request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(app, "Application submitted successfully"));
    }

    /**
     * Lists all applications submitted by the current authenticated user.
     */
    @GetMapping("/api/v1/users/me/applications")
    public ResponseEntity<ApiResponse<List<JobApplicationResponseDTO>>> getMyApplications(
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<JobApplicationResponseDTO> apps = applicationService.getMyApplications(userDetails);
        return ResponseEntity.ok(ApiResponse.success(apps, "My applications retrieved successfully"));
    }

    /**
     * Retrieves application details by ID. Restricted to applicant or active farm members.
     */
    @GetMapping("/api/v1/applications/{applicationId}")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> getApplication(
            @PathVariable String applicationId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.getApplicationById(applicationId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(app, "Application retrieved successfully"));
    }

    /**
     * Candidate withdraws their own application. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PostMapping("/api/v1/applications/{applicationId}/withdraw")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> withdraw(
            @PathVariable String applicationId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.withdrawApplication(applicationId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(app, "Application withdrawn successfully"));
    }

    /**
     * Retrieves the audit trail of status transitions for an application.
     */
    @GetMapping("/api/v1/applications/{applicationId}/history")
    public ResponseEntity<ApiResponse<List<ApplicationHistoryResponseDTO>>> getHistory(
            @PathVariable String applicationId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<ApplicationHistoryResponseDTO> history = applicationService.getApplicationHistory(applicationId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(history, "Application history retrieved successfully"));
    }

    /**
     * Sends a message within the application discussion thread.
     */
    @RequiresRevocationCheck
    @PostMapping("/api/v1/applications/{applicationId}/messages")
    public ResponseEntity<ApiResponse<ApplicationMessageResponseDTO>> sendMessage(
            @PathVariable String applicationId,
            @Valid @RequestBody SendMessageRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        ApplicationMessageResponseDTO msg = applicationService.sendMessage(applicationId, request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(msg, "Message sent successfully"));
    }

    /**
     * Retrieves messages within the application discussion thread.
     */
    @GetMapping("/api/v1/applications/{applicationId}/messages")
    public ResponseEntity<ApiResponse<List<ApplicationMessageResponseDTO>>> getMessages(
            @PathVariable String applicationId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<ApplicationMessageResponseDTO> msgs = applicationService.getMessages(applicationId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(msgs, "Application messages retrieved successfully"));
    }
}
