-- Fix id and foreign key columns from INTEGER to BIGINT
-- to match JPA entity Long types

DO $$
DECLARE
    fk_record RECORD;
BEGIN
    FOR fk_record IN
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (
              (tc.table_name = 'books' AND kcu.column_name = 'author_id' AND ccu.table_name = 'users' AND ccu.column_name = 'id') OR
              (tc.table_name = 'borrowing_records' AND kcu.column_name = 'user_id' AND ccu.table_name = 'users' AND ccu.column_name = 'id') OR
              (tc.table_name = 'borrowing_records' AND kcu.column_name = 'book_id' AND ccu.table_name = 'books' AND ccu.column_name = 'id') OR
              (tc.table_name = 'student_notifications' AND kcu.column_name = 'user_id' AND ccu.table_name = 'users' AND ccu.column_name = 'id')
          )
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', fk_record.table_name, fk_record.constraint_name);
    END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN id TYPE BIGINT;

ALTER TABLE books ALTER COLUMN id TYPE BIGINT;
ALTER TABLE books ALTER COLUMN author_id TYPE BIGINT;

ALTER TABLE borrowing_records ALTER COLUMN id TYPE BIGINT;
ALTER TABLE borrowing_records ALTER COLUMN user_id TYPE BIGINT;
ALTER TABLE borrowing_records ALTER COLUMN book_id TYPE BIGINT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_name = 'student_notifications'
    ) THEN
        ALTER TABLE student_notifications ALTER COLUMN user_id TYPE BIGINT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'books_author_id_fkey') THEN
        ALTER TABLE books
            ADD CONSTRAINT books_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'borrowing_records_user_id_fkey') THEN
        ALTER TABLE borrowing_records
            ADD CONSTRAINT borrowing_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'borrowing_records_book_id_fkey') THEN
        ALTER TABLE borrowing_records
            ADD CONSTRAINT borrowing_records_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_notifications')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_notifications_user_id_fkey') THEN
        ALTER TABLE student_notifications
            ADD CONSTRAINT student_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
