package com.comp3111.library.security;

import java.security.Principal;

/**
 * Authenticated caller derived from the JWT claims. Never populated from request
 * parameters or bodies.
 */
public record LibraryPrincipal(Long userId, String username, String role) implements Principal {

    public static final String LIBRARIAN = "LIBRARIAN";

    @Override
    public String getName() {
        return username;
    }

    public boolean isLibrarian() {
        return LIBRARIAN.equals(role);
    }

    public boolean hasRole(String candidate) {
        return role != null && role.equalsIgnoreCase(candidate);
    }
}
