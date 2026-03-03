import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * CheckboxesPage — POM for https://the-internet.herokuapp.com/checkboxes
 *
 * Locators sourced from live browser_snapshot (Accessibility Tree):
 *   checkbox [unchecked]  — "checkbox 1" (first, no accessible name in DOM)
 *   checkbox [checked]    — "checkbox 2" (second, pre-checked by default)
 *
 * Note: Neither checkbox has an aria-label — scoped by nth index only.
 */
export class CheckboxesPage extends BasePage {

  // ── Locators ──────────────────────────────────────────────────────────────

  get checkbox1() {
    // First checkbox — unchecked by default
    return this.page.getByRole('checkbox').nth(0);
  }

  get checkbox2() {
    // Second checkbox — checked by default
    return this.page.getByRole('checkbox').nth(1);
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async navigate(): Promise<void> {
    await this.goto('/checkboxes');
  }

  async checkBox1(): Promise<void> {
    await this.checkbox1.check();
  }

  async uncheckBox2(): Promise<void> {
    await this.checkbox2.uncheck();
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  async assertDefaultState(): Promise<void> {
    // On page load: checkbox 1 = unchecked, checkbox 2 = checked
    await this.page.waitForSelector('input[type="checkbox"]');
    const cb1 = await this.checkbox1.isChecked();
    const cb2 = await this.checkbox2.isChecked();

    const { expect } = await import('@playwright/test');
    expect(cb1, 'Checkbox 1 should be unchecked by default').toBe(false);
    expect(cb2, 'Checkbox 2 should be checked by default').toBe(true);
  }
}
