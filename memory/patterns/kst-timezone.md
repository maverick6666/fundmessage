# KST 타임존 처리 패턴

## 프론트엔드 (JavaScript)

### 표준 패턴: Intl.DateTimeFormat 사용
```javascript
// KST 오늘 날짜 (YYYY-MM-DD)
export function getKSTToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul'
  }).format(new Date());
}

// KST 현재 시간 (0-23)
export function getKSTHour() {
  return parseInt(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hour12: false
  }).format(new Date()));
}
```

### 금지 패턴
```javascript
// WRONG: toISOString()은 항상 UTC
const kstTime = new Date(utcTime + (kstOffset * 60000));
return kstTime.toISOString().split('T')[0]; // ← 항상 UTC!

// WRONG: getTimezoneOffset() 수동 계산
// 서버/클라이언트 시간대에 따라 결과가 다름
```

### 적용 위치
- `frontend/src/utils/formatters.js`
  - `getKSTToday()`: 달력, 날짜 비교
  - `getKSTHour()`: 6시 이전 분기
  - `getEffectiveNewsDeskDate()`: 뉴스데스크 초기 날짜

---

## 백엔드 (Python)

### 표준 패턴: zoneinfo 사용
```python
from datetime import datetime
from zoneinfo import ZoneInfo

# KST 오늘 날짜
def get_korean_today():
    return datetime.now(ZoneInfo("Asia/Seoul")).date()

# KST 현재 시각
def get_korean_now():
    return datetime.now(ZoneInfo("Asia/Seoul"))
```

### 금지 패턴
```python
# WRONG: Docker 컨테이너 시간대 의존
from datetime import date
date.today()  # 컨테이너가 UTC이면 잘못된 날짜

# WRONG: UTC 변환 없이 비교
datetime.utcnow()  # naive datetime, 비교 불가
```

### 적용 위치
- `backend/app/api/newsdesk.py`: `get_korean_today()`
- `backend/app/services/scheduler.py`: `datetime.now(ZoneInfo("Asia/Seoul")).date()`
- APScheduler CronTrigger: `timezone=ZoneInfo("Asia/Seoul")` 필수

---

## 핵심 원칙
1. 프론트엔드: `Intl.DateTimeFormat` + `timeZone: 'Asia/Seoul'`
2. 백엔드: `zoneinfo.ZoneInfo("Asia/Seoul")` + `datetime.now(tz)`
3. DB: UTC로 저장, 비교 시 KST 변환
4. 스케줄러: CronTrigger에 반드시 `timezone` 파라미터
