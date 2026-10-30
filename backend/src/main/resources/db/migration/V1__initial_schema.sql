-- Create tables for Library Management System

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50),
    bio TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    author VARCHAR(255),
    published_date DATE,
    genre VARCHAR(100),
    quantity INT DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    rejection_reason VARCHAR(500),
    submitted_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size BIGINT,
    file_data BYTEA,
    cover_image_name VARCHAR(255),
    cover_image_type VARCHAR(100),
    cover_image_size BIGINT,
    cover_image_data BYTEA,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Borrowing records table
CREATE TABLE IF NOT EXISTS borrowing_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    borrowed_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    return_date TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'BORROWED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student notifications table
CREATE TABLE IF NOT EXISTS student_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    reference_book_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_author_id ON books(author_id);
CREATE INDEX IF NOT EXISTS idx_books_status_submitted_date ON books(status, submitted_date DESC);
CREATE INDEX IF NOT EXISTS idx_borrowing_user_id ON borrowing_records(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_user_status ON borrowing_records(user_id, status);
CREATE INDEX IF NOT EXISTS idx_borrowing_book_id ON borrowing_records(book_id);
CREATE INDEX IF NOT EXISTS idx_borrowing_status ON borrowing_records(status);
CREATE INDEX IF NOT EXISTS idx_student_notifications_user_created ON student_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_notifications_reference_book ON student_notifications(reference_book_id);
