package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.AssignmentHistoryResponseDTO;
import com.agroai.dto.CursorPageResponse;
import com.agroai.dto.CreateAssignmentRequest;
import com.agroai.dto.FieldAssignmentResponseDTO;
import com.agroai.dto.ReassignFarmerRequest;
import com.agroai.dto.ReleaseAssignmentRequest;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.FieldAssignmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@RestController
@RequestMapping("/api/v1/farms/{farmId}")
public class FieldAssignmentController {

    private final FieldAssignmentService assignmentService;

    public FieldAssignmentController(FieldAssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    /**
     * Assigns a farmer to a field.
     * Restricted to active farm OWNER or MANAGER.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/fields/{fieldId}/assignments")
    public ResponseEntity<ApiResponse<FieldAssignmentResponseDTO>> createAssignment(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @Valid @RequestBody CreateAssignmentRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FieldAssignmentResponseDTO created = assignmentService.createAssignment(farmId, fieldId, request, userDetails.getUid());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Farmer successfully assigned to field"));
    }

    /**
     * Lists assignments for a specific field.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping("/fields/{fieldId}/assignments")
    public ResponseEntity<ApiResponse<CursorPageResponse<FieldAssignmentResponseDTO>>> getFieldAssignments(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") Integer size,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        CursorPageResponse<FieldAssignmentResponseDTO> assignments = assignmentService.getAssignmentsByFieldPage(
                farmId, fieldId, cursor, size, userDetails.getUid());
        return ResponseEntity.ok(ApiResponse.success(assignments, "Field assignments retrieved successfully"));
    }

    /**
     * Lists all assignments across the entire farm.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping("/assignments")
    public ResponseEntity<ApiResponse<CursorPageResponse<FieldAssignmentResponseDTO>>> getFarmAssignments(
            @PathVariable String farmId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") Integer size,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        CursorPageResponse<FieldAssignmentResponseDTO> assignments = assignmentService.getAssignmentsByFarmPage(
                farmId, cursor, size, userDetails.getUid());
        return ResponseEntity.ok(ApiResponse.success(assignments, "Farm assignments retrieved successfully"));
    }

    /**
     * Releases an active field assignment.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/fields/{fieldId}/assignments/{assignmentId}/release")
    public ResponseEntity<ApiResponse<FieldAssignmentResponseDTO>> releaseAssignment(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @PathVariable String assignmentId,
            @Valid @RequestBody ReleaseAssignmentRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FieldAssignmentResponseDTO released = assignmentService.releaseAssignment(farmId, fieldId, assignmentId, request, userDetails.getUid());
        return ResponseEntity.ok(ApiResponse.success(released, "Assignment released successfully"));
    }

    /**
     * Atomically reassigns a field to a new farmer.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping("/fields/{fieldId}/assignments/{assignmentId}/reassign")
    public ResponseEntity<ApiResponse<FieldAssignmentResponseDTO>> reassignFarmer(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @PathVariable String assignmentId,
            @Valid @RequestBody ReassignFarmerRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FieldAssignmentResponseDTO reassigned = assignmentService.reassignFarmer(farmId, fieldId, assignmentId, request, userDetails.getUid());
        return ResponseEntity.ok(ApiResponse.success(reassigned, "Field reassigned successfully"));
    }

    /**
     * Retrieves audit history for an assignment.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping("/fields/{fieldId}/assignments/{assignmentId}/history")
    public ResponseEntity<ApiResponse<CursorPageResponse<AssignmentHistoryResponseDTO>>> getAssignmentHistory(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @PathVariable String assignmentId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") Integer size,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        CursorPageResponse<AssignmentHistoryResponseDTO> history = assignmentService.getAssignmentHistoryPage(
                farmId, fieldId, assignmentId, cursor, size, userDetails.getUid());
        return ResponseEntity.ok(ApiResponse.success(history, "Assignment history retrieved successfully"));
    }
}
