package com.fundmessenger.integration;

import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.user.entity.User;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * ============================================================================
 * 포지션 모듈 통합 테스트 (Position Module Integration Tests)
 * ============================================================================
 *
 * 포지션(보유 종목) CRUD, 정보 확인, 종료 등 핵심 비즈니스 로직을 테스트합니다.
 *
 * [테스트 대상 API]
 * - GET    /api/v1/positions          → 포지션 목록 조회 (필터링 가능)
 * - GET    /api/v1/positions/{id}     → 포지션 상세 조회
 * - PATCH  /api/v1/positions/{id}     → 포지션 수정 (팀장/관리자만)
 * - POST   /api/v1/positions/{id}/confirm → 정보 확인 (팀장만)
 * - POST   /api/v1/positions/{id}/close   → 포지션 종료 (팀장/관리자만)
 * - DELETE /api/v1/positions/{id}     → 포지션 삭제 (팀장/관리자만)
 *
 * [포지션 생명주기]
 * 1. 매수 요청 승인 → 포지션 자동 생성 (is_info_confirmed = false)
 * 2. 팀장이 실제 체결 정보 입력 → 정보 확인 완료 (is_info_confirmed = true)
 * 3. 포지션 종료 시 실제 청산 금액 입력 → 수익/손실(P&L) 자동 계산
 *
 * [포지션 상태]
 * - "open": 진행 중 (매매 가능)
 * - "closed": 종료됨 (수익률 확정)
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class PositionIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private PositionRepository positionRepository;

    /**
     * 테스트용 포지션 생성 헬퍼 메서드
     *
     * @param opener 포지션을 연 사용자 (보통 팀장)
     * @param ticker 종목 코드 (예: "005930", "AAPL")
     * @param market 시장 (예: "KRX", "NASDAQ")
     * @return 저장된 Position 엔티티
     */
    private Position createTestPosition(User opener, String ticker, String market) {
        Position position = new Position();
        position.setTicker(ticker);
        position.setTickerName(ticker + " Corp");
        position.setMarket(market);
        position.setStatus("open");
        position.setIsInfoConfirmed(false);                           // 정보 미확인 상태
        position.setAverageBuyPrice(new BigDecimal("50000"));         // 평균 매입가
        position.setTotalQuantity(new BigDecimal("100"));             // 총 수량
        position.setTotalBuyAmount(new BigDecimal("5000000"));        // 총 매입 금액
        position.setRealizedProfitLoss(BigDecimal.ZERO);              // 실현 손익
        position.setOpener(opener);
        position.setOpenedAt(OffsetDateTime.now());
        position.setCreatedAt(OffsetDateTime.now());
        position.setUpdatedAt(OffsetDateTime.now());
        return positionRepository.save(position);
    }

    /**
     * [테스트] 포지션 목록 조회 - 전체 목록 반환
     *
     * 인증된 사용자가 모든 포지션 목록을 조회합니다.
     * 응답에 positions 배열과 total 카운트가 포함됩니다.
     */
    @Test
    @DisplayName("GET /api/v1/positions - 포지션 목록 반환")
    void getPositions_authenticated_returnsList() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        createTestPosition(manager, "005930", "KRX");       // 삼성전자
        createTestPosition(manager, "AAPL", "NASDAQ");       // 애플

        mockMvc.perform(get("/api/v1/positions")
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.positions", hasSize(2)))
                .andExpect(jsonPath("$.data.total").value(2));
    }

    /**
     * [테스트] 포지션 상태 필터링 - status 파라미터로 필터링
     *
     * ?status=open 으로 요청하면 open 상태의 포지션만 반환됩니다.
     */
    @Test
    @DisplayName("GET /api/v1/positions?status=open - 상태별 필터링")
    void getPositions_filterByStatus_returnsFiltered() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        createTestPosition(manager, "005930", "KRX");  // open 상태

        // closed 상태 포지션 생성
        Position closed = createTestPosition(manager, "AAPL", "NASDAQ");
        closed.setStatus("closed");
        positionRepository.save(closed);

        mockMvc.perform(get("/api/v1/positions")
                        .param("status", "open")  // open만 필터링
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.positions", hasSize(1)))          // open 1개만
                .andExpect(jsonPath("$.data.positions[0].ticker").value("005930"));
    }

    /**
     * [테스트] 포지션 상세 조회 - ID로 조회
     *
     * 포지션의 모든 상세 정보를 반환합니다.
     * (ticker, market, status, average_buy_price 등)
     */
    @Test
    @DisplayName("GET /api/v1/positions/{id} - 포지션 상세 정보 반환")
    void getPosition_exists_returnsDetail() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        Position position = createTestPosition(manager, "005930", "KRX");

        mockMvc.perform(get("/api/v1/positions/" + position.getId())
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.ticker").value("005930"))
                .andExpect(jsonPath("$.data.market").value("KRX"))
                .andExpect(jsonPath("$.data.status").value("open"));
    }

    /**
     * [테스트] 존재하지 않는 포지션 조회 → 404 Not Found
     */
    @Test
    @DisplayName("GET /api/v1/positions/{id} - 없는 포지션은 404 반환")
    void getPosition_notFound_returns404() throws Exception {
        User manager = createManager("manager@test.com", "Manager");

        mockMvc.perform(get("/api/v1/positions/99999")  // 존재하지 않는 ID
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isNotFound());
    }

    /**
     * [테스트] 포지션 수정 - 팀장이 ticker_name과 average_buy_price 수정
     *
     * PATCH 요청으로 부분 업데이트가 가능합니다.
     * 팀장/관리자만 수정할 수 있습니다 (@PreAuthorize).
     */
    @Test
    @DisplayName("PATCH /api/v1/positions/{id} - 팀장이 포지션 수정")
    void updatePosition_manager_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        Position position = createTestPosition(manager, "005930", "KRX");

        mockMvc.perform(patch("/api/v1/positions/" + position.getId())
                        .header("Authorization", bearerToken(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ticker_name", "Samsung Electronics",  // 종목명 변경
                                "average_buy_price", 52000             // 평균가 변경
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 종목명이 업데이트되었는지 검증
        Position updated = positionRepository.findById(position.getId()).orElseThrow();
        Assertions.assertEquals("Samsung Electronics", updated.getTickerName());
    }

    /**
     * [테스트] 일반 팀원이 포지션 수정 → 403 Forbidden
     *
     * member 역할은 포지션을 수정할 수 없습니다.
     */
    @Test
    @DisplayName("PATCH /api/v1/positions/{id} - 팀원은 403 반환")
    void updatePosition_member_returns403() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        User member = createMember("member@test.com", "Member");
        Position position = createTestPosition(manager, "005930", "KRX");

        mockMvc.perform(patch("/api/v1/positions/" + position.getId())
                        .header("Authorization", bearerToken(member))  // 팀원 토큰으로 시도
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ticker_name", "Hacked"
                        ))))
                .andExpect(status().isForbidden());
    }

    /**
     * [테스트] 포지션 정보 확인 - 팀장이 실제 체결 정보 입력
     *
     * 비즈니스 플로우:
     * 1. 매수 요청 승인 시 포지션 생성 (is_info_confirmed = false)
     * 2. 팀장이 실제 증권사에서 체결된 가격/수량을 확인하여 입력
     * 3. is_info_confirmed = true로 변경됨
     *
     * 미확인 포지션은 프론트엔드에서 노란 느낌표 아이콘으로 표시됩니다.
     */
    @Test
    @DisplayName("POST /api/v1/positions/{id}/confirm - 팀장이 정보 확인")
    void confirmPosition_manager_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        Position position = createTestPosition(manager, "005930", "KRX");

        mockMvc.perform(post("/api/v1/positions/" + position.getId() + "/confirm")
                        .header("Authorization", bearerToken(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "average_buy_price", 51000,  // 실제 체결 평균가
                                "total_quantity", 100        // 실제 체결 수량
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 정보 확인 상태가 true로 변경되었는지 검증
        Position confirmed = positionRepository.findById(position.getId()).orElseThrow();
        Assertions.assertTrue(confirmed.getIsInfoConfirmed());
    }

    /**
     * [테스트] 포지션 종료 - 팀장이 실제 청산 금액 입력 → 수익률 자동 계산
     *
     * 비즈니스 플로우:
     * 1. 팀장이 POST /close 호출 (총 매도 금액, 평균 매도가 입력)
     * 2. 포지션 상태 → "closed"
     * 3. 수익/손실(profit_loss) = 총매도금액 - 총매입금액
     * 4. 수익률(profit_rate) = (수익/손실 / 총매입금액) × 100
     *
     * 예시: 매입 500만원 → 매도 600만원 = +100만원 (+20%)
     */
    @Test
    @DisplayName("POST /api/v1/positions/{id}/close - 포지션 종료 및 수익 계산")
    void closePosition_manager_calculatesProfit() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        Position position = createTestPosition(manager, "005930", "KRX");
        // 포지션: 총매입 5,000,000원

        mockMvc.perform(post("/api/v1/positions/" + position.getId() + "/close")
                        .header("Authorization", bearerToken(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "total_sell_amount", 6000000,  // 총 매도 금액 (600만원)
                                "average_sell_price", 60000    // 평균 매도가 (6만원)
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 종료 상태 + 수익 정보 검증
        Position closed = positionRepository.findById(position.getId()).orElseThrow();
        Assertions.assertEquals("closed", closed.getStatus());
        Assertions.assertNotNull(closed.getProfitLoss());    // 수익/손실 금액
        Assertions.assertNotNull(closed.getProfitRate());    // 수익률 (%)
    }

    /**
     * [테스트] 포지션 삭제 - 팀장이 포지션 삭제
     *
     * 삭제된 포지션은 DB에서 완전히 제거됩니다.
     * 관련된 의사결정 노트, 매매 계획 등도 함께 정리됩니다.
     */
    @Test
    @DisplayName("DELETE /api/v1/positions/{id} - 팀장이 포지션 삭제")
    void deletePosition_manager_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        Position position = createTestPosition(manager, "005930", "KRX");

        mockMvc.perform(delete("/api/v1/positions/" + position.getId())
                        .header("Authorization", bearerToken(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 포지션이 삭제되었는지 검증
        Assertions.assertFalse(positionRepository.findById(position.getId()).isPresent());
    }
}
