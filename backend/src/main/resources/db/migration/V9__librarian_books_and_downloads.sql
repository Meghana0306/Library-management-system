-- V9: Librarian book management additions (phase 3)

-- Track how a book was added to the catalog
ALTER TABLE books
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'AUTHOR_SUBMISSION';

-- Book change log for version history
CREATE TABLE IF NOT EXISTS book_change_logs (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL,
    changed_by BIGINT,
    action VARCHAR(20) NOT NULL,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_book_change_logs_book_id ON book_change_logs(book_id);
