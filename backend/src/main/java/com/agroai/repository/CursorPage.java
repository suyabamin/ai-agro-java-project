package com.agroai.repository;

import java.util.List;

/** A bounded result page; nextCursor is the last returned document ID when more data exists. */
public record CursorPage<T>(List<T> items, String nextCursor, boolean hasNext) {
    public CursorPage {
        items = List.copyOf(items);
    }
}
