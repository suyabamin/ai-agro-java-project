package com.agroai.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CursorPaginationTest {
    @Test
    void validatesPageBoundariesAndRoundTripsStableCursor() {
        assertEquals(25, CursorPagination.validatePageSize(null));
        assertEquals(1, CursorPagination.validatePageSize(1));
        assertEquals(100, CursorPagination.validatePageSize(100));
        assertThrows(IllegalArgumentException.class, () -> CursorPagination.validatePageSize(0));
        assertThrows(IllegalArgumentException.class, () -> CursorPagination.validatePageSize(101));
        String cursor = CursorPagination.encode("asgn_tenure_a-01");
        assertEquals("asgn_tenure_a-01", CursorPagination.decode(cursor));
        assertThrows(IllegalArgumentException.class, () -> CursorPagination.decode("%%%"));
    }
}
