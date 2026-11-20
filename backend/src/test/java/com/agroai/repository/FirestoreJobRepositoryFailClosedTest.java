package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.EmploymentType;
import com.agroai.model.Job;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Milestone 4 — FirestoreJobRepository Fail-Closed & Query Tests")
class FirestoreJobRepositoryFailClosedTest {

    private FirebaseConfig mockFirebaseConfig;
    private MockEnvironment mockEnvironment;
    private FirestoreJobRepository repository;

    @BeforeEach
    void setUp() {
        mockFirebaseConfig = mock(FirebaseConfig.class);
        mockEnvironment = new MockEnvironment();
        when(mockFirebaseConfig.isInitialized()).thenReturn(false);
        when(mockFirebaseConfig.isConfigured()).thenReturn(false);
        repository = new FirestoreJobRepository(mockFirebaseConfig, mockEnvironment);
    }

    @Test
    @DisplayName("[FAIL-CLOSED-JOB-01] Dev/Offline Mode Operates In-Memory Without Exceptions")
    void testDevOfflineInMemoryOperation() {
        Job job = new Job();
        job.setJobId("job-test-01");
        job.setFarmId("farm-test-01");
        job.setTitle("Harvester Operator");
        job.setStatus(JobStatus.PUBLISHED);
        job.setApplicationDeadline(Instant.now().plus(7, ChronoUnit.DAYS));

        Job saved = repository.save(job);
        assertNotNull(saved);

        Optional<Job> found = repository.findById("job-test-01");
        assertTrue(found.isPresent());
        assertEquals("Harvester Operator", found.get().getTitle());

        List<Job> farmJobs = repository.findByFarmId("farm-test-01");
        assertEquals(1, farmJobs.size());
    }

    @Test
    @DisplayName("[FAIL-CLOSED-JOB-02] Live Firestore Read Failure Throws DatabaseUnavailableException")
    void testLiveFirestoreReadFailureThrows() {
        when(mockFirebaseConfig.isInitialized()).thenReturn(true);

        assertThrows(DatabaseUnavailableException.class, () -> repository.findById("job-fails"));
    }

    @Test
    @DisplayName("[FAIL-CLOSED-JOB-03] Public Job Query Filters Out Expired and Non-Published Jobs")
    void testPublicJobQueryFiltering() {
        Job activeJob = new Job();
        activeJob.setJobId("job-active");
        activeJob.setFarmId("farm-01");
        activeJob.setTitle("Rice Planter");
        activeJob.setJobCategory(JobCategory.CROP_FARMING);
        activeJob.setEmploymentType(EmploymentType.FULL_TIME);
        activeJob.setStatus(JobStatus.PUBLISHED);
        activeJob.setApplicationDeadline(Instant.now().plus(10, ChronoUnit.DAYS));
        repository.save(activeJob);

        Job expiredJob = new Job();
        expiredJob.setJobId("job-expired");
        expiredJob.setFarmId("farm-01");
        expiredJob.setTitle("Rice Harvester");
        expiredJob.setStatus(JobStatus.PUBLISHED);
        expiredJob.setApplicationDeadline(Instant.now().minus(1, ChronoUnit.DAYS));
        repository.save(expiredJob);

        Job draftJob = new Job();
        draftJob.setJobId("job-draft");
        draftJob.setFarmId("farm-01");
        draftJob.setTitle("Irrigation Tech");
        draftJob.setStatus(JobStatus.DRAFT);
        draftJob.setApplicationDeadline(Instant.now().plus(10, ChronoUnit.DAYS));
        repository.save(draftJob);

        List<Job> publicJobs = repository.findPublicJobs(null, null, null, null, null, null, null, 0, 10);
        assertEquals(1, publicJobs.size());
        assertEquals("job-active", publicJobs.get(0).getJobId());
    }
}
