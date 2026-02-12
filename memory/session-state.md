# 현재 세션 상태
> 마지막 업데이트: 2026-02-12 (PWA + Web Push 완료)

## 개발 환경
- **로컬 개발** (Docker 사용)
- 프론트엔드: React + Vite (localhost:80 via Docker nginx)
- 백엔드: FastAPI (localhost:8000)
- DB: PostgreSQL (Docker 로컬)
- 빌드/테스트: `docker-compose up -d --build`
- **푸쉬 규칙**: 사용자가 지시할 때만 git push (로컬 작업 우선)
- **PWA 지원**: manifest.json + sw.js + Web Push (VAPID)

## 추가 수정 (Phase 완료 후)

### PWA + Web Push ✅
- [x] manifest.json + sw.js + index.html PWA 메타태그
- [x] PushSubscription 모델 + VAPID 설정 (cryptography 키 생성)
- [x] Push 구독 API (subscribe/unsubscribe/vapid-key)
- [x] 알림 서비스: WebSocket + Web Push 동시 발송
- [x] 프론트엔드: 로그인 시 자동 Push 구독 + initPushIfGranted
- [x] VAPID 키 자동 생성 수정 (py_vapid → cryptography 직접 사용)
- [x] docker-compose.yml VAPID 환경변수 매핑
- Playwright 검증 완료 (manifest, SW, VAPID API, Push API 모두 정상)

### 자동로그인 개선 ✅
- [x] AuthContext: 캐시 기반 즉시 복원 + 네트워크 에러 시 로그아웃 방지
- [x] api.js: Refresh token 큐 (동시 401 요청 처리)
- [x] authService: localStorage 유저 캐싱
- [x] auth.py: Refresh token 회전 (새 refresh_token 발급)
- [x] config.py: refresh_token 만료 7일 → 30일
- Playwright 검증 완료 (만료 토큰 → 자동 갱신 확인)

### 모바일 UI 수정 ✅ (이전 세션)
- [x] Header: FM on mobile, Fund Messenger on desktop
- [x] Positions: grid-cols-2 sm:grid-cols-4 레이아웃
- [x] DocumentPanel: 내부 삭제 처리 추가

## 작업 계획 완료 상태

### Phase 0: 빠른 버그 수정 ✅
- [x] 🔴 댓글 "수정됨" 표시 버그 — updated_at nullable + onupdate only
- [x] 🟡 문서 하단 여백 부족 — pb-16 추가

### Phase 1: UI 줄바꿈/모바일 ✅
- [x] 🟡 텍스트 줄바꿈 방지 (전체) — .badge whitespace-nowrap + 22개 위치 개별 수정
- [x] 🟡 사이드뷰어 모바일 풀스크린 — isMobile state, fullscreen overlay

### Phase 2: 자산 스냅샷 인프라 ✅
- [x] asset_service.py 전면 재작성 — PriceService 실시간 가격 조회
- [x] AssetSnapshot 모델 확장 — realized_pnl, unrealized_pnl, position_details
- [x] stats.py API — /asset-history start_date 파라미터, /asset-snapshot/{date} 신규
- [x] regex → pattern deprecation 수정

### Phase 3: 통계 그래프 확장 ✅
- [x] 3탭 차트 (총 자산/실현손익/미실현손익) — chartType state + chartConfig
- [x] 날짜 클릭 → 스냅샷 상세 — handleChartClick + snapshotDetail 인라인 UI

### Phase 4: 기능 추가 ✅
- [x] 토론 사이드뷰어 — DiscussionSidePanel.jsx + openDiscussion() 헬퍼
- [x] 뉴스데스크 댓글 — NewsDetailPanel에 commentService 연동, document_type='news'

### Phase 5: 백엔드 에러 핸들링 ✅ (12건)
- [x] ai_service: response.content null check
- [x] price_service: yfinance info/fast_info null check
- [x] newsdesk_ai: content null + JSON parse error
- [x] discussions API: opener/user relation null safety
- [x] auth API: SMTP failure graceful handling
- [x] uploads API: content_type guard + path traversal check
- [x] notification_service: per-item try/except
- [x] stats API: price fetch try/except
- [x] stock_search_service: asyncio.wait_for timeout

## 커밋 이력 (이번 세션)
1. `121d5a6` Phase 0+1: comment bug + padding + nowrap + mobile SidePanel
2. `adc3f5c` Phase 2: asset snapshot infrastructure
3. `8c0c8e4` Phase 3: stats chart 3-tab + date click detail
4. `a55d447` Phase 4: discussion side panel + newsdesk comments
5. `232b52d` Phase 5: backend error handling 12건

## 알려진 이슈
- 해외 칼럼 길이 부족: yfinance 뉴스 30건으로는 깊이 있는 분석이 어려움

## 다음 할 일
- 뉴스데스크 BenchmarkChart 'fund' 라인 연동 확인 (스냅샷 데이터 수집 후)
- 추가 모바일 UI 검증
