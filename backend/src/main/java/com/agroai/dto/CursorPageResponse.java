package com.agroai.dto;

import com.agroai.repository.CursorPage;

import java.util.List;
import java.util.function.Function;

public record CursorPageResponse<T>(List<T> items, String nextCursor, boolean hasNext, int pageSize) {
    public CursorPageResponse {
        items = List.copyOf(items);
    }

    public static <S, T> CursorPageResponse<T> map(CursorPage<S> page, int pageSize,
                                                   Function<S, T> mapper,
                                                   Function<String, String> cursorEncoder) {
        return new CursorPageResponse<>(page.items().stream().map(mapper).toList(),
                page.hasNext() ? cursorEncoder.apply(page.nextCursor()) : null,
                page.hasNext(), pageSize);
    }
}
