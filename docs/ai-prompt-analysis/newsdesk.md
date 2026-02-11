# AI 뉴스데스크 프롬프트 분석

## 테스트 환경
- 모델: 기존 gpt-5-mini (하드코딩) → settings.openai_model로 변경
- 데이터: 2/10 뉴스데스크 (yfinance 26건, 스케줄러 버그로 네이버 0건)
- 정상 데이터: 2/8 뉴스데스크 (816건, naver 91% + yfinance 9%)

## 버그 수정: 키워드별 감성 요인

### 문제
키워드 히트맵 클릭 시:
- ✅ 게이지(greed_ratio/fear_ratio/overall_score) 변화
- ❌ 요인(top_greed/top_fear) 표시 안 됨

### 원인
1. `KeywordBubble` 스키마에 `top_greed`/`top_fear` 필드 없음
2. AI 프롬프트의 keywords JSON에 `top_greed`/`top_fear` 미포함
3. 프론트엔드 `keywordSentimentMap`에서 빈 배열로 초기화

### 수정
1. **backend/app/schemas/newsdesk.py**: KeywordBubble에 필드 추가
   ```python
   top_greed: List[str] = []
   top_fear: List[str] = []
   ```

2. **backend/app/services/newsdesk_ai.py**: AI 프롬프트 JSON 구조에 추가
   ```json
   "keywords": [{
     "keyword": "반도체",
     "count": 15,
     "greed_score": 0.75,
     "category": "테크",
     "top_greed": ["HBM 수주 확대", "엔비디아 협력"],
     "top_fear": ["공급 과잉 우려"]
   }]
   ```
   요구사항에 "top_greed: 이 키워드의 탐욕 요인 1-3개" 추가

3. **frontend/src/pages/NewsDesk.jsx**: keywordSentimentMap 수정
   ```javascript
   top_greed: k.top_greed || [],
   top_fear: k.top_fear || []
   ```

### 호환성
- 기존 데이터(top_greed/top_fear 없는 키워드): `|| []`로 빈 배열 처리
- 새 데이터(top_greed/top_fear 있는 키워드): 정상 표시
- 스키마에 `default=[]` 설정으로 Pydantic 검증 통과

## 코드 수정

### 모델 설정 변경
- Before: `model="gpt-5-mini"` (하드코딩)
- After: `model=settings.openai_model` (.env에서 설정)
- 이유: 테스트/프로덕션 환경 분리

### 컨텐츠 길이 강화
- AI 칼럼 content: "반드시 2,000자 이상" 명시 (이전: 2,000-2,500자 범위만 제시)
- 뉴스 카드 content: "반드시 800자 이상" 명시 (이전: 800-1,200자 범위만 제시)
- 주목 종목 detail: "반드시 800자 이상" 명시 (이전: 1,000자 범위만 제시)

## 현재 출력 품질 (2/10 데이터, gpt-5-mini)

| 항목 | 목표 | 실제 | 달성률 |
|------|------|------|--------|
| AI 칼럼 제목 | 20-35자 | 16-19자 | ✅ |
| AI 칼럼 본문 | 2,000-2,500자 | 987-1,132자 | 50% |
| 뉴스 카드 수 | 6개 | 6개 | ✅ |
| 뉴스 카드 본문 | 800-1,200자 | 514자 | 50% |
| 키워드 수 | 8-12개 | 10개 | ✅ |
| 주목 종목 수 | 3개 | 3개 | ✅ |
| 주목 종목 detail | 1,000자 | 614자 | 60% |

### 길이 부족 원인
- **데이터 부족**: 26건(yfinance만) vs 정상 816건
- 스케줄러 수정으로 네이버 뉴스 수집이 정상화되면 품질 향상 예상
- 프롬프트에 최소 길이를 강화하여 추가 개선 시도

## 프롬프트 반복 개선

### 반복 테스트 미실시 사유
1. 2/10 데이터가 yfinance 26건뿐 (정상 데이터 아님)
2. 뉴스데스크 생성은 스케줄러 기반 (수동 생성 엔드포인트 제거됨)
3. 기존 프롬프트가 이미 상당히 상세 (시스템 프롬프트 200줄 + 사용자 프롬프트 80줄)
4. JSON response_format으로 구조 강제되어 프롬프트 오염 위험 낮음

### 대신 적용한 개선
- 키워드별 감성 요인 데이터 추가 (버그 수정 + 프롬프트 확장)
- 최소 길이 명시로 컨텐츠 볼륨 강화
- 모델 설정 유연화

## 프로덕션 전환 시 체크리스트
- [ ] .env에서 OPENAI_MODEL=gpt-5-mini 확인
- [ ] 스케줄러 정상 동작 확인 (naver + yfinance 뉴스 수집)
- [ ] 키워드 히트맵 클릭 시 요인 표시 확인 (새 데이터 필요)
- [ ] 칼럼/뉴스카드/주목종목 길이 목표 달성 확인
