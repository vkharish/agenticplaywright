import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load .env file if present (local dev); CI injects env vars directly
dotenv.config();

export default defineConfig({
  // ── Test discovery ──────────────────────────────────────────────────────────
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  // ── Parallelism ─────────────────────────────────────────────────────────────
  // Disable parallel execution within a single file so Zephyr steps stay ordered
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,

  // ── Retries ─────────────────────────────────────────────────────────────────
  // 2 retries in CI to absorb flaky network conditions; 0 locally for fast feedback
  retries: process.env.CI ? 2 : 0,

  // ── Global timeout ──────────────────────────────────────────────────────────
  timeout: 60_000,          // per-test timeout
  expect: {
    timeout: 10_000,        // per-assertion timeout (web-first assertions)
  },

  // ── Reporters ───────────────────────────────────────────────────────────────
  reporter: [
    ['list'],                             // real-time console output
    ['html', { open: 'never' }],          // full HTML report (open manually)
    ['junit', { outputFile: 'test-results/junit.xml' }], // CI integration
  ],

  // ── Shared browser context settings ─────────────────────────────────────────
  use: {
    baseURL: process.env.BASE_URL ?? 'https://staging.myapp.com',

    // Always prefer Accessibility Tree (no screenshots unless explicitly called)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',

    // Slow down actions in headed mode to visually trace execution
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // ── Browser projects ────────────────────────────────────────────────────────
  projects: [
    // ── Authenticated setup project (runs once, saves session cookie) ─────────
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },

    // ── Public / self-contained tests (the-internet, etc.) ────────────────────
    // No storageState — auth is handled inside each test that needs it.
    {
      name: 'public-chromium',
      testMatch: '**/QA-INTERNET-*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://the-internet.herokuapp.com',
      },
    },

    // ── Primary: Chromium (Desktop) ───────────────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'auth/storageState.json',
      },
      dependencies: ['setup'],
    },

    // ── Secondary: Firefox ────────────────────────────────────────────────────
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'auth/storageState.json',
      },
      dependencies: ['setup'],
    },

    // ── Mobile viewport smoke ─────────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        storageState: 'auth/storageState.json',
      },
      dependencies: ['setup'],
    },
  ],

  // ── Output directories ───────────────────────────────────────────────────────
  outputDir: 'test-results',
});
