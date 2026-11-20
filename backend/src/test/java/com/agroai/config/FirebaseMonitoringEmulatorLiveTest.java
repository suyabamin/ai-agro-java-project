package com.agroai.config;

import com.agroai.monitoring.MonitoringActivity;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FirestoreFieldMonitoringRepository;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * End-to-end integration test for M6 Field Monitoring persistence against live Firestore Emulator.
 * Runs only under profile live-firebase when FIRESTORE_EMULATOR_HOST is set.
 */
public class FirebaseMonitoringEmulatorLiveTest {
    private static FirebaseApp firebaseApp;

    @BeforeAll
    static void initializeEmulatorApp() {
        String emulatorHost = System.getenv("FIRESTORE_EMULATOR_HOST");
        if (!"127.0.0.1:8085".equals(emulatorHost)) {
            throw new IllegalStateException("Refusing to run unless FIRESTORE_EMULATOR_HOST is exactly 127.0.0.1:8085");
        }
        GoogleCredentials credentials = GoogleCredentials.create(new AccessToken("emulator-test-token",
                Date.from(Instant.now().plusSeconds(3600))));
        firebaseApp = FirebaseApp.initializeApp(FirebaseOptions.builder()
                .setCredentials(credentials)
                .setProjectId("demo-agroai-monitoring")
                .build());
    }

    @AfterAll
    static void closeEmulatorApp() {
        if (firebaseApp != null) {
            firebaseApp.delete();
        }
    }

    @Test
    void testFieldMonitoringPersistenceBatchAndCursorPagination() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String farmId = "farm-mon-" + suffix;
        String fieldId = "field-mon-" + suffix;

        FirebaseConfig firebaseConfig = mock(FirebaseConfig.class);
        when(firebaseConfig.isInitialized()).thenReturn(true);
        when(firebaseConfig.isConfigured()).thenReturn(true);

        FirestoreFieldMonitoringRepository repo = new FirestoreFieldMonitoringRepository(firebaseConfig);

        long t1 = System.currentTimeMillis();
        long t2 = t1 + 1000;
        long t3 = t2 + 1000;

        // 1. Create telemetry record 1
        String telId1 = "tel-" + suffix + "-01";
        Map<String, Object> telDoc1 = new HashMap<>();
        telDoc1.put("id", telId1);
        telDoc1.put("farmId", farmId);
        telDoc1.put("fieldId", fieldId);
        telDoc1.put("measurementType", "SOIL_MOISTURE");
        telDoc1.put("rawValue", 32.5);
        telDoc1.put("unit", "%");
        telDoc1.put("createdAtEpochMs", t1);

        Map<String, Object> actDoc1 = new HashMap<>();
        actDoc1.put("id", "act-" + suffix + "-01");
        actDoc1.put("eventId", "act-" + suffix + "-01");
        actDoc1.put("farmId", farmId);
        actDoc1.put("fieldId", fieldId);
        actDoc1.put("activityType", "TELEMETRY_RECORDED");
        actDoc1.put("createdAtEpochMs", t1);

        repo.createWithActivity("soil_telemetry", telId1, telDoc1, actDoc1);

        // 2. Create telemetry record 2
        String telId2 = "tel-" + suffix + "-02";
        Map<String, Object> telDoc2 = new HashMap<>();
        telDoc2.put("id", telId2);
        telDoc2.put("farmId", farmId);
        telDoc2.put("fieldId", fieldId);
        telDoc2.put("measurementType", "SOIL_MOISTURE");
        telDoc2.put("rawValue", 28.0);
        telDoc2.put("unit", "%");
        telDoc2.put("createdAtEpochMs", t2);

        Map<String, Object> actDoc2 = new HashMap<>();
        actDoc2.put("id", "act-" + suffix + "-02");
        actDoc2.put("eventId", "act-" + suffix + "-02");
        actDoc2.put("farmId", farmId);
        actDoc2.put("fieldId", fieldId);
        actDoc2.put("activityType", "TELEMETRY_RECORDED");
        actDoc2.put("createdAtEpochMs", t2);

        repo.createWithActivity("soil_telemetry", telId2, telDoc2, actDoc2);

        // 3. Create irrigation plan record 3
        String planId = "plan-" + suffix + "-01";
        Map<String, Object> planDoc = new HashMap<>();
        planDoc.put("id", planId);
        planDoc.put("farmId", farmId);
        planDoc.put("fieldId", fieldId);
        planDoc.put("irrigationRequired", true);
        planDoc.put("recommendedWaterMm", 25.0);
        planDoc.put("createdAtEpochMs", t3);

        Map<String, Object> actDoc3 = new HashMap<>();
        actDoc3.put("id", "act-" + suffix + "-03");
        actDoc3.put("eventId", "act-" + suffix + "-03");
        actDoc3.put("farmId", farmId);
        actDoc3.put("fieldId", fieldId);
        actDoc3.put("activityType", "IRRIGATION_PLANNED");
        actDoc3.put("createdAtEpochMs", t3);

        repo.createWithActivity("irrigation_plans", planId, planDoc, actDoc3);

        // 4. Retrieve single records from Firestore
        var foundTel = repo.find("soil_telemetry", telId1);
        assertTrue(foundTel.isPresent(), "Telemetry record must exist in Firestore");
        assertEquals(32.5, ((Number) foundTel.get().get("rawValue")).doubleValue(), 0.001);

        var foundPlan = repo.find("irrigation_plans", planId);
        assertTrue(foundPlan.isPresent(), "Irrigation plan must exist in Firestore");
        assertEquals(true, foundPlan.get().get("irrigationRequired"));

        // 5. Test activity feed in Firestore
        var foundAct = repo.find("field_activity", "act-" + suffix + "-01");
        assertTrue(foundAct.isPresent(), "Activity event must be atomic batch written in Firestore");

        // 6. Test Pagination query on soil_telemetry
        CursorPage<Map<String, Object>> page1 = repo.page("soil_telemetry", farmId, fieldId, null, 1, Map.of(), null, null);
        assertNotNull(page1);
        assertEquals(1, page1.items().size());
        assertEquals(telId2, page1.items().getFirst().get("id"), "Newer item (t2) should be first");
    }
}
