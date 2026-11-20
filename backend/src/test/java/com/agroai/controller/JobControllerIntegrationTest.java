package com.agroai.controller;

import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.CreateJobRequest;
import com.agroai.dto.UpdateJobRequest;
import com.agroai.model.EmploymentType;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmVisibility;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.model.SalaryType;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.JobRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.FarmService;
import com.agroai.service.JobService;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
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
@DisplayName("Milestone 4 — JobController & PublicJobController Integration Tests")
class JobControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private FarmMembershipRepository membershipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private FarmService farmService;

    @Autowired
    private JobService jobService;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String OWNER_TOKEN = "job.owner.token";
    private static final String OWNER_UID = "job-owner-101";

    private static final String MANAGER_TOKEN = "job.manager.token";
    private static final String MANAGER_UID = "job-manager-202";

    private static final String OBSERVER_TOKEN = "job.observer.token";
    private static final String OBSERVER_UID = "job-observer-303";

    private static final String NON_MEMBER_TOKEN = "job.stranger.token";
    private static final String NON_MEMBER_UID = "job-stranger-404";

    private String farmId;

    @BeforeEach
    void setUp() {
        FirebaseUserDetails ownerDetails = new FirebaseUserDetails(
                OWNER_UID, "owner@agroai.org", "Job Owner", true, Map.of()
        );
        FirebaseUserDetails managerDetails = new FirebaseUserDetails(
                MANAGER_UID, "manager@agroai.org", "Job Manager", true, Map.of()
        );
        FirebaseUserDetails observerDetails = new FirebaseUserDetails(
                OBSERVER_UID, "observer@agroai.org", "Job Observer", true, Map.of()
        );
        FirebaseUserDetails strangerDetails = new FirebaseUserDetails(
                NON_MEMBER_UID, "stranger@agroai.org", "Stranger", true, Map.of()
        );

        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(false))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(true))).thenReturn(ownerDetails);

        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(false))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(true))).thenReturn(managerDetails);

        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(false))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(true))).thenReturn(observerDetails);

        when(tokenVerifier.verifyToken(eq(NON_MEMBER_TOKEN))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(NON_MEMBER_TOKEN), eq(false))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(NON_MEMBER_TOKEN), eq(true))).thenReturn(strangerDetails);

        CreateFarmRequest farmRequest = new CreateFarmRequest(
                null, "Job Test Farm", "Farm for job testing", "Dhaka", "Gazipur",
                "Joydebpur Road", 10.0, FarmVisibility.PUBLIC
        );
        var farmResponse = farmService.registerFarm(ownerDetails, farmRequest);
        farmId = farmResponse.farmId();

        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + farmId + "::" + MANAGER_UID, farmId, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE
        ));
        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + farmId + "::" + OBSERVER_UID, farmId, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE
        ));
    }

    @Test
    @DisplayName("[API-JOB-01] Create Job as Owner Returns 201 Created")
    void testCreateJobSuccessAsOwner() throws Exception {
        CreateJobRequest request = new CreateJobRequest(
                "Paddy Supervisor", "Manage planting", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                List.of("Management", "Paddy"), "2 years", 1, SalaryType.MONTHLY,
                15000.0, 25000.0, "BDT", "Gazipur", Instant.now().plus(14, ChronoUnit.DAYS),
                null, null, false
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Paddy Supervisor"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    @DisplayName("[API-JOB-02] Create Job as Manager Returns 201 Created")
    void testCreateJobSuccessAsManager() throws Exception {
        CreateJobRequest request = new CreateJobRequest(
                "Harvester Technician", "Operate combine harvester", JobCategory.EQUIPMENT_OPERATION, EmploymentType.CONTRACT,
                List.of("Machinery"), "1 year", 2, SalaryType.DAILY,
                800.0, 1000.0, "BDT", "Gazipur", Instant.now().plus(7, ChronoUnit.DAYS),
                null, null, true
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
    }

    @Test
    @DisplayName("[API-JOB-03] Create Job as Observer is Forbidden (403)")
    void testCreateJobAsObserverForbidden() throws Exception {
        CreateJobRequest request = new CreateJobRequest(
                "Assistant", "Valid job description for assistant role", JobCategory.GENERAL_LABOR, EmploymentType.DAILY_WAGE,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(5, ChronoUnit.DAYS), null, null, false
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[API-JOB-04] Create Job Unauthenticated Returns 401 Unauthorized")
    void testCreateJobUnauthenticated() throws Exception {
        CreateJobRequest request = new CreateJobRequest(
                "Assistant", "Valid job description for assistant role", JobCategory.GENERAL_LABOR, EmploymentType.DAILY_WAGE,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(5, ChronoUnit.DAYS), null, null, false
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("[API-JOB-05] List Farm Jobs as Active Member Returns 200 OK")
    void testListFarmJobsSuccessAsMember() throws Exception {
        mockMvc.perform(get("/api/v1/farms/" + farmId + "/jobs")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("[API-JOB-06] List Farm Jobs as Non-Member Returns 403 Forbidden")
    void testListFarmJobsAsNonMemberForbidden() throws Exception {
        mockMvc.perform(get("/api/v1/farms/" + farmId + "/jobs")
                        .header("Authorization", "Bearer " + NON_MEMBER_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[API-JOB-07] Update Job as Manager Returns 200 OK")
    void testUpdateJobSuccessAsManager() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "Initial Job", "Initial Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, false
        );
        var created = jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        UpdateJobRequest updateReq = new UpdateJobRequest(
                "Updated Job Title", "Updated Desc", JobCategory.IRRIGATION, EmploymentType.SEASONAL,
                List.of("Watering"), "None", 2, SalaryType.DAILY,
                500.0, 700.0, "BDT", "Gazipur", Instant.now().plus(12, ChronoUnit.DAYS),
                null, null, created.version()
        );

        mockMvc.perform(put("/api/v1/farms/" + farmId + "/jobs/" + created.jobId())
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.title").value("Updated Job Title"))
                .andExpect(jsonPath("$.data.version").value(2));
    }

    @Test
    @DisplayName("[API-JOB-08] Update Job Stale Version Returns 409 Conflict")
    void testUpdateJobStaleVersionConflict() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "Initial Job", "Initial Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, false
        );
        var created = jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        UpdateJobRequest updateReq = new UpdateJobRequest(
                "Stale Edit", "Valid updated job description text", JobCategory.IRRIGATION, EmploymentType.SEASONAL,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(12, ChronoUnit.DAYS), null, null, 999 // Mismatched version
        );

        mockMvc.perform(put("/api/v1/farms/" + farmId + "/jobs/" + created.jobId())
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("[API-JOB-09] Publish Job as Manager Returns 200 OK")
    void testPublishJobSuccess() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "Draft Job", "Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, false
        );
        var created = jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs/" + created.jobId() + "/publish")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
    }

    @Test
    @DisplayName("[API-JOB-10] Pause and Close Job as Manager Returns 200 OK")
    void testPauseAndCloseJobSuccess() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "Live Job", "Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, true
        );
        var created = jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        // Pause
        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs/" + created.jobId() + "/pause")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAUSED"));

        // Close
        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs/" + created.jobId() + "/close")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"));
    }

    @Test
    @DisplayName("[API-JOB-11] Archive Job as Owner Returns 200 OK")
    void testArchiveJobSuccessAsOwner() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "To Archive", "Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, false
        );
        var created = jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs/" + created.jobId() + "/archive")
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("[API-JOB-12] Archive Job as Manager is Forbidden (403 — Owner Only)")
    void testArchiveJobAsManagerForbidden() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "To Archive", "Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, false
        );
        var created = jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/jobs/" + created.jobId() + "/archive")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[API-JOB-13] Public Job Marketplace Browse Endpoint (Unauthenticated)")
    void testPublicJobBrowseEndpointUnauthenticated() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "Public Field Hand", "Harvesting", JobCategory.HARVESTING, EmploymentType.SEASONAL,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, true
        );
        jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        mockMvc.perform(get("/api/v1/public/jobs")
                        .param("category", "HARVESTING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("[API-JOB-14] Public Job Detail Endpoint (Unauthenticated)")
    void testPublicJobDetailEndpointUnauthenticated() throws Exception {
        CreateJobRequest createReq = new CreateJobRequest(
                "Public Detail Job", "Detailed Desc", JobCategory.CROP_FARMING, EmploymentType.FULL_TIME,
                null, null, 1, SalaryType.NEGOTIABLE, null, null, "BDT", null,
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, true
        );
        var created = jobService.createJob(farmId, createReq, new FirebaseUserDetails(OWNER_UID, "o@a.org", "uid_o", true, Map.of()));

        mockMvc.perform(get("/api/v1/public/jobs/" + created.jobId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.jobId").value(created.jobId()))
                .andExpect(jsonPath("$.data.farmName").value("Job Test Farm"));
    }
}
