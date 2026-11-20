package com.agroai.security;

import com.agroai.model.AssignmentStatus;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FieldAssignment;
import com.agroai.model.Farm;
import com.agroai.model.FarmVisibility;
import com.agroai.model.FarmStatus;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.model.AccountStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@DisplayName("Contextual Role & Authorization Evaluator Tests")
class ContextualSecurityTest {

    @Autowired
    private FarmSecurityEvaluator farmSecurity;

    @Autowired
    private FieldSecurityEvaluator fieldSecurity;

    @Autowired
    private FarmMembershipRepository membershipRepository;

    @Autowired
    private FieldAssignmentRepository assignmentRepository;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private FieldRepository fieldRepository;

    @Autowired
    private UserRepository userRepository;

    private static final String OWNER_UID = "user-owner-001";
    private static final String MANAGER_UID = "user-manager-002";
    private static final String OBSERVER_UID = "user-observer-003";
    private static final String FARMER_UID = "user-farmer-004";
    private static final String STRANGER_UID = "user-stranger-999";

    private static final String FARM_ID = "farm-alpha-101";
    private static final String FIELD_ID_1 = "fld-north-paddy-01";
    private static final String FIELD_ID_2 = "fld-south-wheat-02";

    @BeforeEach
    void setUp() {
        membershipRepository.clearAllForTesting();
        assignmentRepository.clearAllForTesting();
        farmRepository.save(new Farm(FARM_ID, "Farm", OWNER_UID, "safe-owner", "district", "division", 1.0, FarmVisibility.PRIVATE));
        fieldRepository.save(new Field(FIELD_ID_1, "north", FARM_ID, "North", 1.0));
        fieldRepository.save(new Field(FIELD_ID_2, "south", FARM_ID, "South", 1.0));
        userRepository.clearAllForTesting();
        userRepository.initializeProfile(FARMER_UID, "farmer@example.test",
                new InitializeProfileRequest("Farmer", null, null, "en"));

        // Farm Memberships
        membershipRepository.saveMembership(new FarmMembership("mbr_owner", FARM_ID, OWNER_UID, FarmRole.OWNER, MembershipStatus.ACTIVE));
        membershipRepository.saveMembership(new FarmMembership("mbr_manager", FARM_ID, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE));
        membershipRepository.saveMembership(new FarmMembership("mbr_observer", FARM_ID, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE));

        // Active field assignment for FARMER on FIELD_ID_1
        FieldAssignment activeAssignment = new FieldAssignment("asgn_01", FARM_ID, FIELD_ID_1, FARMER_UID, AssignmentStatus.ACTIVE);
        activeAssignment.setPermissions(List.of("SUBMIT_TELEMETRY", "SUBMIT_IMAGE"));
        assignmentRepository.saveAssignment(activeAssignment);
    }

    private Authentication createMockAuth(String uid) {
        FirebaseUserDetails userDetails = new FirebaseUserDetails(uid, uid + "@agroai.org", "Test User", true, Map.of());
        return new FirebaseAuthenticationToken(userDetails, "mock.token." + uid);
    }

    @Test
    @DisplayName("[M2-AUT-01] FarmSecurityEvaluator distinguishes OWNER, MANAGER, and OBSERVER correctly")
    void testFarmSecurityRoles() {
        Authentication ownerAuth = createMockAuth(OWNER_UID);
        Authentication managerAuth = createMockAuth(MANAGER_UID);
        Authentication observerAuth = createMockAuth(OBSERVER_UID);
        Authentication strangerAuth = createMockAuth(STRANGER_UID);

        // Owner checks
        assertTrue(farmSecurity.isFarmOwner(ownerAuth, FARM_ID));
        assertFalse(farmSecurity.isFarmOwner(managerAuth, FARM_ID));
        assertFalse(farmSecurity.isFarmOwner(observerAuth, FARM_ID));
        assertFalse(farmSecurity.isFarmOwner(strangerAuth, FARM_ID));

        // Manager checks (Owner also has manager privileges)
        assertTrue(farmSecurity.isFarmManager(ownerAuth, FARM_ID));
        assertTrue(farmSecurity.isFarmManager(managerAuth, FARM_ID));
        assertFalse(farmSecurity.isFarmManager(observerAuth, FARM_ID));
        assertFalse(farmSecurity.isFarmManager(strangerAuth, FARM_ID));

        // Membership checks
        assertTrue(farmSecurity.isFarmMember(ownerAuth, FARM_ID));
        assertTrue(farmSecurity.isFarmMember(managerAuth, FARM_ID));
        assertTrue(farmSecurity.isFarmMember(observerAuth, FARM_ID));
        assertFalse(farmSecurity.isFarmMember(strangerAuth, FARM_ID));
    }

    @Test
    @DisplayName("[M2-AUT-02] Revoking farm membership immediately denies access")
    void testRevokedMembershipDeniesAccess() {
        Authentication managerAuth = createMockAuth(MANAGER_UID);
        assertTrue(farmSecurity.isFarmMember(managerAuth, FARM_ID));

        // Revoke membership
        membershipRepository.revokeMembership(FARM_ID, MANAGER_UID);

        assertFalse(farmSecurity.isFarmMember(managerAuth, FARM_ID), "Revoked member must be denied farm access immediately");
        assertFalse(farmSecurity.isFarmManager(managerAuth, FARM_ID), "Revoked member must not retain manager access");
    }

    @Test
    @DisplayName("[M2-AUT-03] FieldSecurityEvaluator allows access only to assigned fields")
    void testFieldAssignmentAccess() {
        Authentication farmerAuth = createMockAuth(FARMER_UID);

        // Farmer is assigned to FIELD_ID_1
        assertTrue(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));
        assertTrue(fieldSecurity.canSubmitTelemetry(farmerAuth, FIELD_ID_1));

        // Farmer is NOT assigned to FIELD_ID_2
        assertFalse(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_2));
        assertFalse(fieldSecurity.canSubmitTelemetry(farmerAuth, FIELD_ID_2));
    }

    @Test
    @DisplayName("[M2-AUT-04] Releasing a farmer immediately revokes field access and preserves history")
    void testReleaseFarmerRevokesFieldAccess() {
        Authentication farmerAuth = createMockAuth(FARMER_UID);
        assertTrue(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));

        // Release assignment
        assignmentRepository.releaseAssignment(FIELD_ID_1, FARMER_UID, "End of harvest contract");

        assertFalse(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1), "Released assignment must immediately deny field access");
        assertFalse(fieldSecurity.canSubmitTelemetry(farmerAuth, FIELD_ID_1));

        // Check history preservation
        assertEquals(1, assignmentRepository.getHistoricalArchive().size());
        assertEquals("End of harvest contract", assignmentRepository.getHistoricalArchive().get(0).getReleaseReason());
    }

    @Test
    @DisplayName("Suspended farms and inactive fields revoke assignment access without deleting history")
    void testLifecycleStatusRevokesAssignedFieldAccess() {
        Authentication farmerAuth = createMockAuth(FARMER_UID);
        assertTrue(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));

        var farm = farmRepository.findById(FARM_ID).orElseThrow();
        farm.setStatus(FarmStatus.SUSPENDED);
        farmRepository.save(farm);
        assertFalse(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));

        farm.setStatus(FarmStatus.ACTIVE);
        farmRepository.save(farm);
        var field = fieldRepository.findById(FIELD_ID_1).orElseThrow();
        field.setStatus(FieldStatus.FALLOW);
        fieldRepository.save(field);
        assertFalse(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));

        field.setStatus(FieldStatus.ARCHIVED);
        fieldRepository.save(field);
        assertFalse(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));
        assertEquals(AssignmentStatus.ACTIVE,
                assignmentRepository.findAssignment(FIELD_ID_1, FARMER_UID).orElseThrow().getStatus(),
                "Lifecycle lock must preserve the historical assignment record");
    }

    @Test
    @DisplayName("Suspended farmer profile revokes assigned operational field access")
    void testFarmerAccountRevocationDeniesFieldAccess() {
        Authentication farmerAuth = createMockAuth(FARMER_UID);
        assertTrue(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));
        userRepository.updateAccountStatus(FARMER_UID, AccountStatus.SUSPENDED);
        assertFalse(fieldSecurity.hasFieldAccess(farmerAuth, FIELD_ID_1));
    }
}
