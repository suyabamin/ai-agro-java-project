package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.FarmResponseDTO;
import com.agroai.dto.UpdateFarmRequest;
import com.agroai.dto.UpdateFarmVisibilityRequest;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.FarmService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/farms")
public class FarmController {

    private final FarmService farmService;

    public FarmController(FarmService farmService) {
        this.farmService = farmService;
    }

    /**
     * Atomically registers a new farm with the authenticated user as OWNER.
     * High-risk operation requiring online token revocation check.
     */
    @RequiresRevocationCheck
    @PostMapping
    public ResponseEntity<ApiResponse<FarmResponseDTO>> createFarm(
            @AuthenticationPrincipal FirebaseUserDetails userDetails,
            @Valid @RequestBody CreateFarmRequest request) {
        FarmResponseDTO created = farmService.registerFarm(userDetails, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Farm created successfully"));
    }

    /**
     * Lists all farms where the authenticated user holds an active membership.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<FarmResponseDTO>>> listMyFarms(
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<FarmResponseDTO> farms = farmService.getMyFarms(userDetails);
        return ResponseEntity.ok(ApiResponse.success(farms, "Farms retrieved successfully"));
    }

    /**
     * Retrieves farm details. Restricted to active farm members.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping("/{farmId}")
    public ResponseEntity<ApiResponse<FarmResponseDTO>> getFarmById(
            @PathVariable String farmId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FarmResponseDTO farm = farmService.getFarmById(farmId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(farm, "Farm retrieved successfully"));
    }

    /**
     * Updates farm metadata with optimistic concurrency checking.
     * Restricted to active OWNER or MANAGER.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")
    @PutMapping("/{farmId}")
    public ResponseEntity<ApiResponse<FarmResponseDTO>> updateFarm(
            @PathVariable String farmId,
            @Valid @RequestBody UpdateFarmRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FarmResponseDTO updated = farmService.updateFarm(farmId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(updated, "Farm updated successfully"));
    }

    /**
     * Updates farm visibility (PUBLIC/PRIVATE) and manages public projection lifecycle.
     * Restricted to active OWNER.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PatchMapping("/{farmId}/visibility")
    public ResponseEntity<ApiResponse<FarmResponseDTO>> updateFarmVisibility(
            @PathVariable String farmId,
            @Valid @RequestBody UpdateFarmVisibilityRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FarmResponseDTO updated = farmService.updateVisibility(farmId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(updated, "Farm visibility updated successfully"));
    }

    /**
     * Soft-archives a farm and deletes its public projection.
     * Restricted to active OWNER.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PostMapping("/{farmId}/archive")
    public ResponseEntity<ApiResponse<Void>> archiveFarm(
            @PathVariable String farmId,
            @RequestParam(required = false) Integer expectedVersion,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        farmService.archiveFarm(farmId, expectedVersion, userDetails);
        return ResponseEntity.ok(ApiResponse.success(null, "Farm archived successfully"));
    }

    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PostMapping("/{farmId}/suspend")
    public ResponseEntity<ApiResponse<Void>> suspendFarm(
            @PathVariable String farmId,
            @RequestParam(required = false) Integer expectedVersion,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        farmService.suspendFarm(farmId, expectedVersion, userDetails);
        return ResponseEntity.ok(ApiResponse.success(null, "Farm suspended successfully"));
    }

    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PostMapping("/{farmId}/reactivate")
    public ResponseEntity<ApiResponse<Void>> reactivateFarm(
            @PathVariable String farmId,
            @RequestParam(required = false) Integer expectedVersion,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        farmService.reactivateFarm(farmId, expectedVersion, userDetails);
        return ResponseEntity.ok(ApiResponse.success(null, "Farm reactivated successfully"));
    }
}
