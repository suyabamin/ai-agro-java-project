package com.agroai.controller;

import com.agroai.dto.AddFarmMemberRequest;
import com.agroai.dto.ApiResponse;
import com.agroai.dto.FarmMemberResponseDTO;
import com.agroai.dto.UpdateFarmMemberRoleRequest;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.FarmMembershipService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/farms/{farmId}/members")
public class FarmMembershipController {

    private final FarmMembershipService membershipService;

    public FarmMembershipController(FarmMembershipService membershipService) {
        this.membershipService = membershipService;
    }

    /**
     * Lists active and revoked members of a farm.
     * Restricted to active farm members.
     */
    @PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")
    @GetMapping
    public ResponseEntity<ApiResponse<List<FarmMemberResponseDTO>>> listMembers(
            @PathVariable String farmId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        List<FarmMemberResponseDTO> members = membershipService.getMembers(farmId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(members, "Farm members retrieved successfully"));
    }

    /**
     * Grants membership (MANAGER or OBSERVER) to an existing user.
     * Restricted to active OWNER.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PostMapping
    public ResponseEntity<ApiResponse<FarmMemberResponseDTO>> addMember(
            @PathVariable String farmId,
            @Valid @RequestBody AddFarmMemberRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FarmMemberResponseDTO member = membershipService.addMember(farmId, request, userDetails);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(member, "Farm member added successfully"));
    }

    /**
     * Updates an existing member's role (MANAGER or OBSERVER).
     * Sole owner protections enforced. Restricted to active OWNER.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @PatchMapping("/{userId}")
    public ResponseEntity<ApiResponse<FarmMemberResponseDTO>> updateMemberRole(
            @PathVariable String farmId,
            @PathVariable String userId,
            @Valid @RequestBody UpdateFarmMemberRoleRequest request,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        FarmMemberResponseDTO updated = membershipService.updateMemberRole(farmId, userId, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(updated, "Member role updated successfully"));
    }

    /**
     * Soft-revokes a user's farm membership.
     * Sole owner protections enforced. Restricted to active OWNER.
     */
    @RequiresRevocationCheck
    @PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")
    @DeleteMapping("/{userId}")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable String farmId,
            @PathVariable String userId,
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        membershipService.revokeMember(farmId, userId, userDetails);
        return ResponseEntity.ok(ApiResponse.success(null, "Farm membership revoked successfully"));
    }
}
