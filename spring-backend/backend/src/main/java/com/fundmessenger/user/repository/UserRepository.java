package com.fundmessenger.user.repository;

import com.fundmessenger.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    List<User> findByIsActiveTrue();

    List<User> findByIsActiveFalse();

    List<User> findByRole(String role);

    List<User> findByIsActive(Boolean isActive);

    List<User> findByRoleAndIsActive(String role, Boolean isActive);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    long countByIsActiveTrue();
}
