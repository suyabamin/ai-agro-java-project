package com.agroai.model;

import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Milestone 4 — Job & Application Domain Invariant Tests")
class JobDomainTest {

    @Test
    @DisplayName("[DOM-JOB-01] Job Invariants & Default Values")
    void testJobDefaultInvariants() {
        Job job = new Job();
        job.setJobId("job-12345");
        job.setFarmId("farm-abc");
        job.setTitle("Paddy Specialist");
        job.setDescription("Managing rice crops");
        job.setJobCategory(JobCategory.CROP_FARMING);
        job.setEmploymentType(EmploymentType.FULL_TIME);
        job.setApplicationDeadline(Instant.now().plus(14, ChronoUnit.DAYS));

        assertEquals(JobStatus.DRAFT, job.getStatus());
        assertEquals(1, job.getVersion());
        assertEquals(0, job.getTotalApplicationsCount());
        assertEquals("BDT", job.getCurrency());
        assertEquals(SalaryType.NEGOTIABLE, job.getSalaryType());
        assertNotNull(job.getCreatedAt());
        assertNotNull(job.getUpdatedAt());
        assertNull(job.getPublishedAt());
        assertNull(job.getClosedAt());
        assertNull(job.getArchivedAt());
    }

    @Test
    @DisplayName("[DOM-JOB-02] Application Invariants & Default Values")
    void testApplicationDefaultInvariants() {
        JobApplication app = new JobApplication();
        app.setApplicationId("app_job-1::uid_abc");
        app.setJobId("job-1");
        app.setFarmId("farm-1");
        app.setApplicantUid("user-1");
        app.setApplicantName("Rahim Farmer");
        app.setCoverLetter("Experienced in harvesting");

        assertEquals(ApplicationStatus.SUBMITTED, app.getStatus());
        assertEquals(1, app.getVersion());
        assertNotNull(app.getSubmittedAt());
        assertNotNull(app.getUpdatedAt());
        assertNull(app.getReviewedAt());
        assertNull(app.getReviewedBy());
        assertNull(app.getDecisionReason());
    }

    @Test
    @DisplayName("[DOM-JOB-03] KeyEncoder Deterministic Application ID Arithmetic")
    void testApplicationIdArithmetic() {
        String jobId = "job-e6e22fa9-e85f-4a0e-bc60-1e5f8f53372c";
        String rawUid = "firebase-user-998877";

        String appId = KeyEncoder.applicationDocId(jobId, rawUid);
        assertTrue(appId.startsWith("app_" + jobId + "::uid_"));

        // Deterministic reproduction
        String appIdRepeat = KeyEncoder.applicationDocId(jobId, rawUid);
        assertEquals(appId, appIdRepeat);

        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.applicationDocId("invalid/slash", rawUid));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.applicationDocId(jobId, ""));
    }

    @Test
    @DisplayName("[DOM-JOB-04] Job Status Lifecycle Transitions")
    void testJobStatusTransitions() {
        JobStatus draft = JobStatus.DRAFT;
        assertFalse(draft.canAcceptApplications());
        assertFalse(draft.isPubliclyVisible());

        JobStatus published = JobStatus.PUBLISHED;
        assertTrue(published.canAcceptApplications());
        assertTrue(published.isPubliclyVisible());

        JobStatus paused = JobStatus.PAUSED;
        assertFalse(paused.canAcceptApplications());

        JobStatus closed = JobStatus.CLOSED;
        assertFalse(closed.canAcceptApplications());

        JobStatus archived = JobStatus.ARCHIVED;
        assertFalse(archived.canAcceptApplications());
    }

    @Test
    @DisplayName("[DOM-JOB-05] Application Status Lifecycle Transition Rules")
    void testApplicationStatusTransitions() {
        ApplicationStatus submitted = ApplicationStatus.SUBMITTED;
        assertFalse(submitted.isTerminal());
        assertTrue(submitted.canWithdraw());

        ApplicationStatus underReview = ApplicationStatus.UNDER_REVIEW;
        assertFalse(underReview.isTerminal());
        assertTrue(underReview.canWithdraw());

        ApplicationStatus shortlisted = ApplicationStatus.SHORTLISTED;
        assertFalse(shortlisted.isTerminal());
        assertTrue(shortlisted.canWithdraw());

        ApplicationStatus approved = ApplicationStatus.APPROVED;
        assertTrue(approved.isTerminal());
        assertFalse(approved.canWithdraw());

        ApplicationStatus rejected = ApplicationStatus.REJECTED;
        assertTrue(rejected.isTerminal());
        assertFalse(rejected.canWithdraw());

        ApplicationStatus withdrawn = ApplicationStatus.WITHDRAWN;
        assertTrue(withdrawn.isTerminal());
        assertFalse(withdrawn.canWithdraw());
    }
}
