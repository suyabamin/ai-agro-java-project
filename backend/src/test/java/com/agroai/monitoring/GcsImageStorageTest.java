package com.agroai.monitoring;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class GcsImageStorageTest {
    @Test
    void rejectsBlankBucketNameFailClosed() {
        Storage mockStorage = mock(Storage.class);
        assertThrows(IllegalStateException.class, () -> new GcsImageStorage(mockStorage, "  "));
        assertThrows(IllegalStateException.class, () -> new GcsImageStorage(mockStorage, null));
    }

    @Test
    void rejectsInvalidOrTraversalStorageKeys() {
        Storage mockStorage = mock(Storage.class);
        GcsImageStorage adapter = new GcsImageStorage(mockStorage, "agroai-private-bucket");
        assertThrows(IllegalArgumentException.class, () -> adapter.put("../etc/passwd", new byte[]{1, 2}));
        assertThrows(IllegalArgumentException.class, () -> adapter.get("not-a-uuid.png"));
        assertThrows(IllegalArgumentException.class, () -> adapter.delete("123.exe"));
    }

    @Test
    void putsAndGetsPrivateObjectWithValidatedContentType() throws IOException {
        Storage mockStorage = mock(Storage.class);
        GcsImageStorage adapter = new GcsImageStorage(mockStorage, "agroai-private-bucket");
        String key = UUID.randomUUID() + ".png";
        byte[] payload = new byte[]{10, 20, 30};

        adapter.put(key, payload);

        ArgumentCaptor<BlobInfo> captor = ArgumentCaptor.forClass(BlobInfo.class);
        verify(mockStorage).create(captor.capture(), eq(payload));
        assertEquals("agroai-private-bucket", captor.getValue().getBucket());
        assertEquals("crop-images/" + key, captor.getValue().getName());
        assertEquals("image/png", captor.getValue().getContentType());

        Blob mockBlob = mock(Blob.class);
        when(mockBlob.exists()).thenReturn(true);
        when(mockBlob.getContent()).thenReturn(payload);
        when(mockBlob.getContentType()).thenReturn("image/png");
        when(mockStorage.get(BlobId.of("agroai-private-bucket", "crop-images/" + key))).thenReturn(mockBlob);

        Optional<ImageStorage.StoredImage> retrieved = adapter.get(key);
        assertTrue(retrieved.isPresent());
        assertArrayEquals(payload, retrieved.get().content());
        assertEquals("image/png", retrieved.get().contentType());

        adapter.delete(key);
        verify(mockStorage).delete(BlobId.of("agroai-private-bucket", "crop-images/" + key));
    }

    @Test
    void wrapsGcsStorageExceptionsAsIOException() {
        Storage mockStorage = mock(Storage.class);
        when(mockStorage.create(any(BlobInfo.class), any(byte[].class))).thenThrow(new StorageException(503, "GCS unavailable"));
        GcsImageStorage adapter = new GcsImageStorage(mockStorage, "agroai-private-bucket");
        String key = UUID.randomUUID() + ".jpg";
        assertThrows(IOException.class, () -> adapter.put(key, new byte[]{1, 2, 3}));
    }
}
