package com.agroai.monitoring;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public final class MonitoringActivity {
    private MonitoringActivity() { }

    public static Map<String, Object> create(String farmId, String fieldId, String actorUid,
            String eventType, String recordType, String recordId, String summary) {
        Instant now = Instant.now();
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", "activity_" + UUID.randomUUID());
        event.put("farmId", farmId);
        event.put("fieldId", fieldId);
        event.put("actorUid", actorUid);
        event.put("eventType", eventType);
        event.put("recordType", recordType);
        event.put("recordId", recordId);
        event.put("summary", summary);
        event.put("createdAt", now.toString());
        event.put("createdAtEpochMs", now.toEpochMilli());
        return event;
    }
}
