package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.FieldAssignmentResponseDTO;
import com.agroai.dto.CursorPageResponse;
import com.agroai.dto.FarmerFieldResponseDTO;
import com.agroai.exception.FieldNotFoundException;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.util.KeyEncoder;
import com.agroai.util.CursorPagination;
import com.agroai.repository.CursorPage;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Controller providing farmer-scoped workspace access.
 * Enforces that a farmer can view and operate strictly on their actively assigned fields.
 */
@RestController
@RequestMapping("/api/v1/farmers/me")
public class FarmerWorkspaceController {

    private final FieldAssignmentRepository assignmentRepository;
    private final FieldRepository fieldRepository;

    public FarmerWorkspaceController(FieldAssignmentRepository assignmentRepository,
                                     FieldRepository fieldRepository) {
        this.assignmentRepository = assignmentRepository;
        this.fieldRepository = fieldRepository;
    }

    /**
     * Lists all active field assignments for the authenticated farmer.
     */
    @GetMapping("/assignments")
    public ResponseEntity<ApiResponse<CursorPageResponse<FieldAssignmentResponseDTO>>> getMyActiveAssignments(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") Integer size,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        int pageSize = CursorPagination.validatePageSize(size);
        CursorPage<com.agroai.model.FieldAssignment> page = assignmentRepository.findActiveAssignmentsByFarmerPage(
                userDetails.getUid(), CursorPagination.decode(cursor), pageSize);
        CursorPageResponse<FieldAssignmentResponseDTO> assignments = CursorPageResponse.map(page, pageSize,
                FieldAssignmentResponseDTO::fromEntity, CursorPagination::encode);

        return ResponseEntity.ok(ApiResponse.success(assignments, "Active field assignments retrieved successfully"));
    }

    /**
     * Lists full assignment history (active and released) for the authenticated farmer.
     */
    @GetMapping("/assignments/history")
    public ResponseEntity<ApiResponse<CursorPageResponse<FieldAssignmentResponseDTO>>> getMyAssignmentHistory(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") Integer size,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        int pageSize = CursorPagination.validatePageSize(size);
        CursorPage<com.agroai.model.FieldAssignment> page = assignmentRepository.findAssignmentsByFarmerPage(
                userDetails.getUid(), CursorPagination.decode(cursor), pageSize);
        CursorPageResponse<FieldAssignmentResponseDTO> history = CursorPageResponse.map(page, pageSize,
                FieldAssignmentResponseDTO::fromEntity, CursorPagination::encode);

        return ResponseEntity.ok(ApiResponse.success(history, "Farmer assignment history retrieved successfully"));
    }

    /**
     * Retrieves operational field details.
     * Access is restricted strictly to farmers with an ACTIVE assignment on this field.
     */
    @PreAuthorize("@fieldSecurity.hasFieldAccess(authentication, #fieldId)")
    @RequiresRevocationCheck
    @GetMapping("/fields/{fieldId}")
    public ResponseEntity<ApiResponse<FarmerFieldResponseDTO>> getMyAssignedField(
            @PathVariable String fieldId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);

        Field field = fieldRepository.findById(cleanFieldId)
                .orElseThrow(() -> new FieldNotFoundException(cleanFieldId));

        if (field.getStatus() == FieldStatus.ARCHIVED) {
            throw new FieldNotFoundException(cleanFieldId);
        }

        return ResponseEntity.ok(ApiResponse.success(FarmerFieldResponseDTO.fromEntity(field), "Field details retrieved successfully"));
    }
}
