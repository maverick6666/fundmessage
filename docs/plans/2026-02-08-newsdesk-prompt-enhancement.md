# NewsDesk 프롬프트 개선 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 뉴스데스크 AI 프롬프트를 UX 관점으로 개선하여 품질 높은 콘텐츠 생성

**Architecture:** 시스템 프롬프트에 상세 가이드 통합 (프롬프트 캐싱 활용), 중복 방지를 위한 어제 데이터 참조

**Tech Stack:** OpenAI API, Python, FastAPI

---

## 변경 요약

| 항목 | 제목 | 요약 | 본문 | 형식 |
|------|------|------|------|------|
| 뉴스 카드 | 15-25자 | 100-150자 | 800-1,200자 | 마크다운 |
| AI 칼럼 | 20-35자 | 150-200자 | 2,000-2,500자 | 마크다운 |
| 주목 종목 | 기존 | 기존 | 1,000자 (detail) | 마크다운 |

**공통 규칙:**
- 마크다운 형식 사용 (###, **굵게**, > 인용 등)
- 이모지 사용 금지
- 단락 구분 명확히 (\n\n)

**추가 변경:**
- 스케줄러: 하루 2번 → 1번 (05:30만)
- 중복 방지: 어제 뉴스/칼럼/주목종목 제목 전송 (키워드 제외)

---

## Task 1: 시스템 프롬프트 개선

**Files:**
- Modify: `backend/app/services/newsdesk_ai.py`

**Step 1: `_get_system_prompt()` 메서드 교체**

```python
def _get_system_prompt(self) -> str:
    return """당신은 금융 뉴스 분석 전문가입니다. 주어진 뉴스 목록을 분석하여 뉴스데스크 콘텐츠를 생성합니다.

## 출력 규칙
1. 반드시 유효한 JSON 형식으로 출력
2. 모든 필드를 빠짐없이 채울 것
3. 한국어로 작성 (해외 뉴스도 한국어로 번역/요약)
4. 투자 조언이 아닌 정보 전달 목적임을 명심
5. 이모지 사용 금지
6. 마크다운 형식 사용 (###, **굵게**, > 인용블록 등)

---

## 뉴스 카드 작성 가이드

### UX 구조
- **메인 화면**: 제목 + 요약만 노출 (3초 안에 핵심 파악)
- **뷰어 모드**: 클릭 후 전체 본문 (2-3분 읽기)

### 제목 (15-25자)
- 역할: 관심 끌기 (Attention Grabbing)
- 기법: 숫자, 고유명사, 동사 활용
- 좋은 예: "SK하이닉스, HBM3E 12단 업계 최초 양산"
- 나쁜 예: "반도체 업계 소식" (너무 일반적)
- 체크: 제목만 봐도 "누가 무엇을 했는지" 명확한가?

### 요약 (100-150자, 2-3문장)
- 역할: 뉴스 가치 전달 (클릭 여부 결정)
- 구조: 핵심 팩트 + 왜 중요한가
- 좋은 예: "SK하이닉스가 HBM3E 12단 제품 양산을 시작했다. 기존 대비 용량 50% 증가하며 AI 반도체 시장 선점에 나섰다."
- 나쁜 예: "SK하이닉스가 신제품을 출시했다. 업계의 주목을 받고 있다." (구체성 부족)

### 본문 (800-1,200자)
- 역할: 상세 정보 제공
- 구조:
  1. 도입 (150자): 핵심 재확인 + 맥락
  2. 전개 (600자): 구체적 수치, 배경, 비교
  3. 마무리 (150자): 시장 반응, 향후 일정
- 단락을 3-4개로 나눠 가독성 확보
- 최소 3개 이상의 구체적 수치 포함

### 금기사항
- 제목/요약에 전문 용어 남발 금지
- 요약이 본문 복사 금지
- 단락 구분 없는 긴 텍스트 금지

---

## AI 칼럼 작성 가이드

### UX 구조
- **메인 화면**: 제목 + 요약 (3-5초 판단)
- **뷰어 모드**: 전체 칼럼 (5-7분 독서)

### 제목 (20-35자)
- 역할: 호기심 자극 (Curiosity Gap)
- 기법:
  - 질문형: "HBM 경쟁, 기술력보다 공급망이 승부처?"
  - 주장형: "반도체 호황, 이번엔 다르다"
  - 대조형: "삼성 vs SK하이닉스, 엇갈린 운명"

### 요약 (150-200자, 3-4문장)
- 역할: 칼럼의 핵심 주장 미리보기
- 구조: Hook(이슈) + 논지(핵심주장) + 시사점(읽어야 할 이유)

### 본문 (2,000-2,500자)
- 구조:
  1. **도입부 (300-400자)**: 최근 이슈로 Hook, 문제 제기, 논지 예고
  2. **본론1 (700-900자)**: 현황 분석, 데이터 3개+, 시계열/주체별 비교
  3. **본론2 (700-900자)**: 리스크와 기회, 긍정/부정 요인 각 3개
  4. **결론 (300-400자)**: 핵심 주장, 시사점, 향후 이벤트
- 소제목(###) 활용 권장
- 숫자와 핵심 문장은 **굵게**

### 금기사항
- 요약이 본문과 동일 금지
- 도입부 장황한 배경 설명 금지
- 데이터 없는 주장 금지
- 결론에 새로운 내용 금지

---

## 주목 종목 작성 가이드

### 구조
- **메인 화면**: 종목명, 순위, 언급횟수, 간단 사유
- **뷰어 모드**: 상세 분석 (detail 필드)

### detail (1,000자)
- 구조:
  1. **왜 주목받나 (200자)**: 오늘 화제가 된 이유
  2. **주요 언급 내용 (400자)**: 어떤 뉴스에서 어떻게 언급됐는지
  3. **종목 기본 정보 (200자)**: 시가총액, 업종, 주요 사업
  4. **시장 반응 (200자)**: 가격 변동, 거래량, 투자자 동향
- 마크다운 소제목(###) 사용
- 구체적 수치 필수

---

## 품질 체크리스트

### 메인 화면 (라이트 유저)
- 제목만 봐도 내용 감이 오는가?
- 요약 2-3문장이 명확한가?
- 3초 안에 "읽을까 말까" 판단 가능한가?

### 뷰어 모드 (클릭 후)
- 본문이 요약보다 실질적 정보를 더 제공하는가?
- 단락이 적절히 나뉘어 스크롤이 편한가?
- 읽고 나서 "시간 낭비" 느낌이 없는가?

### 중복 방지
- 어제 제목 리스트가 제공되면 동일/유사 제목 피할 것
- 키워드는 중복 허용"""
```

**Step 2: 커밋**

```bash
git add backend/app/services/newsdesk_ai.py
git commit -m "feat: Enhance newsdesk system prompt with UX guidelines"
```

---

## Task 2: 유저 프롬프트에 중복 방지 로직 추가

**Files:**
- Modify: `backend/app/services/newsdesk_ai.py`

**Step 1: 어제 뉴스데스크 조회 메서드 추가**

```python
def _get_yesterday_titles(self, target_date: date) -> Dict[str, List[str]]:
    """어제 뉴스데스크의 제목들 조회 (중복 방지용)"""
    from datetime import timedelta
    yesterday = target_date - timedelta(days=1)

    yesterday_newsdesk = self.db.query(NewsDesk).filter(
        NewsDesk.publish_date == yesterday,
        NewsDesk.status == "ready"
    ).first()

    if not yesterday_newsdesk:
        return {"columns": [], "news_cards": [], "top_stocks": []}

    return {
        "columns": [c.get("title", "") for c in (yesterday_newsdesk.columns or [])],
        "news_cards": [n.get("title", "") for n in (yesterday_newsdesk.news_cards or [])],
        "top_stocks": [s.get("name", "") for s in (yesterday_newsdesk.top_stocks or [])]
    }
```

**Step 2: `_build_prompt()` 수정하여 어제 제목 포함**

```python
def _build_prompt(self, target_date: date, news_text: str) -> str:
    yesterday_titles = self._get_yesterday_titles(target_date)

    duplicate_warning = ""
    if any(yesterday_titles.values()):
        duplicate_warning = f"""
## 중복 방지 (어제 사용된 제목들)
- 칼럼: {', '.join(yesterday_titles['columns']) or '없음'}
- 뉴스: {', '.join(yesterday_titles['news_cards'][:5]) or '없음'}
- 주목종목: {', '.join(yesterday_titles['top_stocks']) or '없음'}

위 제목들과 동일하거나 유사한 제목은 피해주세요. 같은 종목이라도 다른 관점으로 작성하세요.
"""

    return f"""# 뉴스데스크 콘텐츠 생성 요청

**날짜**: {target_date.strftime('%Y년 %m월 %d일')}
{duplicate_warning}
## 수집된 뉴스 목록
{news_text}

---

## 생성할 JSON 구조
... (기존 JSON 구조 유지)
"""
```

**Step 3: 커밋**

```bash
git add backend/app/services/newsdesk_ai.py
git commit -m "feat: Add duplicate prevention with yesterday's titles"
```

---

## Task 3: JSON 구조 업데이트 (본문 길이 명시)

**Files:**
- Modify: `backend/app/services/newsdesk_ai.py`

**Step 1: `_build_prompt()` 내 JSON 구조 주석 업데이트**

```python
# columns 부분
"content": "심층 분석 내용 (2,000-2,500자, 마크다운, 소제목 ### 사용)"

# news_cards 부분
"content": "상세 내용 (800-1,200자, 마크다운, 단락 구분)"

# top_stocks 부분
"detail": "종목 상세 분석 (1,000자, 마크다운, 왜 주목받나/주요 언급/기본정보/시장반응)"
```

**Step 2: 커밋**

```bash
git add backend/app/services/newsdesk_ai.py
git commit -m "feat: Update JSON schema with content length requirements"
```

---

## Task 4: 스케줄러 하루 1번으로 변경

**Files:**
- Modify: `backend/app/services/scheduler.py`

**Step 1: 오후 스케줄 제거**

```python
def init_scheduler():
    """스케줄러 초기화 - 하루 1번 (05:30)"""
    # 오전 5:30 뉴스데스크 생성
    scheduler.add_job(
        generate_newsdesk_job,
        CronTrigger(hour=5, minute=30),
        id="newsdesk_daily",
        replace_existing=True
    )
    # 오후 스케줄 제거됨

    scheduler.start()
    logger.info("Scheduler started: newsdesk_daily at 05:30")
```

**Step 2: 커밋**

```bash
git add backend/app/services/scheduler.py
git commit -m "feat: Change scheduler to once daily (05:30)"
```

---

## Task 5: 테스트 및 검증

**Step 1: 로컬에서 프롬프트 테스트**

```bash
cd backend
python -c "
from app.services.newsdesk_ai import NewsDeskAI
ai = NewsDeskAI(None)
print('=== System Prompt ===')
print(ai._get_system_prompt())
print()
print('Token count (approx):', len(ai._get_system_prompt()) // 4)
"
```

Expected: 시스템 프롬프트 출력, 약 1,500+ 토큰 (캐싱 조건 충족)

**Step 2: 커밋**

```bash
git add .
git commit -m "chore: Verify prompt caching requirements met"
```

---

## Task 6: 문서 업데이트

**Files:**
- Modify: `docs/TEST_SCENARIOS.md`

**Step 1: O4 시나리오 업데이트 (스케줄 변경)**

```markdown
### O4. 뉴스데스크 생성 (팀장)
...
**자동 생성**: 매일 오전 5:30 자동 실행 (1회/일)
```

**Step 2: 커밋**

```bash
git add docs/TEST_SCENARIOS.md
git commit -m "docs: Update newsdesk schedule to once daily"
```

---

## 최종 체크리스트

- [ ] 시스템 프롬프트 1,024+ 토큰 (캐싱 조건)
- [ ] 뉴스 카드 본문 800-1,200자 가이드
- [ ] AI 칼럼 본문 2,000-2,500자 가이드
- [ ] 주목 종목 detail 1,000자 가이드
- [ ] 마크다운 형식, 이모지 금지 명시
- [ ] 어제 제목 중복 방지 로직
- [ ] 스케줄러 하루 1번 (05:30)
