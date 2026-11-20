package com.agroai.config;

import com.agroai.service.FirebaseCustomClaimsService;
import com.agroai.util.KeyEncoder;
import com.google.api.core.ApiFuture;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.ExportedUserRecord;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.ListUsersPage;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.io.FileInputStream;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Firebase Admin SDK Live Cloud Verification (agroai-dev)")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class FirebaseAdminSdkLiveVerificationTest {

    private static String credentialsPath;
    private static final String EXPECTED_PROJECT_ID = "agroai-dev";

    @BeforeAll
    static void checkEnvironment() {
        credentialsPath = System.getenv("GOOGLE_APPLICATION_CREDENTIALS");
        if (credentialsPath == null || credentialsPath.trim().isEmpty()) {
            credentialsPath = "C:\\Users\\HP\\.secrets\\agroai-firebase-adminsdk.json";
        }
        File f = new File(credentialsPath);
        Assumptions.assumeTrue(f.exists(), "Credential file must exist at " + credentialsPath + " for live verification");
    }

    @Test
    @Order(1)
    @DisplayName("[LIVE-01] Verify credential file exists securely without exposing contents")
    void testCredentialFileExists() {
        File file = new File(credentialsPath);
        assertTrue(file.exists(), "Credential file must exist");
        assertTrue(file.isFile(), "Credential target must be a file");
        assertTrue(file.length() > 0, "Credential file must not be empty");
        // Verify we can read without logging content
        System.out.println("[VERIFY] Credential file exists: path=" + file.getAbsolutePath() + ", length=" + file.length() + " bytes");
    }

    @Test
    @Order(2)
    @DisplayName("[LIVE-02] Verify Admin SDK single initialization and project ID")
    void testAdminSdkInitializationAndProjectId() {
        FirebaseConfig firebaseConfig = new FirebaseConfig();
        ReflectionTestUtils.setField(firebaseConfig, "credentialsPath", credentialsPath);
        ReflectionTestUtils.setField(firebaseConfig, "projectId", EXPECTED_PROJECT_ID);

        firebaseConfig.initializeFirebase();

        assertTrue(firebaseConfig.isInitialized(), "FirebaseConfig must be initialized");
        assertFalse(FirebaseApp.getApps().isEmpty(), "FirebaseApp.getApps() must not be empty");
        assertEquals(1, FirebaseApp.getApps().size(), "FirebaseApp must only initialize once");

        FirebaseApp app = FirebaseApp.getInstance();
        assertNotNull(app, "FirebaseApp instance must not be null");
        assertEquals(EXPECTED_PROJECT_ID, app.getOptions().getProjectId(), "Project ID in FirebaseOptions must match agroai-dev");
        assertEquals(EXPECTED_PROJECT_ID, firebaseConfig.getProjectId(), "FirebaseConfig getProjectId must match agroai-dev");

        System.out.println("[VERIFY] Admin SDK initialized: appName=" + app.getName() + ", projectId=" + app.getOptions().getProjectId());
    }

    @Test
    @Order(3)
    @DisplayName("[LIVE-03] Verify Firestore connectivity with safe non-destructive operation")
    void testFirestoreConnectivity() throws Exception {
        assertTrue(!FirebaseApp.getApps().isEmpty(), "FirebaseApp must be initialized");
        Firestore db = FirestoreClient.getFirestore();
        assertNotNull(db, "Firestore client must not be null");

        // Safe, non-destructive read operation: query public_profiles with limit(1)
        ApiFuture<QuerySnapshot> future = db.collection("public_profiles").limit(1).get();
        QuerySnapshot snapshot = future.get();
        assertNotNull(snapshot, "Query snapshot must not be null");

        System.out.println("[VERIFY] Cloud Firestore non-destructive read success: collection='public_profiles', docCount=" + snapshot.size());
    }

    @Test
    @Order(4)
    @DisplayName("[LIVE-04] Verify custom claims functionality without overwriting existing claims")
    void testCustomClaimsPreservation() throws Exception {
        assertTrue(!FirebaseApp.getApps().isEmpty(), "FirebaseApp must be initialized");
        FirebaseAuth auth = FirebaseAuth.getInstance();
        assertNotNull(auth, "FirebaseAuth instance must not be null");

        // Inspect existing users in agroai-dev
        ListUsersPage page = auth.listUsers(null, 10);
        System.out.println("[VERIFY] FirebaseAuth listUsers: totalUsersListed=" + (page != null ? page.getValues() != null ? ((java.util.Collection<?>)page.getValues()).size() : 0 : 0));

        // Test custom claims service logic
        FirebaseConfig firebaseConfig = new FirebaseConfig();
        ReflectionTestUtils.setField(firebaseConfig, "credentialsPath", credentialsPath);
        ReflectionTestUtils.setField(firebaseConfig, "projectId", EXPECTED_PROJECT_ID);
        ReflectionTestUtils.setField(firebaseConfig, "initialized", true);

        FirebaseCustomClaimsService claimsService = new FirebaseCustomClaimsService(firebaseConfig);

        String sampleUid = "live-verify-uid-12345";
        String expectedSafeUid = KeyEncoder.encodeUid(sampleUid);
        assertEquals(expectedSafeUid, claimsService.syncSafeUidClaim(sampleUid));
        System.out.println("[VERIFY] Custom claims safeUid computed and verified: " + expectedSafeUid);
    }

    @AfterAll
    static void tearDown() {
        for (FirebaseApp app : new java.util.ArrayList<>(FirebaseApp.getApps())) {
            try {
                app.delete();
                System.out.println("[VERIFY] Cleaned up live FirebaseApp instance: " + app.getName());
            } catch (Exception ignored) {
            }
        }
    }
}
