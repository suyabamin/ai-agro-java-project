package com.agroai.monitoring;

import com.agroai.exception.FieldNotFoundException;
import com.agroai.exception.MonitoringServiceUnavailableException;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import com.agroai.util.CursorPagination;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class CropImageService {
    public static final int MAX_BYTES = 8 * 1024 * 1024;
    private static final int MIN_SIDE = 64;
    private static final int MAX_SIDE = 10000;
    private static final long MAX_PIXELS = 16_000_000L;
    private final FieldMonitoringRepository repository;
    private final MonitoringAuthorizationService authorization;
    private final ObjectProvider<ImageStorage> storageProvider;

    public CropImageService(FieldMonitoringRepository repository, MonitoringAuthorizationService authorization,
                            ObjectProvider<ImageStorage> storageProvider) {
        this.repository = repository;
        this.authorization = authorization;
        this.storageProvider = storageProvider;
    }

    public Map<String, Object> upload(String farmId, String fieldId, String uid, MultipartFile file, String category) {
        authorization.requireWriteAccess(farmId, fieldId, uid);
        ImageStorage storage = configuredStorage();
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Image file is required");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("Image exceeds the 8 MiB limit");
        if (category == null || !category.matches("CROP|LEAF|FRUIT|STEM|OTHER")) throw new IllegalArgumentException("Unsupported image category");
        try {
            ValidatedImage validated = validateAndSanitize(file);
            String imageId = UUID.randomUUID().toString();
            String extension = validated.contentType.equals("image/png") ? "png" : "jpg";
            String storageKey = imageId + "." + extension;
            byte[] storedBytes = validated.sanitizedBytes;
            storage.put(storageKey, storedBytes);
            Instant now = Instant.now();
            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("imageId", imageId);
            metadata.put("farmId", farmId);
            metadata.put("fieldId", fieldId);
            metadata.put("uploadedByUid", uid);
            metadata.put("storageKey", storageKey);
            metadata.put("originalFilename", safeFilename(file.getOriginalFilename()));
            metadata.put("contentType", validated.contentType);
            metadata.put("fileSizeBytes", storedBytes.length);
            metadata.put("width", validated.width);
            metadata.put("height", validated.height);
            metadata.put("checksumSha256", sha256(storedBytes));
            metadata.put("category", category);
            metadata.put("processingStatus", "PENDING");
            metadata.put("analysisId", null);
            metadata.put("createdAt", now.toString());
            metadata.put("createdAtEpochMs", now.toEpochMilli());
            metadata.put("deleted", false);
            try {
                repository.createWithActivity("field_images", imageId, metadata,
                        MonitoringActivity.create(farmId, fieldId, uid, "CROP_IMAGE_UPLOADED", "IMAGE", imageId, "Crop image uploaded"));
            } catch (RuntimeException e) {
                try { storage.delete(storageKey); } catch (IOException cleanupFailure) { e.addSuppressed(cleanupFailure); }
                throw e;
            }
            metadata.put("id", imageId);
            return metadata;
        } catch (IOException e) {
            throw new IllegalArgumentException("Image could not be safely decoded", e);
        }
    }

    public CursorPage<Map<String, Object>> list(String farmId, String fieldId, String uid, String cursor, Integer size) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        int pageSize = CursorPagination.validatePageSize(size);
        CursorPage<Map<String, Object>> page = repository.page("field_images", farmId, fieldId,
                CursorPagination.decode(cursor), pageSize, Map.of(), null, null);
        return page;
    }

    public Map<String, Object> get(String farmId, String fieldId, String imageId, String uid) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        Map<String, Object> image = repository.find("field_images", imageId).orElseThrow(() -> new FieldNotFoundException(imageId));
        requireImageScope(image, farmId, fieldId);
        if (Boolean.TRUE.equals(image.get("deleted"))) throw new FieldNotFoundException(imageId);
        return image;
    }

    public ImageStorage.StoredImage content(String farmId, String fieldId, String imageId, String uid) {
        Map<String, Object> image = get(farmId, fieldId, imageId, uid);
        ImageStorage storage = configuredStorage();
        try {
            return storage.get(String.valueOf(image.get("storageKey"))).orElseThrow(() -> new FieldNotFoundException(imageId));
        } catch (IOException e) {
            throw new MonitoringServiceUnavailableException("Image storage is temporarily unavailable", e);
        }
    }

    public void delete(String farmId, String fieldId, String imageId, String uid) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        authorization.requireManager(farmId, uid);
        Map<String, Object> image = repository.find("field_images", imageId).orElseThrow(() -> new FieldNotFoundException(imageId));
        requireImageScope(image, farmId, fieldId);
        if (Boolean.TRUE.equals(image.get("deleted"))) return;
        String storageKey = String.valueOf(image.get("storageKey"));
        image.put("deleted", true);
        image.put("deletedAt", Instant.now().toString());
        image.put("storageKey", null);
        repository.updateWithActivity("field_images", imageId, image,
                MonitoringActivity.create(farmId, fieldId, uid, "CROP_IMAGE_DELETED", "IMAGE", imageId, "Crop image deleted"));
        try {
            configuredStorage().delete(storageKey);
        } catch (IOException e) {
            throw new MonitoringServiceUnavailableException("Image metadata was removed but private object cleanup failed", e);
        }
    }

    private ImageStorage configuredStorage() {
        ImageStorage storage = storageProvider.getIfAvailable();
        if (storage == null) throw new MonitoringServiceUnavailableException("Image storage provider is not configured; select an approved provider before uploads");
        return storage;
    }

    private static void requireImageScope(Map<String, Object> image, String farmId, String fieldId) {
        if (!farmId.equals(image.get("farmId")) || !fieldId.equals(image.get("fieldId"))) throw new FieldNotFoundException(String.valueOf(image.get("imageId")));
    }

    private static ValidatedImage validateAndSanitize(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IllegalArgumentException("Image must be between 1 byte and 8 MiB");
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        boolean pngExtension = name.endsWith(".png");
        boolean jpgExtension = name.endsWith(".jpg") || name.endsWith(".jpeg");
        if (!pngExtension && !jpgExtension) throw new IllegalArgumentException("Only PNG and JPEG files are accepted");
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IllegalArgumentException("Image bytes are not a supported PNG or JPEG image");
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase();
                String contentType = format.equals("png") ? "image/png" : (format.equals("jpeg") || format.equals("jpg") ? "image/jpeg" : "");
                if (contentType.isEmpty() || (pngExtension != contentType.equals("image/png")) ||
                        (file.getContentType() != null && !file.getContentType().isBlank() && !file.getContentType().equalsIgnoreCase(contentType))) {
                    throw new IllegalArgumentException("File extension or declared MIME type does not match image content");
                }
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (Math.min(width, height) < MIN_SIDE || Math.max(width, height) > MAX_SIDE || (long) width * height > MAX_PIXELS) {
                    throw new IllegalArgumentException("Image dimensions are outside allowed limits");
                }
                BufferedImage decoded = reader.read(0);
                if (decoded == null) throw new IllegalArgumentException("Image is empty or corrupt");
                ByteArrayOutputStream sanitized = new ByteArrayOutputStream();
                if (!ImageIO.write(decoded, contentType.equals("image/png") ? "png" : "jpeg", sanitized)) {
                    throw new IllegalArgumentException("Image format could not be safely re-encoded");
                }
                return new ValidatedImage(sanitized.toByteArray(), contentType, width, height);
            } finally {
                reader.dispose();
            }
        }
    }

    private static String safeFilename(String filename) {
        if (filename == null || filename.isBlank()) return "upload";
        String leaf = filename.replace('\\', '/');
        leaf = leaf.substring(leaf.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._-]", "_");
        return leaf.length() > 120 ? leaf.substring(0, 120) : leaf;
    }

    private static String sha256(byte[] value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) { throw new IllegalStateException("SHA-256 is unavailable", e); }
    }

    private record ValidatedImage(byte[] sanitizedBytes, String contentType, int width, int height) { }
}
