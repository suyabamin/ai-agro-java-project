package com.agroai.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("KeyEncoder & Deterministic Path Tests")
class KeyEncoderTest {

    @Test
    @DisplayName("[M2-KEY-01] Standard Firebase 28-char base62 UID encodes deterministically")
    void testStandardFirebaseUidEncoding() {
        String uid = "pL8w9YxQZ1234567890abcdefgh";
        String encoded = KeyEncoder.encodeUid(uid);

        assertNotNull(encoded);
        assertTrue(encoded.startsWith("uid_"));
        assertFalse(encoded.contains("/"));
        assertFalse(encoded.contains("+"));
        assertFalse(encoded.contains("="));
        assertEquals(encoded, KeyEncoder.encodeUid(uid), "Repeated encoding must be strictly deterministic");
    }

    @Test
    @DisplayName("[M2-KEY-02] Custom UID with punctuation encodes safely into URL-safe characters")
    void testCustomUidWithPunctuationEncoding() {
        String customUid1 = "auth0|64ab1234567890";
        String customUid2 = "usr:123/sub_dir?foo=bar";
        String customUid3 = "farmer.karim@agroai.org";

        String encoded1 = KeyEncoder.encodeUid(customUid1);
        String encoded2 = KeyEncoder.encodeUid(customUid2);
        String encoded3 = KeyEncoder.encodeUid(customUid3);

        assertFalse(encoded1.contains("/"), "Encoded UID must not contain forward slashes");
        assertFalse(encoded2.contains(":"), "Encoded UID must not contain colons");
        assertFalse(encoded3.contains("@"), "Encoded UID must not contain @ symbols");
    }

    @Test
    @DisplayName("[M2-KEY-03] Injective uniqueness: Distinct UIDs always produce distinct document IDs")
    void testInjectiveUniqueness() {
        Set<String> originalUids = Set.of(
                "user-1",
                "user_1",
                "user:1",
                "user/1",
                "auth0|user1",
                "google-oauth2|123456",
                "firebase-user-abc"
        );

        Set<String> encodedResults = new HashSet<>();
        for (String uid : originalUids) {
            String encoded = KeyEncoder.encodeUid(uid);
            boolean added = encodedResults.add(encoded);
            assertTrue(added, "Duplicate encoded identifier detected for distinct UID: " + uid);
        }
        assertEquals(originalUids.size(), encodedResults.size());
    }

    @Test
    @DisplayName("[M2-KEY-04] Boundary test: Maximum 128-char UID encodes within safe Firestore size limits")
    void testMaxBoundaryUidLength() {
        String maxUid = "a".repeat(128);
        String encoded = KeyEncoder.encodeUid(maxUid);

        assertTrue(encoded.length() <= 175, "Encoded length must be <= 175 chars");
        assertTrue(encoded.length() < 1500, "Must be far below Firestore 1500-byte document ID limit");
    }

    @Test
    @DisplayName("[M2-KEY-05] Deterministic repeated encoding invariance across calls")
    void testDeterministicInvariance() {
        String uid = "test-deterministic-uid-xyz";
        String first = KeyEncoder.encodeUid(uid);
        for (int i = 0; i < 50; i++) {
            assertEquals(first, KeyEncoder.encodeUid(uid));
        }
    }

    @Test
    @DisplayName("[M2-FLD-01] Field ID safety: Rejects path-breaking characters (/, .., ::, spaces)")
    void testFieldIdSafetyRejections() {
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFieldId("field/subfield"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFieldId("field..invalid"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFieldId("field::invalid"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFieldId("field name with spaces"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFieldId(""));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFieldId(null));
    }

    @Test
    @DisplayName("[M2-FLD-02] Boundary test: 64-char field ID composite assignment ID is within 250 bytes")
    void testCompositeAssignmentDocIdSize() {
        String maxFieldId = "fld-" + "x".repeat(60);
        String maxFarmerUid = "u".repeat(128);

        String assignmentDocId = KeyEncoder.assignmentDocId(maxFieldId, maxFarmerUid);
        assertNotNull(assignmentDocId);
        assertTrue(assignmentDocId.startsWith("asgn_fld_"));
        assertTrue(assignmentDocId.contains("::uid_"));
        assertTrue(assignmentDocId.length() <= 250, "Total assignment doc ID must be <= 250 bytes");
    }
}
