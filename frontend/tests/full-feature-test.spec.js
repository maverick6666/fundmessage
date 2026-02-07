import { test, expect } from '@playwright/test';

/**
 * 전체 기능 탐색 테스트
 * 모든 페이지와 주요 기능을 순회하며 테스트
 */

const BASE_URL = 'https://fundmessage.vercel.app';
const MANAGER = { email: 'lhhh0420@naver.com', password: 'lhh0420!' };
const MEMBER = { email: 'test@naver.com', password: '12345678' };

// 발견된 문제 수집
const issues = [];

test.afterAll(async () => {
  console.log('\n' + '='.repeat(70));
  console.log('📋 전체 기능 테스트 결과');
  console.log('='.repeat(70));

  if (issues.length === 0) {
    console.log('\n✅ 모든 테스트 통과! 발견된 문제 없음');
  } else {
    console.log(`\n❌ 발견된 문제: ${issues.length}개\n`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.severity}] ${issue.location}`);
      console.log(`   ${issue.message}`);
      console.log('');
    });
  }

  console.log('='.repeat(70));
});

function logIssue(severity, location, message) {
  issues.push({ severity, location, message });
  console.log(`  ⚠️ [${severity}] ${location}: ${message}`);
}

// 헬퍼: 로그인
async function login(page, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe.serial('팀장 계정 전체 기능 테스트', () => {

  test('1. 로그인', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', MANAGER.email);
    await page.fill('input[type="password"]', MANAGER.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\//, { timeout: 15000 });
    console.log('  ✅ 로그인 성공');
  });

  test('2. 대시보드 확인', async ({ page }) => {
    await login(page, MANAGER);

    // 대시보드 요소 확인
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });

    // 팀 설정 카드
    const teamCard = page.locator('text=/팀 설정|자본금/i').first();
    if (await teamCard.isVisible()) {
      console.log('  ✅ 팀 설정 카드 표시됨');
    }

    // 팀 랭킹 섹션 (새로 추가된 기능)
    const rankingSection = page.locator('text=/팀원 정보|랭킹|주간 출석/i').first();
    if (await rankingSection.isVisible()) {
      console.log('  ✅ 팀 랭킹 섹션 표시됨');
    } else {
      logIssue('INFO', '대시보드', '팀 랭킹 섹션이 표시되지 않음');
    }

    console.log('  ✅ 대시보드 확인 완료');
  });

  test('3. 포지션 페이지', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/positions`);
    await page.waitForLoadState('networkidle');

    // 종목 검색 버튼
    const searchBtn = page.locator('button:has-text("종목 검색"), button:has-text("검색")').first();
    if (await searchBtn.isVisible()) {
      console.log('  ✅ 종목 검색 버튼 표시됨');
      await searchBtn.click();
      await page.waitForTimeout(500);

      // 검색 모달/패널 확인
      const searchInput = page.locator('input[placeholder*="종목"], input[placeholder*="검색"]').first();
      if (await searchInput.isVisible()) {
        console.log('  ✅ 종목 검색 입력창 표시됨');

        // 시장 선택 버튼 확인
        const marketBtn = page.locator('button:has-text("KOSPI"), button:has-text("코스피")').first();
        if (await marketBtn.isVisible()) {
          console.log('  ✅ 시장 선택 버튼 표시됨');
        }
      }
    }

    // 포지션 목록 확인
    const positionCards = page.locator('[class*="card"]').filter({ hasText: /종목|ticker/i });
    const cardCount = await positionCards.count();
    console.log(`  ✅ 포지션 카드 ${cardCount}개 표시됨`);

    // 첫 번째 포지션 클릭
    if (cardCount > 0) {
      await positionCards.first().click();
      await page.waitForURL('**/positions/*', { timeout: 5000 });
      console.log('  ✅ 포지션 상세 페이지 이동');

      // 차트 확인
      const chartArea = page.locator('[class*="chart"], canvas').first();
      if (await chartArea.isVisible({ timeout: 3000 })) {
        console.log('  ✅ 차트 표시됨');
      }

      // 매매계획 섹션
      const tradingPlan = page.locator('text=/매매계획|익절|손절/i').first();
      if (await tradingPlan.isVisible()) {
        console.log('  ✅ 매매계획 섹션 표시됨');
      }

      // 의사결정 노트 섹션
      const noteSection = page.locator('text=/의사결정|노트/i').first();
      if (await noteSection.isVisible()) {
        console.log('  ✅ 의사결정 노트 섹션 표시됨');
      }
    }
  });

  test('4. 요청 페이지', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/requests`);
    await page.waitForLoadState('networkidle');

    // 탭 확인
    const tabs = page.locator('button:has-text("대기"), button:has-text("승인"), button:has-text("전체")');
    if (await tabs.first().isVisible()) {
      console.log('  ✅ 요청 필터 탭 표시됨');
    }

    // 요청 목록 확인
    const requestItems = page.locator('[class*="card"], [class*="list"]').first();
    if (await requestItems.isVisible()) {
      console.log('  ✅ 요청 목록 표시됨');
    }

    console.log('  ✅ 요청 페이지 확인 완료');
  });

  test('5. 토론방 페이지', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/discussions`);
    await page.waitForLoadState('networkidle');

    // 토론 목록 확인
    const discussionList = page.locator('[class*="card"], button:has-text("토론")').first();

    // 첫 번째 토론방 클릭
    const firstDiscussion = page.locator('a[href*="/discussions/"], button').filter({ hasText: /토론|논의/i }).first();
    if (await firstDiscussion.isVisible()) {
      await firstDiscussion.click();
      await page.waitForTimeout(1000);

      // 메시지 입력창 확인
      const msgInput = page.locator('input[placeholder*="메시지"], textarea').first();
      if (await msgInput.isVisible()) {
        console.log('  ✅ 메시지 입력창 표시됨');
      }

      // 차트 공유 버튼
      const chartShareBtn = page.locator('button:has-text("차트"), button[title*="차트"]').first();
      if (await chartShareBtn.isVisible()) {
        console.log('  ✅ 차트 공유 버튼 표시됨');
      }
    }

    console.log('  ✅ 토론방 페이지 확인 완료');
  });

  test('6. 문서 페이지 - 운용보고서', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/reports?tab=operations`);
    await page.waitForLoadState('networkidle');

    // 탭 확인
    const tabs = page.locator('button:has-text("운용보고서"), button:has-text("의사결정서"), button:has-text("칼럼")');
    if (await tabs.first().isVisible()) {
      console.log('  ✅ 문서 탭 표시됨');
    }

    // 포지션 카드 확인
    const positionCards = page.locator('[class*="card"]').first();
    if (await positionCards.isVisible()) {
      console.log('  ✅ 포지션 카드 표시됨');
    }

    console.log('  ✅ 운용보고서 탭 확인 완료');
  });

  test('7. 문서 페이지 - 의사결정서', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/reports?tab=decisions`);
    await page.waitForLoadState('networkidle');

    // 의사결정서 목록 확인
    const noteList = page.locator('[class*="card"], button').filter({ hasText: /의사결정|노트/i }).first();

    // 클릭해서 사이드패널 열기
    const firstNote = page.locator('button[class*="text-left"]').first();
    if (await firstNote.isVisible()) {
      await firstNote.click();
      await page.waitForTimeout(1000);

      // 사이드패널 확인
      const sidePanel = page.locator('aside, [class*="panel"]').last();
      if (await sidePanel.isVisible()) {
        console.log('  ✅ 사이드패널 열림');

        // 수정 버튼 확인 (팀장이므로 보여야 함)
        const editBtn = page.locator('button:has-text("수정")').first();
        if (await editBtn.isVisible()) {
          console.log('  ✅ 의사결정 노트 수정 버튼 표시됨');
        } else {
          logIssue('BUG', '의사결정서', '팀장에게 수정 버튼이 표시되지 않음');
        }
      }
    }

    console.log('  ✅ 의사결정서 탭 확인 완료');
  });

  test('8. 문서 페이지 - 칼럼', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/reports?tab=columns`);
    await page.waitForLoadState('networkidle');

    // 칼럼 작성 버튼
    const createBtn = page.locator('button:has-text("칼럼 작성")').first();
    if (await createBtn.isVisible()) {
      console.log('  ✅ 칼럼 작성 버튼 표시됨');
    }

    // 칼럼 목록
    const columnCards = page.locator('button[class*="text-left"]').first();
    if (await columnCards.isVisible()) {
      await columnCards.click();
      await page.waitForTimeout(1000);

      // 사이드패널 확인
      const sidePanel = page.locator('aside').last();
      if (await sidePanel.isVisible()) {
        console.log('  ✅ 칼럼 사이드패널 열림');

        // 검증 버튼 확인 (다른 사람 칼럼인 경우)
        const verifyBtn = page.locator('button:has-text("검증")').first();
        if (await verifyBtn.isVisible()) {
          console.log('  ✅ 칼럼 검증 버튼 표시됨');
        }

        // 검증 배지 확인
        const verifiedBadge = page.locator('svg[class*="blue"]').first();
        if (await verifiedBadge.isVisible()) {
          console.log('  ✅ 검증 배지 표시됨');
        }
      }
    }

    console.log('  ✅ 칼럼 탭 확인 완료');
  });

  test('9. 통계 페이지', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/stats`);
    await page.waitForLoadState('networkidle');

    // 탭 확인
    const tabs = page.locator('button:has-text("내 통계"), button:has-text("팀 통계"), button:has-text("리더보드")');
    if (await tabs.first().isVisible()) {
      console.log('  ✅ 통계 탭 표시됨');
    }

    // 통계 데이터 확인
    const statsCards = page.locator('[class*="card"]').first();
    if (await statsCards.isVisible()) {
      console.log('  ✅ 통계 카드 표시됨');
    }

    console.log('  ✅ 통계 페이지 확인 완료');
  });

  test('10. 알림 페이지', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('networkidle');

    // 알림 목록
    const notificationList = page.locator('[class*="card"], [class*="list"]').first();

    // 전체 읽음 버튼
    const readAllBtn = page.locator('button:has-text("전체 읽음"), button:has-text("모두 읽음")').first();
    if (await readAllBtn.isVisible()) {
      console.log('  ✅ 전체 읽음 버튼 표시됨');
    }

    // 삭제 버튼
    const deleteBtn = page.locator('button:has(svg[class*="trash"]), button[title*="삭제"]').first();
    if (await deleteBtn.isVisible()) {
      console.log('  ✅ 알림 삭제 버튼 표시됨');
    }

    console.log('  ✅ 알림 페이지 확인 완료');
  });

  test('11. 팀 관리 페이지', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/team`);
    await page.waitForLoadState('networkidle');

    // 팀원 목록
    const memberList = page.locator('table, [class*="list"]').first();
    if (await memberList.isVisible()) {
      console.log('  ✅ 팀원 목록 표시됨');
    }

    // 관리자 모드 토글
    const adminToggle = page.locator('text=/관리자 모드|Admin Mode/i').first();
    if (await adminToggle.isVisible()) {
      console.log('  ✅ 관리자 모드 토글 표시됨');
    }

    console.log('  ✅ 팀 관리 페이지 확인 완료');
  });

  test('12. 설정 페이지', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    // 테마 설정
    const themeSection = page.locator('text=/테마|다크 모드|라이트 모드/i').first();
    if (await themeSection.isVisible()) {
      console.log('  ✅ 테마 설정 섹션 표시됨');
    }

    console.log('  ✅ 설정 페이지 확인 완료');
  });

});

test.describe.serial('팀원 계정 전체 기능 테스트', () => {

  test('1. 팀원 로그인', async ({ page }) => {
    await login(page, MEMBER);
    console.log('  ✅ 팀원 로그인 성공');
  });

  test('2. 팀원 대시보드 - 권한 확인', async ({ page }) => {
    await login(page, MEMBER);

    // 팀 관리 메뉴가 보이면 안됨
    const teamMenu = page.locator('a:has-text("팀 관리")').first();
    if (await teamMenu.isVisible()) {
      logIssue('BUG', '사이드바', '팀원에게 팀 관리 메뉴가 보임');
    } else {
      console.log('  ✅ 팀 관리 메뉴 숨김 확인');
    }

    console.log('  ✅ 팀원 권한 확인 완료');
  });

  test('3. 종목 검색 및 매수 요청', async ({ page }) => {
    await login(page, MEMBER);
    await page.goto(`${BASE_URL}/positions`);
    await page.waitForLoadState('networkidle');

    // 종목 검색 버튼
    const searchBtn = page.locator('button:has-text("종목 검색")').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      await page.waitForTimeout(500);

      // 시장 선택
      const marketBtn = page.locator('button:has-text("NASDAQ"), button:has-text("나스닥")').first();
      if (await marketBtn.isVisible()) {
        await marketBtn.click();
      }

      // 검색
      const searchInput = page.locator('input[placeholder*="검색"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('AAPL');
        await page.waitForTimeout(1000);

        // 검색 결과 확인
        const result = page.locator('button:has-text("AAPL"), [class*="result"]:has-text("AAPL")').first();
        if (await result.isVisible()) {
          console.log('  ✅ 종목 검색 결과 표시됨');
        }
      }
    }

    console.log('  ✅ 종목 검색 확인 완료');
  });

  test('4. 포지션 상세 조회 (팀원)', async ({ page }) => {
    await login(page, MEMBER);
    await page.goto(`${BASE_URL}/positions`);
    await page.waitForLoadState('networkidle');

    // 첫 번째 포지션 클릭
    const positionCard = page.locator('[class*="card"]').first();
    if (await positionCard.isVisible()) {
      await positionCard.click();
      await page.waitForURL('**/positions/*', { timeout: 5000 });

      // 수정 버튼이 팀원에게 보이면 안됨
      const editBtn = page.locator('button:has-text("수정"), button:has-text("편집")').first();
      if (await editBtn.isVisible()) {
        logIssue('BUG', '포지션 상세', '팀원에게 수정 버튼이 보임');
      } else {
        console.log('  ✅ 팀원에게 수정 버튼 숨김 확인');
      }

      // 토론 요청 버튼 확인
      const discussBtn = page.locator('button:has-text("토론 요청")').first();
      if (await discussBtn.isVisible()) {
        console.log('  ✅ 토론 요청 버튼 표시됨');
      }
    }

    console.log('  ✅ 포지션 상세 조회 완료');
  });

  test('5. 문서 - 칼럼 작성', async ({ page }) => {
    await login(page, MEMBER);
    await page.goto(`${BASE_URL}/reports?tab=columns`);
    await page.waitForLoadState('networkidle');

    // 칼럼 작성 버튼
    const createBtn = page.locator('button:has-text("칼럼 작성")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      // 에디터 패널 확인
      const editorPanel = page.locator('aside, [class*="editor"]').last();
      if (await editorPanel.isVisible()) {
        console.log('  ✅ 칼럼 에디터 열림');

        // 제목 입력
        const titleInput = page.locator('input[placeholder*="제목"]').first();
        if (await titleInput.isVisible()) {
          console.log('  ✅ 제목 입력 필드 표시됨');
        }

        // 블록 에디터
        const blockEditor = page.locator('[data-block-editor], textarea').first();
        if (await blockEditor.isVisible()) {
          console.log('  ✅ 블록 에디터 표시됨');
        }

        // 저장 버튼
        const saveBtn = page.locator('button:has-text("저장")').first();
        if (await saveBtn.isVisible()) {
          console.log('  ✅ 저장 버튼 표시됨');
        }

        // 닫기
        const closeBtn = page.locator('button:has-text("취소"), button:has-text("닫기")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }

    console.log('  ✅ 칼럼 작성 UI 확인 완료');
  });

});

test.describe('UI/UX 검증', () => {

  test('텍스트 줄바꿈 확인', async ({ page }) => {
    await login(page, MANAGER);
    await page.goto(`${BASE_URL}/reports?tab=operations`);
    await page.waitForLoadState('networkidle');

    // 카드 너비 확인
    const card = page.locator('[class*="card"]').first();
    if (await card.isVisible()) {
      const box = await card.boundingBox();
      if (box && box.width < 280) {
        logIssue('UX', '운용보고서', '카드 너비가 너무 좁음 (280px 미만)');
      } else {
        console.log('  ✅ 카드 너비 적절함');
      }
    }
  });

  test('다크모드 토글', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // 초기 테마 확인
    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );

    // 테마 토글 버튼 클릭
    const themeBtn = page.locator('button[title*="모드"], button:has(svg[class*="sun"]), button:has(svg[class*="moon"])').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(500);

      const afterDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );

      if (initialDark !== afterDark) {
        console.log('  ✅ 다크모드 토글 정상 작동');
      } else {
        logIssue('BUG', '테마', '다크모드 토글이 작동하지 않음');
      }
    }
  });

  test('모바일 반응형 확인', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, MANAGER);

    // 가로 스크롤 확인
    const hasHScroll = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    if (hasHScroll) {
      logIssue('UX', '모바일', '가로 스크롤 발생');
    } else {
      console.log('  ✅ 모바일 뷰 가로 스크롤 없음');
    }

    // 햄버거 메뉴 확인
    const hamburger = page.locator('button[class*="hamburger"], button:has(svg[class*="menu"])').first();
    if (await hamburger.isVisible()) {
      console.log('  ✅ 모바일 햄버거 메뉴 표시됨');
    }
  });

});
