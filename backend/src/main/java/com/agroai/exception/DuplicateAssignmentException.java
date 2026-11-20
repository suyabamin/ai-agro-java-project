package com.agroai.exception;

public class DuplicateAssignmentException extends RuntimeException {
    public DuplicateAssignmentException(String message) {
        super(message);
    }

    public static DuplicateAssignmentException forFarmerAndField(String farmerUid, String fieldId) {
        return new DuplicateAssignmentException(
                "An active field assignment already exists for farmer '" + farmerUid + "' on field '" + fieldId + "'"
        );
    }
}
