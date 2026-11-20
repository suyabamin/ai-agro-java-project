package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.monitoring.MonitoringActivity;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class FieldMonitoringRepositoryTest {
    private final FirestoreFieldMonitoringRepository repository = new FirestoreFieldMonitoringRepository(new FirebaseConfig());

    @Test
    void storesFieldScopedRecordsAndActivityWithNewestFirstStableCursorPages() {
        repository.createWithActivity("soil_telemetry", "reading-a", reading(100L), event("event-a", 100L));
        repository.createWithActivity("soil_telemetry", "reading-b", reading(200L), event("event-b", 200L));
        repository.createWithActivity("soil_telemetry", "other-field", Map.of("farmId", "farm-a", "fieldId", "field-b", "createdAtEpochMs", 300L), event("event-c", "field-b", 300L));

        CursorPage<Map<String, Object>> first = repository.page("soil_telemetry", "farm-a", "field-a", null, 1, Map.of(), null, null);
        assertEquals("reading-b", first.items().getFirst().get("id"));
        assertTrue(first.hasNext());
        CursorPage<Map<String, Object>> second = repository.page("soil_telemetry", "farm-a", "field-a", first.nextCursor(), 1, Map.of(), null, null);
        assertEquals("reading-a", second.items().getFirst().get("id"));
        assertFalse(second.hasNext());
        assertEquals("event-b", repository.page("field_activity", "farm-a", "field-a", null, 1, Map.of(), null, null).items().getFirst().get("id"));
    }

    @Test
    void rejectsUnknownCollectionAndOutOfRangePageSizes() {
        assertThrows(IllegalArgumentException.class, () -> repository.find("arbitrary_collection", "id"));
        assertThrows(IllegalArgumentException.class, () -> repository.page("soil_telemetry", "farm", "field", null, 101, Map.of(), null, null));
    }

    @Test
    void cursorOrderingIsDeterministicForEqualTimesAndExcludesInsertionsBeforeTheCursor() {
        repository.createWithActivity("field_images", "image-a", reading(100L), event("event-a", 100L));
        repository.createWithActivity("field_images", "image-b", reading(100L), event("event-b", 100L));
        repository.createWithActivity("field_images", "image-c", reading(90L), event("event-c", 90L));

        CursorPage<Map<String, Object>> first = repository.page("field_images", "farm-a", "field-a", null, 1, Map.of(), null, null);
        assertEquals("image-b", first.items().getFirst().get("id"), "document ID breaks equal-time ties descending");

        repository.createWithActivity("field_images", "image-z-new", reading(200L), event("event-z", 200L));
        CursorPage<Map<String, Object>> second = repository.page("field_images", "farm-a", "field-a", first.nextCursor(), 1, Map.of(), null, null);
        assertEquals("image-a", second.items().getFirst().get("id"));
        CursorPage<Map<String, Object>> finalPage = repository.page("field_images", "farm-a", "field-a", second.nextCursor(), 1, Map.of(), null, null);
        assertEquals("image-c", finalPage.items().getFirst().get("id"));
        assertFalse(finalPage.hasNext());
    }

    @Test
    void returnsEmptyPageAfterEndAndRejectsUnknownCursor() {
        repository.createWithActivity("irrigation_plans", "plan-a", reading(100L), event("event-a", 100L));
        CursorPage<Map<String, Object>> only = repository.page("irrigation_plans", "farm-a", "field-a", null, 1, Map.of(), null, null);
        assertFalse(only.hasNext());
        assertTrue(repository.page("field_images", "farm-a", "field-a", null, 1, Map.of(), null, null).items().isEmpty());
        assertThrows(IllegalArgumentException.class, () -> repository.page("irrigation_plans", "farm-a", "field-a", "missing", 1, Map.of(), null, null));
    }

    private static Map<String, Object> reading(long time) {
        return Map.of("farmId", "farm-a", "fieldId", "field-a", "createdAtEpochMs", time);
    }

    private static Map<String, Object> event(String id, long time) {
        return event(id, "field-a", time);
    }

    private static Map<String, Object> event(String id, String fieldId, long time) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", id); event.put("farmId", "farm-a"); event.put("fieldId", fieldId); event.put("createdAtEpochMs", time);
        return event;
    }
}
