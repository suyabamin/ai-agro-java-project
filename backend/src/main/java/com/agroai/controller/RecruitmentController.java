package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.ApplicationDecisionRequest;
import com.agroai.dto.JobApplicationResponseDTO;
import com.agroai.model.ApplicationStatus;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.JobApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/v1/farms/{farmId}/applications")
public class RecruitmentController {

    private final JobApplicationService applicationService;

    public RecruitmentController(JobApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /**
     * Lists applications received for a farm's job postings.
     * Restricted to active OWNER or MANAGER.
     */
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @GetMapping
    public ResponseEntity<ApiResponse<List<JobApplicationResponseDTO>>> listApplications(
            @PathVariable String farmId,
            @RequestParam(required = false) String jobId,
            @RequestParam(required = false) ApplicationStatus status,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<JobApplicationResponseDTO> apps = applicationService.getApplicationsByFarm(farmId, jobId, status, userDetails);
        return ResponseEntity.ok(ApiResponse.success(apps, "Farm applications retrieved successfully"));
    }

    /**
     * Retrieves application details for review.
     * Restricted to active OWNER or MANAGER.
     */
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @GetMapping("/{applicationId}")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> getApplication(
            @PathVariable String farmId,
            @PathVariable String applicationId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.getApplicationById(applicationId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(app, "Application details retrieved successfully"));
    }

    /**
     * Marks an application as UNDER_REVIEW.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/{applicationId}/review")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> review(
            @PathVariable String farmId,
            @PathVariable String applicationId,
            @Valid @RequestBody(required = false) ApplicationDecisionRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.reviewApplication(farmId, applicationId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(app, "Application marked as under review"));
    }

    /**
     * Shortlists a candidate application.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/{applicationId}/shortlist")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> shortlist(
            @PathVariable String farmId,
            @PathVariable String applicationId,
            @Valid @RequestBody(required = false) ApplicationDecisionRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.shortlistApplication(farmId, applicationId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(app, "Candidate shortlisted successfully"));
    }

    /**
     * Approves a candidate application.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     *
     * CRITICAL BUSINESS INVARIANT: Application approval DOES NOT create field assignments.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/{applicationId}/approve")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> approve(
            @PathVariable String farmId,
            @PathVariable String applicationId,
            @Valid @RequestBody(required = false) ApplicationDecisionRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.approveApplication(farmId, applicationId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(app, "Application approved successfully"));
    }

    /**
     * Rejects a candidate application.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/{applicationId}/reject")
    public ResponseEntity<ApiResponse<JobApplicationResponseDTO>> reject(
            @PathVariable String farmId,
            @PathVariable String applicationId,
            @Valid @RequestBody(required = false) ApplicationDecisionRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobApplicationResponseDTO app = applicationService.rejectApplication(farmId, applicationId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(app, "Application rejected"));
    }
}
