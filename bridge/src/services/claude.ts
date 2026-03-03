import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface GenerateSpecParams {
  testId: string;
  suiteName: string;
  description: string;
  url: string;
  credentialsPrefix?: string;   // e.g. "THE_INTERNET" → THE_INTERNET_USERNAME / THE_INTERNET_PASSWORD
  accessibilityTree: string;
  suggestedLocators: Array<{ element: string; locator: string; priority: number }>;
}

export async function generateSpec(params: GenerateSpecParams): Promise<string> {
  const { testId, suiteName, description, url, credentialsPrefix, accessibilityTree, suggestedLocators } = params;

  const locatorLines = suggestedLocators
    .map((l) => `  ${l.element}  →  ${l.locator}`)
    .join("\n");

  const credentialBlock = credentialsPrefix
    ? `
## Credentials (NEVER hardcode — always read from env)
This test requires a username and password. Use this exact pattern:

\`\`\`typescript
import { appCredentials } from '../../utils/env';
const { username, password } = appCredentials('${credentialsPrefix}');
\`\`\`

The values come from .env:
  ${credentialsPrefix}_USERNAME=<the actual username>
  ${credentialsPrefix}_PASSWORD=<the actual password>

Use the \`username\` and \`password\` variables in the test steps — never paste the real values.`
    : `
## Credentials
This page does not require login credentials. Do not import or reference any credential utilities.`;

  const prompt = `You are a Playwright test automation engineer. Generate a complete .spec.ts file.

## Project conventions (follow exactly)

- Import: \`import { test, expect } from '@playwright/test';\`
- Import: \`import { zephyrStep, zephyrExpected } from '../../utils/zephyr';\`
- Do NOT import Page Object classes — write all locators inline using the list below
- Use ONLY \`getByRole()\` locators from the provided list — never CSS or XPath
- Wrap every action in \`await zephyrStep(n, 'description', async () => { ... })\`
- Wrap every assertion in \`await zephyrExpected(n, 'description', async () => { ... })\`
- Use web-first assertions: toBeVisible(), toHaveValue(), toContainText(), toHaveURL()
- Generate 3–5 meaningful steps covering the main user journey on this page
- Output ONLY valid TypeScript — no markdown fences, no explanation

## Header format (use this exactly, fill in the blanks)

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Zephyr Test ID : ${testId}
 * Suite          : ${suiteName}
 * Target URL     : ${url}
 *
 * Locators sourced from live ariaSnapshot via bridge /snapshot.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Zephyr Steps:
 *   Step 1 — [your step]
 *             Expected: [your expected]
 *   ...
 */

## Test metadata
- Test ID   : ${testId}
- Suite     : ${suiteName}
- Description: ${description}
- URL       : ${url}
${credentialBlock}

## Live accessibility tree (from Playwright ariaSnapshot)
${accessibilityTree}

## Available locators — use ONLY these
${locatorLines}

Generate the complete spec file now:`;

  const model = process.env.CLAUDE_MODEL ?? "claude-opus-4-6";
  const response = await client().messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");

  return block.text
    .replace(/^```(?:typescript|ts)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}
