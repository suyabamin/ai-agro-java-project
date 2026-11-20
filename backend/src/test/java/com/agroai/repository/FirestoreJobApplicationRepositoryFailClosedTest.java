package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.ApplicationStatus;
import com.agroai.model.JobApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Milestone 4 — FirestoreJobApplicationRepository Fail-Closed & Query Tests")
class FirestoreJobApplicationRepositoryFailClosedTest {

    private FirebaseConfig mockFirebaseConfig;
    private MockEnvironment mockEnvironment;
    private FirestoreJobApplicationRepository repository;

    @BeforeEach
    void setUp() {
        mockFirebaseConfig = mock(FirebaseConfig.class);
        mockEnvironment = new MockEnvironment();
        when(mockFirebaseConfig.isInitialized()).thenReturn(false);
        when(mockFirebaseConfig.isConfigured()).thenReturn(false);
        repository = new FirestoreJobApplicationRepository(mockFirebaseConfig, mockEnvironment);
    }

    @Test
    @DisplayName("[FAIL-CLOSED-APP-01] Dev/Offline Mode Operates In-Memory Without Exceptions")
    void testDevOfflineInMemoryOperation() {
        JobApplication app = new JobApplication();
        app.setApplicationId("app_job-1::uid_user1");
        app.setJobId("job-1");
        app.setFarmId("farm-1");
        app.setApplicantUid("user-1");
        app.setStatus(ApplicationStatus.SUBMITTED);

        JobApplication saved = repository.save(app);
        assertNotNull(saved);

        Optional<JobApplication> found = repository.findById("app_job-1::uid_user1");
        assertTrue(found.isPresent());
        assertEquals("user-1", found.get().getApplicantUid());

        Optional<JobApplication> byJobAndUser = repository.findByJobIdAndApplicantUid("job-1", "user-1");
        assertTrue(byJobAndUser.isPresent());

        List<JobApplication> byFarm = repository.findByFarmId("farm-1");
        assertEquals(1, byFarm.size());

        List<JobApplication> byUser = repository.findByApplicantUid("user-1");
        assertEquals(1, byUser.size());
    }

    @Test
    @DisplayName("[FAIL-CLOSED-APP-02] Live Firestore Read Failure Throws DatabaseUnavailableException")
    void testLiveFirestoreReadFailureThrows() {
        when(mockFirebaseConfig.isInitialized()).thenReturn(true);

        assertThrows(DatabaseUnavailableException.class, () -> repository.findById("app_fail"));
    }

    @Test
    @DisplayName("[FAIL-CLOSED-APP-03] Live Firestore Save Failure Throws DatabaseUnavailableException")
    void testLiveFirestoreSaveFailureThrows() {
        when(mockFirebaseConfig.isInitialized()).thenReturn(true);

        JobApplication app = new JobApplication();
        app.setApplicationId("app_fail");
        assertThrows(DatabaseUnavailableException.class, () -> repository.save(app));
    }
}
