package com.agroai.exception;

public class FieldNotFoundException extends RuntimeException {

    private final String fieldId;

    public FieldNotFoundException(String fieldId) {
        super(String.format("Field with ID '%s' was not found", fieldId));
        this.fieldId = fieldId;
    }

    public String getFieldId() {
        return fieldId;
    }
}
