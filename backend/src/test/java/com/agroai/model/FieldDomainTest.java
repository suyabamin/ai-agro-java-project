package com.agroai.model;

import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Field Domain Model & Identifier Arithmetic Tests")
class FieldDomainTest {

    @Test
    @DisplayName("Local field ID validation: 1-21 chars alphanumeric/hyphen")
    void testLocalFieldIdValidation() {
        assertEquals("plot-01", KeyEncoder.validateLocalFieldId("plot-01"));
        assertEquals("f1", KeyEncoder.validateLocalFieldId("f1"));
        assertEquals("a".repeat(21), KeyEncoder.validateLocalFieldId("a".repeat(21)));

        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateLocalFieldId(""));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateLocalFieldId(null));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateLocalFieldId("invalid_slug"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateLocalFieldId("plot/01"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateLocalFieldId("plot:01"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateLocalFieldId("a".repeat(22)));
    }

    @Test
    @DisplayName("Field document ID arithmetic: {farmId}--{localFieldId} <= 64 chars")
    void testFieldDocIdArithmetic() {
        String canonicalFarmId = "farm-" + UUID.randomUUID().toString().toLowerCase(); // 41 chars
        String localFieldId = "north-paddy"; // 11 chars
        String docId = KeyEncoder.fieldDocId(canonicalFarmId, localFieldId);

        assertEquals(canonicalFarmId + "--" + localFieldId, docId);
        assertEquals(54, docId.length());
        assertTrue(docId.length() <= 64);

        // Maximum boundary: 41 + 2 + 21 = 64 chars
        String maxLocalId = "a".repeat(21);
        String maxDocId = KeyEncoder.fieldDocId(canonicalFarmId, maxLocalId);
        assertEquals(64, maxDocId.length());
        assertEquals(maxDocId, KeyEncoder.validateFieldId(maxDocId));
    }

    @Test
    @DisplayName("Field entity defaults, lifecycle states and attribute assignments")
    void testFieldEntityDefaultsAndLifecycle() {
        Field field = new Field("farm-1--field-1", "field-1", "farm-1", "North Plot", 4.5);

        assertEquals(FieldStatus.ACTIVE, field.getStatus());
        assertEquals(1, field.getVersion());
        assertEquals(4.5, field.getAreaHectares());
        assertNotNull(field.getCreatedAt());
        assertNotNull(field.getUpdatedAt());
        assertNull(field.getArchivedAt());

        field.setCropType(CropType.RICE);
        field.setSoilType(SoilType.CLAY);
        field.setIrrigationType(IrrigationType.CANAL);
        field.setNotes("Primary monsoon crop");

        assertEquals(CropType.RICE, field.getCropType());
        assertEquals(SoilType.CLAY, field.getSoilType());
        assertEquals(IrrigationType.CANAL, field.getIrrigationType());
        assertEquals("Primary monsoon crop", field.getNotes());

        // Lifecycle transitions
        field.setStatus(FieldStatus.FALLOW);
        assertEquals(FieldStatus.FALLOW, field.getStatus());

        field.setStatus(FieldStatus.PREPARATION);
        assertEquals(FieldStatus.PREPARATION, field.getStatus());

        field.setStatus(FieldStatus.ARCHIVED);
        assertEquals(FieldStatus.ARCHIVED, field.getStatus());
    }

    @Test
    @DisplayName("Enums completeness: CropType, SoilType, IrrigationType, FieldStatus")
    void testEnumsCompleteness() {
        assertEquals(4, FieldStatus.values().length);
        assertEquals(8, CropType.values().length);
        assertEquals(6, SoilType.values().length);
        assertEquals(5, IrrigationType.values().length);

        assertEquals(FieldStatus.ACTIVE, FieldStatus.valueOf("ACTIVE"));
        assertEquals(CropType.WHEAT, CropType.valueOf("WHEAT"));
        assertEquals(SoilType.LOAMY, SoilType.valueOf("LOAMY"));
        assertEquals(IrrigationType.DRIP, IrrigationType.valueOf("DRIP"));
    }
}
