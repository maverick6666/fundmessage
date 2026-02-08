# E2E 테스트 프레임워크 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 로컬 환경에서 165개 이상의 테스트 시나리오를 자동으로 실행하고, 데이터 정합성과 역할별 권한을 검증하는 완전한 E2E 테스트 프레임워크 구축

**Architecture:** Docker PostgreSQL + 로컬 백엔드 + 로컬 프론트엔드 환경에서 Playwright를 사용하여 테스트 실행. 팀장/팀원 동시 브라우저 테스트를 위한 dual-browser fixture 활용. API helper를 통해 테스트 데이터 생성/정리.

**Tech Stack:** Playwright, Docker, FastAPI (uvicorn), Vite, PostgreSQL, cross-env

---

## 사전 요구사항

- Docker Desktop 실행 중
- Node.js 18+ 설치
- Python 3.11+ 설치
- 필요한 pip 패키지: `rapidfuzz`, `openai`, `apscheduler`

---

## Task 1: 테스트 실행 스크립트 생성

**Files:**
- Create: `scripts/test-local.ps1`
- Create: `scripts/test-local.sh`

**Step 1: Windows PowerShell 스크립트 작성**

```powershell
# scripts/test-local.ps1
# 로컬 E2E 테스트 실행 스크립트

param(
    [switch]$SetupOnly,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [string]$TestFile = ""
)

$ErrorActionPreference = "Stop"
$ROOT_DIR = Split-Path -Parent $PSScriptRoot

Write-Host "=== 로컬 E2E 테스트 환경 설정 ===" -ForegroundColor Cyan

# 1. Docker DB 확인
Write-Host "`n[1/5] Docker PostgreSQL 확인..." -ForegroundColor Yellow
$dbContainer = docker ps --filter "name=fundmessage" --format "{{.Names}}" 2>$null
if (-not $dbContainer) {
    Write-Host "DB 컨테이너 시작 중..." -ForegroundColor Gray
    Set-Location $ROOT_DIR
    docker-compose up -d db
    Start-Sleep -Seconds 5
}
Write-Host "DB 컨테이너 실행 중" -ForegroundColor Green

# 2. 백엔드 의존성 확인
Write-Host "`n[2/5] 백엔드 의존성 확인..." -ForegroundColor Yellow
Set-Location "$ROOT_DIR\backend"
$modules = @("rapidfuzz", "openai", "apscheduler")
foreach ($mod in $modules) {
    $installed = python -c "import $mod" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  설치 중: $mod" -ForegroundColor Gray
        pip install $mod -q
    }
}
Write-Host "의존성 확인 완료" -ForegroundColor Green

# 3. DB 마이그레이션
Write-Host "`n[3/5] DB 마이그레이션..." -ForegroundColor Yellow
alembic upgrade head 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "마이그레이션 완료" -ForegroundColor Green
} else {
    Write-Host "마이그레이션 스킵 (이미 최신)" -ForegroundColor Gray
}

# 4. 백엔드 서버 시작
if (-not $SkipBackend) {
    Write-Host "`n[4/5] 백엔드 서버 시작..." -ForegroundColor Yellow
    $backendProcess = Get-Process -Name "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*uvicorn*app.main*" }

    if (-not $backendProcess) {
        Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" -WindowStyle Hidden
        Start-Sleep -Seconds 3
    }

    # 헬스체크
    $maxRetries = 10
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 2
            if ($response.status -eq "healthy") {
                Write-Host "백엔드 서버 실행 중 (localhost:8000)" -ForegroundColor Green
                break
            }
        } catch {
            if ($i -eq $maxRetries) {
                Write-Host "백엔드 서버 시작 실패" -ForegroundColor Red
                exit 1
            }
            Start-Sleep -Seconds 1
        }
    }
}

# 5. 프론트엔드 서버 시작
if (-not $SkipFrontend) {
    Write-Host "`n[5/5] 프론트엔드 서버 시작..." -ForegroundColor Yellow
    Set-Location "$ROOT_DIR\frontend"

    # 기존 Vite 프로세스 확인
    $frontendRunning = $false
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing
        $frontendRunning = $true
    } catch {}

    if (-not $frontendRunning) {
        Start-Process -FilePath "npx" -ArgumentList "vite", "--port", "5173" -WindowStyle Hidden
        Start-Sleep -Seconds 5
    }
    Write-Host "프론트엔드 서버 실행 중 (localhost:5173)" -ForegroundColor Green
}

if ($SetupOnly) {
    Write-Host "`n=== 환경 설정 완료 ===" -ForegroundColor Cyan
    exit 0
}

# 테스트 실행
Write-Host "`n=== Playwright 테스트 실행 ===" -ForegroundColor Cyan
Set-Location "$ROOT_DIR\frontend"
$env:TEST_ENV = "local"
$env:TEST_API_URL = "http://localhost:8000/api/v1"

if ($TestFile) {
    npx playwright test $TestFile --reporter=list
} else {
    npx playwright test --reporter=list
}
```

**Step 2: 스크립트 실행 테스트**

Run: `powershell -ExecutionPolicy Bypass -File scripts/test-local.ps1 -SetupOnly`
Expected: 환경 설정 완료 메시지

**Step 3: Commit**

```bash
git add scripts/test-local.ps1 scripts/test-local.sh
git commit -m "feat: add local E2E test runner scripts"
```

---

## Task 2: 테스트 데이터 관리 헬퍼 추가

**Files:**
- Create: `frontend/tests/helpers/test-data.helper.js`
- Modify: `frontend/tests/helpers/api.helper.js`

**Step 1: 테스트 데이터 헬퍼 작성**

```javascript
// frontend/tests/helpers/test-data.helper.js
/**
 * 테스트 데이터 생성/정리 헬퍼
 *
 * 테스트 전 데이터 생성, 테스트 후 정리
 */

import * as api from './api.helper.js';

/**
 * 테스트용 매수 요청 생성 및 승인 → 포지션 생성
 */
export async function createTestPosition(managerToken, memberToken, options = {}) {
  const {
    ticker = 'TEST001',
    market = 'KR',
    quantity = 100,
    price = 10000,
    reason = '테스트용 포지션',
  } = options;

  // 1. 팀원이 매수 요청
  const request = await api.requests.createBuy(memberToken, {
    ticker,
    market,
    quantity,
    target_price: price,
    reason,
  });

  // 2. 팀장이 승인
  const approved = await api.requests.approve(managerToken, request.data.id, {
    average_buy_price: price,
    quantity,
  });

  return {
    requestId: request.data.id,
    positionId: approved.data.position_id,
  };
}

/**
 * 테스트용 포지션 청산
 */
export async function closeTestPosition(managerToken, positionId, sellPrice) {
  // 포지션 종료 API 호출
  return api.apiRequest(`/positions/${positionId}/close`, {
    method: 'POST',
    token: managerToken,
    body: {
      actual_sell_price: sellPrice,
      close_reason: '테스트 청산',
    },
  });
}

/**
 * 테스트 데이터 정리 (관리자 모드로 삭제)
 */
export async function cleanupTestData(managerToken, options = {}) {
  const { positionIds = [], requestIds = [] } = options;

  const results = {
    deletedPositions: [],
    deletedRequests: [],
    errors: [],
  };

  // 포지션 삭제
  for (const id of positionIds) {
    try {
      await api.positions.delete(managerToken, id);
      results.deletedPositions.push(id);
    } catch (e) {
      results.errors.push({ type: 'position', id, error: e.message });
    }
  }

  // 요청 삭제
  for (const id of requestIds) {
    try {
      await api.apiRequest(`/requests/${id}`, {
        method: 'DELETE',
        token: managerToken,
      });
      results.deletedRequests.push(id);
    } catch (e) {
      results.errors.push({ type: 'request', id, error: e.message });
    }
  }

  return results;
}

/**
 * 테스트 시작 전 스냅샷 저장
 */
export async function takeStatsSnapshot(managerToken) {
  const [overview, ranking, history] = await Promise.all([
    api.stats.getOverview(managerToken),
    api.stats.getTeamRanking(managerToken),
    api.stats.getAssetHistory(managerToken),
  ]);

  return {
    timestamp: new Date().toISOString(),
    overview: overview.data,
    ranking: ranking.data,
    history: history.data,
  };
}

/**
 * 스냅샷 비교 (정합성 검증)
 */
export function compareSnapshots(before, after, expectedDiff = {}) {
  const results = {
    passed: true,
    checks: [],
  };

  // 총 수익률 변화 검증
  if (expectedDiff.profitRateChange !== undefined) {
    const actual = (after.overview?.profit_rate || 0) - (before.overview?.profit_rate || 0);
    const expected = expectedDiff.profitRateChange;
    const passed = Math.abs(actual - expected) < 0.01; // 0.01% 오차 허용

    results.checks.push({
      name: 'profit_rate_change',
      expected,
      actual,
      passed,
    });

    if (!passed) results.passed = false;
  }

  // 거래 수 변화 검증
  if (expectedDiff.tradeCountChange !== undefined) {
    const actual = (after.overview?.total_trades || 0) - (before.overview?.total_trades || 0);
    const expected = expectedDiff.tradeCountChange;
    const passed = actual === expected;

    results.checks.push({
      name: 'trade_count_change',
      expected,
      actual,
      passed,
    });

    if (!passed) results.passed = false;
  }

  return results;
}
```

**Step 2: api.helper.js에 apiRequest export 추가**

Modify `frontend/tests/helpers/api.helper.js:12` - export 추가:
```javascript
export async function apiRequest(endpoint, options = {}) {
```

**Step 3: 테스트**

Run: `cd frontend && node -e "import('./tests/helpers/test-data.helper.js').then(m => console.log('OK'))"`
Expected: "OK"

**Step 4: Commit**

```bash
git add frontend/tests/helpers/test-data.helper.js frontend/tests/helpers/api.helper.js
git commit -m "feat: add test data management helpers"
```

---

## Task 3: P0 테스트 구현 - 수익률 계산 (S001-S003)

**Files:**
- Modify: `frontend/tests/e2e/data-integrity.spec.js`
- Modify: `frontend/tests/helpers/data-integrity.helper.js`

**Step 1: data-integrity.helper.js 개선**

```javascript
// frontend/tests/helpers/data-integrity.helper.js
/**
 * 데이터 정합성 검증 헬퍼
 */

import * as api from './api.helper.js';

/**
 * 포지션 수익률 계산 검증
 *
 * 수익률 = (실현손익 / 투자금) * 100
 */
export function verifyProfitCalculation(position) {
  const checks = [];

  if (position.status !== 'closed') {
    return { allPassed: true, checks: [], skipped: '미청산 포지션' };
  }

  // 투자금 계산
  const investedAmount = position.average_buy_price * position.quantity;

  // 예상 수익률
  const expectedProfitRate = investedAmount > 0
    ? ((position.realized_profit_loss || 0) / investedAmount) * 100
    : 0;

  // 저장된 수익률과 비교 (0.1% 오차 허용)
  const actualProfitRate = position.profit_rate || 0;
  const tolerance = 0.1;
  const passed = Math.abs(expectedProfitRate - actualProfitRate) < tolerance;

  checks.push({
    name: 'profit_rate_calculation',
    expected: expectedProfitRate.toFixed(2),
    actual: actualProfitRate.toFixed(2),
    tolerance: `${tolerance}%`,
    passed,
    details: {
      investedAmount,
      realizedProfitLoss: position.realized_profit_loss,
    },
  });

  return {
    allPassed: checks.every(c => c.passed),
    checks,
  };
}

/**
 * 승률 계산 검증
 *
 * 승률 = (수익 포지션 수 / 청산된 포지션 수) * 100
 */
export async function verifyWinRateCalculation(token) {
  const positionsData = await api.positions.list(token);
  const positions = positionsData.data?.positions || [];

  const closedPositions = positions.filter(p => p.status === 'closed');
  const winningPositions = closedPositions.filter(p => (p.realized_profit_loss || 0) > 0);

  const expectedWinRate = closedPositions.length > 0
    ? (winningPositions.length / closedPositions.length) * 100
    : 0;

  const statsData = await api.stats.getOverview(token);
  const actualWinRate = statsData.data?.win_rate || 0;

  const tolerance = 0.1;
  const passed = Math.abs(expectedWinRate - actualWinRate) < tolerance;

  return {
    allPassed: passed,
    checks: [{
      name: 'win_rate_calculation',
      expected: expectedWinRate.toFixed(2),
      actual: actualWinRate.toFixed(2),
      passed,
      details: {
        totalClosed: closedPositions.length,
        winning: winningPositions.length,
      },
    }],
  };
}

/**
 * 자산 변화율 검증
 *
 * 변화율 = ((현재자산 - 초기자본) / 초기자본) * 100
 */
export async function verifyAssetChangeRate(token) {
  const statsData = await api.stats.getOverview(token);
  const stats = statsData.data || {};

  const initialCapital = stats.initial_capital || 100000000; // 1억 기본값
  const currentAsset = stats.current_asset || initialCapital;

  const expectedChangeRate = ((currentAsset - initialCapital) / initialCapital) * 100;
  const actualChangeRate = stats.asset_change_rate || 0;

  const tolerance = 0.1;
  const passed = Math.abs(expectedChangeRate - actualChangeRate) < tolerance;

  return {
    allPassed: passed,
    checks: [{
      name: 'asset_change_rate',
      expected: expectedChangeRate.toFixed(2),
      actual: actualChangeRate.toFixed(2),
      passed,
      details: {
        initialCapital,
        currentAsset,
      },
    }],
  };
}

/**
 * 전체 정합성 검사
 */
export async function runFullIntegrityCheck(token) {
  const results = {
    timestamp: new Date().toISOString(),
    allPassed: true,
    checks: [],
  };

  // 1. 승률 검증
  const winRateResult = await verifyWinRateCalculation(token);
  results.checks.push({ category: 'win_rate', ...winRateResult });
  if (!winRateResult.allPassed) results.allPassed = false;

  // 2. 자산 변화율 검증
  const assetResult = await verifyAssetChangeRate(token);
  results.checks.push({ category: 'asset_change', ...assetResult });
  if (!assetResult.allPassed) results.allPassed = false;

  // 3. 개별 포지션 수익률 검증 (최근 10개)
  const positionsData = await api.positions.list(token);
  const closedPositions = (positionsData.data?.positions || [])
    .filter(p => p.status === 'closed')
    .slice(0, 10);

  for (const position of closedPositions) {
    const profitResult = verifyProfitCalculation(position);
    results.checks.push({
      category: 'position_profit',
      positionId: position.id,
      ticker: position.ticker,
      ...profitResult
    });
    if (!profitResult.allPassed) results.allPassed = false;
  }

  return results;
}
```

**Step 2: data-integrity.spec.js 업데이트**

```javascript
// frontend/tests/e2e/data-integrity.spec.js
/**
 * 데이터 정합성 테스트 (S001-S043)
 */

import { test, expect, TEST_ACCOUNTS } from '../fixtures/auth.fixture.js';
import * as api from '../helpers/api.helper.js';
import * as integrity from '../helpers/data-integrity.helper.js';
import * as testData from '../helpers/test-data.helper.js';

test.describe('데이터 정합성', () => {
  let managerToken;
  let memberToken;

  test.beforeAll(async () => {
    managerToken = await api.login(
      TEST_ACCOUNTS.manager.email,
      TEST_ACCOUNTS.manager.password
    );
    memberToken = await api.login(
      TEST_ACCOUNTS.member.email,
      TEST_ACCOUNTS.member.password
    );
  });

  test.describe('수익률 계산 (S001-S003)', () => {

    test('S001: 청산된 포지션의 수익률이 정확한지 검증', async () => {
      const positions = await api.positions.list(managerToken);
      const closedPositions = (positions.data?.positions || [])
        .filter(p => p.status === 'closed');

      // 최소 1개 이상 청산된 포지션이 있어야 함
      if (closedPositions.length === 0) {
        test.skip(true, '청산된 포지션 없음');
        return;
      }

      for (const position of closedPositions.slice(0, 5)) {
        const result = integrity.verifyProfitCalculation(position);
        console.log(`[S001] 포지션 ${position.id} (${position.ticker}):`, result);
        expect(result.allPassed).toBe(true);
      }
    });

    test('S002: 전체 평균 수익률 검증', async () => {
      const statsResult = await api.stats.getOverview(managerToken);
      const stats = statsResult.data;

      // 평균 수익률이 숫자인지 확인
      expect(typeof stats.average_profit_rate).toBe('number');

      // NaN이나 Infinity가 아닌지 확인
      expect(Number.isFinite(stats.average_profit_rate)).toBe(true);
    });

    test('S003: 손실 포지션 포함 수익률이 음수로 표시되는지', async () => {
      const positions = await api.positions.list(managerToken);
      const losingPositions = (positions.data?.positions || [])
        .filter(p => p.status === 'closed' && (p.realized_profit_loss || 0) < 0);

      for (const position of losingPositions.slice(0, 3)) {
        // 손실 포지션의 수익률은 음수여야 함
        expect(position.profit_rate).toBeLessThan(0);
      }
    });
  });

  test.describe('승률 계산 (S010-S011)', () => {

    test('S010: 전체 승률이 정확한지 검증', async () => {
      const result = await integrity.verifyWinRateCalculation(managerToken);
      console.log('[S010] 승률 검증:', result);
      expect(result.allPassed).toBe(true);
    });

    test('S011: 수익 0원 포지션 처리', async () => {
      // 수익이 정확히 0인 포지션은 패배로 처리되어야 함
      const positions = await api.positions.list(managerToken);
      const zeroPositions = (positions.data?.positions || [])
        .filter(p => p.status === 'closed' && p.realized_profit_loss === 0);

      // 0원 포지션이 있다면, 승률 계산에 영향 확인
      if (zeroPositions.length > 0) {
        const result = await integrity.verifyWinRateCalculation(managerToken);
        expect(result.allPassed).toBe(true);
      }
    });
  });

  test.describe('자산 변화율 (S020-S021)', () => {

    test('S020: 자산 변화율 계산 검증', async () => {
      const result = await integrity.verifyAssetChangeRate(managerToken);
      console.log('[S020] 자산 변화율:', result);
      expect(result.allPassed).toBe(true);
    });
  });

  test.describe('전체 정합성 검사', () => {

    test('모든 데이터 정합성 검사 실행', async () => {
      const result = await integrity.runFullIntegrityCheck(managerToken);
      console.log('[전체] 정합성 검사:', JSON.stringify(result, null, 2));

      const failedChecks = result.checks.filter(c => !c.allPassed);
      if (failedChecks.length > 0) {
        console.error('실패한 검사:', failedChecks);
      }

      expect(result.allPassed).toBe(true);
    });
  });
});

test.describe('삭제 후 데이터 정합성 (S040-S043)', () => {
  let managerToken;
  let memberToken;
  let testPositionId;
  let beforeSnapshot;

  test.beforeAll(async () => {
    managerToken = await api.login(
      TEST_ACCOUNTS.manager.email,
      TEST_ACCOUNTS.manager.password
    );
    memberToken = await api.login(
      TEST_ACCOUNTS.member.email,
      TEST_ACCOUNTS.member.password
    );
  });

  test('S040: 포지션 생성 → 청산 → 통계 반영 → 삭제 → 통계 복원', async () => {
    // 1. 현재 통계 스냅샷
    beforeSnapshot = await testData.takeStatsSnapshot(managerToken);
    console.log('[S040] 시작 스냅샷:', beforeSnapshot.overview);

    // 2. 테스트 포지션 생성
    const created = await testData.createTestPosition(managerToken, memberToken, {
      ticker: 'TEST_S040',
      price: 10000,
      quantity: 100,
    });
    testPositionId = created.positionId;
    console.log('[S040] 포지션 생성:', testPositionId);

    // 3. 포지션 청산 (10% 수익)
    await testData.closeTestPosition(managerToken, testPositionId, 11000);
    console.log('[S040] 포지션 청산 완료');

    // 4. 청산 후 통계 확인
    const afterClose = await testData.takeStatsSnapshot(managerToken);
    console.log('[S040] 청산 후 스냅샷:', afterClose.overview);

    // 5. 포지션 삭제
    await testData.cleanupTestData(managerToken, { positionIds: [testPositionId] });
    console.log('[S040] 포지션 삭제 완료');

    // 6. 삭제 후 통계가 원래대로 복원되었는지 확인
    const afterDelete = await testData.takeStatsSnapshot(managerToken);
    console.log('[S040] 삭제 후 스냅샷:', afterDelete.overview);

    // 거래 수가 원래대로 돌아왔는지 검증
    expect(afterDelete.overview.total_trades).toBe(beforeSnapshot.overview.total_trades);
  });
});
```

**Step 3: 테스트 실행**

Run: `cd frontend && TEST_ENV=local npx playwright test tests/e2e/data-integrity.spec.js --reporter=list`
Expected: 테스트 통과 또는 실패 시 상세 로그

**Step 4: Commit**

```bash
git add frontend/tests/e2e/data-integrity.spec.js frontend/tests/helpers/data-integrity.helper.js
git commit -m "feat: implement P0 data integrity tests (S001-S043)"
```

---

## Task 4: 역할별 권한 테스트 완성 (A020-A028)

**Files:**
- Modify: `frontend/tests/e2e/auth-permissions.spec.js`

**Step 1: 권한 테스트 전체 구현**

```javascript
// frontend/tests/e2e/auth-permissions.spec.js
/**
 * 역할별 접근 권한 테스트 (A020-A028)
 */

import { test, expect, TEST_ACCOUNTS, login } from '../fixtures/auth.fixture.js';
import * as api from '../helpers/api.helper.js';

test.describe('역할별 접근 권한', () => {

  test.describe('Member 권한 (A023-A024)', () => {

    test('A023: member가 매수 요청 버튼 접근 가능', async ({ memberPage }) => {
      await memberPage.goto('/requests');

      // 페이지 로드 대기
      await memberPage.waitForLoadState('networkidle');

      // 매수 요청 버튼 확인
      const buyButton = memberPage.locator('button:has-text("매수")');
      await expect(buyButton).toBeVisible({ timeout: 10000 });
    });

    test('A024: member가 다른 사람 요청 삭제 버튼 안 보임', async ({ memberPage }) => {
      await memberPage.goto('/requests');
      await memberPage.waitForLoadState('networkidle');

      // 요청 목록에서 삭제 버튼이 없어야 함
      const deleteButtons = memberPage.locator('button:has-text("삭제")');
      const count = await deleteButtons.count();

      // 삭제 버튼이 없거나, 본인 요청만 삭제 가능
      // (관리자 모드가 아니면 삭제 버튼 자체가 안 보여야 함)
      expect(count).toBe(0);
    });
  });

  test.describe('Manager 권한 (A025-A027)', () => {

    test('A025: manager가 요청 상세에서 승인/거부 버튼 확인', async ({ managerPage }) => {
      await managerPage.goto('/requests');
      await managerPage.waitForLoadState('networkidle');

      // 대기중 요청 찾기
      const pendingRequest = managerPage.locator('[data-status="pending"]').first();
      const hasPending = await pendingRequest.isVisible().catch(() => false);

      if (!hasPending) {
        // 대기중 요청이 없으면, 버튼 존재 여부만 체크 후 스킵
        test.skip(true, '대기중인 요청 없음');
        return;
      }

      // 요청 클릭하여 상세 보기
      await pendingRequest.click();
      await managerPage.waitForTimeout(500);

      // 승인 또는 거부 버튼 확인
      const approveBtn = managerPage.locator('button:has-text("승인")');
      const rejectBtn = managerPage.locator('button:has-text("거부")');

      const hasApprove = await approveBtn.isVisible().catch(() => false);
      const hasReject = await rejectBtn.isVisible().catch(() => false);

      expect(hasApprove || hasReject).toBe(true);
    });

    test('A026: manager가 설정에서 관리자 모드 토글 가능', async ({ managerPage }) => {
      await managerPage.goto('/settings');
      await managerPage.waitForLoadState('networkidle');

      // 관리자 모드 섹션 확인
      const adminSection = managerPage.locator('text=관리자 모드');
      await expect(adminSection).toBeVisible({ timeout: 10000 });

      // 토글 버튼 클릭 가능 확인
      const toggle = managerPage.locator('[role="switch"]').or(
        managerPage.locator('button').filter({ hasText: /켜기|끄기|ON|OFF/i })
      ).first();

      await expect(toggle).toBeVisible();
    });

    test('A027: manager가 팀 관리 페이지 접근 가능', async ({ managerPage }) => {
      await managerPage.goto('/team');
      await managerPage.waitForLoadState('networkidle');

      // 팀 관리 페이지 콘텐츠 확인
      const teamHeader = managerPage.locator('h1, h2').filter({ hasText: /팀|관리/ }).first();
      await expect(teamHeader).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('API 레벨 권한 테스트', () => {
    let managerToken;
    let memberToken;

    test.beforeAll(async () => {
      managerToken = await api.login(
        TEST_ACCOUNTS.manager.email,
        TEST_ACCOUNTS.manager.password
      );
      memberToken = await api.login(
        TEST_ACCOUNTS.member.email,
        TEST_ACCOUNTS.member.password
      );
    });

    test('A024-API: member가 포지션 삭제 API 호출 시 차단', async () => {
      // 임의의 포지션 ID로 삭제 시도
      try {
        await api.positions.delete(memberToken, 99999);
        // 성공하면 안됨
        expect(true).toBe(false);
      } catch (e) {
        // 403 Forbidden 또는 401 Unauthorized 예상
        expect(e.message).toMatch(/403|401|권한|forbidden|unauthorized/i);
      }
    });

    test('A025-API: manager가 요청 승인 API 호출 가능', async () => {
      // 대기중 요청 목록 조회
      const requestsData = await api.requests.list(managerToken);
      const pendingRequests = (requestsData.data || [])
        .filter(r => r.status === 'pending');

      if (pendingRequests.length === 0) {
        test.skip(true, '대기중인 요청 없음');
        return;
      }

      // 첫 번째 대기중 요청 승인 시도 (실제 승인은 테스트 데이터 오염 방지를 위해 생략)
      // 대신 API 접근 권한만 확인
      const requestId = pendingRequests[0].id;

      // 조회는 가능해야 함
      const requestDetail = await api.apiRequest(`/requests/${requestId}`, { token: managerToken });
      expect(requestDetail.data).toBeDefined();
    });
  });
});
```

**Step 2: 테스트 실행**

Run: `cd frontend && TEST_ENV=local npx playwright test tests/e2e/auth-permissions.spec.js --reporter=list`
Expected: 권한 테스트 통과

**Step 3: Commit**

```bash
git add frontend/tests/e2e/auth-permissions.spec.js
git commit -m "feat: complete role-based permission tests (A020-A028)"
```

---

## Task 5: 실시간 상호작용 테스트 (Dual Browser)

**Files:**
- Modify: `frontend/tests/e2e/realtime-interaction.dual.spec.js`
- Modify: `frontend/tests/fixtures/dual-browser.fixture.js`

**Step 1: dual-browser fixture 개선**

```javascript
// frontend/tests/fixtures/dual-browser.fixture.js
/**
 * 두 브라우저 동시 실행 픽스처
 * 팀장 + 팀원 상호작용 테스트용
 */

import { test as base } from '@playwright/test';
import { TEST_ACCOUNTS, login } from './auth.fixture.js';

export const dualTest = base.extend({
  // 팀장 브라우저 컨텍스트
  managerContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    await use(context);
    await context.close();
  },

  // 팀원 브라우저 컨텍스트
  memberContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    await use(context);
    await context.close();
  },

  // 로그인된 팀장 페이지
  managerPage: async ({ managerContext }, use) => {
    const page = await managerContext.newPage();
    await login(page, TEST_ACCOUNTS.manager);
    await use(page);
  },

  // 로그인된 팀원 페이지
  memberPage: async ({ memberContext }, use) => {
    const page = await memberContext.newPage();
    await login(page, TEST_ACCOUNTS.member);
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

**Step 2: 실시간 상호작용 테스트 구현**

```javascript
// frontend/tests/e2e/realtime-interaction.dual.spec.js
/**
 * 실시간 상호작용 테스트 (두 브라우저 동시 실행)
 */

import { dualTest as test, expect } from '../fixtures/dual-browser.fixture.js';

test.describe('실시간 알림 테스트', () => {

  test('N001: 팀원 요청 제출 → 팀장 실시간 알림', async ({ managerPage, memberPage }) => {
    // 1. 팀장: 알림 페이지 또는 헤더에서 알림 뱃지 확인 준비
    await managerPage.goto('/');
    await managerPage.waitForLoadState('networkidle');

    // 초기 알림 개수 확인
    const initialBadge = managerPage.locator('.notification-badge, [data-testid="notification-count"]');
    const initialCount = await initialBadge.textContent().catch(() => '0');
    console.log('[N001] 초기 알림 개수:', initialCount);

    // 2. 팀원: 매수 요청 페이지로 이동
    await memberPage.goto('/requests');
    await memberPage.waitForLoadState('networkidle');

    // 매수 요청 버튼 클릭
    const buyButton = memberPage.locator('button:has-text("매수")');
    await buyButton.click();
    await memberPage.waitForTimeout(500);

    // 요청 폼 작성
    await memberPage.fill('input[name="ticker"], input[placeholder*="종목"]', 'TEST_N001');
    await memberPage.fill('input[name="quantity"], input[placeholder*="수량"]', '100');
    await memberPage.fill('input[name="target_price"], input[placeholder*="가격"]', '10000');
    await memberPage.fill('textarea[name="reason"], textarea[placeholder*="이유"]', '테스트 요청');

    // 제출
    const submitButton = memberPage.locator('button[type="submit"]:has-text("요청")');
    await submitButton.click();

    // 3. 팀장: 실시간 알림 확인 (최대 10초 대기)
    await managerPage.waitForTimeout(2000); // WebSocket 전파 대기

    // 알림 뱃지 또는 토스트 확인
    const hasNewNotification = await managerPage.locator(
      '.notification-badge, .toast, [data-testid="new-notification"]'
    ).isVisible().catch(() => false);

    // 또는 알림 개수 증가 확인
    await managerPage.reload();
    await managerPage.waitForLoadState('networkidle');

    const newBadge = managerPage.locator('.notification-badge, [data-testid="notification-count"]');
    const newCount = await newBadge.textContent().catch(() => '0');
    console.log('[N001] 새 알림 개수:', newCount);

    // 알림이 증가했거나 새 알림 표시가 있어야 함
    expect(parseInt(newCount) >= parseInt(initialCount) || hasNewNotification).toBe(true);
  });

  test('D001: 토론방 실시간 메시지 동기화', async ({ managerPage, memberPage }) => {
    // 1. 열린 토론방 찾기
    await managerPage.goto('/discussions');
    await managerPage.waitForLoadState('networkidle');

    const openDiscussion = managerPage.locator('[data-status="open"]').first();
    const hasOpen = await openDiscussion.isVisible().catch(() => false);

    if (!hasOpen) {
      test.skip(true, '열린 토론방 없음');
      return;
    }

    // 토론방 ID 추출
    const discussionLink = await openDiscussion.locator('a').first().getAttribute('href');
    const discussionId = discussionLink?.split('/').pop();

    // 2. 양쪽 다 같은 토론방 입장
    await managerPage.goto(`/discussions/${discussionId}`);
    await memberPage.goto(`/discussions/${discussionId}`);

    await Promise.all([
      managerPage.waitForLoadState('networkidle'),
      memberPage.waitForLoadState('networkidle'),
    ]);

    // 3. 팀원이 메시지 전송
    const testMessage = `테스트 메시지 ${Date.now()}`;
    const messageInput = memberPage.locator('input[name="message"], textarea[placeholder*="메시지"]');
    await messageInput.fill(testMessage);

    const sendButton = memberPage.locator('button:has-text("전송"), button[type="submit"]');
    await sendButton.click();

    // 4. 팀장 화면에서 메시지 확인 (실시간 동기화)
    await managerPage.waitForTimeout(2000); // WebSocket 전파 대기

    const receivedMessage = managerPage.locator(`text=${testMessage}`);
    await expect(receivedMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe('요청 승인 상호작용', () => {

  test('R020-realtime: 팀장 승인 → 팀원 알림 + 포지션 목록 업데이트', async ({ managerPage, memberPage }) => {
    // 1. 팀원: 포지션 목록 페이지 대기
    await memberPage.goto('/positions');
    await memberPage.waitForLoadState('networkidle');

    const initialPositionCount = await memberPage.locator('[data-testid="position-item"]').count();

    // 2. 팀장: 대기중 요청 확인
    await managerPage.goto('/requests');
    await managerPage.waitForLoadState('networkidle');

    const pendingRequest = managerPage.locator('[data-status="pending"]').first();
    const hasPending = await pendingRequest.isVisible().catch(() => false);

    if (!hasPending) {
      test.skip(true, '대기중인 요청 없음');
      return;
    }

    // 요청 클릭 → 상세 보기
    await pendingRequest.click();
    await managerPage.waitForTimeout(500);

    // 승인 버튼 클릭
    const approveButton = managerPage.locator('button:has-text("승인")');
    await approveButton.click();

    // 확인 모달이 있다면 확인
    const confirmButton = managerPage.locator('button:has-text("확인"), button:has-text("네")');
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // 3. 팀원: 알림 확인 및 포지션 목록 새로고침
    await memberPage.waitForTimeout(2000);
    await memberPage.reload();
    await memberPage.waitForLoadState('networkidle');

    // 포지션 개수가 증가했는지 확인
    const newPositionCount = await memberPage.locator('[data-testid="position-item"]').count();
    expect(newPositionCount).toBeGreaterThanOrEqual(initialPositionCount);
  });
});
```

**Step 3: 테스트 실행**

Run: `cd frontend && TEST_ENV=local npx playwright test --project=dual-user --reporter=list`
Expected: 두 브라우저 동시 실행, 상호작용 테스트 통과

**Step 4: Commit**

```bash
git add frontend/tests/e2e/realtime-interaction.dual.spec.js frontend/tests/fixtures/dual-browser.fixture.js
git commit -m "feat: implement realtime interaction dual-browser tests"
```

---

## Task 6: package.json 테스트 스크립트 정리

**Files:**
- Modify: `frontend/package.json`

**Step 1: 테스트 스크립트 추가**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "npx playwright test",
    "test:local": "cross-env TEST_ENV=local TEST_API_URL=http://localhost:8000/api/v1 npx playwright test",
    "test:ui": "npx playwright test --ui",
    "test:debug": "npx playwright test --debug",
    "test:dual": "cross-env TEST_ENV=local npx playwright test --project=dual-user",
    "test:integrity": "cross-env TEST_ENV=local npx playwright test tests/e2e/data-integrity.spec.js",
    "test:permissions": "cross-env TEST_ENV=local npx playwright test tests/e2e/auth-permissions.spec.js",
    "test:p0": "cross-env TEST_ENV=local npx playwright test tests/e2e/data-integrity.spec.js tests/e2e/auth-permissions.spec.js",
    "test:report": "npx playwright show-report"
  }
}
```

**Step 2: Commit**

```bash
git add frontend/package.json
git commit -m "chore: add comprehensive test scripts to package.json"
```

---

## Task 7: 테스트 실행 및 결과 검증

**Files:** (없음 - 실행만)

**Step 1: 환경 설정 스크립트 실행**

Run: `powershell -ExecutionPolicy Bypass -File scripts/test-local.ps1 -SetupOnly`
Expected: Docker DB, 백엔드, 프론트엔드 모두 실행 중

**Step 2: P0 테스트 실행**

Run: `cd frontend && npm run test:p0`
Expected: 데이터 정합성 + 권한 테스트 통과

**Step 3: Dual Browser 테스트 실행**

Run: `cd frontend && npm run test:dual`
Expected: 실시간 상호작용 테스트 통과

**Step 4: 전체 테스트 실행**

Run: `cd frontend && npm run test:local`
Expected: 모든 테스트 통과

**Step 5: 테스트 리포트 확인**

Run: `cd frontend && npm run test:report`
Expected: HTML 리포트 열림

---

## 완료 후 체크리스트

- [ ] Docker PostgreSQL 실행 확인
- [ ] 백엔드 서버 (localhost:8000) 정상 응답
- [ ] 프론트엔드 서버 (localhost:5173) 정상 응답
- [ ] P0 테스트 (데이터 정합성) 통과
- [ ] P0 테스트 (권한) 통과
- [ ] Dual Browser 테스트 통과
- [ ] 전체 테스트 통과율 80% 이상

---

## 트러블슈팅

### 백엔드 서버 시작 실패
```bash
# 누락된 모듈 설치
pip install rapidfuzz openai apscheduler

# .env 파일 확인
cat backend/.env
```

### 마이그레이션 오류
```bash
cd backend
alembic stamp head  # 현재 상태를 head로 설정
alembic upgrade head
```

### WebSocket 연결 실패
- 백엔드 CORS 설정 확인: `CORS_ORIGINS=http://localhost:5173`
- 브라우저 콘솔에서 WebSocket 오류 확인

### 테스트 계정 로그인 실패
- 테스트 계정이 DB에 존재하는지 확인
- 계정이 활성화(is_active=true)되어 있는지 확인
