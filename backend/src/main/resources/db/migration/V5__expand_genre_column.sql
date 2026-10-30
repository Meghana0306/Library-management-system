-- Expand genre column to support multiple genres joined as a comma-separated string.
-- The original VARCHAR(100) is too short when many genres are selected.
ALTER TABLE books ALTER COLUMN genre TYPE VARCHAR(500);
