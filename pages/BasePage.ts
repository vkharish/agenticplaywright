import { Page, Locator, expect } from '@playwright/test';

/**
 * BasePage — inherited by every Page Object.
 *
 * Provides:
 *  - Consistent navigation helpers
 *  - Web-first assertion wrappers (so individual POMs stay DRY)
 *  - Accessibility-tree-first locator strategy (getByRole > getByLabel > getByTestId)
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  // ── Navigation ──────────────────────────────────────────────────────────────

  async goto(path: string = ''): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  // ── Locator helpers (Accessibility-Tree-first priority) ─────────────────────

  /** Prefer getByRole over everything else for interactive elements */
  role(role: Parameters<Page['getByRole']>[0], options?: Parameters<Page['getByRole']>[1]): Locator {
    return this.page.getByRole(role, options);
  }

  /** Use for form fields paired with <label> elements */
  label(text: string): Locator {
    return this.page.getByLabel(text);
  }

  /** Use when engineers have added data-testid attributes */
  testId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  /** Visible text – use only for static content assertions, not interactions */
  text(text: string | RegExp): Locator {
    return this.page.getByText(text);
  }

  // ── Web-First Assertion wrappers ────────────────────────────────────────────

  async assertVisible(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeVisible();
  }

  async assertHidden(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeHidden();
  }

  async assertText(locator: Locator, expected: string | RegExp): Promise<void> {
    await expect(locator).toHaveText(expected);
  }

  async assertValue(locator: Locator, expected: string): Promise<void> {
    await expect(locator).toHaveValue(expected);
  }

  async assertURL(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  async assertTitle(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(pattern);
  }

  async assertEnabled(locator: Locator): Promise<void> {
    await expect(locator).toBeEnabled();
  }

  async assertDisabled(locator: Locator): Promise<void> {
    await expect(locator).toBeDisabled();
  }

  // ── Interaction helpers ─────────────────────────────────────────────────────

  async fill(locator: Locator, value: string): Promise<void> {
    await locator.clear();
    await locator.fill(value);
  }

  async click(locator: Locator): Promise<void> {
    await locator.click();
  }

  async selectOption(locator: Locator, value: string): Promise<void> {
    await locator.selectOption(value);
  }
}
