package com.agroai.model;

/**
 * Lifecycle states for agricultural job postings.
 */
public enum JobStatus {
    DRAFT,
    PUBLISHED,
    PAUSED,
    CLOSED,
    ARCHIVED;

    public boolean canAcceptApplications() {
        return this == PUBLISHED;
    }

    public boolean isPubliclyVisible() {
        return this == PUBLISHED;
    }
}
