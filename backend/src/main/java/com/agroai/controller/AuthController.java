package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.security.FirebaseUserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCurrentUser(
            @AuthenticationPrincipal FirebaseUserDetails userDetails) {

        Map<String, Object> userData = new LinkedHashMap<>();
        userData.put("uid", userDetails.getUid());
        userData.put("email", userDetails.getEmail());
        userData.put("name", userDetails.getName());
        userData.put("emailVerified", userDetails.isEmailVerified());

        return ResponseEntity.ok(ApiResponse.success(userData, "Current user retrieved successfully"));
    }
}
