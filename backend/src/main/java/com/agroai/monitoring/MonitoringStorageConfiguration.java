package com.agroai.monitoring;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;

@Configuration
public class MonitoringStorageConfiguration {
    @Bean
    @Profile({"dev", "test"})
    @ConditionalOnProperty(name = "agroai.storage.provider", havingValue = "local")
    public ImageStorage localDevelopmentImageStorage(@Value("${agroai.storage.local-dir:${java.io.tmpdir}/agroai-images}") String root) throws IOException {
        return new LocalDevelopmentImageStorage(root);
    }
}
