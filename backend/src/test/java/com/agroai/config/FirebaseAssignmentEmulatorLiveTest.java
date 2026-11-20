package com.agroai.config;

import com.agroai.dto.CreateAssignmentRequest;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.ReleaseAssignmentRequest;
import com.agroai.dto.ReassignFarmerRequest;
import com.agroai.exception.DuplicateAssignmentException;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.Field;
import com.agroai.model.FieldAssignment;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.FirestoreAssignmentHistoryRepository;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FirestoreFarmRepository;
import com.agroai.repository.FirestoreFieldAssignmentRepository;
import com.agroai.repository.FirestoreFieldRepository;
import com.agroai.repository.FirestoreJobApplicationRepository;
import com.agroai.repository.FirestoreUserRepository;
import com.agroai.service.FieldAssignmentService;
import com.agroai.util.KeyEncoder;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.TimeUnit;
import com.google.cloud.firestore.WriteBatch;
import com.google.cloud.Timestamp;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

/** Explicit local Firestore Emulator integration test; excluded from default Maven tests by its name. */
class FirebaseAssignmentEmulatorLiveTest {
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
                .setCredentials(credentials).setProjectId("demo-agroai-assignment").build());
    }

    @AfterAll
    static void closeEmulatorApp() {
        if (firebaseApp != null) firebaseApp.delete();
    }

    @Test
    void liveEmulatorPreservesTenuresAndSerializesConcurrentPairCreation() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String farmId = "farm-emulator-" + suffix.substring(0, 8);
        String fieldId = farmId + "--plot-01";
        String ownerUid = "owner-" + suffix;
        String farmerUid = "farmer-" + suffix;
        FirebaseConfig firebaseConfig = mock(FirebaseConfig.class);
        when(firebaseConfig.isInitialized()).thenReturn(true);
        when(firebaseConfig.isConfigured()).thenReturn(true);
        MockEnvironment environment = new MockEnvironment();

        var assignments = new FirestoreFieldAssignmentRepository(firebaseConfig, environment);
        var histories = new FirestoreAssignmentHistoryRepository(firebaseConfig);
        var farms = new FirestoreFarmRepository(firebaseConfig, environment);
        var fields = new FirestoreFieldRepository(firebaseConfig, environment);
        var memberships = new com.agroai.repository.FarmMembershipRepository(firebaseConfig, environment);
        var users = new FirestoreUserRepository(firebaseConfig, environment);
        var applications = new FirestoreJobApplicationRepository(firebaseConfig, environment);

        Farm farm = new Farm(farmId, "Emulator Farm", ownerUid, KeyEncoder.encodeUid(ownerUid),
                "District", "Division", 1.0, FarmVisibility.PRIVATE);
        farm.setStatus(FarmStatus.ACTIVE);
        farms.save(farm);
        fields.save(new Field(fieldId, "plot-01", farmId, "Emulator Field", 1.0));
        memberships.saveMembership(new FarmMembership(null, farmId, ownerUid, FarmRole.OWNER, MembershipStatus.ACTIVE));
        users.initializeProfile(ownerUid, ownerUid + "@example.test",
                new InitializeProfileRequest("Emulator Owner", null, null, "en"));
        users.initializeProfile(farmerUid, farmerUid + "@example.test",
                new InitializeProfileRequest("Emulator Farmer", null, null, "en"));

        FieldAssignmentService service = new FieldAssignmentService(assignments, histories, farms, fields,
                memberships, users, applications, firebaseConfig);
        CreateAssignmentRequest create = new CreateAssignmentRequest(farmerUid, List.of("READ"), null, null);
        var first = service.createAssignment(farmId, fieldId, create, ownerUid);
        assertEquals(1, histories.findByAssignmentId(first.assignmentId()).size());
        service.releaseAssignment(farmId, fieldId, first.assignmentId(),
                new ReleaseAssignmentRequest("First tenure ended", 1), ownerUid);

        var second = service.createAssignment(farmId, fieldId, create, ownerUid);
        assertNotEquals(first.assignmentId(), second.assignmentId());
        assertEquals("First tenure ended", assignments.findById(first.assignmentId()).orElseThrow().getReleaseReason());
        service.releaseAssignment(farmId, fieldId, second.assignmentId(),
                new ReleaseAssignmentRequest("Second tenure ended", 1), ownerUid);

        String otherFarmerA = "farmer-a-" + suffix;
        String otherFarmerB = "farmer-b-" + suffix;
        users.initializeProfile(otherFarmerA, otherFarmerA + "@example.test", new InitializeProfileRequest("Farmer A", null, null, "en"));
        users.initializeProfile(otherFarmerB, otherFarmerB + "@example.test", new InitializeProfileRequest("Farmer B", null, null, "en"));
        var distinctPool = Executors.newFixedThreadPool(2);
        CountDownLatch distinctReady = new CountDownLatch(2);
        CountDownLatch distinctStart = new CountDownLatch(1);
        try {
            Future<String> distinctA = distinctPool.submit(() -> {
                distinctReady.countDown(); distinctStart.await();
                return service.createAssignment(farmId, fieldId, new CreateAssignmentRequest(otherFarmerA, List.of("READ"), null, null), ownerUid).assignmentId();
            });
            Future<String> distinctB = distinctPool.submit(() -> {
                distinctReady.countDown(); distinctStart.await();
                return service.createAssignment(farmId, fieldId, new CreateAssignmentRequest(otherFarmerB, List.of("READ"), null, null), ownerUid).assignmentId();
            });
            assertTrue(distinctReady.await(5, TimeUnit.SECONDS));
            distinctStart.countDown();
            service.releaseAssignment(farmId, fieldId, distinctA.get(20, TimeUnit.SECONDS), new ReleaseAssignmentRequest("Concurrent pair cleanup", 1), ownerUid);
            service.releaseAssignment(farmId, fieldId, distinctB.get(20, TimeUnit.SECONDS), new ReleaseAssignmentRequest("Concurrent pair cleanup", 1), ownerUid);
        } finally {
            distinctPool.shutdownNow();
        }

        var pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        Callable<Boolean> duplicateAttempt = () -> {
            ready.countDown();
            start.await();
            try {
                service.createAssignment(farmId, fieldId, create, ownerUid);
                return true;
            } catch (DuplicateAssignmentException expected) {
                return false;
            }
        };
        try {
            Future<Boolean> a = pool.submit(duplicateAttempt);
            Future<Boolean> b = pool.submit(duplicateAttempt);
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(1, (a.get(20, TimeUnit.SECONDS) ? 1 : 0) + (b.get(20, TimeUnit.SECONDS) ? 1 : 0));
        } finally {
            pool.shutdownNow();
        }
        assertEquals(1, assignments.findAssignmentsByFieldPage(fieldId, null, 10).items().stream()
                .filter(a -> a.getStatus() == com.agroai.model.AssignmentStatus.ACTIVE).count());
        assertEquals(2, histories.findByAssignmentId(first.assignmentId()).size());

        var activeFromRace = assignments.findAssignmentsByFieldPage(fieldId, null, 10).items().stream()
                .filter(a -> a.getStatus() == AssignmentStatus.ACTIVE).findFirst().orElseThrow();
        var releasePool = Executors.newFixedThreadPool(2);
        CountDownLatch releaseReady = new CountDownLatch(2);
        CountDownLatch releaseStart = new CountDownLatch(1);
        try {
            Callable<Boolean> repeatRelease = () -> {
                releaseReady.countDown(); releaseStart.await();
                return releaseWithSingleRetry(service, farmId, fieldId, activeFromRace.getAssignmentId(),
                        new ReleaseAssignmentRequest("Concurrent termination", activeFromRace.getVersion()), ownerUid);
            };
            Future<Boolean> releaseA = releasePool.submit(repeatRelease);
            Future<Boolean> releaseB = releasePool.submit(repeatRelease);
            assertTrue(releaseReady.await(5, TimeUnit.SECONDS));
            releaseStart.countDown();
            int retries = (releaseA.get(20, TimeUnit.SECONDS) ? 1 : 0)
                    + (releaseB.get(20, TimeUnit.SECONDS) ? 1 : 0);
            System.out.printf("M5_CONCURRENT_RELEASE retries=%d attempts=2 finalStatus=%s%n", retries,
                    assignments.findById(activeFromRace.getAssignmentId()).orElseThrow().getStatus());
            assertEquals(AssignmentStatus.RELEASED, assignments.findById(activeFromRace.getAssignmentId()).orElseThrow().getStatus());
            int releaseHistoryCount = histories.findByAssignmentId(activeFromRace.getAssignmentId()).size();
            service.releaseAssignment(farmId, fieldId, activeFromRace.getAssignmentId(),
                    new ReleaseAssignmentRequest("Concurrent termination", activeFromRace.getVersion()), ownerUid);
            assertEquals(releaseHistoryCount, histories.findByAssignmentId(activeFromRace.getAssignmentId()).size(),
                    "A client retry after a lost release response must not append a duplicate release event");
        } finally {
            releasePool.shutdownNow();
        }

        String secondFieldId = farmId + "--plot-02";
        fields.save(new Field(secondFieldId, "plot-02", farmId, "Second Emulator Field", 1.0));
        var crossFieldPool = Executors.newFixedThreadPool(2);
        CountDownLatch crossFieldReady = new CountDownLatch(2);
        CountDownLatch crossFieldStart = new CountDownLatch(1);
        try {
            Future<String> sameFarmerOnFieldA = crossFieldPool.submit(() -> {
                crossFieldReady.countDown(); crossFieldStart.await();
                return service.createAssignment(farmId, fieldId, create, ownerUid).assignmentId();
            });
            Future<String> sameFarmerOnFieldB = crossFieldPool.submit(() -> {
                crossFieldReady.countDown(); crossFieldStart.await();
                return service.createAssignment(farmId, secondFieldId, create, ownerUid).assignmentId();
            });
            assertTrue(crossFieldReady.await(5, TimeUnit.SECONDS));
            crossFieldStart.countDown();
            String fieldAId = sameFarmerOnFieldA.get(20, TimeUnit.SECONDS);
            String fieldBId = sameFarmerOnFieldB.get(20, TimeUnit.SECONDS);
            assertNotEquals(fieldAId, fieldBId);
            service.releaseAssignment(farmId, fieldId, fieldAId, new ReleaseAssignmentRequest("Cross-field cleanup", 1), ownerUid);
            service.releaseAssignment(farmId, secondFieldId, fieldBId, new ReleaseAssignmentRequest("Cross-field cleanup", 1), ownerUid);
        } finally {
            crossFieldPool.shutdownNow();
        }

        // Release and reassignment race against the same immutable tenure. Whichever
        // transaction wins, the old tenure must end and no duplicate tenure may be
        // created for the replacement farmer.
        String raceFarmer = "farmer-release-reassign-" + suffix;
        String replacementFarmer = "farmer-release-reassign-next-" + suffix;
        users.initializeProfile(raceFarmer, raceFarmer + "@example.test",
                new InitializeProfileRequest("Race Farmer", null, null, "en"));
        users.initializeProfile(replacementFarmer, replacementFarmer + "@example.test",
                new InitializeProfileRequest("Replacement Farmer", null, null, "en"));
        var raceTenure = service.createAssignment(farmId, fieldId,
                new CreateAssignmentRequest(raceFarmer, List.of("READ"), null, null), ownerUid);
        var releaseReassignPool = Executors.newFixedThreadPool(2);
        CountDownLatch releaseReassignReady = new CountDownLatch(2);
        CountDownLatch releaseReassignStart = new CountDownLatch(1);
        try {
            Future<Object> releaseResult = releaseReassignPool.submit(() -> {
                releaseReassignReady.countDown();
                releaseReassignStart.await();
                try {
                    return service.releaseAssignment(farmId, fieldId, raceTenure.assignmentId(),
                            new ReleaseAssignmentRequest("Concurrent release", raceTenure.version()), ownerUid);
                } catch (RuntimeException failure) {
                    return failure;
                }
            });
            Future<Object> reassignResult = releaseReassignPool.submit(() -> {
                releaseReassignReady.countDown();
                releaseReassignStart.await();
                try {
                    return service.reassignFarmer(farmId, fieldId, raceTenure.assignmentId(),
                            new ReassignFarmerRequest(replacementFarmer, "Concurrent reassignment",
                                    List.of("READ"), raceTenure.version(), null), ownerUid);
                } catch (RuntimeException failure) {
                    return failure;
                }
            });
            assertTrue(releaseReassignReady.await(5, TimeUnit.SECONDS));
            releaseReassignStart.countDown();
            Object releaseOutcome = releaseResult.get(30, TimeUnit.SECONDS);
            Object reassignOutcome = reassignResult.get(30, TimeUnit.SECONDS);
            assertTrue(releaseOutcome instanceof com.agroai.dto.FieldAssignmentResponseDTO
                            || releaseOutcome instanceof RuntimeException,
                    "The concurrent release should either complete or report a handled runtime failure");
            assertEquals(AssignmentStatus.RELEASED,
                    assignments.findById(raceTenure.assignmentId()).orElseThrow().getStatus());
            long activeReplacementTenures = assignments.findAssignmentsByFarmer(replacementFarmer).stream()
                    .filter(a -> fieldId.equals(a.getFieldId()) && a.getStatus() == AssignmentStatus.ACTIVE).count();
            assertTrue(activeReplacementTenures <= 1);
            if (reassignOutcome instanceof com.agroai.dto.FieldAssignmentResponseDTO incoming) {
                assertEquals(1, activeReplacementTenures);
                assertEquals(1, histories.findByAssignmentId(incoming.assignmentId()).size());
            } else {
                assertInstanceOf(RuntimeException.class, reassignOutcome);
                assertEquals(0, activeReplacementTenures);
            }
            assertEquals(2, histories.findByAssignmentId(raceTenure.assignmentId()).size());
        } finally {
            releaseReassignPool.shutdownNow();
        }

        // An assignment transaction racing a field status gate either observes the
        // archived state and fails, or commits first and is subsequently released.
        String lifecycleRaceFieldId = farmId + "--archive-race";
        String lifecycleRaceFarmer = "farmer-archive-race-" + suffix;
        fields.save(new Field(lifecycleRaceFieldId, "archive-race", farmId, "Archive Race Field", 1.0));
        users.initializeProfile(lifecycleRaceFarmer, lifecycleRaceFarmer + "@example.test",
                new InitializeProfileRequest("Archive Race Farmer", null, null, "en"));
        var archiveRacePool = Executors.newFixedThreadPool(2);
        CountDownLatch archiveRaceReady = new CountDownLatch(2);
        CountDownLatch archiveRaceStart = new CountDownLatch(1);
        try {
            Future<Object> creation = archiveRacePool.submit(() -> {
                archiveRaceReady.countDown();
                archiveRaceStart.await();
                try {
                    return service.createAssignment(farmId, lifecycleRaceFieldId,
                            new CreateAssignmentRequest(lifecycleRaceFarmer, List.of("READ"), null, null), ownerUid);
                } catch (RuntimeException failure) {
                    return failure;
                }
            });
            Future<?> archiveGate = archiveRacePool.submit(() -> {
                archiveRaceReady.countDown();
                archiveRaceStart.await();
                FirestoreClient.getFirestore().runTransaction(transaction -> {
                    Field archived = fields.findByIdInTransaction(transaction, lifecycleRaceFieldId);
                    assertNotNull(archived);
                    archived.setStatus(com.agroai.model.FieldStatus.ARCHIVED);
                    archived.setArchivedAt(Instant.now());
                    archived.setVersion(archived.getVersion() + 1);
                    fields.saveInTransaction(transaction, archived);
                    return null;
                }).get();
                return null;
            });
            assertTrue(archiveRaceReady.await(5, TimeUnit.SECONDS));
            archiveRaceStart.countDown();
            Object creationOutcome = creation.get(30, TimeUnit.SECONDS);
            archiveGate.get(30, TimeUnit.SECONDS);
            var racedAssignments = assignments.findAssignmentsByFarmer(lifecycleRaceFarmer);
            if (creationOutcome instanceof com.agroai.dto.FieldAssignmentResponseDTO created) {
                assertTrue(racedAssignments.stream().anyMatch(a -> a.getAssignmentId().equals(created.assignmentId())));
            } else {
                assertInstanceOf(RuntimeException.class, creationOutcome);
                assertTrue(racedAssignments.isEmpty());
            }
            assertEquals(com.agroai.model.FieldStatus.ARCHIVED,
                    fields.findById(lifecycleRaceFieldId).orElseThrow().getStatus());
            var archiveLifecycle = new com.agroai.service.AssignmentLifecycleService(assignments, service, firebaseConfig);
            archiveLifecycle.releaseFieldAssignments(farmId, lifecycleRaceFieldId, ownerUid, "Field archived");
            assertTrue(assignments.findAssignmentsByFarmer(lifecycleRaceFarmer).stream()
                    .noneMatch(a -> a.getStatus() == AssignmentStatus.ACTIVE));
        } finally {
            archiveRacePool.shutdownNow();
        }

        // Competing resumable workers must converge without leaving active records
        // or duplicate release events for the same assignment.
        String workerRaceFieldId = farmId + "--worker-race";
        fields.save(new Field(workerRaceFieldId, "worker-race", farmId, "Worker Race Field", 1.0));
        for (int i = 0; i < 12; i++) {
            FieldAssignment seeded = new FieldAssignment("asgn_worker_" + suffix.substring(0, 8) + "_" + i,
                    farmId, workerRaceFieldId, "worker-farmer-" + i, AssignmentStatus.ACTIVE);
            seeded.setAssignedBy(ownerUid);
            assignments.save(seeded);
        }
        var workerA = new com.agroai.service.AssignmentLifecycleService(assignments, service, firebaseConfig);
        var workerB = new com.agroai.service.AssignmentLifecycleService(assignments, service, firebaseConfig);
        var workerPool = Executors.newFixedThreadPool(2);
        CountDownLatch workerReady = new CountDownLatch(2);
        CountDownLatch workerStart = new CountDownLatch(1);
        try {
            Future<?> a = workerPool.submit(() -> {
                workerReady.countDown(); workerStart.await();
                workerA.releaseFieldAssignments(farmId, workerRaceFieldId, ownerUid, "Worker race cleanup");
                return null;
            });
            Future<?> b = workerPool.submit(() -> {
                workerReady.countDown(); workerStart.await();
                workerB.releaseFieldAssignments(farmId, workerRaceFieldId, ownerUid, "Worker race cleanup");
                return null;
            });
            assertTrue(workerReady.await(5, TimeUnit.SECONDS));
            workerStart.countDown();
            a.get(30, TimeUnit.SECONDS);
            b.get(30, TimeUnit.SECONDS);
            List<FieldAssignment> workerResults = assignments.findAssignmentsByField(workerRaceFieldId);
            assertEquals(12, workerResults.size());
            assertTrue(workerResults.stream().noneMatch(aRecord -> aRecord.getStatus() == AssignmentStatus.ACTIVE));
            assertTrue(workerResults.stream().allMatch(aRecord -> {
                List<com.agroai.model.AssignmentHistory> events = histories.findByAssignmentId(aRecord.getAssignmentId());
                return events.size() == 1 && events.get(0).getEventType().equals("RELEASED");
            }));
        } finally {
            workerPool.shutdownNow();
        }

        String rollbackFarmer = "farmer-rollback-" + suffix;
        users.initializeProfile(rollbackFarmer, rollbackFarmer + "@example.test",
                new InitializeProfileRequest("Rollback Farmer", null, null, "en"));
        var failingHistory = spy(histories);
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new IllegalStateException("injected after history write was queued");
        }).when(failingHistory).saveInTransaction(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        var failingService = new FieldAssignmentService(assignments, failingHistory, farms, fields,
                memberships, users, applications, firebaseConfig);
        CreateAssignmentRequest rollbackRequest = new CreateAssignmentRequest(rollbackFarmer, List.of("READ"), null, null);
        assertThrows(RuntimeException.class, () -> failingService.createAssignment(farmId, fieldId, rollbackRequest, ownerUid));
        assertTrue(assignments.findAssignmentsByFieldPage(fieldId, null, 500).items().stream()
                .noneMatch(a -> rollbackFarmer.equals(a.getFarmerUid()) && a.getStatus() == AssignmentStatus.ACTIVE));
        assertTrue(histories.findByFarmerUid(rollbackFarmer).isEmpty());
        var retried = service.createAssignment(farmId, fieldId, rollbackRequest, ownerUid);
        assertNotNull(retried.assignmentId());
        assertEquals(1, assignments.findAssignmentsByFieldPage(fieldId, null, 500).items().stream()
                .filter(a -> rollbackFarmer.equals(a.getFarmerUid()) && a.getStatus() == AssignmentStatus.ACTIVE).count());

        var lifecycle = new com.agroai.service.AssignmentLifecycleService(assignments, service, firebaseConfig);
        lifecycle.releaseFieldAssignments(farmId, fieldId, ownerUid, "Field deactivated");
        assertEquals(0, assignments.findAssignmentsByFieldPage(fieldId, null, 10).items().stream()
                .filter(a -> a.getStatus() == com.agroai.model.AssignmentStatus.ACTIVE).count());
        var afterLifecycle = service.createAssignment(farmId, fieldId, create, ownerUid);
        assertNotEquals(second.assignmentId(), afterLifecycle.assignmentId());
        assertTrue(lifecycle.isProcessing("field", fieldId) == false);

        // Synthetic emulator-only workload verifies bounded paging and retry after a
        // failure after a release has committed but before its cursor is saved.
        lifecycle.startNewLifecycleCycle("field", fieldId);
        for (int i = 0; i < 105; i++) {
            String seededId = "asgn_seed_" + suffix.substring(0, 8) + "_" + String.format("%03d", i);
            FieldAssignment seeded = new FieldAssignment(seededId, farmId, fieldId,
                    "synthetic-farmer-" + i, AssignmentStatus.ACTIVE);
            seeded.setFarmerName("Synthetic Farmer");
            seeded.setAssignedBy(ownerUid);
            assignments.save(seeded);
        }
        FieldAssignmentService failingOnce = spy(service);
        AtomicInteger releaseCalls = new AtomicInteger();
        doAnswer(invocation -> {
            Object result = invocation.callRealMethod();
            if (releaseCalls.incrementAndGet() == 3) throw new IllegalStateException("injected emulator retry boundary");
            return result;
        }).when(failingOnce).releaseAssignment(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(ReleaseAssignmentRequest.class), org.mockito.ArgumentMatchers.anyString());
        var interrupted = new com.agroai.service.AssignmentLifecycleService(assignments, failingOnce, firebaseConfig);
        assertThrows(IllegalStateException.class,
                () -> interrupted.releaseFieldAssignments(farmId, fieldId, ownerUid, "Synthetic test lifecycle"));
        assertEquals(103, assignments.findAssignmentsByFieldPage(fieldId, null, 200).items().stream()
                .filter(a -> a.getStatus() == AssignmentStatus.ACTIVE).count());
        assertTrue(interrupted.isProcessing("field", fieldId));

        lifecycle.releaseFieldAssignments(farmId, fieldId, ownerUid, "Synthetic test lifecycle");
        assertFalse(lifecycle.isProcessing("field", fieldId));
        assertEquals(0, assignments.findAssignmentsByFieldPage(fieldId, null, 200).items().stream()
                .filter(a -> a.getStatus() == AssignmentStatus.ACTIVE).count());
    }

    @Test
    void historyCursorTraversalIsCompleteForLargeSyntheticSetsAndDocumentsConcurrentInsertContract() throws Exception {
        FirebaseConfig firebaseConfig = mock(FirebaseConfig.class);
        when(firebaseConfig.isInitialized()).thenReturn(true);
        when(firebaseConfig.isConfigured()).thenReturn(true);
        var repository = new FirestoreAssignmentHistoryRepository(firebaseConfig);

        for (int size : List.of(100, 1_000, 5_000)) {
            String assignmentId = "history-page-" + size + "-" + UUID.randomUUID();
            seedHistory(assignmentId, size);
            String warmupCursor = null;
            do {
                CursorPage<com.agroai.model.AssignmentHistory> warmup = repository.findByAssignmentIdPage(assignmentId, warmupCursor, 100);
                warmupCursor = warmup.hasNext() ? warmup.nextCursor() : null;
            } while (warmupCursor != null);
            List<Double> pageLatenciesMs = new ArrayList<>();
            List<String> observed = new ArrayList<>();
            long memoryBefore = usedHeapBytes();
            for (int iteration = 0; iteration < 3; iteration++) {
                String cursor = null;
                do {
                    long started = System.nanoTime();
                    CursorPage<com.agroai.model.AssignmentHistory> page = repository.findByAssignmentIdPage(assignmentId, cursor, 100);
                    pageLatenciesMs.add((System.nanoTime() - started) / 1_000_000.0);
                    if (iteration == 0) observed.addAll(page.items().stream().map(com.agroai.model.AssignmentHistory::getHistoryId).toList());
                    cursor = page.hasNext() ? page.nextCursor() : null;
                } while (cursor != null);
            }
            long heapDelta = usedHeapBytes() - memoryBefore;
            Set<String> unique = new HashSet<>(observed);
            List<String> sorted = observed.stream().sorted().toList();
            long duplicates = observed.size() - unique.size();
            long missing = size - unique.size();
            int pages = (size + 99) / 100;
            assertEquals(size, observed.size(), "Record total for dataset " + size);
            assertEquals(size, unique.size(), "Unique total for dataset " + size);
            assertEquals(0, duplicates, "Duplicate total for dataset " + size);
            assertEquals(0, missing, "Missing total for dataset " + size);
            assertEquals(observed, sorted, "Stable document-ID ordering for dataset " + size);
            System.out.printf("M5_HISTORY_BENCH dataset=%d pageSize=100 pages=%d warmupTraversals=1 measuredTraversals=3 queries=%d duplicates=%d missing=%d medianPageMs=%.3f p95PageMs=%.3f p99PageMs=%.3f maxPageMs=%.3f heapDeltaBytes=%d%n",
                    size, pages, pages * 3, duplicates, missing, percentile(pageLatenciesMs, .50),
                    percentile(pageLatenciesMs, .95), percentile(pageLatenciesMs, .99),
                    pageLatenciesMs.stream().mapToDouble(Double::doubleValue).max().orElse(0), heapDelta);
        }

        String changingAssignment = "history-changing-" + UUID.randomUUID();
        seedHistory(changingAssignment, 101);
        CursorPage<com.agroai.model.AssignmentHistory> first = repository.findByAssignmentIdPage(changingAssignment, null, 100);
        String beforeCursorId = "hist_00050-new-" + UUID.randomUUID();
        String afterCursorId = "hist_00100-new-" + UUID.randomUUID();
        seedHistoryIds(changingAssignment, List.of(beforeCursorId, afterCursorId));
        CursorPage<com.agroai.model.AssignmentHistory> second = repository.findByAssignmentIdPage(changingAssignment, first.nextCursor(), 100);
        Set<String> nextIds = new HashSet<>(second.items().stream().map(com.agroai.model.AssignmentHistory::getHistoryId).toList());
        assertFalse(nextIds.contains(beforeCursorId), "Insert before cursor is outside this forward traversal");
        assertTrue(nextIds.contains(afterCursorId), "Insert after cursor is visible in the changing-set contract");
        assertEquals(0, first.items().stream().map(com.agroai.model.AssignmentHistory::getHistoryId).filter(nextIds::contains).count(),
                "No duplicate IDs across adjacent pages");
    }

    private static void seedHistory(String assignmentId, int count) throws Exception {
        for (int start = 0; start < count; start += 400) {
            List<String> ids = new ArrayList<>();
            for (int i = start; i < Math.min(count, start + 400); i++) ids.add(String.format("hist_%05d", i));
            seedHistoryIds(assignmentId, ids);
        }
    }

    private static boolean releaseWithSingleRetry(FieldAssignmentService service, String farmId, String fieldId,
                                                   String assignmentId, ReleaseAssignmentRequest request,
                                                   String actorUid) {
        try {
            service.releaseAssignment(farmId, fieldId, assignmentId, request, actorUid);
            return false;
        } catch (com.agroai.exception.DatabaseUnavailableException transientFailure) {
            // The transaction is idempotent for a released tenure; a client retry
            // after an emulator contention/timeout must converge to the same record.
            service.releaseAssignment(farmId, fieldId, assignmentId, request, actorUid);
            return true;
        }
    }

    private static void seedHistoryIds(String assignmentId, List<String> ids) throws Exception {
        var db = FirestoreClient.getFirestore();
        WriteBatch batch = db.batch();
        for (String id : ids) {
            Map<String, Object> document = Map.of(
                    "historyId", id, "assignmentId", assignmentId, "farmId", "synthetic-farm",
                    "fieldId", "synthetic-field", "farmerUid", "synthetic-farmer",
                    "eventType", "ASSIGNED", "performedByUid", "synthetic-owner",
                    "performedByRole", "OWNER", "timestamp", Timestamp.ofTimeSecondsAndNanos(1, 0));
            batch.set(db.collection("assignment_history").document(id), document);
        }
        batch.commit().get();
    }

    private static long usedHeapBytes() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }

    private static double percentile(List<Double> values, double p) {
        List<Double> ordered = values.stream().sorted().toList();
        int index = Math.min(ordered.size() - 1, (int) Math.ceil(p * ordered.size()) - 1);
        return ordered.get(index);
    }
}
