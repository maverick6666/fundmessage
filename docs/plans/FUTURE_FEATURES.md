# 미래 기능 계획

> 이 문서는 나중에 구현할 기능들을 체계적으로 정리한 것입니다.
> "그때 말했던 거 하고 싶다"고 하면 이 문서를 참조하세요.

---

## B. 세션/기수 관리 (Fund Generation Management)

### 배경
펀드팀은 무한히 굴러가는 게 아니라 **기수 단위**로 운영됨 (예: 32기 → 33기)

### 필요한 기능

#### 1. 기수(세션) 모델
```
FundSession:
  - id
  - generation_number (32, 33, ...)
  - start_date
  - end_date (nullable - 진행중이면 null)
  - initial_capital_krw
  - initial_capital_usd
  - status (active, closed, transitioning)
```

#### 2. 승계 프로세스
1. 32기 팀장이 33기 인원들의 회원가입 승인
2. 33기 인원들은 처음에 `member` 역할
3. 32기 팀장이 33기 중 한 명에게 `manager` 역할 위임
4. 32기 팀장 본인은 `viewer` (전관예우) 또는 `admin`으로 변경
5. 승계 완료 시점에 자본금 재계산

#### 3. 자본 변동 기록
```
CapitalTransaction:
  - id
  - session_id
  - transaction_type (deposit, withdrawal, loan, investment, ...)
  - amount
  - currency (KRW, USD)
  - description
  - executed_by (user_id)
  - executed_at
```

#### 4. 전관예우
- 이전 기수 멤버들을 `viewer` 권한으로 변경
- 과거 데이터는 볼 수 있지만 수정/삭제 불가
- 현재 기수의 데이터도 읽기만 가능

#### 5. 승계 중 상태
- 32기와 33기가 동시에 존재하는 과도기
- `transitioning` 상태에서는 특정 작업 제한 가능
- 승계 완료 버튼으로 마무리

### 고려사항
- 승계 중 포지션은 어떻게? (자동 청산? 승계?)
- 과거 기수의 통계는 별도 조회 가능해야 함
- 기수별 리더보드/랭킹

---

## C. 멀티테넌시 (Multi-tenancy)

### 배경
이 펀드팀 메신저를 다른 대학 펀드팀도 사용할 수 있게 하려면?

### 필요한 기능

#### 1. 팀(테넌트) 모델
```
Team:
  - id
  - code (고유 코드, 예: "SNU_FUND", "YONSEI_INVEST")
  - name ("서울대 펀드팀", "연세대 투자동아리")
  - created_at
  - is_active
  - created_by (최초 등록한 super admin)
```

#### 2. 사용자-팀 연결
```
User 테이블에 추가:
  - team_id (FK to Team)
```

#### 3. 대학 코드 발급 방식

**옵션 A: 관리자가 직접 발급**
1. 계약 체결 후 super admin이 Team 레코드 생성
2. 해당 팀의 첫 팀장에게 초대 코드 발급
3. 첫 팀장이 초대 코드로 회원가입 → 자동으로 manager 역할

**옵션 B: 셀프 서비스**
1. 회원가입 시 "새 팀 생성" 옵션
2. 팀 생성자가 자동으로 manager
3. 팀 코드는 자동 생성 또는 직접 입력

**추천: 옵션 A** (계약 기반이므로 관리자 승인 필요)

#### 4. 데이터 격리
- 모든 쿼리에 `team_id` 필터 추가
- Position, Request, Discussion 등 모든 테이블에 team_id 추가
- API에서 current_user.team_id로 자동 필터링

#### 5. Super Admin 역할
```
UserRole에 추가:
  - SUPER_ADMIN (모든 팀 관리 가능)
```

### 고려사항
- 팀 간 데이터는 완전히 격리
- 팀별 설정 (TeamSettings)은 이미 있음 - team_id 연결 필요
- 팀별 요금제? (무료/유료 tier)

---

## 구현 순서 제안

1. **B. 세션/기수 관리** 먼저
   - 현재 사용 중인 팀에 바로 필요한 기능
   - 멀티테넌시 없이도 작동 가능

2. **C. 멀티테넌시** 나중에
   - B가 완성된 후 team_id 컬럼 추가
   - 기존 데이터는 default team으로 마이그레이션

---

## 관련 날짜
- 최초 논의: 2026-02-08
- 상태: 계획 단계 (미구현)
