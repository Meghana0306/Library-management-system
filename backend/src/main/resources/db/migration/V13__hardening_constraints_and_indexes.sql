-- V13: hardening constraints, indexes, and book_change_logs FK repair
-- The backfills below are defensive and idempotent, so this migration is
-- safe to run against any environment that already has rows.

-- books.quantity: backfill NULLs, enforce NOT NULL + non-negative
UPDATE books SET quantity = 1 WHERE quantity IS NULL;
ALTER TABLE books ALTER COLUMN quantity SET NOT NULL;
UPDATE books SET quantity = 0 WHERE quantity < 0;
ALTER TABLE books ADD CONSTRAINT chk_books_quantity_nonneg CHECK (quantity >= 0);

-- books.status / books.source: restrict to known enum values
ALTER TABLE books ADD CONSTRAINT chk_books_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE books ADD CONSTRAINT chk_books_source CHECK (source IN ('AUTHOR_SUBMISSION', 'LIBRARIAN_MANUAL', 'REQUEST_DOWNLOAD'));

-- borrowing_records.status / reading_progress
ALTER TABLE borrowing_records ADD CONSTRAINT chk_borrowing_status CHECK (status IN ('BORROWED', 'RETURNED'));
ALTER TABLE borrowing_records ADD CONSTRAINT chk_reading_progress CHECK (reading_progress BETWEEN 0 AND 100);

-- book_change_logs: allow orphaned rows to survive book deletion instead of
-- being blocked by a hard FK; snapshot the title at write time since book_id
-- may later become NULL.
UPDATE book_change_logs SET book_id = NULL WHERE book_id IS NOT NULL AND book_id NOT IN (SELECT id FROM books);
ALTER TABLE book_change_logs ALTER COLUMN book_id DROP NOT NULL;
ALTER TABLE book_change_logs ADD COLUMN book_title VARCHAR(255);
ALTER TABLE book_change_logs ADD CONSTRAINT fk_book_change_logs_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL;

-- student_notifications: track update time
ALTER TABLE student_notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indexes to support common query patterns
CREATE INDEX IF NOT EXISTS idx_borrowing_records_return_date ON borrowing_records(return_date);
CREATE INDEX IF NOT EXISTS idx_borrowing_records_status_due_date ON borrowing_records(status, due_date);
CREATE INDEX IF NOT EXISTS idx_student_notifications_user_is_read ON student_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_book_requests_title_lower ON book_requests(lower(title));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
