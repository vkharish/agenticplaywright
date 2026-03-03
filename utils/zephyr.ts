import { test } from '@playwright/test';

/**
 * zephyrStep — wraps a Zephyr manual step in a Playwright test.step() block.
 *
 * Benefits:
 *  - Appears labelled in HTML report (step number + description)
 *  - Failure message maps 1-to-1 with Zephyr step IDs for easy triage
 *  - Zero cost in CI — it's pure TypeScript, no external API calls
 *
 * Usage:
 *   await zephyrStep(1, 'Navigate to Login page', async () => {
 *     await loginPage.navigate();
 *   });
 */
export async function zephyrStep(
  stepNumber: number,
  description: string,
  action: () => Promise<void>
): Promise<void> {
  await test.step(`[Step ${stepNumber}] ${description}`, action);
}

/**
 * zephyrExpected — wraps the assertion for an expected result.
 *
 * Usage:
 *   await zephyrExpected(1, 'Login form is visible', async () => {
 *     await loginPage.assertLoginFormVisible();
 *   });
 */
export async function zephyrExpected(
  stepNumber: number,
  expectedResult: string,
  assertion: () => Promise<void>
): Promise<void> {
  await test.step(`[Expected ${stepNumber}] ${expectedResult}`, assertion);
}
