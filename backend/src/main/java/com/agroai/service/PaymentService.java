package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.RecordPaymentRequest;
import com.agroai.dto.ReversePaymentRequest;
import com.agroai.exception.AssignmentNotFoundException;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.PaymentNotFoundException;
import com.agroai.exception.UnauthorizedResourceAccessException;
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
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {
    private static final String CURRENCY_BDT = "BDT";

    private final PaymentRepository paymentRepository;
    private final FarmRepository farmRepository;
    private final FarmMembershipRepository membershipRepository;
    private final FieldAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final FirebaseConfig firebaseConfig;

    public PaymentService(PaymentRepository paymentRepository,
                          FarmRepository farmRepository,
                          FarmMembershipRepository membershipRepository,
                          FieldAssignmentRepository assignmentRepository,
                          UserRepository userRepository,
                          FirebaseConfig firebaseConfig) {
        this.paymentRepository = paymentRepository;
        this.farmRepository = farmRepository;
        this.membershipRepository = membershipRepository;
        this.assignmentRepository = assignmentRepository;
        this.userRepository = userRepository;
        this.firebaseConfig = firebaseConfig;
    }

    public PaymentRecord recordPayment(String farmId, RecordPaymentRequest request, String actorUid) {
        validateRecordRequest(request);
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but unavailable; payment creation fails closed.");
        }
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(tx -> recordPaymentInTransaction(tx, farmId, request, actorUid)).get();
            } catch (Exception e) {
                handleTransactionException(e, "Payment creation");
            }
        }
        synchronized (this) {
            UserProfile actorProfile = requireActiveProfile(actorUid, null);
            requireFarmOwner(farmId, actorUid, null);
            Farm farm = farmRepository.findById(farmId).orElseThrow(() -> new FarmNotFoundException(farmId));
            if (farm.getStatus() != FarmStatus.ACTIVE) {
                throw new InvalidStateTransitionException("Cannot record payment for an inactive or archived farm");
            }
            UserProfile farmerProfile = requireActiveProfile(request.farmerUid(), null);

            PaymentScope scope = PaymentScope.FARM;
            String assignmentId = null;
            if (request.assignmentId() != null && !request.assignmentId().isBlank()) {
                FieldAssignment assignment = assignmentRepository.findById(request.assignmentId())
                        .orElseThrow(() -> AssignmentNotFoundException.forId(request.assignmentId()));
                if (!farmId.equals(assignment.getFarmId())) {
                    throw new InvalidStateTransitionException("Assignment does not belong to the specified farm");
                }
                if (!assignment.getFarmerUid().equals(request.farmerUid())) {
                    throw new InvalidStateTransitionException("Recipient farmer does not match assignment farmer");
                }
                scope = PaymentScope.ASSIGNMENT;
                assignmentId = assignment.getAssignmentId();
            }

            String paymentId = "pay_" + UUID.randomUUID().toString();
            Instant now = Instant.now();
            PaymentRecord payment = new PaymentRecord(
                    paymentId,
                    farmId,
                    assignmentId,
                    scope,
                    actorUid,
                    actorProfile.getFullName(),
                    request.farmerUid(),
                    farmerProfile.getFullName(),
                    request.amount(),
                    CURRENCY_BDT,
                    request.paymentDate(),
                    request.purpose().trim(),
                    request.notes() == null ? null : request.notes().trim(),
                    PaymentStatus.RECORDED,
                    now,
                    actorUid,
                    null,
                    null,
                    null,
                    1
            );
            return paymentRepository.save(payment, null);
        }
    }

    public PaymentRecord reversePayment(String paymentId, ReversePaymentRequest request, String actorUid) {
        if (request == null || request.reversalReason() == null || request.reversalReason().isBlank()) {
            throw new IllegalArgumentException("Reversal reason is required");
        }
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but unavailable; payment reversal fails closed.");
        }
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(tx -> reversePaymentInTransaction(tx, paymentId, request, actorUid)).get();
            } catch (Exception e) {
                handleTransactionException(e, "Payment reversal");
            }
        }
        synchronized (this) {
            requireActiveProfile(actorUid, null);
            PaymentRecord payment = paymentRepository.findById(paymentId)
                    .orElseThrow(() -> new PaymentNotFoundException(paymentId));
            requireFarmOwner(payment.farmId(), actorUid, null);
            Farm farm = farmRepository.findById(payment.farmId())
                    .orElseThrow(() -> new FarmNotFoundException(payment.farmId()));
            if (farm.getStatus() != FarmStatus.ACTIVE) {
                throw new InvalidStateTransitionException("Cannot reverse payment on an inactive or archived farm");
            }
            if (payment.status() != PaymentStatus.RECORDED) {
                throw new InvalidStateTransitionException("Only RECORDED payments can be reversed; current status: " + payment.status());
            }

            Instant now = Instant.now();
            PaymentRecord reversed = new PaymentRecord(
                    payment.paymentId(),
                    payment.farmId(),
                    payment.assignmentId(),
                    payment.scope(),
                    payment.payerUid(),
                    payment.payerName(),
                    payment.farmerUid(),
                    payment.farmerName(),
                    payment.amount(),
                    payment.currency(),
                    payment.paymentDate(),
                    payment.purpose(),
                    payment.notes(),
                    PaymentStatus.REVERSED,
                    payment.createdAt(),
                    payment.createdBy(),
                    now,
                    actorUid,
                    request.reversalReason().trim(),
                    payment.version() + 1
            );
            return paymentRepository.save(reversed, null);
        }
    }

    public PaymentRecord getPayment(String paymentId, String actorUid) {
        requireActiveProfile(actorUid, null);
        PaymentRecord payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException(paymentId));
        boolean isOwner = isFarmOwner(payment.farmId(), actorUid, null);
        boolean isFarmer = payment.farmerUid().equals(actorUid);
        if (!isOwner && !isFarmer) {
            throw new UnauthorizedResourceAccessException("PAYMENT", paymentId, "Only farm owner or recipient farmer may access this payment record");
        }
        return payment;
    }

    public List<PaymentRecord> listFarmPayments(String farmId, String farmerFilter, String actorUid, int limit) {
        requireActiveProfile(actorUid, null);
        boolean isOwner = isFarmOwner(farmId, actorUid, null);
        if (isOwner) {
            return paymentRepository.findByFarmId(farmId, farmerFilter, limit);
        }
        // If not owner, actor can only see their own payments
        return paymentRepository.findByFarmId(farmId, actorUid, limit);
    }

    public List<PaymentRecord> listAssignmentPayments(String assignmentId, String actorUid, int limit) {
        requireActiveProfile(actorUid, null);
        FieldAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> AssignmentNotFoundException.forId(assignmentId));
        boolean isOwner = isFarmOwner(assignment.getFarmId(), actorUid, null);
        boolean isFarmer = assignment.getFarmerUid().equals(actorUid);
        if (!isOwner && !isFarmer) {
            throw new UnauthorizedResourceAccessException("ASSIGNMENT", assignmentId, "Only assignment owner or assigned farmer may view assignment payments");
        }
        return paymentRepository.findByAssignmentId(assignmentId, limit);
    }

    public List<PaymentRecord> listMyPayments(String actorUid, int limit) {
        requireActiveProfile(actorUid, null);
        return paymentRepository.findByFarmerUid(actorUid, limit);
    }

    private PaymentRecord recordPaymentInTransaction(Transaction tx, String farmId, RecordPaymentRequest request, String actorUid) {
        UserProfile actorProfile = requireActiveProfile(actorUid, tx);
        requireFarmOwner(farmId, actorUid, tx);
        Farm farm = farmRepository.findByIdInTransaction(tx, farmId);
        if (farm == null || farm.getStatus() != FarmStatus.ACTIVE) {
            throw new InvalidStateTransitionException("Cannot record payment for an inactive or archived farm");
        }
        UserProfile farmerProfile = requireActiveProfile(request.farmerUid(), tx);

        PaymentScope scope = PaymentScope.FARM;
        String assignmentId = null;
        if (request.assignmentId() != null && !request.assignmentId().isBlank()) {
            FieldAssignment assignment = assignmentRepository.findByIdInTransaction(tx, request.assignmentId());
            if (assignment == null) {
                throw AssignmentNotFoundException.forId(request.assignmentId());
            }
            if (!farmId.equals(assignment.getFarmId())) {
                throw new InvalidStateTransitionException("Assignment does not belong to the specified farm");
            }
            if (!assignment.getFarmerUid().equals(request.farmerUid())) {
                throw new InvalidStateTransitionException("Recipient farmer does not match assignment farmer");
            }
            scope = PaymentScope.ASSIGNMENT;
            assignmentId = assignment.getAssignmentId();
        }

        String paymentId = "pay_" + UUID.randomUUID().toString();
        Instant now = Instant.now();
        PaymentRecord payment = new PaymentRecord(
                paymentId,
                farmId,
                assignmentId,
                scope,
                actorUid,
                actorProfile.getFullName(),
                request.farmerUid(),
                farmerProfile.getFullName(),
                request.amount(),
                CURRENCY_BDT,
                request.paymentDate(),
                request.purpose().trim(),
                request.notes() == null ? null : request.notes().trim(),
                PaymentStatus.RECORDED,
                now,
                actorUid,
                null,
                null,
                null,
                1
        );
        return paymentRepository.save(payment, tx);
    }

    private PaymentRecord reversePaymentInTransaction(Transaction tx, String paymentId, ReversePaymentRequest request, String actorUid) {
        requireActiveProfile(actorUid, tx);
        PaymentRecord payment = paymentRepository.findByIdInTransaction(tx, paymentId);
        if (payment == null) {
            throw new PaymentNotFoundException(paymentId);
        }
        requireFarmOwner(payment.farmId(), actorUid, tx);
        Farm farm = farmRepository.findByIdInTransaction(tx, payment.farmId());
        if (farm == null || farm.getStatus() != FarmStatus.ACTIVE) {
            throw new InvalidStateTransitionException("Cannot reverse payment on an inactive or archived farm");
        }
        if (payment.status() != PaymentStatus.RECORDED) {
            throw new InvalidStateTransitionException("Only RECORDED payments can be reversed; current status: " + payment.status());
        }

        Instant now = Instant.now();
        PaymentRecord reversed = new PaymentRecord(
                payment.paymentId(),
                payment.farmId(),
                payment.assignmentId(),
                payment.scope(),
                payment.payerUid(),
                payment.payerName(),
                payment.farmerUid(),
                payment.farmerName(),
                payment.amount(),
                payment.currency(),
                payment.paymentDate(),
                payment.purpose(),
                payment.notes(),
                PaymentStatus.REVERSED,
                payment.createdAt(),
                payment.createdBy(),
                now,
                actorUid,
                request.reversalReason().trim(),
                payment.version() + 1
        );
        return paymentRepository.save(reversed, tx);
    }

    private void validateRecordRequest(RecordPaymentRequest request) {
        if (request == null) throw new IllegalArgumentException("Payment request cannot be null");
        if (request.farmerUid() == null || request.farmerUid().isBlank()) throw new IllegalArgumentException("Farmer UID is required");
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
        if (!CURRENCY_BDT.equalsIgnoreCase(request.currency())) {
            throw new IllegalArgumentException("Only BDT currency is permitted for manual payments");
        }
        if (request.paymentDate() == null) throw new IllegalArgumentException("Payment date is required");
        if (request.purpose() == null || request.purpose().isBlank()) throw new IllegalArgumentException("Payment purpose is required");
    }

    private UserProfile requireActiveProfile(String uid, Transaction tx) {
        UserProfile profile = tx != null ? userRepository.findPrivateProfileInTransaction(tx, uid).orElse(null)
                : userRepository.findPrivateProfile(uid).orElse(null);
        if (profile == null || profile.getAccountStatus() != com.agroai.model.AccountStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("USER", uid, "An active user profile is required");
        }
        return profile;
    }

    private void requireFarmOwner(String farmId, String uid, Transaction tx) {
        if (!isFarmOwner(farmId, uid, tx)) {
            throw new UnauthorizedResourceAccessException("FARM", farmId, "Only an active farm OWNER may record or reverse payments");
        }
    }

    private boolean isFarmOwner(String farmId, String uid, Transaction tx) {
        FarmMembership membership = tx != null
                ? membershipRepository.findMembershipInTransaction(tx, farmId, uid).orElse(null)
                : membershipRepository.findMembership(farmId, uid).orElse(null);
        return membership != null && membership.getStatus() == MembershipStatus.ACTIVE && membership.getRole() == FarmRole.OWNER;
    }

    private void handleTransactionException(Exception e, String op) {
        Throwable cause = e.getCause() == null ? e : e.getCause();
        if (cause instanceof PaymentNotFoundException pnf) throw pnf;
        if (cause instanceof AssignmentNotFoundException anf) throw anf;
        if (cause instanceof FarmNotFoundException fnf) throw fnf;
        if (cause instanceof InvalidStateTransitionException ist) throw ist;
        if (cause instanceof UnauthorizedResourceAccessException ura) throw ura;
        if (cause instanceof IllegalArgumentException iae) throw iae;
        throw new DatabaseUnavailableException(op + " transaction failed: " + cause.getMessage(), cause);
    }
}
