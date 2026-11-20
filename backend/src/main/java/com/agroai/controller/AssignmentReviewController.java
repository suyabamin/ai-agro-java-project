package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.CreateAssignmentReviewRequest;
import com.agroai.dto.UpdateAssignmentReviewRequest;
import com.agroai.model.AssignmentReview;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.AssignmentReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/v1/assignments/{assignmentId}/review")
public class AssignmentReviewController {
    private final AssignmentReviewService service;

    public AssignmentReviewController(AssignmentReviewService service) { this.service = service; }

    @RequiresRevocationCheck
    @PostMapping
    public ResponseEntity<ApiResponse<AssignmentReview>> create(@PathVariable String assignmentId,
            @Valid @RequestBody CreateAssignmentReviewRequest request,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        AssignmentReview review = service.create(assignmentId, request, user.getUid());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(review, "Assignment review recorded"));
    }

    @RequiresRevocationCheck
    @PutMapping
    public ResponseEntity<ApiResponse<AssignmentReview>> update(@PathVariable String assignmentId,
            @Valid @RequestBody UpdateAssignmentReviewRequest request,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        AssignmentReview review = service.update(assignmentId, request, user.getUid());
        return ResponseEntity.ok(ApiResponse.success(review, "Assignment review updated"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<AssignmentReview>> get(@PathVariable String assignmentId,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        Optional<AssignmentReview> review = service.find(assignmentId, user.getUid());
        return review.map(value -> ResponseEntity.ok(ApiResponse.success(value, "Assignment review retrieved")))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.failure("No review exists for this assignment tenure")));
    }
}
