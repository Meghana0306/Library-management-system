package com.comp3111.library;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Boots the full Spring context against a fresh, empty Testcontainers Postgres
 * instance so that Flyway applies V1..V13 from scratch and Hibernate's
 * ddl-auto: validate confirms the resulting schema matches the JPA entities.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class FlywayMigrationIT {

    private static final String DUMMY_JWT_SECRET = "flyway-migration-it-dummy-jwt-secret-value-48ch";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16"))
            .withDatabaseName("library_db")
            .withUsername("postgres")
            .withPassword("postgres");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);

        // JwtService requires a >=32-byte secret; tests supply a dummy.
        registry.add("library.jwt.secret", () -> DUMMY_JWT_SECRET);
    }

    @Autowired
    private DataSource dataSource;

    @Test
    void contextLoadsAndFlywayAppliesAllMigrationsOnEmptyDatabase() throws Exception {
        // If the context started at all, Flyway has already run V1..V13 and
        // Hibernate's ddl-auto: validate has confirmed the schema matches the
        // JPA entity mappings.
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {

            boolean foundVersion13 = false;
            try (ResultSet resultSet = statement.executeQuery(
                    "SELECT version, success FROM flyway_schema_history WHERE version = '13'")) {
                while (resultSet.next()) {
                    foundVersion13 = resultSet.getBoolean("success");
                }
            }
            assertTrue(foundVersion13, "flyway_schema_history should contain a successful V13 entry");
        }
    }
}
