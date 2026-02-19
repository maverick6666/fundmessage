package com.fundmessenger.email.service;

import com.fundmessenger.common.config.AppProperties;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.email.entity.EmailVerification;
import com.fundmessenger.email.repository.EmailVerificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final EmailVerificationRepository emailVerificationRepository;
    private final AppProperties appProperties;
    private final JavaMailSender javaMailSender;

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Generates a 6-digit random verification code.
     */
    public String generateCode() {
        int code = RANDOM.nextInt(900000) + 100000;
        return String.valueOf(code);
    }

    /**
     * Creates a new email verification entry.
     * Deletes any existing unverified entries for the same email,
     * then creates a new one with a 10-minute expiry.
     *
     * @param email the email address to verify
     * @return the generated 6-digit verification code
     */
    @Transactional
    public String createVerification(String email) {
        // Delete existing unverified entries for this email
        emailVerificationRepository.deleteByEmailAndIsVerifiedFalse(email);

        String code = generateCode();

        EmailVerification verification = new EmailVerification();
        verification.setEmail(email);
        verification.setCode(code);
        verification.setIsVerified(false);
        verification.setExpiresAt(OffsetDateTime.now().plusMinutes(10));

        emailVerificationRepository.save(verification);

        log.info("Created email verification for: {}", email);
        return code;
    }

    /**
     * Verifies the given code for the specified email.
     * Checks that the code matches an unverified entry and has not expired.
     *
     * @param email the email address
     * @param code  the 6-digit verification code
     */
    @Transactional
    public void verifyCode(String email, String code) {
        EmailVerification verification = emailVerificationRepository
                .findByEmailAndCodeAndIsVerifiedFalse(email, code)
                .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST,
                        "유효하지 않은 인증 코드입니다"));

        if (verification.isExpired()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "인증 코드가 만료되었습니다. 새로운 코드를 요청해주세요");
        }

        verification.setIsVerified(true);
        emailVerificationRepository.save(verification);

        log.info("Email verified successfully: {}", email);
    }

    /**
     * Checks whether the given email has been verified.
     *
     * @param email the email address to check
     * @return true if a verified entry exists for the email
     */
    public boolean isEmailVerified(String email) {
        return emailVerificationRepository.existsByEmailAndIsVerifiedTrue(email);
    }

    /**
     * Sends a verification email with the given code to the specified address.
     *
     * @param email the recipient email address
     * @param code  the 6-digit verification code
     */
    public void sendVerificationEmail(String email, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(appProperties.getSmtp().getFromEmail());
            message.setTo(email);
            message.setSubject("[펀드팀 메신저] 이메일 인증 코드");
            message.setText(buildVerificationEmailBody(code));

            javaMailSender.send(message);
            log.info("Verification email sent to: {}", email);
        } catch (Exception e) {
            log.error("Failed to send verification email to {}: {}", email, e.getMessage());
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "인증 이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요");
        }
    }

    private String buildVerificationEmailBody(String code) {
        return "안녕하세요, 펀드팀 메신저입니다.\n\n"
                + "이메일 인증 코드: " + code + "\n\n"
                + "이 코드는 10분 동안 유효합니다.\n"
                + "본인이 요청하지 않은 경우 이 이메일을 무시하세요.\n\n"
                + "감사합니다.\n"
                + "펀드팀 메신저 드림";
    }
}
