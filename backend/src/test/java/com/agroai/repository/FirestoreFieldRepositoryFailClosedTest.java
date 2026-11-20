package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("FirestoreFieldRepository Fail-Closed & Dual-Mode Tests")
class FirestoreFieldRepositoryFailClosedTest {

    @Test
    @DisplayName("[FAIL-CLOSED-FIELD-01] Dev/Offline mode operates safely with in-memory store when uninitialized")
    void testOfflineModeOperations() {
        FirebaseConfig uninitializedConfig = mock(FirebaseConfig.class);
        when(uninitializedConfig.isInitialized()).thenReturn(false);

        FirestoreFieldRepository repo = new FirestoreFieldRepository(uninitializedConfig, new MockEnvironment());

        Field field = new Field("farm-1--fld-1", "fld-1", "farm-1", "Plot 1", 3.5);
        repo.save(field);

        assertTrue(repo.findById("farm-1--fld-1").isPresent());
        assertEquals("Plot 1", repo.findById("farm-1--fld-1").get().getName());

        List<Field> farmFields = repo.findByFarmId("farm-1");
        assertEquals(1, farmFields.size());
        assertEquals(1, repo.countActiveFieldsByFarmId("farm-1"));

        field.setStatus(FieldStatus.ARCHIVED);
        repo.save(field);
        assertEquals(0, repo.countActiveFieldsByFarmId("farm-1"));
        assertEquals(1, repo.findByFarmId("farm-1").size());
    }

    @Test
    @DisplayName("[FAIL-CLOSED-FIELD-02] Live mode fails closed and throws DatabaseUnavailableException on read error without falling back to memory")
    void testLiveMode_FailsClosedOnReadError() {
        FirebaseConfig liveConfig = mock(FirebaseConfig.class);
        when(liveConfig.isInitialized()).thenReturn(true);

        FirestoreFieldRepository repo = new FirestoreFieldRepository(liveConfig, new MockEnvironment());

        assertThrows(DatabaseUnavailableException.class, () -> repo.findById("farm-1--fld-1"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.findByFarmId("farm-1"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.findActiveByFarmId("farm-1"));
    }

    @Test
    @DisplayName("[FAIL-CLOSED-FIELD-03] Production profile safety guard prevents in-memory fallback when uninitialized")
    void testProductionProfileSafetyGuard() {
        FirebaseConfig uninitializedConfig = mock(FirebaseConfig.class);
        when(uninitializedConfig.isInitialized()).thenReturn(false);

        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("production");

        FirestoreFieldRepository repo = new FirestoreFieldRepository(uninitializedConfig, prodEnv);
        assertThrows(IllegalStateException.class, repo::validateEnvironmentSafety);
    }
}
