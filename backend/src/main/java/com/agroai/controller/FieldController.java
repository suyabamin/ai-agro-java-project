package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.CreateFieldRequest;
import com.agroai.dto.FieldResponseDTO;
import com.agroai.dto.UpdateFieldRequest;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.FieldService;
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
@RequestMapping("/api/v1/farms/{farmId}/fields")
public class FieldController {

    private final FieldService fieldService;

    public FieldController(FieldService fieldService) {
        this.fieldService = fieldService;
    }

    /**
     * Creates a new field under a farm. Atomically increments farm activeFieldCount.
     * Restricted to active OWNER or MANAGER. Requires online token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PostMapping
    public ResponseEntity<ApiResponse<FieldResponseDTO>> createField(
            @PathVariable String farmId,
            @Valid @RequestBody CreateFieldRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FieldResponseDTO created = fieldService.createField(farmId, request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Field created successfully"));
    }

    /**
     * Lists fields belonging to a farm. Excludes archived fields by default.
     * Restricted to active farm members.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping
    public ResponseEntity<ApiResponse<List<FieldResponseDTO>>> listFields(
            @PathVariable String farmId,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<FieldResponseDTO> fields = fieldService.getFields(farmId, includeArchived, userDetails);
        return ResponseEntity.ok(ApiResponse.success(fields, "Fields retrieved successfully"));
    }

    /**
     * Retrieves details for a specific field under a farm.
     * Restricted to active farm members.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping("/{fieldId}")
    public ResponseEntity<ApiResponse<FieldResponseDTO>> getField(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FieldResponseDTO field = fieldService.getFieldById(farmId, fieldId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(field, "Field retrieved successfully"));
    }

    /**
     * Updates field metadata with optimistic concurrency validation.
     * Restricted to active OWNER or MANAGER. Requires online token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PutMapping("/{fieldId}")
    public ResponseEntity<ApiResponse<FieldResponseDTO>> updateField(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @Valid @RequestBody UpdateFieldRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FieldResponseDTO updated = fieldService.updateField(farmId, fieldId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(updated, "Field updated successfully"));
    }

    /**
     * Soft-archives a field and decrements farm activeFieldCount.
     * Restricted to active OWNER. Requires online token revocation check.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PostMapping("/{fieldId}/archive")
    public ResponseEntity<ApiResponse<Void>> archiveField(
            @PathVariable String farmId,
            @PathVariable String fieldId,
            @RequestParam(required = false) Integer expectedVersion,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        fieldService.archiveField(farmId, fieldId, expectedVersion, userDetails);
        return ResponseEntity.ok(ApiResponse.success(null, "Field archived successfully"));
    }
}
