import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['monitoring.spec.ts', 'm5-assignment.spec.ts', 'm7-full-integration.spec.ts'],
  fullyParallel: false,
  reporter: 'list',
  preserveOutput: 'always',
  timeout: 30_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'chromium-mobile-large', use: { ...devices['Desktop Chrome'], viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config vite.e2e.config.ts --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_APP_ID: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_STORAGE_BUCKET: '',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '',
      VITE_FIREBASE_MEASUREMENT_ID: '',
      VITE_API_BASE_URL: 'http://127.0.0.1:8080/api/v1',
    },
  },
});
