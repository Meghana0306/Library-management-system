package com.comp3111.library.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Ownership checks per CONTRACTS §3. Called explicitly at the top of an endpoint —
 * never as a blanket SpEL expression. LIBRARIAN always bypasses.
 */
@Component
public class OwnershipGuard {

    private static final String DEFAULT_MESSAGE = "You may only access your own data.";

    /** The caller behind the current request, or null when the request is unauthenticated. */
    public LibraryPrincipal currentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof LibraryPrincipal)) {
            return null;
        }
        return (LibraryPrincipal) authentication.getPrincipal();
    }

    public LibraryPrincipal requirePrincipal() {
        LibraryPrincipal principal = currentPrincipal();
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required.");
        }
        return principal;
    }

    /** Acting user id for derive-from-claim writes; any client-supplied id is ignored. */
    public Long actingUserId() {
        return actingUserId(currentPrincipal());
    }

    public Long actingUserId(LibraryPrincipal principal) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required.");
        }
        return principal.userId();
    }

    public boolean isLibrarian(LibraryPrincipal principal) {
        return principal != null && principal.isLibrarian();
    }

    public void assertSelf(Long pathUserId) {
        assertSelf(pathUserId, currentPrincipal());
    }

    public void assertSelf(Long pathUserId, LibraryPrincipal principal) {
        assertOwner(pathUserId, principal, DEFAULT_MESSAGE);
    }

    public void assertOwner(Long ownerId, LibraryPrincipal principal) {
        assertOwner(ownerId, principal, DEFAULT_MESSAGE);
    }

    public void assertOwner(Long ownerId, String resourceDescription) {
        assertOwner(ownerId, currentPrincipal(), "You do not own this " + resourceDescription + ".");
    }

    public void assertOwner(Long ownerId, LibraryPrincipal principal, String message) {
        if (principal == null) {
            throw new AccessDeniedException("Authentication is required.");
        }
        if (principal.isLibrarian()) {
            return;
        }
        if (ownerId == null || !ownerId.equals(principal.userId())) {
            throw new AccessDeniedException(message);
        }
    }
}
