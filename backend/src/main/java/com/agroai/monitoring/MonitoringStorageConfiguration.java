package com.agroai.monitoring;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Configuration
public class MonitoringStorageConfiguration {
    @Bean
    @Profile({"dev", "test"})
    @ConditionalOnProperty(name = "agroai.storage.provider", havingValue = "local")
    public ImageStorage localDevelopmentImageStorage(
            @Value("${agroai.storage.local-dir:${java.io.tmpdir}/agroai-images}") String root) throws IOException {
        return new LocalDevelopmentImageStorage(root);
    }

    @Bean
    @ConditionalOnProperty(name = "agroai.storage.provider", havingValue = "gcs")
    public ImageStorage gcsImageStorage(
            @Value("${agroai.storage.gcs.bucket-name:}") String bucketName,
            @Value("${agroai.firebase.credentials-path:}") String credentialsPath,
            @Value("${agroai.firebase.project-id:}") String projectId) throws IOException {
        if (bucketName == null || bucketName.isBlank()) {
            throw new IllegalStateException("AGROAI_GCS_BUCKET_NAME (agroai.storage.gcs.bucket-name) must be set when agroai.storage.provider=gcs");
        }
        GoogleCredentials credentials = resolveCredentials(credentialsPath);
        StorageOptions.Builder builder = StorageOptions.newBuilder().setCredentials(credentials);
        if (projectId != null && !projectId.isBlank()) {
            builder.setProjectId(projectId.trim());
        }
        Storage storage = builder.build().getService();
        return new GcsImageStorage(storage, bucketName);
    }

    private static GoogleCredentials resolveCredentials(String credentialsPath) throws IOException {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            Path path = Path.of(credentialsPath.trim());
            if (!Files.isRegularFile(path)) {
                throw new IllegalStateException("Configured GCS credentials file does not exist");
            }
            try (FileInputStream in = new FileInputStream(path.toFile())) {
                return GoogleCredentials.fromStream(in);
            }
        }
        return GoogleCredentials.getApplicationDefault();
    }
}
