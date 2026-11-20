package com.agroai.model;

/**
 * Lifecycle states for farmer job applications.
 */
public enum ApplicationStatus {
    SUBMITTED,
    UNDER_REVIEW,
    SHORTLISTED,
    APPROVED,
    REJECTED,
    WITHDRAWN;

    public boolean isTerminal() {
        return this == APPROVED || this == REJECTED || this == WITHDRAWN;
    }

    public boolean canWithdraw() {
        return this == SUBMITTED || this == UNDER_REVIEW || this == SHORTLISTED;
    }
}
