package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.PublicJobResponseDTO;
import com.agroai.model.EmploymentType;
import com.agroai.model.JobCategory;
import com.agroai.service.JobService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/public/jobs")
public class PublicJobController {

    private final JobService jobService;

    public PublicJobController(JobService jobService) {
        this.jobService = jobService;
    }

    /**
     * Public endpoint: search and filter active job opportunities with pagination.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<PublicJobResponseDTO>>> browseJobs(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) JobCategory category,
            @RequestParam(required = false) EmploymentType employmentType,
            @RequestParam(required = false) String division,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) Double minSalary,
            @RequestParam(required = false) Double maxSalary,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        List<PublicJobResponseDTO> jobs = jobService.getPublicJobs(
                keyword, category, employmentType, division, district, minSalary, maxSalary, page, size
        );
        return ResponseEntity.ok(ApiResponse.success(jobs, "Public job listings retrieved successfully"));
    }

    /**
     * Public endpoint: retrieve details for a single published job.
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<ApiResponse<PublicJobResponseDTO>> getJobDetail(@PathVariable String jobId) {
        PublicJobResponseDTO job = jobService.getPublicJobById(jobId);
        return ResponseEntity.ok(ApiResponse.success(job, "Public job detail retrieved successfully"));
    }
}
