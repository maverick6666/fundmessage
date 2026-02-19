package com.fundmessenger.email.repository;

import com.fundmessenger.email.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {

    Optional<EmailVerification> findByEmailAndCodeAndIsVerifiedFalse(String email, String code);

    Optional<EmailVerification> findTopByEmailOrderByCreatedAtDesc(String email);

    void deleteByEmailAndIsVerifiedFalse(String email);

    boolean existsByEmailAndIsVerifiedTrue(String email);
}
