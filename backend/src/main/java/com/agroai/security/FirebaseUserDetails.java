package com.agroai.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

public class FirebaseUserDetails implements UserDetails {

    private final String uid;
    private final String email;
    private final String name;
    private final boolean emailVerified;
    private final Map<String, Object> claims;

    public FirebaseUserDetails(String uid, String email, String name, boolean emailVerified, Map<String, Object> claims) {
        this.uid = uid;
        this.email = email;
        this.name = name;
        this.emailVerified = emailVerified;
        this.claims = claims != null ? claims : Collections.emptyMap();
    }

    public String getUid() {
        return uid;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public Map<String, Object> getClaims() {
        return claims;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.emptyList();
    }

    @Override
    public String getPassword() {
        return null;
    }

    @Override
    public String getUsername() {
        return uid;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
