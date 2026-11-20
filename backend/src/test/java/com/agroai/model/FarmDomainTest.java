package com.agroai.model;

import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.UpdateFarmRequest;
import com.agroai.dto.UpdateFarmVisibilityRequest;
import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Farm Domain Model & Identifier Arithmetic Tests")
class FarmDomainTest {

    @Test
    @DisplayName("Farm identifier validation matches ^[a-zA-Z0-9-]{1,64}$")
    void testFarmIdValidation() {
        String uuid = UUID.randomUUID().toString().toLowerCase();
        String canonicalFarmId = "farm-" + uuid;
        assertEquals(41, canonicalFarmId.length());

        assertEquals(canonicalFarmId, KeyEncoder.validateFarmId(canonicalFarmId));

        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFarmId(""));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFarmId("invalid_farm_id"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFarmId("farm/123"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFarmId("a".repeat(65)));
    }

    @Test
    @DisplayName("Composite field ID arithmetic: {farmId}--{localFieldId} <= 64 chars")
    void testFieldCompositeIdArithmetic() {
        String farmId = "farm-12345678-1234-1234-1234-123456789abc"; // 41 chars
        String localFieldId = "field-01"; // 8 chars
        String compositeId = farmId + "--" + localFieldId; // 51 chars

        assertEquals(51, compositeId.length());
        assertTrue(compositeId.length() <= 64);
        assertEquals(compositeId, KeyEncoder.validateFieldId(compositeId));

        // Maximum boundary: 41 chars farmId + 2 chars separator + 21 chars localFieldId = 64 chars
        String maxLocalFieldId = "a".repeat(21);
        String maxCompositeId = farmId + "--" + maxLocalFieldId;
        assertEquals(64, maxCompositeId.length());
        assertEquals(maxCompositeId, KeyEncoder.validateFieldId(maxCompositeId));

        // Over 64 chars fails
        String overMaxCompositeId = farmId + "--" + "a".repeat(22);
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateFieldId(overMaxCompositeId));
    }

    @Test
    @DisplayName("Farm entity defaults and state transitions")
    void testFarmEntityDefaults() {
        Farm farm = new Farm(
                "farm-test-1",
                "Green Valley",
                "uid-100",
                "safe-uid-100",
                "Gazipur",
                "Dhaka",
                15.5,
                FarmVisibility.PRIVATE
        );

        assertEquals(FarmStatus.ACTIVE, farm.getStatus());
        assertEquals(1, farm.getVersion());
        assertEquals(0, farm.getActiveFieldCount());
        assertNotNull(farm.getRegisteredAt());
        assertNotNull(farm.getUpdatedAt());
        assertNull(farm.getArchivedAt());

        farm.setVisibility(FarmVisibility.PUBLIC);
        assertEquals(FarmVisibility.PUBLIC, farm.getVisibility());

        farm.setStatus(FarmStatus.ARCHIVED);
        assertEquals(FarmStatus.ARCHIVED, farm.getStatus());
    }

    @Test
    @DisplayName("PublicFarmProjection captures sanitized allowlist fields only")
    void testPublicFarmProjectionSanitization() {
        Farm farm = new Farm(
                "farm-test-public",
                "Dhaka Organic Farm",
                "owner-private-uid",
                "safe-owner-uid",
                "Savar",
                "Dhaka",
                25.0,
                FarmVisibility.PUBLIC
        );
        farm.setDetailedAddress("Secret Plot 42, Private Sector 9");
        farm.setVersion(3);

        PublicFarmProjection projection = PublicFarmProjection.fromPrivate(farm);

        assertEquals("farm-test-public", projection.getFarmId());
        assertEquals("Dhaka Organic Farm", projection.getName());
        assertEquals("Savar", projection.getDistrict());
        assertEquals("Dhaka", projection.getDivision());
        assertEquals(25.0, projection.getTotalAreaHectares());
        assertEquals("ACTIVE", projection.getStatus());
        assertEquals("PUBLIC", projection.getVisibility());
        assertEquals(3, projection.getProjectionVersion());
    }

    @Test
    @DisplayName("FarmMembership entity role and status tracking")
    void testFarmMembershipEntity() {
        FarmMembership membership = new FarmMembership(
                "farm-1_user-1",
                "farm-1",
                "user-1",
                FarmRole.OWNER,
                MembershipStatus.ACTIVE
        );

        assertEquals(FarmRole.OWNER, membership.getRole());
        assertEquals(MembershipStatus.ACTIVE, membership.getStatus());
        assertNotNull(membership.getJoinedAt());

        membership.setRole(FarmRole.MANAGER);
        membership.setStatus(MembershipStatus.REVOKED);
        assertEquals(FarmRole.MANAGER, membership.getRole());
        assertEquals(MembershipStatus.REVOKED, membership.getStatus());
    }
}
