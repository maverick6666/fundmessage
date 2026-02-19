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
 * 사용자 모듈 통합 테스트 (User Module Integration Tests)
 * ============================================================================
 *
 * 사용자 조회, 역할 관리, 승인/비활성화 등 사용자 관리 API를 테스트합니다.
 *
 * [테스트 대상 API]
 * - GET    /api/v1/users/me           → 현재 로그인한 사용자 정보 조회
 * - GET    /api/v1/users/team-members → 활성 팀원 목록 조회 (전체 역할 가능)
 * - GET    /api/v1/users              → 전체 사용자 목록 (팀장/관리자만)
 * - GET    /api/v1/users/pending      → 승인 대기 사용자 목록 (팀장/관리자만)
 * - POST   /api/v1/users/{id}/approve → 사용자 승인 (팀장/관리자만)
 * - PATCH  /api/v1/users/{id}/role    → 역할 변경 (팀장만)
 * - POST   /api/v1/users/{id}/deactivate → 사용자 비활성화 (팀장만)
 *
 * [역할 기반 접근 제어]
 * - manager (팀장): 모든 사용자 관리 기능 사용 가능
 * - admin (관리자): 승인, 조회 가능 / 역할 변경, 비활성화 불가
 * - member (팀원): /me, /team-members만 접근 가능, 나머지는 403
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class UserIntegrationTest extends BaseIntegrationTest {

    /**
     * [테스트] 현재 사용자 정보 조회 (GET /me)
     *
     * JWT 토큰으로 인증된 사용자의 프로필 정보를 반환합니다.
     * 응답에 email, full_name, role 등이 포함됩니다.
     */
    @Test
    @DisplayName("GET /api/v1/users/me - 현재 사용자 정보 반환")
    void getMe_authenticated_returnsCurrentUser() throws Exception {
        User manager = createManager("me@test.com", "Me User");

        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("me@test.com"))
                .andExpect(jsonPath("$.data.full_name").value("Me User"))
                .andExpect(jsonPath("$.data.role").value("manager"));
    }

    /**
     * [테스트] 인증 없이 /me 접근 → 401 Unauthorized
     *
     * Authorization 헤더가 없으면 Spring Security가 401을 반환합니다.
     */
    @Test
    @DisplayName("GET /api/v1/users/me - 인증 없으면 401 반환")
    void getMe_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * [테스트] 활성 팀원 목록 조회 (GET /team-members)
     *
     * is_active = true인 사용자만 반환합니다.
     * 비활성(승인 대기) 사용자는 목록에 포함되지 않습니다.
     *
     * 테스트 시나리오:
     * - 팀장 1명 + 활성 팀원 2명 + 비활성 팀원 1명 생성
     * - 결과: 3명만 반환 (비활성 1명 제외)
     */
    @Test
    @DisplayName("GET /api/v1/users/team-members - 활성 팀원만 반환")
    void getTeamMembers_returnsActiveUsers() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        createMember("member1@test.com", "Member 1");
        createMember("member2@test.com", "Member 2");

        // 비활성 사용자 생성 (이 사용자는 목록에서 제외되어야 함)
        User inactive = createMember("inactive@test.com", "Inactive");
        inactive.setIsActive(false);
        userRepository.save(inactive);

        mockMvc.perform(get("/api/v1/users/team-members")
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.members", hasSize(3))); // 팀장 + 활성 팀원 2명
    }

    /**
     * [테스트] 전체 사용자 목록 조회 - 팀장(manager)만 가능
     *
     * @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")으로 보호됩니다.
     * 팀장은 활성/비활성 포함 모든 사용자를 조회할 수 있습니다.
     */
    @Test
    @DisplayName("GET /api/v1/users - 팀장은 전체 사용자 목록 조회 가능")
    void getUsers_managerRole_returnsAll() throws Exception {
        User manager = createManager("admin@test.com", "Admin");
        createMember("user1@test.com", "User 1");
        createMember("user2@test.com", "User 2");

        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.users", hasSize(3)));  // 팀장 + 팀원 2명
    }

    /**
     * [테스트] 일반 팀원이 전체 사용자 목록 조회 → 403 Forbidden
     *
     * member 역할은 /api/v1/users에 접근할 수 없습니다.
     */
    @Test
    @DisplayName("GET /api/v1/users - 팀원은 403 반환")
    void getUsers_memberRole_returns403() throws Exception {
        User member = createMember("member@test.com", "Member");

        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", bearerToken(member)))
                .andExpect(status().isForbidden());
    }

    /**
     * [테스트] 사용자 승인 - 팀장이 대기 중인 사용자를 활성화
     *
     * 비즈니스 플로우:
     * 1. 새 사용자가 회원가입 (is_active = false)
     * 2. 팀장이 POST /approve 호출
     * 3. 사용자가 활성화됨 (is_active = true, 로그인 가능)
     */
    @Test
    @DisplayName("POST /api/v1/users/{id}/approve - 팀장이 사용자 승인")
    void approveUser_manager_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");

        // 승인 대기 중인 사용자 생성
        User pending = createMember("pending@test.com", "Pending");
        pending.setIsActive(false);  // 비활성 상태
        userRepository.save(pending);

        // 팀장이 승인
        mockMvc.perform(post("/api/v1/users/" + pending.getId() + "/approve")
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 활성 상태로 변경되었는지 검증
        User approved = userRepository.findById(pending.getId()).orElseThrow();
        Assertions.assertTrue(approved.getIsActive());
    }

    /**
     * [테스트] 역할 변경 - 팀장이 팀원의 역할을 admin으로 변경
     *
     * 주의: manager(팀장)로는 직접 변경 불가 (팀장 이전 기능 사용 필요)
     */
    @Test
    @DisplayName("PATCH /api/v1/users/{id}/role - 팀장이 역할 변경")
    void updateRole_manager_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        User member = createMember("member@test.com", "Member");

        mockMvc.perform(patch("/api/v1/users/" + member.getId() + "/role")
                        .header("Authorization", bearerToken(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("role", "admin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 역할이 admin으로 변경되었는지 검증
        User updated = userRepository.findById(member.getId()).orElseThrow();
        Assertions.assertEquals("admin", updated.getRole());
    }

    /**
     * [테스트] 사용자 비활성화 - 팀장이 팀원을 비활성화
     *
     * 비활성화된 사용자는 로그인할 수 없습니다.
     * 자기 자신은 비활성화 불가.
     */
    @Test
    @DisplayName("POST /api/v1/users/{id}/deactivate - 팀장이 사용자 비활성화")
    void deactivateUser_manager_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        User member = createMember("member@test.com", "Member");

        mockMvc.perform(post("/api/v1/users/" + member.getId() + "/deactivate")
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 비활성 상태로 변경되었는지 검증
        User deactivated = userRepository.findById(member.getId()).orElseThrow();
        Assertions.assertFalse(deactivated.getIsActive());
    }

    /**
     * [테스트] 승인 대기 사용자 목록 조회 (GET /pending)
     *
     * is_active = false인 사용자 목록을 반환합니다.
     * 팀장/관리자만 접근 가능합니다.
     */
    @Test
    @DisplayName("GET /api/v1/users/pending - 승인 대기 사용자 목록")
    void getPendingUsers_manager_returnsPending() throws Exception {
        User manager = createManager("manager@test.com", "Manager");

        // 승인 대기 사용자 2명 생성
        User pending1 = createMember("pending1@test.com", "Pending1");
        pending1.setIsActive(false);
        userRepository.save(pending1);

        User pending2 = createMember("pending2@test.com", "Pending2");
        pending2.setIsActive(false);
        userRepository.save(pending2);

        mockMvc.perform(get("/api/v1/users/pending")
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.users", hasSize(2)));
    }
}
