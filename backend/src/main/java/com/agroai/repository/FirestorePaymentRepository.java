package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.PaymentRecord;
import com.agroai.model.PaymentScope;
import com.agroai.model.PaymentStatus;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class FirestorePaymentRepository implements PaymentRepository {
    private static final String COLLECTION = "payment_records";
    private final FirebaseConfig firebaseConfig;
    private final Map<String, PaymentRecord> memory = new ConcurrentHashMap<>();

    public FirestorePaymentRepository(FirebaseConfig firebaseConfig) {
        this.firebaseConfig = firebaseConfig;
    }

    private void checkConfiguration() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but unavailable; payment repository fail-closed.");
        }
    }

    @Override
    public PaymentRecord save(PaymentRecord payment, Transaction transaction) {
        checkConfiguration();
        if (!firebaseConfig.isInitialized()) {
            memory.put(payment.paymentId(), payment);
            return payment;
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection(COLLECTION).document(payment.paymentId());
            if (transaction != null) {
                transaction.set(ref, toMap(payment));
            } else {
                ref.set(toMap(payment)).get();
            }
            return payment;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to save payment record: " + e.getMessage(), e);
        }
    }

    @Override
    public Optional<PaymentRecord> findById(String paymentId) {
        checkConfiguration();
        if (!firebaseConfig.isInitialized()) {
            return Optional.ofNullable(memory.get(paymentId));
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            DocumentSnapshot snapshot = db.collection(COLLECTION).document(paymentId).get().get();
            return snapshot.exists() ? Optional.of(from(snapshot)) : Optional.empty();
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to read payment record: " + e.getMessage(), e);
        }
    }

    @Override
    public PaymentRecord findByIdInTransaction(Transaction transaction, String paymentId) {
        checkConfiguration();
        if (!firebaseConfig.isInitialized()) {
            return memory.get(paymentId);
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            DocumentSnapshot snapshot = transaction.get(db.collection(COLLECTION).document(paymentId)).get();
            return snapshot.exists() ? from(snapshot) : null;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to read payment record in transaction: " + e.getMessage(), e);
        }
    }

    @Override
    public List<PaymentRecord> findByFarmId(String farmId, String farmerFilter, int limit) {
        checkConfiguration();
        int safeLimit = Math.max(1, Math.min(limit, 100));
        if (!firebaseConfig.isInitialized()) {
            return memory.values().stream()
                    .filter(p -> farmId.equals(p.farmId()))
                    .filter(p -> farmerFilter == null || farmerFilter.isBlank() || farmerFilter.equals(p.farmerUid()))
                    .sorted(Comparator.comparing(PaymentRecord::createdAt).reversed())
                    .limit(safeLimit)
                    .toList();
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            Query query = db.collection(COLLECTION).whereEqualTo("farmId", farmId);
            if (farmerFilter != null && !farmerFilter.isBlank()) {
                query = query.whereEqualTo("farmerUid", farmerFilter);
            }
            QuerySnapshot snapshot = query.limit(safeLimit).get().get();
            List<PaymentRecord> list = new ArrayList<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                list.add(from(doc));
            }
            list.sort(Comparator.comparing(PaymentRecord::createdAt).reversed());
            return list;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to list payments for farm: " + e.getMessage(), e);
        }
    }

    @Override
    public List<PaymentRecord> findByAssignmentId(String assignmentId, int limit) {
        checkConfiguration();
        int safeLimit = Math.max(1, Math.min(limit, 100));
        if (!firebaseConfig.isInitialized()) {
            return memory.values().stream()
                    .filter(p -> assignmentId.equals(p.assignmentId()))
                    .sorted(Comparator.comparing(PaymentRecord::createdAt).reversed())
                    .limit(safeLimit)
                    .toList();
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            QuerySnapshot snapshot = db.collection(COLLECTION)
                    .whereEqualTo("assignmentId", assignmentId)
                    .limit(safeLimit)
                    .get().get();
            List<PaymentRecord> list = new ArrayList<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                list.add(from(doc));
            }
            list.sort(Comparator.comparing(PaymentRecord::createdAt).reversed());
            return list;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to list payments for assignment: " + e.getMessage(), e);
        }
    }

    @Override
    public List<PaymentRecord> findByFarmerUid(String farmerUid, int limit) {
        checkConfiguration();
        int safeLimit = Math.max(1, Math.min(limit, 100));
        if (!firebaseConfig.isInitialized()) {
            return memory.values().stream()
                    .filter(p -> farmerUid.equals(p.farmerUid()))
                    .sorted(Comparator.comparing(PaymentRecord::createdAt).reversed())
                    .limit(safeLimit)
                    .toList();
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            QuerySnapshot snapshot = db.collection(COLLECTION)
                    .whereEqualTo("farmerUid", farmerUid)
                    .limit(safeLimit)
                    .get().get();
            List<PaymentRecord> list = new ArrayList<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                list.add(from(doc));
            }
            list.sort(Comparator.comparing(PaymentRecord::createdAt).reversed());
            return list;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to list payments for farmer: " + e.getMessage(), e);
        }
    }

    private Map<String, Object> toMap(PaymentRecord p) {
        Map<String, Object> map = new HashMap<>();
        map.put("paymentId", p.paymentId());
        map.put("farmId", p.farmId());
        map.put("assignmentId", p.assignmentId());
        map.put("scope", p.scope().name());
        map.put("payerUid", p.payerUid());
        map.put("payerName", p.payerName() == null ? "" : p.payerName());
        map.put("farmerUid", p.farmerUid());
        map.put("farmerName", p.farmerName() == null ? "" : p.farmerName());
        map.put("amount", p.amount().toPlainString());
        map.put("currency", p.currency());
        map.put("paymentDate", Timestamp.ofTimeSecondsAndNanos(p.paymentDate().getEpochSecond(), p.paymentDate().getNano()));
        map.put("purpose", p.purpose());
        map.put("notes", p.notes() == null ? "" : p.notes());
        map.put("status", p.status().name());
        map.put("createdAt", Timestamp.ofTimeSecondsAndNanos(p.createdAt().getEpochSecond(), p.createdAt().getNano()));
        map.put("createdBy", p.createdBy());
        if (p.reversedAt() != null) {
            map.put("reversedAt", Timestamp.ofTimeSecondsAndNanos(p.reversedAt().getEpochSecond(), p.reversedAt().getNano()));
            map.put("reversedBy", p.reversedBy());
            map.put("reversalReason", p.reversalReason());
        }
        map.put("version", p.version());
        return map;
    }

    private PaymentRecord from(DocumentSnapshot doc) {
        Timestamp paymentDate = doc.getTimestamp("paymentDate");
        Timestamp created = doc.getTimestamp("createdAt");
        Timestamp reversed = doc.getTimestamp("reversedAt");

        String amountStr = doc.getString("amount");
        BigDecimal amount = amountStr != null ? new BigDecimal(amountStr) : BigDecimal.ZERO;

        Number ver = (Number) doc.get("version");
        int version = ver != null ? ver.intValue() : 1;

        return new PaymentRecord(
                doc.getId(),
                doc.getString("farmId"),
                doc.getString("assignmentId"),
                PaymentScope.valueOf(doc.getString("scope")),
                doc.getString("payerUid"),
                doc.getString("payerName"),
                doc.getString("farmerUid"),
                doc.getString("farmerName"),
                amount,
                doc.getString("currency"),
                paymentDate != null ? paymentDate.toDate().toInstant() : Instant.EPOCH,
                doc.getString("purpose"),
                doc.getString("notes"),
                PaymentStatus.valueOf(doc.getString("status")),
                created != null ? created.toDate().toInstant() : Instant.EPOCH,
                doc.getString("createdBy"),
                reversed != null ? reversed.toDate().toInstant() : null,
                doc.getString("reversedBy"),
                doc.getString("reversalReason"),
                version
        );
    }
}
