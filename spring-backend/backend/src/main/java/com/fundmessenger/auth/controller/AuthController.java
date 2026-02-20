package com.fundmessenger.auth.controller;

import com.fundmessenger.attendance.entity.Attendance;
import com.fundmessenger.attendance.repository.AttendanceRepository;
import com.fundmessenger.auth.dto.*;
import com.fundmessenger.auth.service.AuthService;
import com.fundmessenger.common.config.AppProperties;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.security.JwtTokenProvider;
import com.fundmessenger.common.util.KstUtil;
import com.fundmessenger.email.service.EmailService;
import com.fundmessenger.notification.entity.Notification;
import com.fundmessenger.notification.repository.NotificationRepository;
import com.fundmessenger.university.entity.University;
import com.fundmessenger.university.repository.UniversityRepository;
import com.fundmessenger.user.dto.UserResponse;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final EmailService emailService;
    private final JwtTokenProvider jwtTokenProvider;
    private final AppProperties appProperties;
    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final UniversityRepository universityRepository;

    /**
     * POST /api/v1/auth/send-verification
     * Sends an email verification code to the given email address.
     */
    @PostMapping("/send-verification")
    public ResponseEntity<ApiResponse<Map<String, String>>> sendVerification(
            @Valid @RequestBody SendVerificationRequest request) {

        // Check if email is already registered
        if (authService.getUserByEmail(request.getEmail()).isPresent()) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 등록된 이메일입니다");
        }

        String code = emailService.createVerification(request.getEmail());
        emailService.sendVerificationEmail(request.getEmail(), code);

        return ResponseEntity.ok(ApiResponse.success(
                Map.of("message", "인증 코드가 이메일로 전송되었습니다")));
    }

    /**
     * POST /api/v1/auth/verify-code
     * Verifies the email verification code.
     */
    @PostMapping("/verify-code")
    public ResponseEntity<ApiResponse<Map<String, String>>> verifyCode(
            @Valid @RequestBody VerifyCodeRequest request) {

        emailService.verifyCode(request.getEmail(), request.getCode());

        return ResponseEntity.ok(ApiResponse.success(
                Map.of("message", "이메일 인증이 완료되었습니다")));
    }

    /**
     * POST /api/v1/auth/signup
     * Registers a new user.
     * The first user is automatically assigned the manager role and activated.
     * Subsequent users are assigned the member role and require manager approval.
     */
    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<SignupResponse>> signup(
            @Valid @RequestBody SignupRequest request) {

        // Derive username from fullName with duplicate counter
        String baseUsername = request.getFullName().replaceAll("\\s+", "").toLowerCase();
        String username = baseUsername;
        int counter = 1;
        while (authService.getUserByUsername(username).isPresent()) {
            username = baseUsername + counter;
            counter++;
        }

        // University 조회
        University university = universityRepository.findById(request.getUniversityId())
                .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "존재하지 않는 대학교입니다"));

        boolean isFirstUser = authService.getUserCount() == 0;
        String role = isFirstUser ? "manager" : "member";
        boolean isActive = isFirstUser;

        User user = authService.createUser(
                request.getEmail(),
                request.getPassword(),
                username,
                request.getFullName(),
                role,
                isActive
        );
        user.setUniversity(university);
        user.setPositionTitle(request.getPositionTitle());
        userRepository.save(user);

        // Try to notify managers about the new registration (non-first users)
        if (!isFirstUser) {
            try {
                notifyManagersNewUser(user);
            } catch (Exception e) {
                log.warn("Failed to send new user notification to managers: {}", e.getMessage());
            }
        }

        SignupResponse response = SignupResponse.builder()
                .message(isFirstUser
                        ? "팀장으로 등록되었습니다. 바로 로그인할 수 있습니다"
                        : "회원가입이 완료되었습니다. 팀장의 승인을 기다려주세요")
                .requiresApproval(!isFirstUser)
                .build();

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    /**
     * POST /api/v1/auth/login
     * Authenticates a user and returns JWT tokens with user info.
     * Also records auto-attendance for the current KST date.
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponse>> login(
            @Valid @RequestBody LoginRequest request) {

        User user = authService.authenticateUser(request.getEmail(), request.getPassword());

        String accessToken = jwtTokenProvider.createAccessToken(user.getId());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

        // Auto-attendance on login
        recordAutoAttendance(user);

        int expiresIn = appProperties.getJwt().getAccessTokenExpireMinutes() * 60;

        TokenResponse tokenResponse = TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(expiresIn)
                .user(toUserResponse(user))
                .build();

        return ResponseEntity.ok(ApiResponse.success(tokenResponse));
    }

    /**
     * POST /api/v1/auth/refresh
     * Refreshes the access token using a valid refresh token.
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenRefreshResponse>> refresh(
            @Valid @RequestBody RefreshRequest request) {

        String token = request.getRefreshToken();

        if (!jwtTokenProvider.validateRefreshToken(token)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 refresh token입니다");
        }

        Long userId = jwtTokenProvider.getUserIdFromToken(token);
        if (userId == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 refresh token입니다");
        }

        // Verify user still exists and is active
        User user = authService.getUserById(userId);
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "비활성화된 계정입니다");
        }

        String newAccessToken = jwtTokenProvider.createAccessToken(userId);
        String newRefreshToken = jwtTokenProvider.createRefreshToken(userId);

        int expiresIn = appProperties.getJwt().getAccessTokenExpireMinutes() * 60;

        TokenRefreshResponse response = TokenRefreshResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(expiresIn)
                .build();

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * POST /api/v1/auth/activate-first-user
     * Activates the first pending user as a manager.
     * Requires MANAGER or ADMIN role.
     */
    @PostMapping("/activate-first-user")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> activateFirstUser() {
        List<User> pendingUsers = authService.getPendingUsers();
        if (pendingUsers.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "승인 대기 중인 사용자가 없습니다");
        }

        User firstPending = pendingUsers.get(0);
        User activated = authService.approveUser(firstPending.getId());
        activated = authService.updateUserRole(activated.getId(), "manager");

        return ResponseEntity.ok(ApiResponse.success(toUserResponse(activated)));
    }

    /**
     * GET /api/v1/auth/check-users
     * Returns all registered users.
     * Requires MANAGER or ADMIN role.
     */
    @GetMapping("/check-users")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<List<UserResponse>>> checkUsers() {
        List<User> users = authService.getAllUsers(null, null);
        List<UserResponse> response = users.stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // ---- Helper methods ----

    /**
     * Converts a User entity to a UserResponse DTO.
     */
    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .role(user.getRole())
                .positionTitle(user.getPositionTitle())
                .universityId(user.getUniversity() != null ? user.getUniversity().getId() : null)
                .universityName(user.getUniversity() != null ? user.getUniversity().getName() : null)
                .isActive(Boolean.TRUE.equals(user.getIsActive()))
                .attendanceShields(user.getAttendanceShields() != null ? user.getAttendanceShields() : 0)
                .createdAt(user.getCreatedAt())
                .build();
    }

    /**
     * Records auto-attendance for the user on login (KST date).
     * Silently skips if attendance for today already exists.
     */
    private void recordAutoAttendance(User user) {
        try {
            LocalDate todayKst = KstUtil.todayKst();
            if (attendanceRepository.findByUserIdAndDate(user.getId(), todayKst).isEmpty()) {
                Attendance attendance = new Attendance();
                attendance.setUser(user);
                attendance.setDate(todayKst);
                attendance.setStatus("present");
                attendance.setCreatedAt(OffsetDateTime.now(KstUtil.KST));
                attendanceRepository.save(attendance);
                log.debug("Auto-attendance recorded for user {} on {}", user.getId(), todayKst);
            }
        } catch (Exception e) {
            log.warn("Failed to record auto-attendance for user {}: {}", user.getId(), e.getMessage());
        }
    }

    /**
     * Sends a notification to all active managers about a new user registration.
     */
    private void notifyManagersNewUser(User newUser) {
        List<User> managers = userRepository.findByRole("manager");
        for (User manager : managers) {
            if (Boolean.TRUE.equals(manager.getIsActive())) {
                Notification notification = new Notification();
                notification.setUser(manager);
                notification.setNotificationType("new_user");
                notification.setTitle("새로운 팀원 가입");
                notification.setMessage(newUser.getFullName() + "님이 가입 승인을 요청했습니다");
                notification.setRelatedType("user");
                notification.setRelatedId(newUser.getId().intValue());
                notification.setIsRead(false);
                notificationRepository.save(notification);
                log.info("New user notification sent to manager {}: {}", manager.getId(), newUser.getFullName());
            }
        }
    }
}
