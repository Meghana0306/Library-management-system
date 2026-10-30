-- Remove the redundant author name column from books.
-- Author name is now derived from the users table via author_id.
ALTER TABLE books DROP COLUMN IF EXISTS author;
