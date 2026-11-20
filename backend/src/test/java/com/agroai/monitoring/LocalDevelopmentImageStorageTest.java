package com.agroai.monitoring;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class LocalDevelopmentImageStorageTest {
    @TempDir
    Path directory;

    @Test
    void privatelyStoresRetrievesAndDeletesImageBytes() throws Exception {
        LocalDevelopmentImageStorage storage = new LocalDevelopmentImageStorage(directory.toString());
        String key = UUID.randomUUID() + ".png";
        byte[] content = { 1, 2, 3, 4 };

        storage.put(key, content);
        ImageStorage.StoredImage stored = storage.get(key).orElseThrow();
        assertArrayEquals(content, stored.content());
        assertEquals("image/png", stored.contentType());

        storage.delete(key);
        assertTrue(storage.get(key).isEmpty());
    }

    @Test
    void rejectsPathTraversalAndNonOpaqueKeys() throws Exception {
        LocalDevelopmentImageStorage storage = new LocalDevelopmentImageStorage(directory.toString());
        assertThrows(IllegalArgumentException.class, () -> storage.get("../../outside.jpg"));
        assertThrows(IllegalArgumentException.class, () -> storage.put("not-a-uuid.jpg", new byte[] { 1 }));
    }
}
