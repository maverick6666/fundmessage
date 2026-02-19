package com.fundmessenger.integration;

import org.junit.jupiter.api.*;
import org.springframework.test.annotation.DirtiesContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * ============================================================================
 * 헬스체크 및 보안 기본 테스트 (Health Check & Security Basics)
 * ============================================================================
 *
 * 서버의 기본적인 동작 상태와 Spring Security 설정이 올바르게 적용되었는지 검증합니다.
 *
 * [테스트 목적]
 * 1. Actuator 헬스 엔드포인트가 인증 없이 접근 가능한지 확인
 * 2. 보호된 API 엔드포인트가 인증 없이 접근 시 401을 반환하는지 확인
 * 3. 공개(public) API 엔드포인트가 인증 없이도 접근 가능한지 확인
 *
 * [SecurityConfig에서 공개 설정된 경로]
 * - /api/v1/auth/** → 회원가입, 로그인 등 인증 관련 (permitAll)
 * - /ws/**           → WebSocket 연결 (permitAll)
 * - /health          → 헬스체크 (permitAll)
 * - /actuator/**     → Actuator 모니터링 (permitAll)
 *
 * @DirtiesContext: 각 테스트 메서드 후 Spring 컨텍스트를 재생성합니다.
 *   (테스트 간 DB 상태 오염 방지)
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class HealthCheckTest extends BaseIntegrationTest {

    /**
     * [테스트] Actuator 헬스 엔드포인트 - 인증 없이 200 반환
     *
     * GET /actuator/health 는 서버 상태를 확인하는 모니터링 엔드포인트입니다.
     * SecurityConfig에서 permitAll로 설정되어 있으므로, 인증 없이도 접근 가능해야 합니다.
     *
     * 참고: application-test.yaml에서 mail.health.enabled=false로 설정하여
     * 테스트 환경에서 SMTP 연결 실패로 인한 503 에러를 방지합니다.
     */
    @Test
    @DisplayName("GET /actuator/health - 인증 없이 200 반환 확인")
    void actuatorHealth_noAuth_returns200() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    /**
     * [테스트] 보호된 엔드포인트 - 인증 없이 접근 시 401 반환
     *
     * GET /api/v1/positions 는 인증이 필요한 API입니다.
     * Authorization 헤더 없이 요청하면 Spring Security가 401 Unauthorized를 반환해야 합니다.
     *
     * 이 테스트는 SecurityConfig의 .anyRequest().authenticated() 설정과
     * HttpStatusEntryPoint(UNAUTHORIZED) 설정이 올바르게 동작하는지 확인합니다.
     */
    @Test
    @DisplayName("GET /api/v1/positions - 인증 없으면 401 반환 확인")
    void protectedEndpoint_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/positions"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * [테스트] 공개 인증 엔드포인트 - 인증 없이 접근 가능 확인
     *
     * POST /api/v1/auth/signup 는 회원가입 API로, 인증 없이 접근 가능해야 합니다.
     * 빈 JSON body("{}")를 보내면 유효성 검증 실패(422)가 발생하지만,
     * 401(인증 필요)은 반환되지 않아야 합니다.
     *
     * 즉, "인증 관련 에러가 아닌 다른 에러" = 인증 없이 접근 가능함을 의미합니다.
     */
    @Test
    @DisplayName("POST /api/v1/auth/signup - 공개 엔드포인트 접근 가능 확인")
    void authEndpoint_noAuth_isAccessible() throws Exception {
        // body가 비어있으므로 유효성 검증 실패(422)가 예상되나, 401은 아니어야 함
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().is(org.hamcrest.Matchers.not(401)));
    }
}
