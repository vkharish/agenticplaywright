/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Zephyr Test ID : QA-INTERNET-03
 * Suite          : Dropdown — Option Selection
 * Target URL     : https://the-internet.herokuapp.com/dropdown
 *
 * Locators sourced from live ariaSnapshot via bridge /snapshot on 2026-03-02:
 *   - combobox (no aria-label) — located by role, unique on page
 *   - option "Option 1" | option "Option 2"
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Zephyr Steps:
 *   Step 1 — Navigate to /dropdown
 *             Expected: Heading "Dropdown List" is visible
 *   Step 2 — Verify the default selected option
 *             Expected: "Please select an option" is selected
 *   Step 3 — Select "Option 1"
 *             Expected: Dropdown value is "1"
 *   Step 4 — Select "Option 2"
 *             Expected: Dropdown value is "2"
 */

import { test, expect } from '@playwright/test';
import { DropdownPage } from '../../pages/DropdownPage';
import { zephyrStep, zephyrExpected } from '../../utils/zephyr';

test.describe('[QA-INTERNET-03] Dropdown — Option Selection', () => {

  let dropdownPage: DropdownPage;

  test.beforeEach(async ({ page }) => {
    dropdownPage = new DropdownPage(page);
  });

  test('[QA-INTERNET-03] Should select dropdown options correctly', async () => {

    // ══════════════════════════════════════════════════════════════════════════
    // Step 1 — Navigate to /dropdown
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(1, 'Navigate to /dropdown', async () => {
      await dropdownPage.navigate();
    });

    await zephyrExpected(1, 'Heading "Dropdown List" is visible', async () => {
      await dropdownPage.assertHeadingVisible();
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2 — Verify default selected state
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(2, 'Verify the default placeholder option is selected', async () => {
      // No action — verifying current DOM state from snapshot
    });

    await zephyrExpected(2, '"Please select an option" is selected (value="")', async () => {
      // The placeholder option has value="" in the DOM
      await dropdownPage.assertSelectedValue('');
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3 — Select Option 1
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(3, 'Select "Option 1" from the dropdown', async () => {
      await dropdownPage.pickOption('1');
    });

    await zephyrExpected(3, 'Dropdown value is now "1" (Option 1 selected)', async () => {
      await dropdownPage.assertSelectedValue('1');
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4 — Select Option 2
    // ══════════════════════════════════════════════════════════════════════════
    await zephyrStep(4, 'Select "Option 2" from the dropdown', async () => {
      await dropdownPage.pickOption('2');
    });

    await zephyrExpected(4, 'Dropdown value is now "2" (Option 2 selected)', async () => {
      await dropdownPage.assertSelectedValue('2');
    });
  });
});
