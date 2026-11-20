package com.agroai.monitoring;

import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

/** Private filesystem adapter for development/test only; production has no implicit local fallback. */
public class LocalDevelopmentImageStorage implements ImageStorage {
    private final Path root;

    public LocalDevelopmentImageStorage(@Value("${agroai.storage.local-dir:${java.io.tmpdir}/agroai-images}") String root) throws IOException {
        this.root = Path.of(root).toAbsolutePath().normalize();
        Files.createDirectories(this.root);
    }

    @Override
    public void put(String storageKey, byte[] content) throws IOException {
        Path target = resolve(storageKey);
        Files.createDirectories(target.getParent());
        Path temporary = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
        try {
            Files.write(temporary, content);
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    @Override
    public Optional<StoredImage> get(String storageKey) throws IOException {
        Path path = resolve(storageKey);
        if (!Files.isRegularFile(path)) return Optional.empty();
        String contentType = path.getFileName().toString().toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        return Optional.of(new StoredImage(Files.readAllBytes(path), contentType));
    }

    @Override
    public void delete(String storageKey) throws IOException {
        Files.deleteIfExists(resolve(storageKey));
    }

    private Path resolve(String storageKey) {
        if (storageKey == null || !storageKey.matches("[0-9a-fA-F-]{36}\\.(png|jpg)")) {
            throw new IllegalArgumentException("Invalid opaque storage key");
        }
        Path result = root.resolve(storageKey).normalize();
        if (!result.startsWith(root)) throw new IllegalArgumentException("Storage key escapes the private root");
        return result;
    }
}
