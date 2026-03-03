#!/usr/bin/env node
/**
 * generate.js — standalone spec generator (no bridge, no n8n, no Docker)
 *
 * Reads a test-cases .md file, launches Playwright directly, takes a live
 * DOM snapshot for each URL, calls Claude, and writes .spec.ts files into
 * tests/zephyr/.
 *
 * Usage:
 *   node generate.js [path/to/test-cases.md]
 *
 * Requires in .env (or exported in shell):
 *   ANTHROPIC_API_KEY=sk-ant-...
 *
 * Optional:
 *   CLAUDE_MODEL=claude-sonnet-4-6   (default: claude-opus-4-6)
 *   SPECS_OUT_DIR=tests/zephyr
 */

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "bridge", ".env") });

const fs   = require("fs");
const path = require("path");

const SCRIPT_DIR = __dirname;
const SPECS_OUT  = path.resolve(process.env.SPECS_OUT_DIR ?? path.join(SCRIPT_DIR, "tests", "zephyr"));
const SNAP_OUT   = path.join(SCRIPT_DIR, "bridge", "snapshots");
const MD_FILE    = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "bridge", "test-cases", "the-internet.md"));

// ── interactive roles worth surfacing as locator suggestions ─────────────────
const INTERACTIVE_ROLES = new Set([
  "button", "link", "textbox", "combobox", "checkbox", "radio",
  "menuitem", "tab", "switch", "searchbox", "spinbutton",
  "listbox", "option", "menuitemcheckbox", "menuitemradio",
]);

// ── parse ariaSnapshot string → getByRole() suggestions ─────────────────────
function extractLocators(snapshot) {
  const results = [];
  const lineRe  = /^[\s-]*(\w[\w-]*)\s+"([^"]+)"/;

  for (const raw of snapshot.split("\n")) {
    const m = raw.match(lineRe);
    if (!m) continue;
    const role = m[1].toLowerCase();
    const name = m[2];
    if (!INTERACTIVE_ROLES.has(role)) continue;

    const trimmed   = name.trim();
    const needsRegex = name !== trimmed || /[A-Z]/.test(name);
    const nameArg   = needsRegex
      ? `/${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/i`
      : `'${trimmed}'`;

    results.push({
      element  : `${role.charAt(0).toUpperCase() + role.slice(1)} "${trimmed}"`,
      locator  : `page.getByRole('${role}', { name: ${nameArg} })`,
      priority : ["button", "textbox", "link", "combobox"].includes(role) ? 1 : 2,
    });
  }
  return results;
}

// ── take a DOM snapshot with Playwright ─────────────────────────────────────
async function snapshot(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(500);
  const title          = await page.title();
  const finalUrl       = page.url();
  const accessibilityTree = await page.locator("body").ariaSnapshot();
  const suggestedLocators = extractLocators(accessibilityTree);
  return { title, finalUrl, accessibilityTree, suggestedLocators };
}

// ── call Claude to generate a .spec.ts ───────────────────────────────────────
async function generateSpec({ testId, suiteName, description, url, credentialsPrefix, accessibilityTree, suggestedLocators }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set.\n" +
      "  Add it to .env or bridge/.env:\n" +
      "  ANTHROPIC_API_KEY=sk-ant-..."
    );
  }

  const client = new Anthropic({ apiKey });

  const locatorLines = suggestedLocators
    .map(l => `  ${l.element}  →  ${l.locator}`)
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
 * Locators sourced from live ariaSnapshot via generate.js.
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

  const model    = process.env.CLAUDE_MODEL ?? "claude-opus-4-6";
  const response = await client.messages.create({
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

// ── parse .md ─────────────────────────────────────────────────────────────────
function parseMd(filePath) {
  const lines   = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const cases   = [];
  let cur       = null;
  let autoIdx   = 1;

  const flush = () => {
    if (cur?.url) {
      if (!cur.testId) cur.testId = `QA-AUTO-${String(autoIdx++).padStart(2, "0")}`;
      cases.push(cur);
    }
  };

  for (const line of lines) {
    const heading    = line.match(/^##\s+(.+)/);
    const testIdLine = line.match(/^testId:\s+(.+)/);
    const urlLine    = line.match(/^url:\s+(.+)/);
    const descLine   = line.match(/^description:\s+(.+)/);
    const credLine   = line.match(/^credentials:\s+(.+)/);

    if (heading) {
      flush();
      cur = { name: heading[1].trim(), testId: "", url: "", description: "", credentialsPrefix: "" };
    } else if (cur) {
      if (testIdLine) cur.testId            = testIdLine[1].trim();
      if (urlLine)    cur.url               = urlLine[1].trim();
      if (descLine)   cur.description       = descLine[1].trim();
      if (credLine)   cur.credentialsPrefix = credLine[1].trim();
    }
  }
  flush();
  return cases;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(MD_FILE)) {
    console.error(`File not found: ${MD_FILE}`);
    process.exit(1);
  }

  const cases = parseMd(MD_FILE);
  if (cases.length === 0) {
    console.error("No test cases (url: lines) found in", MD_FILE);
    process.exit(1);
  }

  fs.mkdirSync(SPECS_OUT, { recursive: true });
  fs.mkdirSync(SNAP_OUT,  { recursive: true });

  // Launch browser once, reuse across all test cases
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });

  console.log(`\nFound ${cases.length} test case(s) in ${MD_FILE}\n`);

  let passed = 0, failed = 0;

  for (let i = 0; i < cases.length; i++) {
    const { testId, name, url, description, credentialsPrefix } = cases[i];
    console.log(`  [${i + 1}/${cases.length}] ${testId} — ${name}`);
    console.log(`         ${description || ""}`);

    const context = await browser.newContext();
    const page    = await context.newPage();

    try {
      // 1. Snapshot
      process.stdout.write(`         Snapshot …`);
      const snap     = await snapshot(page, url);
      const snapFile = path.join(SNAP_OUT, `${testId}.json`);
      fs.writeFileSync(snapFile, JSON.stringify({ ...snap, testCase: { testId, name, description } }, null, 2));
      process.stdout.write(` ✓   Generate spec …`);

      // 2. Call Claude
      const spec     = await generateSpec({ testId, suiteName: name, description, url: snap.finalUrl, credentialsPrefix: credentialsPrefix || undefined, accessibilityTree: snap.accessibilityTree, suggestedLocators: snap.suggestedLocators });
      const specFile = path.join(SPECS_OUT, `${testId}.spec.ts`);
      fs.writeFileSync(specFile, spec, "utf8");

      console.log(` ✓`);
      console.log(`         → bridge/snapshots/${path.basename(snapFile)}`);
      console.log(`         → tests/zephyr/${path.basename(specFile)}`);
      passed++;
    } catch (err) {
      console.log(` ✗  ${err.message}`);
      failed++;
    } finally {
      await page.close();
      await context.close();
    }
    console.log();
  }

  await browser.close();
  console.log(`Done: ${passed} passed, ${failed} failed.`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
