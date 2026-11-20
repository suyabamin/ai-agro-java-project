package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class FirebaseHealthService {

    private final FirebaseConfig firebaseConfig;

    public FirebaseHealthService(FirebaseConfig firebaseConfig) {
        this.firebaseConfig = firebaseConfig;
    }

    public Map<String, Object> getFirebaseDiagnostics() {
        Map<String, Object> diagnostics = new LinkedHashMap<>();
        boolean isInitialized = firebaseConfig.isInitialized();
        boolean isConfigured = firebaseConfig.isConfigured();

        diagnostics.put("status", isInitialized ? "UP" : "DEGRADED");
        diagnostics.put("configured", isConfigured);
        diagnostics.put("sdkInitialized", isInitialized);
        diagnostics.put("projectId", maskProjectId(firebaseConfig.getProjectId()));
        diagnostics.put("message", firebaseConfig.getInitializationMessage());
        diagnostics.put("firestoreStatus", isInitialized ? "INITIALIZED" : "NOT_INITIALIZED");

        return diagnostics;
    }

    private String maskProjectId(String projectId) {
        if (projectId == null || projectId.trim().isEmpty()) {
            return "NOT_SET";
        }
        String trimmed = projectId.trim();
        if (trimmed.length() <= 4) {
            return "***";
        }
        return trimmed.substring(0, 3) + "***" + trimmed.substring(trimmed.length() - 2);
    }
}
