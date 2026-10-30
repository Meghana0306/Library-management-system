package com.comp3111.library.service;

import com.comp3111.library.model.Book;
import com.comp3111.library.security.LibraryPrincipal;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileAccessRuleTest {

    private static final Long OWNER_ID = 7L;
    private static final Long OTHER_ID = 8L;

    private static LibraryPrincipal principal(Long userId, String role) {
        return new LibraryPrincipal(userId, "user-" + userId, role);
    }

    private static boolean canRead(Book.BookStatus status, LibraryPrincipal principal) {
        return FileAccessRule.canReadBookFile(status, OWNER_ID, principal);
    }

    @Test
    void librarianReadsAnyBookInAnyStatus() {
        LibraryPrincipal librarian = principal(99L, "LIBRARIAN");
        assertTrue(canRead(Book.BookStatus.PENDING, librarian));
        assertTrue(canRead(Book.BookStatus.APPROVED, librarian));
        assertTrue(canRead(Book.BookStatus.REJECTED, librarian));
    }

    @Test
    void owningAuthorReadsOwnBookInAnyStatus() {
        LibraryPrincipal owner = principal(OWNER_ID, "AUTHOR");
        assertTrue(canRead(Book.BookStatus.PENDING, owner));
        assertTrue(canRead(Book.BookStatus.APPROVED, owner));
        assertTrue(canRead(Book.BookStatus.REJECTED, owner));
    }

    @Test
    void otherAuthorFallsBackToTheStatusRule() {
        LibraryPrincipal otherAuthor = principal(OTHER_ID, "AUTHOR");
        assertTrue(canRead(Book.BookStatus.APPROVED, otherAuthor));
        assertFalse(canRead(Book.BookStatus.PENDING, otherAuthor));
        assertFalse(canRead(Book.BookStatus.REJECTED, otherAuthor));
    }

    @Test
    void studentReadsApprovedBooksOnly() {
        LibraryPrincipal student = principal(OTHER_ID, "STUDENT");
        assertTrue(canRead(Book.BookStatus.APPROVED, student));
        assertFalse(canRead(Book.BookStatus.PENDING, student));
        assertFalse(canRead(Book.BookStatus.REJECTED, student));
    }

    @Test
    void staffReadsApprovedBooksOnly() {
        LibraryPrincipal staff = principal(OTHER_ID, "STAFF");
        assertTrue(canRead(Book.BookStatus.APPROVED, staff));
        assertFalse(canRead(Book.BookStatus.PENDING, staff));
        assertFalse(canRead(Book.BookStatus.REJECTED, staff));
    }

    @Test
    void studentWhoseIdMatchesTheAuthorIdStillNeedsTheAuthorRole() {
        LibraryPrincipal impostor = principal(OWNER_ID, "STUDENT");
        assertFalse(canRead(Book.BookStatus.PENDING, impostor));
    }

    @Test
    void bookWithoutAnAuthorIdFallsBackToTheStatusRule() {
        LibraryPrincipal author = principal(OWNER_ID, "AUTHOR");
        assertFalse(FileAccessRule.canReadBookFile(Book.BookStatus.PENDING, null, author));
        assertTrue(FileAccessRule.canReadBookFile(Book.BookStatus.APPROVED, null, author));
    }

    @Test
    void unauthenticatedCallerIsNeverAllowed() {
        assertFalse(canRead(Book.BookStatus.PENDING, null));
        assertFalse(canRead(Book.BookStatus.APPROVED, null));
    }

    @Test
    void etagIsStableForEqualInputs() {
        String first = FileStorageService.etag("book", 1L, 42L, "book.pdf", "application/pdf", "APPROVED");
        String second = FileStorageService.etag("book", 1L, 42L, "book.pdf", "application/pdf", "APPROVED");
        assertEquals(first, second);
    }

    @Test
    void etagChangesWhenTheStoredFileOrStatusChanges() {
        String base = FileStorageService.etag("book", 1L, 42L, "book.pdf", "application/pdf", "APPROVED");
        assertNotEquals(base, FileStorageService.etag("book", 1L, 43L, "book.pdf", "application/pdf", "APPROVED"));
        assertNotEquals(base, FileStorageService.etag("book", 1L, 42L, "other.pdf", "application/pdf", "APPROVED"));
        assertNotEquals(base, FileStorageService.etag("book", 1L, 42L, "book.pdf", "application/pdf", "PENDING"));
        assertNotEquals(base, FileStorageService.etag("cover", 1L, 42L, "book.pdf", "application/pdf", "APPROVED"));
    }

    @Test
    void ifNoneMatchHandlesWildcardWeakAndListForms() {
        String etag = FileStorageService.etag("book", 1L, 42L, "book.pdf");
        assertTrue(FileStorageService.matchesIfNoneMatch(etag, etag));
        assertTrue(FileStorageService.matchesIfNoneMatch(etag, "*"));
        assertTrue(FileStorageService.matchesIfNoneMatch(etag, "W/" + etag));
        assertTrue(FileStorageService.matchesIfNoneMatch(etag, "\"other\", " + etag));
        assertFalse(FileStorageService.matchesIfNoneMatch(etag, "\"other\""));
        assertFalse(FileStorageService.matchesIfNoneMatch(etag, null));
        assertFalse(FileStorageService.matchesIfNoneMatch(etag, "  "));
    }
}
