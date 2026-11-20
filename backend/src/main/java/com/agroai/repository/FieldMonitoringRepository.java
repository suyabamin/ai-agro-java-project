package com.agroai.repository;

import java.util.Map;
import java.util.Optional;

public interface FieldMonitoringRepository {
    void createWithActivity(String collection, String id, Map<String, Object> document, Map<String, Object> activity);
    void updateWithActivity(String collection, String id, Map<String, Object> document, Map<String, Object> activity);
    Optional<Map<String, Object>> find(String collection, String id);
    CursorPage<Map<String, Object>> page(String collection, String farmId, String fieldId, String afterId,
                                         int size, Map<String, Object> equalityFilters, Long fromEpochMs, Long toEpochMs);
    void deleteWithActivity(String collection, String id, Map<String, Object> activity);
}
