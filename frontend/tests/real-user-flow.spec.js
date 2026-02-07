import { test, expect } from '@playwright/test';

// 실제 사용자 계정
const MANAGER = { email: 'lhhh0420@naver.com', password: 'lhh0420!' };
const MEMBER = { email: 'test@naver.com', password: '12345678' };

// 발견된 문제점 수집
const issues = {
  errors: [],      // 코딩 오류
  uxProblems: [],  // UX 문제점
  designSuggestions: [] // 디자인 개선 제안
};

// 테스트 후 결과 출력
test.afterAll(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('📋 UX 테스트 결과 보고서');
  console.log('='.repeat(60));

  console.log('\n🔴 발견된 오류:');
  if (issues.errors.length === 0) {
    console.log('   없음');
  } else {
    issues.errors.forEach((e, i) => console.log(`   ${i+1}. ${e}`));
  }

  console.log('\n🟡 UX 문제점:');
  if (issues.uxProblems.length === 0) {
    console.log('   없음');
  } else {
    issues.uxProblems.forEach((e, i) => console.log(`   ${i+1}. ${e}`));
  }

  console.log('\n🔵 디자인 개선 제안:');
  if (issues.designSuggestions.length === 0) {
    console.log('   없음');
  } else {
    issues.designSuggestions.forEach((e, i) => console.log(`   ${i+1}. ${e}`));
  }

  console.log('\n' + '='.repeat(60));
});

test.describe('1. 로그인 플로우 테스트', () => {
  test('1.1 팀장 계정 로그인', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 다크모드 토글 확인
    const themeToggle = page.locator('button[title*="모드"]');
    if (await themeToggle.count() === 0) {
      issues.uxProblems.push('다크모드 토글 버튼에 title 속성이 없거나 찾기 어려움');
    }

    // 로그인 폼 입력
    await page.fill('input[type="email"]', MANAGER.email);
    await page.fill('input[type="password"]', MANAGER.password);

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');

    // 로그인 성공 확인 (대시보드로 이동)
    try {
      await page.waitForURL('**/', { timeout: 10000 });

      // 대시보드 로딩 확인
      const dashboardLoaded = await page.locator('text=/대시보드|Dashboard|포지션|요청/i').count() > 0;
      if (!dashboardLoaded) {
        await page.waitForTimeout(2000);
      }

      console.log('✅ 팀장 로그인 성공');
    } catch (e) {
      // 에러 메시지 확인
      const errorMsg = await page.locator('[class*="error"], [class*="red"]').textContent().catch(() => null);
      if (errorMsg) {
        issues.errors.push(`팀장 로그인 실패: ${errorMsg}`);
      } else {
        issues.errors.push('팀장 로그인 실패: 알 수 없는 오류');
      }
    }
  });

  test('1.2 팀원 계정 로그인', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', MEMBER.email);
    await page.fill('input[type="password"]', MEMBER.password);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL('**/', { timeout: 10000 });
      console.log('✅ 팀원 로그인 성공');
    } catch (e) {
      const errorMsg = await page.locator('[class*="error"], [class*="red"]').textContent().catch(() => null);
      if (errorMsg) {
        issues.errors.push(`팀원 로그인 실패: ${errorMsg}`);
      } else {
        issues.errors.push('팀원 로그인 실패: 알 수 없는 오류');
      }
    }
  });
});

test.describe('2. 팀장 - 메인 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 팀장으로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', MANAGER.email);
    await page.fill('input[type="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('2.1 대시보드 페이지 확인', async ({ page }) => {
    // 대시보드 요소 확인
    const hasStats = await page.locator('[class*="card"], [class*="Card"]').count() > 0;

    if (!hasStats) {
      issues.uxProblems.push('대시보드에 통계 카드가 표시되지 않음');
    }

    // 로딩 상태 확인
    const loadingText = await page.locator('text=/로딩|Loading/i').count();
    if (loadingText > 0) {
      await page.waitForTimeout(3000);
      const stillLoading = await page.locator('text=/로딩|Loading/i').count();
      if (stillLoading > 0) {
        issues.uxProblems.push('대시보드 로딩이 3초 이상 소요됨');
      }
    }

    console.log('✅ 대시보드 페이지 확인 완료');
  });

  test('2.2 사이드바 네비게이션 테스트', async ({ page }) => {
    // 각 메뉴 클릭 테스트
    const menuItems = [
      { text: '포지션', url: '/positions' },
      { text: '요청', url: '/requests' },
      { text: '토론', url: '/discussions' },
      { text: '통계', url: '/stats' },
    ];

    for (const item of menuItems) {
      const menuLink = page.locator(`a:has-text("${item.text}")`).first();
      if (await menuLink.count() > 0) {
        await menuLink.click();
        await page.waitForTimeout(500);

        // URL 확인
        if (!page.url().includes(item.url)) {
          issues.errors.push(`"${item.text}" 메뉴 클릭 시 ${item.url}로 이동하지 않음`);
        }

        // 페이지 로드 확인
        const hasContent = await page.locator('h1, h2, [class*="card"]').count() > 0;
        if (!hasContent) {
          issues.uxProblems.push(`"${item.text}" 페이지 콘텐츠가 비어있음`);
        }
      } else {
        issues.errors.push(`사이드바에 "${item.text}" 메뉴가 없음`);
      }
    }

    console.log('✅ 사이드바 네비게이션 테스트 완료');
  });

  test('2.3 요청 관리 페이지', async ({ page }) => {
    await page.goto('/requests');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 필터 탭 확인
    const filterTabs = page.locator('button:has-text("전체"), button:has-text("대기"), button:has-text("승인")');
    const tabCount = await filterTabs.count();

    if (tabCount === 0) {
      issues.uxProblems.push('요청 관리 페이지에 필터 탭이 없음');
    }

    // 요청 목록 확인
    const requestCards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await requestCards.count();

    // 빈 상태 메시지 확인
    if (cardCount === 0) {
      const emptyMessage = await page.locator('text=/없습니다|no requests|비어/i').count();
      if (emptyMessage === 0) {
        issues.uxProblems.push('요청이 없을 때 빈 상태 메시지가 없음');
      }
    }

    console.log('✅ 요청 관리 페이지 확인 완료');
  });

  test('2.4 포지션 관리 페이지', async ({ page }) => {
    await page.goto('/positions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 필터 확인
    const statusFilter = page.locator('button:has-text("진행중"), button:has-text("종료")');
    if (await statusFilter.count() === 0) {
      issues.uxProblems.push('포지션 페이지에 상태 필터가 없거나 찾기 어려움');
    }

    // 포지션 카드 클릭 테스트
    const positionCard = page.locator('[class*="card"], [class*="Card"]').first();
    if (await positionCard.count() > 0) {
      await positionCard.click();
      await page.waitForTimeout(1000);

      // 상세 페이지로 이동했는지 확인
      if (page.url().includes('/positions/')) {
        console.log('✅ 포지션 상세 페이지 이동 확인');

        // 상세 페이지 요소 확인
        const hasBackButton = await page.locator('button:has(svg), a:has-text("뒤로")').count() > 0;
        if (!hasBackButton) {
          issues.uxProblems.push('포지션 상세 페이지에 뒤로가기 버튼이 명확하지 않음');
        }
      }
    }

    console.log('✅ 포지션 관리 페이지 확인 완료');
  });

  test('2.5 토론방 페이지', async ({ page }) => {
    await page.goto('/discussions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 토론방 목록 확인
    const discussionCards = page.locator('[class*="card"], [class*="Card"]');

    // 토론방 클릭 시 채팅 UI 확인
    if (await discussionCards.count() > 0) {
      await discussionCards.first().click();
      await page.waitForTimeout(1000);

      if (page.url().includes('/discussions/')) {
        // 메시지 입력창 확인
        const messageInput = page.locator('input[placeholder*="메시지"], textarea[placeholder*="메시지"]');
        if (await messageInput.count() === 0) {
          issues.uxProblems.push('토론방에 메시지 입력창이 없거나 찾기 어려움');
        }

        // 전송 버튼 확인
        const sendButton = page.locator('button:has-text("전송"), button[type="submit"]');
        if (await sendButton.count() === 0) {
          issues.uxProblems.push('토론방에 전송 버튼이 없거나 찾기 어려움');
        }
      }
    }

    console.log('✅ 토론방 페이지 확인 완료');
  });

  test('2.6 알림 페이지', async ({ page }) => {
    // 알림 아이콘 클릭
    const notificationIcon = page.locator('a[href*="notification"], button:has(svg[class*="bell"])').first();

    if (await notificationIcon.count() > 0) {
      await notificationIcon.click();
      await page.waitForTimeout(1000);

      // 알림 페이지/드롭다운 확인
      const hasNotificationUI = await page.locator('text=/알림|notification/i').count() > 0;
      if (!hasNotificationUI) {
        issues.uxProblems.push('알림 아이콘 클릭 시 알림 UI가 표시되지 않음');
      }
    } else {
      issues.uxProblems.push('헤더에 알림 아이콘이 없음');
    }

    console.log('✅ 알림 기능 확인 완료');
  });

  test('2.7 팀 관리 페이지 (팀장 전용)', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 팀원 목록 확인
    const memberList = page.locator('table, [class*="list"]');
    if (await memberList.count() === 0) {
      issues.uxProblems.push('팀 관리 페이지에 팀원 목록이 없음');
    }

    // 승인 대기 탭 확인
    const pendingTab = page.locator('button:has-text("대기"), a:has-text("대기")');
    if (await pendingTab.count() > 0) {
      await pendingTab.first().click();
      await page.waitForTimeout(500);
    }

    console.log('✅ 팀 관리 페이지 확인 완료');
  });
});

test.describe('3. 팀원 - 메인 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // 팀원으로 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', MEMBER.email);
    await page.fill('input[type="password"]', MEMBER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('3.1 팀원 대시보드 확인', async ({ page }) => {
    // 팀원에게 보이는 메뉴 확인
    const teamOnlyMenu = page.locator('a:has-text("팀 관리")');
    if (await teamOnlyMenu.count() > 0) {
      issues.errors.push('팀원에게 "팀 관리" 메뉴가 보임 (권한 문제)');
    }

    console.log('✅ 팀원 대시보드 확인 완료');
  });

  test('3.2 내 요청 페이지', async ({ page }) => {
    await page.goto('/my-requests');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 요청 목록 확인
    const hasContent = await page.locator('[class*="card"], [class*="Card"]').count() > 0 ||
                       await page.locator('text=/요청|없습니다/i').count() > 0;
    if (!hasContent) {
      issues.uxProblems.push('내 요청 페이지가 비어있거나 로딩 안됨');
    }

    console.log('✅ 내 요청 페이지 확인 완료');
  });

  test('3.3 종목 검색 페이지', async ({ page }) => {
    await page.goto('/stock-search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 검색 입력창 확인
    const searchInput = page.locator('input[placeholder*="종목"], input[placeholder*="코드"]');
    if (await searchInput.count() === 0) {
      issues.uxProblems.push('종목 검색 페이지에 검색 입력창이 없음');
    }

    // 시장 선택 확인
    const marketSelect = page.locator('select, button:has-text("코스피"), button:has-text("KOSPI")');
    if (await marketSelect.count() === 0) {
      issues.uxProblems.push('종목 검색 페이지에 시장 선택 UI가 없음');
    }

    console.log('✅ 종목 검색 페이지 확인 완료');
  });
});

test.describe('4. 다크모드 테스트', () => {
  test('4.1 다크모드 토글 작동 확인', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 초기 테마 확인
    const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // 토글 버튼 클릭
    const toggleBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click();
      await page.waitForTimeout(500);

      // 테마 변경 확인
      const afterToggle = await page.evaluate(() => document.documentElement.classList.contains('dark'));

      if (initialDark === afterToggle) {
        issues.errors.push('다크모드 토글이 작동하지 않음');
      } else {
        console.log('✅ 다크모드 토글 정상 작동');
      }

      // 다크모드 상태에서 UI 확인
      if (afterToggle) {
        // 배경색 확인
        const bgColor = await page.evaluate(() => {
          return window.getComputedStyle(document.body).backgroundColor;
        });

        // 어두운 배경인지 확인 (rgb 값으로)
        if (bgColor.includes('255, 255, 255') || bgColor.includes('249, 250, 251')) {
          issues.errors.push('다크모드에서 배경이 여전히 밝음');
        }
      }
    } else {
      issues.errors.push('다크모드 토글 버튼을 찾을 수 없음');
    }
  });
});

test.describe('5. 반응형 디자인 테스트', () => {
  test('5.1 모바일 뷰 (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 가로 스크롤 확인
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      issues.designSuggestions.push('모바일(375px)에서 가로 스크롤 발생');
    }

    // 로그인 후 사이드바 확인
    await page.fill('input[type="email"]', MANAGER.email);
    await page.fill('input[type="password"]', MANAGER.password);
    await page.click('button[type="submit"]');

    try {
      await page.waitForURL('**/', { timeout: 10000 });

      // 햄버거 메뉴 확인
      const hamburger = page.locator('button:has(svg[class*="menu"]), button[class*="hamburger"]');
      const sidebar = page.locator('[class*="sidebar"], aside');

      const sidebarVisible = await sidebar.isVisible().catch(() => false);

      if (sidebarVisible) {
        issues.designSuggestions.push('모바일에서 사이드바가 항상 표시됨 - 햄버거 메뉴로 숨기는 것 권장');
      }
    } catch (e) {
      // 로그인 실패 무시
    }

    console.log('✅ 모바일 뷰 테스트 완료');
  });

  test('5.2 태블릿 뷰 (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 로그인 폼 너비 확인
    const form = page.locator('form');
    if (await form.count() > 0) {
      const box = await form.boundingBox();
      if (box && box.width > 700) {
        issues.designSuggestions.push('태블릿에서 로그인 폼이 너무 넓음 - max-width 설정 권장');
      }
    }

    console.log('✅ 태블릿 뷰 테스트 완료');
  });
});

test.describe('6. 에러 핸들링 테스트', () => {
  test('6.1 잘못된 로그인 정보', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // 에러 메시지 확인
    const errorMessage = page.locator('[class*="error"], [class*="red"], [role="alert"]');
    if (await errorMessage.count() === 0) {
      issues.uxProblems.push('잘못된 로그인 시 에러 메시지가 표시되지 않음');
    } else {
      console.log('✅ 로그인 에러 메시지 표시 확인');
    }
  });

  test('6.2 존재하지 않는 페이지 (404)', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');
    await page.waitForTimeout(2000);

    // 404 페이지 또는 리다이렉트 확인
    const is404 = await page.locator('text=/404|찾을 수 없|not found/i').count() > 0;
    const isRedirected = page.url().includes('login');

    if (!is404 && !isRedirected) {
      issues.uxProblems.push('404 페이지 처리가 없음 - 빈 페이지 표시됨');
    } else {
      console.log('✅ 404 처리 확인');
    }
  });
});
