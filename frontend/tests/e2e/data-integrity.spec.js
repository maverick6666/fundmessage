/**
 * 데이터 정합성 테스트 (S001-S043)
 *
 * 손익 계산, 승률, 자산 변화율 등이
 * 정확하게 계산되는지 검증
 */

import { test, expect, TEST_ACCOUNTS } from '../fixtures/auth.fixture.js';
import * as api from '../helpers/api.helper.js';
import * as integrity from '../helpers/data-integrity.helper.js';

test.describe('데이터 정합성', () => {
  let managerToken;

  test.beforeAll(async () => {
    // 팀장 토큰 획득
    managerToken = await api.login(
      TEST_ACCOUNTS.manager.email,
      TEST_ACCOUNTS.manager.password
    );
  });

  test.describe('수익률 계산 (S001-S003)', () => {

    test('S001: 청산된 포지션의 수익률이 정확한지 검증', async () => {
      const positions = await api.positions.list(managerToken);
      const closedPositions = positions.data?.positions?.filter(p => p.status === 'closed') || [];

      for (const position of closedPositions.slice(0, 5)) {
        const result = await integrity.verifyProfitCalculation(position);

        if (result.checks.length > 0) {
          console.log(`포지션 ${position.id} (${position.ticker}):`, result);
          expect(result.allPassed).toBe(true);
        }
      }
    });
  });

  test.describe('승률 계산 (S010-S011)', () => {

    test('S010: 전체 승률이 정확한지 검증', async () => {
      const result = await integrity.verifyWinRateCalculation(managerToken);

      console.log('승률 검증:', result);
      expect(result.allPassed).toBe(true);
    });
  });

  test.describe('전체 정합성 검사', () => {

    test('모든 데이터 정합성 검사 실행', async () => {
      const result = await integrity.runFullIntegrityCheck(managerToken);

      console.log('전체 정합성 검사 결과:', JSON.stringify(result, null, 2));

      // 실패한 항목 출력
      const failedChecks = result.checks.filter(c => !c.allPassed);
      if (failedChecks.length > 0) {
        console.error('실패한 검사:', failedChecks);
      }

      expect(result.allPassed).toBe(true);
    });
  });
});

test.describe('삭제 후 데이터 정합성 (S040-S043)', () => {

  test.skip('S040-S042: 포지션 삭제 후 통계 재계산 검증', async ({ managerPage }) => {
    /**
     * 이 테스트는 실제 데이터를 삭제하므로 주의 필요
     * 로컬 테스트 환경에서만 실행 권장
     *
     * 테스트 흐름:
     * 1. 현재 통계 스냅샷 저장
     * 2. 테스트용 포지션 생성
     * 3. 포지션 삭제
     * 4. 삭제 후 통계와 비교
     */

    // 관리자 모드 활성화
    await managerPage.goto('/settings');
    const toggle = managerPage.locator('button[class*="rounded-full"]').first();
    await toggle.click();

    // 포지션 페이지로 이동
    await managerPage.goto('/positions');

    // (테스트 구현 - 실제 데이터 삭제가 필요하므로 스킵)
    // 로컬 환경에서 수동으로 테스트할 것

    test.skip(true, '실제 데이터 삭제 필요 - 로컬에서 수동 테스트');
  });
});
