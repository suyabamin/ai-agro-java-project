package com.agroai.config;

import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.exception.FirebaseAuthenticationException;
import com.agroai.exception.StaleProfileVersionException;
import com.agroai.model.PublicProfile;
import com.agroai.model.UserProfile;
import com.agroai.repository.FirestoreUserRepository;
import com.agroai.security.DefaultFirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.FirebaseCustomClaimsService;
import com.agroai.util.KeyEncoder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import com.google.firebase.cloud.FirestoreClient;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Live End-To-End Firebase & Cloud Firestore Verification (agroai-dev)")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class FirebaseLiveEndToEndVerificationTest {

    private static final String CREDENTIALS_PATH = "C:\\Users\\HP\\.secrets\\agroai-firebase-adminsdk.json";
    private static final String METADATA_PATH = "d:\\agro-ai-java-project\\docs\\reports\\.live-test-metadata.json";
    private static final String EXPECTED_PROJECT_ID = "agroai-dev";

    private static String testUid;
    private static String testEmail;
    private static String testIdToken;

    private static FirebaseConfig firebaseConfig;
    private static DefaultFirebaseTokenVerifier tokenVerifier;
    private static FirebaseCustomClaimsService customClaimsService;
    private static FirestoreUserRepository userRepository;

    @BeforeAll
    static void setup() throws Exception {
        File credFile = new File(CREDENTIALS_PATH);
        File metaFile = new File(METADATA_PATH);

        Assumptions.assumeTrue(credFile.exists(), "Credential file must exist");
        Assumptions.assumeTrue(metaFile.exists(), "Live test metadata file must exist from client auth run");

        ObjectMapper mapper = new ObjectMapper();
        JsonNode meta = mapper.readTree(metaFile);
        testUid = meta.get("uid").asText();
        testEmail = meta.get("email").asText();
        testIdToken = meta.get("idToken").asText();

        firebaseConfig = new FirebaseConfig();
        ReflectionTestUtils.setField(firebaseConfig, "credentialsPath", CREDENTIALS_PATH);
        ReflectionTestUtils.setField(firebaseConfig, "projectId", EXPECTED_PROJECT_ID);
        firebaseConfig.initializeFirebase();

        tokenVerifier = new DefaultFirebaseTokenVerifier();
        customClaimsService = new FirebaseCustomClaimsService(firebaseConfig);

        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");
        userRepository = new FirestoreUserRepository(firebaseConfig, env);
    }

    @Test
    @Order(1)
    @DisplayName("[LIVE-BACKEND-01] Verifies real Firebase ID token with DefaultFirebaseTokenVerifier")
    void testBackendBearerTokenVerification() throws Exception {
        assertNotNull(testIdToken, "ID token must be present from client auth");
        FirebaseUserDetails userDetails = tokenVerifier.verifyToken(testIdToken, false);

        assertNotNull(userDetails, "Decoded user details must not be null");
        assertEquals(testUid, userDetails.getUid(), "UID from decoded token must match test user UID");
        assertEquals(testEmail, userDetails.getEmail(), "Email from decoded token must match test email");
        assertFalse(userDetails.isEmailVerified(), "emailVerified flag must match live client state");

        System.out.println("[VERIFY-E2E-01] Live Bearer token verified successfully: uid=" + userDetails.getUid() + ", emailVerified=" + userDetails.isEmailVerified());
    }

    @Test
    @Order(2)
    @DisplayName("[LIVE-BACKEND-02] Synchronizes safeUid custom claim and validates on live Firebase Auth")
    void testCustomClaimsSynchronization() throws Exception {
        String safeUid = customClaimsService.syncSafeUidClaim(testUid);
        String expectedSafeUid = KeyEncoder.encodeUid(testUid);
        assertEquals(expectedSafeUid, safeUid);

        // Verify claim is persisted in live Firebase Auth UserRecord
        UserRecord record = FirebaseAuth.getInstance().getUser(testUid);
        Map<String, Object> claims = record.getCustomClaims();
        assertNotNull(claims, "User custom claims must not be null");
        assertEquals(expectedSafeUid, claims.get("safeUid"), "safeUid in live claims must match computed safeUid");

        System.out.println("[VERIFY-E2E-02] Live custom claim safeUid verified on Firebase Auth: uid=" + testUid + ", safeUid=" + claims.get("safeUid"));
    }

    @Test
    @Order(3)
    @DisplayName("[LIVE-FS-02] Executes transactional profile initialization dual-write on live Cloud Firestore")
    void testLiveFirestoreProfileInitialization() {
        InitializeProfileRequest initReq = new InitializeProfileRequest(
                "Live Verifier Farmer",
                "+8801700000000",
                "Automated live verification bio",
                "en"
        );

        UserProfile createdProfile = userRepository.initializeProfile(testUid, testEmail, initReq);
        assertNotNull(createdProfile, "Created user profile must not be null");
        assertEquals(testUid, createdProfile.getUid());
        assertEquals("Live Verifier Farmer", createdProfile.getFullName());
        assertEquals(1, createdProfile.getProfileVersion(), "Initial profile version must be 1");

        System.out.println("[VERIFY-E2E-03] Live Cloud Firestore dual-write initialization success: uid=" + testUid + ", version=" + createdProfile.getProfileVersion());
    }

    @Test
    @Order(4)
    @DisplayName("[LIVE-FS-03] Verifies permitted private profile read and sanitized public profile read from live Cloud Firestore")
    void testLiveFirestoreReads() {
        // Read private profile
        Optional<UserProfile> privOpt = userRepository.findPrivateProfile(testUid);
        assertTrue(privOpt.isPresent(), "Private profile must exist in live Firestore");
        UserProfile priv = privOpt.get();
        assertEquals(testUid, priv.getUid());
        assertEquals("+8801700000000", priv.getPhoneNumber(), "Private profile must retain phone number");
        assertEquals(1, priv.getProfileVersion());

        // Read public profile
        Optional<PublicProfile> pubOpt = userRepository.findPublicProfile(testUid);
        assertTrue(pubOpt.isPresent(), "Public profile projection must exist in live Firestore");
        PublicProfile pub = pubOpt.get();
        assertEquals(testUid, pub.getUid());
        assertEquals("Live Verifier Farmer", pub.getFullName());
        assertEquals(1, pub.getProfileVersion());

        System.out.println("[VERIFY-E2E-04] Live Cloud Firestore read verified: private phone=" + priv.getPhoneNumber() + ", public name=" + pub.getFullName());
    }

    @Test
    @Order(5)
    @DisplayName("[LIVE-FS-04] Tests optimistic concurrency control and version increment on live Cloud Firestore")
    void testLiveFirestoreOptimisticConcurrency() {
        // Successful update with expectedVersion = 1
        UpdateProfileRequest updateReq = new UpdateProfileRequest(
                "Updated Live Farmer Name",
                "+8801799999999",
                "Updated bio",
                null,
                "bn",
                1
        );

        UserProfile updatedProfile = userRepository.updateProfile(testUid, updateReq);
        assertNotNull(updatedProfile);
        assertEquals("Updated Live Farmer Name", updatedProfile.getFullName());
        assertEquals(2, updatedProfile.getProfileVersion(), "Version must increment to 2");

        // Stale update with expectedVersion = 1 must throw StaleProfileVersionException
        UpdateProfileRequest staleReq = new UpdateProfileRequest(
                "Stale Conflict Attempt",
                null,
                null,
                null,
                "en",
                1 // Stale expected version! Current is 2
        );

        assertThrows(StaleProfileVersionException.class, () -> userRepository.updateProfile(testUid, staleReq),
                "Stale version update must throw StaleProfileVersionException");

        System.out.println("[VERIFY-E2E-05] Live Cloud Firestore optimistic locking verified: updatedVersion=2, staleVersion=1 rejected with 409 conflict");
    }

    @Test
    @Order(6)
    @DisplayName("[LIVE-BACKEND-03] Revokes refresh tokens and verifies rejection on revocation-checked verification")
    void testRevocationCheckRejection() throws Exception {
        // Revoke tokens via Admin SDK
        FirebaseAuth.getInstance().revokeRefreshTokens(testUid);
        System.out.println("[VERIFY-E2E-06] Tokens revoked via Admin SDK for uid=" + testUid);

        // Verification without revocation check should still decode token (stateless JWKS)
        // Wait: depending on iat vs revocation timestamp, verifyToken with checkRevoked=true MUST throw
        Thread.sleep(500); // small delay to ensure timestamp boundary

        FirebaseAuthenticationException ex = assertThrows(
                FirebaseAuthenticationException.class,
                () -> tokenVerifier.verifyToken(testIdToken, true),
                "Revoked token with checkRevoked=true must throw FirebaseAuthenticationException"
        );

        assertEquals("REVOKED_ID_TOKEN", ex.getErrorCode(), "Error code must be REVOKED_ID_TOKEN");
        System.out.println("[VERIFY-E2E-06] Revoked token correctly rejected on online check: errorCode=" + ex.getErrorCode() + ", msg=" + ex.getMessage());
    }

    @AfterAll
    static void cleanup() {
        System.out.println("[CLEANUP] Cleaning up disposable live test documents and auth account...");
        try {
            if (testUid != null && !testUid.isEmpty()) {
                Firestore db = FirestoreClient.getFirestore();
                db.collection("users").document(testUid).delete().get();
                db.collection("public_profiles").document(testUid).delete().get();
                System.out.println("[CLEANUP] Deleted Firestore documents users/" + testUid + " and public_profiles/" + testUid);

                FirebaseAuth.getInstance().deleteUser(testUid);
                System.out.println("[CLEANUP] Deleted Firebase Auth user " + testUid);
            }
        } catch (Exception e) {
            System.err.println("[CLEANUP] Warning during cleanup: " + e.getMessage());
        }

        // Delete metadata file
        try {
            File metaFile = new File(METADATA_PATH);
            if (metaFile.exists()) {
                metaFile.delete();
                System.out.println("[CLEANUP] Removed temporary live test metadata file");
            }
        } catch (Exception ignored) {
        }

        // Clean up FirebaseApp instances
        for (FirebaseApp app : new java.util.ArrayList<>(FirebaseApp.getApps())) {
            try {
                app.delete();
            } catch (Exception ignored) {
            }
        }
    }
}
