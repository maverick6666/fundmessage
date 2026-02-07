/**
 * 인증 픽스처 - 로그인된 상태로 테스트 시작
 */
import { test as base } from '@playwright/test';

// 테스트 계정 (로컬 테스트용)
export const TEST_ACCOUNTS = {
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || 'lhhh0420@naver.com',
    password: process.env.TEST_MANAGER_PASSWORD || 'lhh0420!',
    role: 'manager',
  },
  member: {
    email: process.env.TEST_MEMBER_EMAIL || 'test@naver.com',
    password: process.env.TEST_MEMBER_PASSWORD || '12345678',
    role: 'member',
  },
  viewer: {
    email: process.env.TEST_VIEWER_EMAIL || 'viewer@test.com',
    password: process.env.TEST_VIEWER_PASSWORD || 'viewer123',
    role: 'viewer',
  },
};

// API URL
const API_URL = process.env.TEST_API_URL || 'http://localhost:8000/api/v1';

/**
 * 로그인 헬퍼 함수
 */
export async function login(page, account) {
  await page.goto('/login');
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');

  // 로그인 완료 대기
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });
}

/**
 * API로 직접 로그인하여 토큰 획득
 */
export async function getAuthToken(account) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data.access_token;
}

/**
 * 인증된 상태로 테스트 시작하는 픽스처
 */
export const test = base.extend({
  // 팀장으로 로그인된 페이지
  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, TEST_ACCOUNTS.manager);
    await use(page);
    await context.close();
  },

  // 팀원으로 로그인된 페이지
  memberPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, TEST_ACCOUNTS.member);
    await use(page);
    await context.close();
  },

  // viewer로 로그인된 페이지
  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, TEST_ACCOUNTS.viewer);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
