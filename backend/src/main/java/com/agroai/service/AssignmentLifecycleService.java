package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.ReleaseAssignmentRequest;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.FieldAssignment;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldAssignmentRepository;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Bounded, resumable release processing after a farm/field lifecycle status gate is committed. */
@Service
public class AssignmentLifecycleService {
    private static final int BATCH_SIZE = 100;
    private final FieldAssignmentRepository assignments;
    private final FieldAssignmentService assignmentService;
    private final FirebaseConfig firebaseConfig;
    private final Map<String, Operation> memoryOperations = new ConcurrentHashMap<>();

    public AssignmentLifecycleService(FieldAssignmentRepository assignments,
                                      FieldAssignmentService assignmentService,
                                      FirebaseConfig firebaseConfig) {
        this.assignments = assignments;
        this.assignmentService = assignmentService;
        this.firebaseConfig = firebaseConfig;
    }

    public void releaseFarmAssignments(String farmId, String actorUid, String reason) {
        process("farm:" + farmId, "farm", farmId, null, actorUid, reason);
    }

    public void releaseFieldAssignments(String farmId, String fieldId, String actorUid, String reason) {
        process("field:" + fieldId, "field", fieldId, farmId, actorUid, reason);
    }

    public boolean isProcessing(String resourceType, String resourceId) {
        String operationId = resourceType + ":" + resourceId;
        if (firebaseConfig.isInitialized()) {
            try {
                DocumentSnapshot doc = operationRef(operationId).get().get();
                return doc.exists() && "PROCESSING".equals(doc.getString("status"));
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to check assignment lifecycle progress", e);
            }
        }
        Operation op = memoryOperations.get(operationId);
        return op != null && !op.complete;
    }

    public void startNewLifecycleCycle(String resourceType, String resourceId) {
        String operationId = resourceType + ":" + resourceId;
        if (firebaseConfig.isInitialized()) {
            try {
                operationRef(operationId).delete().get();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to reset assignment lifecycle progress", e);
            }
        } else {
            memoryOperations.remove(operationId);
        }
    }

    private void process(String operationId, String resourceType, String resourceId, String farmId,
                         String actorUid, String reason) {
        String cursor = beginOrResume(operationId, resourceType, resourceId, actorUid, reason);
        if (cursor != null && cursor.equals("__COMPLETED__")) return;
        while (true) {
            CursorPage<FieldAssignment> page = resourceType.equals("farm")
                    ? assignments.findAssignmentsByFarmPage(resourceId, cursor, BATCH_SIZE)
                    : assignments.findAssignmentsByFieldPage(resourceId, cursor, BATCH_SIZE);
            for (FieldAssignment candidate : page.items()) {
                if (candidate.getStatus() == AssignmentStatus.ACTIVE &&
                        (farmId == null || farmId.equals(candidate.getFarmId()))) {
                    assignmentService.releaseAssignment(candidate.getFarmId(), candidate.getFieldId(),
                            candidate.getAssignmentId(), new ReleaseAssignmentRequest(reason, candidate.getVersion()), actorUid);
                }
                cursor = candidate.getAssignmentId();
                saveProgress(operationId, resourceType, resourceId, actorUid, reason, cursor, false);
            }
            if (!page.hasNext()) break;
            if (page.items().isEmpty()) throw new IllegalStateException("Lifecycle page claimed a next cursor without records");
        }
        saveProgress(operationId, resourceType, resourceId, actorUid, reason, cursor, true);
    }

    private String beginOrResume(String operationId, String resourceType, String resourceId, String actorUid, String reason) {
        if (firebaseConfig.isInitialized()) {
            try {
                DocumentReference ref = operationRef(operationId);
                DocumentSnapshot current = ref.get().get();
                if (current.exists() && "COMPLETED".equals(current.getString("status"))) return "__COMPLETED__";
                Map<String, Object> state = new LinkedHashMap<>();
                state.put("operationId", operationId);
                state.put("resourceType", resourceType);
                state.put("resourceId", resourceId);
                state.put("actorUid", actorUid);
                state.put("reason", reason);
                state.put("status", "PROCESSING");
                state.put("lastAssignmentId", current.exists() ? current.getString("lastAssignmentId") : null);
                state.put("startedAt", current.exists() ? current.get("startedAt") : Instant.now().toString());
                state.put("updatedAt", Instant.now().toString());
                ref.set(state, com.google.cloud.firestore.SetOptions.merge()).get();
                return current.exists() ? current.getString("lastAssignmentId") : null;
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to start/resume assignment lifecycle operation", e);
            }
        }
        Operation operation = memoryOperations.compute(operationId, (id, old) -> old == null || old.complete
                ? new Operation(resourceType, resourceId, actorUid, reason) : old);
        return operation.complete ? "__COMPLETED__" : operation.cursor;
    }

    private void saveProgress(String operationId, String resourceType, String resourceId, String actorUid,
                              String reason, String cursor, boolean complete) {
        if (firebaseConfig.isInitialized()) {
            try {
                Map<String, Object> state = new LinkedHashMap<>();
                state.put("operationId", operationId);
                state.put("resourceType", resourceType);
                state.put("resourceId", resourceId);
                state.put("actorUid", actorUid);
                state.put("reason", reason);
                state.put("status", complete ? "COMPLETED" : "PROCESSING");
                state.put("lastAssignmentId", cursor);
                state.put("updatedAt", Instant.now().toString());
                operationRef(operationId).set(state, com.google.cloud.firestore.SetOptions.merge()).get();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to persist assignment lifecycle progress", e);
            }
        } else {
            Operation operation = memoryOperations.computeIfAbsent(operationId,
                    id -> new Operation(resourceType, resourceId, actorUid, reason));
            operation.cursor = cursor;
            operation.complete = complete;
        }
    }

    private DocumentReference operationRef(String operationId) {
        Firestore db = FirestoreClient.getFirestore();
        return db.collection("assignment_lifecycle_operations").document(
                operationId.replace(':', '_'));
    }

    private static final class Operation {
        private final String resourceType;
        private final String resourceId;
        private final String actorUid;
        private final String reason;
        private String cursor;
        private boolean complete;

        private Operation(String resourceType, String resourceId, String actorUid, String reason) {
            this.resourceType = resourceType;
            this.resourceId = resourceId;
            this.actorUid = actorUid;
            this.reason = reason;
        }
    }
}
