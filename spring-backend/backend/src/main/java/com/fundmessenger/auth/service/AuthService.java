package com.fundmessenger.auth.service;

import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.security.JwtTokenProvider;
import com.fundmessenger.attendance.repository.AttendanceRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AttendanceRepository attendanceRepository;

    /**
     * Finds a user by email.
     */
    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    /**
     * Finds a user by username.
     */
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    /**
     * Finds a user by ID.
     */
    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));
    }

    /**
     * Returns the total number of registered users.
     */
    public long getUserCount() {
        return userRepository.count();
    }

    /**
     * Returns all users whose accounts are pending approval (isActive=false).
     */
    public List<User> getPendingUsers() {
        return userRepository.findByIsActiveFalse();
    }

    /**
     * Activates a user account (sets isActive to true).
     *
     * @param userId the user ID to approve
     * @return the updated User entity
     */
    @Transactional
    public User approveUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));
        user.setIsActive(true);
        return userRepository.save(user);
    }

    /**
     * Deactivates a user account (sets isActive to false).
     *
     * @param userId the user ID to deactivate
     * @return the updated User entity
     */
    @Transactional
    public User deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));
        user.setIsActive(false);
        return userRepository.save(user);
    }

    /**
     * Creates a new user with the given details.
     * The password is hashed before saving.
     *
     * @param email    the user's email
     * @param password the user's plain-text password
     * @param username the user's unique username
     * @param fullName the user's full name
     * @param role     the user's role (manager, admin, member)
     * @param isActive whether the account is active
     * @return the created User entity
     */
    @Transactional
    public User createUser(String email, String password, String username,
                           String fullName, String role, boolean isActive) {
        // Check for duplicate email
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 등록된 이메일입니다");
        }

        // Check for duplicate username
        if (userRepository.existsByUsername(username)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 사용 중인 사용자명입니다");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setUsername(username);
        user.setFullName(fullName);
        user.setRole(role);
        user.setIsActive(isActive);
        user.setAttendanceShields(0);

        User saved = userRepository.save(user);
        log.info("User created: {} ({}), role={}, active={}", email, username, role, isActive);
        return saved;
    }

    /**
     * Authenticates a user by email and password.
     * Verifies the password and checks that the account is active.
     *
     * @param email    the user's email
     * @param password the user's plain-text password
     * @return the authenticated User entity
     */
    public User authenticateUser(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED,
                        "이메일 또는 비밀번호가 올바르지 않습니다"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED,
                    "이메일 또는 비밀번호가 올바르지 않습니다");
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new BusinessException(HttpStatus.FORBIDDEN,
                    "계정이 아직 승인되지 않았습니다. 팀장의 승인을 기다려주세요");
        }

        return user;
    }

    /**
     * Retrieves all users with optional filtering by role and active status.
     *
     * @param role     optional role filter
     * @param isActive optional active status filter
     * @return list of matching users
     */
    public List<User> getAllUsers(String role, Boolean isActive) {
        if (role != null && isActive != null) {
            return userRepository.findByRoleAndIsActive(role, isActive);
        } else if (role != null) {
            return userRepository.findByRole(role);
        } else if (isActive != null) {
            return userRepository.findByIsActive(isActive);
        } else {
            return userRepository.findAll();
        }
    }

    /**
     * Updates the role of an existing user.
     *
     * @param userId the user ID
     * @param role   the new role value
     * @return the updated User entity
     */
    @Transactional
    public User updateUserRole(Long userId, String role) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));
        user.setRole(role);
        User saved = userRepository.save(user);
        log.info("User {} role updated to: {}", userId, role);
        return saved;
    }
}
