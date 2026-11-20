package com.agroai.monitoring;

import java.io.IOException;
import java.util.Optional;

/** Provider-neutral private object storage. Implementations must never expose public object URLs. */
public interface ImageStorage {
    void put(String storageKey, byte[] content) throws IOException;
    Optional<StoredImage> get(String storageKey) throws IOException;
    void delete(String storageKey) throws IOException;

    record StoredImage(byte[] content, String contentType) { }
}
