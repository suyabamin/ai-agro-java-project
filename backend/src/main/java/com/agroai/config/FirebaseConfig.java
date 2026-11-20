package com.agroai.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${agroai.firebase.credentials-path:}")
    private String credentialsPath;

    @Value("${agroai.firebase.project-id:}")
    private String projectId;

    /** Set to false in test profiles to suppress credential discovery and use in-memory mode. */
    @Value("${agroai.firebase.enabled:true}")
    private boolean firebaseEnabled;

    private boolean initialized = false;
    private String initializationMessage = "Not initialized";

    @PostConstruct
    public void initializeFirebase() {
        if (!firebaseEnabled) {
            this.initialized = false;
            this.initializationMessage = "Firebase disabled via agroai.firebase.enabled=false (test/offline mode)";
            log.info("Firebase initialization skipped: agroai.firebase.enabled=false. Operating in in-memory mode.");
            return;
        }

        if (!FirebaseApp.getApps().isEmpty()) {
            this.initialized = true;
            this.initializationMessage = "FirebaseApp already initialized";
            log.info("FirebaseApp is already initialized");
            if (this.projectId == null || this.projectId.trim().isEmpty()) {
                try {
                    this.projectId = FirebaseApp.getInstance().getOptions().getProjectId();
                } catch (Exception ignored) {
                }
            }
            return;
        }

        if (credentialsPath == null || credentialsPath.trim().isEmpty()) {
            String[] candidatePaths = {
                    "secrets/firebase-service-account.json",
                    "../secrets/firebase-service-account.json",
                    "./secrets/firebase-service-account.json"
            };
            for (String candidate : candidatePaths) {
                File candidateFile = new File(candidate);
                if (candidateFile.exists() && candidateFile.isFile()) {
                    this.credentialsPath = candidateFile.getAbsolutePath();
                    log.info("Discovered local Firebase credentials file at: {}", candidate);
                    break;
                }
            }
        }

        if (credentialsPath == null || credentialsPath.trim().isEmpty()) {
            this.initialized = false;
            this.initializationMessage = "Credentials path not configured (set GOOGLE_APPLICATION_CREDENTIALS or agroai.firebase.credentials-path)";
            log.info("Firebase credentials path not provided. Operating in unconfigured mode.");
            return;
        }

        File credentialsFile = new File(credentialsPath.trim());
        if (!credentialsFile.exists() || !credentialsFile.isFile()) {
            this.initialized = false;
            this.initializationMessage = "Specified credentials file not found on filesystem: " + credentialsFile.getAbsolutePath();
            log.error("Firebase credentials file does not exist at specified path. Operating in unconfigured mode.");
            return;
        }

        try (FileInputStream serviceAccount = new FileInputStream(credentialsFile)) {
            GoogleCredentials credentials = GoogleCredentials.fromStream(serviceAccount);
            String credProjectId = null;
            if (credentials instanceof ServiceAccountCredentials sac) {
                credProjectId = sac.getProjectId();
            }

            String targetProjectId = (this.projectId != null && !this.projectId.trim().isEmpty())
                    ? this.projectId.trim()
                    : (credProjectId != null ? credProjectId.trim() : "");

            if (credProjectId != null && !credProjectId.isEmpty() && targetProjectId != null && !targetProjectId.isEmpty()) {
                if (!credProjectId.equalsIgnoreCase(targetProjectId)) {
                    this.initialized = false;
                    this.initializationMessage = "Project ID mismatch: credential has '" + credProjectId + "' but configured was '" + targetProjectId + "'";
                    log.error("Firebase credential project ID '{}' does not match configured project ID '{}'", credProjectId, targetProjectId);
                    return;
                }
            }

            if (this.projectId == null || this.projectId.trim().isEmpty()) {
                this.projectId = targetProjectId;
            }

            FirebaseOptions.Builder builder = FirebaseOptions.builder()
                    .setCredentials(credentials);

            if (this.projectId != null && !this.projectId.trim().isEmpty()) {
                builder.setProjectId(this.projectId.trim());
            }

            FirebaseApp.initializeApp(builder.build());
            this.initialized = true;
            this.initializationMessage = "FirebaseApp initialized successfully for project: " + this.projectId;
            log.info("FirebaseApp initialized successfully with external credentials for project: {}", this.projectId);
        } catch (IOException e) {
            this.initialized = false;
            this.initializationMessage = "Failed to load credentials file: " + e.getMessage();
            log.error("Failed to read Firebase credentials file: {}", e.getMessage());
        } catch (Exception e) {
            this.initialized = false;
            this.initializationMessage = "Unexpected error initializing Firebase: " + e.getMessage();
            log.error("Unexpected error initializing Firebase: {}", e.getMessage());
        }
    }

    public boolean isInitialized() {
        return initialized && !FirebaseApp.getApps().isEmpty();
    }

    public boolean isConfigured() {
        return firebaseEnabled && credentialsPath != null && !credentialsPath.trim().isEmpty();
    }

    public String getProjectId() {
        return projectId != null ? projectId.trim() : "";
    }

    public String getInitializationMessage() {
        return initializationMessage;
    }
}
