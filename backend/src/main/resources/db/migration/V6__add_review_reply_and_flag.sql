-- Add author reply and flag fields to book_reviews
ALTER TABLE book_reviews
    ADD COLUMN IF NOT EXISTS author_reply     TEXT,
    ADD COLUMN IF NOT EXISTS author_reply_at  TIMESTAMP,
    ADD COLUMN IF NOT EXISTS flagged          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS flag_reason      VARCHAR(500);
