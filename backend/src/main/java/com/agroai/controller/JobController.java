package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.CreateJobRequest;
import com.agroai.dto.JobResponseDTO;
import com.agroai.dto.UpdateJobRequest;
import com.agroai.model.JobStatus;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.JobService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/farms/{farmId}/jobs")
public class JobController {

    private final JobService jobService;

    public JobController(JobService jobService) {
        this.jobService = jobService;
    }

    /**
     * Creates a new job posting under a farm.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping
    public ResponseEntity<ApiResponse<JobResponseDTO>> createJob(
            @PathVariable String farmId,
            @Valid @RequestBody CreateJobRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobResponseDTO job = jobService.createJob(farmId, request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(job, "Job posting created successfully"));
    }

    /**
     * Lists jobs for a farm.
     * Restricted to active farm members.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping
    public ResponseEntity<ApiResponse<List<JobResponseDTO>>> listFarmJobs(
            @PathVariable String farmId,
            @RequestParam(required = false) JobStatus status,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<JobResponseDTO> jobs = jobService.getJobsByFarm(farmId, status, userDetails);
        return ResponseEntity.ok(ApiResponse.success(jobs, "Farm jobs retrieved successfully"));
    }

    /**
     * Retrieves details for a specific job under a farm.
     * Restricted to active farm members.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping("/{jobId}")
    public ResponseEntity<ApiResponse<JobResponseDTO>> getJob(
            @PathVariable String farmId,
            @PathVariable String jobId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobResponseDTO job = jobService.getJobById(farmId, jobId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(job, "Job retrieved successfully"));
    }

    /**
     * Updates an existing job posting.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PutMapping("/{jobId}")
    public ResponseEntity<ApiResponse<JobResponseDTO>> updateJob(
            @PathVariable String farmId,
            @PathVariable String jobId,
            @Valid @RequestBody UpdateJobRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobResponseDTO updated = jobService.updateJob(farmId, jobId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(updated, "Job updated successfully"));
    }

    /**
     * Publishes a job to the public marketplace.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/{jobId}/publish")
    public ResponseEntity<ApiResponse<JobResponseDTO>> publishJob(
            @PathVariable String farmId,
            @PathVariable String jobId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobResponseDTO published = jobService.publishJob(farmId, jobId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(published, "Job published successfully"));
    }

    /**
     * Pauses an active job posting.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/{jobId}/pause")
    public ResponseEntity<ApiResponse<JobResponseDTO>> pauseJob(
            @PathVariable String farmId,
            @PathVariable String jobId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobResponseDTO paused = jobService.pauseJob(farmId, jobId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(paused, "Job paused successfully"));
    }

    /**
     * Closes an active job posting.
     * Restricted to active OWNER or MANAGER. Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/{jobId}/close")
    public ResponseEntity<ApiResponse<JobResponseDTO>> closeJob(
            @PathVariable String farmId,
            @PathVariable String jobId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        JobResponseDTO closed = jobService.closeJob(farmId, jobId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(closed, "Job closed successfully"));
    }

    /**
     * Archives a job posting.
     * Restricted to active OWNER only! Requires token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PostMapping("/{jobId}/archive")
    public ResponseEntity<ApiResponse<Void>> archiveJob(
            @PathVariable String farmId,
            @PathVariable String jobId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        jobService.archiveJob(farmId, jobId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(null, "Job archived successfully"));
    }
}
