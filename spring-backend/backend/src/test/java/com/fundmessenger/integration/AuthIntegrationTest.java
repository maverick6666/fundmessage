package com.fundmessenger.integration;

import com.fundmessenger.user.entity.User;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * ============================================================================
 * 인증 모듈 통합 테스트 (Auth Module Integration Tests)
 * ============================================================================
 *
 * 회원가입, 로그인, 토큰 갱신 등 인증 관련 API를 테스트합니다.
 *
 * [테스트 대상 API]
 * - POST /api/v1/auth/signup   → 회원가입
 * - POST /api/v1/auth/login    → 로그인 (JWT 토큰 발급)
 * - POST /api/v1/auth/refresh  → 리프레시 토큰으로 새 토큰 발급
 *
 * [비즈니스 규칙]
 * - 첫 번째 가입자: 자동으로 manager(팀장) 역할, 즉시 활성화 (바로 로그인 가능)
 * - 이후 가입자: member(팀원) 역할, 비활성 상태 (팀장 승인 필요)
 * - 이메일 중복 가입 불가 (409 Conflict)
 * - 비밀번호 8자 이상, 이메일 형식 검증 (422 Unprocessable Entity)
 * - 비활성 사용자 로그인 차단 (403 Forbidden)
 *
 * [응답 구조]
 * 성공: { "success": true, "data": { ... }, "message": "..." }
 * 실패: { "detail": "에러 메시지" }
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class AuthIntegrationTest extends BaseIntegrationTest {

    /**
     * [테스트] 첫 번째 사용자 회원가입 → 자동으로 팀장(manager) 역할 부여
     *
     * DB에 사용자가 없는 상태에서 회원가입하면:
     * - 201 Created 응답
     * - requires_approval = false (승인 불필요, 바로 사용 가능)
     * - role = "manager" (첫 사용자는 자동으로 팀장)
     * - is_active = true (즉시 활성화)
     */
    @Test
    @DisplayName("POST /api/v1/auth/signup - 첫 사용자는 팀장(manager)으로 등록")
    void signup_firstUser_becomesManager() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "first@test.com",
                                "password", "password123",
                                "full_name", "First User"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.requires_approval").value(false));

        // DB에서 직접 확인: 역할이 manager이고, 활성 상태인지 검증
        User user = userRepository.findByEmail("first@test.com").orElseThrow();
        Assertions.assertEquals("manager", user.getRole());
        Assertions.assertTrue(user.getIsActive());
    }

    /**
     * [테스트] 두 번째 이후 사용자 회원가입 → 팀장 승인 필요
     *
     * 이미 사용자가 존재하는 상태에서 회원가입하면:
     * - 201 Created 응답
     * - requires_approval = true (팀장의 승인이 필요)
     * - role = "member" (일반 팀원)
     * - is_active = false (비활성 상태 - 로그인 불가)
     */
    @Test
    @DisplayName("POST /api/v1/auth/signup - 두 번째 사용자는 팀장 승인 필요")
    void signup_secondUser_requiresApproval() throws Exception {
        // 먼저 첫 번째 사용자(팀장) 생성
        createManager("manager@test.com", "Manager");

        // 두 번째 사용자 회원가입
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "member@test.com",
                                "password", "password123",
                                "full_name", "New Member"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.requires_approval").value(true));

        // DB 확인: member 역할, 비활성 상태
        User user = userRepository.findByEmail("member@test.com").orElseThrow();
        Assertions.assertEquals("member", user.getRole());
        Assertions.assertFalse(user.getIsActive());
    }

    /**
     * [테스트] 이메일 중복 가입 시 409 Conflict 반환
     *
     * 이미 등록된 이메일로 다시 가입하려고 하면 409 에러가 발생합니다.
     */
    @Test
    @DisplayName("POST /api/v1/auth/signup - 중복 이메일은 409 반환")
    void signup_duplicateEmail_returns409() throws Exception {
        // 기존 사용자 생성
        createManager("existing@test.com", "Existing");

        // 같은 이메일로 다시 가입 시도 → 409 Conflict
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "existing@test.com",
                                "password", "password123",
                                "full_name", "Duplicate"
                        ))))
                .andExpect(status().isConflict());
    }

    /**
     * [테스트] 올바른 자격증명으로 로그인 → JWT 토큰 발급
     *
     * 활성 사용자가 올바른 이메일/비밀번호로 로그인하면:
     * - 200 OK 응답
     * - access_token: API 호출에 사용하는 단기 토큰 (기본 60분)
     * - refresh_token: 토큰 갱신에 사용하는 장기 토큰 (기본 30일)
     * - token_type: "Bearer"
     * - user: 로그인한 사용자 정보 (email, role 등)
     */
    @Test
    @DisplayName("POST /api/v1/auth/login - 올바른 자격증명으로 토큰 발급")
    void login_validCredentials_returnsTokens() throws Exception {
        createManager("login@test.com", "Login User");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "login@test.com",
                                "password", "password123"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.access_token").isNotEmpty())   // JWT 액세스 토큰
                .andExpect(jsonPath("$.data.refresh_token").isNotEmpty())  // JWT 리프레시 토큰
                .andExpect(jsonPath("$.data.token_type").value("Bearer"))  // 토큰 타입
                .andExpect(jsonPath("$.data.user.email").value("login@test.com"))
                .andExpect(jsonPath("$.data.user.role").value("manager"));
    }

    /**
     * [테스트] 잘못된 비밀번호로 로그인 → 401 Unauthorized
     */
    @Test
    @DisplayName("POST /api/v1/auth/login - 잘못된 비밀번호는 401 반환")
    void login_invalidCredentials_returns401() throws Exception {
        createManager("login@test.com", "Login User");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "login@test.com",
                                "password", "wrongpassword"  // 틀린 비밀번호
                        ))))
                .andExpect(status().isUnauthorized());
    }

    /**
     * [테스트] 비활성(승인 대기) 사용자 로그인 → 403 Forbidden
     *
     * 팀장이 아직 승인하지 않은 사용자는 로그인할 수 없습니다.
     * (is_active = false 상태)
     */
    @Test
    @DisplayName("POST /api/v1/auth/login - 비활성 사용자는 403 반환")
    void login_inactiveUser_returns403() throws Exception {
        // 사용자 생성 후 비활성화 (팀장 미승인 상태를 시뮬레이션)
        User user = createMember("inactive@test.com", "Inactive");
        user.setIsActive(false);
        userRepository.save(user);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "inactive@test.com",
                                "password", "password123"
                        ))))
                .andExpect(status().isForbidden());
    }

    /**
     * [테스트] 유효한 리프레시 토큰으로 새 토큰 발급
     *
     * 액세스 토큰이 만료되었을 때, 리프레시 토큰을 사용하여 새 토큰 쌍을 발급받습니다.
     * - 200 OK 응답
     * - 새로운 access_token과 refresh_token 반환
     */
    @Test
    @DisplayName("POST /api/v1/auth/refresh - 유효한 리프레시 토큰으로 새 토큰 발급")
    void refresh_validToken_returnsNewTokens() throws Exception {
        User manager = createManager("refresh@test.com", "Refresh User");
        String refreshToken = jwtTokenProvider.createRefreshToken(manager.getId());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "refresh_token", refreshToken
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.access_token").isNotEmpty())
                .andExpect(jsonPath("$.data.refresh_token").isNotEmpty());
    }

    /**
     * [테스트] 잘못된 리프레시 토큰 → 401 Unauthorized
     *
     * 유효하지 않은(위조된) 리프레시 토큰으로 갱신을 시도하면 401이 반환됩니다.
     */
    @Test
    @DisplayName("POST /api/v1/auth/refresh - 잘못된 토큰은 401 반환")
    void refresh_invalidToken_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "refresh_token", "invalid.token.here"
                        ))))
                .andExpect(status().isUnauthorized());
    }

    /**
     * [테스트] 유효하지 않은 입력값으로 회원가입 → 422 Unprocessable Entity
     *
     * 유효성 검증 규칙:
     * - email: 올바른 이메일 형식 필요 (@Email)
     * - password: 8자 이상 필요 (@Size(min=8))
     * - full_name: 2자 이상, 빈값 불가 (@NotBlank, @Size(min=2))
     */
    @Test
    @DisplayName("POST /api/v1/auth/signup - 유효성 검증 실패 시 422 반환")
    void signup_invalidInput_returns422() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "not-an-email",    // 이메일 형식 아님
                                "password", "short",         // 8자 미만
                                "full_name", ""              // 빈 문자열
                        ))))
                .andExpect(status().isUnprocessableEntity());
    }
}
