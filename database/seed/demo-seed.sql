-- Demo data seed script (idempotent — safe to re-run)
--
-- Usage:
--   psql -h localhost -p 5433 -U postgres -d library_db -f database/seed/demo-seed.sql
--
-- Demo credentials (all four accounts share the same password):
--   username: demo_student   | role: STUDENT   | password: Demo1234!
--   username: demo_staff     | role: STAFF     | password: Demo1234!
--   username: demo_author    | role: AUTHOR    | password: Demo1234!
--   username: demo_librarian | role: LIBRARIAN | password: Demo1234!
--
-- Book files/covers are NOT seeded here (file_data / cover_image_data stay
-- NULL) — upload actual PDFs/covers through the UI after logging in as
-- demo_author or demo_librarian. This script only seeds book metadata rows.

INSERT INTO users (username, email, password, role, full_name, active, created_at, updated_at)
VALUES
  ('demo_student', 'demo_student@example.com', '$2y$10$.rvf0g1aWyM753JVFWjsueWjnvUzVB0T1/hQmw8Gbd5cWffFy1jsW', 'STUDENT', 'Demo Student', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_staff', 'demo_staff@example.com', '$2y$10$.rvf0g1aWyM753JVFWjsueWjnvUzVB0T1/hQmw8Gbd5cWffFy1jsW', 'STAFF', 'Demo Staff', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_author', 'demo_author@example.com', '$2y$10$.rvf0g1aWyM753JVFWjsueWjnvUzVB0T1/hQmw8Gbd5cWffFy1jsW', 'AUTHOR', 'Demo Author', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo_librarian', 'demo_librarian@example.com', '$2y$10$.rvf0g1aWyM753JVFWjsueWjnvUzVB0T1/hQmw8Gbd5cWffFy1jsW', 'LIBRARIAN', 'Demo Librarian', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO NOTHING;

INSERT INTO books (title, isbn, published_date, genre, quantity, status, author_id, description, submitted_date, source, author_display_name, created_at, updated_at)
SELECT v.title, v.isbn, v.published_date, v.genre, v.quantity, 'APPROVED', u.id, v.description, CURRENT_TIMESTAMP, 'LIBRARIAN_MANUAL', u.full_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('The Silent Observatory', '978-1-00000-001-1', DATE '2018-03-14', 'Science Fiction', 3, 'A reclusive astronomer uncovers a signal that should not exist.'),
  ('Autumn in Kowloon', '978-1-00000-002-8', DATE '2015-09-01', 'Literary Fiction', 2, 'A multigenerational story set across Hong Kong''s changing skyline.'),
  ('Foundations of Distributed Systems', '978-1-00000-003-5', DATE '2020-01-20', 'Computer Science', 3, 'A practical guide to consensus, replication, and fault tolerance.'),
  ('The Last Cartographer', '978-1-00000-004-2', DATE '2012-06-11', 'Fantasy', 2, 'A mapmaker is tasked with charting a kingdom that keeps rearranging itself.'),
  ('Quiet Algorithms', '978-1-00000-005-9', DATE '2021-11-05', 'Non-Fiction', 3, 'Essays on the invisible software shaping everyday decisions.')
) AS v(title, isbn, published_date, genre, quantity, description)
CROSS JOIN (SELECT id, full_name FROM users WHERE username = 'demo_author') AS u
WHERE NOT EXISTS (SELECT 1 FROM books b WHERE b.isbn = v.isbn);
