package com.agroai.security;

import com.agroai.dto.UpdateProfileRequest;
import com.agroai.exception.FirebaseAuthenticationException;
import com.agroai.model.AccountStatus;
import com.agroai.model.UserProfile;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Token Revocation Policy Integration Tests")
class RevocationPolicyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String VALID_TOKEN = "valid.unrevoked.token";
    private static final String REVOKED_TOKEN = "revoked.session.token";
    private static final String USER_UID = "user-revocation-test-101";

    @BeforeEach
    void setUp() {
        userRepository.clearAllForTesting();

        FirebaseUserDetails validUser = new FirebaseUserDetails(
                USER_UID,
                "verified.farmer@agroai.org",
                "Verified Farmer",
                true,
                Map.of()
        );

        // Standard offline verification (checkRevoked = false)
        when(tokenVerifier.verifyToken(eq(VALID_TOKEN))).thenReturn(validUser);
        when(tokenVerifier.verifyToken(eq(VALID_TOKEN), eq(false))).thenReturn(validUser);
        when(tokenVerifier.verifyToken(eq(VALID_TOKEN), eq(true))).thenReturn(validUser);

        // Revoked token: passes offline check but fails online check (checkRevoked = true)
        when(tokenVerifier.verifyToken(eq(REVOKED_TOKEN))).thenReturn(validUser);
        when(tokenVerifier.verifyToken(eq(REVOKED_TOKEN), eq(false))).thenReturn(validUser);
        when(tokenVerifier.verifyToken(eq(REVOKED_TOKEN), eq(true)))
                .thenThrow(new FirebaseAuthenticationException("Firebase ID token has been revoked", "REVOKED_ID_TOKEN"));

        // Seed initialized profile
        UserProfile profile = new UserProfile();
        profile.setUid(USER_UID);
        profile.setEmail("verified.farmer@agroai.org");
        profile.setFullName("Verified Farmer");
        profile.setAccountStatus(AccountStatus.ACTIVE);
        profile.setProfileVersion(1);
        userRepository.initializeProfile(USER_UID, "verified.farmer@agroai.org",
                new com.agroai.dto.InitializeProfileRequest("Verified Farmer", null, null, "en"));
    }

    @Test
    @DisplayName("[REVOCATION-01] Low-risk endpoint GET /api/v1/users/me uses fast offline verification (no revocation check)")
    void testLowRiskEndpoint_DoesNotCallOnlineRevocationCheck() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + VALID_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Verifies online check (checkRevoked = true) was NEVER called for low-risk read
        verify(tokenVerifier, never()).verifyToken(any(), eq(true));
    }

    @Test
    @DisplayName("[REVOCATION-02] High-risk endpoint PUT /api/v1/users/me enforces online revocation check and rejects revoked token")
    void testHighRiskEndpoint_UpdateProfile_RejectsRevokedToken() throws Exception {
        UpdateProfileRequest updateReq = new UpdateProfileRequest(
                "Updated Farmer Name", null, "New Bio", null, "en", 1);

        mockMvc.perform(put("/api/v1/users/me")
                        .header("Authorization", "Bearer " + REVOKED_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Firebase ID token has been revoked"));

        verify(tokenVerifier).verifyToken(eq(REVOKED_TOKEN), eq(true));
    }

    @Test
    @DisplayName("[REVOCATION-03] High-risk endpoint POST /api/v1/users/me/reconcile enforces online revocation check and rejects revoked token")
    void testHighRiskEndpoint_ReconcileProfile_RejectsRevokedToken() throws Exception {
        mockMvc.perform(post("/api/v1/users/me/reconcile")
                        .header("Authorization", "Bearer " + REVOKED_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Firebase ID token has been revoked"));

        verify(tokenVerifier).verifyToken(eq(REVOKED_TOKEN), eq(true));
    }
}
