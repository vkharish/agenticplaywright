/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Zephyr Test ID : QA-INTERNET-02
 * Suite          : Checkboxes — State Verification & Toggle
 * Target URL     : https://the-internet.herokuapp.com/checkboxes
 *
 * Locators sourced from live browser_snapshot on 2026-03-01:
 *   - checkbox (nth=0) → "checkbox 1" — unchecked by default
 *   - checkbox (nth=1) → "checkbox 2" — checked by default
 *
 * Note: Neither checkbox has an aria-label in the DOM.
 *       Located by getByRole('checkbox').nth(n) — stable across page reloads.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Zephyr Steps:
 *   Step 1 — Navigate to /checkboxes
 *             Expected: Page heading "Checkboxes" is visible
 *   Step 2 — Verify default checkbox states
 *             Expected: checkbox 1 = unchecked | checkbox 2 = checked
 *   Step 3 — Check checkbox 1
 *             Expected: checkbox 1 is now checked
 *   Step 4 — Uncheck checkbox 2
 *             Expected: checkbox 2 is now unchecked
 *   Step 5 — Reload the page and verify states reset to defaults
 *             Expected: checkbox 1 = unchecked | checkbox 2 = checked (page default)
 */

import { test, expect } from '@playwright/test';
import { CheckboxesPage } from '../../pages/CheckboxesPage';
import { zephyrStep, zephyrExpected } from '../../utils/zephyr';

test.describe('[QA-INTERNET-02] Checkboxes — State Verification & Toggle', () => {

  let checkboxesPage: CheckboxesPage;

  test.beforeEach(async ({ page }) => {
    checkboxesPage = new CheckboxesPage(page);
  });

  test('[QA-INTERNET-02] Should display correct default states and toggle correctly', async ({ page }) => {

    // ══════════════════════════════════════════════════════════════════════════
    // Step 1 — Navigate to the Checkboxes page
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(1, 'Navigate to /checkboxes', async () => {
      await checkboxesPage.navigate();
    });

    await zephyrExpected(1, 'Page heading "Checkboxes" is visible', async () => {
      await expect(page.getByRole('heading', { name: 'Checkboxes' })).toBeVisible();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2 — Verify default checkbox states (from live snapshot)
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(2, 'Verify default checkbox states on page load', async () => {
      // No action needed — verifying current state
    });

    await zephyrExpected(2, 'Checkbox 1 is unchecked; Checkbox 2 is checked (page defaults)', async () => {
      await expect(checkboxesPage.checkbox1).not.toBeChecked();
      await expect(checkboxesPage.checkbox2).toBeChecked();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3 — Check checkbox 1
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(3, 'Check checkbox 1 (currently unchecked)', async () => {
      await checkboxesPage.checkBox1();
    });

    await zephyrExpected(3, 'Checkbox 1 is now checked', async () => {
      await expect(checkboxesPage.checkbox1).toBeChecked();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4 — Uncheck checkbox 2
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(4, 'Uncheck checkbox 2 (currently checked)', async () => {
      await checkboxesPage.uncheckBox2();
    });

    await zephyrExpected(4, 'Checkbox 2 is now unchecked', async () => {
      await expect(checkboxesPage.checkbox2).not.toBeChecked();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 5 — Reload and verify page defaults are restored
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(5, 'Reload the page', async () => {
      await page.reload();
    });

    await zephyrExpected(5, 'After reload: Checkbox 1 = unchecked, Checkbox 2 = checked (defaults restored)', async () => {
      await expect(checkboxesPage.checkbox1).not.toBeChecked();
      await expect(checkboxesPage.checkbox2).toBeChecked();
    });
  });
});
