/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Zephyr Test ID : QA-INTERNET-04
 * Suite          : Form Authentication — Invalid Credentials Error Handling
 * Target URL     : https://the-internet.herokuapp.com/login
 *
 * Locators sourced from live ariaSnapshot via bridge /snapshot on 2026-03-02:
 *   - textbox "Username"
 *   - textbox "Password"
 *   - button " Login"  (matched via /login/i — leading icon in DOM)
 *   - #flash          (error message — no ARIA role, located by id)
 *
 * Complements QA-INTERNET-01 (happy path). This suite covers the error path.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Zephyr Steps:
 *   Step 1 — Navigate to /login
 *             Expected: Login form is visible
 *   Step 2 — Submit with a wrong username and correct password
 *             Expected: Error flash message appears; still on /login
 *   Step 3 — Submit with correct username and wrong password
 *             Expected: Error flash message appears; still on /login
 *   Step 4 — Clear inputs and verify form is ready for retry
 *             Expected: Both fields are empty
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { zephyrStep, zephyrExpected } from '../../utils/zephyr';

test.describe('[QA-INTERNET-04] Form Authentication — Invalid Credentials Error Handling', () => {

  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('[QA-INTERNET-04] Should show error flash for invalid credentials without redirecting', async ({ page }) => {

    // ══════════════════════════════════════════════════════════════════════════
    // Step 1 — Navigate to /login
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(1, 'Navigate to /login', async () => {
      await loginPage.navigate();
    });

    await zephyrExpected(1, 'Login form (username, password, Login button) is visible', async () => {
      await loginPage.assertLoginFormVisible();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2 — Wrong username, correct password
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(2, 'Submit with wrong username "baduser" and correct password', async () => {
      await loginPage.login('baduser', 'SuperSecretPassword!');
    });

    await zephyrExpected(2, 'Error flash is shown; page stays on /login', async () => {
      await expect(loginPage.flashMessage).toBeVisible();
      await expect(loginPage.flashMessage).toContainText(/Your username is invalid/i);
      await expect(page).toHaveURL(/\/login/);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3 — Correct username, wrong password
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(3, 'Submit with correct username "tomsmith" and wrong password', async () => {
      await loginPage.login('tomsmith', 'wrongpassword');
    });

    await zephyrExpected(3, 'Error flash is shown; page stays on /login', async () => {
      await expect(loginPage.flashMessage).toBeVisible();
      await expect(loginPage.flashMessage).toContainText(/Your password is invalid/i);
      await expect(page).toHaveURL(/\/login/);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4 — Verify form is still interactive after errors
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(4, 'Clear both inputs', async () => {
      await loginPage.usernameInput.clear();
      await loginPage.passwordInput.clear();
    });

    await zephyrExpected(4, 'Both fields are empty and the form is ready for retry', async () => {
      await expect(loginPage.usernameInput).toHaveValue('');
      await expect(loginPage.passwordInput).toHaveValue('');
      await loginPage.assertLoginFormVisible();
    });
  });
});
