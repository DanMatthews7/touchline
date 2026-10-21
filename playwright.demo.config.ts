import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/season-demo.spec.ts', '**/career.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 0,
  outputDir: 'test-results-demo',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-demo', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4181',
    viewport: { width: 1280, height: 800 },
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    },
  },
  webServer: {
    command: 'npm exec vite -- --mode season-demo --host 127.0.0.1 --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
