package com.fundmessenger.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fundmessenger.common.security.JwtTokenProvider;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

/**
 * ============================================================================
 * 통합 테스트 기본 클래스 (Base Integration Test)
 * ============================================================================
 *
 * 모든 통합 테스트의 공통 설정과 유틸리티 메서드를 제공하는 추상 클래스입니다.
 *
 * [테스트 환경 설정]
 * - @SpringBootTest: 실제 Spring Boot 앱을 랜덤 포트로 구동합니다.
 *   (전체 컨텍스트 로드 → 실제 서비스, 리포지토리, 컨트롤러 모두 동작)
 * - @AutoConfigureMockMvc: MockMvc를 자동 설정하여 HTTP 요청을 시뮬레이션합니다.
 *   (실제 서버를 띄우지 않고도 컨트롤러 테스트 가능)
 * - @ActiveProfiles("test"): application-test.yaml 설정을 사용합니다.
 *   (H2 인메모리 DB, 테스트용 JWT Secret 등)
 *
 * [H2 데이터베이스]
 * - PostgreSQL 호환 모드로 동작 (MODE=PostgreSQL)
 * - schema-h2.sql에서 TIMESTAMPTZ, JSONB 타입 별칭 생성
 * - 테스트마다 create-drop으로 스키마 초기화
 *
 * [제공하는 헬퍼 메서드]
 * - createManager(): 팀장(manager) 역할의 테스트 사용자 생성
 * - createMember(): 팀원(member) 역할의 테스트 사용자 생성
 * - getAccessToken(): 사용자의 JWT 액세스 토큰 생성
 * - bearerToken(): "Bearer {token}" 형식의 인증 헤더 값 생성
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class BaseIntegrationTest {

    /** MockMvc - HTTP 요청을 시뮬레이션하는 테스트 도구 */
    @Autowired
    protected MockMvc mockMvc;

    /** ObjectMapper - Java 객체 ↔ JSON 변환 (SNAKE_CASE 설정 적용됨) */
    @Autowired
    protected ObjectMapper objectMapper;

    /** UserRepository - 테스트 사용자 생성/조회에 사용 */
    @Autowired
    protected UserRepository userRepository;

    /** JwtTokenProvider - 테스트용 JWT 토큰 생성에 사용 */
    @Autowired
    protected JwtTokenProvider jwtTokenProvider;

    /** PasswordEncoder - 비밀번호 해싱에 사용 (BCrypt) */
    @Autowired
    protected PasswordEncoder passwordEncoder;

    /**
     * 테스트용 팀장(manager) 사용자를 생성합니다.
     *
     * - role: "manager" (요청 승인/거부, 포지션 관리 등 모든 권한)
     * - isActive: true (바로 로그인 가능)
     * - 비밀번호: "password123" (모든 테스트 사용자 공통)
     *
     * @param email    사용자 이메일 (예: "manager@test.com")
     * @param fullName 사용자 이름 (예: "Manager")
     * @return 저장된 User 엔티티
     */
    protected User createManager(String email, String fullName) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(email.split("@")[0]);  // 이메일 앞부분을 username으로 사용
        user.setPasswordHash(passwordEncoder.encode("password123"));
        user.setFullName(fullName);
        user.setRole("manager");
        user.setIsActive(true);
        user.setAttendanceShields(0);
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    /**
     * 테스트용 팀원(member) 사용자를 생성합니다.
     *
     * - role: "member" (매수/매도 요청만 가능, 승인 권한 없음)
     * - isActive: true (바로 로그인 가능)
     * - 비밀번호: "password123" (모든 테스트 사용자 공통)
     *
     * @param email    사용자 이메일 (예: "member@test.com")
     * @param fullName 사용자 이름 (예: "Member")
     * @return 저장된 User 엔티티
     */
    protected User createMember(String email, String fullName) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(email.split("@")[0]);
        user.setPasswordHash(passwordEncoder.encode("password123"));
        user.setFullName(fullName);
        user.setRole("member");
        user.setIsActive(true);
        user.setAttendanceShields(0);
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    /**
     * 주어진 사용자의 JWT 액세스 토큰을 생성합니다.
     * 테스트에서 인증이 필요한 API 호출 시 사용됩니다.
     *
     * @param user 토큰을 생성할 사용자
     * @return JWT 액세스 토큰 문자열
     */
    protected String getAccessToken(User user) {
        return jwtTokenProvider.createAccessToken(user.getId());
    }

    /**
     * "Bearer {token}" 형식의 Authorization 헤더 값을 반환합니다.
     * MockMvc 요청에서 .header("Authorization", bearerToken(user)) 형태로 사용합니다.
     *
     * @param user 인증할 사용자
     * @return "Bearer {JWT토큰}" 문자열
     */
    protected String bearerToken(User user) {
        return "Bearer " + getAccessToken(user);
    }
}
