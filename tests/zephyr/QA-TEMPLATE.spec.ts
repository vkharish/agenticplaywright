/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Zephyr Test ID : QA-TEMPLATE
 * Suite          : [Replace with your Jira Epic / Suite name]
 * Target URL     : Loaded from BASE_URL env var (see .env / playwright.config.ts)
 * Author         : [Your name]
 * Generated      : Agentic Playwright Framework
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * HOW TO USE THIS TEMPLATE
 * ────────────────────────
 * 1. Copy this file and rename it to your Zephyr ID: e.g. QA-101.spec.ts
 * 2. Replace every [PLACEHOLDER] below with real values from your Zephyr steps.
 * 3. Run `browser_snapshot` on the target page to discover stable locators.
 * 4. Replace the example locators in the POM (pages/) with your actual selectors.
 * 5. Run: npx playwright test tests/zephyr/QA-101.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { zephyrStep, zephyrExpected } from '../../utils/zephyr';

// ── Import Page Objects (add more as your suite grows) ─────────────────────────
// import { LoginPage }    from '../../pages/LoginPage';
// import { DashboardPage } from '../../pages/DashboardPage';

// ── Test data (prefer env vars; never hardcode credentials) ───────────────────
// import { requireEnv } from '../../utils/env';

test.describe('[QA-TEMPLATE] [Replace with Zephyr Test Name]', () => {

  // ── Optional: initialise Page Objects once per test ──────────────────────────
  // let loginPage: LoginPage;
  // let dashboardPage: DashboardPage;

  // test.beforeEach(async ({ page }) => {
  //   loginPage     = new LoginPage(page);
  //   dashboardPage = new DashboardPage(page);
  // });

  test('[QA-TEMPLATE] Should [describe the expected outcome]', async ({ page }) => {

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 1 — [Paste Zephyr Step 1 description here]
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(1, '[Zephyr Step 1 description]', async () => {
      // Action — replace with real locator/action
      await page.goto('/');                             // or loginPage.navigate()
    });

    // Expected Result 1 — [Paste Zephyr Expected Result 1 here]
    await zephyrExpected(1, '[Expected Result 1]', async () => {
      // Web-First Assertion — replace with real assertion
      await expect(page).toHaveTitle(/[Your App Title]/);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 2 — [Paste Zephyr Step 2 description here]
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(2, '[Zephyr Step 2 description]', async () => {
      // Example: click a button identified by its accessible role + name
      // await page.getByRole('button', { name: 'Submit' }).click();
    });

    // Expected Result 2 — [Paste Zephyr Expected Result 2 here]
    await zephyrExpected(2, '[Expected Result 2]', async () => {
      // Example: assert a success message is visible
      // await expect(page.getByRole('alert')).toContainText('Success');
    });

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 3 — [Add as many steps as your Zephyr test has]
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(3, '[Zephyr Step 3 description]', async () => {
      // ...
    });

    await zephyrExpected(3, '[Expected Result 3]', async () => {
      // ...
    });
  });
});
