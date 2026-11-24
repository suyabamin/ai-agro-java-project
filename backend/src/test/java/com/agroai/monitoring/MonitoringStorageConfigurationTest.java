package com.agroai.monitoring;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class MonitoringStorageConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(MonitoringStorageConfiguration.class);

    @Test
    void localProviderIsAvailableOnlyWhenExplicitlySelectedInDevelopment() {
        runner.withPropertyValues("spring.profiles.active=dev", "agroai.storage.provider=local")
                .run(context -> assertThat(context).hasSingleBean(ImageStorage.class));
    }

    @Test
    void productionProfileDoesNotCreateLocalStorageWhenProviderIsMissing() {
        runner.withPropertyValues("spring.profiles.active=prod")
                .run(context -> assertThat(context).doesNotHaveBean(ImageStorage.class));
    }

    @Test
    void developmentProfileDoesNotSilentlySelectLocalStorageWhenProviderIsMissing() {
        runner.withPropertyValues("spring.profiles.active=dev")
                .run(context -> assertThat(context).doesNotHaveBean(ImageStorage.class));
    }

    @Test
    void localProviderIsAvailableInDefaultNonProdProfileWhenSelected() {
        runner.withPropertyValues("agroai.storage.provider=local")
                .run(context -> assertThat(context).hasSingleBean(ImageStorage.class));
    }

    @Test
    void productionProfileRejectsLocalStorageEvenIfRequested() {
        runner.withPropertyValues("spring.profiles.active=prod", "agroai.storage.provider=local")
                .run(context -> assertThat(context).doesNotHaveBean(ImageStorage.class));
    }

    @Test
    void gcsProviderFailsClosedWhenBucketNameIsMissing() {
        runner.withPropertyValues("spring.profiles.active=prod", "agroai.storage.provider=gcs")
                .run(context -> assertThat(context).hasFailed());
    }
}
