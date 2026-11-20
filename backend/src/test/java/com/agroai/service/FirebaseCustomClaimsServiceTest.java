package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("FirebaseCustomClaimsService Tests")
class FirebaseCustomClaimsServiceTest {

    @Test
    @DisplayName("[CLAIMS-01] syncSafeUidClaim generates exact KeyEncoder.encodeUid safeUid")
    void testSyncSafeUidClaim_CalculatesCorrectSafeUid() {
        FirebaseConfig config = mock(FirebaseConfig.class);
        when(config.isInitialized()).thenReturn(false);

        FirebaseCustomClaimsService claimsService = new FirebaseCustomClaimsService(config);

        String rawUid = "farmer_123_abc";
        String expectedSafeUid = KeyEncoder.encodeUid(rawUid);

        String result = claimsService.syncSafeUidClaim(rawUid);
        assertEquals(expectedSafeUid, result);
    }

    @Test
    @DisplayName("[CLAIMS-02] syncSafeUidClaim rejects null or blank UID")
    void testSyncSafeUidClaim_RejectsNullOrBlank() {
        FirebaseConfig config = mock(FirebaseConfig.class);
        FirebaseCustomClaimsService claimsService = new FirebaseCustomClaimsService(config);

        assertThrows(IllegalArgumentException.class, () -> claimsService.syncSafeUidClaim(null));
        assertThrows(IllegalArgumentException.class, () -> claimsService.syncSafeUidClaim("   "));
    }
}
