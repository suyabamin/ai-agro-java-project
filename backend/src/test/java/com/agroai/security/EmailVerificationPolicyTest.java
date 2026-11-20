package com.agroai.security;

import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Email Verification Enforcement Policy Tests")
class EmailVerificationPolicyTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String UNVERIFIED_TOKEN = "unverified.user.jwt";
    private static final String VERIFIED_TOKEN = "verified.user.jwt";
    private static final String USER_UID = "user-email-test-202";

    @BeforeEach
    void setUp() {
        userRepository.clearAllForTesting();

        FirebaseUserDetails unverifiedUser = new FirebaseUserDetails(
                USER_UID,
                "unverified.farmer@agroai.org",
                "Unverified Farmer",
                false, // email is NOT verified
                Map.of()
        );

        FirebaseUserDetails verifiedUser = new FirebaseUserDetails(
                USER_UID,
                "unverified.farmer@agroai.org",
                "Verified Farmer",
                true, // email IS verified
                Map.of()
        );

        when(tokenVerifier.verifyToken(eq(UNVERIFIED_TOKEN))).thenReturn(unverifiedUser);
        when(tokenVerifier.verifyToken(eq(UNVERIFIED_TOKEN), any(Boolean.class))).thenReturn(unverifiedUser);

        when(tokenVerifier.verifyToken(eq(VERIFIED_TOKEN))).thenReturn(verifiedUser);
        when(tokenVerifier.verifyToken(eq(VERIFIED_TOKEN), any(Boolean.class))).thenReturn(verifiedUser);

        // Seed profile
        userRepository.initializeProfile(USER_UID, "unverified.farmer@agroai.org",
                new InitializeProfileRequest("Unverified Farmer", null, null, "en"));
    }

    @Test
    @DisplayName("[EMAIL-01] GET /api/v1/users/me is allowed for unverified users and displays emailVerified=false")
    void testGetProfile_UnverifiedEmail_Allowed() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + UNVERIFIED_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.emailVerified").value(false));
    }

    @Test
    @DisplayName("[EMAIL-02] PUT /api/v1/users/me rejects unverified users with HTTP 403 EMAIL_VERIFICATION_REQUIRED")
    void testUpdateProfile_UnverifiedEmail_Rejected() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("Updated Name", null, "Bio", null, "en", 1);

        mockMvc.perform(put("/api/v1/users/me")
                        .header("Authorization", "Bearer " + UNVERIFIED_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Email verification is required before updating profile details. Please verify your email address."));
    }

    @Test
    @DisplayName("[EMAIL-03] PUT /api/v1/users/me succeeds when email is verified")
    void testUpdateProfile_VerifiedEmail_Succeeds() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("Updated Name", null, "Bio", null, "en", 1);

        mockMvc.perform(put("/api/v1/users/me")
                        .header("Authorization", "Bearer " + VERIFIED_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fullName").value("Updated Name"))
                .andExpect(jsonPath("$.data.emailVerified").value(true));
    }

    @Test
    @DisplayName("[EMAIL-04] POST /api/v1/users/me/reconcile rejects unverified users with HTTP 403 EMAIL_VERIFICATION_REQUIRED")
    void testReconcileProfile_UnverifiedEmail_Rejected() throws Exception {
        mockMvc.perform(post("/api/v1/users/me/reconcile")
                        .header("Authorization", "Bearer " + UNVERIFIED_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Email verification is required before reconciling profile projections. Please verify your email address."));
    }
}
