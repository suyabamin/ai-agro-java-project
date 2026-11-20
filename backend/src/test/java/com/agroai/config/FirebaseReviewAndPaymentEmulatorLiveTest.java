package com.agroai.config;

import com.agroai.dto.CreateAssignmentReviewRequest;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.RecordPaymentRequest;
import com.agroai.dto.ReversePaymentRequest;
import com.agroai.dto.UpdateAssignmentReviewRequest;
import com.agroai.exception.DuplicateAssignmentReviewException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.AssignmentReview;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.Field;
import com.agroai.model.FieldAssignment;
import com.agroai.model.MembershipStatus;
import com.agroai.model.PaymentRecord;
import com.agroai.model.PaymentScope;
import com.agroai.model.PaymentStatus;
import com.agroai.repository.AssignmentReviewRepository;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FirestoreFarmRepository;
import com.agroai.repository.FirestoreFieldAssignmentRepository;
import com.agroai.repository.FirestoreFieldRepository;
import com.agroai.repository.FirestorePaymentRepository;
import com.agroai.repository.FirestoreUserRepository;
import com.agroai.service.AssignmentReviewService;
import com.agroai.service.PaymentService;
import com.agroai.util.KeyEncoder;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Isolated live integration tests against the local Cloud Firestore Emulator for
 * M5 Assignment Reviews (tenure persistence, 24h edits, concurrency, authorization)
 * and Manual Payment Records (farm and assignment levels, BDT currency, reversals, visibility).
 */
public class FirebaseReviewAndPaymentEmulatorLiveTest {
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
                .setProjectId("demo-agroai-review-payment")
                .build());
    }

    @AfterAll
    static void closeEmulatorApp() {
        if (firebaseApp != null) {
            firebaseApp.delete();
        }
    }

    @Test
    void testAssignmentReviewPersistenceConcurrencyAndEditsInEmulator() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String farmId = "farm-rev-" + suffix;
        String fieldId = farmId + "--plot-01";
        String ownerUid = "owner-" + suffix;
        String farmerUid = "farmer-" + suffix;
        String strangerUid = "stranger-" + suffix;

        FirebaseConfig firebaseConfig = mock(FirebaseConfig.class);
        when(firebaseConfig.isInitialized()).thenReturn(true);
        when(firebaseConfig.isConfigured()).thenReturn(true);
        MockEnvironment env = new MockEnvironment();

        var farms = new FirestoreFarmRepository(firebaseConfig, env);
        var fields = new FirestoreFieldRepository(firebaseConfig, env);
        var memberships = new FarmMembershipRepository(firebaseConfig, env);
        var users = new FirestoreUserRepository(firebaseConfig, env);
        var assignments = new FirestoreFieldAssignmentRepository(firebaseConfig, env);
        var reviews = new AssignmentReviewRepository(firebaseConfig);

        // Seed data
        Farm farm = new Farm(farmId, "Review Farm", ownerUid, KeyEncoder.encodeUid(ownerUid),
                "District", "Division", 1.0, FarmVisibility.PRIVATE);
        farm.setStatus(FarmStatus.ACTIVE);
        farms.save(farm);
        fields.save(new Field(fieldId, "plot-01", farmId, "Review Field", 1.0));
        memberships.saveMembership(new FarmMembership(null, farmId, ownerUid, FarmRole.OWNER, MembershipStatus.ACTIVE));
        users.initializeProfile(ownerUid, ownerUid + "@example.test", new InitializeProfileRequest("Owner " + suffix, null, null, "en"));
        users.initializeProfile(farmerUid, farmerUid + "@example.test", new InitializeProfileRequest("Farmer " + suffix, null, null, "en"));
        users.initializeProfile(strangerUid, strangerUid + "@example.test", new InitializeProfileRequest("Stranger " + suffix, null, null, "en"));

        // Create completed assignment tenure
        String assignmentId = "asgn-tenure-" + suffix;
        FieldAssignment endedAssignment = new FieldAssignment(assignmentId, farmId, fieldId, farmerUid, AssignmentStatus.COMPLETED);
        assignments.save(endedAssignment);

        // Also create active assignment to verify denial
        String activeAssignmentId = "asgn-active-" + suffix;
        FieldAssignment activeAssignment = new FieldAssignment(activeAssignmentId, farmId, fieldId, farmerUid, AssignmentStatus.ACTIVE);
        assignments.save(activeAssignment);

        AssignmentReviewService reviewService = new AssignmentReviewService(
                reviews, assignments, memberships, farms, users, firebaseConfig);

        // 1. Incomplete / active assignment review is denied
        assertThrows(InvalidStateTransitionException.class, () ->
                reviewService.create(activeAssignmentId, new CreateAssignmentReviewRequest(5, "Should fail"), ownerUid));

        // 2. Non-owner cannot create review
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                reviewService.create(assignmentId, new CreateAssignmentReviewRequest(5, "Not owner"), strangerUid));

        // 3. Duplicate review creation race for the same tenure
        ExecutorService racePool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger duplicateCount = new AtomicInteger(0);

        Callable<Boolean> createAttempt = () -> {
            ready.countDown();
            start.await();
            try {
                reviewService.create(assignmentId, new CreateAssignmentReviewRequest(4, "First create"), ownerUid);
                successCount.incrementAndGet();
                return true;
            } catch (DuplicateAssignmentReviewException ex) {
                duplicateCount.incrementAndGet();
                return false;
            }
        };

        Future<Boolean> f1 = racePool.submit(createAttempt);
        Future<Boolean> f2 = racePool.submit(createAttempt);
        assertTrue(ready.await(5, TimeUnit.SECONDS));
        start.countDown();

        f1.get(20, TimeUnit.SECONDS);
        f2.get(20, TimeUnit.SECONDS);
        racePool.shutdownNow();

        assertEquals(1, successCount.get(), "Exactly one concurrent review create must succeed");
        assertEquals(1, duplicateCount.get(), "Competing review create must fail with DuplicateAssignmentReviewException");

        // 4. Retrieve persisted review in Firestore emulator
        Optional<AssignmentReview> ownerFetch = reviewService.find(assignmentId, ownerUid);
        assertTrue(ownerFetch.isPresent(), "Owner can retrieve persisted review");
        assertEquals(4, ownerFetch.get().rating());
        assertEquals("First create", ownerFetch.get().comment());

        // 5. Correct Farmer participant authorization
        Optional<AssignmentReview> farmerFetch = reviewService.find(assignmentId, farmerUid);
        assertTrue(farmerFetch.isPresent(), "Assigned farmer can retrieve review");
        assertEquals(4, farmerFetch.get().rating());

        // 6. Unrelated user denial
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                reviewService.find(assignmentId, strangerUid));

        // 7. Review edit within 24 hours preserves audit history
        AssignmentReview updated = reviewService.update(assignmentId,
                new UpdateAssignmentReviewRequest(5, "Updated comment after verification"), ownerUid);
        assertEquals(5, updated.rating());
        assertEquals("Updated comment after verification", updated.comment());
        assertEquals(1, updated.revisions().size());
        assertEquals(4, updated.revisions().get(0).rating());
        assertEquals("First create", updated.revisions().get(0).comment());
        assertEquals(ownerUid, updated.revisions().get(0).editedBy());

        // 8. Re-fetch from emulator to verify persistence of updated review and revision history
        Optional<AssignmentReview> reFetch = reviewService.find(assignmentId, ownerUid);
        assertTrue(reFetch.isPresent());
        assertEquals(5, reFetch.get().rating());
        assertEquals(1, reFetch.get().revisions().size());
        assertEquals(4, reFetch.get().revisions().get(0).rating());

        // 9. Non-author cannot edit review
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                reviewService.update(assignmentId, new UpdateAssignmentReviewRequest(3, "Hacked"), strangerUid));
    }

    @Test
    void testManualPaymentPersistenceReversalsAndAuthorizationInEmulator() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String farmId = "farm-pay-" + suffix;
        String fieldId = farmId + "--plot-01";
        String ownerUid = "owner-" + suffix;
        String farmerUid = "farmer-" + suffix;
        String otherFarmerUid = "farmer2-" + suffix;
        String strangerUid = "stranger-" + suffix;

        FirebaseConfig firebaseConfig = mock(FirebaseConfig.class);
        when(firebaseConfig.isInitialized()).thenReturn(true);
        when(firebaseConfig.isConfigured()).thenReturn(true);
        MockEnvironment env = new MockEnvironment();

        var farms = new FirestoreFarmRepository(firebaseConfig, env);
        var fields = new FirestoreFieldRepository(firebaseConfig, env);
        var memberships = new FarmMembershipRepository(firebaseConfig, env);
        var users = new FirestoreUserRepository(firebaseConfig, env);
        var assignments = new FirestoreFieldAssignmentRepository(firebaseConfig, env);
        var payments = new FirestorePaymentRepository(firebaseConfig);

        // Seed farm, fields, members, users
        Farm farm = new Farm(farmId, "Payment Test Farm", ownerUid, KeyEncoder.encodeUid(ownerUid),
                "District", "Division", 2.0, FarmVisibility.PRIVATE);
        farm.setStatus(FarmStatus.ACTIVE);
        farms.save(farm);
        fields.save(new Field(fieldId, "plot-01", farmId, "Field 1", 1.0));
        memberships.saveMembership(new FarmMembership(null, farmId, ownerUid, FarmRole.OWNER, MembershipStatus.ACTIVE));
        users.initializeProfile(ownerUid, ownerUid + "@example.test", new InitializeProfileRequest("Alice Owner", null, null, "en"));
        users.initializeProfile(farmerUid, farmerUid + "@example.test", new InitializeProfileRequest("Bob Farmer", null, null, "en"));
        users.initializeProfile(otherFarmerUid, otherFarmerUid + "@example.test", new InitializeProfileRequest("Dave Farmer", null, null, "en"));
        users.initializeProfile(strangerUid, strangerUid + "@example.test", new InitializeProfileRequest("Eve Stranger", null, null, "en"));

        String assignmentId = "asgn-pay-" + suffix;
        FieldAssignment assignment = new FieldAssignment(assignmentId, farmId, fieldId, farmerUid, AssignmentStatus.ACTIVE);
        assignments.save(assignment);

        PaymentService paymentService = new PaymentService(
                payments, farms, memberships, assignments, users, firebaseConfig);

        // 1. Non-owner payment creation denied
        RecordPaymentRequest farmReq1 = new RecordPaymentRequest(
                null, farmerUid, new BigDecimal("4500.00"), "BDT", Instant.now(), "Monthly maintenance", "Cash");
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                paymentService.recordPayment(farmId, farmReq1, farmerUid));

        // 2. Owner creates farm-level payment
        PaymentRecord farmPayment = paymentService.recordPayment(farmId, farmReq1, ownerUid);
        assertNotNull(farmPayment.paymentId());
        assertEquals(PaymentScope.FARM, farmPayment.scope());
        assertEquals(new BigDecimal("4500.00"), farmPayment.amount());
        assertEquals("BDT", farmPayment.currency());
        assertEquals(PaymentStatus.RECORDED, farmPayment.status());

        // 3. Owner creates assignment-level payment
        RecordPaymentRequest asgnReq = new RecordPaymentRequest(
                assignmentId, farmerUid, new BigDecimal("2000.00"), "BDT", Instant.now(), "Weeding milestone", null);
        PaymentRecord asgnPayment = paymentService.recordPayment(farmId, asgnReq, ownerUid);
        assertEquals(PaymentScope.ASSIGNMENT, asgnPayment.scope());
        assertEquals(assignmentId, asgnPayment.assignmentId());
        assertEquals(PaymentStatus.RECORDED, asgnPayment.status());

        // 4. Multiple payment entries for same tenure/farm are supported
        RecordPaymentRequest asgnReq2 = new RecordPaymentRequest(
                assignmentId, farmerUid, new BigDecimal("1500.00"), "BDT", Instant.now(), "Fertilizer milestone", null);
        PaymentRecord asgnPayment2 = paymentService.recordPayment(farmId, asgnReq2, ownerUid);
        assertNotEquals(asgnPayment.paymentId(), asgnPayment2.paymentId());

        // 5. Relevant farmer visibility vs other farmer isolation
        List<PaymentRecord> farmerView = paymentService.listFarmPayments(farmId, null, farmerUid, 50);
        assertTrue(farmerView.stream().allMatch(p -> p.farmerUid().equals(farmerUid)));
        assertEquals(3, farmerView.size(), "Farmer sees all 3 payments intended for them");

        List<PaymentRecord> otherFarmerView = paymentService.listFarmPayments(farmId, null, otherFarmerUid, 50);
        assertEquals(0, otherFarmerView.size(), "Other farmer cannot see payments intended for another farmer");

        // Stranger read access denied on direct lookup
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                paymentService.getPayment(asgnPayment.paymentId(), strangerUid));

        // 6. Owner reverses a payment with audit trail
        ReversePaymentRequest revReq = new ReversePaymentRequest("Duplicate entry mistakenly recorded");
        PaymentRecord reversed = paymentService.reversePayment(asgnPayment2.paymentId(), revReq, ownerUid);
        assertEquals(PaymentStatus.REVERSED, reversed.status());
        assertEquals(ownerUid, reversed.reversedBy());
        assertEquals("Duplicate entry mistakenly recorded", reversed.reversalReason());
        assertNotNull(reversed.reversedAt());

        // Verify reversed record fetched directly from Firestore
        PaymentRecord fetchedReversed = paymentService.getPayment(asgnPayment2.paymentId(), ownerUid);
        assertEquals(PaymentStatus.REVERSED, fetchedReversed.status());
        assertEquals("Duplicate entry mistakenly recorded", fetchedReversed.reversalReason());

        // 7. Cannot reverse already reversed payment
        assertThrows(InvalidStateTransitionException.class, () ->
                paymentService.reversePayment(asgnPayment2.paymentId(), new ReversePaymentRequest("Second attempt"), ownerUid));
    }
}
