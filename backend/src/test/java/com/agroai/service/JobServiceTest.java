package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateJobRequest;
import com.agroai.dto.JobResponseDTO;
import com.agroai.dto.PublicJobResponseDTO;
import com.agroai.dto.UpdateJobRequest;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.EmploymentType;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.Job;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.model.SalaryType;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.JobRepository;
import com.agroai.security.FirebaseUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Milestone 4 — JobService Business Logic & Lifecycle Tests")
class JobServiceTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private FarmMembershipRepository membershipRepository;

    @Mock
    private FirebaseConfig firebaseConfig;

    private JobService jobService;

    private final String FARM_ID = "farm-11111111-2222-3333-4444-555555555555";
    private final String OWNER_UID = "owner-uid-001";
    private final String MANAGER_UID = "manager-uid-002";
    private final String OBSERVER_UID = "observer-uid-003";

    private FirebaseUserDetails ownerUser;
    private FirebaseUserDetails managerUser;
    private FirebaseUserDetails observerUser;
    private Farm testFarm;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(firebaseConfig.isInitialized()).thenReturn(false);

        ownerUser = new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "uid_owner", true, Map.of());
        managerUser = new FirebaseUserDetails(MANAGER_UID, "manager@agroai.org", "uid_manager", true, Map.of());
        observerUser = new FirebaseUserDetails(OBSERVER_UID, "observer@agroai.org", "uid_observer", true, Map.of());

        testFarm = new Farm(FARM_ID, "Golden Grain Farm", OWNER_UID, "uid_owner", "Gazipur", "Dhaka", 15.0, FarmVisibility.PUBLIC);
        testFarm.setStatus(FarmStatus.ACTIVE);

        when(farmRepository.findById(FARM_ID)).thenReturn(Optional.of(testFarm));

        FarmMembership ownerMembership = new FarmMembership("mbr_1", FARM_ID, OWNER_UID, FarmRole.OWNER, MembershipStatus.ACTIVE);
        FarmMembership managerMembership = new FarmMembership("mbr_2", FARM_ID, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE);
        FarmMembership observerMembership = new FarmMembership("mbr_3", FARM_ID, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE);

        when(membershipRepository.findMembership(FARM_ID, OWNER_UID)).thenReturn(Optional.of(ownerMembership));
        when(membershipRepository.findMembership(FARM_ID, MANAGER_UID)).thenReturn(Optional.of(managerMembership));
        when(membershipRepository.findMembership(FARM_ID, OBSERVER_UID)).thenReturn(Optional.of(observerMembership));

        when(jobRepository.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        jobService = new JobService(jobRepository, farmRepository, membershipRepository, firebaseConfig);
    }

    @Test
    @DisplayName("[SVC-JOB-01] Create Job as Owner or Manager Succeeds")
    void testCreateJobSuccess() {
        CreateJobRequest request = new CreateJobRequest(
                "Seasonal Rice Harvester",
                "Operate modern harvesting equipment",
                JobCategory.HARVESTING,
                EmploymentType.SEASONAL,
                List.of("Harvesting", "Equipment"),
                "1+ year",
                3,
                SalaryType.DAILY,
                800.0,
                1200.0,
                "BDT",
                "Gazipur, Dhaka",
                Instant.now().plus(14, ChronoUnit.DAYS),
                null,
                null,
                false
        );

        JobResponseDTO response = jobService.createJob(FARM_ID, request, ownerUser);
        assertNotNull(response);
        assertEquals("Seasonal Rice Harvester", response.title());
        assertEquals(JobStatus.DRAFT, response.status());
        assertEquals(1, response.version());
        verify(jobRepository, times(1)).save(any(Job.class));
    }

    @Test
    @DisplayName("[SVC-JOB-02] Create Job Under Archived Farm Throws InvalidStateTransitionException")
    void testCreateJobUnderArchivedFarmFails() {
        testFarm.setStatus(FarmStatus.ARCHIVED);

        CreateJobRequest request = new CreateJobRequest(
                "Harvester", "Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(7, ChronoUnit.DAYS), null, null, false
        );

        assertThrows(InvalidStateTransitionException.class, () -> jobService.createJob(FARM_ID, request, ownerUser));
    }

    @Test
    @DisplayName("[SVC-JOB-03] Create Job with Minimum Salary Greater Than Maximum Salary Fails")
    void testCreateJobInvalidSalaryRange() {
        CreateJobRequest request = new CreateJobRequest(
                "Harvester", "Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.MONTHLY, 20000.0, 15000.0, "BDT", null,
                Instant.now().plus(7, ChronoUnit.DAYS), null, null, false
        );

        assertThrows(IllegalArgumentException.class, () -> jobService.createJob(FARM_ID, request, ownerUser));
    }

    @Test
    @DisplayName("[SVC-JOB-04] Update Job Optimistic Concurrency Locking")
    void testUpdateJobOptimisticLocking() {
        Job existingJob = new Job();
        existingJob.setJobId("job-101");
        existingJob.setFarmId(FARM_ID);
        existingJob.setTitle("Old Title");
        existingJob.setDescription("Old Description");
        existingJob.setStatus(JobStatus.DRAFT);
        existingJob.setVersion(2);
        when(jobRepository.findById("job-101")).thenReturn(Optional.of(existingJob));

        UpdateJobRequest validRequest = new UpdateJobRequest(
                "New Title", "New Description", JobCategory.IRRIGATION, EmploymentType.FULL_TIME,
                List.of("Irrigation"), "2 years", 2, SalaryType.MONTHLY,
                15000.0, 20000.0, "BDT", "Gazipur", Instant.now().plus(10, ChronoUnit.DAYS),
                null, null, 2
        );

        JobResponseDTO updated = jobService.updateJob(FARM_ID, "job-101", validRequest, managerUser);
        assertEquals("New Title", updated.title());
        assertEquals(3, updated.version());

        UpdateJobRequest staleRequest = new UpdateJobRequest(
                "Stale Title", "Desc", JobCategory.IRRIGATION, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, 1
        );

        assertThrows(StaleVersionException.class, () -> jobService.updateJob(FARM_ID, "job-101", staleRequest, managerUser));
    }

    @Test
    @DisplayName("[SVC-JOB-05] Publish Job Succeeds and Updates PublishedAt")
    void testPublishJobSuccess() {
        Job job = new Job();
        job.setJobId("job-publish");
        job.setFarmId(FARM_ID);
        job.setStatus(JobStatus.DRAFT);
        job.setVersion(1);
        job.setApplicationDeadline(Instant.now().plus(5, ChronoUnit.DAYS));
        when(jobRepository.findById("job-publish")).thenReturn(Optional.of(job));

        JobResponseDTO published = jobService.publishJob(FARM_ID, "job-publish", managerUser);
        assertEquals(JobStatus.PUBLISHED, published.status());
        assertNotNull(published.publishedAt());
        assertEquals(2, published.version());
    }

    @Test
    @DisplayName("[SVC-JOB-06] Pause and Close Job Transitions")
    void testPauseAndCloseJob() {
        Job job = new Job();
        job.setJobId("job-lifecycle");
        job.setFarmId(FARM_ID);
        job.setStatus(JobStatus.PUBLISHED);
        job.setVersion(1);
        when(jobRepository.findById("job-lifecycle")).thenReturn(Optional.of(job));

        JobResponseDTO paused = jobService.pauseJob(FARM_ID, "job-lifecycle", managerUser);
        assertEquals(JobStatus.PAUSED, paused.status());

        job.setStatus(JobStatus.PUBLISHED); // Re-publish
        JobResponseDTO closed = jobService.closeJob(FARM_ID, "job-lifecycle", managerUser);
        assertEquals(JobStatus.CLOSED, closed.status());
        assertNotNull(closed.closedAt());
    }

    @Test
    @DisplayName("[SVC-JOB-07] Archive Job Restricted to Owner Only")
    void testArchiveJobOwnerRestricted() {
        Job job = new Job();
        job.setJobId("job-arch");
        job.setFarmId(FARM_ID);
        job.setStatus(JobStatus.CLOSED);
        job.setVersion(1);
        when(jobRepository.findById("job-arch")).thenReturn(Optional.of(job));

        // Manager cannot archive
        assertThrows(UnauthorizedResourceAccessException.class, () -> jobService.archiveJob(FARM_ID, "job-arch", managerUser));

        // Owner can archive
        assertDoesNotThrow(() -> jobService.archiveJob(FARM_ID, "job-arch", ownerUser));
        assertEquals(JobStatus.ARCHIVED, job.getStatus());
        assertNotNull(job.getArchivedAt());
    }

    @Test
    @DisplayName("[SVC-JOB-08] Public Job Listing Enriches Farm Details")
    void testGetPublicJobsEnrichment() {
        Job job = new Job();
        job.setJobId("job-pub-1");
        job.setFarmId(FARM_ID);
        job.setTitle("Field Assistant");
        job.setStatus(JobStatus.PUBLISHED);
        when(jobRepository.findPublicJobs(any(), any(), any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(List.of(job));

        List<PublicJobResponseDTO> publicJobs = jobService.getPublicJobs(null, null, null, null, null, null, null, 0, 10);
        assertEquals(1, publicJobs.size());
        assertEquals("Golden Grain Farm", publicJobs.get(0).farmName());
        assertEquals("Gazipur", publicJobs.get(0).farmDistrict());
    }
}
