import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * DropdownPage — POM for https://the-internet.herokuapp.com/dropdown
 *
 * Locators sourced from live ariaSnapshot (bridge /snapshot):
 *   heading "Dropdown List" [level=3]
 *   combobox (no accessible name — located by role alone)
 *     option "Please select an option" [disabled][selected]
 *     option "Option 1"
 *     option "Option 2"
 */
export class DropdownPage extends BasePage {

  // ── Locators ────────────────────────────────────────────────────────────────

  get heading() {
    return this.page.getByRole('heading', { name: 'Dropdown List' });
  }

  get dropdown() {
    // Combobox has no aria-label — located by role; unique on page
    return this.page.getByRole('combobox');
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async navigate(): Promise<void> {
    await this.goto('/dropdown');
  }

  async pickOption(value: string): Promise<void> {
    await this.selectOption(this.dropdown, value);
  }

  // ── Assertions ──────────────────────────────────────────────────────────────

  async assertHeadingVisible(): Promise<void> {
    await this.assertVisible(this.heading);
  }

  async assertSelectedValue(value: string): Promise<void> {
    await this.assertValue(this.dropdown, value);
  }
}
