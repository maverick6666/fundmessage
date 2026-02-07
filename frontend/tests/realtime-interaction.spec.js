import { test, expect, chromium } from '@playwright/test';

// 실시간 상호작용 테스트 - 팀장/팀원 간 알림 및 상호작용

const MANAGER = {
  email: 'lhhh0420@naver.com',
  password: 'lhh0420!',
  name: '이학현팀장'
};

const MEMBER = {
  email: 'test@naver.com',
  password: '12345678',
  name: '테스트'
};

// 로그인 헬퍼 함수
async function login(page, user) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[placeholder*="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  // 대시보드로 리다이렉트 될 때까지 대기
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}

// 알림 배지 확인 함수
async function getNotificationBadge(page) {
  const badge = page.locator('[class*="notification"] [class*="badge"], .notification-badge, [class*="bg-red"]');
  if (await badge.count() > 0) {
    const text = await badge.first().textContent();
    return parseInt(text) || 0;
  }
  return 0;
}

test.describe('실시간 알림 시스템 테스트', () => {
  test('1. 팀원 요청 시 팀장에게 실시간 알림이 오는지 확인', async ({ browser }) => {
    const issues = [];

    // 두 개의 브라우저 컨텍스트 생성
    const managerContext = await browser.newContext();
    const memberContext = await browser.newContext();

    const managerPage = await managerContext.newPage();
    const memberPage = await memberContext.newPage();

    try {
      // 1. 팀장 로그인
      console.log('팀장 로그인 중...');
      await login(managerPage, MANAGER);

      // 2. 팀원 로그인
      console.log('팀원 로그인 중...');
      await login(memberPage, MEMBER);

      // 3. 팀장 알림 페이지로 이동 및 초기 상태 확인
      await managerPage.goto('/notifications');
      await managerPage.waitForLoadState('networkidle');

      const initialNotificationCount = await managerPage.locator('[class*="card"], [class*="notification-item"]').count();
      console.log(`팀장 초기 알림 수: ${initialNotificationCount}`);

      // 4. 팀원이 매수 요청 작성
      console.log('팀원이 매수 요청 작성 중...');
      await memberPage.goto('/stock-search');
      await memberPage.waitForLoadState('networkidle');

      // 종목 검색
      await memberPage.fill('input[placeholder*="005930"], input[type="text"]', '005930');
      await memberPage.click('button:has-text("검색")');
      await memberPage.waitForTimeout(2000);

      // 매수 요청 버튼 클릭
      const buyRequestBtn = memberPage.locator('button:has-text("매수 요청")');
      if (await buyRequestBtn.count() > 0) {
        await buyRequestBtn.click();
        await memberPage.waitForTimeout(1000);

        // 요청 폼 작성
        const quantityInput = memberPage.locator('input[name*="quantity"], input[placeholder*="수량"]');
        const priceInput = memberPage.locator('input[name*="price"], input[placeholder*="가격"]');
        const reasonInput = memberPage.locator('textarea, input[name*="reason"]');

        if (await quantityInput.count() > 0) {
          await quantityInput.fill('10');
        }
        if (await priceInput.count() > 0) {
          await priceInput.fill('55000');
        }
        if (await reasonInput.count() > 0) {
          await reasonInput.fill('테스트 매수 요청입니다');
        }

        // 제출
        const submitBtn = memberPage.locator('button[type="submit"], button:has-text("제출"), button:has-text("요청")');
        if (await submitBtn.count() > 0) {
          await submitBtn.first().click();
          console.log('팀원이 매수 요청을 제출함');
          await memberPage.waitForTimeout(2000);
        }
      } else {
        console.log('매수 요청 버튼을 찾을 수 없음');
      }

      // 5. 팀장 페이지에서 실시간 알림 확인 (새로고침 없이)
      console.log('팀장 페이지에서 알림 확인 (새로고침 없이)...');
      await managerPage.waitForTimeout(3000);

      // 알림 아이콘에 배지가 있는지 확인
      const notificationIcon = managerPage.locator('a[href*="notification"], [class*="notification"]');
      const hasBadge = await managerPage.locator('[class*="badge"], [class*="bg-red-"]').count() > 0;

      if (!hasBadge) {
        issues.push('팀원이 요청을 보냈지만 팀장의 알림 아이콘에 실시간 배지가 표시되지 않음 (새로고침 필요할 수 있음)');
      }

      // 6. 팀장이 새로고침 후 알림 확인
      await managerPage.reload();
      await managerPage.waitForLoadState('networkidle');

      const afterRefreshNotificationCount = await managerPage.locator('[class*="card"], [class*="notification-item"]').count();
      console.log(`팀장 새로고침 후 알림 수: ${afterRefreshNotificationCount}`);

      if (afterRefreshNotificationCount <= initialNotificationCount) {
        issues.push('팀원이 요청을 보냈지만 팀장에게 알림이 오지 않음');
      }

    } finally {
      await managerContext.close();
      await memberContext.close();
    }

    // 결과 출력
    console.log('\n=== 실시간 알림 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('2. 알림 클릭 시 해당 페이지로 이동하는지 확인', async ({ page }) => {
    const issues = [];

    await login(page, MANAGER);
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // 알림 아이템 찾기
    const notificationItems = page.locator('[class*="card"], [class*="notification-item"], [class*="cursor-pointer"]').filter({
      has: page.locator('text=/요청|승인|거부|토론/')
    });

    const count = await notificationItems.count();
    console.log(`알림 아이템 수: ${count}`);

    if (count > 0) {
      const firstNotification = notificationItems.first();
      const notificationText = await firstNotification.textContent();
      console.log(`첫 번째 알림: ${notificationText?.substring(0, 50)}...`);

      // 알림 클릭
      await firstNotification.click();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      const isStillOnNotifications = currentUrl.includes('/notifications');

      if (isStillOnNotifications) {
        issues.push('알림을 클릭해도 해당 페이지로 이동하지 않음');
      } else {
        console.log(`알림 클릭 후 이동한 페이지: ${currentUrl}`);
      }
    } else {
      console.log('알림이 없어서 테스트 스킵');
    }

    // 결과 출력
    console.log('\n=== 알림 클릭 네비게이션 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('3. 알림 클릭 시 자동으로 읽음 처리되는지 확인', async ({ page }) => {
    const issues = [];

    await login(page, MANAGER);
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');

    // "읽지 않음" 탭 클릭
    const unreadTab = page.locator('button:has-text("읽지 않음")');
    if (await unreadTab.count() > 0) {
      await unreadTab.click();
      await page.waitForTimeout(500);
    }

    // 읽지 않은 알림 수 확인
    const unreadNotifications = page.locator('[class*="card"], [class*="notification-item"]');
    const initialUnreadCount = await unreadNotifications.count();
    console.log(`읽지 않은 알림 수: ${initialUnreadCount}`);

    if (initialUnreadCount > 0) {
      // 첫 번째 알림 클릭
      await unreadNotifications.first().click();
      await page.waitForTimeout(1000);

      // 알림 페이지로 돌아가기
      await page.goto('/notifications');
      await page.waitForLoadState('networkidle');

      // "읽지 않음" 탭 다시 클릭
      if (await unreadTab.count() > 0) {
        await unreadTab.click();
        await page.waitForTimeout(500);
      }

      const afterClickUnreadCount = await unreadNotifications.count();
      console.log(`클릭 후 읽지 않은 알림 수: ${afterClickUnreadCount}`);

      if (afterClickUnreadCount >= initialUnreadCount) {
        issues.push('알림을 클릭해도 자동으로 읽음 처리되지 않음 - "읽음 표시" 버튼을 따로 눌러야 함');
      }
    } else {
      console.log('읽지 않은 알림이 없어서 테스트 스킵');
    }

    // 결과 출력
    console.log('\n=== 알림 자동 읽음 처리 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('종목 검색 UX 테스트', () => {
  test('4. 종목 검색 입력창 UX 분석', async ({ page }) => {
    const issues = [];

    await login(page, MANAGER);
    await page.goto('/stock-search');
    await page.waitForLoadState('networkidle');

    // 검색 입력창 확인
    const searchInput = page.locator('input[type="text"], input[placeholder]').first();
    const placeholder = await searchInput.getAttribute('placeholder');

    console.log(`검색창 placeholder: "${placeholder}"`);

    if (placeholder && /^\d+$/.test(placeholder)) {
      issues.push(`종목코드 입력창의 placeholder가 숫자만 표시됨 ("${placeholder}") - "종목코드 입력 (예: 005930)" 같은 안내가 필요함`);
    }

    // 종목명 검색 가능 여부 확인
    await searchInput.fill('삼성전자');
    await page.click('button:has-text("검색")');
    await page.waitForTimeout(2000);

    const errorMessage = page.locator('text=/찾을 수 없|오류|error|없습니다/i');
    if (await errorMessage.count() > 0) {
      issues.push('종목명으로 검색할 수 없음 - 코드만 지원됨. 종목명 검색 또는 자동완성 기능 필요');
    }

    // 결과 출력
    console.log('\n=== 종목 검색 UX 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('5. 차트 드래그/줌 기능 테스트', async ({ page }) => {
    const issues = [];

    await login(page, MANAGER);
    await page.goto('/stock-search');
    await page.waitForLoadState('networkidle');

    // 종목 검색
    await page.fill('input[type="text"]', '005930');
    await page.click('button:has-text("검색")');
    await page.waitForTimeout(3000);

    // 차트 영역 찾기
    const chartArea = page.locator('canvas, [class*="chart"], table');

    if (await chartArea.count() > 0) {
      const chart = chartArea.first();
      const box = await chart.boundingBox();

      if (box) {
        // 차트 드래그 테스트
        console.log('차트 드래그 테스트 중...');

        const startX = box.x + box.width * 0.7;
        const startY = box.y + box.height / 2;
        const endX = box.x + box.width * 0.3;
        const endY = box.y + box.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(1000);

        // 에러 발생 확인
        const hasError = await page.locator('text=/오류|error|실패/i').count() > 0;
        if (hasError) {
          issues.push('차트 드래그 중 오류 발생');
        }

        console.log('차트 드래그 완료');
      }
    } else {
      issues.push('차트 영역을 찾을 수 없음');
    }

    // 결과 출력
    console.log('\n=== 차트 드래그/줌 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('요청 승인 플로우 테스트', () => {
  test('6. 팀장이 요청 승인 시 팀원에게 알림이 오는지 확인', async ({ browser }) => {
    const issues = [];

    const managerContext = await browser.newContext();
    const memberContext = await browser.newContext();

    const managerPage = await managerContext.newPage();
    const memberPage = await memberContext.newPage();

    try {
      // 팀장, 팀원 로그인
      await login(managerPage, MANAGER);
      await login(memberPage, MEMBER);

      // 팀원 알림 페이지로 이동
      await memberPage.goto('/notifications');
      await memberPage.waitForLoadState('networkidle');

      const initialMemberNotifications = await memberPage.locator('[class*="card"]').count();
      console.log(`팀원 초기 알림 수: ${initialMemberNotifications}`);

      // 팀장 요청 페이지로 이동
      await managerPage.goto('/requests');
      await managerPage.waitForLoadState('networkidle');

      // 대기중인 요청 찾기
      const pendingRequests = managerPage.locator('[class*="card"]').filter({
        has: managerPage.locator('text=/대기|pending/i')
      });

      if (await pendingRequests.count() > 0) {
        console.log('대기중인 요청 발견, 승인 시도...');

        // 첫 번째 요청의 승인 버튼 클릭
        const approveBtn = pendingRequests.first().locator('button:has-text("승인")');
        if (await approveBtn.count() > 0) {
          await approveBtn.click();
          await managerPage.waitForTimeout(2000);

          // 팀원 페이지 새로고침 후 알림 확인
          await memberPage.reload();
          await memberPage.waitForLoadState('networkidle');

          const afterApprovalNotifications = await memberPage.locator('[class*="card"]').count();
          console.log(`팀원 승인 후 알림 수: ${afterApprovalNotifications}`);

          if (afterApprovalNotifications <= initialMemberNotifications) {
            issues.push('팀장이 요청을 승인했지만 팀원에게 알림이 오지 않음');
          }
        }
      } else {
        console.log('대기중인 요청이 없어서 테스트 스킵');
      }

    } finally {
      await managerContext.close();
      await memberContext.close();
    }

    // 결과 출력
    console.log('\n=== 요청 승인 알림 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('포지션 및 토론 테스트', () => {
  test('7. 포지션 페이지 데이터 로딩 확인', async ({ page }) => {
    const issues = [];

    await login(page, MANAGER);
    await page.goto('/positions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 로딩 상태 확인
    const isLoading = await page.locator('text=/로딩|loading/i').count() > 0;
    if (isLoading) {
      await page.waitForTimeout(3000);
      const stillLoading = await page.locator('text=/로딩|loading/i').count() > 0;
      if (stillLoading) {
        issues.push('포지션 페이지 로딩이 5초 이상 걸림');
      }
    }

    // 데이터 또는 빈 상태 메시지 확인
    const hasData = await page.locator('[class*="card"], table tr, [class*="position"]').count() > 0;
    const hasEmptyMessage = await page.locator('text=/없습니다|No|Empty/i').count() > 0;

    if (!hasData && !hasEmptyMessage) {
      issues.push('포지션 페이지에 데이터도 없고 빈 상태 메시지도 없음');
    }

    console.log('\n=== 포지션 페이지 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('8. 토론방 입장 및 메시지 전송 테스트', async ({ page }) => {
    const issues = [];

    await login(page, MANAGER);
    await page.goto('/discussions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 활성 토론 찾기
    const discussions = page.locator('[class*="card"], [class*="discussion"]').filter({
      has: page.locator('text=/진행|활성|active/i')
    });

    const discussionCount = await discussions.count();
    console.log(`활성 토론 수: ${discussionCount}`);

    if (discussionCount > 0) {
      // 토론방 입장
      await discussions.first().click();
      await page.waitForTimeout(2000);

      // 메시지 입력창 확인
      const messageInput = page.locator('input[placeholder*="메시지"], textarea[placeholder*="메시지"], input[type="text"]').last();

      if (await messageInput.count() === 0) {
        issues.push('토론방에 메시지 입력창이 없음');
      } else {
        // 메시지 전송 테스트
        await messageInput.fill('테스트 메시지입니다');

        const sendBtn = page.locator('button:has-text("전송"), button[type="submit"]').last();
        if (await sendBtn.count() > 0) {
          await sendBtn.click();
          await page.waitForTimeout(1000);

          // 메시지가 표시되는지 확인
          const sentMessage = page.locator('text="테스트 메시지입니다"');
          if (await sentMessage.count() === 0) {
            issues.push('메시지 전송 후 화면에 표시되지 않음');
          }
        }
      }
    } else {
      console.log('활성 토론이 없어서 상세 테스트 스킵');
    }

    console.log('\n=== 토론방 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('추가 UX 분석', () => {
  test('9. 사이드바 메뉴 활성화 표시 확인', async ({ page }) => {
    const issues = [];

    await login(page, MANAGER);

    const pages = [
      { url: '/positions', name: '포지션' },
      { url: '/discussions', name: '토론방' },
      { url: '/requests', name: '팀 요청' },
      { url: '/stats', name: '통계' }
    ];

    for (const p of pages) {
      await page.goto(p.url);
      await page.waitForLoadState('networkidle');

      // 현재 페이지 메뉴가 활성화 표시되는지 확인
      const activeLink = page.locator(`a[href*="${p.url}"]`);
      if (await activeLink.count() > 0) {
        const classes = await activeLink.getAttribute('class');
        const hasActiveStyle = classes?.includes('active') ||
                              classes?.includes('bg-') ||
                              classes?.includes('text-primary') ||
                              classes?.includes('font-bold');

        if (!hasActiveStyle) {
          // 시각적으로 구분되는지 확인 (배경색 등)
          const bgColor = await activeLink.evaluate(el => window.getComputedStyle(el).backgroundColor);
          if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
            issues.push(`${p.name} 페이지에서 사이드바 메뉴 활성화 표시가 불분명함`);
          }
        }
      }
    }

    console.log('\n=== 사이드바 메뉴 활성화 표시 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('10. 폼 제출 후 피드백 확인', async ({ page }) => {
    const issues = [];

    await login(page, MEMBER);
    await page.goto('/stock-search');
    await page.waitForLoadState('networkidle');

    // 종목 검색
    await page.fill('input[type="text"]', '005930');
    await page.click('button:has-text("검색")');
    await page.waitForTimeout(3000);

    // 매수 요청 폼 열기
    const buyBtn = page.locator('button:has-text("매수 요청")');
    if (await buyBtn.count() > 0) {
      await buyBtn.click();
      await page.waitForTimeout(1000);

      // 빈 폼 제출 시도
      const submitBtn = page.locator('button[type="submit"], button:has-text("제출"), button:has-text("요청")');
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForTimeout(1000);

        // 유효성 검사 메시지 확인
        const validationMessage = page.locator('[class*="error"], [class*="invalid"], [role="alert"], text=/필수|required|입력/i');
        if (await validationMessage.count() === 0) {
          issues.push('빈 폼 제출 시 유효성 검사 메시지가 표시되지 않음');
        }
      }
    }

    console.log('\n=== 폼 유효성 검사 피드백 테스트 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});
