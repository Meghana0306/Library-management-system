-- V10: Add keywords/search hints to book requests

ALTER TABLE book_requests
    ADD COLUMN IF NOT EXISTS keywords VARCHAR(255);