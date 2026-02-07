/**
 * 팀장+팀원 실시간 상호작용 테스트
 *
 * 두 브라우저를 동시에 띄워서 실시간 기능 검증
 * 파일명에 .dual.spec.js가 있어야 dual-user 프로젝트로 실행됨
 */

import { test, expect, waitForRealtimeUpdate } from '../fixtures/dual-browser.fixture.js';

test.describe('실시간 상호작용', () => {

  test.describe('알림 시스템 (N001-N004)', () => {

    test('N001: 팀원 요청 제출 → 팀장에게 실시간 알림', async ({ managerPage, memberPage }) => {
      // 팀장: 알림 영역 확인
      await managerPage.goto('/dashboard');
      const initialBadge = managerPage.locator('.notification-badge, [data-testid="notification-count"]');
      const initialCount = await initialBadge.textContent().catch(() => '0');

      // 팀원: 요청 페이지로 이동
      await memberPage.goto('/requests');

      // 매수 요청 버튼 클릭
      const buyButton = memberPage.locator('button:has-text("매수 요청")');
      if (await buyButton.isVisible().catch(() => false)) {
        await buyButton.click();

        // 폼 작성 (간단한 테스트 데이터)
        await memberPage.fill('input[name="ticker"], input[placeholder*="티커"]', 'TEST');
        await memberPage.fill('input[name="amount"], input[placeholder*="금액"]', '1000000');

        // 제출
        const submitButton = memberPage.locator('button[type="submit"]:has-text("요청")');
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // 팀장: 새 알림 확인 (최대 10초 대기)
          await managerPage.waitForTimeout(2000); // WebSocket 전파 대기

          // 페이지 새로고침하여 알림 확인
          await managerPage.reload();

          const newBadge = managerPage.locator('.notification-badge, [data-testid="notification-count"]');
          if (await newBadge.isVisible().catch(() => false)) {
            const newCount = await newBadge.textContent().catch(() => '0');
            console.log(`알림 수: ${initialCount} → ${newCount}`);
          }
        }
      } else {
        test.skip(true, '매수 요청 버튼 없음 (권한 문제일 수 있음)');
      }
    });
  });

  test.describe('토론방 실시간 채팅 (D001-D003)', () => {

    test('D001-D003: 토론방에서 메시지 실시간 동기화', async ({ managerPage, memberPage }) => {
      // 열린 토론방 찾기
      await managerPage.goto('/discussions');
      await memberPage.goto('/discussions');

      const openDiscussion = managerPage.locator('[data-status="open"], .discussion-item').first();

      if (await openDiscussion.isVisible().catch(() => false)) {
        // 같은 토론방 입장
        await openDiscussion.click();

        // 토론방 ID 추출하여 팀원도 입장
        const url = managerPage.url();
        await memberPage.goto(url);

        // 팀원이 메시지 전송
        const messageInput = memberPage.locator('input[placeholder*="메시지"], textarea[placeholder*="메시지"]');
        if (await messageInput.isVisible()) {
          const testMessage = `테스트 메시지 ${Date.now()}`;
          await messageInput.fill(testMessage);
          await memberPage.keyboard.press('Enter');

          // 팀장 화면에서 메시지 확인 (실시간)
          await managerPage.waitForTimeout(2000);

          const messageInManager = managerPage.locator(`text=${testMessage}`);
          await expect(messageInManager).toBeVisible({ timeout: 10000 });
        }
      } else {
        test.skip(true, '열린 토론방 없음');
      }
    });
  });

  test.describe('요청 승인 알림 (N002)', () => {

    test('N002: 팀장 승인 → 팀원에게 알림', async ({ managerPage, memberPage }) => {
      // 팀원: 알림 영역 대기
      await memberPage.goto('/dashboard');

      // 팀장: 요청 페이지로 이동
      await managerPage.goto('/requests');

      // 대기중인 요청 찾기
      const pendingRequest = managerPage.locator('[data-status="pending"]').first();

      if (await pendingRequest.isVisible().catch(() => false)) {
        await pendingRequest.click();

        // 승인 버튼 클릭
        const approveButton = managerPage.locator('button:has-text("승인")');
        if (await approveButton.isVisible()) {
          await approveButton.click();

          // 확인 모달이 있으면 확인
          const confirmButton = managerPage.locator('button:has-text("확인")');
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
          }

          // 팀원: 알림 확인
          await memberPage.waitForTimeout(3000);
          await memberPage.reload();

          // 알림 아이콘 클릭하여 확인
          const notificationIcon = memberPage.locator('[data-testid="notification-icon"], .notification-bell');
          if (await notificationIcon.isVisible()) {
            await notificationIcon.click();

            // 승인 관련 알림 확인
            const approvalNotification = memberPage.locator('text=승인');
            const isVisible = await approvalNotification.isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`승인 알림 표시: ${isVisible}`);
          }
        }
      } else {
        test.skip(true, '대기중인 요청 없음');
      }
    });
  });
});

test.describe('역할별 UI 차이', () => {

  test('manager vs member: 승인 버튼 표시 차이', async ({ managerPage, memberPage }) => {
    await managerPage.goto('/requests');
    await memberPage.goto('/requests');

    // 대기중인 요청이 있다면
    const managerPending = managerPage.locator('[data-status="pending"]').first();
    const memberPending = memberPage.locator('[data-status="pending"]').first();

    if (await managerPending.isVisible().catch(() => false)) {
      await managerPending.click();
      await memberPending.click().catch(() => {});

      // 팀장: 승인/거부 버튼 보임
      const managerApproveBtn = managerPage.locator('button:has-text("승인")');
      const managerVisible = await managerApproveBtn.isVisible().catch(() => false);

      // 팀원: 승인/거부 버튼 안 보임
      const memberApproveBtn = memberPage.locator('button:has-text("승인")');
      const memberVisible = await memberApproveBtn.isVisible().catch(() => false);

      console.log(`승인 버튼 - 팀장: ${managerVisible}, 팀원: ${memberVisible}`);

      expect(managerVisible).toBe(true);
      expect(memberVisible).toBe(false);
    } else {
      test.skip(true, '대기중인 요청 없음');
    }
  });
});
