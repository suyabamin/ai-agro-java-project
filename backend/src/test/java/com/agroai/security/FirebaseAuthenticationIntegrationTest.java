package com.agroai.security;

import com.agroai.exception.FirebaseAuthenticationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Spring Security & Firebase Authentication Tests (MOCKED VERIFIER):
 * Uses a mock FirebaseTokenVerifier to simulate token validation outcomes
 * (valid, expired, revoked, invalid, malformed, missing) without external network calls.
 */
@SpringBootTest
@AutoConfigureMockMvc
class FirebaseAuthenticationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    @Test
    @DisplayName("[MOCK-VERIFIER] Valid Firebase ID token permits access to protected endpoint")
    void testValidTokenAccessesProtectedEndpoint() throws Exception {
        String testToken = "valid.mock.token";
        FirebaseUserDetails mockUser = new FirebaseUserDetails(
                "user-12345",
                "farmer@agroai.org",
                "Rahim Farmer",
                true,
                Map.of("role", "farmer")
        );

        when(tokenVerifier.verifyToken(eq(testToken))).thenReturn(mockUser);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + testToken)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.uid").value("user-12345"))
                .andExpect(jsonPath("$.data.email").value("farmer@agroai.org"))
                .andExpect(jsonPath("$.data.name").value("Rahim Farmer"));
    }

    @Test
    @DisplayName("[MOCK-VERIFIER] Expired Firebase ID token returns 401 Unauthorized")
    void testExpiredTokenReturns401() throws Exception {
        String expiredToken = "expired.mock.token";
        when(tokenVerifier.verifyToken(eq(expiredToken)))
                .thenThrow(new FirebaseAuthenticationException("Firebase ID token has expired", "EXPIRED_TOKEN"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + expiredToken)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Firebase ID token has expired"));
    }

    @Test
    @DisplayName("[MOCK-VERIFIER] Invalid / untrusted signature returns 401 Unauthorized")
    void testInvalidTokenReturns401() throws Exception {
        String invalidToken = "invalid.mock.token";
        when(tokenVerifier.verifyToken(eq(invalidToken)))
                .thenThrow(new FirebaseAuthenticationException("Firebase ID token is invalid", "INVALID_TOKEN"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + invalidToken)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Firebase ID token is invalid"));
    }

    @Test
    @DisplayName("[MOCK-VERIFIER] Revoked Firebase token returns 401 Unauthorized")
    void testRevokedTokenReturns401() throws Exception {
        String revokedToken = "revoked.mock.token";
        when(tokenVerifier.verifyToken(eq(revokedToken)))
                .thenThrow(new FirebaseAuthenticationException("Firebase ID token has been revoked", "REVOKED_TOKEN"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + revokedToken)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Firebase ID token has been revoked"));
    }

    @Test
    @DisplayName("[MOCK-VERIFIER] Malformed token format returns 401 Unauthorized")
    void testMalformedTokenReturns401() throws Exception {
        String malformedToken = "not-a-jwt";
        when(tokenVerifier.verifyToken(eq(malformedToken)))
                .thenThrow(new FirebaseAuthenticationException("Firebase token format is malformed", "MALFORMED_TOKEN"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + malformedToken)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Firebase token format is malformed"));
    }

    @Test
    @DisplayName("[MOCK-VERIFIER] Missing Authorization header on protected endpoint returns 401")
    void testMissingHeaderOnProtectedEndpointReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("[MOCK-VERIFIER] Public health endpoint is accessible without token")
    void testPublicHealthEndpointAccessibleWithoutToken() throws Exception {
        mockMvc.perform(get("/api/v1/health")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("UP"));
    }

    @Test
    @DisplayName("[MOCK-VERIFIER] Firebase diagnostic endpoint is accessible without token and reports safe status")
    void testFirebaseHealthAccessibleWithoutToken() throws Exception {
        mockMvc.perform(get("/api/v1/health/firebase")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.configured").isBoolean())
                .andExpect(jsonPath("$.data.sdkInitialized").isBoolean())
                .andExpect(jsonPath("$.data.projectId").isString());
    }
}
