package com.fundmessenger.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.entity.UserRole;
import com.fundmessenger.user.repository.UserRepository;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.position.entity.TeamSettings;
import com.fundmessenger.position.repository.TeamSettingsRepository;
import com.fundmessenger.request.entity.TradeRequest;
import com.fundmessenger.request.repository.TradeRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * ===================================================================
 *  📋 유저 입장 통합 테스트 (User Perspective Integration Test)
 * ===================================================================
 *
 * ▶ 목적 (What & Why)
 *   - "실제 팀원/매니저가 앱을 쓰는 상황"을 HTTP 요청 단위로 테스트합니다.
 *   - 비즈니스 시나리오(ex: 포지션 조회 → 매수요청 → 승인)를 전체 흐름으로 검증합니다.
 *   - H2 인메모리 DB를 써서 실제 DB 없이도 로컬에서 실행할 수 있습니다.
 *
 * ▶ 테스트 대상 시나리오
 *   1. [인증] 로그인 → JWT 발급 → 보호된 엔드포인트 접근
 *   2. [포지션] 팀원이 오픈 포지션 목록을 조회
 *   3. [포지션] 팀원이 포지션 상세 정보 조회
 *   4. [포지션] 팀장이 팀 설정(초기 자본금) 수정
 *   5. [요청] 팀원이 매수 요청 생성
 *   6. [요청] 매니저가 요청 목록 조회 및 승인/거절
 *   7. [인가] 일반 멤버가 관리자 전용 엔드포인트에 접근 시 403 Forbidden
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional   // 각 테스트가 끝나면 DB 롤백 → 테스트 독립성 보장
class FundTeamUserScenarioTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PositionRepository positionRepository;

    @Autowired
    private TeamSettingsRepository teamSettingsRepository;

    @Autowired
    private TradeRequestRepository tradeRequestRepository;

    // ── 테스트용 사용자 ─────────────────────────────────────────────
    private User managerUser;
    private User memberUser;
    private String managerJwtToken;
    private String memberJwtToken;

    private static final String API_BASE = "/api/v1";
    private static final String MEMBER_EMAIL    = "member@fundteam.test";
    private static final String MANAGER_EMAIL   = "manager@fundteam.test";
    private static final String TEST_PASSWORD   = "TestPass123!";

    // ── DB 초기 데이터 세팅 ─────────────────────────────────────────
    @BeforeEach
    void setUp() throws Exception {
        // 1. 테스트용 사용자 생성
        managerUser = createTestUser(MANAGER_EMAIL, "홍길동 매니저", "manager");
        memberUser  = createTestUser(MEMBER_EMAIL,  "김팀원",        "member");

        // 2. 팀 설정(초기 자본금) 등록
        TeamSettings settings = new TeamSettings();
        settings.setInitialCapitalKrw(new BigDecimal("100000000")); // 1억
        settings.setInitialCapitalUsd(new BigDecimal("75000.00"));
        teamSettingsRepository.save(settings);

        // 3. 샘플 오픈 포지션 생성
        createSamplePosition("005930", "삼성전자", "KRX", "open", managerUser);
        createSamplePosition("AAPL",   "Apple Inc.", "NASDAQ", "open", memberUser);

        // 4. JWT 토큰 발급 (로그인)
        managerJwtToken = loginAndGetToken(MANAGER_EMAIL, TEST_PASSWORD);
        memberJwtToken  = loginAndGetToken(MEMBER_EMAIL,  TEST_PASSWORD);
    }

    // =================================================================
    //  📌 시나리오 1: 인증 (Authentication)
    // =================================================================
    @Nested
    @DisplayName("📌 시나리오 1: 인증 흐름")
    class AuthScenarioTest {

        @Test
        @DisplayName("✅ 정상 로그인 시 accessToken 과 refreshToken 이 반환된다")
        void 정상_로그인_JWT_반환() throws Exception {
            Map<String, String> loginRequest = Map.of(
                "email", MEMBER_EMAIL,
                "password", TEST_PASSWORD
            );

            mockMvc.perform(post(API_BASE + "/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(loginRequest)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.email").value(MEMBER_EMAIL));
        }

        @Test
        @DisplayName("❌ 잘못된 비밀번호 로그인 시 401 반환")
        void 잘못된_비밀번호_401() throws Exception {
            Map<String, String> loginRequest = Map.of(
                "email", MEMBER_EMAIL,
                "password", "wrongpassword"
            );

            mockMvc.perform(post(API_BASE + "/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(loginRequest)))
                .andDo(print())
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("❌ 토큰 없이 보호된 API 접근 시 401 반환")
        void 토큰_없이_보호된_API_접근_401() throws Exception {
            mockMvc.perform(get(API_BASE + "/positions"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("✅ 리프레시 토큰으로 새 accessToken 발급")
        void 리프레시_토큰으로_재발급() throws Exception {
            // 1. 로그인해서 refreshToken 받기
            String loginBody = objectMapper.writeValueAsString(
                Map.of("email", MEMBER_EMAIL, "password", TEST_PASSWORD)
            );
            MvcResult loginResult = mockMvc.perform(post(API_BASE + "/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(loginBody))
                .andExpect(status().isOk())
                .andReturn();

            String refreshToken = extractField(loginResult, "data.refreshToken");

            // 2. refreshToken 으로 새 accessToken 요청
            mockMvc.perform(post(API_BASE + "/auth/refresh")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
        }
    }

    // =================================================================
    //  📌 시나리오 2: 팀원이 포지션 목록을 조회한다
    // =================================================================
    @Nested
    @DisplayName("📌 시나리오 2: 포지션 조회 흐름")
    class PositionViewScenarioTest {

        @Test
        @DisplayName("✅ 팀원이 오픈 포지션 목록을 페이지네이션으로 조회한다")
        void 팀원_오픈_포지션_목록_조회() throws Exception {
            mockMvc.perform(get(API_BASE + "/positions")
                    .header("Authorization", "Bearer " + memberJwtToken)
                    .param("status", "open")
                    .param("page", "0")
                    .param("limit", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(2))))
                .andExpect(jsonPath("$.data.content[0].status").value("open"));
        }

        @Test
        @DisplayName("✅ 팀원이 삼성전자 포지션을 ticker 로 필터링한다")
        void 팀원_티커로_포지션_필터링() throws Exception {
            mockMvc.perform(get(API_BASE + "/positions")
                    .header("Authorization", "Bearer " + memberJwtToken)
                    .param("ticker", "005930"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].ticker").value("005930"))
                .andExpect(jsonPath("$.data.content[0].tickerName").value("삼성전자"));
        }

        @Test
        @DisplayName("✅ 팀원이 특정 포지션의 상세 정보를 조회한다")
        void 팀원_포지션_상세_조회() throws Exception {
            // 삼성전자 포지션 ID 찾기
            Position samsung = positionRepository
                .findFirstByTickerAndMarketAndStatus("005930", "KRX", "open")
                .orElseThrow();

            mockMvc.perform(get(API_BASE + "/positions/" + samsung.getId())
                    .header("Authorization", "Bearer " + memberJwtToken))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ticker").value("005930"))
                .andExpect(jsonPath("$.data.tickerName").value("삼성전자"))
                .andExpect(jsonPath("$.data.market").value("KRX"));
        }

        @Test
        @DisplayName("✅ 팀장이 팀 설정(초기 자본금)을 조회한다")
        void 팀장_팀설정_조회() throws Exception {
            mockMvc.perform(get(API_BASE + "/positions/team-settings")
                    .header("Authorization", "Bearer " + managerJwtToken))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.initialCapitalKrw").isNotEmpty());
        }
    }

    // =================================================================
    //  📌 시나리오 3: 팀장이 팀 설정(자본금)을 수정한다
    // =================================================================
    @Nested
    @DisplayName("📌 시나리오 3: 팀 설정 수정 흐름")
    class TeamSettingsScenarioTest {

        @Test
        @DisplayName("✅ 팀장이 초기 자본금을 2억으로 수정한다")
        void 팀장_초기자본금_수정() throws Exception {
            Map<String, Object> body = Map.of(
                "initialCapitalKrw", 200000000,
                "initialCapitalUsd", 150000
            );

            mockMvc.perform(put(API_BASE + "/positions/team-settings")
                    .header("Authorization", "Bearer " + managerJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.initialCapitalKrw").value(200000000));
        }

        @Test
        @DisplayName("❌ 일반 멤버가 팀 설정을 수정하려 하면 403 반환")
        void 일반멤버_팀설정_수정_시도_403() throws Exception {
            Map<String, Object> body = Map.of("initialCapitalKrw", 999999999);

            mockMvc.perform(put(API_BASE + "/positions/team-settings")
                    .header("Authorization", "Bearer " + memberJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body)))
                .andDo(print())
                .andExpect(status().isForbidden());
        }
    }

    // =================================================================
    //  📌 시나리오 4: 팀원이 매수 요청을 생성하고 매니저가 승인한다
    // =================================================================
    @Nested
    @DisplayName("📌 시나리오 4: 매수 요청 → 매니저 승인 흐름")
    class TradeRequestApprovalScenarioTest {

        @Test
        @DisplayName("✅ 팀원이 매수 요청을 생성한다")
        void 팀원_매수_요청_생성() throws Exception {
            Map<String, Object> buyRequest = new HashMap<>();
            buyRequest.put("ticker", "035720");
            buyRequest.put("tickerName", "카카오");
            buyRequest.put("market", "KRX");
            buyRequest.put("requestType", "buy");
            buyRequest.put("targetBuyAmount", 5000000);
            buyRequest.put("rationale", "카카오 실적 개선 기대감으로 매수 요청합니다.");

            MvcResult result = mockMvc.perform(post(API_BASE + "/requests/buy")
                    .header("Authorization", "Bearer " + memberJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(buyRequest)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ticker").value("035720"))
                .andExpect(jsonPath("$.data.status").value("pending"))
                .andReturn();

            // 생성된 요청 ID 검증
            String responseBody = result.getResponse().getContentAsString();
            Map response = objectMapper.readValue(responseBody, Map.class);
            Map data = (Map) response.get("data");
            Long requestId = ((Number) data.get("id")).longValue();
            assert requestId > 0;
        }

        @Test
        @DisplayName("✅ 매니저가 대기 중인 요청 목록을 조회한다")
        void 매니저_요청_목록_조회() throws Exception {
            mockMvc.perform(get(API_BASE + "/requests")
                    .header("Authorization", "Bearer " + managerJwtToken)
                    .param("status", "pending"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
        }

        @Test
        @DisplayName("✅ 매니저가 매수 요청을 승인한다 → 상태가 approved 로 변경")
        void 매니저_매수요청_승인() throws Exception {
            // 1. 먼저 요청 생성
            Map<String, Object> buyRequest = Map.of(
                "ticker", "000660",
                "tickerName", "SK하이닉스",
                "market", "KRX",
                "requestType", "buy",
                "targetBuyAmount", 10000000,
                "rationale", "반도체 업황 회복 기대"
            );

            MvcResult createResult = mockMvc.perform(post(API_BASE + "/requests/buy")
                    .header("Authorization", "Bearer " + memberJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(buyRequest)))
                .andExpect(status().isOk())
                .andReturn();

            Long requestId = extractId(createResult);

            // 2. 매니저가 승인
            Map<String, Object> approvalBody = Map.of(
                "approvalNote", "좋은 분석입니다. 승인합니다."
            );

            mockMvc.perform(post(API_BASE + "/requests/" + requestId + "/approve")
                    .header("Authorization", "Bearer " + managerJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(approvalBody)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("approved"));
        }

        @Test
        @DisplayName("✅ 매니저가 매수 요청을 거절한다 → 상태가 rejected 로 변경")
        void 매니저_매수요청_거절() throws Exception {
            // 1. 요청 생성
            Map<String, Object> buyRequest = Map.of(
                "ticker", "105560",
                "tickerName", "KB금융",
                "market", "KRX",
                "requestType", "buy",
                "targetBuyAmount", 3000000,
                "rationale", "KB금융 배당 매력"
            );

            MvcResult createResult = mockMvc.perform(post(API_BASE + "/requests/buy")
                    .header("Authorization", "Bearer " + memberJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(buyRequest)))
                .andExpect(status().isOk())
                .andReturn();

            Long requestId = extractId(createResult);

            // 2. 매니저가 거절
            Map<String, Object> rejectBody = Map.of(
                "reason", "현재 포트폴리오 비중 과다, 추후 재검토 필요"
            );

            mockMvc.perform(post(API_BASE + "/requests/" + requestId + "/reject")
                    .header("Authorization", "Bearer " + managerJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(rejectBody)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("rejected"))
                .andExpect(jsonPath("$.data.rejectionReason").isNotEmpty());
        }

        @Test
        @DisplayName("❌ 일반 멤버가 다른 사람의 요청을 승인하려 하면 403 반환")
        void 일반멤버_요청_승인_시도_403() throws Exception {
            // 요청 직접 DB에 삽입
            Position pos = positionRepository.findAll().get(0);
            TradeRequest req = createPendingRequest(memberUser, pos);

            mockMvc.perform(post(API_BASE + "/requests/" + req.getId() + "/approve")
                    .header("Authorization", "Bearer " + memberJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("approvalNote", "몰래 승인"))))
                .andDo(print())
                .andExpect(status().isForbidden());
        }
    }

    // =================================================================
    //  📌 시나리오 5: 포지션 종료(클로즈) 흐름
    // =================================================================
    @Nested
    @DisplayName("📌 시나리오 5: 포지션 종료 흐름")
    class PositionCloseScenarioTest {

        @Test
        @DisplayName("✅ 팀장이 오픈 포지션을 클로즈한다 → 상태가 closed 로 변경")
        void 팀장_포지션_클로즈() throws Exception {
            Position samsung = positionRepository
                .findFirstByTickerAndMarketAndStatus("005930", "KRX", "open")
                .orElseThrow();

            Map<String, Object> closeBody = Map.of(
                "averageSellPrice", 78000,
                "totalSellAmount", 7800000,
                "closingNote", "목표가 도달로 포지션 종료"
            );

            mockMvc.perform(post(API_BASE + "/positions/" + samsung.getId() + "/close")
                    .header("Authorization", "Bearer " + managerJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(closeBody)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("closed"))
                .andExpect(jsonPath("$.data.closedAt").isNotEmpty());
        }

        @Test
        @DisplayName("❌ 이미 클로즈된 포지션을 다시 클로즈하면 400/409 반환")
        void 이미_클로즈된_포지션_재클로즈_에러() throws Exception {
            // 이미 closed 인 포지션 생성
            Position closedPos = createSamplePosition("066570", "LG전자", "KRX", "closed", managerUser);

            Map<String, Object> closeBody = Map.of("averageSellPrice", 60000);

            mockMvc.perform(post(API_BASE + "/positions/" + closedPos.getId() + "/close")
                    .header("Authorization", "Bearer " + managerJwtToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(closeBody)))
                .andDo(print())
                .andExpect(status().is4xxClientError());
        }
    }

    // =================================================================
    //  🛠️  Helper Methods (테스트 도우미 함수들)
    // =================================================================

    /** 테스트용 User 를 DB에 저장하고 반환 */
    private User createTestUser(String email, String fullName, String role) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(email.split("@")[0]);
        user.setFullName(fullName);
        user.setPasswordHash(passwordEncoder.encode(TEST_PASSWORD));
        user.setRole(role);
        user.setIsActive(true);
        return userRepository.save(user);
    }

    /** 테스트용 Position 을 DB에 저장하고 반환 */
    private Position createSamplePosition(String ticker, String tickerName,
                                          String market, String status, User opener) {
        Position pos = new Position();
        pos.setTicker(ticker);
        pos.setTickerName(tickerName);
        pos.setMarket(market);
        pos.setStatus(status);
        pos.setAverageBuyPrice(new BigDecimal("70000.0000"));
        pos.setTotalQuantity(new BigDecimal("100.0000"));
        pos.setTotalBuyAmount(new BigDecimal("7000000.0000"));
        pos.setOpener(opener);
        pos.setIsInfoConfirmed(false);
        return positionRepository.save(pos);
    }

    /** 테스트용 pending TradeRequest 를 DB에 저장하고 반환 */
    private TradeRequest createPendingRequest(User requester, Position position) {
        TradeRequest req = new TradeRequest();
        req.setRequester(requester);
        req.setPosition(position);
        req.setRequestType("buy");
        req.setStatus("pending");
        req.setTicker(position.getTicker());
        req.setTickerName(position.getTickerName());
        req.setMarket(position.getMarket());
        req.setRationale("테스트 요청");
        req.setTargetBuyAmount(new BigDecimal("5000000.00"));
        return tradeRequestRepository.save(req);
    }

    /** MockMvc 응답에서 특정 JSON 경로 값 추출 (간단히 raw 파싱) */
    private String extractField(MvcResult result, String jsonPath) throws Exception {
        String body = result.getResponse().getContentAsString();
        // simple extraction — 실전에서는 JsonPath 라이브러리 사용 권장
        Map response = objectMapper.readValue(body, Map.class);
        String[] parts = jsonPath.split("\\.");
        Object current = response;
        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map) current).get(part);
            }
        }
        return current != null ? current.toString() : null;
    }

    /** MockMvc 응답에서 data.id 추출 */
    private Long extractId(MvcResult result) throws Exception {
        String body = result.getResponse().getContentAsString();
        Map response = objectMapper.readValue(body, Map.class);
        Map data = (Map) response.get("data");
        return ((Number) data.get("id")).longValue();
    }

    /** 로그인하여 JWT accessToken 반환 */
    private String loginAndGetToken(String email, String password) throws Exception {
        String loginBody = objectMapper.writeValueAsString(
            Map.of("email", email, "password", password)
        );
        MvcResult result = mockMvc.perform(post(API_BASE + "/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn();
        return extractField(result, "data.accessToken");
    }
}
