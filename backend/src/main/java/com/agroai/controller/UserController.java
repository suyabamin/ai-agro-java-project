package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.PublicProfileDTO;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.dto.UserProfileDTO;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.UserService;
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

import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Strictly read-only private profile retrieval.
     * Low-risk read operation using fast cached JWKS verification.
     * Returns 404 PROFILE_NOT_FOUND if uninitialized. Never silently writes.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileDTO>> getMyProfile(
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        UserProfileDTO profile = userService.getMyProfile(userDetails);
        return ResponseEntity.ok(ApiResponse.success(profile, "Profile retrieved successfully"));
    }

    /**
     * Idempotent profile initialization.
     * High-risk account creation operation requiring online token revocation check.
     */
    @RequiresRevocationCheck
    @PostMapping("/me/initialize")
    public ResponseEntity<ApiResponse<UserProfileDTO>> initializeMyProfile(
            @AuthenticationPrincipal FirebaseUserDetails userDetails,
            @Valid @RequestBody InitializeProfileRequest request) {
        UserProfileDTO profile = userService.initializeMyProfile(userDetails, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(profile, "Profile initialized successfully"));
    }

    /**
     * Concurrency-safe profile update.
     * High-risk mutating operation requiring online token revocation check and verified email.
     * Requires expectedVersion; returns 409 Conflict on stale updates.
     */
    @RequiresRevocationCheck
    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileDTO>> updateMyProfile(
            @AuthenticationPrincipal FirebaseUserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request) {
        UserProfileDTO updated = userService.updateMyProfile(userDetails, request);
        return ResponseEntity.ok(ApiResponse.success(updated, "Profile updated successfully"));
    }

    /**
     * Dedicated transactional reconciliation endpoint.
     * High-risk security recovery operation requiring online token revocation check and verified email.
     */
    @RequiresRevocationCheck
    @PostMapping("/me/reconcile")
    public ResponseEntity<ApiResponse<UserProfileDTO>> reconcileMyProfile(
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        UserProfileDTO reconciled = userService.reconcileMyProfile(userDetails);
        return ResponseEntity.ok(ApiResponse.success(reconciled, "Profile projection reconciled successfully"));
    }

    /**
     * Explicit claim synchronization endpoint.
     * Synchronizes the safeUid custom user claim for the authenticated user.
     */
    @RequiresRevocationCheck
    @PostMapping("/me/claims/sync")
    public ResponseEntity<ApiResponse<Map<String, String>>> syncClaims(
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {
        String safeUid = userService.syncClaims(userDetails);
        return ResponseEntity.ok(ApiResponse.success(Map.of("safeUid", safeUid), "Custom claims synchronized successfully"));
    }

    /**
     * Public profile directory lookup.
     * Low-risk read-only endpoint.
     */
    @GetMapping("/{uid}/public")
    public ResponseEntity<ApiResponse<PublicProfileDTO>> getPublicProfile(@PathVariable String uid) {
        PublicProfileDTO pub = userService.getPublicProfile(uid);
        return ResponseEntity.ok(ApiResponse.success(pub, "Public profile retrieved successfully"));
    }
}
