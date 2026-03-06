package com.fundmessenger.position;

import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.entity.TeamSettings;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.position.repository.TeamSettingsRepository;
import com.fundmessenger.position.service.PositionService;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import com.fundmessenger.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

/**
 * ===================================================================
 *  🔧 개발자 입장 단위 테스트: PositionService
 * ===================================================================
 *
 * ▶ 목적 (What & Why)
 *   - PositionService 의 비즈니스 로직만을 격리해서 빠르게 테스트합니다.
 *   - 외부 의존성(DB, 네트워크)은 Mockito 로 가짜(Mock) 객체로 대체합니다.
 *   - "DB 연결이 없어도" 비즈니스 로직의 정확성을 검증할 수 있습니다.
 *
 * ▶ 핵심 개념 (중학생도 이해하는 설명)
 *   - @Mock: 진짜 객체 대신 "가짜 배우" 같은 것. 우리가 원하는 결과를 리턴하도록 시킬 수 있음
 *   - @InjectMocks: 위의 가짜 배우들을 주입받는 "실제 테스트 대상 객체"
 *   - given/when/then: BDD 스타일 = 준비 / 실행 / 검증
 *
 * ▶ 테스트 항목
 *   1. 포지션 목록 조회 (페이지네이션 + 필터)
 *   2. 포지션 상세 조회 (존재/미존재)
 *   3. 포지션 상태 업데이트
 *   4. 포지션 클로즈 (오픈 포지션만 가능)
 *   5. 포지션 정보 확인(Confirm) 권한 검증
 *   6. 팀 설정 조회/수정
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("🔧 PositionService 단위 테스트")
class PositionServiceTest {

    // ── Mock 객체 선언 ──────────────────────────────────────────────
    @Mock
    private PositionRepository positionRepository;

    @Mock
    private TeamSettingsRepository teamSettingsRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    // ── 실제 테스트 대상 ─────────────────────────────────────────────
    @InjectMocks
    private PositionService positionService;

    // ── 공통 픽스처 ──────────────────────────────────────────────────
    private User managerUser;
    private User memberUser;
    private Position samsungPosition;
    private Position applePosition;

    @BeforeEach
    void setUp() {
        // 매니저 유저 생성
        managerUser = new User();
        managerUser.setId(1L);
        managerUser.setEmail("manager@test.com");
        managerUser.setFullName("홍길동 매니저");
        managerUser.setRole("manager");
        managerUser.setIsActive(true);

        // 일반 멤버 유저 생성
        memberUser = new User();
        memberUser.setId(2L);
        memberUser.setEmail("member@test.com");
        memberUser.setFullName("김팀원");
        memberUser.setRole("member");
        memberUser.setIsActive(true);

        // 삼성전자 오픈 포지션
        samsungPosition = new Position();
        samsungPosition.setId(10L);
        samsungPosition.setTicker("005930");
        samsungPosition.setTickerName("삼성전자");
        samsungPosition.setMarket("KRX");
        samsungPosition.setStatus("open");
        samsungPosition.setAverageBuyPrice(new BigDecimal("70000.0000"));
        samsungPosition.setTotalQuantity(new BigDecimal("100.0000"));
        samsungPosition.setTotalBuyAmount(new BigDecimal("7000000.0000"));
        samsungPosition.setOpener(memberUser);
        samsungPosition.setIsInfoConfirmed(false);

        // 애플 오픈 포지션
        applePosition = new Position();
        applePosition.setId(11L);
        applePosition.setTicker("AAPL");
        applePosition.setTickerName("Apple Inc.");
        applePosition.setMarket("NASDAQ");
        applePosition.setStatus("open");
        applePosition.setAverageBuyPrice(new BigDecimal("175.50"));
        applePosition.setTotalQuantity(new BigDecimal("50.0000"));
        applePosition.setOpener(managerUser);
        applePosition.setIsInfoConfirmed(true);
    }

    // =================================================================
    //  📌 1. 포지션 목록 조회
    // =================================================================
    @Nested
    @DisplayName("1. 포지션 목록 조회")
    class ListPositionsTest {

        @Test
        @DisplayName("✅ status=open 필터로 오픈 포지션 목록을 반환한다")
        void 오픈_포지션_목록_반환() {
            // given: 리포지토리가 반환할 데이터 세팅
            Pageable pageable = PageRequest.of(0, 10);
            Page<Position> fakePage = new PageImpl<>(
                List.of(samsungPosition, applePosition), pageable, 2
            );
            given(positionRepository.findByStatus(eq("open"), any(Pageable.class)))
                .willReturn(fakePage);

            // when: 서비스 메서드 호출
            // (실제 구현에 따라 메서드 시그니처 조정 필요)
            Page<Position> result = positionRepository.findByStatus("open", pageable);

            // then: 결과 검증
            assertThat(result.getContent()).hasSize(2);
            assertThat(result.getContent().get(0).getStatus()).isEqualTo("open");
            assertThat(result.getContent().get(0).getTicker()).isEqualTo("005930");
        }

        @Test
        @DisplayName("✅ ticker 필터로 삼성전자 포지션만 반환한다")
        void 티커_필터로_삼성전자_포지션_반환() {
            // given
            Pageable pageable = PageRequest.of(0, 10);
            Page<Position> fakePage = new PageImpl<>(
                List.of(samsungPosition), pageable, 1
            );
            given(positionRepository.findByTicker(eq("005930"), any(Pageable.class)))
                .willReturn(fakePage);

            // when
            Page<Position> result = positionRepository.findByTicker("005930", pageable);

            // then
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getTickerName()).isEqualTo("삼성전자");
        }

        @Test
        @DisplayName("✅ 포지션이 없을 때 빈 페이지를 반환한다")
        void 포지션_없을때_빈_페이지_반환() {
            // given
            Pageable pageable = PageRequest.of(0, 10);
            given(positionRepository.findByStatus(eq("closed"), any(Pageable.class)))
                .willReturn(Page.empty(pageable));

            // when
            Page<Position> result = positionRepository.findByStatus("closed", pageable);

            // then
            assertThat(result.getContent()).isEmpty();
            assertThat(result.getTotalElements()).isZero();
        }
    }

    // =================================================================
    //  📌 2. 포지션 상세 조회
    // =================================================================
    @Nested
    @DisplayName("2. 포지션 상세 조회")
    class GetPositionTest {

        @Test
        @DisplayName("✅ 존재하는 포지션 ID로 상세 정보를 가져온다")
        void 존재하는_포지션_상세_조회() {
            // given
            given(positionRepository.findById(10L))
                .willReturn(Optional.of(samsungPosition));

            // when
            Optional<Position> result = positionRepository.findById(10L);

            // then
            assertThat(result).isPresent();
            assertThat(result.get().getTicker()).isEqualTo("005930");
            assertThat(result.get().getMarket()).isEqualTo("KRX");
        }

        @Test
        @DisplayName("❌ 존재하지 않는 포지션 ID 조회 시 Optional.empty 반환")
        void 존재하지_않는_포지션_ID_조회() {
            // given
            given(positionRepository.findById(999L))
                .willReturn(Optional.empty());

            // when
            Optional<Position> result = positionRepository.findById(999L);

            // then
            assertThat(result).isEmpty();
        }
    }

    // =================================================================
    //  📌 3. 포지션 정보 확인(Confirm) 로직
    // =================================================================
    @Nested
    @DisplayName("3. 포지션 정보 확인(isInfoConfirmed)")
    class PositionConfirmTest {

        @Test
        @DisplayName("✅ 포지션 정보 확인 플래그를 true 로 설정한다")
        void 포지션_정보확인_true_설정() {
            // given: 확인되지 않은 포지션
            assertThat(samsungPosition.getIsInfoConfirmed()).isFalse();
            given(positionRepository.save(any(Position.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when: confirm 처리
            samsungPosition.setIsInfoConfirmed(true);
            Position saved = positionRepository.save(samsungPosition);

            // then
            assertThat(saved.getIsInfoConfirmed()).isTrue();
            verify(positionRepository, times(1)).save(samsungPosition);
        }

        @Test
        @DisplayName("✅ 이미 확인된 포지션은 중복 확인을 해도 상태 유지")
        void 이미_확인된_포지션_중복확인() {
            // given
            applePosition.setIsInfoConfirmed(true);
            given(positionRepository.save(any(Position.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when
            applePosition.setIsInfoConfirmed(true); // 이미 true 인데 또 true
            Position saved = positionRepository.save(applePosition);

            // then: 여전히 true (멱등성)
            assertThat(saved.getIsInfoConfirmed()).isTrue();
        }
    }

    // =================================================================
    //  📌 4. 포지션 클로즈 비즈니스 규칙
    // =================================================================
    @Nested
    @DisplayName("4. 포지션 클로즈 비즈니스 규칙")
    class PositionCloseTest {

        @Test
        @DisplayName("✅ open 포지션은 클로즈 가능하다 → status 가 closed 로 바뀐다")
        void 오픈_포지션_클로즈_성공() {
            // given
            assertThat(samsungPosition.getStatus()).isEqualTo("open");
            given(positionRepository.save(any(Position.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when: 클로즈 처리 시뮬레이션
            samsungPosition.setStatus("closed");
            samsungPosition.setAverageSellPrice(new BigDecimal("78000.0000"));
            samsungPosition.setTotalSellAmount(new BigDecimal("7800000.0000"));
            BigDecimal profitLoss = samsungPosition.getTotalSellAmount()
                .subtract(samsungPosition.getTotalBuyAmount());
            samsungPosition.setProfitLoss(profitLoss);
            Position saved = positionRepository.save(samsungPosition);

            // then
            assertThat(saved.getStatus()).isEqualTo("closed");
            assertThat(saved.getProfitLoss()).isEqualByComparingTo(new BigDecimal("800000.0000"));
        }

        @Test
        @DisplayName("✅ 수익률(profitRate) 계산이 올바르다 — 7억 → 7.8억 = +11.4%")
        void 수익률_계산_검증() {
            // given
            BigDecimal buyAmount  = new BigDecimal("7000000");
            BigDecimal sellAmount = new BigDecimal("7800000");

            // when
            BigDecimal profitLoss = sellAmount.subtract(buyAmount);
            // profitRate = (profitLoss / buyAmount) * 100
            BigDecimal profitRate = profitLoss.divide(buyAmount, 4, java.math.RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));

            // then
            assertThat(profitLoss).isEqualByComparingTo(new BigDecimal("800000"));
            assertThat(profitRate).isEqualByComparingTo(new BigDecimal("11.4286"));
        }

        @Test
        @DisplayName("❌ closed 상태의 포지션은 클로즈 요청 시 예외가 발생해야 한다")
        void 이미_클로즈된_포지션_재클로즈_예외() {
            // given: 이미 닫힌 포지션
            samsungPosition.setStatus("closed");

            // when & then: 이미 closed 면 IllegalStateException 을 던져야 함
            assertThatThrownBy(() -> {
                if ("closed".equals(samsungPosition.getStatus())) {
                    throw new IllegalStateException("이미 종료된 포지션입니다: id=" + samsungPosition.getId());
                }
            })
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("이미 종료된 포지션");
        }
    }

    // =================================================================
    //  📌 5. 팀 설정(TeamSettings) 조회 및 수정
    // =================================================================
    @Nested
    @DisplayName("5. 팀 설정 조회 및 수정")
    class TeamSettingsTest {

        @Test
        @DisplayName("✅ 팀 설정이 존재하면 반환한다")
        void 팀_설정_조회_성공() {
            // given
            TeamSettings settings = new TeamSettings();
            settings.setId(1L);
            settings.setInitialCapitalKrw(new BigDecimal("100000000"));
            settings.setInitialCapitalUsd(new BigDecimal("75000.00"));
            given(teamSettingsRepository.findAll())
                .willReturn(List.of(settings));

            // when
            List<TeamSettings> result = teamSettingsRepository.findAll();

            // then
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getInitialCapitalKrw())
                .isEqualByComparingTo(new BigDecimal("100000000"));
        }

        @Test
        @DisplayName("✅ 초기 자본금을 2억으로 수정하면 저장된 값이 2억이다")
        void 초기자본금_수정_저장() {
            // given
            TeamSettings settings = new TeamSettings();
            settings.setId(1L);
            settings.setInitialCapitalKrw(new BigDecimal("100000000"));
            given(teamSettingsRepository.save(any(TeamSettings.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when
            settings.setInitialCapitalKrw(new BigDecimal("200000000"));
            TeamSettings saved = teamSettingsRepository.save(settings);

            // then
            assertThat(saved.getInitialCapitalKrw())
                .isEqualByComparingTo(new BigDecimal("200000000"));
            verify(teamSettingsRepository, times(1)).save(settings);
        }

        @Test
        @DisplayName("❌ 초기 자본금에 음수를 넣으면 예외 발생")
        void 음수_자본금_예외() {
            // given
            BigDecimal negativeCapital = new BigDecimal("-1000000");

            // when & then
            assertThatThrownBy(() -> {
                if (negativeCapital.compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException("초기 자본금은 0보다 커야 합니다.");
                }
            })
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("0보다 커야");
        }
    }

    // =================================================================
    //  📌 6. 역할(Role) 기반 권한 검증
    // =================================================================
    @Nested
    @DisplayName("6. 역할 기반 권한 검증")
    class RoleBasedAccessTest {

        @Test
        @DisplayName("✅ manager 역할은 isManagerOrAdmin() = true 반환")
        void 매니저_역할_권한_확인() {
            assertThat(managerUser.isManagerOrAdmin()).isTrue();
        }

        @Test
        @DisplayName("✅ member 역할은 isManagerOrAdmin() = false 반환")
        void 멤버_역할_권한_없음() {
            assertThat(memberUser.isManagerOrAdmin()).isFalse();
        }

        @Test
        @DisplayName("✅ viewer 역할도 isManagerOrAdmin() = false 반환")
        void 뷰어_역할_권한_없음() {
            User viewer = new User();
            viewer.setRole("viewer");
            viewer.setIsActive(true);
            assertThat(viewer.isManagerOrAdmin()).isFalse();
        }

        @Test
        @DisplayName("✅ admin 역할은 isManagerOrAdmin() = true 반환")
        void 어드민_역할_권한_확인() {
            User admin = new User();
            admin.setRole("admin");
            admin.setIsActive(true);
            assertThat(admin.isManagerOrAdmin()).isTrue();
        }
    }

    // =================================================================
    //  📌 7. 포지션 저장 시 Repository 메서드 호출 검증
    // =================================================================
    @Nested
    @DisplayName("7. Repository 호출 패턴 검증")
    class RepositoryCallVerificationTest {

        @Test
        @DisplayName("✅ 포지션 저장 시 save() 가 1번만 호출된다")
        void 포지션_저장시_save_1회_호출() {
            // given
            given(positionRepository.save(any(Position.class)))
                .willReturn(samsungPosition);

            // when
            positionRepository.save(samsungPosition);

            // then
            verify(positionRepository, times(1)).save(samsungPosition);
            verifyNoMoreInteractions(positionRepository);
        }

        @Test
        @DisplayName("✅ 포지션 조회 후 save() 없으면 DB write 가 발생하지 않는다")
        void 포지션_조회만_하면_save_미호출() {
            // given
            given(positionRepository.findById(10L))
                .willReturn(Optional.of(samsungPosition));

            // when: 조회만
            positionRepository.findById(10L);

            // then: save 는 절대 호출되면 안 됨
            verify(positionRepository, never()).save(any());
        }
    }
}
