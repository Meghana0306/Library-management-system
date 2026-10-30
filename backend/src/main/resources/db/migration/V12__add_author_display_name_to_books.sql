-- V12: Add author display name to books
-- Allows librarian-added books to have a custom author name separate from the owning user

ALTER TABLE books
ADD COLUMN author_display_name VARCHAR(255) DEFAULT NULL;

CREATE INDEX idx_books_author_display_name ON books(author_display_name);
