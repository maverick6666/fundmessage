import { defineConfig } from '@playwright/test';

// 환경변수로 로컬/프로덕션 전환
const isLocal = process.env.TEST_ENV === 'local';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,  // 순차 실행 (상호작용 테스트를 위해)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  timeout: 60000,

  use: {
    baseURL: isLocal
      ? 'http://localhost:5173'
      : 'https://fundmessage.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // 한국어 로케일
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },

  // 로컬 테스트 시 서버 자동 시작
  webServer: isLocal ? {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  } : undefined,

  projects: [
    // 단일 사용자 테스트
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    // 팀장+팀원 동시 테스트 (상호작용)
    {
      name: 'dual-user',
      use: { browserName: 'chromium' },
      testMatch: /.*\.dual\.spec\.js$/,
    },
  ],
});
