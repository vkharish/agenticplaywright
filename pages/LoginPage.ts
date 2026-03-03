import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — POM for https://the-internet.herokuapp.com/login
 *
 * Locators sourced from live browser_snapshot (Accessibility Tree):
 *   textbox "Username"
 *   textbox "Password"
 *   button " Login"   ← leading space + icon in DOM; matched with /login/i regex
 *   link "Logout"     ← on /secure page after successful login
 *   flash message     ← "You logged into a secure area!" (role=generic, dynamic)
 */
export class LoginPage extends BasePage {

  // ── Locators ──────────────────────────────────────────────────────────────

  get usernameInput() {
    return this.page.getByRole('textbox', { name: 'Username' });
  }

  get passwordInput() {
    return this.page.getByRole('textbox', { name: 'Password' });
  }

  get loginButton() {
    // Button text is " Login" (leading space + icon). Use regex to avoid exact-match fragility.
    return this.page.getByRole('button', { name: /login/i });
  }

  get flashMessage() {
    // Flash div contains success or error text; no role — locate by id
    return this.page.locator('#flash');
  }

  get logoutLink() {
    return this.page.getByRole('link', { name: 'Logout' });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async navigate(): Promise<void> {
    await this.goto('/login');
  }

  async login(username: string, password: string): Promise<void> {
    await this.fill(this.usernameInput, username);
    await this.fill(this.passwordInput, password);
    await this.click(this.loginButton);
  }

  async logout(): Promise<void> {
    await this.click(this.logoutLink);
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  async assertLoginFormVisible(): Promise<void> {
    await this.assertVisible(this.usernameInput);
    await this.assertVisible(this.passwordInput);
    await this.assertVisible(this.loginButton);
  }

  async assertLoginSuccess(): Promise<void> {
    await this.assertURL(/\/secure/);
    await this.assertVisible(this.flashMessage);
    await this.assertText(this.flashMessage, /You logged into a secure area!/);
  }

  async assertLogoutSuccess(): Promise<void> {
    await this.assertVisible(this.flashMessage);
    await this.assertText(this.flashMessage, /You logged out of the secure area!/i);
  }
}
