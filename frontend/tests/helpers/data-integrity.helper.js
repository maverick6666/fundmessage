/**
 * 데이터 정합성 검증 헬퍼
 *
 * API를 통해 데이터 정합성을 검증합니다.
 * 예: 포지션 삭제 후 통계가 올바르게 재계산되는지 확인
 */

import * as api from './api.helper.js';

/**
 * 통계 스냅샷 저장
 * 작업 전후 비교를 위해 사용
 */
export async function captureStatsSnapshot(token) {
  const overview = await api.stats.getOverview(token);
  const ranking = await api.stats.getTeamRanking(token);

  return {
    timestamp: new Date().toISOString(),
    overview: overview.data,
    ranking: ranking.data,
  };
}

/**
 * 포지션 삭제 후 데이터 정합성 검증 (S040-S042)
 */
export async function verifyPositionDeletionIntegrity(token, deletedPosition, beforeSnapshot) {
  const afterSnapshot = await captureStatsSnapshot(token);

  const checks = [];

  // 1. 총 거래 수 감소 확인
  const beforeTrades = beforeSnapshot.overview.total_trades || 0;
  const afterTrades = afterSnapshot.overview.total_trades || 0;
  checks.push({
    name: '거래 수 감소',
    passed: afterTrades === beforeTrades - 1,
    before: beforeTrades,
    after: afterTrades,
    expected: beforeTrades - 1,
  });

  // 2. 수익률 재계산 확인 (삭제된 포지션 제외)
  // 정확한 값은 다른 포지션에 따라 다르므로, 여기서는 값이 변경되었는지만 확인
  const beforeProfitRate = beforeSnapshot.overview.average_profit_rate;
  const afterProfitRate = afterSnapshot.overview.average_profit_rate;
  checks.push({
    name: '수익률 재계산',
    passed: beforeProfitRate !== afterProfitRate || afterTrades === 0,
    before: beforeProfitRate,
    after: afterProfitRate,
  });

  // 3. 실현손익 재계산 확인
  const deletedPnL = deletedPosition.realized_profit_loss || 0;
  const beforeTotalPnL = beforeSnapshot.overview.total_realized_pnl || 0;
  const afterTotalPnL = afterSnapshot.overview.total_realized_pnl || 0;
  checks.push({
    name: '실현손익 재계산',
    passed: Math.abs((afterTotalPnL - (beforeTotalPnL - deletedPnL))) < 0.01,
    before: beforeTotalPnL,
    after: afterTotalPnL,
    expected: beforeTotalPnL - deletedPnL,
  });

  return {
    allPassed: checks.every(c => c.passed),
    checks,
    beforeSnapshot,
    afterSnapshot,
  };
}

/**
 * 요청 승인 후 포지션 생성 정합성 검증 (R020-R021)
 */
export async function verifyRequestApprovalIntegrity(token, request, approvalData) {
  // 포지션 목록에서 새 포지션 확인
  const positions = await api.positions.list(token);
  const newPosition = positions.data.positions?.find(p =>
    p.ticker === request.target_ticker &&
    p.status === 'open'
  );

  const checks = [];

  // 1. 포지션 생성 확인
  checks.push({
    name: '포지션 생성됨',
    passed: !!newPosition,
    positionId: newPosition?.id,
  });

  if (newPosition) {
    // 2. 티커 일치
    checks.push({
      name: '티커 일치',
      passed: newPosition.ticker === request.target_ticker,
      expected: request.target_ticker,
      actual: newPosition.ticker,
    });

    // 3. 미확인 상태 (is_info_confirmed = false)
    checks.push({
      name: '미확인 상태',
      passed: newPosition.is_info_confirmed === false,
      actual: newPosition.is_info_confirmed,
    });
  }

  return {
    allPassed: checks.every(c => c.passed),
    checks,
    newPosition,
  };
}

/**
 * 손익 계산 정확성 검증 (S001-S003)
 */
export async function verifyProfitCalculation(position) {
  const checks = [];

  if (position.status === 'closed' && position.realized_profit_loss !== null) {
    // 수익률 = (실현손익 / 총투자금) * 100
    const totalInvestment = position.total_buy_amount || 0;
    const realizedPnL = position.realized_profit_loss || 0;

    if (totalInvestment > 0) {
      const expectedProfitRate = (realizedPnL / totalInvestment) * 100;
      const actualProfitRate = position.profit_rate || 0;

      checks.push({
        name: '수익률 계산',
        passed: Math.abs(expectedProfitRate - actualProfitRate) < 0.01,
        expected: expectedProfitRate,
        actual: actualProfitRate,
        totalInvestment,
        realizedPnL,
      });
    }
  }

  return {
    allPassed: checks.length === 0 || checks.every(c => c.passed),
    checks,
  };
}

/**
 * 승률 계산 정확성 검증 (S010-S011)
 */
export async function verifyWinRateCalculation(token) {
  const positions = await api.positions.list(token);
  const closedPositions = positions.data.positions?.filter(p => p.status === 'closed') || [];

  const wins = closedPositions.filter(p => (p.realized_profit_loss || 0) > 0).length;
  const total = closedPositions.length;

  const expectedWinRate = total > 0 ? (wins / total) * 100 : 0;

  const overview = await api.stats.getOverview(token);
  const actualWinRate = overview.data.win_rate || 0;

  return {
    allPassed: Math.abs(expectedWinRate - actualWinRate) < 0.01,
    expected: expectedWinRate,
    actual: actualWinRate,
    wins,
    total,
  };
}

/**
 * 전체 데이터 정합성 검사 실행
 */
export async function runFullIntegrityCheck(token) {
  const results = {
    timestamp: new Date().toISOString(),
    checks: [],
  };

  // 1. 승률 계산 검증
  const winRateCheck = await verifyWinRateCalculation(token);
  results.checks.push({
    category: '승률 계산',
    ...winRateCheck,
  });

  // 2. 각 포지션의 손익 계산 검증
  const positions = await api.positions.list(token);
  for (const position of (positions.data.positions || []).slice(0, 10)) { // 최대 10개
    const profitCheck = await verifyProfitCalculation(position);
    results.checks.push({
      category: `포지션 ${position.id} 손익 계산`,
      ...profitCheck,
    });
  }

  results.allPassed = results.checks.every(c => c.allPassed);

  return results;
}
