import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import { requireEnv } from '../utils/env';

/**
 * auth.setup.ts — Global authentication setup (runs once before all test projects).
 *
 * Logs in once, saves the session cookie to auth/storageState.json.
 * All browser projects in playwright.config.ts load this file so tests
 * start already authenticated — no repeated logins, lower token cost.
 *
 * If your app does NOT require login, delete this file and remove the
 * 'setup' dependency + storageState from playwright.config.ts.
 */

const authFile = path.join(__dirname, 'storageState.json');

setup('authenticate', async ({ page }) => {
  const username = requireEnv('TEST_USERNAME');
  const password = requireEnv('TEST_PASSWORD');
  const baseURL  = process.env.BASE_URL ?? 'https://staging.myapp.com';

  // ── Navigate to login ──────────────────────────────────────────────────────
  await page.goto(`${baseURL}/login`);

  // ── Fill credentials ───────────────────────────────────────────────────────
  // Adjust locators to match your actual login form (run browser_snapshot first)
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // ── Verify successful login before saving session ──────────────────────────
  // Replace '/dashboard' with the actual post-login URL of your app
  await expect(page).toHaveURL(/dashboard/);

  // ── Persist session ────────────────────────────────────────────────────────
  await page.context().storageState({ path: authFile });
});
