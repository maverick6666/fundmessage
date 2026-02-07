/**
 * 듀얼 브라우저 픽스처 - 팀장+팀원 동시 테스트
 *
 * 사용 예:
 * test('팀원 요청 시 팀장에게 실시간 알림', async ({ managerPage, memberPage }) => {
 *   await memberPage.click('button:text("매수 요청")');
 *   await expect(managerPage.locator('.notification-badge')).toBeVisible();
 * });
 */
import { test as base, expect } from '@playwright/test';
import { TEST_ACCOUNTS, login } from './auth.fixture.js';

export const test = base.extend({
  /**
   * 팀장 브라우저 컨텍스트
   */
  managerContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    await use(context);
    await context.close();
  },

  /**
   * 팀원 브라우저 컨텍스트
   */
  memberContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    await use(context);
    await context.close();
  },

  /**
   * 팀장으로 로그인된 페이지
   */
  managerPage: async ({ managerContext }, use) => {
    const page = await managerContext.newPage();
    await login(page, TEST_ACCOUNTS.manager);
    await use(page);
  },

  /**
   * 팀원으로 로그인된 페이지
   */
  memberPage: async ({ memberContext }, use) => {
    const page = await memberContext.newPage();
    await login(page, TEST_ACCOUNTS.member);
    await use(page);
  },

  /**
   * viewer로 로그인된 페이지 (필요시)
   */
  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    const page = await context.newPage();
    await login(page, TEST_ACCOUNTS.viewer);
    await use(page);
    await context.close();
  },
});

export { expect };

/**
 * 실시간 이벤트 대기 헬퍼
 * WebSocket 이벤트가 도착할 때까지 대기
 */
export async function waitForRealtimeUpdate(page, selector, options = {}) {
  const { timeout = 10000 } = options;

  await page.waitForSelector(selector, { timeout });
}

/**
 * 양쪽 페이지에서 동시 작업 실행
 */
export async function parallel(managerAction, memberAction) {
  return Promise.all([managerAction, memberAction]);
}
