package com.fundmessenger.integration;

import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.request.entity.TradeRequest;
import com.fundmessenger.request.repository.TradeRequestRepository;
import com.fundmessenger.user.entity.User;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * ============================================================================
 * 요청 모듈 통합 테스트 (Request Module Integration Tests)
 * ============================================================================
 *
 * 매수/매도 요청의 생성, 목록 조회, 승인, 거부 등 핵심 워크플로우를 테스트합니다.
 *
 * [테스트 대상 API]
 * - POST /api/v1/requests/buy           → 매수 요청 생성 (팀원이 제출)
 * - POST /api/v1/requests/sell          → 매도 요청 생성 (팀원이 제출)
 * - GET  /api/v1/requests               → 요청 목록 조회
 * - POST /api/v1/requests/{id}/approve  → 요청 승인 (팀장만)
 * - POST /api/v1/requests/{id}/reject   → 요청 거부 (팀장만)
 *
 * [비즈니스 플로우]
 * 1. 팀원이 매수/매도 요청 제출 → status: "pending"
 * 2. 팀장이 승인/거부/토론 개시 결정
 *    - 승인: status → "approved", 포지션 자동 생성/업데이트
 *    - 거부: status → "rejected", 거부 사유 기록
 *    - 토론: status → "discussion", Discussion 엔티티 생성
 *
 * [요청 타입]
 * - "buy": 매수 요청 (종목, 금액/수량, 목표가 등 포함)
 * - "sell": 매도 요청 (포지션 ID, 매도 수량/가격, 사유 포함)
 *
 * [응답 구조]
 * 생성 성공: { "success": true, "data": { "request": { ... } } }
 *           ※ data 안에 "request" 키로 래핑됨에 주의
 * 목록:     { "success": true, "data": { "requests": [...], "total": N } }
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class RequestIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private TradeRequestRepository tradeRequestRepository;

    @Autowired
    private PositionRepository positionRepository;

    /**
     * [테스트] 매수 요청 생성 - 팀원이 매수 요청을 제출
     *
     * 요청 필드:
     * - target_ticker: 종목 코드 (예: "005930")
     * - ticker_name: 종목명 (예: "Samsung")
     * - target_market: 시장 (예: "KRX")
     * - order_type: 주문 유형 ("amount" = 금액 기준, "quantity" = 수량 기준)
     * - order_amount: 주문 금액 (order_type이 "amount"일 때)
     * - memo: 매수 근거/메모
     *
     * 응답: data.request.request_type = "buy", data.request.status = "pending"
     */
    @Test
    @DisplayName("POST /api/v1/requests/buy - 팀원이 매수 요청 생성")
    void createBuyRequest_member_success() throws Exception {
        User member = createMember("member@test.com", "Member");

        mockMvc.perform(post("/api/v1/requests/buy")
                        .header("Authorization", bearerToken(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "target_ticker", "005930",         // 종목 코드
                                "ticker_name", "Samsung",          // 종목명
                                "target_market", "KRX",            // 시장
                                "order_type", "amount",            // 금액 기준 주문
                                "order_amount", 5000000,           // 500만원
                                "memo", "Good entry point"         // 매수 근거
                        ))))
                .andExpect(status().isCreated())                    // 201 Created
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.request.request_type").value("buy"))
                .andExpect(jsonPath("$.data.request.status").value("pending"));
    }

    /**
     * [테스트] 매도 요청 생성 - 팀원이 기존 포지션에 대해 매도 요청 제출
     *
     * 매도 요청은 반드시 기존 open 포지션이 있어야 합니다.
     * 요청 필드:
     * - position_id: 매도할 포지션 ID
     * - sell_quantity: 매도 수량
     * - sell_price: 목표 매도가
     * - sell_reason: 매도 사유
     */
    @Test
    @DisplayName("POST /api/v1/requests/sell - 팀원이 매도 요청 생성")
    void createSellRequest_member_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        User member = createMember("member@test.com", "Member");

        // 먼저 open 상태의 포지션 생성 (매도할 대상)
        Position position = new Position();
        position.setTicker("005930");
        position.setTickerName("Samsung");
        position.setMarket("KRX");
        position.setStatus("open");
        position.setIsInfoConfirmed(true);
        position.setAverageBuyPrice(new BigDecimal("50000"));
        position.setTotalQuantity(new BigDecimal("100"));
        position.setTotalBuyAmount(new BigDecimal("5000000"));
        position.setRealizedProfitLoss(BigDecimal.ZERO);
        position.setOpener(manager);
        position.setOpenedAt(OffsetDateTime.now());
        position.setCreatedAt(OffsetDateTime.now());
        position.setUpdatedAt(OffsetDateTime.now());
        position = positionRepository.save(position);

        mockMvc.perform(post("/api/v1/requests/sell")
                        .header("Authorization", bearerToken(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "position_id", position.getId(),   // 매도할 포지션
                                "sell_quantity", 50,                // 50주 매도
                                "sell_price", 55000,                // 목표 매도가 55,000원
                                "sell_reason", "Take profit"        // 매도 사유: 익절
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.request.request_type").value("sell"))
                .andExpect(jsonPath("$.data.request.status").value("pending"));
    }

    /**
     * [테스트] 요청 목록 조회 - 인증된 사용자가 요청 목록 확인
     *
     * 페이지네이션 지원: page, limit 파라미터
     * 필터링 지원: status, request_type, requester_id 파라미터
     */
    @Test
    @DisplayName("GET /api/v1/requests - 요청 목록 반환")
    void getRequests_authenticated_returnsList() throws Exception {
        User member = createMember("member@test.com", "Member");

        // 직접 DB에 요청 생성 (API를 거치지 않고)
        TradeRequest request = new TradeRequest();
        request.setRequester(member);
        request.setRequestType("buy");
        request.setTargetTicker("005930");
        request.setTickerName("Samsung");
        request.setTargetMarket("KRX");
        request.setOrderType("amount");
        request.setOrderAmount(new BigDecimal("5000000"));
        request.setStatus("pending");
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());
        tradeRequestRepository.save(request);

        mockMvc.perform(get("/api/v1/requests")
                        .header("Authorization", bearerToken(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.requests", hasSize(1)));
    }

    /**
     * [테스트] 요청 승인 - 팀장이 매수 요청을 승인하면 포지션 자동 생성
     *
     * 승인 시 팀장이 실제 체결 정보를 입력합니다:
     * - executed_price: 실제 체결 가격
     * - executed_quantity: 실제 체결 수량
     *
     * 승인 결과:
     * - 요청 status → "approved"
     * - 새 포지션 자동 생성 (또는 기존 포지션에 추가)
     */
    @Test
    @DisplayName("POST /api/v1/requests/{id}/approve - 팀장 승인 시 포지션 생성")
    void approveBuyRequest_manager_createsPosition() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        User member = createMember("member@test.com", "Member");

        // 매수 요청 생성
        TradeRequest request = new TradeRequest();
        request.setRequester(member);
        request.setRequestType("buy");
        request.setTargetTicker("AAPL");
        request.setTickerName("Apple Inc.");
        request.setTargetMarket("NASDAQ");
        request.setOrderType("quantity");
        request.setOrderQuantity(new BigDecimal("10"));
        request.setBuyPrice(new BigDecimal("150"));
        request.setStatus("pending");
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());
        request = tradeRequestRepository.save(request);

        // 팀장이 승인 (실제 체결 정보 입력)
        mockMvc.perform(post("/api/v1/requests/" + request.getId() + "/approve")
                        .header("Authorization", bearerToken(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "executed_price", 149.50,   // 실제 체결가
                                "executed_quantity", 10      // 실제 체결 수량
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 요청 상태가 "approved"로 변경되었는지
        TradeRequest approved = tradeRequestRepository.findById(request.getId()).orElseThrow();
        Assertions.assertEquals("approved", approved.getStatus());

        // DB 확인: 포지션이 자동 생성되었는지
        Assertions.assertFalse(positionRepository.findAll().isEmpty());
    }

    /**
     * [테스트] 요청 거부 - 팀장이 요청을 거부하고 사유를 기록
     *
     * 거부 시 rejection_reason 필드에 사유가 저장됩니다.
     * 팀원은 거부 사유를 확인할 수 있습니다.
     */
    @Test
    @DisplayName("POST /api/v1/requests/{id}/reject - 팀장이 요청 거부 (사유 포함)")
    void rejectRequest_manager_success() throws Exception {
        User manager = createManager("manager@test.com", "Manager");
        User member = createMember("member@test.com", "Member");

        // 매수 요청 생성
        TradeRequest request = new TradeRequest();
        request.setRequester(member);
        request.setRequestType("buy");
        request.setTargetTicker("TSLA");
        request.setTargetMarket("NASDAQ");
        request.setOrderType("amount");
        request.setOrderAmount(new BigDecimal("10000"));
        request.setStatus("pending");
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());
        request = tradeRequestRepository.save(request);

        // 팀장이 거부 (사유: "Too risky")
        mockMvc.perform(post("/api/v1/requests/" + request.getId() + "/reject")
                        .header("Authorization", bearerToken(manager))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "rejection_reason", "Too risky"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 상태와 거부 사유 검증
        TradeRequest rejected = tradeRequestRepository.findById(request.getId()).orElseThrow();
        Assertions.assertEquals("rejected", rejected.getStatus());
        Assertions.assertEquals("Too risky", rejected.getRejectionReason());
    }

    /**
     * [테스트] 팀원이 승인 시도 → 403 Forbidden
     *
     * 승인/거부는 팀장(manager) 또는 관리자(admin)만 가능합니다.
     * 일반 팀원(member)이 시도하면 ForbiddenException이 발생합니다.
     */
    @Test
    @DisplayName("POST /api/v1/requests/{id}/approve - 팀원은 403 반환")
    void approveRequest_member_returns403() throws Exception {
        User member = createMember("member@test.com", "Member");

        // 요청 생성
        TradeRequest request = new TradeRequest();
        request.setRequester(member);
        request.setRequestType("buy");
        request.setTargetTicker("AAPL");
        request.setTargetMarket("NASDAQ");
        request.setOrderType("amount");
        request.setOrderAmount(new BigDecimal("10000"));
        request.setStatus("pending");
        request.setCreatedAt(OffsetDateTime.now());
        request.setUpdatedAt(OffsetDateTime.now());
        request = tradeRequestRepository.save(request);

        // 팀원이 승인 시도 → 403
        mockMvc.perform(post("/api/v1/requests/" + request.getId() + "/approve")
                        .header("Authorization", bearerToken(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }
}
