import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'production-auth.spec.ts',
  outputDir: './test-results-production',
  fullyParallel: false,
  reporter: 'list',
  preserveOutput: 'always',
  timeout: 30_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --config vite.production-test.config.ts --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_APP_ID: '',
    },
  },
});
