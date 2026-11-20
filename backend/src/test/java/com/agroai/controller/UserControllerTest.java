package com.agroai.controller;

import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.model.AccountStatus;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("UserController & Profile Lifecycle Tests")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String TEST_TOKEN = "valid.test.jwt.token";
    private static final String TEST_UID = "test-uid-8821";
    private static final String TEST_EMAIL = "farmer.karim@agroai.org";

    @BeforeEach
    void setUp() {
        userRepository.clearAllForTesting();

        FirebaseUserDetails userDetails = new FirebaseUserDetails(
                TEST_UID,
                TEST_EMAIL,
                "Karim Farmer",
                true,
                Map.of()
        );
        when(tokenVerifier.verifyToken(eq(TEST_TOKEN))).thenReturn(userDetails);
        when(tokenVerifier.verifyToken(eq(TEST_TOKEN), eq(false))).thenReturn(userDetails);
        when(tokenVerifier.verifyToken(eq(TEST_TOKEN), eq(true))).thenReturn(userDetails);
    }

    @Test
    @DisplayName("[M2-REG-03] GET /api/v1/users/me returns 404 when profile is not initialized")
    void testGetUninitializedProfileReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("[M2-REG-01] POST /api/v1/users/me/initialize initializes fresh profile with version 1")
    void testInitializeFreshProfile() throws Exception {
        InitializeProfileRequest request = new InitializeProfileRequest(
                "Karim Hossain",
                "+8801712345678",
                "Organic rice farmer with 10 years experience",
                "en"
        );

        mockMvc.perform(post("/api/v1/users/me/initialize")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.uid").value(TEST_UID))
                .andExpect(jsonPath("$.data.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.data.fullName").value("Karim Hossain"))
                .andExpect(jsonPath("$.data.profileVersion").value(1))
                .andExpect(jsonPath("$.data.accountStatus").value("ACTIVE"));
    }

    @Test
    @DisplayName("[M2-REG-02] POST /api/v1/users/me/initialize is idempotent on repeated invocation")
    void testIdempotentRepeatedInitialization() throws Exception {
        InitializeProfileRequest request = new InitializeProfileRequest("Karim Hossain", "+8801712345678", "Bio", "en");

        // First initialization
        userRepository.initializeProfile(TEST_UID, TEST_EMAIL, request);

        // Second initialization attempt
        mockMvc.perform(post("/api/v1/users/me/initialize")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.uid").value(TEST_UID))
                .andExpect(jsonPath("$.data.profileVersion").value(1));
    }

    @Test
    @DisplayName("[M2-CON-01] PUT /api/v1/users/me updates profile and increments profileVersion to 2")
    void testUpdateProfileIncrementsVersion() throws Exception {
        InitializeProfileRequest initReq = new InitializeProfileRequest("Karim Hossain", "+8801712345678", "Bio", "en");
        userRepository.initializeProfile(TEST_UID, TEST_EMAIL, initReq);

        UpdateProfileRequest updateReq = new UpdateProfileRequest(
                "Karim H. Updated",
                "+8801799999999",
                "Updated agricultural bio",
                "https://storage.agroai.org/avatars/karim.png",
                "bn",
                1 // expectedVersion matching current version
        );

        mockMvc.perform(put("/api/v1/users/me")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fullName").value("Karim H. Updated"))
                .andExpect(jsonPath("$.data.preferredLanguage").value("bn"))
                .andExpect(jsonPath("$.data.profileVersion").value(2));
    }

    @Test
    @DisplayName("[M2-CON-02] PUT /api/v1/users/me rejects stale expectedVersion with 409 Conflict")
    void testStaleExpectedVersionRejection() throws Exception {
        InitializeProfileRequest initReq = new InitializeProfileRequest("Karim Hossain", "+8801712345678", "Bio", "en");
        userRepository.initializeProfile(TEST_UID, TEST_EMAIL, initReq);

        // Submit with stale version 99 (current is 1)
        UpdateProfileRequest updateReq = new UpdateProfileRequest(
                "Karim Stale",
                "+8801799999999",
                "Bio",
                null,
                "en",
                99
        );

        mockMvc.perform(put("/api/v1/users/me")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("[M2-REC-01] POST /api/v1/users/me/reconcile synchronizes public projection")
    void testReconcileProfile() throws Exception {
        InitializeProfileRequest initReq = new InitializeProfileRequest("Karim Hossain", "+8801712345678", "Bio", "en");
        userRepository.initializeProfile(TEST_UID, TEST_EMAIL, initReq);

        mockMvc.perform(post("/api/v1/users/me/reconcile")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.uid").value(TEST_UID));
    }

    @Test
    @DisplayName("[M2-PRV-01] GET /api/v1/users/{uid}/public returns sanitized public profile without phone or email")
    void testGetPublicProfileSanitized() throws Exception {
        InitializeProfileRequest initReq = new InitializeProfileRequest("Karim Hossain", "+8801712345678", "Bio", "en");
        userRepository.initializeProfile(TEST_UID, TEST_EMAIL, initReq);

        mockMvc.perform(get("/api/v1/users/" + TEST_UID + "/public")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.uid").value(TEST_UID))
                .andExpect(jsonPath("$.data.fullName").value("Karim Hossain"))
                .andExpect(jsonPath("$.data.phoneNumber").doesNotExist())
                .andExpect(jsonPath("$.data.email").doesNotExist());
    }

    @Test
    @DisplayName("[M2-SUS-01] Suspended user account is blocked with 403 Forbidden on protected requests")
    void testSuspendedUserAccessBlocked() throws Exception {
        InitializeProfileRequest initReq = new InitializeProfileRequest("Karim Hossain", "+8801712345678", "Bio", "en");
        userRepository.initializeProfile(TEST_UID, TEST_EMAIL, initReq);
        userRepository.updateAccountStatus(TEST_UID, AccountStatus.SUSPENDED);

        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + TEST_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }
}
