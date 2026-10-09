import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    env: {
      NEXT_TEST_DIST_DIR: '.next-test',
      REDIS_URL: 'redis://127.0.0.1:6380',
      ROOM_MAX_PARTICIPANTS: '12',
      ROOM_LIFETIME_DAYS: '1',
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
