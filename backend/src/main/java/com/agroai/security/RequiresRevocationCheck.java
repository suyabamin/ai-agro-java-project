package com.agroai.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation for high-risk endpoints that require online token revocation checking
 * against Google Identity servers to protect against revoked tokens or disabled accounts.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresRevocationCheck {
}
