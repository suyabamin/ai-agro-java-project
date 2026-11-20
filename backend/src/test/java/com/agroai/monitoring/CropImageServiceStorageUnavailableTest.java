package com.agroai.monitoring;

import com.agroai.exception.MonitoringServiceUnavailableException;
import com.agroai.repository.FieldMonitoringRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CropImageServiceStorageUnavailableTest {

    @Test
    void uploadFailsExplicitlyWhenNoStorageProviderIsConfigured() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<ImageStorage> storageProvider = mock(ObjectProvider.class);
        when(storageProvider.getIfAvailable()).thenReturn(null);

        CropImageService service = new CropImageService(repository, authorization, storageProvider);

        MonitoringServiceUnavailableException error = assertThrows(
                MonitoringServiceUnavailableException.class,
                () -> service.upload("farm-test", "field-test", "user-test", null, "CROP"));

        assertEquals("Image storage provider is not configured; select an approved provider before uploads", error.getMessage());
    }
}
