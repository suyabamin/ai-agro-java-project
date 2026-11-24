package com.agroai.monitoring;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageException;

import java.io.IOException;
import java.util.Objects;
import java.util.Optional;

/**
 * Private Google Cloud Storage adapter for production crop leaf images.
 * Objects are never made publicly readable; all access is mediated by backend authorization.
 */
public class GcsImageStorage implements ImageStorage {
    private static final String OBJECT_PREFIX = "crop-images/";

    private final Storage storage;
    private final String bucketName;

    public GcsImageStorage(Storage storage, String bucketName) {
        if (bucketName == null || bucketName.isBlank()) {
            throw new IllegalStateException("agroai.storage.gcs.bucket-name must be configured when agroai.storage.provider=gcs");
        }
        this.storage = Objects.requireNonNull(storage, "GCS Storage client must not be null");
        this.bucketName = bucketName.trim();
    }

    @Override
    public void put(String storageKey, byte[] content) throws IOException {
        if (content == null || content.length == 0) {
            throw new IllegalArgumentException("Image content must not be empty");
        }
        String objectName = resolveObjectName(storageKey);
        String contentType = contentTypeFor(storageKey);
        BlobInfo blobInfo = BlobInfo.newBuilder(BlobId.of(bucketName, objectName))
                .setContentType(contentType)
                .build();
        try {
            storage.create(blobInfo, content);
        } catch (StorageException e) {
            throw new IOException("Failed to store image object in GCS bucket: " + e.getMessage(), e);
        }
    }

    @Override
    public Optional<StoredImage> get(String storageKey) throws IOException {
        String objectName = resolveObjectName(storageKey);
        try {
            Blob blob = storage.get(BlobId.of(bucketName, objectName));
            if (blob == null || !blob.exists()) {
                return Optional.empty();
            }
            byte[] bytes = blob.getContent();
            String contentType = blob.getContentType() != null && !blob.getContentType().isBlank()
                    ? blob.getContentType()
                    : contentTypeFor(storageKey);
            return Optional.of(new StoredImage(bytes, contentType));
        } catch (StorageException e) {
            throw new IOException("Failed to retrieve image object from GCS bucket: " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String storageKey) throws IOException {
        String objectName = resolveObjectName(storageKey);
        try {
            storage.delete(BlobId.of(bucketName, objectName));
        } catch (StorageException e) {
            throw new IOException("Failed to delete image object from GCS bucket: " + e.getMessage(), e);
        }
    }

    static String resolveObjectName(String storageKey) {
        if (storageKey == null || !storageKey.matches("[0-9a-fA-F-]{36}\\.(png|jpg)")) {
            throw new IllegalArgumentException("Invalid opaque storage key");
        }
        return OBJECT_PREFIX + storageKey;
    }

    private static String contentTypeFor(String storageKey) {
        return storageKey.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    }
}
