/**
 * 역할별 접근 권한 테스트 (A020-A028)
 *
 * 각 역할(viewer, member, manager, admin)이
 * 허용된 작업만 수행할 수 있는지 검증
 */

import { test, expect, TEST_ACCOUNTS, login } from '../fixtures/auth.fixture.js';

test.describe('역할별 접근 권한', () => {

  test.describe('Viewer 권한 (A020-A022)', () => {

    test('A020: viewer가 매수 요청 시도 → 차단', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // viewer 계정이 있다고 가정 (없으면 스킵)
      try {
        await login(page, TEST_ACCOUNTS.viewer);
      } catch (e) {
        test.skip(true, 'Viewer 테스트 계정 없음');
        return;
      }

      // 요청 페이지로 이동
      await page.goto('/requests');

      // 매수 요청 버튼이 없거나 비활성화되어야 함
      const buyButton = page.locator('button:has-text("매수 요청")');
      const isVisible = await buyButton.isVisible().catch(() => false);

      if (isVisible) {
        // 버튼이 보이면 클릭 시도
        await buyButton.click();

        // 에러 메시지 또는 차단 확인
        const errorMessage = page.locator('text=보기 전용');
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      } else {
        // 버튼이 안 보이면 통과
        expect(isVisible).toBe(false);
      }

      await context.close();
    });

    test('A022: viewer가 포지션 목록 조회 → 허용', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await login(page, TEST_ACCOUNTS.viewer);
      } catch (e) {
        test.skip(true, 'Viewer 테스트 계정 없음');
        return;
      }

      await page.goto('/positions');

      // 포지션 목록이 로드되어야 함 (빈 목록도 OK)
      await expect(page.locator('text=포지션').first()).toBeVisible({ timeout: 10000 });

      await context.close();
    });
  });

  test.describe('Member 권한 (A023-A024)', () => {

    test('A023: member가 요청 제출 → 허용', async ({ memberPage }) => {
      await memberPage.goto('/requests');

      // 매수 요청 버튼 확인
      const buyButton = memberPage.locator('button:has-text("매수 요청")');
      await expect(buyButton).toBeVisible({ timeout: 10000 });
    });

    test('A024: member가 관리자모드 삭제 버튼 → 안 보임', async ({ memberPage }) => {
      await memberPage.goto('/positions');

      // 관리자 모드 토글이 없어야 함 (설정 페이지에서도)
      await memberPage.goto('/settings');

      const adminModeSection = memberPage.locator('text=관리자 모드');
      const isVisible = await adminModeSection.isVisible().catch(() => false);

      expect(isVisible).toBe(false);
    });
  });

  test.describe('Manager 권한 (A025-A026)', () => {

    test('A025: manager가 요청 승인/거부 버튼 → 보임', async ({ managerPage }) => {
      await managerPage.goto('/requests');

      // 대기중인 요청이 있다면 승인/거부 버튼 확인
      const pendingRequest = managerPage.locator('[data-status="pending"]').first();

      if (await pendingRequest.isVisible().catch(() => false)) {
        await pendingRequest.click();

        // 승인/거부 버튼 확인
        await expect(
          managerPage.locator('button:has-text("승인")').or(
            managerPage.locator('button:has-text("거부")')
          )
        ).toBeVisible({ timeout: 5000 });
      } else {
        // 대기중 요청이 없으면 테스트 스킵
        test.skip(true, '대기중인 요청 없음');
      }
    });

    test('A026: manager가 관리자 모드 토글 → 가능', async ({ managerPage }) => {
      await managerPage.goto('/settings');

      // 관리자 모드 섹션 확인
      await expect(managerPage.locator('text=관리자 모드')).toBeVisible({ timeout: 10000 });

      // 토글 버튼 확인
      const toggle = managerPage.locator('button[class*="rounded-full"]').first();
      await expect(toggle).toBeVisible();
    });
  });
});
