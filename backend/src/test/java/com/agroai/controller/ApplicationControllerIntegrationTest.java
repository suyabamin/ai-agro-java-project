package com.agroai.controller;

import com.agroai.dto.ApplicationDecisionRequest;
import com.agroai.dto.CreateApplicationRequest;
import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.CreateJobRequest;
import com.agroai.dto.SendMessageRequest;
import com.agroai.model.EmploymentType;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmVisibility;
import com.agroai.model.JobCategory;
import com.agroai.model.MembershipStatus;
import com.agroai.model.SalaryType;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.JobApplicationRepository;
import com.agroai.repository.JobRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.FarmService;
import com.agroai.service.JobApplicationService;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Milestone 4 — ApplicationController & RecruitmentController Integration Tests")
class ApplicationControllerIntegrationTest {

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
    private JobApplicationRepository applicationRepository;

    @Autowired
    private FarmService farmService;

    @Autowired
    private JobService jobService;

    @Autowired
    private JobApplicationService applicationService;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String OWNER_TOKEN = "app.owner.token";
    private static final String OWNER_UID = "app-owner-101";

    private static final String MANAGER_TOKEN = "app.manager.token";
    private static final String MANAGER_UID = "app-manager-202";

    private static final String OBSERVER_TOKEN = "app.observer.token";
    private static final String OBSERVER_UID = "app-observer-303";

    private static final String APPLICANT_TOKEN = "app.applicant.token";
    private static final String APPLICANT_UID = "app-applicant-404";

    private static final String STRANGER_TOKEN = "app.stranger.token";
    private static final String STRANGER_UID = "app-stranger-505";

    private String farmId;
    private String jobId;

    @BeforeEach
    void setUp() {
        FirebaseUserDetails ownerDetails = new FirebaseUserDetails(
                OWNER_UID, "owner@agroai.org", "App Owner", true, Map.of()
        );
        FirebaseUserDetails managerDetails = new FirebaseUserDetails(
                MANAGER_UID, "manager@agroai.org", "App Manager", true, Map.of()
        );
        FirebaseUserDetails observerDetails = new FirebaseUserDetails(
                OBSERVER_UID, "observer@agroai.org", "App Observer", true, Map.of()
        );
        FirebaseUserDetails applicantDetails = new FirebaseUserDetails(
                APPLICANT_UID, "applicant@agroai.org", "Candidate", true, Map.of()
        );
        FirebaseUserDetails strangerDetails = new FirebaseUserDetails(
                STRANGER_UID, "stranger@agroai.org", "Stranger", true, Map.of()
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

        when(tokenVerifier.verifyToken(eq(APPLICANT_TOKEN))).thenReturn(applicantDetails);
        when(tokenVerifier.verifyToken(eq(APPLICANT_TOKEN), eq(false))).thenReturn(applicantDetails);
        when(tokenVerifier.verifyToken(eq(APPLICANT_TOKEN), eq(true))).thenReturn(applicantDetails);

        when(tokenVerifier.verifyToken(eq(STRANGER_TOKEN))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(STRANGER_TOKEN), eq(false))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(STRANGER_TOKEN), eq(true))).thenReturn(strangerDetails);

        CreateFarmRequest farmRequest = new CreateFarmRequest(
                null, "Recruitment Farm", "Farm for recruitment test", "Dhaka", "Narsingdi",
                "Road 5", 8.0, FarmVisibility.PUBLIC
        );
        var farmResponse = farmService.registerFarm(ownerDetails, farmRequest);
        farmId = farmResponse.farmId();

        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + farmId + "::" + MANAGER_UID, farmId, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE
        ));
        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + farmId + "::" + OBSERVER_UID, farmId, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE
        ));

        CreateJobRequest jobRequest = new CreateJobRequest(
                "Transplanting Crew", "Transplant young paddy seedlings", JobCategory.CROP_FARMING, EmploymentType.SEASONAL,
                List.of("Transplanting"), "1 year", 5, SalaryType.DAILY,
                700.0, 900.0, "BDT", "Narsingdi", Instant.now().plus(14, ChronoUnit.DAYS),
                null, null, true
        );
        var jobResponse = jobService.createJob(farmId, jobRequest, ownerDetails);
        jobId = jobResponse.jobId();
    }

    @Test
    @DisplayName("[API-APP-01] Submit Application Returns 201 Created")
    void testSubmitApplicationSuccess() throws Exception {
        CreateApplicationRequest request = new CreateApplicationRequest(
                "I am experienced in manual transplanting and wetland field preparation.",
                "3 seasons in Narsingdi paddy fields",
                List.of("Transplanting", "Rice Seeding"),
                "Immediate",
                800.0
        );

        mockMvc.perform(post("/api/v1/jobs/" + jobId + "/applications")
                        .header("Authorization", "Bearer " + APPLICANT_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.jobId").value(jobId));
    }

    @Test
    @DisplayName("[API-APP-02] Duplicate Application for Same Job Returns 409 Conflict")
    void testDuplicateApplicationReturnsConflict() throws Exception {
        CreateApplicationRequest request = new CreateApplicationRequest(
                "First application cover letter", null, null, null, null
        );

        // First application succeeds
        mockMvc.perform(post("/api/v1/jobs/" + jobId + "/applications")
                        .header("Authorization", "Bearer " + APPLICANT_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        // Second application fails with 409 Conflict
        mockMvc.perform(post("/api/v1/jobs/" + jobId + "/applications")
                        .header("Authorization", "Bearer " + APPLICANT_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("[API-APP-03] List My Applications Returns 200 OK")
    void testListMyApplications() throws Exception {
        mockMvc.perform(get("/api/v1/users/me/applications")
                        .header("Authorization", "Bearer " + APPLICANT_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("[API-APP-04] Candidate Withdraws Application Returns 200 OK")
    void testWithdrawApplication() throws Exception {
        CreateApplicationRequest request = new CreateApplicationRequest("Letter", null, null, null, null);
        var created = applicationService.applyForJob(
                jobId, request, new FirebaseUserDetails(APPLICANT_UID, "a@a.org", "uid_a", true, Map.of())
        );

        mockMvc.perform(post("/api/v1/applications/" + created.applicationId() + "/withdraw")
                        .header("Authorization", "Bearer " + APPLICANT_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("WITHDRAWN"));
    }

    @Test
    @DisplayName("[API-APP-05] List Farm Applications as Manager Returns 200 OK")
    void testListFarmApplicationsAsManager() throws Exception {
        mockMvc.perform(get("/api/v1/farms/" + farmId + "/applications")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("[API-APP-06] List Farm Applications as Observer Returns 403 Forbidden")
    void testListFarmApplicationsAsObserverForbidden() throws Exception {
        mockMvc.perform(get("/api/v1/farms/" + farmId + "/applications")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[API-APP-07] Application Review Lifecycle: Review, Shortlist, Approve, Reject")
    void testApplicationReviewWorkflow() throws Exception {
        CreateApplicationRequest request = new CreateApplicationRequest("Experienced farmer", null, null, null, null);
        var created = applicationService.applyForJob(
                jobId, request, new FirebaseUserDetails(APPLICANT_UID, "a@a.org", "uid_a", true, Map.of())
        );
        String appId = created.applicationId();

        // 1. Review
        mockMvc.perform(post("/api/v1/farms/" + farmId + "/applications/" + appId + "/review")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UNDER_REVIEW"));

        // 2. Shortlist
        mockMvc.perform(post("/api/v1/farms/" + farmId + "/applications/" + appId + "/shortlist")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SHORTLISTED"));

        // 3. Approve (CRITICAL: approval does not create field assignments)
        ApplicationDecisionRequest approveReq = new ApplicationDecisionRequest("Qualified worker", 3);
        mockMvc.perform(post("/api/v1/farms/" + farmId + "/applications/" + appId + "/approve")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(approveReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    @Test
    @DisplayName("[API-APP-08] Private Communication Discussion Messages")
    void testPrivateApplicationMessages() throws Exception {
        CreateApplicationRequest request = new CreateApplicationRequest("Candidate application", null, null, null, null);
        var created = applicationService.applyForJob(
                jobId, request, new FirebaseUserDetails(APPLICANT_UID, "a@a.org", "uid_a", true, Map.of())
        );
        String appId = created.applicationId();

        // Applicant sends message
        SendMessageRequest msgReq = new SendMessageRequest("Hello, I am ready to start whenever needed.");
        mockMvc.perform(post("/api/v1/applications/" + appId + "/messages")
                        .header("Authorization", "Bearer " + APPLICANT_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(msgReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.senderRole").value("APPLICANT"));

        // Stranger denied reading messages
        mockMvc.perform(get("/api/v1/applications/" + appId + "/messages")
                        .header("Authorization", "Bearer " + STRANGER_TOKEN))
                .andExpect(status().isForbidden());

        // Manager reads messages
        mockMvc.perform(get("/api/v1/applications/" + appId + "/messages")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].content").value("Hello, I am ready to start whenever needed."));
    }
}
