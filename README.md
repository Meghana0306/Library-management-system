# Library Management System

A full-stack Library Management System designed to simplify library operations through dedicated portals for Students, Staff, Authors, and Librarians. The application provides book management, borrowing workflows, manuscript submissions, user management, and role-based access control.

## Overview

The Library Management System provides a centralized platform for managing library resources and automating day-to-day library operations.

It follows a client-server architecture, with a React frontend communicating with a Java Spring Boot backend through REST APIs. PostgreSQL is used for persistent data storage.

## Features

### Student Portal
- Browse and search the available book catalogue.
- View book information and availability.
- Request books for borrowing.
- Manage borrowing and return activities.
- Access available digital books.
- Submit book reviews and ratings.

### Staff Portal
- Access library resources according to assigned permissions.
- Work with library-related operations and records.

### Author Portal
- Submit new book manuscripts.
- Upload book documents and cover information.
- Manage submitted books.
- Track submission status and feedback.

### Librarian Portal
- Review and approve or reject book submissions.
- Manage books and library records.
- Manage user information.
- Monitor borrowing requests.
- View library statistics and administrative information.

### Security and Authentication
- JWT-based authentication.
- Role-based access control.
- Protected application routes.
- Password hashing.
- Backend request authorization.

## Technology Stack

| Category | Technologies |
|---|---|
| Programming Language | Java 17 |
| Backend | Spring Boot 2.7.18 |
| Frontend | React 18, JavaScript |
| Frontend Build Tool | Vite |
| Database | PostgreSQL 16 |
| ORM | Hibernate, Spring Data JPA |
| Database Migration | Flyway |
| Security | Spring Security, JWT |
| Build Management | Apache Maven |
| Containerization | Docker, Docker Compose |
| Testing | JUnit, Testcontainers, Vitest |

## System Architecture

```text
             USER
               |
               v
       REACT FRONTEND
               |
          REST APIs
               |
               v
       SPRING BOOT BACKEND
               |
       SPRING SECURITY
            + JWT
               |
               v
        SERVICE LAYER
               |
               v
       REPOSITORY LAYER
               |
          JPA / ORM
               |
               v
          POSTGRESQL
```

## Project Structure

```text
Library-management-system/
|
|-- backend/
|   |-- src/
|   |   |-- main/
|   |       |-- java/
|   |       |-- resources/
|   |-- pom.xml
|   |-- .env.example
|
|-- frontend/
|   |-- src/
|   |-- public/
|   |-- package.json
|   |-- vite.config.js
|
|-- database/
|   |-- seed/
|
|-- docs/
|
|-- docker-compose.yml
|-- README.md
|-- LICENSE
```

## Prerequisites

Install the following before running the application:

- Java JDK 17
- Apache Maven 3.6 or later
- Node.js 24.15+ (or a compatible supported version)
- npm
- Docker Desktop
- Git

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Meghana0306/Library-management-system.git

cd Library-management-system
```

### 2. Start PostgreSQL using Docker

```bash
docker compose up -d
```

Verify the database container:

```bash
docker compose ps
```

The development database uses PostgreSQL on port 5433.

### 3. Configure environment variables

Create the backend environment file:

**Windows PowerShell**

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Open `backend/.env` and configure the database credentials and a secure JWT secret.

The Gemini API key is optional and can remain empty when AI features are not required.

Never commit your `.env` file or expose credentials publicly.

### 4. Start the Spring Boot backend

Open a terminal:

```bash
cd backend
```

Run:

```bash
mvn spring-boot:run
```

The backend runs on:

```text
http://localhost:8080
```

If port 8080 is unavailable, start the backend on port 8081 using the following PowerShell command:

```powershell
$env:SERVER_PORT = "8081"
mvn spring-boot:run
```

Make sure the frontend development proxy targets the same backend port.

### 5. Start the React frontend

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

The frontend is available at:

```text
http://localhost:3000
```

## Database Initialization

Flyway manages database schema creation and versioned migrations when the Spring Boot application starts.

Demo data can be loaded after the database migrations have completed.

Run from the project root in Windows PowerShell:

```powershell
Get-Content .\database\seed\demo-seed.sql -Raw |
docker exec -i library-db psql -U postgres -d library_db
```

## Demo Accounts

The development seed data provides the following demo accounts:

| Username | Role |
|---|---|
| demo_student | Student |
| demo_staff | Staff |
| demo_author | Author |
| demo_librarian | Librarian |

**Demo password:** `Demo1234!`

These credentials are intended for local development and testing only. Do not use them in a production environment.

## API Documentation

When the backend is running, access the Swagger API documentation at:

```text
http://localhost:8080/swagger-ui/index.html
```

For a backend running on port 8081:

```text
http://localhost:8081/swagger-ui/index.html
```

## Development and Testing

Backend:

```bash
cd backend
mvn test
```

Frontend:

```bash
cd frontend
npm run
```

Use the available test scripts listed by npm to execute the frontend test suite.

## Future Improvements

- Enhanced library analytics and reporting.
- Improved search and filtering.
- Additional security and authorization improvements.
- Better notification management.
- Responsive UI enhancements.
- Expanded automated test coverage.
### Backend Proxy Configuration

By default, the frontend forwards API requests to:

http://localhost:8080

To use a different backend port, configure the
BACKEND_URL environment variable.

Windows PowerShell:

$env:BACKEND_URL = "http://localhost:8081"
npm run dev
## License

This project is distributed under the MIT License. Refer to the [LICENSE](LICENSE) file for the applicable terms and copyright notice.