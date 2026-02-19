package com.fundmessenger;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * ============================================================================
 * Spring Boot 애플리케이션 컨텍스트 로드 테스트
 * ============================================================================
 *
 * Spring Boot 앱이 정상적으로 시작되는지 확인하는 기본 테스트입니다.
 *
 * [검증 항목]
 * - 모든 Bean이 정상적으로 생성되는지 확인
 * - DI(의존성 주입)가 올바르게 설정되어 있는지 확인
 * - JPA Entity 매핑에 오류가 없는지 확인
 * - application-test.yaml 설정이 유효한지 확인
 *
 * @ActiveProfiles("test"): application-test.yaml 사용 (H2 인메모리 DB)
 *   운영 DB(PostgreSQL) 연결 없이도 테스트 가능
 */
@SpringBootTest
@ActiveProfiles("test")
class FundmessengerApplicationTests {

    /**
     * [테스트] 컨텍스트 로드 테스트
     *
     * 이 테스트가 통과하면 Spring Boot 앱의 모든 설정이 정상임을 의미합니다.
     * 별도의 assert 없이, 예외 없이 컨텍스트가 로드되면 성공입니다.
     */
    @Test
    void contextLoads() {
        // Spring 컨텍스트가 예외 없이 로드되면 테스트 통과
    }
}
