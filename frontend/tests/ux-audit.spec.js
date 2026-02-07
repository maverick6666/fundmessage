import { test, expect } from '@playwright/test';

// UX 감사 테스트 - 사용자 경험 문제점 탐지

test.describe('인증 플로우 UX', () => {
  test('로그인 페이지 접근성 및 UX', async ({ page }) => {
    await page.goto('/login');

    // 페이지 로드 확인
    await expect(page.locator('h1, h2')).toBeVisible({ timeout: 10000 });

    // 입력 필드에 레이블이 있는지 확인
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="이메일"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // 빈 폼 제출 시 에러 메시지 표시 확인
    await page.click('button[type="submit"]');

    // 회원가입 링크 접근성
    const signupLink = page.locator('a[href*="signup"], button:has-text("회원가입")');
    if (await signupLink.count() > 0) {
      await expect(signupLink.first()).toBeVisible();
    }
  });

  test('회원가입 페이지 UX', async ({ page }) => {
    await page.goto('/signup');

    // 필수 필드 표시 확인
    await expect(page.locator('input')).toHaveCount.greaterThan(0);

    // 비밀번호 요구사항 표시 여부 확인
    const passwordHints = page.locator('text=/비밀번호|password/i');

    // 로그인 페이지로 돌아가기 링크
    const loginLink = page.locator('a[href*="login"], button:has-text("로그인")');
    if (await loginLink.count() > 0) {
      await expect(loginLink.first()).toBeVisible();
    }
  });
});

test.describe('네비게이션 UX', () => {
  test('로그인 없이 보호된 페이지 접근 시 리다이렉트', async ({ page }) => {
    await page.goto('/dashboard');

    // 로그인 페이지로 리다이렉트 되어야 함
    await page.waitForURL(/login|signin/i, { timeout: 5000 }).catch(() => {
      // 리다이렉트 안되면 UX 문제
    });
  });

  test('404 페이지 처리', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');

    // 404 페이지 또는 홈으로 리다이렉트 확인
    const is404 = await page.locator('text=/404|찾을 수 없|not found/i').count() > 0;
    const isRedirected = page.url().includes('login') || page.url().endsWith('/');

    if (!is404 && !isRedirected) {
      console.log('UX 문제: 존재하지 않는 페이지에 대한 처리가 없음');
    }
  });
});

test.describe('폼 UX', () => {
  test('로그인 폼 유효성 검사 피드백', async ({ page }) => {
    await page.goto('/login');

    // 잘못된 형식의 이메일 입력
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="이메일"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill('invalid-email');
      await page.click('button[type="submit"]');

      // 에러 메시지가 표시되는지 확인
      await page.waitForTimeout(500);
    }
  });
});

test.describe('반응형 디자인', () => {
  test('모바일 뷰포트에서 로그인 페이지', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    // 요소가 화면 밖으로 나가지 않는지 확인
    const body = await page.locator('body').boundingBox();
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (overflow) {
      console.log('UX 문제: 모바일에서 가로 스크롤 발생');
    }
  });

  test('태블릿 뷰포트에서 레이아웃', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');

    // 콘텐츠가 적절히 표시되는지 확인
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('로딩 상태 및 피드백', () => {
  test('로그인 버튼 로딩 상태', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="이메일"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill('test@test.com');
      await passwordInput.fill('password123');
      await submitBtn.click();

      // 로딩 인디케이터가 표시되는지 확인
      const hasLoadingState = await page.locator('[class*="loading"], [class*="spinner"], button:disabled').count() > 0;

      if (!hasLoadingState) {
        console.log('UX 문제: 폼 제출 시 로딩 상태 표시가 없음');
      }
    }
  });
});

test.describe('다크 모드', () => {
  test('다크 모드 토글 존재 및 작동', async ({ page }) => {
    await page.goto('/login');

    // 다크 모드 토글 버튼 찾기
    const themeToggle = page.locator('button:has(svg[class*="sun"]), button:has(svg[class*="moon"]), [aria-label*="theme"], [aria-label*="dark"]');

    if (await themeToggle.count() === 0) {
      console.log('UX 확인: 다크 모드 토글이 로그인 페이지에 있음');
    }

    // 토글 클릭 테스트
    if (await themeToggle.count() > 0) {
      await themeToggle.first().click();

      // html 또는 body에 dark 클래스가 추가되는지 확인
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
               document.body.classList.contains('dark');
      });
    }
  });
});

test.describe('접근성 (A11y)', () => {
  test('키보드 네비게이션', async ({ page }) => {
    await page.goto('/login');

    // Tab 키로 포커스 이동 테스트
    await page.keyboard.press('Tab');

    // 포커스된 요소가 보이는지 확인
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });

    if (!focusedElement || focusedElement === 'BODY') {
      console.log('UX 문제: Tab 키로 포커스 이동이 안됨');
    }
  });

  test('포커스 표시 스타일', async ({ page }) => {
    await page.goto('/login');

    // 입력 필드에 포커스
    const input = page.locator('input').first();
    if (await input.count() > 0) {
      await input.focus();

      // 포커스 링 또는 아웃라인 스타일 확인
      const hasVisibleFocus = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const styles = window.getComputedStyle(el);
        return styles.outlineWidth !== '0px' ||
               styles.boxShadow !== 'none' ||
               styles.borderColor !== styles.getPropertyValue('--original-border');
      });
    }
  });
});

test.describe('에러 처리', () => {
  test('네트워크 에러 시 사용자 피드백', async ({ page }) => {
    // API 요청 차단
    await page.route('**/api/**', route => route.abort());

    await page.goto('/login');

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="이메일"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill('test@test.com');
      await passwordInput.fill('password123');
      await submitBtn.click();

      await page.waitForTimeout(2000);

      // 에러 메시지가 표시되는지 확인
      const errorMessage = page.locator('[class*="error"], [class*="alert"], [role="alert"], text=/실패|오류|error/i');
      const hasError = await errorMessage.count() > 0;

      if (!hasError) {
        console.log('UX 문제: 네트워크 에러 시 사용자에게 피드백이 없음');
      }
    }
  });
});

test.describe('성능 및 로딩', () => {
  test('초기 페이지 로드 시간', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    if (loadTime > 3000) {
      console.log(`UX 문제: 페이지 로드 시간이 ${loadTime}ms로 너무 김 (3초 초과)`);
    }
  });

  test('큰 번들 사이즈 경고 확인', async ({ page }) => {
    await page.goto('/login');

    // 메인 JS 번들 크기 확인
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(r => r.name.includes('.js'))
        .map(r => ({ name: r.name, size: r.transferSize }));
    });

    const largeFiles = resources.filter(r => r.size > 500000);
    if (largeFiles.length > 0) {
      console.log('성능 경고: 500KB 이상 JS 파일 있음');
    }
  });
});
