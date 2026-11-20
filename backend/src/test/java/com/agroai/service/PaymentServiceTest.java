package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.RecordPaymentRequest;
import com.agroai.dto.ReversePaymentRequest;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.PaymentNotFoundException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FieldAssignment;
import com.agroai.model.MembershipStatus;
import com.agroai.model.PaymentRecord;
import com.agroai.model.PaymentScope;
import com.agroai.model.PaymentStatus;
import com.agroai.model.UserProfile;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.PaymentRepository;
import com.agroai.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class PaymentServiceTest {
    private PaymentRepository paymentRepository;
    private FarmRepository farmRepository;
    private FarmMembershipRepository membershipRepository;
    private FieldAssignmentRepository assignmentRepository;
    private UserRepository userRepository;
    private FirebaseConfig firebaseConfig;
    private PaymentService paymentService;

    private Farm farm;
    private FieldAssignment assignment;
    private UserProfile ownerProfile;
    private UserProfile farmerProfile;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRepository.class);
        farmRepository = mock(FarmRepository.class);
        membershipRepository = mock(FarmMembershipRepository.class);
        assignmentRepository = mock(FieldAssignmentRepository.class);
        userRepository = mock(UserRepository.class);
        firebaseConfig = mock(FirebaseConfig.class);

        when(firebaseConfig.isInitialized()).thenReturn(false);
        when(firebaseConfig.isConfigured()).thenReturn(false);

        farm = new Farm();
        farm.setFarmId("farm-1");
        farm.setName("Green Valley Farm");
        farm.setStatus(FarmStatus.ACTIVE);
        when(farmRepository.findById("farm-1")).thenReturn(Optional.of(farm));

        ownerProfile = new UserProfile("owner-1", "owner@agroai.test", "Alice Owner");
        farmerProfile = new UserProfile("farmer-1", "farmer@agroai.test", "Bob Farmer");
        UserProfile strangerProfile = new UserProfile("stranger-1", "stranger@agroai.test", "Charlie Stranger");

        when(userRepository.findPrivateProfile("owner-1")).thenReturn(Optional.of(ownerProfile));
        when(userRepository.findPrivateProfile("farmer-1")).thenReturn(Optional.of(farmerProfile));
        when(userRepository.findPrivateProfile("stranger-1")).thenReturn(Optional.of(strangerProfile));

        FarmMembership ownerMembership = new FarmMembership("mbr-1", "farm-1", "owner-1", FarmRole.OWNER, MembershipStatus.ACTIVE);
        when(membershipRepository.findMembership("farm-1", "owner-1")).thenReturn(Optional.of(ownerMembership));

        assignment = new FieldAssignment("asgn-1", "farm-1", "field-1", "farmer-1", AssignmentStatus.ACTIVE);
        when(assignmentRepository.findById("asgn-1")).thenReturn(Optional.of(assignment));

        when(paymentRepository.save(any(), isNull())).thenAnswer(invocation -> invocation.getArgument(0));

        paymentService = new PaymentService(
                paymentRepository,
                farmRepository,
                membershipRepository,
                assignmentRepository,
                userRepository,
                firebaseConfig
        );
    }

    @Test
    void ownerCanRecordFarmLevelPaymentInBDT() {
        RecordPaymentRequest request = new RecordPaymentRequest(
                null,
                "farmer-1",
                new BigDecimal("5000.00"),
                "BDT",
                Instant.now(),
                "Seasonal planting compensation",
                "Paid in cash on site"
        );

        PaymentRecord record = paymentService.recordPayment("farm-1", request, "owner-1");

        assertNotNull(record.paymentId());
        assertEquals("farm-1", record.farmId());
        assertNull(record.assignmentId());
        assertEquals(PaymentScope.FARM, record.scope());
        assertEquals("owner-1", record.payerUid());
        assertEquals("Alice Owner", record.payerName());
        assertEquals("farmer-1", record.farmerUid());
        assertEquals("Bob Farmer", record.farmerName());
        assertEquals(new BigDecimal("5000.00"), record.amount());
        assertEquals("BDT", record.currency());
        assertEquals(PaymentStatus.RECORDED, record.status());
        assertEquals(1, record.version());
        assertNull(record.reversedAt());
    }

    @Test
    void ownerCanRecordAssignmentLevelPayment() {
        RecordPaymentRequest request = new RecordPaymentRequest(
                "asgn-1",
                "farmer-1",
                new BigDecimal("2500.50"),
                "BDT",
                Instant.now(),
                "Field weeding labor",
                null
        );

        PaymentRecord record = paymentService.recordPayment("farm-1", request, "owner-1");

        assertEquals(PaymentScope.ASSIGNMENT, record.scope());
        assertEquals("asgn-1", record.assignmentId());
        assertEquals("farmer-1", record.farmerUid());
        assertEquals(PaymentStatus.RECORDED, record.status());
    }

    @Test
    void nonOwnerCannotRecordPayment() {
        RecordPaymentRequest request = new RecordPaymentRequest(
                null,
                "farmer-1",
                new BigDecimal("1000.00"),
                "BDT",
                Instant.now(),
                "Unauthorized payment",
                null
        );

        assertThrows(UnauthorizedResourceAccessException.class,
                () -> paymentService.recordPayment("farm-1", request, "farmer-1"));
    }

    @Test
    void nonBDTCurrencyIsRejected() {
        RecordPaymentRequest request = new RecordPaymentRequest(
                null,
                "farmer-1",
                new BigDecimal("1000.00"),
                "USD",
                Instant.now(),
                "Foreign currency not allowed",
                null
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> paymentService.recordPayment("farm-1", request, "owner-1"));
        assertTrue(ex.getMessage().contains("BDT"));
    }

    @Test
    void nonPositiveAmountIsRejected() {
        RecordPaymentRequest zero = new RecordPaymentRequest(
                null, "farmer-1", BigDecimal.ZERO, "BDT", Instant.now(), "Zero", null);
        assertThrows(IllegalArgumentException.class, () -> paymentService.recordPayment("farm-1", zero, "owner-1"));

        RecordPaymentRequest neg = new RecordPaymentRequest(
                null, "farmer-1", new BigDecimal("-50"), "BDT", Instant.now(), "Negative", null);
        assertThrows(IllegalArgumentException.class, () -> paymentService.recordPayment("farm-1", neg, "owner-1"));
    }

    @Test
    void assignmentFarmerMismatchIsRejected() {
        RecordPaymentRequest request = new RecordPaymentRequest(
                "asgn-1",
                "stranger-1", // Not the farmer on asgn-1
                new BigDecimal("1000.00"),
                "BDT",
                Instant.now(),
                "Mismatch",
                null
        );

        assertThrows(InvalidStateTransitionException.class,
                () -> paymentService.recordPayment("farm-1", request, "owner-1"));
    }

    @Test
    void inactiveFarmDeniesPaymentRecording() {
        farm.setStatus(FarmStatus.ARCHIVED);
        RecordPaymentRequest request = new RecordPaymentRequest(
                null, "farmer-1", new BigDecimal("1000.00"), "BDT", Instant.now(), "Archived", null);

        assertThrows(InvalidStateTransitionException.class,
                () -> paymentService.recordPayment("farm-1", request, "owner-1"));
    }

    @Test
    void ownerCanReversePaymentWithAuditTrail() {
        Instant created = Instant.now().minusSeconds(3600);
        PaymentRecord existing = new PaymentRecord(
                "pay-123", "farm-1", "asgn-1", PaymentScope.ASSIGNMENT,
                "owner-1", "Alice Owner", "farmer-1", "Bob Farmer",
                new BigDecimal("1500.00"), "BDT", created, "Weekly labor", null,
                PaymentStatus.RECORDED, created, "owner-1", null, null, null, 1
        );
        when(paymentRepository.findById("pay-123")).thenReturn(Optional.of(existing));

        ReversePaymentRequest revReq = new ReversePaymentRequest("Duplicate entry mistakenly submitted");
        PaymentRecord reversed = paymentService.reversePayment("pay-123", revReq, "owner-1");

        assertEquals(PaymentStatus.REVERSED, reversed.status());
        assertNotNull(reversed.reversedAt());
        assertEquals("owner-1", reversed.reversedBy());
        assertEquals("Duplicate entry mistakenly submitted", reversed.reversalReason());
        assertEquals(2, reversed.version());
        assertEquals(new BigDecimal("1500.00"), reversed.amount());
    }

    @Test
    void cannotReverseAlreadyReversedPayment() {
        Instant created = Instant.now().minusSeconds(7200);
        Instant reversedAt = Instant.now().minusSeconds(3600);
        PaymentRecord alreadyReversed = new PaymentRecord(
                "pay-123", "farm-1", null, PaymentScope.FARM,
                "owner-1", "Alice Owner", "farmer-1", "Bob Farmer",
                new BigDecimal("1500.00"), "BDT", created, "Labor", null,
                PaymentStatus.REVERSED, created, "owner-1", reversedAt, "owner-1", "First reversal", 2
        );
        when(paymentRepository.findById("pay-123")).thenReturn(Optional.of(alreadyReversed));

        ReversePaymentRequest revReq = new ReversePaymentRequest("Second attempt");
        assertThrows(InvalidStateTransitionException.class,
                () -> paymentService.reversePayment("pay-123", revReq, "owner-1"));
    }

    @Test
    void onlyOwnerAndRecipientFarmerCanReadPayment() {
        PaymentRecord payment = new PaymentRecord(
                "pay-123", "farm-1", null, PaymentScope.FARM,
                "owner-1", "Alice Owner", "farmer-1", "Bob Farmer",
                new BigDecimal("1500.00"), "BDT", Instant.now(), "Labor", null,
                PaymentStatus.RECORDED, Instant.now(), "owner-1", null, null, null, 1
        );
        when(paymentRepository.findById("pay-123")).thenReturn(Optional.of(payment));

        assertNotNull(paymentService.getPayment("pay-123", "owner-1"));
        assertNotNull(paymentService.getPayment("pay-123", "farmer-1"));
        assertThrows(UnauthorizedResourceAccessException.class,
                () -> paymentService.getPayment("pay-123", "stranger-1"));
    }
}
