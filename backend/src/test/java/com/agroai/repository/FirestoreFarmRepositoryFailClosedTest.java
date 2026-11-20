package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.Farm;
import com.agroai.model.FarmVisibility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("FirestoreFarmRepository Fail-Closed & Dual-Mode Tests")
class FirestoreFarmRepositoryFailClosedTest {

    @Test
    @DisplayName("[FAIL-CLOSED-FARM-01] Dev/Offline mode operates safely with in-memory store when uninitialized")
    void testOfflineModeOperations() {
        FirebaseConfig uninitializedConfig = mock(FirebaseConfig.class);
        when(uninitializedConfig.isInitialized()).thenReturn(false);

        FirestoreFarmRepository repo = new FirestoreFarmRepository(uninitializedConfig, new org.springframework.mock.env.MockEnvironment());

        Farm farm = new Farm("farm-test-1", "Test Farm", "uid-1", "safe-1", "Dhaka", "Dhaka", 10.0, FarmVisibility.PUBLIC);
        repo.save(farm);

        assertTrue(repo.findById("farm-test-1").isPresent());
        assertEquals("Test Farm", repo.findById("farm-test-1").get().getName());

        List<Farm> farms = repo.findByIds(List.of("farm-test-1"));
        assertEquals(1, farms.size());
    }

    @Test
    @DisplayName("[FAIL-CLOSED-FARM-02] Live mode fails closed and throws DatabaseUnavailableException on read error without falling back to memory")
    void testLiveMode_FailsClosedOnReadError() {
        FirebaseConfig liveConfig = mock(FirebaseConfig.class);
        when(liveConfig.isInitialized()).thenReturn(true);

        FirestoreFarmRepository repo = new FirestoreFarmRepository(liveConfig, new org.springframework.mock.env.MockEnvironment());

        // FirebaseApp is not initialized in this unit test context, so calling FirestoreClient will throw
        assertThrows(DatabaseUnavailableException.class, () -> repo.findById("farm-123"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.findPublicProjection("farm-123"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.listPublicProjections(null, null, null, 0, 10));
    }

    @Test
    @DisplayName("[FAIL-CLOSED-FARM-03] Membership repository fails closed on live Firestore exceptions")
    void testMembershipRepo_FailsClosedOnLiveException() {
        FirebaseConfig liveConfig = mock(FirebaseConfig.class);
        when(liveConfig.isInitialized()).thenReturn(true);

        FarmMembershipRepository repo = new FarmMembershipRepository(liveConfig, new org.springframework.mock.env.MockEnvironment());

        assertThrows(DatabaseUnavailableException.class, () -> repo.findMembership("farm-1", "user-1"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.findActiveMembershipsByUser("user-1"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.findMembersByFarm("farm-1"));
    }
}
