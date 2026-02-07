import { test, expect } from '@playwright/test';

// 상세 UX 감사 테스트

test.describe('페이지별 상세 UX 분석', () => {
  test('로그인 페이지 상세 분석', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const issues = [];

    // 1. 레이아웃 확인
    const mainContent = await page.locator('form, [class*="login"], [class*="auth"]').count();
    if (mainContent === 0) {
      issues.push('로그인 폼이 명확하게 식별되지 않음');
    }

    // 2. 입력 필드 분석
    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');
      const label = await input.getAttribute('aria-label');
      const id = await input.getAttribute('id');

      // 접근성 라벨 확인
      if (!placeholder && !label) {
        const inputType = await input.getAttribute('type');
        issues.push(`입력 필드 ${i + 1} (type: ${inputType}): 플레이스홀더나 aria-label이 없음`);
      }

      // ID 연결된 라벨 확인
      if (id) {
        const connectedLabel = await page.locator(`label[for="${id}"]`).count();
        if (connectedLabel === 0) {
          issues.push(`입력 필드 "${id}": 연결된 label 요소가 없음`);
        }
      }
    }

    // 3. 버튼 분석
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.count() === 0) {
      issues.push('제출 버튼(type="submit")이 없음');
    }

    // 4. 에러 상태 표시 영역 확인
    const errorContainer = await page.locator('[role="alert"], [class*="error"], [class*="message"]').count();

    // 5. 링크 확인
    const links = page.locator('a');
    const linkCount = await links.count();
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      const text = await link.textContent();

      if (!href || href === '#') {
        issues.push(`링크 "${text?.trim()}": href가 없거나 "#"임`);
      }
    }

    // 6. 다크모드 토글 접근성
    const themeBtn = page.locator('button').filter({ has: page.locator('svg') });
    const themeBtnCount = await themeBtn.count();

    // 결과 출력
    console.log('\n=== 로그인 페이지 UX 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('회원가입 페이지 상세 분석', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');

    const issues = [];

    // 1. 필수 필드 표시
    const requiredInputs = await page.locator('input[required]').count();
    const allInputs = await page.locator('input').count();

    if (requiredInputs === 0 && allInputs > 0) {
      issues.push('필수 필드에 required 속성이 없음 - 사용자가 어떤 필드가 필수인지 알기 어려움');
    }

    // 2. 비밀번호 필드 분석
    const passwordInputs = page.locator('input[type="password"]');
    const pwCount = await passwordInputs.count();

    if (pwCount === 1) {
      issues.push('비밀번호 확인 필드가 없음 - 사용자 실수 방지 기능 부재');
    }

    // 3. 비밀번호 요구사항 표시
    const pwHint = await page.locator('text=/비밀번호.*자|password.*character|최소/i').count();
    if (pwHint === 0) {
      issues.push('비밀번호 요구사항(길이, 특수문자 등)이 표시되지 않음');
    }

    // 4. 이메일 형식 안내
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count() === 0) {
      const emailLike = page.locator('input[name*="email"], input[placeholder*="이메일"]');
      if (await emailLike.count() > 0) {
        issues.push('이메일 입력 필드에 type="email"이 없음 - 모바일 키보드 최적화 안됨');
      }
    }

    // 5. 역할 선택 UI
    const roleSelect = await page.locator('select, input[type="radio"], [class*="role"]').count();

    console.log('\n=== 회원가입 페이지 UX 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('공통 UI 컴포넌트 분석', () => {
  test('버튼 컴포넌트 일관성', async ({ page }) => {
    await page.goto('/login');

    const issues = [];

    const buttons = page.locator('button');
    const btnCount = await buttons.count();

    for (let i = 0; i < btnCount; i++) {
      const btn = buttons.nth(i);
      const hasText = (await btn.textContent())?.trim().length > 0;
      const hasAriaLabel = await btn.getAttribute('aria-label');
      const hasSvg = await btn.locator('svg').count() > 0;

      if (!hasText && !hasAriaLabel && hasSvg) {
        issues.push(`아이콘 버튼 ${i + 1}: aria-label이 없어 스크린 리더가 목적을 알 수 없음`);
      }
    }

    console.log('\n=== 버튼 컴포넌트 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('입력 컴포넌트 분석', async ({ page }) => {
    await page.goto('/login');

    const issues = [];

    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);

      // autocomplete 속성 확인
      const type = await input.getAttribute('type');
      const autocomplete = await input.getAttribute('autocomplete');

      if (type === 'password' && autocomplete !== 'current-password' && autocomplete !== 'new-password') {
        issues.push('비밀번호 필드에 autocomplete 속성이 없음 - 비밀번호 관리자 지원 안됨');
      }

      if (type === 'email' && autocomplete !== 'email') {
        issues.push('이메일 필드에 autocomplete="email"이 없음');
      }
    }

    console.log('\n=== 입력 컴포넌트 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('사용자 플로우 분석', () => {
  test('로그인 실패 플로우', async ({ page }) => {
    await page.goto('/login');

    const issues = [];

    const emailInput = page.locator('input[type="email"], input[name*="email"], input[placeholder*="이메일"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill('wrong@email.com');
      await passwordInput.fill('wrongpassword');
      await submitBtn.click();

      await page.waitForTimeout(3000);

      // 에러 메시지 확인
      const errorVisible = await page.locator('[class*="error"], [class*="alert"], [role="alert"]').count() > 0;
      const alertShown = await page.evaluate(() => {
        return window.__lastAlert || false;
      });

      if (!errorVisible) {
        issues.push('로그인 실패 시 에러 메시지가 페이지에 표시되지 않음 (alert 사용 가능성)');
      }

      // 입력 필드에 포커스 유지 확인
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);

      // 비밀번호 초기화 여부
      const pwValue = await passwordInput.inputValue();
      if (pwValue === 'wrongpassword') {
        issues.push('로그인 실패 후 비밀번호가 초기화되지 않음 - 보안상 비밀번호는 초기화되어야 함');
      }
    }

    console.log('\n=== 로그인 실패 플로우 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('모바일 UX 분석', () => {
  test('모바일 터치 타겟 크기', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    const issues = [];

    // 버튼과 링크의 최소 크기 확인 (44x44px 권장)
    const clickables = page.locator('button, a, input[type="submit"]');
    const count = await clickables.count();

    for (let i = 0; i < count; i++) {
      const el = clickables.nth(i);
      const box = await el.boundingBox();

      if (box && (box.width < 44 || box.height < 44)) {
        const text = (await el.textContent())?.trim().substring(0, 20) || '(no text)';
        if (box.width < 44 && box.height < 44) {
          issues.push(`"${text}": 터치 타겟이 너무 작음 (${Math.round(box.width)}x${Math.round(box.height)}px, 최소 44x44px 권장)`);
        }
      }
    }

    console.log('\n=== 모바일 터치 타겟 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });

  test('모바일 폰트 크기', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    const issues = [];

    // 텍스트 요소의 폰트 크기 확인 (최소 16px 권장 for readability)
    const textElements = page.locator('p, span, label, h1, h2, h3');
    const count = await textElements.count();

    for (let i = 0; i < Math.min(count, 10); i++) { // 첫 10개만 확인
      const el = textElements.nth(i);
      const fontSize = await el.evaluate(e => window.getComputedStyle(e).fontSize);
      const size = parseInt(fontSize);

      if (size < 12) {
        const text = (await el.textContent())?.trim().substring(0, 20) || '(empty)';
        issues.push(`"${text}...": 폰트가 너무 작음 (${fontSize}, 최소 12px 권장)`);
      }
    }

    // 입력 필드 폰트 크기 (iOS에서 16px 미만이면 자동 확대 발생)
    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const fontSize = await input.evaluate(e => window.getComputedStyle(e).fontSize);
      const size = parseInt(fontSize);

      if (size < 16) {
        issues.push(`입력 필드: 폰트 크기가 ${fontSize}로 16px 미만 - iOS에서 자동 확대 발생 가능`);
        break; // 한 번만 경고
      }
    }

    console.log('\n=== 모바일 폰트 크기 분석 결과 ===');
    if (issues.length === 0) {
      console.log('발견된 문제 없음');
    } else {
      issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    }
  });
});

test.describe('색상 대비 분석', () => {
  test('텍스트 색상 대비', async ({ page }) => {
    await page.goto('/login');

    const issues = [];

    // 주요 텍스트 요소의 색상 대비 확인
    const textElements = page.locator('p, span, label, h1, h2');
    const count = await textElements.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const el = textElements.nth(i);
      const [color, bgColor] = await el.evaluate(e => {
        const styles = window.getComputedStyle(e);
        return [styles.color, styles.backgroundColor];
      });

      // 회색 텍스트(text-gray-400 등) 체크
      if (color.includes('156, 163, 175') || color.includes('107, 114, 128')) {
        const text = (await el.textContent())?.trim().substring(0, 20) || '';
        // 이건 의도적인 보조 텍스트일 수 있으므로 경고만
      }
    }

    console.log('\n=== 색상 대비 분석 결과 ===');
    console.log('(상세한 색상 대비 검사는 별도 도구 권장)');
  });
});
