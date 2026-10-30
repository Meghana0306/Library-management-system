package com.comp3111.library.service;

import com.comp3111.library.model.Book;
import com.comp3111.library.security.LibraryPrincipal;

/**
 * Book file / cover visibility rule (CONTRACTS §2) as a pure function so it can be
 * exercised without a Spring context.
 */
public final class FileAccessRule {

    private FileAccessRule() {
    }

    /**
     * @param principal the authenticated caller; a {@code null} principal is never
     *                  allowed to read book bytes.
     */
    public static boolean canReadBookFile(Book.BookStatus status, Long bookAuthorId, LibraryPrincipal principal) {
        if (principal == null) {
            return false;
        }
        if (principal.isLibrarian()) {
            return true;
        }
        if (principal.hasRole("AUTHOR")
                && bookAuthorId != null
                && bookAuthorId.equals(principal.userId())) {
            return true;
        }
        return status == Book.BookStatus.APPROVED;
    }
}
