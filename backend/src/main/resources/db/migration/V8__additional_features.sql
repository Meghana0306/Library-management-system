-- V8: Additional features for phase 3 (Task 1)

-- Task 1.7: Persistent read state for notifications
ALTER TABLE student_notifications
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Task 1.9: Anonymous reviews support
ALTER TABLE book_reviews
    ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

-- Task 1.10: Priority field for book requests
ALTER TABLE book_requests
    ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL';