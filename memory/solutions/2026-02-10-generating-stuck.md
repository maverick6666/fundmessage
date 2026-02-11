# generating 상태 멈춤 해결

> 날짜: 2026-02-10

## 문제
- 2/9 뉴스데스크가 `status='generating'`에서 영원히 멈춤
- AI 생성 중 오류 발생 시 status를 복구하는 메커니즘 없음
- 사용자가 재시도할 수 없는 교착 상태

## 원인
- `newsdesk.py`의 generating 체크가 무조건 차단만 함 (타임아웃 없음)
- AI 서비스 오류 시 except 블록에서 failed로 전환하지만, 네트워크 타임아웃 등으로 except에 도달하지 못하는 경우 존재

## 해결

### 1. 10분 타임아웃 자동 복구
```python
if existing and existing.status == "generating":
    elapsed = (datetime.now(ZoneInfo("Asia/Seoul")) -
               existing.updated_at.replace(tzinfo=ZoneInfo("UTC"))).total_seconds()
    if elapsed > 600:  # 10분
        existing.status = "failed"
        existing.error_message = "생성 시간 초과 (자동 복구)"
        db.commit()
        # fall through → 아래 재생성 로직
    else:
        db.commit()
        raise HTTPException(status_code=400, ...)
```

### 2. 재시도 횟수 제한 (최대 3회)
```python
# ready → 재생성 차단 (성공한 건 보호)
if existing and existing.status == "ready" and existing.generation_count >= 1:
    raise HTTPException(status_code=429, ...)

# 전체 시도 3회 초과 → 차단
if existing and existing.generation_count and existing.generation_count >= 3:
    raise HTTPException(status_code=429, ...)
```

### 3. 재시도 시 전체 플로우 동일 실행
- 크롤러 + AI 전체 플로우를 재실행
- 크롤러는 DB 중복 체크(link+newsdesk_date)로 이미 수집된 뉴스 스킵
- 별도 분기 없이 동일한 코드 경로 사용

## 영향 파일
- `backend/app/api/newsdesk.py`

## DB 수동 복구 (일회성)
```sql
UPDATE news_desks SET status='failed', error_message='생성 시간 초과 (수동 복구)'
WHERE publish_date='2026-02-09' AND status='generating';
```
