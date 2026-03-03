/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Zephyr Test ID : QA-INTERNET-01
 * Suite          : Form Authentication — Login & Logout
 * Target URL     : https://the-internet.herokuapp.com/login
 *
 * Locators sourced from live browser_snapshot on 2026-03-01.
 * No mocks. No screenshots. Runs headless in CI at $0 token cost.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Zephyr Steps:
 *   Step 1 — Navigate to /login
 *             Expected: Login form (username, password, button) is visible
 *   Step 2 — Enter username "tomsmith" and password "SuperSecretPassword!"
 *             Expected: Credentials appear in their respective inputs
 *   Step 3 — Click the Login button
 *             Expected: Redirected to /secure with success flash message
 *   Step 4 — Click the Logout link
 *             Expected: Flash message confirms logout; login form reappears
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { zephyrStep, zephyrExpected } from '../../utils/zephyr';
import { requireEnv } from '../../utils/env';

const USERNAME = requireEnv('TEST_USERNAME');
const PASSWORD = requireEnv('TEST_PASSWORD');

test.describe('[QA-INTERNET-01] Form Authentication — Login & Logout', () => {

  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('[QA-INTERNET-01] Should login with valid credentials and logout successfully', async ({ page }) => {

    // ══════════════════════════════════════════════════════════════════════════
    // Step 1 — Navigate to the Login page
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(1, 'Navigate to /login', async () => {
      await loginPage.navigate();
    });

    await zephyrExpected(1, 'Login form (username, password, Login button) is visible', async () => {
      await loginPage.assertLoginFormVisible();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2 — Enter credentials
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(2, `Enter username "${USERNAME}" and password`, async () => {
      await loginPage.fill(loginPage.usernameInput, USERNAME);
      await loginPage.fill(loginPage.passwordInput, PASSWORD);
    });

    await zephyrExpected(2, 'Credentials are reflected in the input fields', async () => {
      await expect(loginPage.usernameInput).toHaveValue(USERNAME);
      await expect(loginPage.passwordInput).toHaveValue(PASSWORD);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3 — Submit login
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(3, 'Click the Login button', async () => {
      await loginPage.click(loginPage.loginButton);
    });

    await zephyrExpected(3, 'Redirected to /secure; success flash message visible', async () => {
      await loginPage.assertLoginSuccess();
      // Confirm "Logout" link is present on the Secure Area page
      await expect(loginPage.logoutLink).toBeVisible();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4 — Logout
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(4, 'Click the Logout link', async () => {
      await loginPage.logout();
    });

    await zephyrExpected(4, 'Logout flash message shown; login form is visible again', async () => {
      await loginPage.assertLogoutSuccess();
      await loginPage.assertLoginFormVisible();
    });
  });
});
