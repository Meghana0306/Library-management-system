package com.comp3111.library.repository;

import com.comp3111.library.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByEmailAndIdNot(String email, Long id);
    List<User> findByRoleOrderByUsernameAsc(String role);

    /**
     * The four columns the JWT filter needs, and nothing else — a full entity load would
     * pull the profile_picture bytea (up to 2MB) and the password hash on every
     * authenticated request.
     */
    @Query("SELECT u.id AS id, u.username AS username, u.role AS role, u.active AS active "
            + "FROM User u WHERE u.id = :id")
    Optional<AuthPrincipalView> findAuthViewById(@Param("id") Long id);

    interface AuthPrincipalView {
        Long getId();

        String getUsername();

        String getRole();

        boolean isActive();
    }
}

