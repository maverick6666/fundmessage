# KST 타임존 버그 수정

> 날짜: 2026-02-10

## 문제
- `getKSTToday()`와 `getEffectiveNewsDeskDate()`가 **항상 UTC 날짜를 반환**
- 예: KST 2/10 03:00 = UTC 2/9 18:00 → `toISOString()` → "2026-02-09" 반환
- 결과: 2/10 뉴스데스크가 존재하는데 미래 날짜로 취급되어 접근 불가

## 원인
```javascript
// 잘못된 코드 (formatters.js)
const kstTime = new Date(utcTime + (kstOffset * 60000));
return kstTime.toISOString().split('T')[0]; // ← toISOString()은 항상 UTC!
```

`new Date()`로 KST 시간을 계산해도 `.toISOString()`은 **내부 UTC 타임스탬프** 기준으로 출력.
Date 객체의 내부 값은 변하지 않고, 단지 사람이 보기 좋게 offset을 더한 것일 뿐.

## 해결
```javascript
// Intl.DateTimeFormat 사용 (정확한 타임존 변환)
export function getKSTToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul'
  }).format(new Date());
}

export function getKSTHour() {
  return parseInt(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hour12: false
  }).format(new Date()));
}
```

- `en-CA` 로케일: `YYYY-MM-DD` 형식 반환 (ISO 호환)
- `en-GB` 로케일: 24시간제 시간 반환
- `timeZone: 'Asia/Seoul'` 옵션이 실제 KST 변환을 보장

## 핵심 교훈
- **JavaScript에서 타임존 처리 시 `toISOString()` 사용 금지** (항상 UTC)
- `Intl.DateTimeFormat`의 `timeZone` 옵션이 유일하게 정확한 방법
- 또는 서버에서 KST 날짜를 내려받아 사용

## 영향 파일
- `frontend/src/utils/formatters.js` (getKSTToday, getKSTHour, getEffectiveNewsDeskDate)

## 관련
- `patterns/kst-timezone.md` 참조
