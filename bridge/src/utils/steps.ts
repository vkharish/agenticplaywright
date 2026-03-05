import { Page } from "playwright";

export interface StepCredentials {
  username: string;
  password: string;
}

/**
 * Execute a list of navigation steps on a Playwright page before snapshotting.
 *
 * Supported step strings:
 *   login                      — fill username + password from credentials, click submit
 *   click: <text>              — click the first element whose accessible name matches <text>
 *   navigate: <url>            — navigate to <url>
 *   fill: <label> | <value>    — fill the input labelled <label> with <value>
 *   wait                       — wait for networkidle
 *   wait: <ms>                 — wait <ms> milliseconds
 */
export async function executeSteps(
  page: Page,
  steps: string[],
  credentials?: StepCredentials
): Promise<void> {
  for (const raw of steps) {
    const step = raw.trim();

    if (step === "login") {
      if (!credentials) {
        throw new Error(
          "Step 'login' requires credentials (username/password) but none were provided. " +
          "Set the credentials: field in your .md file and ensure the env vars are set."
        );
      }
      await page.getByRole("textbox", { name: /username|email|user/i }).fill(credentials.username);
      await page.getByRole("textbox", { name: /password/i }).fill(credentials.password);
      await page.getByRole("button", { name: /log.?in|sign.?in|submit/i }).click();
      await page.waitForLoadState("domcontentloaded");
      continue;
    }

    if (step.startsWith("click:")) {
      const text   = step.slice("click:".length).trim();
      const nameRe = new RegExp(text, "i");
      const roles  = [
        "button", "link", "tab", "menuitem", "option", "menuitemcheckbox",
      ] as const;
      let clicked = false;
      for (const role of roles) {
        const locator = page.getByRole(role, { name: nameRe });
        if (await locator.count() > 0) {
          await locator.first().click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        await page.getByText(text, { exact: false }).first().click();
      }
      await page.waitForLoadState("domcontentloaded");
      continue;
    }

    if (step.startsWith("navigate:")) {
      const url = step.slice("navigate:".length).trim();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      continue;
    }

    if (step.startsWith("fill:")) {
      const rest = step.slice("fill:".length).trim();
      const pipe = rest.indexOf("|");
      if (pipe === -1) {
        throw new Error(
          `Step 'fill:' must be 'fill: <label> | <value>'. Got: ${step}`
        );
      }
      const label = rest.slice(0, pipe).trim();
      const value = rest.slice(pipe + 1).trim();
      await page.getByRole("textbox", { name: new RegExp(label, "i") }).fill(value);
      continue;
    }

    if (step === "wait") {
      await page.waitForLoadState("networkidle");
      continue;
    }

    if (step.startsWith("wait:")) {
      const ms = parseInt(step.slice("wait:".length).trim(), 10);
      if (isNaN(ms)) {
        throw new Error(`Step 'wait:<ms>' expects a number. Got: ${step}`);
      }
      await page.waitForTimeout(ms);
      continue;
    }

    throw new Error(
      `Unknown step: "${step}". ` +
      `Supported: login | click:<text> | navigate:<url> | fill:<label>|<value> | wait | wait:<ms>`
    );
  }
}
