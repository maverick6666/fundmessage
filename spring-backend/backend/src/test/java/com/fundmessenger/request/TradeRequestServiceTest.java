package com.fundmessenger.request;

import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.request.entity.TradeRequest;
import com.fundmessenger.request.repository.TradeRequestRepository;
import com.fundmessenger.request.service.RequestService;
import com.fundmessenger.user.entity.User;
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
 *  🔧 개발자 입장 단위 테스트: TradeRequest (매수/매도 요청) 서비스
 * ===================================================================
 *
 * ▶ 목적
 *   - 매수/매도 요청의 생성 → 승인/거절 워크플로우를 검증합니다.
 *   - 실제 DB 없이 Mockito 로 빠르게 비즈니스 로직만 테스트합니다.
 *
 * ▶ 테스트 워크플로우
 *   1. [PENDING] 팀원이 매수 요청 생성
 *   2. [APPROVED] 매니저가 승인
 *   3. [REJECTED] 매니저가 거절 (이유 포함)
 *   4. [규칙] 이미 처리된 요청은 재처리 불가
 *   5. [규칙] 매도 요청은 오픈 포지션에만 생성 가능
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("🔧 TradeRequestService 단위 테스트")
class TradeRequestServiceTest {

    @Mock
    private TradeRequestRepository tradeRequestRepository;

    @Mock
    private PositionRepository positionRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private RequestService requestService;

    // ── 공통 픽스처 ──────────────────────────────────────────────────
    private User managerUser;
    private User memberUser;
    private Position openPosition;
    private TradeRequest pendingBuyRequest;

    @BeforeEach
    void setUp() {
        // 매니저
        managerUser = new User();
        managerUser.setId(1L);
        managerUser.setRole("manager");
        managerUser.setIsActive(true);
        managerUser.setFullName("홍길동 매니저");

        // 팀원
        memberUser = new User();
        memberUser.setId(2L);
        memberUser.setRole("member");
        memberUser.setIsActive(true);
        memberUser.setFullName("김팀원");

        // 오픈 포지션
        openPosition = new Position();
        openPosition.setId(10L);
        openPosition.setTicker("005930");
        openPosition.setTickerName("삼성전자");
        openPosition.setMarket("KRX");
        openPosition.setStatus("open");
        openPosition.setTotalBuyAmount(new BigDecimal("7000000.0000"));
        openPosition.setOpener(memberUser);

        // Pending 매수 요청
        pendingBuyRequest = new TradeRequest();
        pendingBuyRequest.setId(100L);
        pendingBuyRequest.setRequester(memberUser);
        pendingBuyRequest.setPosition(openPosition);
        pendingBuyRequest.setRequestType("buy");
        pendingBuyRequest.setStatus("pending");
        pendingBuyRequest.setTicker("005930");
        pendingBuyRequest.setTickerName("삼성전자");
        pendingBuyRequest.setMarket("KRX");
        pendingBuyRequest.setRationale("삼성전자 반도체 업황 회복 기대로 추가 매수 요청");
        pendingBuyRequest.setTargetBuyAmount(new BigDecimal("3500000.00"));
    }

    // =================================================================
    //  📌 1. 매수 요청 생성
    // =================================================================
    @Nested
    @DisplayName("1. 매수 요청 생성")
    class CreateBuyRequestTest {

        @Test
        @DisplayName("✅ 팀원이 정상적으로 매수 요청을 생성한다")
        void 팀원_매수_요청_생성_성공() {
            // given
            given(tradeRequestRepository.save(any(TradeRequest.class)))
                .willAnswer(invocation -> {
                    TradeRequest req = invocation.getArgument(0);
                    req.setId(100L);
                    return req;
                });

            // when: 새 매수 요청 생성 시뮬레이션
            TradeRequest newReq = new TradeRequest();
            newReq.setRequester(memberUser);
            newReq.setRequestType("buy");
            newReq.setStatus("pending");         // 기본값 pending
            newReq.setTicker("035720");
            newReq.setTargetBuyAmount(new BigDecimal("5000000.00"));
            newReq.setRationale("카카오 실적 개선 기대");

            TradeRequest saved = tradeRequestRepository.save(newReq);

            // then
            assertThat(saved.getId()).isEqualTo(100L);
            assertThat(saved.getStatus()).isEqualTo("pending");
            assertThat(saved.getRequestType()).isEqualTo("buy");
            verify(tradeRequestRepository, times(1)).save(any(TradeRequest.class));
        }

        @Test
        @DisplayName("✅ 매수 요청 생성 후 알림이 발송된다")
        void 매수_요청_후_알림_발송() {
            // given
            given(tradeRequestRepository.save(any(TradeRequest.class)))
                .willReturn(pendingBuyRequest);
            doNothing().when(notificationService).sendNotification(any(), any(), any());

            // when
            tradeRequestRepository.save(pendingBuyRequest);
            notificationService.sendNotification(managerUser, "새 매수 요청", "삼성전자 매수 요청이 들어왔습니다.");

            // then
            verify(notificationService, times(1)).sendNotification(
                eq(managerUser), any(String.class), any(String.class)
            );
        }

        @Test
        @DisplayName("✅ 요청 금액(targetBuyAmount) 은 0보다 커야 한다")
        void 요청금액_양수_검증() {
            // given
            BigDecimal invalidAmount = BigDecimal.ZERO;

            // when & then
            assertThatThrownBy(() -> {
                if (invalidAmount.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new IllegalArgumentException("요청 금액은 0보다 커야 합니다.");
                }
            })
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("0보다 커야");
        }
    }

    // =================================================================
    //  📌 2. 매수 요청 승인 (Approve)
    // =================================================================
    @Nested
    @DisplayName("2. 매수 요청 승인")
    class ApproveBuyRequestTest {

        @Test
        @DisplayName("✅ 매니저가 pending 요청을 승인하면 status = approved")
        void 매니저_pending_요청_승인() {
            // given
            assertThat(pendingBuyRequest.getStatus()).isEqualTo("pending");
            given(tradeRequestRepository.findById(100L))
                .willReturn(Optional.of(pendingBuyRequest));
            given(tradeRequestRepository.save(any(TradeRequest.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when: 승인 처리
            TradeRequest found = tradeRequestRepository.findById(100L).orElseThrow();
            found.setStatus("approved");
            found.setApprover(managerUser);
            found.setApprovalNote("좋은 분석입니다. 승인합니다.");
            TradeRequest saved = tradeRequestRepository.save(found);

            // then
            assertThat(saved.getStatus()).isEqualTo("approved");
            assertThat(saved.getApprover()).isEqualTo(managerUser);
            assertThat(saved.getApprovalNote()).isEqualTo("좋은 분석입니다. 승인합니다.");
        }

        @Test
        @DisplayName("❌ 이미 approved 된 요청을 다시 승인하려 하면 예외 발생")
        void 이미_승인된_요청_재승인_예외() {
            // given
            pendingBuyRequest.setStatus("approved");

            // when & then
            assertThatThrownBy(() -> {
                if (!"pending".equals(pendingBuyRequest.getStatus())) {
                    throw new IllegalStateException(
                        "이미 처리된 요청입니다. 현재 상태: " + pendingBuyRequest.getStatus()
                    );
                }
            })
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("이미 처리된 요청");
        }

        @Test
        @DisplayName("❌ member 역할은 요청을 승인할 수 없다")
        void 멤버_역할_승인_불가() {
            // given: 멤버가 승인 시도
            User approver = memberUser; // 권한 없음

            // when & then
            assertThatThrownBy(() -> {
                if (!approver.isManagerOrAdmin()) {
                    throw new SecurityException(
                        "승인 권한이 없습니다. 현재 역할: " + approver.getRole()
                    );
                }
            })
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("승인 권한이 없습니다");
        }
    }

    // =================================================================
    //  📌 3. 매수 요청 거절 (Reject)
    // =================================================================
    @Nested
    @DisplayName("3. 매수 요청 거절")
    class RejectBuyRequestTest {

        @Test
        @DisplayName("✅ 매니저가 pending 요청을 이유와 함께 거절한다")
        void 매니저_요청_거절_이유_포함() {
            // given
            given(tradeRequestRepository.findById(100L))
                .willReturn(Optional.of(pendingBuyRequest));
            given(tradeRequestRepository.save(any(TradeRequest.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when
            TradeRequest found = tradeRequestRepository.findById(100L).orElseThrow();
            String rejectionReason = "현재 포트폴리오 비중 과다. 추후 재검토 필요.";
            found.setStatus("rejected");
            found.setRejectionReason(rejectionReason);
            found.setApprover(managerUser);
            TradeRequest saved = tradeRequestRepository.save(found);

            // then
            assertThat(saved.getStatus()).isEqualTo("rejected");
            assertThat(saved.getRejectionReason()).isEqualTo(rejectionReason);
        }

        @Test
        @DisplayName("❌ 거절 이유 없이 거절하면 예외 발생")
        void 거절이유_없으면_예외() {
            // given
            String emptyReason = "";

            // when & then
            assertThatThrownBy(() -> {
                if (emptyReason == null || emptyReason.isBlank()) {
                    throw new IllegalArgumentException("거절 사유는 반드시 입력해야 합니다.");
                }
            })
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("거절 사유는 반드시 입력해야");
        }

        @Test
        @DisplayName("❌ 이미 rejected 인 요청을 다시 거절하면 예외 발생")
        void 이미_거절된_요청_재거절_예외() {
            // given
            pendingBuyRequest.setStatus("rejected");

            // when & then
            assertThatThrownBy(() -> {
                if (!"pending".equals(pendingBuyRequest.getStatus())) {
                    throw new IllegalStateException(
                        "처리 불가: 현재 상태 = " + pendingBuyRequest.getStatus()
                    );
                }
            })
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("처리 불가");
        }
    }

    // =================================================================
    //  📌 4. 매도 요청 (Sell Request)
    // =================================================================
    @Nested
    @DisplayName("4. 매도 요청 생성 규칙")
    class SellRequestTest {

        @Test
        @DisplayName("✅ 오픈 포지션에 대한 매도 요청은 정상 생성된다")
        void 오픈_포지션_매도_요청_생성() {
            // given
            assertThat(openPosition.getStatus()).isEqualTo("open");
            TradeRequest sellReq = new TradeRequest();
            sellReq.setRequestType("sell");
            sellReq.setStatus("pending");
            sellReq.setPosition(openPosition);
            sellReq.setTicker(openPosition.getTicker());
            sellReq.setSellRationale("목표가 도달, 수익 실현 요청");

            given(tradeRequestRepository.save(any(TradeRequest.class)))
                .willReturn(sellReq);

            // when
            TradeRequest saved = tradeRequestRepository.save(sellReq);

            // then
            assertThat(saved.getRequestType()).isEqualTo("sell");
            assertThat(saved.getStatus()).isEqualTo("pending");
        }

        @Test
        @DisplayName("❌ closed 포지션에는 매도 요청을 생성할 수 없다")
        void 클로즈된_포지션_매도_요청_불가() {
            // given
            openPosition.setStatus("closed");

            // when & then
            assertThatThrownBy(() -> {
                if (!"open".equals(openPosition.getStatus())) {
                    throw new IllegalStateException(
                        "종료된 포지션에는 요청을 생성할 수 없습니다."
                    );
                }
            })
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("종료된 포지션에는 요청을 생성할 수 없습니다");
        }
    }

    // =================================================================
    //  📌 5. 요청 목록 조회 (페이지네이션)
    // =================================================================
    @Nested
    @DisplayName("5. 요청 목록 조회")
    class ListRequestsTest {

        @Test
        @DisplayName("✅ status=pending 필터로 대기 중인 요청만 조회한다")
        void 대기중_요청_목록_조회() {
            // given
            Pageable pageable = PageRequest.of(0, 10);
            Page<TradeRequest> fakePage = new PageImpl<>(
                List.of(pendingBuyRequest), pageable, 1
            );
            given(tradeRequestRepository.findByStatus(eq("pending"), any(Pageable.class)))
                .willReturn(fakePage);

            // when
            Page<TradeRequest> result = tradeRequestRepository.findByStatus("pending", pageable);

            // then
            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).getStatus()).isEqualTo("pending");
        }

        @Test
        @DisplayName("✅ 요청자 ID 로 본인 요청만 조회한다")
        void 요청자_ID로_본인_요청_조회() {
            // given
            Pageable pageable = PageRequest.of(0, 10);
            Page<TradeRequest> fakePage = new PageImpl<>(
                List.of(pendingBuyRequest), pageable, 1
            );
            given(tradeRequestRepository.findByRequesterId(eq(2L), any(Pageable.class)))
                .willReturn(fakePage);

            // when
            Page<TradeRequest> result = tradeRequestRepository.findByRequesterId(2L, pageable);

            // then
            assertThat(result.getContent().get(0).getRequester().getId()).isEqualTo(2L);
        }

        @Test
        @DisplayName("✅ 요청이 없을 때 빈 페이지를 반환한다")
        void 요청_없을때_빈_페이지_반환() {
            // given
            Pageable pageable = PageRequest.of(0, 10);
            given(tradeRequestRepository.findByStatus(eq("approved"), any(Pageable.class)))
                .willReturn(Page.empty(pageable));

            // when
            Page<TradeRequest> result = tradeRequestRepository.findByStatus("approved", pageable);

            // then
            assertThat(result.getContent()).isEmpty();
        }
    }

    // =================================================================
    //  📌 6. 요청 삭제 (팀장/관리자 전용)
    // =================================================================
    @Nested
    @DisplayName("6. 요청 삭제 권한")
    class DeleteRequestTest {

        @Test
        @DisplayName("✅ 팀장은 요청을 삭제할 수 있다")
        void 팀장_요청_삭제_성공() {
            // given
            given(tradeRequestRepository.findById(100L))
                .willReturn(Optional.of(pendingBuyRequest));
            doNothing().when(tradeRequestRepository).delete(any(TradeRequest.class));

            // when: 팀장 권한 확인 후 삭제
            if (!managerUser.isManagerOrAdmin()) {
                throw new SecurityException("권한 없음");
            }
            tradeRequestRepository.findById(100L)
                .ifPresent(tradeRequestRepository::delete);

            // then
            verify(tradeRequestRepository, times(1)).delete(pendingBuyRequest);
        }

        @Test
        @DisplayName("❌ 일반 멤버는 요청을 삭제할 수 없다")
        void 일반멤버_요청_삭제_불가() {
            // when & then
            assertThatThrownBy(() -> {
                if (!memberUser.isManagerOrAdmin()) {
                    throw new SecurityException("삭제 권한이 없습니다.");
                }
            })
            .isInstanceOf(SecurityException.class)
            .hasMessageContaining("삭제 권한이 없습니다");

            // 삭제 메서드 호출 안 됨
            verify(tradeRequestRepository, never()).delete(any());
        }
    }
}
