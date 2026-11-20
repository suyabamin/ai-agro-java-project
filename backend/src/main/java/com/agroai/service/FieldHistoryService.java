package com.agroai.service;

import com.agroai.exception.FieldNotFoundException;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import com.agroai.util.CursorPagination;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class FieldHistoryService {
    private final FieldMonitoringRepository repository;
    private final MonitoringAuthorizationService authorization;

    public FieldHistoryService(FieldMonitoringRepository repository, MonitoringAuthorizationService authorization) {
        this.repository = repository;
        this.authorization = authorization;
    }

    public CursorPage<Map<String, Object>> list(String farmId, String fieldId, String uid, String cursor, Integer size,
            String eventType, Long fromEpochMs, Long toEpochMs) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        if (fromEpochMs != null && toEpochMs != null && fromEpochMs > toEpochMs) throw new IllegalArgumentException("from must be earlier than to");
        Map<String, Object> filters = eventType == null || eventType.isBlank() ? Map.of() : Map.of("eventType", eventType.trim().toUpperCase());
        return repository.page("field_activity", farmId, fieldId, CursorPagination.decode(cursor),
                CursorPagination.validatePageSize(size), filters, fromEpochMs, toEpochMs);
    }

    public Map<String, Object> get(String farmId, String fieldId, String activityId, String uid) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        Map<String, Object> activity = repository.find("field_activity", activityId)
                .orElseThrow(() -> new FieldNotFoundException(activityId));
        if (!farmId.equals(activity.get("farmId")) || !fieldId.equals(activity.get("fieldId"))) {
            throw new FieldNotFoundException(activityId);
        }
        return activity;
    }
}
