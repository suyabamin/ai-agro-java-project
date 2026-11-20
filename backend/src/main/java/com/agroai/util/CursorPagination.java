package com.agroai.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/** Input validation and stable URL-safe encoding for document-ID pagination cursors. */
public final class CursorPagination {
    public static final int DEFAULT_PAGE_SIZE = 25;
    public static final int MAX_PAGE_SIZE = 100;

    private CursorPagination() {}

    public static int validatePageSize(Integer size) {
        int resolved = size == null ? DEFAULT_PAGE_SIZE : size;
        if (resolved < 1 || resolved > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return resolved;
    }

    public static String decode(String cursor) {
        if (cursor == null || cursor.isBlank()) return null;
        try {
            String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            if (decoded.isBlank() || decoded.length() > 256 || !decoded.matches("[A-Za-z0-9:_-]+")) {
                throw new IllegalArgumentException("Invalid pagination cursor");
            }
            if (!encode(decoded).equals(cursor)) throw new IllegalArgumentException("Invalid pagination cursor");
            return decoded;
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid pagination cursor", ex);
        }
    }

    public static String encode(String documentId) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(documentId.getBytes(StandardCharsets.UTF_8));
    }
}
